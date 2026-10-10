/**
 * The messages the panel and the content scripts send to the background page.
 * One place for the shapes, so both sides agree and the tests can check them.
 */
import type { Audit } from './types'

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
export type SaveErrorCode = 'invalid' | 'storage' | 'unreachable'
export type SaveResponse = { ok: true; revision: number } | { ok: false; code: SaveErrorCode; error: string }

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

/** Forward `payload` to the content script of the tab (DevTools pages cannot use chrome.tabs). */
export interface RelayMessage {
  type: 'RGAA_RELAY'
  tabId: number
  payload: unknown
}

export type BackgroundMessage = SaveMessage | DeleteMessage | CaptureMessage | TabInfoMessage | AxeMessage | RelayMessage
