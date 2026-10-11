/**
 * Every listener of the panel (buttons, keyboard, navigation of the page, messages of the extension), and the language switch.
 */
import { type Lang, setLang, translateStatic, t } from '../lib/i18n'
import { dom, say } from './dom'
import { resetTheme, renderAll, switchTo, removePage, resetPage, setView } from './router'
import { renderAuditBar, renderPageBar, renderStats, renderEmpty, showNavBanner, goToFirstOnPage } from './chrome'
import { renderPageTools, resetPageTools } from './page-tools-ui'
import { applyBoxes, goTo, sendToPage, inspectedTabId } from './page-bridge'
import { addPage } from './sample-view'
import { state } from './state'
import { scan } from './scan-flow'
import { renderList, select } from './images-view'
import { normalizeUrl } from '../lib/audit-store'
import { runEverything } from './auto-checks'
import { renameAudit, saveAuditToFile, importAuditFile } from './audits-view'

/** Changes the language of the whole panel, now. */
export function applyLanguage(lang: Lang): void {
  setLang(lang)
  dom.statusEl.textContent = '' // an old message would stay in the previous language
  translateStatic()
  renderAll()
  renderAuditBar()
  renderPageTools()
  void applyBoxes()
}

/** Registers every listener of the panel: its buttons, the keyboard, the page navigation, the extension messages. Called once, at start-up. */
export function wireEvents(): void {
  dom.reviewBtn.addEventListener('click', () => setView('review'))
  document.getElementById('reset-theme-btn')!.addEventListener('click', () => {
    document.querySelector<HTMLDetailsElement>('.page-options')!.open = false
    void resetTheme()
  })
  const compact = window.matchMedia('(max-width: 979px)')
  const sizeList = () => { (document.getElementById('image-list-disclosure') as HTMLDetailsElement).open = !compact.matches }
  sizeList()
  compact.addEventListener('change', sizeList)

  dom.pageSelect.addEventListener('change', () => switchTo(dom.pageSelect.value, true))
  dom.deletePageBtn.addEventListener('click', () => removePage())
  dom.resetPageBtn.addEventListener('click', () => resetPage())
  dom.emptyAddBtn.addEventListener('click', () => void addPage(state.liveUrl))
  dom.emptyGoBtn.addEventListener('click', () => state.page && goTo(state.page.url))
  dom.sampleBtn.addEventListener('click', () => setView('sample'))
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
  dom.resultsBtn.addEventListener('click', () => setView('page'))
  dom.auditBtn.addEventListener('click', () => setView('audit'))
  dom.nextBtn.addEventListener('click', () => goToFirstOnPage('pending'))
  // Keyboard: n goes to the next element to review, j / k move between images (outside text fields).
  document.addEventListener('keydown', (event) => {
    const target = event.target as HTMLElement
    if (document.querySelector('dialog[open]') || target.isContentEditable || event.ctrlKey || event.metaKey || event.altKey) return
    if (event.key === 'n' && !event.ctrlKey && !event.metaKey && !['TEXTAREA', 'INPUT', 'SELECT'].includes(target.tagName) && state.page && state.view === 'review') return void goToFirstOnPage('pending')
    if (['TEXTAREA', 'INPUT', 'SELECT'].includes(target.tagName) || state.view !== 'review' || state.theme !== 1 || !state.elements.length || state.selectedId === null) return
    const index = state.elements.findIndex((e) => e.id === state.selectedId)
    const next = event.key === 'j' ? index + 1 : event.key === 'k' ? index - 1 : -1
    if (next >= 0 && next < state.elements.length) select(state.elements[next].id, true)
  })
  window.addEventListener('error', (event) => say(t('Panel error: {message}', { message: event.message })))
  window.addEventListener('unhandledrejection', (event) => say(t('Panel error: {message}', { message: String(event.reason) })))
  dom.checksBtn.addEventListener('click', () => setView('checks'))
  dom.autoBtn.addEventListener('click', () => void runEverything())
  dom.auditNameBtn.addEventListener('click', () => void renameAudit())
  dom.auditsBtn.addEventListener('click', () => setView('audits'))
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
}
