/**
 * The panel's entry point (panel.html loads this file). It only starts things up; the code lives in the modules
 * next to it, listed in "Code layout" in the README:
 *  - state.ts / dom.ts: the shared state and the page's elements;
 *  - actions.ts: how a module calls a function that lives above it (filled in below);
 *  - the views (images-view, findings-view, checklist-view, checks-view, results-view, audit-overview, sample-view,
 *    audits-view), chrome.ts (page bar, theme bar, totals), router.ts (views, pages, resets), scan-flow.ts, events.ts.
 */
import { findPage } from '../lib/audit-store'
import { createAuditSession } from './audit-session'
import type { ContentMessage } from '../lib/messages'
import { getLang, setLang, t, translateStatic } from '../lib/i18n'
import { initPageTools, refreshPageTools } from './page-tools-ui'
import { initAuditStyles } from './audit-styles-ui'
import { auditTitle, auditFileName } from './helpers'
import { download, dom, say } from './dom'
import { state } from './state'
import { registerActions } from './actions'
import { askConfirm, askText, askChoice } from './dialogs'
import { clearBoxes, sendToPage, inspectedTabId, inspectedUrl } from './page-bridge'
import { loadPage, persist, adoptSite } from './model'
import { updateFindingChips } from './findings-view'
import { renderChecks } from './checks-view'
import { renderPageBar, renderThemeBar, renderStats, showNavBanner, renderSummaries, renderAuditBar } from './chrome'
import { renderAuditsView } from './audits-view'
import { addPage } from './sample-view'
import { switchTo, removePage, resetPage, setView, renderAll, resetTheme, resetAudit } from './router'
import { scan } from './scan-flow'
import { runSelected } from './batch-runner'
import { renderBatch } from './batch-view'
import { nextReview } from './review-navigation'
import { wireEvents } from './events'

/**
 * The functions the other modules call "upwards" (see actions.ts): a module that is below them cannot import them
 * without a cycle, so it calls `actions.<name>()`. Add a function here when a module needs it that way.
 */
const registry = {
  nextReview,
  runSelected,
  renderBatch,
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
  addPage,
  resetTheme,
  resetAudit,
  resetPage,
  removePage,
}
export type Registry = typeof registry
registerActions(registry)

wireEvents()

/** The open audit and everything that stores it: see audit-session.ts. */
state.session = createAuditSession({
  getAudit: () => state.audit,
  setAudit: (next) => { state.audit = next },
  onActivated: () => {
    state.batchSelection.clear()
    state.batch = undefined
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

async function init(): Promise<void> {
  setLang(getLang())
  translateStatic()
  initPageTools(dom.pageToolsEl, { send: (payload) => sendToPage(inspectedTabId(), payload as Extract<ContentMessage, { type: 'RGAA_TOOL' }>), say })
  initAuditStyles({ apply: (m) => chrome.runtime.sendMessage({ type: 'RGAA_STYLE', tabId: inspectedTabId(), ...m }), say, refresh: refreshPageTools })
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

void init()
