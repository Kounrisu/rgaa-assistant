import type { ContentMessage, ContentResponses } from '../lib/messages'
import { DEFAULT_COLOR, purgeOverlays } from './dom-utils'
import { applyOverlayOptions, boxes, clearTheme, focusImage, focusThemeFinding, ids, locateTheme, viewportRects, relabel, relabelTheme, repositionBoxes, restoreScroll, setFocused, setStates, showOnly, themeOverlays } from './overlay'
import { highlightImages, setImageColor, startObserving, stopObserving } from './scan-images'
import { scanTheme } from './scan-elements'
import { runRgaaRules, runUxRules } from './rgaa-rules-run'
import { takeSnapshot } from './snapshot'
import { runAxe } from './axe-run'
import { endPick, startPick } from './picker'
import { resetTools, runTool } from './page-tools'
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

/**
 * The message router: what the panel asks (see `ContentMessage` in lib/messages.ts) and the answer to each.
 * A message type added to `ContentMessage` must get a case here: the `never` check below fails to compile otherwise.
 * Anything else that reaches this script is ignored.
 */
chrome.runtime.onMessage.addListener((message: ContentMessage, _sender, sendResponse) => {
  if (!isCurrent()) return undefined
  /** Sends the answer for this message type (checked against `ContentResponses`). */
  const respond = <T extends ContentMessage['type']>(_type: T, response: ContentResponses[T]): true => {
    sendResponse(response)
    return true
  }
  switch (message?.type) {
    case 'RGAA_SNAPSHOT':
      return respond(message.type, takeSnapshot())
    case 'RGAA_TOOL':
      return respond(message.type, runTool(message.tool, Boolean(message.on), repositionBoxes))
    case 'RGAA_TOOLS_RESET':
      resetTools(repositionBoxes)
      return respond(message.type, { ok: true })
    case 'RGAA_RULES_RUN': {
      resetCuts()
      const base = runRgaaRules()
      return respond(message.type, { ...base, findings: [...base.findings, ...runUxRules()], coverage: computeCoverage(document) })
    }
    case 'RGAA_AXE_RUN':
      void runAxe(message.locale, message.rules).then((r) => respond(message.type, r))
      return true
    case 'RGAA_PICK_START':
      void startPick((r) => respond(message.type, r))
      return true
    case 'RGAA_PICK_CANCEL':
      endPick({ cancelled: true })
      return respond(message.type, { ok: true })
    case 'RGAA_HIGHLIGHT_IMAGES': {
      if (message.color) setImageColor(message.color)
      const elements = highlightImages()
      startObserving()
      return respond(message.type, { elements, coverage: computeCoverage(document) })
    }
    case 'RGAA_CLEAR_HIGHLIGHTS':
      resetAll()
      return respond(message.type, { ok: true })
    case 'RGAA_LOCATE':
      return respond(message.type, locateTheme(message.theme, message.id) ?? { rect: null })
    case 'RGAA_RECTS':
      return respond(message.type, viewportRects(message.targets))
    case 'RGAA_SCROLL_RESTORE':
      restoreScroll()
      return respond(message.type, { ok: true })
    case 'RGAA_SHOW_ONLY':
      showOnly(message.theme, message.ids ?? null)
      return respond(message.type, { ok: true })
    case 'RGAA_CLEAR_THEME':
      clearTheme(message.theme)
      return respond(message.type, { ok: true })
    case 'RGAA_STATES':
      setStates(message.theme, message.states ?? {})
      return respond(message.type, { ok: true })
    case 'RGAA_OVERLAY':
      applyOverlayOptions(message)
      return respond(message.type, { ok: true })
    case 'RGAA_SCAN_THEME': {
      const findings = scanTheme(message.theme, message.color ?? DEFAULT_COLOR)
      return respond(message.type, { findings, coverage: computeCoverage(document) })
    }
    case 'RGAA_RELABEL':
      if (message.theme && message.theme !== 1) relabelTheme(message.theme, message.map)
      else relabel(message.map)
      return respond(message.type, { ok: true })
    case 'RGAA_FOCUS_IMAGE':
      if (message.theme && message.theme !== 1) return respond(message.type, { ok: focusThemeFinding(message.theme, message.id, message.scroll !== false) })
      return respond(message.type, { ok: focusImage(message.id, message.scroll !== false) })
    case 'RGAA_UNFOCUS_IMAGE':
      setFocused(null)
      return respond(message.type, { ok: true })
    default: {
      const unhandled: never = message
      void unhandled
      return undefined
    }
  }
})
