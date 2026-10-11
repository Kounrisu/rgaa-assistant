/**
 * Which view is shown, which page is selected, and the resets (a theme, a page, the whole audit). renderAll() redraws everything.
 */
import { renderPageBar, renderThemeBar, renderStats, showNavBanner, renderSummaries, renderEmpty, renderAuditBar } from './chrome'
import { renderFilters, renderList, renderDetail } from './images-view'
import { state } from './state'
import { renderResults } from './results-view'
import { renderAudit } from './audit-overview'
import { renderSample } from './sample-view'
import { loadPage, persist, pageLabel, normalizeTheme } from './model'
import { dom, say } from './dom'
import { normalizeUrl, emptyAudit } from '../lib/audit-store'
import { t } from '../lib/i18n'
import { goTo, clearBoxes, applyBoxes } from './page-bridge'
import type { PageRecord } from '../lib/types'
import { askConfirm } from './dialogs'
import { FINDING_THEMES, themeByNumber, THEME_LABEL, THEMES, SCANNED_THEMES } from '../lib/themes'
import type { View } from './types'
import { renderThemeView } from './findings-view'
import { renderAuditsView } from './audits-view'
import { renderChecks } from './checks-view'
import { setPageToolsTheme } from './page-tools-ui'

export function renderAll(): void {
  normalizeTheme() // a render never changes the state itself
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
export function switchTo(id: string, navigate = false): void {
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

export async function removePage(rec: PageRecord | null = state.page): Promise<void> {
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

export function resetThemeData(rec: PageRecord, n: number): void {
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

export async function resetTheme(n = state.theme): Promise<void> {
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

export async function resetPage(rec: PageRecord | null = state.page): Promise<void> {
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

export async function resetAudit(): Promise<void> {
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

export function setView(next: View): void {
  state.view = next
  document.body.dataset.view = next
  dom.reviewBtn.setAttribute('aria-pressed', String(next === 'review'))
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
  dom.themebarEl.hidden = !state.page || next !== 'review'
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

export function setScanned(): void {
  const has = state.elements.length > 0
  dom.clearBtn.disabled = !has && !(state.page?.findings.length)
  dom.boxesBtn.disabled = !has && !(state.page?.findings.length)
  dom.resultsBtn.disabled = !state.page
  dom.auditBtn.disabled = !state.audit.pages.length
  dom.checksBtn.disabled = !state.page
  dom.autoBtn.disabled = !state.page || state.axeRunning
  dom.scanBtn.disabled = !state.page
  setView(state.view === 'page' && !state.page ? 'review' : state.view)
}

/** Buttons that act on the boxes of the current theme live in that theme's own toolbar. */
export function updateTools(): void {
  setPageToolsTheme(state.theme)
  void applyBoxes()
  const reviewing = Boolean(state.page) && state.view === 'review'
  dom.imagesHeadEl.hidden = !(reviewing && state.theme === 1)
  // the toolbar belongs to the theme being shown: Images has its header, the other themes put it in theirs
  if (state.theme === 1) dom.imagesHeadEl.append(dom.toolsEl)
  dom.toolsEl.hidden = !(reviewing && SCANNED_THEMES.has(state.theme))
}
