import { emptyAudit } from '../lib/audit-store'
import type { Audit, ImageReview, PageRecord } from '../lib/types'
import type { AuditSession } from './audit-session'
import type { FindingFilter, Filter, Item, View } from './types'

/**
 * Everything the panel modules share and change while it runs: ONE object, so that a module reads and writes
 * `state.page`, `state.theme`... instead of owning a module-level variable the others cannot reach.
 * It holds data only (no DOM: see ./dom, no callbacks: see ./actions).
 */
export interface PanelState {
  /** The open audit. Replaced as a whole when another audit is opened (see audit-session). */
  audit: Audit
  /** The page of the sample being reviewed (null before the first page is registered). */
  page: PageRecord | null
  /** The address the browser tab is on now. */
  liveUrl: string
  navigationVersion: number
  /** Pages scanned since the panel opened or since the tab last navigated (their boxes are on the page). */
  scannedThisSession: Set<string>
  /** Shortcuts into `page`, set by loadPage: its images, their reviews, its scan count. */
  elements: Item[]
  scanCount: number
  reviews: Record<string, ImageReview>
  /** Image selected in the Images theme. */
  selectedId: number | null
  /** The RGAA theme shown (1 = Images). */
  theme: number
  /** The view shown: review | page results | audit overview | sample | audits | checks. */
  view: View
  /** List filter of the Images theme, and of the finding themes. */
  filter: Filter
  findingFilter: FindingFilter
  /** The finding selected in a finding theme. */
  findingSel: number | null
  /** Per theme: are its boxes on? Saved in the browser; the default is on. */
  boxesOn: Record<number, boolean>
  showAltOn: boolean
  focusTintOn: boolean
  /** The address the “the browser is on another page” reminder was dismissed for. */
  navDismissed: string
  /** The sheet tab open in the page results, and the one open in the audit overview (each view keeps its own). */
  resultsSheet: number
  overviewSheet: number
  /** The automatic checks are running. */
  reviewCursor?: { page: string; key: string }
  /** Information disclosure choices for this panel session only; never part of saved audits. */
  disclosures: Map<string, boolean>
  batchSelection: Set<string>
  batch?: { auditId: string; ids: string[]; index: number; paused: boolean; running: boolean }
  scanBusy: boolean
  runBusy: boolean
  axeRunning: boolean
  /** The last scan() went through (runEverything goes on to the checks only then). */
  lastScanOk: boolean
  /** The open audit and everything that stores it. Set once, at start-up (see panel.ts), before any user action. */
  session: AuditSession
}

export const state: PanelState = {
  audit: emptyAudit(),
  page: null,
  liveUrl: '',
  navigationVersion: 0,
  scannedThisSession: new Set<string>(),
  elements: [],
  scanCount: 0,
  reviews: {},
  selectedId: null,
  theme: 1,
  view: 'review',
  filter: 'all',
  findingFilter: 'all',
  findingSel: null,
  boxesOn: (() => {
    try { return JSON.parse(localStorage.getItem('rgaa-boxes-by-theme') ?? '{}') } catch { return {} }
  })(),
  showAltOn: (() => { try { return localStorage.getItem('rgaa-show-alt') === 'on' } catch { return false } })(),
  focusTintOn: (() => { try { return localStorage.getItem('rgaa-focus-tint') !== 'off' } catch { return true } })(),
  navDismissed: '',
  resultsSheet: 0,
  overviewSheet: 0,
  disclosures: new Map(),
  batchSelection: new Set(),
  scanBusy: false,
  runBusy: false,
  axeRunning: false,
  lastScanOk: false,
  session: undefined as unknown as AuditSession,
}
