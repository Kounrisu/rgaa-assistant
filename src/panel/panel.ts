import { auditStats, countsOf, isProvisional, rateOf } from '../lib/audit-sheet'
import { createPage, emptyAudit, findPage, listAudits, normalizeUrl } from '../lib/audit-store'
import { createAuditSession, describeAuditError } from './audit-session'
import type { ContentMessage } from '../lib/messages'
import { getLang, setLang, t, translateStatic, type Lang } from '../lib/i18n'
import { type Outcome } from '../lib/results'
import { colorOf } from '../lib/theme-colors'
import { initPageTools, renderPageTools, resetPageTools, setPageToolsTheme } from './page-tools-ui'
import { mergeCoverage } from '../lib/scan-coverage'
import { findingCriterionIds } from '../lib/findings'
import { FINDING_THEMES, SCANNED_THEMES, THEMES, THEME_LABEL, themeByNumber } from '../lib/themes'
import type { Audit, AuditSummary, PageRecord } from '../lib/types'
import type { View } from './types'
import { dateTimeOf, auditTitle, timeOf, auditFileName } from './helpers'
import { $, h, tNodes, download, dom, say } from './dom'
import { state } from './state'
import { registerActions } from './actions'
import { askConfirm, askText, askChoice } from './dialogs'
import { reviewKey, needsReview, findingNeedsReview, statusOf, listedFindings } from './review-state'
import { syncFilterBoxes, focusFinding, goTo, clearBoxes, applyBoxes, sendToPage, inspectedTabId, inspectedTitle, inspectedUrl, captureShots } from './page-bridge'
import { pageInput, pageLabel, loadPage, persist, adoptSite, nextPageLabel } from './model'
import { mergeScan, mergeFindings } from './scan-merge'
import { renderFilters, renderList, select, renderDetail } from './images-view'
import { renderThemeView, updateFindingChips } from './findings-view'
import { renderResults } from './results-view'
import { renderAudit } from './audit-overview'
import { runEverything } from './auto-checks'
import { renderChecks } from './checks-view'


/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */


/* ------------------------------------------------------------------ */
/* Persistence (the whole audit, in chrome.storage.local)               */
/* ------------------------------------------------------------------ */

// The save state machine, the retry and the audit lifecycle live in ./audit-session (see `session`, further down).


/* ------------------------------------------------------------------ */
/* Header stats                                                        */
/* ------------------------------------------------------------------ */

/** Kept as the single entry point the rest of the panel calls after any answer. */
function renderStats(): void {
  renderSummaries()
}

/** English labels: translate with t() where they are shown. */
const OUTCOME_PILLS: [Outcome, string, string][] = [
  ['c', 'compliant', 'ok'],
  ['nc', 'non-compliant', 'bad'],
  ['pending', 'to review', 'warn-pill'],
  ['na', 'not applicable', ''],
  ['unassessed', 'not tested', ''],
]

/**
 * The totals of a theme, in the theme's own header: criteria compliant, non-compliant, to review,
 * not applicable, not tested. Each total jumps to the first element it stands for.
 */
function renderSummaries(): void {
  for (const host of document.querySelectorAll<HTMLElement>('.theme-summary')) {
    const pageScope = host.dataset.scope === 'page'
    const n = Number(host.dataset.theme)
    host.replaceChildren()
    if (!state.page) continue
    const all = pageInput(state.page).themes
    // page scope: every criterion of the chosen themes; theme scope: that theme's criteria
    const criteria = pageScope ? all.filter((t) => t.selected).flatMap((t) => t.criteria) : (all.find((x) => x.number === n)?.criteria ?? [])
    if (!pageScope && !all.find((x) => x.number === n)?.selected) continue
    if (!criteria.length) continue
    for (const [outcome, labelEn, cls] of OUTCOME_PILLS) {
      const label = t(labelEn)
      // compliant / not applicable only on the tests this tool can assess does not count here: see the partial pill
      const count = criteria.filter((c) => c.outcome === outcome && !((outcome === 'c' || outcome === 'na') && c.coverage !== 'full')).length
      host.append(
        h(
          'button',
          {
            type: 'button',
            class: `pill ${cls} sum-${outcome}`,
            disabled: count === 0,
            title: count ? t('Go to the first one ({label})', { label }) : t('Nothing {label}', { label }),
            onclick: () => (pageScope ? goToFirstOnPage(outcome) : goToFirst(n, outcome)),
          },
          h('strong', {}, String(count)),
          ` ${label}`,
        ),
      )
    }
    const toConfirm = criteria.filter((c) => c.outcome === 'pending' && c.suggested).length
    const partial = criteria.filter((c) => c.coverage === 'partial').length
    const unconfirmedNc = criteria.filter((c) => c.unconfirmed && c.outcome === 'nc').length
    if (toConfirm) host.append(h('span', { class: 'pill warn-pill', title: t('A tool suggests an answer for these criteria. Confirm or change each one: until then they count as to review.') }, t('{n} to confirm', { n: toConfirm })))
    if (unconfirmedNc) host.append(h('span', { class: 'pill warn-pill', title: t('Failures found by a tool and not yet confirmed. They are counted as non-compliant, so the rate is provisional.') }, t('{n} failure(s) to confirm', { n: unconfirmedNc })))
    if (partial) host.append(h('span', { class: 'pill warn-pill', title: t('Some tests of these criteria are not supported by this tool. The result counts, but only for the tests this tool can assess, so the rate stays provisional; a failure is always kept.') }, t('{n} partly covered', { n: partial })))
    if (!pageScope && n === 1 && state.elements.length) {
      const prefilled = state.elements.filter((e) => state.reviews[reviewKey(e)]?.auto).length
      host.append(
        h('span', { class: 'pill plain' }, t('{n} image(s)', { n: state.elements.length })),
        ...(state.elements.some((e) => !e.present) ? [h('span', { class: 'pill plain' }, t('{n} on page now', { n: state.elements.filter((e) => e.present).length }))] : []),
        ...(prefilled
          ? [h('button', { type: 'button', class: 'pill plain', title: t('Show the images whose answer was pre-filled'), onclick: () => { state.filter = 'prefilled'; renderFilters(); renderList(); void syncFilterBoxes() } }, t('{n} pre-filled, to confirm', { n: prefilled }))]
          : []),
      )
    }
  }
}

/** The first chosen theme (in order) that has something to jump to for this status. */
function firstThemeWith(outcome: Outcome): number | null {
  if (!state.page) return null
  const rec = state.page
  for (const t of pageInput(rec).themes.filter((x) => x.selected)) {
    if (!t.criteria.some((c) => c.outcome === outcome)) continue
    if (outcome === 'pending') {
      // a theme that was never scanned has criteria "to review" but no element to go to
      const perFinding = findingCriterionIds(t.number)
      const pendingCards = t.criteria.some((c) => c.outcome === 'pending' && !perFinding.includes(c.id) && t.number !== 1)
      const hasElement =
        t.number === 1 ? state.elements.some((e) => needsReview(e)) : FINDING_THEMES.has(t.number) ? rec.findings.some((f) => f.theme === t.number && findingNeedsReview(f)) : false
      if (!hasElement && !pendingCards) continue
    }
    return t.number
  }
  return null
}

/** Page-level totals (all chosen themes): open the first theme that has such an item, then go to its first element. */
function goToFirstOnPage(outcome: Outcome): void {
  const n = firstThemeWith(outcome)
  if (n === null) {
    return void say(outcome === 'pending' ? t('Nothing to review yet: scan the page, or every element has been reviewed.') : t('Nothing to show for this total.'))
  }
  state.theme = n
  state.findingFilter = 'all'
  setView('review')
  renderThemeBar()
  goToFirst(n, outcome)
}

/** Where a total leads: the first image / finding / criterion behind it, or its row in the grid. */
function goToFirst(n: number, outcome: Outcome): void {
  if (!state.page) return
  const rec = state.page
  const result = pageInput(rec).themes.find((x) => x.number === n)
  const first = result?.criteria.find((c) => c.outcome === outcome)
  const verdictOf = (o: Outcome) => (o === 'c' ? 'c' : o === 'nc' ? 'nc' : o === 'na' ? 'na' : null)

  if (n === 1) {
    const pick =
      outcome === 'pending' ? state.elements.find((e) => needsReview(e)) : outcome === 'c' || outcome === 'nc' ? state.elements.find((e) => statusOf(e) === outcome) : undefined
    if (pick) {
      state.filter = outcome === 'pending' ? 'review' : 'all'
      renderFilters()
      renderList()
      select(pick.id, true)
      void syncFilterBoxes()
      return
    }
    if (outcome === 'pending') return void say(t('Nothing left to review among the images.'))
    if (first) return openGridAt(first.id)
    return
  }

  if (FINDING_THEMES.has(n)) {
    const list = rec.findings.filter((f) => f.theme === n)
    const v = verdictOf(outcome)
    const pick =
      outcome === 'pending'
        ? list.find((f) => findingNeedsReview(f))
        : v
          ? list.find((f) => Object.values(rec.findingReviews[f.key]?.answers ?? {}).includes(v))
          : undefined
    if (pick) {
      state.findingFilter = outcome === 'pending' ? 'review' : 'all'
      state.findingSel = pick.id
      renderThemeView()
      void focusFinding(pick, true)
      void syncFilterBoxes()
      return
    }
  }

  // checklist criteria (every theme but Images, plus 3.1 / 3.3): scroll to the card
  if (first) {
    const card = dom.themeEl.querySelector<HTMLElement>(`[id="crit-card-${first.id}"]`)
    if (card) {
      card.scrollIntoView({ block: 'center', behavior: 'smooth' })
      card.classList.add('flash')
      setTimeout(() => card.classList.remove('flash'), 1800)
      return
    }
    openGridAt(first.id)
  }
}

/** Opens the page grid on a criterion's row (for totals that have no element to point at). */
function openGridAt(criterionId: string): void {
  state.activeSheet = 0
  setView('page')
  const row = dom.resultsEl.querySelector<HTMLElement>(`tr[data-crit="${criterionId}"]`)
  row?.scrollIntoView({ block: 'center' })
  row?.classList.add('flash')
  setTimeout(() => row?.classList.remove('flash'), 1800)
}

/* ------------------------------------------------------------------ */
/* List                                                                */
/* ------------------------------------------------------------------ */


/* ------------------------------------------------------------------ */
/* Code rendering                                                      */
/* ------------------------------------------------------------------ */


/* ------------------------------------------------------------------ */
/* Detail                                                              */
/* ------------------------------------------------------------------ */


/* ------------------------------------------------------------------ */
/* Selection & refresh                                                 */
/* ------------------------------------------------------------------ */


/* ------------------------------------------------------------------ */
/* Pages of the sample (P01, P02…)                                      */
/* ------------------------------------------------------------------ */


function renderPageBar(): void {
  dom.pageSelect.replaceChildren()
  if (!state.audit.pages.length) dom.pageSelect.append(h('option', { value: '' }, t('No page yet — add page 1 in “Audit pages sample”')))
  for (const p of state.audit.pages) {
    const input = pageInput(p)
    const rate = rateOf(auditStats([input]).perPage[0].counts)
    dom.pageSelect.append(
      h('option', { value: p.id, selected: p.id === state.page?.id }, `${pageLabel(p)} · ${p.title || p.url} · ${t('{n} image(s)', { n: p.items.length })}${rate === null ? '' : ` · ${rate} %${isProvisional(countsOf(input)) ? ` (${t('provisional')})` : ''}`}`),
    )
  }
  dom.pageSelect.disabled = !state.audit.pages.length
  dom.pageToolsEl.hidden = !state.page
  dom.nextBtn.disabled = !state.page
  dom.progressEl.replaceChildren()
  if (state.page) {
    const c = countsOf(pageInput(state.page))
    const total = c.C + c.NC + c.NA + c.NT || 1
    const answered = c.C + c.NC + c.NA
    dom.progressEl.append(
      h('span', {}, t('{done}/{total} criteria answered', { done: answered, total })),
      h('span', { class: 'meter', role: 'img', 'aria-label': t('Progress of {label}', { label: pageLabel(state.page) }) }, ...[['c', c.C], ['nc', c.NC], ['na', c.NA]].map(([k, n]) => h('i', { class: String(k), style: `width:${(Number(n) / total) * 100}%` }))),
    )
  }
  dom.deletePageBtn.disabled = !state.page
  dom.resetPageBtn.disabled = !state.page
  const onLive = Boolean(state.page && state.liveUrl && normalizeUrl(state.page.url) === normalizeUrl(state.liveUrl))
  dom.liveUrlEl.textContent = state.liveUrl ? t('Browser: {url}', { url: state.liveUrl }) : ''
  dom.liveUrlEl.title = state.liveUrl
  dom.liveUrlEl.className = `live-url${onLive ? ' same' : ''}`
  dom.scanBtn.disabled = !state.page
  dom.scanBtn.textContent = state.page ? (state.scannedThisSession.has(state.page.id) ? t('Rescan {page}', { page: pageLabel(state.page) }) : t('Scan {page}', { page: pageLabel(state.page) })) : t('Scan')
  dom.scanBtn.title = state.page
    ? t('Scan what the browser shows and merge the images into {page} (popins, tabs…)', { page: pageLabel(state.page) })
    : t('Add a page to the sample first')
}


function renderAll(): void {
  renderPageBar()
  renderThemeBar()
  renderFilters()
  renderList()
  renderStats()
  renderDetail()
  setScanned()
  if (state.view === 'page') renderResults()
  if (state.view === 'audit') renderAudit()
  if (state.view === 'sample') renderSample()
}

/** Selects a page of the sample; with `navigate`, the browser tab goes to its URL too. */
function switchTo(id: string, navigate = false): void {
  const rec = state.audit.pages.find((p) => p.id === id)
  if (!rec) return
  if (rec !== state.page) loadPage(rec)
  // you chose this page yourself: the “the browser is on another page” reminder no longer applies
  dom.navBanner.hidden = true
  state.navDismissed = state.liveUrl && rec.url ? normalizeUrl(state.liveUrl) : ''
  setView(['sample', 'audit', 'audits', 'checks'].includes(state.view) ? 'review' : state.view)
  renderAll()
  persist()
  const label = pageLabel(rec)
  if (navigate && !rec.url) {
    showNavBanner(state.liveUrl)
    say(t('{label} has no address yet: open its page in the browser and click “Scan {label}”.', { label }))
  } else if (navigate && (!state.liveUrl || normalizeUrl(rec.url) !== normalizeUrl(state.liveUrl))) {
    goTo(rec.url)
    say(t('Opening {label} in the browser. Click “Scan {label}” once it has loaded.', { label }))
  } else {
    say(rec.items.length ? t('Viewing {label}.', { label }) : t('{label} is registered but not scanned yet. Open it in the browser and click “Scan {label}”.', { label }))
  }
}


async function removePage(rec: PageRecord | null = state.page): Promise<void> {
  if (!rec) return
  const label = pageLabel(rec)
  if (!(await askConfirm(t('Remove {label}?', { label }), `${rec.title || rec.url}\n\n${t('The page and all its answers are deleted from the audit and the other pages are renumbered.')}`, t('Remove page')))) return
  state.audit.pages = state.audit.pages.filter((p) => p !== rec)
  state.scannedThisSession.delete(rec.id)
  if (state.page === rec) loadPage(state.audit.pages[0] ?? null)
  renderAll()
  persist()
  say(t('{label} removed from the audit.', { label }))
}

dom.pageSelect.addEventListener('change', () => switchTo(dom.pageSelect.value, true))
dom.deletePageBtn.addEventListener('click', () => removePage())


function showNavBanner(url: string): void {
  dom.navBannerBtn.hidden = false
  // the current page has lost its address
  if (state.page && !state.page.url && url) {
    const rec = state.page
    const owner = findPage(state.audit, url)
    if (owner && owner !== rec) {
      // the browser is on another page of the sample: say how to register this one, without offering a duplicate address
      dom.navBannerText.textContent = t('{label} has no address. The browser is on {other}: open the page of {label} in the browser, then select {label} again.', { label: pageLabel(rec), other: pageLabel(owner) })
      dom.navBannerBtn.hidden = true
      dom.navBanner.hidden = false
      return
    }
    dom.navBannerText.textContent = t('{label} has no address. The browser is on {url}.', { label: pageLabel(rec), url })
    dom.navBannerBtn.textContent = t('Use this address for {label}', { label: pageLabel(rec) })
    dom.navBannerBtn.onclick = () => {
      rec.url = normalizeUrl(url)
      adoptSite(rec.url)
      dom.navBanner.hidden = true
      persist()
      renderAll()
      say(t('{label} now points to {url}.', { label: pageLabel(rec), url: rec.url }))
    }
    dom.navBanner.hidden = false
    return
  }
  if (state.navDismissed && normalizeUrl(url) === state.navDismissed) return void (dom.navBanner.hidden = true)
  const known = findPage(state.audit, url)
  if (known && known === state.page) return void (dom.navBanner.hidden = true)
  if (known) {
    dom.navBannerText.textContent = t('The browser is now on {label} ({title}).', { label: pageLabel(known), title: known.title || known.url })
    dom.navBannerBtn.textContent = t('Switch to {label}', { label: pageLabel(known) })
    dom.navBannerBtn.onclick = () => {
      dom.navBanner.hidden = true
      switchTo(known.id)
    }
  } else {
    dom.navBannerText.textContent = t('This URL is not in the sample yet.')
    dom.navBannerBtn.textContent = t('Add it as {label}', { label: nextPageLabel() })
    dom.navBannerBtn.onclick = () => {
      dom.navBanner.hidden = true
      void addPage(url)
    }
  }
  dom.navBanner.hidden = false
}

/* ------------------------------------------------------------------ */
/* Resets: one theme of a page, one page, the whole audit               */
/* ------------------------------------------------------------------ */


function resetThemeData(rec: PageRecord, n: number): void {
  if (n === 1) {
    rec.items.splice(0)
    for (const k of Object.keys(rec.reviews)) delete rec.reviews[k]
  }
  if (FINDING_THEMES.has(n)) {
    for (const f of rec.findings.filter((x) => x.theme === n)) delete rec.findingReviews[f.key]
    rec.findings = rec.findings.filter((x) => x.theme !== n)
  }
  for (const c of themeByNumber(n)?.criteria ?? []) delete rec.checklist[c.id]
  rec.scannedThemes = rec.scannedThemes.filter((t) => t !== n)
  state.scannedThisSession.delete(rec.id)
}

async function resetTheme(n = state.theme): Promise<void> {
  if (!state.page) return
  const rec = state.page
  const name = t(THEME_LABEL[n])
  if (!(await askConfirm(t('Reset {name} on {label}?', { name, label: pageLabel(rec) }), t('This removes what was scanned and every answer for this theme only. The other themes and the page itself are kept.'), t('Reset {name}', { name })))) return
  resetThemeData(rec, n)
  state.findingSel = null
  loadPage(rec)
  void clearBoxes(n)
  renderAll()
  persist()
  say(t('{name} reset on {label}.', { name, label: pageLabel(rec) }))
}

async function resetPage(rec: PageRecord | null = state.page): Promise<void> {
  if (!rec) return
  const label = pageLabel(rec)
  if (!(await askConfirm(t('Reset {label}?', { label }), `${rec.title || rec.url}\n\n${t('This clears its scans and every answer, in all themes. Its URL, title and chosen themes are kept.')}`, t('Reset page')))) return
  for (const n of THEMES.map((t) => t.number)) resetThemeData(rec, n)
  rec.scanCount = 0
  rec.nextId = 1
  rec.nextFindingId = 1
  rec.nextFindingIds = {}
  rec.updatedAt = Date.now()
  state.findingSel = null
  if (rec === state.page) {
    loadPage(rec)
    void clearBoxes()
  }
  renderAll()
  persist()
  say(t('{label} reset. Scan it again when you are ready.', { label }))
}

async function resetAudit(): Promise<void> {
  if (!(await askConfirm(t('Reset the whole audit?'), t('This deletes all {n} page(s), their scans and answers, and the site, auditor and context fields. It cannot be undone.', { n: state.audit.pages.length }), t('Delete everything')))) return
  const fresh = emptyAudit(state.audit.name)
  state.audit = { ...fresh, id: state.audit.id, createdAt: state.audit.createdAt }
  state.scannedThisSession.clear()
  state.findingSel = null
  state.theme = 1
  loadPage(null)
  void clearBoxes()
  setView('review')
  renderAll()
  persist()
  say(t('The audit was reset. Add the first page of your sample to start again.'))
}

dom.resetPageBtn.addEventListener('click', () => resetPage())

/* ------------------------------------------------------------------ */
/* Views: review | page results | audit overview                        */
/* ------------------------------------------------------------------ */


function setView(next: View): void {
  state.view = next
  dom.resultsEl.hidden = next !== 'page'
  dom.auditEl.hidden = next !== 'audit'
  dom.sampleEl.hidden = next !== 'sample'
  dom.auditsEl.hidden = next !== 'audits'
  dom.checksEl.hidden = next !== 'checks'
  dom.checksBtn.setAttribute('aria-pressed', String(next === 'checks'))
  const imagesTheme = state.theme === 1
  dom.appEl.hidden = next !== 'review' || !imagesTheme || !state.elements.length
  dom.emptyEl.hidden = next !== 'review' || !imagesTheme || state.elements.length > 0
  dom.themeEl.hidden = next !== 'review' || imagesTheme
  dom.themebarEl.hidden = !state.page
  updateTools()
  dom.resultsBtn.setAttribute('aria-pressed', String(next === 'page'))
  dom.auditBtn.setAttribute('aria-pressed', String(next === 'audit'))
  dom.sampleBtn.setAttribute('aria-pressed', String(next === 'sample'))
  if (next === 'review') {
    renderSummaries()
    renderEmpty()
    if (!imagesTheme) renderThemeView()
  }
  if (next === 'page') renderResults()
  if (next === 'audit') renderAudit()
  if (next === 'sample') renderSample()
  if (next === 'audits') void renderAuditsView()
  if (next === 'checks') renderChecks()
  renderAuditBar()
}


function setScanned(): void {
  const has = state.elements.length > 0
  dom.clearBtn.disabled = !has && !(state.page?.findings.length)
  dom.boxesBtn.disabled = !has && !(state.page?.findings.length)
  dom.resultsBtn.disabled = !has
  dom.auditBtn.disabled = !state.audit.pages.length
  dom.checksBtn.disabled = !state.page
  dom.autoBtn.disabled = !state.page || state.axeRunning
  dom.scanBtn.disabled = !state.page
  setView(state.view === 'page' && !has ? 'review' : state.view)
}

/* ------------------------------------------------------------------ */
/* Themes: which RGAA themes are audited on a page                      */
/* ------------------------------------------------------------------ */

/** Share of a theme's criteria that have an answer (criteria this tool cannot assess count as done). */
function themeProgress(rec: PageRecord, n: number): { done: number; total: number } {
  const t = pageInput(rec).themes.find((x) => x.number === n)
  const total = t?.criteria.length ?? 0
  const pending = t?.criteria.filter((c) => c.outcome === 'pending').length ?? 0
  return { done: total - pending, total }
}

function setThemes(rec: PageRecord, themes: number[]): void {
  rec.themes = [...new Set(themes)].sort((a, b) => a - b)
  if (rec === state.page && !rec.themes.includes(state.theme)) state.theme = rec.themes[0] ?? 1
  persist()
  // keep the menu open while ticking several themes
  if (state.view === 'sample') {
    renderPageBar()
    renderThemeBar()
    return
  }
  const open = document.querySelector<HTMLDetailsElement>('.themebar .themes-menu')?.open
  renderAll()
  if (open) document.querySelector<HTMLDetailsElement>('.themebar .themes-menu')?.setAttribute('open', '')
}

/** A drop-down with one checkbox per RGAA theme. */
function themesMenu(rec: PageRecord): HTMLElement {
  const box = h('details', { class: 'themes-menu' }, h('summary', {}, t('Themes ({n})', { n: rec.themes.length })))
  const list = h('div', { class: 'menu', role: 'group', 'aria-label': t('Themes audited on {label}', { label: pageLabel(rec) }) })
  for (const th of THEMES) {
    list.append(
      h(
        'label',
        { class: 'menu-item' },
        h('input', {
          type: 'checkbox',
          checked: rec.themes.includes(th.number),
          onchange: (e: Event) => {
            const on = (e.target as HTMLInputElement).checked
            if (!on && rec.themes.length === 1) {
              ;(e.target as HTMLInputElement).checked = true
              return void say(t('Keep at least one theme.'))
            }
            setThemes(rec, on ? [...rec.themes, th.number] : rec.themes.filter((n) => n !== th.number))
          },
        }),
        h('span', {}, `${th.number}. ${t(THEME_LABEL[th.number])}`),
        h('span', { class: 'menu-kind' }, SCANNED_THEMES.has(th.number) ? t('scan + review') : t('{n} criteria', { n: th.criteria.length })),
      ),
    )
  }
  list.append(
    h(
      'div',
      { class: 'menu-actions' },
      h('button', { type: 'button', class: 'img-ref', onclick: () => setThemes(rec, THEMES.map((th) => th.number)) }, t('All 13')),
      h('button', { type: 'button', class: 'img-ref', onclick: () => setThemes(rec, [1]) }, t('Images only')),
    ),
  )
  box.append(list)
  return box
}

function renderThemeBar(): void {
  document.documentElement.style.setProperty('--tc', colorOf(state.theme))
  dom.themebarEl.replaceChildren()
  if (!state.page) return
  const rec = state.page
  const selected = [...rec.themes].sort((a, b) => a - b)
  if (!selected.includes(state.theme)) state.theme = selected[0] ?? 1
  const tabs = h('div', { class: 'theme-tabs', role: 'tablist', 'aria-label': t('RGAA themes of this page') })
  for (const n of selected) {
    const { done, total } = themeProgress(rec, n)
    tabs.append(
      h(
        'button',
        {
          type: 'button',
          role: 'tab',
          class: `theme-tab${done === total ? ' complete' : ''}`,
          'aria-selected': String(n === state.theme),
          style: `--tc:${colorOf(n)}`,
          title: t('{n}. {name} (its boxes on the page use this colour)', { n, name: t(THEME_LABEL[n]) }),
          onclick: () => {
            state.theme = n
            state.findingFilter = 'all'
            setView('review')
            renderThemeBar()
            renderStats()
          },
        },
        h('span', { class: 'tn' }, String(n)),
        ` ${t(THEME_LABEL[n])} `,
        h('span', { class: 'tp' }, `${done}/${total}`),
      ),
    )
  }
  dom.themebarEl.append(
    tabs,
    h('button', { type: 'button', class: 'ghost-btn danger', title: t('Clear the scan and the answers of {name} on this page only', { name: t(THEME_LABEL[state.theme]) }), onclick: () => resetTheme() }, t('Reset {name}', { name: t(THEME_LABEL[state.theme]) })),
    themesMenu(rec),
  )
}


/* ------------------------------------------------------------------ */
/* Frames (2) and colours (3): scanned, reviewed finding by finding      */
/* ------------------------------------------------------------------ */


/** Buttons that act on the boxes of the current theme live in that theme's own toolbar. */
function updateTools(): void {
  setPageToolsTheme(state.theme)
  void applyBoxes()
  const reviewing = Boolean(state.page) && state.view === 'review'
  dom.imagesHeadEl.hidden = !(reviewing && state.theme === 1)
  // the toolbar belongs to the theme being shown: Images has its header, the other themes put it in theirs
  if (state.theme === 1) dom.imagesHeadEl.append(dom.toolsEl)
  dom.toolsEl.hidden = !(reviewing && SCANNED_THEMES.has(state.theme))
}


function renderEmpty(): void {
  const onPage = Boolean(state.page && state.liveUrl && normalizeUrl(state.page.url) === normalizeUrl(state.liveUrl))
  dom.emptyAddBtn.hidden = Boolean(state.page)
  dom.emptyGoBtn.hidden = !state.page || onPage
  if (!state.page) {
    dom.emptyTitle.textContent = t('Start by registering the pages of your sample')
    dom.emptyText.textContent = t('Open the first page in the browser and add it as page 1. You scan it afterwards, when you are ready.')
    dom.emptyAddBtn.textContent = t('Add the current URL as {label}', { label: nextPageLabel() })
  } else {
    const label = pageLabel(state.page)
    dom.emptyTitle.textContent = t('{label} is registered, not scanned yet', { label })
    dom.emptyText.textContent = onPage
      ? t('The browser is on {url}. Click “Scan {label}” to list its images.', { url: state.page.url, label })
      : t('Open {url} in the browser, then click “Scan {label}”.', { url: state.page.url, label })
    dom.emptyGoBtn.textContent = t('Open {label} in the browser', { label })
  }
  const strong = (text: string) => h('strong', {}, text)
  $('empty-steps').replaceChildren(
    h('li', {}, ...tNodes('Register each page in {sample} (P01, P02…), with its URL.', { sample: strong(t('Audit pages sample')) })),
    h('li', {}, ...tNodes('Select a page in the {page} list: the browser opens it. Click {scan}.', { page: strong(t('Page')), scan: strong(t('Scan')) })),
    h('li', {}, ...tNodes('Open a popin or a tab and click {rescan}: its images join the same page.', { rescan: strong(t('Rescan')) })),
  )
}

dom.emptyAddBtn.addEventListener('click', () => void addPage(state.liveUrl))
dom.emptyGoBtn.addEventListener('click', () => state.page && goTo(state.page.url))
dom.sampleBtn.addEventListener('click', () => setView(state.view === 'sample' ? 'review' : 'sample'))

/** Registers a page of the sample without scanning it. */
async function addPage(url: string, title?: string): Promise<void> {
  const target = url || state.liveUrl
  if (!target) return void say(t('No URL to add: open a page in the browser first.'))
  const known = findPage(state.audit, target)
  if (known) {
    say(t('{label} already uses this URL.', { label: pageLabel(known) }))
    return void switchTo(known.id)
  }
  const rec = createPage(state.audit, target, title ?? ((await inspectedTitle()) || target))
  adoptSite(rec.url)
  loadPage(rec)
  persist()
  setView(state.view === 'sample' ? 'sample' : 'review')
  renderAll()
  say(t('{label} registered. It is not scanned yet: open it in the browser and click “Scan {label}”.', { label: pageLabel(rec) }))
}

function movePage(rec: PageRecord, dir: -1 | 1): void {
  const i = state.audit.pages.indexOf(rec)
  const j = i + dir
  if (j < 0 || j >= state.audit.pages.length) return
  ;[state.audit.pages[i], state.audit.pages[j]] = [state.audit.pages[j], state.audit.pages[i]]
  persist()
  renderAll()
}

/** The sample: which URL is page 1, page 2… Editable, and where pages are registered before scanning. */
function renderSample(): void {
  dom.sampleEl.replaceChildren()
  const field = (label: string, key: keyof Audit['meta'], placeholder: string) =>
    h(
      'label',
      { class: 'field' },
      h('span', {}, label),
      h('input', { type: 'text', value: state.audit.meta[key], placeholder, oninput: (e: Event) => { state.audit.meta[key] = (e.target as HTMLInputElement).value; persist() } }),
    )
  dom.sampleEl.append(
    h(
      'div',
      { class: 'results-head' },
      h('div', {}, h('h2', {}, t('Audit pages sample')), h('p', { class: 'hint-line' }, t('Register each page and its URL here, then scan them one by one. P01, P02… follow this order.'))),
      h('div', { class: 'nav' }, h('button', { type: 'button', onclick: () => setView('review') }, t('← Back to review')), h('button', { type: 'button', onclick: () => setView('audit') }, t('Audit pages overview')), h('button', { type: 'button', class: 'danger-btn', disabled: !state.audit.pages.length && !state.audit.meta.site && !state.audit.meta.auditor, title: t('Delete every page and the audit fields'), onclick: () => resetAudit() }, t('Reset the whole audit'))),
    ),
    h('div', { class: 'sample-meta' }, field(t('Site'), 'site', t('Name of the site')), field(t('Auditor'), 'auditor', t('First name Last name')), field(t('Context'), 'context', t('Initial visit'))),
  )

  const table = h('table', { class: 'results-table sample-table' })
  table.append(
    h('caption', { class: 'sr-only' }, t('Pages of the sample')),
    h('thead', {}, h('tr', {}, ...['Page', 'Title', 'URL', 'Themes', 'Images', 'Scans', 'Actions'].map((name) => h('th', { scope: 'col' }, t(name))))),
  )
  const body = h('tbody', {})
  state.audit.pages.forEach((rec, i) => {
    const label = pageLabel(rec)
    const urlInput = h('input', {
      type: 'url',
      value: rec.url,
      'aria-label': t('URL of {label}', { label }),
      onchange: (e: Event) => {
        const value = (e.target as HTMLInputElement).value.trim()
        const clash = findPage(state.audit, value)
        if (clash && clash !== rec) {
          say(t('{label} already uses this URL.', { label: pageLabel(clash) }))
          ;(e.target as HTMLInputElement).value = rec.url
          return
        }
        rec.url = normalizeUrl(value)
        persist()
        renderPageBar()
      },
    })
    body.append(
      h(
        'tr',
        { class: rec === state.page ? 'current' : '' },
        h('th', { scope: 'row' }, label),
        h('td', {}, h('input', { type: 'text', value: rec.title, 'aria-label': t('Title of {label}', { label }), oninput: (e: Event) => { rec.title = (e.target as HTMLInputElement).value; persist() }, onchange: () => renderPageBar() })),
        h('td', {}, urlInput),
        h('td', {}, themesMenu(rec)),
        h('td', {}, String(rec.items.length)),
        h('td', {}, String(rec.scanCount)),
        h(
          'td',
          { class: 'row-actions' },
          h('button', { type: 'button', class: 'img-ref', onclick: () => switchTo(rec.id, true) }, t('Open page')),
          h('button', { type: 'button', class: 'img-ref', title: t('Use the URL the browser is on now'), onclick: () => { if (!state.liveUrl) return; rec.url = normalizeUrl(state.liveUrl); persist(); renderSample(); renderPageBar() } }, t('Use current URL')),
          h('button', { type: 'button', class: 'img-ref', 'aria-label': t('Move {label} up', { label }), disabled: i === 0, onclick: () => movePage(rec, -1) }, '↑'),
          h('button', { type: 'button', class: 'img-ref', 'aria-label': t('Move {label} down', { label }), disabled: i === state.audit.pages.length - 1, onclick: () => movePage(rec, 1) }, '↓'),
          h('button', { type: 'button', class: 'img-ref', title: t('Clear its scans and answers, keep the page'), onclick: () => resetPage(rec) }, t('Reset')),
          h('button', { type: 'button', class: 'img-ref nc', onclick: () => removePage(rec) }, t('Remove')),
        ),
      ),
    )
  })
  table.append(body)
  dom.sampleEl.append(h('div', { class: 'results-scroll' }, table))

  const urlNew = h('input', { type: 'url', value: state.liveUrl, placeholder: 'https://…', 'aria-label': t('URL of the new page') })
  const titleNew = h('input', { type: 'text', placeholder: t('Title (optional)'), 'aria-label': t('Title of the new page') })
  dom.sampleEl.append(
    h(
      'div',
      { class: 'card add-page' },
      h('h3', {}, t('Add page {label}', { label: nextPageLabel() })),
      h('div', { class: 'add-row' }, urlNew, titleNew,
        h('button', { type: 'button', class: 'img-ref', onclick: () => { urlNew.value = state.liveUrl } }, t('Use current URL')),
        h('button', { type: 'button', class: 'primary', onclick: () => void addPage(urlNew.value.trim(), titleNew.value.trim() || undefined) }, t('Add to the sample'))),
      h('p', { class: 'hint-line' }, t('Adding a page does not scan it. Select it, open it in the browser, then click Scan.')),
    ),
  )
}

/* ------------------------------------------------------------------ */
/* Sheets in the browser (same content as the .xlsx)                    */
/* ------------------------------------------------------------------ */


/* ------------------------------------------------------------------ */
/* Page results                                                         */
/* ------------------------------------------------------------------ */


/* ------------------------------------------------------------------ */
/* Audit overview: all pages                                            */
/* ------------------------------------------------------------------ */


/* ------------------------------------------------------------------ */
/* Report                                                              */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Scanning                                                            */
/* ------------------------------------------------------------------ */


async function scan(): Promise<void> {
  state.lastScanOk = false
  if (!state.page) return void say(t('Add a page to the audit pages sample first (button “Audit pages sample”).'))
  const scannable = state.page.themes.filter((n) => SCANNED_THEMES.has(n))
  if (!scannable.length) return void say(t('None of the selected themes can be scanned: they are checklists. Select Images, Frames or Colours to scan.'))
  say(t('Scanning…'))
  try {
    const [url, title] = await Promise.all([inspectedUrl(), inspectedTitle()])
    state.liveUrl = url
    const rec = state.page
    const label = pageLabel(rec)
    if (url && !rec.url) {
      rec.url = normalizeUrl(url)
      adoptSite(rec.url)
    }
    else if (url && normalizeUrl(url) !== normalizeUrl(rec.url)) {
      const other = findPage(state.audit, url)
      const question = other
        ? `${t('The browser is on {other} ({url}), not on {label}.', { other: pageLabel(other), url, label })}\n\n${t('OK: scan into {other} instead.', { other: pageLabel(other) })}\n${t('Cancel: stop.')}`
        : `${t('The browser is on {url}, but {label} is registered for {registered}.', { url, label, registered: rec.url })}\n\n${t('OK: scan into {label} and update its URL.', { label })}\n${t('Cancel: stop.')}`
      if (!(await askConfirm(t('The browser is on another page'), question, t('Scan into {label}', { label: other ? pageLabel(other) : label })))) return void say(t('Scan cancelled.'))
      if (other) {
        switchTo(other.id)
        return void (await scan())
      }
      rec.url = normalizeUrl(url)
    }
    if (!rec.title && title) rec.title = title

    const parts: string[] = []
    const first = state.scanCount === 0
    const selectedKey = state.elements.find((e) => e.id === state.selectedId)?.key
    if (rec.themes.includes(1)) {
      const response = await sendToPage(inspectedTabId(), { type: 'RGAA_HIGHLIGHT_IMAGES', color: colorOf(1) })
      rec.scanCoverage = mergeCoverage(rec.scanCoverage, response?.coverage)
      const { added, map } = mergeScan(response?.elements ?? [])
      await sendToPage(inspectedTabId(), { type: 'RGAA_RELABEL', map })
      if (!rec.scannedThemes.includes(1)) rec.scannedThemes.push(1)
      state.selectedId = state.elements.find((e) => e.key === selectedKey)?.id ?? state.elements[0]?.id ?? null
      const gone = state.elements.filter((e) => !e.present).length
      parts.push([t('{n} image(s)', { n: state.elements.length }), ...(first ? [] : [t('{n} new', { n: added })]), ...(gone ? [t('{n} gone', { n: gone })] : [])].join(', '))
    } else {
      state.scanCount++
    }
    for (const tn of rec.themes.filter((n) => FINDING_THEMES.has(n))) {
      const response = await sendToPage(inspectedTabId(), { type: 'RGAA_SCAN_THEME', theme: tn, color: colorOf(tn) })
      rec.scanCoverage = mergeCoverage(rec.scanCoverage, response?.coverage)
      const { map, added } = mergeFindings(tn, response?.findings ?? [])
      await sendToPage(inspectedTabId(), { type: 'RGAA_RELABEL', map, theme: tn })
      const n = rec.findings.filter((f) => f.theme === tn).length
      parts.push(tn === 2 ? t('{n} frame(s)', { n }) : tn === 6 ? t('{n} link(s)', { n }) : tn === 9 ? t('{n} heading(s) and landmark(s)', { n }) : tn === 5 ? t('{n} table(s)', { n }) : tn === 11 ? t('{n} field(s)', { n }) : `${t('{n} contrast finding(s)', { n: listedFindings(tn).length })}${added ? ` (${t('{n} new', { n: added })})` : ''}`)
    }
    const missing = rec.findings.filter((f) => f.present && !f.shot && f.type !== 'contrast-ok' && rec.themes.includes(f.theme)).slice(0, 50)
    const shots = await captureShots(missing)
    if (shots) parts.push(t('{n} preview(s)', { n: shots }))
    state.filter = 'all'
    state.findingFilter = 'all'
    await applyBoxes()
    state.scannedThisSession.add(rec.id)
    dom.newBanner.hidden = true
    dom.navBanner.hidden = true
    setView('review')
    renderAll()
    persist()
    state.lastScanOk = true
    say(
      first
        ? t('{label} scanned: {parts}. Open a popin or a tab, then click “Rescan {label}” to add what appears.', { label, parts: parts.join(' · ') })
        : t('Rescan {n} of {label}: {parts}.', { n: state.scanCount, label, parts: parts.join(' · ') }),
    )
  } catch (err) {
    say(t('Could not reach the page. Reload the tab, check site access in about:addons, and try again.'))
    console.error(err)
  }
}

dom.scanBtn.addEventListener('click', scan)
dom.rescanBtn.addEventListener('click', scan)

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== 'RGAA_NEW_IMAGES' || !state.scanCount) return
  dom.newBannerText.textContent = t('{n} new image(s) appeared on the page (popin, tab, lazy content…).', { n: message.count })
  dom.newBanner.hidden = false
})

chrome.devtools.network.onNavigated.addListener((url: string) => {
  state.liveUrl = url
  // The boxes are gone with the old document: what was seen is shown as last seen until the next scan.
  state.scannedThisSession.clear()
  resetPageTools()
  for (const p of state.audit.pages) for (const el of p.items) el.present = true
  dom.newBanner.hidden = true
  renderPageBar()
  renderList()
  renderStats()
  if (state.view === 'review') renderEmpty()
  if (normalizeUrl(url) !== state.navDismissed) state.navDismissed = ''
  showNavBanner(url)
})

dom.clearBtn.addEventListener('click', async () => {
  try {
    await sendToPage(inspectedTabId(), { type: 'RGAA_CLEAR_HIGHLIGHTS' })
    for (const el of state.elements) el.present = false
    for (const f of state.page?.findings ?? []) f.present = false
    renderList()
    renderStats()
    say(t('Boxes removed from the page. The images and your answers stay in the audit; “Rescan” draws them again.'))
  } catch (err) {
    say(t('Could not reach the page.'))
    console.error(err)
  }
})

dom.altBtn.addEventListener('click', () => {
  state.showAltOn = !state.showAltOn
  try { localStorage.setItem('rgaa-show-alt', state.showAltOn ? 'on' : 'off') } catch { /* optional */ }
  void applyBoxes()
})

dom.tintBtn.addEventListener('click', () => {
  state.focusTintOn = !state.focusTintOn
  try { localStorage.setItem('rgaa-focus-tint', state.focusTintOn ? 'on' : 'off') } catch { /* optional */ }
  void applyBoxes()
})

dom.boxesBtn.addEventListener('click', () => {
  state.boxesOn[state.theme] = state.boxesOn[state.theme] === false
  void applyBoxes()
})
dom.resultsBtn.addEventListener('click', () => setView(state.view === 'page' ? 'review' : 'page'))
dom.auditBtn.addEventListener('click', () => setView(state.view === 'audit' ? 'review' : 'audit'))

/* Keyboard: j / k move between images (outside text fields). */
dom.nextBtn.addEventListener('click', () => goToFirstOnPage('pending'))

document.addEventListener('keydown', (event) => {
  const target = event.target as HTMLElement
  if (event.key === 'n' && !event.ctrlKey && !event.metaKey && !['TEXTAREA', 'INPUT', 'SELECT'].includes(target.tagName) && state.page && state.view === 'review') return void goToFirstOnPage('pending')
  if (['TEXTAREA', 'INPUT', 'SELECT'].includes(target.tagName) || state.view !== 'review' || state.theme !== 1 || !state.elements.length || state.selectedId === null) return
  const index = state.elements.findIndex((e) => e.id === state.selectedId)
  const next = event.key === 'j' ? index + 1 : event.key === 'k' ? index - 1 : -1
  if (next >= 0 && next < state.elements.length) select(state.elements[next].id, true)
})

window.addEventListener('error', (event) => say(t('Panel error: {message}', { message: event.message })))
window.addEventListener('unhandledrejection', (event) => say(t('Panel error: {message}', { message: String(event.reason) })))

/* ------------------------------------------------------------------ */
/* Manual checks and import of other tools' results (per page)           */
/* ------------------------------------------------------------------ */


dom.checksBtn.addEventListener('click', () => setView(state.view === 'checks' ? 'review' : 'checks'))

dom.autoBtn.addEventListener('click', () => void runEverything())

/* ------------------------------------------------------------------ */
/* Audits: name, saved state, list of audits, file save / reopen         */
/* ------------------------------------------------------------------ */


/** Which audit is open, and whether it is saved (in the browser, and in a file). Always visible. */
function renderAuditBar(): void {
  dom.auditNameBtn.textContent = auditTitle(state.audit)
  dom.auditNameBtn.title = t('Rename this audit')
  const { saveState, savedAt, blocked, lastError } = state.session
  dom.saveStateEl.className = `pill ${saveState === 'saved' ? '' : saveState}`
  dom.saveStateEl.textContent =
    saveState === 'saving'
      ? t('Saving…')
      : saveState === 'error'
        ? blocked
          ? t('Not loaded! The saved audit cannot be read; nothing will be written over it.')
          : t('Not saved! Retry, or save to a file now.')
        : t('Saved {time}', { time: timeOf(savedAt || state.audit.updatedAt) })
  dom.saveStateEl.title =
    saveState === 'error'
      ? blocked
        ? lastError
        : t('Not saved: browser storage full or unavailable ({error}). Retry, or save to a file now.', { error: lastError || '—' })
      : t('Saved in the browser at {time}', { time: timeOf(savedAt || state.audit.updatedAt) })
  dom.saveRetryBtn.hidden = saveState !== 'error'
  dom.saveRetryBtn.textContent = blocked ? t('Retry loading') : t('Retry')
  const never = state.audit.exportedAt === undefined
  const changed = !never && state.audit.updatedAt > (state.audit.exportedAt ?? 0)
  dom.backupStateEl.className = `pill ${never || changed ? (state.audit.pages.length ? 'warn' : 'muted') : 'muted'}`
  dom.backupStateEl.textContent = never ? t('No file yet') : changed ? t('File out of date') : t('File up to date')
  dom.backupStateEl.title = never ? t('No file saved yet') : changed ? t('Changed since the file of {time}', { time: timeOf(state.audit.exportedAt ?? 0) }) : t('File saved at {time}', { time: timeOf(state.audit.exportedAt ?? 0) })
  dom.auditsBtn.setAttribute('aria-pressed', String(state.view === 'audits'))
  dom.langFrBtn.setAttribute('aria-pressed', String(getLang() === 'fr'))
  dom.langEnBtn.setAttribute('aria-pressed', String(getLang() === 'en'))
  document.title = `${auditTitle(state.audit)} — RGAA Assistant`
}


/** The open audit and everything that stores it: see audit-session.ts. */
state.session = createAuditSession({
  getAudit: () => state.audit,
  setAudit: (next) => { state.audit = next },
  onActivated: () => {
    state.scannedThisSession.clear()
    state.findingSel = null
    state.theme = 1
    void clearBoxes()
    loadPage((state.liveUrl ? findPage(state.audit, state.liveUrl) : undefined) ?? state.audit.pages.find((p) => p.id === state.audit.current) ?? state.audit.pages[0] ?? null)
    setView('review')
    renderAll()
  },
  onState: () => renderAuditBar(),
  onListChanged: () => { if (state.view === 'audits') void renderAuditsView() },
  say,
  askText,
  askConfirm,
  askChoice,
  download,
  fileNameOf: auditFileName,
})

const renameAudit = (): Promise<unknown> => state.session.renameAuditById(state.audit.id).then(() => { renderAuditBar(); if (state.view === 'audits') void renderAuditsView() })
const newAudit = (): Promise<boolean> => state.session.newAudit()
const openAuditById = (id: string): Promise<boolean> => state.session.openAuditById(id).then((ok) => { if (ok) setView('review'); return ok })
const duplicateAuditById = (id: string): Promise<void> => state.session.duplicateAuditById(id)
const renameAuditById = (id: string): Promise<unknown> => state.session.renameAuditById(id)
const saveAuditToFile = (id?: string): Promise<void> => state.session.saveAuditToFile(id)
const importAuditFile = (file: File): Promise<boolean> => state.session.importAuditFile(file)
async function deleteAuditFlow(id: string): Promise<void> {
  const wasOpen = id === state.audit.id
  if ((await state.session.deleteAuditFlow(id)) && wasOpen) setView('audits')
}

async function renderAuditsView(): Promise<void> {
  await state.session.flush()
  let list: AuditSummary[]
  try {
    list = (await listAudits()).sort((a, b) => b.updatedAt - a.updatedAt)
  } catch (err) {
    return void say(describeAuditError(err))
  }
  if (state.view !== 'audits') return
  dom.auditsEl.replaceChildren(
    h(
      'div',
      { class: 'results-head' },
      h('div', {}, h('h2', {}, t('My audits')), h('p', { class: 'hint-line' }, t('Each audit has its own pages, scans and answers. Everything is saved in the browser as you work; save to a file to keep a copy or move it.'))),
      h('div', { class: 'nav' }, h('button', { type: 'button', onclick: () => setView('review') }, t('← Back to review')), h('button', { type: 'button', onclick: () => dom.importInput.click() }, t('Open from a file')), h('button', { type: 'button', class: 'primary', onclick: () => void newAudit() }, t('New audit'))),
    ),
    h(
      'table',
      { class: 'audit-table' },
      h('thead', {}, h('tr', {}, ...[t('Name'), t('Site'), t('Pages'), t('Last change'), t('File'), ''].map((x) => h('th', { scope: 'col' }, x)))),
      h(
        'tbody',
        {},
        ...list.map((a) =>
          h(
            'tr',
            { class: a.id === state.audit.id ? 'current' : '' },
            h('td', {}, h('strong', {}, auditTitle(a)), a.id === state.audit.id ? h('span', { class: 'badge' }, t('Current')) : null),
            h('td', {}, a.site || '—'),
            h('td', {}, String(a.pages)),
            h('td', {}, dateTimeOf(a.updatedAt)),
            h('td', {}, a.exportedAt === undefined ? t('never') : a.updatedAt > a.exportedAt ? t('changed since {time}', { time: dateTimeOf(a.exportedAt) }) : t('up to date')),
            h(
              'td',
              {},
              h(
                'div',
                { class: 'row-actions' },
                a.id === state.audit.id ? null : h('button', { type: 'button', class: 'primary', onclick: () => void openAuditById(a.id) }, t('Open')),
                h('button', { type: 'button', onclick: () => void renameAuditById(a.id) }, t('Rename')),
                h('button', { type: 'button', onclick: () => void duplicateAuditById(a.id) }, t('Duplicate')),
                h('button', { type: 'button', onclick: () => void saveAuditToFile(a.id) }, t('Save to file')),
                h('button', { type: 'button', class: 'danger-btn', onclick: () => void deleteAuditFlow(a.id) }, t('Delete')),
              ),
            ),
          ),
        ),
      ),
    ),
  )
}

/** Changes the language of the whole panel, now. */
function applyLanguage(lang: Lang): void {
  setLang(lang)
  dom.statusEl.textContent = '' // an old message would stay in the previous language
  translateStatic()
  renderAll()
  renderAuditBar()
  renderPageTools()
  void applyBoxes()
}

dom.auditNameBtn.addEventListener('click', () => void renameAudit())
dom.auditsBtn.addEventListener('click', () => setView(state.view === 'audits' ? 'review' : 'audits'))
dom.saveFileBtn.addEventListener('click', () => void saveAuditToFile())
dom.openFileBtn.addEventListener('click', () => dom.importInput.click())
dom.langFrBtn.addEventListener('click', () => applyLanguage('fr'))
dom.langEnBtn.addEventListener('click', () => applyLanguage('en'))
dom.importInput.addEventListener('change', () => {
  const file = dom.importInput.files?.[0]
  dom.importInput.value = ''
  if (file) void importAuditFile(file)
})
// the last edits are written when the panel is hidden or closed
window.addEventListener('pagehide', () => { if (state.session.hasPending()) void state.session.saveNow() })
document.addEventListener('visibilitychange', () => { if (document.hidden && state.session.hasPending()) void state.session.saveNow() })
dom.saveRetryBtn.addEventListener('click', () => void state.session.retry())

async function init(): Promise<void> {
  setLang(getLang())
  translateStatic()
  initPageTools(dom.pageToolsEl, { send: (payload) => sendToPage(inspectedTabId(), payload as Extract<ContentMessage, { type: 'RGAA_TOOL' }>), say })
  const loaded = await state.session.loadInitial()
  const firstUrl = state.audit.pages.find((p) => p.url)?.url
  if (loaded && !state.audit.meta.site.trim() && firstUrl) {
    adoptSite(firstUrl)
    persist()
  }
  state.liveUrl = await inspectedUrl()
  loadPage((state.liveUrl ? findPage(state.audit, state.liveUrl) : undefined) ?? state.audit.pages.find((p) => p.id === state.audit.current) ?? state.audit.pages[0] ?? null)
  renderAll()
  renderAuditBar()
  if (state.liveUrl) showNavBanner(state.liveUrl)
  if (loaded) say(t('Audit “{name}” opened: {n} page(s).', { name: auditTitle(state.audit), n: state.audit.pages.length }))
}

/**
 * The functions the extracted modules call upwards (see actions.ts). Filled in by the tool when a module needs one.
 */
const registry = {
  renderThemeBar,
  renderStats,
  renderPageBar,
  updateFindingChips,
  renderAll,
  renderSummaries,
  setView,
  switchTo,
  renderChecks,
  scan,
}
export type Registry = typeof registry
registerActions(registry)

void init()
