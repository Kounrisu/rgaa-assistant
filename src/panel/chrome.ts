/**
 * The frame around the views: totals and their jumps, page bar, theme bar and its menu, address reminder, audit bar, empty screen.
 */
import type { CriterionResult, Outcome } from '../lib/results'
import { state } from './state'
import { pageInput, pageLabel, adoptSite, persist, nextPageLabel, normalizeTheme } from './model'
import { t, getLang } from '../lib/i18n'
import { h, say, dom, $, tNodes } from './dom'
import { reviewKey, needsReview, findingNeedsReview, statusOf } from './review-state'
import { renderFilters, renderList, select } from './images-view'
import { syncFilterBoxes, focusFinding } from './page-bridge'
import { findingCriterionIds, findingCriteriaOf } from '../lib/findings'
import { FINDING_THEMES, THEMES, THEME_LABEL, SCANNED_THEMES } from '../lib/themes'
import { renderThemeView } from './findings-view'
import { rateOf, auditStats, isProvisional, countsOf } from '../lib/audit-sheet'
import { normalizeUrl, findPage } from '../lib/audit-store'
import type { PageRecord, ImageReview } from '../lib/types'
import { colorOf } from '../lib/theme-colors'
import { auditTitle, timeOf } from './helpers'
import { actions } from './actions'
import { criteriaFor } from '../lib/rgaa'

/** Kept as the single entry point the rest of the panel calls after any answer. */
export function renderStats(): void {
  renderSummaries()
}

/** English labels: translate with t() where they are shown. */
export const OUTCOME_PILLS: [Outcome, string, string][] = [
  ['c', 'compliant', 'ok'],
  ['nc', 'non-compliant', 'bad'],
  ['pending', 'to review', 'warn-pill'],
  ['na', 'not applicable', ''],
  ['unassessed', 'not tested', ''],
]

type SummaryTarget = Outcome | 'suggested' | 'unconfirmed' | 'partial'

/** Counts and their destinations must use the same criteria, including coverage. */
function matchesSummaryCriterion(c: CriterionResult, target: SummaryTarget): boolean {
  if (target === 'suggested') return c.outcome === 'pending' && Boolean(c.suggested)
  if (target === 'unconfirmed') return c.outcome === 'nc' && Boolean(c.unconfirmed)
  if (target === 'partial') return c.coverage === 'partial'
  return c.outcome === target && !((target === 'c' || target === 'na') && c.coverage !== 'full')
}

/**
 * The totals of a theme, in the theme's own header: criteria compliant, non-compliant, to review,
 * not applicable, not tested. Each total jumps to the first element it stands for.
 */
export function renderSummaries(): void {
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
      const count = criteria.filter((c) => matchesSummaryCriterion(c, outcome)).length
      host.append(
        h(
          'button',
          {
            type: 'button',
            class: `pill ${cls} sum-${outcome}`,
            disabled: count === 0,
            title: count ? t('Go to the first one ({label})', { label }) : t('Nothing {label}', { label }),
            onclick: () => goToSummary(pageScope ? null : n, outcome),
          },
          h('strong', {}, String(count)),
          ` ${label}`,
          ...(count ? [h('span', { class: 'summary-arrow', 'aria-hidden': 'true' }, '→')] : []),
        ),
      )
    }
    const extraPills: [SummaryTarget, string, string][] = [
      ['suggested', '{n} to confirm', 'A tool suggests an answer for these criteria. Confirm or change each one: until then they count as to review.'],
      ['unconfirmed', '{n} failure(s) to confirm', 'Failures found by a tool and not yet confirmed. They are counted as non-compliant, so the rate is provisional.'],
      ['partial', '{n} partly covered', 'Some tests of these criteria are not supported by this tool. The result counts, but only for the tests this tool can assess, so the rate stays provisional; a failure is always kept.'],
    ]
    for (const [target, label, explanation] of extraPills) {
      const count = criteria.filter((c) => matchesSummaryCriterion(c, target)).length
      if (!count) continue
      const text = t(label, { n: count })
      host.append(h('button', {
        type: 'button', class: `pill warn-pill sum-${target}`,
        title: `${t('Go to the first one ({label})', { label: text })}. ${t(explanation)}`,
        onclick: () => goToSummary(pageScope ? null : n, target),
      }, text, h('span', { class: 'summary-arrow', 'aria-hidden': 'true' }, '→')))
    }
    if (!pageScope && n === 1 && state.elements.length) {
      const prefilled = state.elements.filter((e) => state.reviews[reviewKey(e)]?.auto).length
      host.append(
        h('span', { class: 'pill plain' }, t('{n} image(s)', { n: state.elements.length })),
        ...(state.elements.some((e) => !e.present) ? [h('span', { class: 'pill plain' }, t('{n} on page now', { n: state.elements.filter((e) => e.present).length }))] : []),
        ...(prefilled
          ? [h('button', { type: 'button', class: 'pill plain', title: t('Show the images whose answer was pre-filled'), onclick: () => {
            state.filter = 'prefilled'
            renderFilters()
            renderList()
            const first = state.elements.find((e) => state.reviews[reviewKey(e)]?.auto)
            if (first) { select(first.id, true); focusReviewTarget(dom.detailEl) }
            void syncFilterBoxes()
          } }, t('{n} pre-filled, to confirm', { n: prefilled }), h('span', { class: 'summary-arrow', 'aria-hidden': 'true' }, '→'))]
          : []),
      )
    }
  }
}

/** Open the exact criterion counted by a status, and a relevant element when one exists. */
function goToSummary(theme: number | null, target: SummaryTarget): void {
  if (!state.page) return
  const themes = pageInput(state.page).themes.filter((t) => t.selected && (theme === null || t.number === theme))
  for (const t of themes) {
    const criterion = t.criteria.find((c) => matchesSummaryCriterion(c, target))
    if (!criterion) continue
    state.theme = t.number
    state.findingFilter = 'all'
    state.filter = 'all'
    renderThemeBar()
    // Unsupported/partial criteria need their test breakdown, including tests with no element.
    if (target === 'partial' || target === 'unassessed') return openGridAt(criterion.id)
    actions.setView('review')
    const card = dom.themeEl.querySelector<HTMLElement>(`[id="crit-card-${criterion.id}"]`)
    if (t.number !== 1 && card) return focusReviewTarget(card)

    const matchesAnswer = (review: ImageReview | undefined) => {
      const answer = review?.answers[criterion.id]
      if (target === 'pending' || target === 'suggested') return answer === undefined || Boolean(review?.auto)
      if (target === 'unconfirmed') return answer === 'nc' && Boolean(review?.auto)
      return answer === target
    }
    if (t.number === 1) {
      const ids = new Set(criterion.tests.flatMap((test) => target === 'nc' || target === 'unconfirmed' ? test.nc : test.imageIds))
      const image = state.elements.find((e) => {
        const review = state.reviews[reviewKey(e)]
        return ids.has(e.id) && (!review?.kind || criteriaFor(review.kind).some((c) => c.id === criterion.id)) && matchesAnswer(review)
      })
      if (image) {
        renderFilters()
        renderList()
        select(image.id, true)
        const input = dom.detailEl.querySelector(`[name="crit-${image.id}-${criterion.id}"]`)
        focusReviewTarget(input?.closest<HTMLElement>('.criterion') ?? dom.detailEl)
        void syncFilterBoxes()
        return
      }
    } else if (FINDING_THEMES.has(t.number)) {
      const finding = state.page.findings.find((f) => f.theme === t.number && f.type !== 'contrast-ok' && findingCriteriaOf(f).some((c) => c.id === criterion.id) && matchesAnswer(state.page!.findingReviews[f.key]))
      if (finding) {
        state.findingSel = finding.id
        renderThemeView()
        const input = dom.themeEl.querySelector(`[name="fnd-${finding.id}-${criterion.id}"]`)
        focusReviewTarget(input?.closest<HTMLElement>('.criterion') ?? dom.themeEl)
        void focusFinding(finding, true)
        void syncFilterBoxes()
        return
      }
    }
    return openGridAt(criterion.id)
  }
}

/** A jump moves keyboard focus as well as the viewport. */
function focusReviewTarget(target: HTMLElement): void {
  const input = target.querySelector<HTMLElement>('input[type="radio"]:checked') ?? target.querySelector<HTMLElement>('input[type="radio"]')
  if (!input) target.tabIndex = -1
  ;(input ?? target).focus({ preventScroll: true })
  target.scrollIntoView({ block: 'center' })
  target.classList.add('flash')
  setTimeout(() => target.classList.remove('flash'), 1800)
}

/** Review navigation includes failed suggestions that still need a human decision. */
export const matchesReviewOutcome = (criterion: CriterionResult, outcome: Outcome): boolean =>
  criterion.outcome === outcome || (outcome === 'pending' && Boolean(criterion.unconfirmed))

/** The first chosen theme (in order) that has something to jump to for this status. */
export function firstThemeWith(outcome: Outcome): number | null {
  if (!state.page) return null
  const rec = state.page
  for (const t of pageInput(rec).themes.filter((x) => x.selected)) {
    if (!t.criteria.some((c) => matchesReviewOutcome(c, outcome))) continue
    if (outcome === 'pending') {
      // a theme that was never scanned has criteria "to review" but no element to go to
      const perFinding = findingCriterionIds(t.number)
      const pendingCards = t.criteria.some((c) => matchesReviewOutcome(c, 'pending') && !perFinding.includes(c.id) && t.number !== 1)
      const hasElement =
        t.number === 1 ? state.elements.some((e) => needsReview(e)) : FINDING_THEMES.has(t.number) ? rec.findings.some((f) => f.theme === t.number && findingNeedsReview(f)) : false
      if (!hasElement && !pendingCards) continue
    }
    return t.number
  }
  return null
}

/** Page-level totals (all chosen themes): open the first theme that has such an item, then go to its first element. */
export function goToFirstOnPage(outcome: Outcome): void {
  const n = firstThemeWith(outcome)
  if (n === null) {
    return void say(outcome === 'pending' ? t('Nothing to review yet: scan the page, or every element has been reviewed.') : t('Nothing to show for this total.'))
  }
  state.theme = n
  state.findingFilter = 'all'
  actions.setView('review')
  renderThemeBar()
  goToFirst(n, outcome)
}

/** Where a total leads: the first image / finding / criterion behind it, or its row in the grid. */
export function goToFirst(n: number, outcome: Outcome): void {
  if (!state.page) return
  const rec = state.page
  const result = pageInput(rec).themes.find((x) => x.number === n)
  const first = result?.criteria.find((c) => matchesReviewOutcome(c, outcome))
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
export function openGridAt(criterionId: string): void {
  state.resultsSheet = 0
  actions.setView('page')
  const row = dom.resultsEl.querySelector<HTMLElement>(`tr[data-crit="${criterionId}"]`)
  if (row) focusReviewTarget(row)
}

export function renderPageBar(): void {
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
  $('page-tools-disclosure').hidden = !state.page
  ;($('reset-theme-btn') as HTMLButtonElement).disabled = !state.page
  dom.nextBtn.disabled = !state.page
  dom.progressEl.replaceChildren()
  $('page-progress').hidden = !state.page
  if (state.page) {
    const c = countsOf(pageInput(state.page))
    const total = c.C + c.NC + c.NA + c.NT || 1
    const confirmed = pageInput(state.page).themes.flatMap((theme) => theme.criteria).filter((criterion) => !criterion.unconfirmed)
    const count = (outcome: Outcome) => confirmed.filter((criterion) => criterion.outcome === outcome).length
    const answered = count('c') + count('nc') + count('na')
    dom.progressEl.append(
      h('span', {}, t('{done}/{total} criteria answered', { done: answered, total })),
      h('span', { class: 'meter', role: 'img', 'aria-label': t('Progress of {label}', { label: pageLabel(state.page) }) }, ...[['c', count('c')], ['nc', count('nc')], ['na', count('na')]].map(([k, n]) => h('i', { class: String(k), style: `width:${(Number(n) / total) * 100}%` }))),
    )
  }
  dom.deletePageBtn.disabled = !state.page
  dom.resetPageBtn.disabled = !state.page
  const onLive = Boolean(state.page && state.liveUrl && normalizeUrl(state.page.url) === normalizeUrl(state.liveUrl))
  dom.openPageBtn.hidden = !state.page?.url || onLive
  dom.liveUrlEl.textContent = state.liveUrl ? t('Browser: {url}', { url: state.liveUrl }) : ''
  dom.liveUrlEl.title = state.liveUrl
  dom.liveUrlEl.className = `live-url${onLive ? ' same' : ''}`
  dom.scanBtn.disabled = !state.page
  dom.scanBtn.textContent = state.page ? (state.scannedThisSession.has(state.page.id) ? t('Rescan {page}', { page: pageLabel(state.page) }) : t('Scan {page}', { page: pageLabel(state.page) })) : t('Scan')
  dom.scanBtn.title = state.page
    ? t('Scan what the browser shows and merge the images into {page} (popins, tabs…)', { page: pageLabel(state.page) })
    : t('Add a page to the sample first')
}

export function showNavBanner(url: string): void {
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
      actions.renderAll()
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
      actions.switchTo(known.id)
    }
  } else {
    dom.navBannerText.textContent = t('This URL is not in the sample yet.')
    dom.navBannerBtn.textContent = t('Add it as {label}', { label: nextPageLabel() })
    dom.navBannerBtn.onclick = () => {
      dom.navBanner.hidden = true
      void actions.addPage(url)
    }
  }
  dom.navBanner.hidden = false
}

/** Only human-confirmed, assessed criteria count as answered. */
export function themeProgress(rec: PageRecord, n: number): { done: number; total: number } {
  const t = pageInput(rec).themes.find((x) => x.number === n)
  const total = t?.criteria.length ?? 0
  const done = t?.criteria.filter((c) => ['c', 'nc', 'na'].includes(c.outcome) && !c.unconfirmed).length ?? 0
  return { done, total }
}

export function setThemes(rec: PageRecord, themes: number[]): void {
  rec.themes = [...new Set(themes)].sort((a, b) => a - b)
  if (rec === state.page) normalizeTheme()
  persist()
  // keep the menu open while ticking several themes
  if (state.view === 'sample') {
    renderPageBar()
    renderThemeBar()
    return
  }
  const open = document.querySelector<HTMLDetailsElement>('.themebar .themes-menu')?.open
  actions.renderAll()
  if (open) document.querySelector<HTMLDetailsElement>('.themebar .themes-menu')?.setAttribute('open', '')
}

/** A drop-down with one checkbox per RGAA theme. */
export function themesMenu(rec: PageRecord): HTMLElement {
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

export function renderThemeBar(): void {
  document.documentElement.style.setProperty('--tc', colorOf(state.theme))
  dom.themebarEl.replaceChildren()
  if (!state.page) return
  const rec = state.page
  const selected = [...rec.themes].sort((a, b) => a - b)
  const tabs = h('div', { class: 'theme-tabs', role: 'group', 'aria-label': t('RGAA themes of this page') })
  for (const n of selected) {
    const { done, total } = themeProgress(rec, n)
    tabs.append(
      h(
        'button',
        {
          type: 'button',
          class: `theme-tab${done === total ? ' complete' : ''}`,
          'aria-pressed': String(n === state.theme),
          'aria-label': `${n}. ${t(THEME_LABEL[n])}, ${t('{done}/{total} criteria answered', { done, total })}`,
          style: `--tc:${colorOf(n)}`,
          title: t('{n}. {name} (its boxes on the page use this colour)', { n, name: t(THEME_LABEL[n]) }),
          onclick: () => {
            state.theme = n
            state.findingFilter = 'all'
            actions.setView('review')
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
    themesMenu(rec),
  )
}

export function renderEmpty(): void {
  const onPage = Boolean(state.page && state.liveUrl && normalizeUrl(state.page.url) === normalizeUrl(state.liveUrl))
  dom.emptyAddBtn.hidden = Boolean(state.page)
  dom.emptyGoBtn.hidden = !state.page || onPage
  if (!state.page) {
    dom.emptyTitle.textContent = t('Start by registering the pages of your sample')
    dom.emptyText.textContent = t('Open the first page in the browser and add it as page 1. You scan it afterwards, when you are ready.')
    dom.emptyAddBtn.textContent = t('Add the current URL as {label}', { label: nextPageLabel() })
  } else if (state.page.scannedThemes.includes(1)) {
    dom.emptyTitle.textContent = t('No images found on this page')
    dom.emptyText.textContent = t('Review the other themes or open the page results. Rescan after revealing new content.')
    $('empty-steps').replaceChildren()
    return
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

/** Which audit is open, and whether it is saved (in the browser, and in a file). Always visible. */
export function renderAuditBar(): void {
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
