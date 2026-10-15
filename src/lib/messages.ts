/**
 * The messages the panel and the content scripts send to the background page.
 * One place for the shapes, so both sides agree and the tests can check them.
 */
import type { ToolName } from '../content/page-tools'
import type { AsqExtra } from './asqatasun-rules'
import type { ScanCoverage } from './scan-coverage'
import type { Audit, ImageElementInfo, RawFinding } from './types'

/* Persistence: the background page is the only writer of the audits in chrome.storage.local. */

/** Save one audit. `revision` is the panel's edit counter at the moment of the call; it is echoed back. */
export interface SaveMessage {
  type: 'RGAA_SAVE'
  audit: Audit
  revision: number
}
export interface DeleteMessage {
  type: 'RGAA_DELETE'
  id: string
}
export type SaveErrorCode = 'invalid' | 'storage' | 'unreachable' | 'conflict'
export type SaveResponse = { ok: true; revision: number; storageToken?: string } | { ok: false; code: SaveErrorCode; error: string }

/* Screenshots */

export interface CaptureMessage {
  type: 'RGAA_CAPTURE'
  /** The inspected tab. Omitted when the page script asks: the sender's tab is used. */
  tabId?: number
}
/**
 * no-tab: the tab is gone or unknown. not-active: the inspected tab is not the one shown in its window, so a
 * screenshot would show another page. changed: the shown tab changed while the picture was taken.
 */
export type CaptureErrorCode = 'no-tab' | 'not-active' | 'changed' | 'failed'
export type CaptureResponse = { dataUrl: string } | { error: string; code: CaptureErrorCode }

/* Other requests */

export interface TabInfoMessage {
  type: 'RGAA_TAB_INFO'
  tabId: number
}
export interface TabInfoResponse {
  url: string
  title: string
}

export interface AxeMessage {
  type: 'RGAA_AXE'
  tabId: number
  locale?: unknown
  rules?: string[] | null
}

/** Forward `payload` (a `ContentMessage`) to the content script of the tab (DevTools pages cannot use chrome.tabs). */
export interface RelayMessage {
  type: 'RGAA_RELAY'
  tabId: number
  payload: unknown
}

/** Applies (on) or removes (off) a style sheet of the audit styles on the inspected tab. Extension-injected CSS: the page's CSP cannot block it. */
export interface StyleMessage {
  type: 'RGAA_STYLE'
  tabId: number
  id: string
  css: string
  on: boolean
}
export type StyleResponse = { ok: true } | { ok?: false; error: string }

export type BackgroundMessage = SaveMessage | DeleteMessage | CaptureMessage | TabInfoMessage | AxeMessage | RelayMessage | StyleMessage

/* Content script: what the panel (through the background relay) asks the page, and what the page answers.
 * Only types are exported from here (erased at build time): the content script must stay one self-contained script,
 * so it never imports a runtime value from a file the panel or the background also import. */

/** Renumbering of the boxes: the panel owns the numbering per audited page. */
export interface RelabelEntry {
  from: number
  to: number
}

/** One finding of our own RGAA rules (`asq` is present on the ones that come from the Asqatasun port). */
export interface RuleFinding {
  key: string
  count: number
  detail?: string
  samples?: string[]
  asq?: AsqExtra
}

/** Where an element is on screen after it was scrolled to the middle (page coordinates of the viewport). */
export interface LocatedElement {
  rect: { x: number; y: number; w: number; h: number }
  vw: number
  vh: number
}

/** Where several elements are on screen right now, and whether each one is fully in view and not covered. */
export interface ViewportRects {
  vw: number
  vh: number
  rects: ({ x: number; y: number; w: number; h: number; visible: boolean } | null)[]
}

export type ContentMessage =
  | { type: 'RGAA_HIGHLIGHT_IMAGES'; color?: string }
  | { type: 'RGAA_CLEAR_HIGHLIGHTS' }
  | { type: 'RGAA_LOCATE'; theme: number; id: number }
  | { type: 'RGAA_RECTS'; targets: { theme: number; id: number }[] }
  | { type: 'RGAA_SCROLL_RESTORE' }
  | { type: 'RGAA_SHOW_ONLY'; theme: number; ids?: number[] | null }
  | { type: 'RGAA_CLEAR_THEME'; theme: number }
  | { type: 'RGAA_OVERLAY'; visibility?: Record<number, boolean>; tint?: boolean; alt?: boolean }
  | { type: 'RGAA_STATES'; theme: number; states?: Record<number, string> }
  | { type: 'RGAA_SCAN_THEME'; theme: number; color?: string }
  /** Without `theme` (or with 1): the image boxes. */
  | { type: 'RGAA_RELABEL'; map: RelabelEntry[]; theme?: number }
  /** Without `theme` (or with 1): an image box. `scroll` defaults to true. */
  | { type: 'RGAA_FOCUS_IMAGE'; id: number; scroll?: boolean; theme?: number }
  | { type: 'RGAA_UNFOCUS_IMAGE' }
  | { type: 'RGAA_PICK_START' }
  | { type: 'RGAA_PICK_CANCEL' }
  | { type: 'RGAA_AXE_RUN'; locale?: unknown; rules?: string[] | null }
  | { type: 'RGAA_RULES_RUN' }
  | { type: 'RGAA_SNAPSHOT' }
  | { type: 'RGAA_TOOL'; tool: ToolName; on: boolean }
  | { type: 'RGAA_TOOLS_RESET' }

export type ContentMessageType = ContentMessage['type']

export interface OkResponse {
  ok: true
}

export type AxeRunResponse =
  | { error: string }
  | {
      url: string
      violations: {
        id: string
        impact: string | null
        help: string
        nodes: { html: string; target: string[]; any: { data: unknown }[] }[]
      }[]
      incomplete: number
      passes: number
      passedRules: string[]
      inapplicableRules: string[]
    }

/** The answer of the colour picker: the colour clicked, or why there is none. */
export interface PickResponse {
  hex?: string
  cancelled?: boolean
  error?: string
}

/** The answer to each message type. */
export interface ContentResponses {
  RGAA_HIGHLIGHT_IMAGES: { elements: ImageElementInfo[]; coverage: ScanCoverage }
  RGAA_CLEAR_HIGHLIGHTS: OkResponse
  RGAA_LOCATE: LocatedElement | { rect: null }
  RGAA_RECTS: ViewportRects
  RGAA_SCROLL_RESTORE: OkResponse
  RGAA_SHOW_ONLY: OkResponse
  RGAA_CLEAR_THEME: OkResponse
  RGAA_OVERLAY: OkResponse
  RGAA_STATES: OkResponse
  RGAA_SCAN_THEME: { findings: RawFinding[]; coverage: ScanCoverage }
  RGAA_RELABEL: OkResponse
  RGAA_FOCUS_IMAGE: { ok: boolean }
  RGAA_UNFOCUS_IMAGE: OkResponse
  RGAA_PICK_START: PickResponse
  RGAA_PICK_CANCEL: OkResponse
  RGAA_AXE_RUN: AxeRunResponse
  RGAA_RULES_RUN: { url: string; findings: RuleFinding[]; coverage: ScanCoverage }
  RGAA_SNAPSHOT: { url: string; title: string; html: string; coverage: ScanCoverage }
  RGAA_TOOL: { ok: boolean; count?: number }
  RGAA_TOOLS_RESET: OkResponse
}

/** The answer to a given message. */
export type ContentResponse<M extends ContentMessage> = ContentResponses[M['type']]
