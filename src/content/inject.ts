import { DEFAULT_COLOR, purgeOverlays } from './dom-utils'
import { applyOverlayOptions, boxes, clearTheme, focusImage, focusThemeFinding, ids, locateTheme, relabel, relabelTheme, repositionBoxes, restoreScroll, setFocused, setStates, showOnly, themeOverlays } from './overlay'
import { highlightImages, setImageColor, startObserving, stopObserving } from './scan-images'
import { scanTheme } from './scan-elements'
import { runRgaaRules, runUxRules } from './rgaa-rules-run'
import { takeSnapshot } from './snapshot'
import { runAxe } from './axe-run'
import { endPick, startPick } from './picker'
import { type ToolName, resetTools, runTool } from './page-tools'
import { computeCoverage, resetCuts } from './scan-coverage'

// Reloading the extension leaves the previous copy of this script, and the boxes it drew, in the page.
// A new copy removes those boxes and takes over; an older copy goes quiet (see `isCurrent`).
const INSTANCE = `${Date.now()}-${Math.random()}`
document.documentElement.dataset.rgaaInstance = INSTANCE
const isCurrent = (): boolean => document.documentElement.dataset.rgaaInstance === INSTANCE
purgeOverlays()

function resetAll(): void {
  themeOverlays.clear()
  boxes.clear()
  purgeOverlays()
  stopObserving()
  ids.registry = new WeakMap()
  ids.next = 1
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!isCurrent()) return undefined
  if (message?.type === 'RGAA_SNAPSHOT') {
    sendResponse(takeSnapshot())
    return true
  }
  if (message?.type === 'RGAA_TOOL') {
    sendResponse(runTool(message.tool as ToolName, Boolean(message.on), repositionBoxes))
    return true
  }
  if (message?.type === 'RGAA_TOOLS_RESET') {
    resetTools(repositionBoxes)
    sendResponse({ ok: true })
    return true
  }
  if (message?.type === 'RGAA_RULES_RUN') {
    resetCuts()
    const base = runRgaaRules()
    sendResponse({ ...base, findings: [...base.findings, ...runUxRules()], coverage: computeCoverage(document) })
    return true
  }
  if (message?.type === 'RGAA_AXE_RUN') {
    void runAxe(message.locale, message.rules).then(sendResponse)
    return true
  }
  if (message?.type === 'RGAA_PICK_START') {
    void startPick(sendResponse)
    return true
  }
  if (message?.type === 'RGAA_PICK_CANCEL') {
    endPick({ cancelled: true })
    sendResponse({ ok: true })
    return true
  }
  if (message?.type === 'RGAA_HIGHLIGHT_IMAGES') {
    if (message.color) setImageColor(message.color)
    const elements = highlightImages()
    startObserving()
    sendResponse({ elements, coverage: computeCoverage(document) })
    return true
  }
  if (message?.type === 'RGAA_CLEAR_HIGHLIGHTS') {
    resetAll()
    sendResponse({ ok: true })
    return true
  }
  if (message?.type === 'RGAA_LOCATE') {
    sendResponse(locateTheme(message.theme, message.id) ?? { rect: null })
    return true
  }
  if (message?.type === 'RGAA_SCROLL_RESTORE') {
    restoreScroll()
    sendResponse({ ok: true })
    return true
  }
  if (message?.type === 'RGAA_SHOW_ONLY') {
    showOnly(message.theme, message.ids ?? null)
    sendResponse({ ok: true })
    return true
  }
  if (message?.type === 'RGAA_CLEAR_THEME') {
    clearTheme(message.theme)
    sendResponse({ ok: true })
    return true
  }
  if (message?.type === 'RGAA_STATES') {
    setStates(message.theme, message.states ?? {})
    sendResponse({ ok: true })
    return true
  }
  if (message?.type === 'RGAA_OVERLAY') {
    applyOverlayOptions(message)
    sendResponse({ ok: true })
    return true
  }
  if (message?.type === 'RGAA_SCAN_THEME') {
    const findings = scanTheme(message.theme, message.color ?? DEFAULT_COLOR)
    sendResponse({ findings, coverage: computeCoverage(document) })
    return true
  }
  if (message?.type === 'RGAA_RELABEL' && message.theme && message.theme !== 1) {
    relabelTheme(message.theme, message.map)
    sendResponse({ ok: true })
    return true
  }
  if (message?.type === 'RGAA_RELABEL') {
    relabel(message.map)
    sendResponse({ ok: true })
    return true
  }
  if (message?.type === 'RGAA_FOCUS_IMAGE' && message.theme && message.theme !== 1) {
    sendResponse({ ok: focusThemeFinding(message.theme, message.id, message.scroll !== false) })
    return true
  }
  if (message?.type === 'RGAA_FOCUS_IMAGE') {
    sendResponse({ ok: focusImage(message.id, message.scroll !== false) })
    return true
  }
  if (message?.type === 'RGAA_UNFOCUS_IMAGE') {
    setFocused(null)
    sendResponse({ ok: true })
    return true
  }
  return undefined
})
