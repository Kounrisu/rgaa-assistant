export interface ImageElementInfo {
  id: number
  tag: string
  /** img, svg, canvas, input-image, area, object, embed, "role-img (div)", or "icon-font (span)" (an icon drawn by a font). */
  type: string
  /** Real URL (img, input, object, embed); null for inline graphics. */
  src: string | null
  /** Image to preview in the panel: a URL or a data: URL (svg, canvas). */
  thumb: string | null
  alt: string | null
  ariaLabel: string | null
  labelledByText: string | null
  title: string | null
  /** <title> child of an <svg>. */
  svgTitle: string | null
  /** What assistive tech would announce, if anything. */
  accessibleName: string | null
  /** Why assistive tech ignores the element (alt="", aria-hidden…), or null if it is exposed. */
  ignoredBy: string | null
  role: string | null
  ariaHidden: boolean
  /** Inside a <dialog>, role=dialog/alertdialog or aria-modal — typically a popin. */
  inDialog: boolean
  nearbyText: string | null
  isInsideLink: boolean
  linkHref: string | null
  linkText: string | null
  figcaption: string | null
  naturalWidth: number
  naturalHeight: number
  /** The <img> tag alone. */
  html: string
  /** The closest meaningful parent (a, button, figure, picture…), with the image flagged by data-rgaa-target. */
  contextHtml: string
  deterministic: Record<string, boolean>
  /**
   * A picture of the element as the page shows it (cropped from a screenshot), for graphics that cannot be redrawn from
   * their markup: inline SVG using a sprite or the page's CSS, CSS background icons. Kept across rescans; absent for plain <img>.
   */
  shot?: string | null
}

export type ImageKind = 'informative' | 'decorative'
export type Verdict = 'c' | 'nc' | 'na'

export interface ImageReview {
  kind?: ImageKind
  answers: Record<string, Verdict>
  note: string
  /** At least one stored answer is a suggestion. Legacy reviews apply this to every answer. */
  auto?: boolean
  /** Criteria whose stored answers are still automatic suggestions. */
  pendingAnswers?: string[]
  /** Colours checked by hand for a contrast finding (hex), overriding what the script read. */
  fg?: string
  bg?: string
  /** The note the checker wrote itself, so it can be replaced without touching your own words. */
  autoNote?: string
}

/** How the page treats the image, before any human judgement. */
export type Detected = 'ignored' | 'named' | 'unnamed'

/** An image seen in at least one scan of a page. Kept even after it disappears (popin closed). */
export interface AuditItem extends ImageElementInfo {
  /** Stable across reloads, so saved answers keep matching. */
  key: string
  /** Is it on the page as of the latest scan? */
  present: boolean
  /** Scan number in which it was first seen (1 = initial page, 2+ = appeared later, e.g. popin or tab). */
  scan: number
}

/** One audited page of the sample (P01, P02…), with its own images and answers. */
export type ChecklistVerdict = 'c' | 'nc' | 'na'
/** The answer for one criterion of a checklist theme (every theme except Images). */
export interface ChecklistAnswer {
  /** The auditor's own answer. Only a human sets or clears it: automatic runs never write here. */
  verdict?: ChecklistVerdict
  note: string
  /**
   * What the automatic checks suggest (pre-filled, "to confirm"). Not a verdict: it is shown on the card and one
   * click turns it into `verdict`. Refreshed by each run while `verdict` is unset; ignored once the auditor answers.
   */
  suggested?: ChecklistVerdict
  /** Name of the tool behind `suggested` (axe…); cleared when the auditor answers. */
  source?: string
  /**
   * Images only: the auditor checked by hand the tests of this criterion that the tool does not assess (server-side image maps, a canvas
   * fallback, the conciseness of an alternative…). It lifts the “partial coverage” of the criterion; it is never set by a tool.
   */
  manualTests?: boolean
  /** Scan timestamp covered by the manual verdict for absent/omitted elements. */
  coverageAt?: number
  /** What the automatic checks found for this criterion, by tool, at the last run. */
  autoResults?: Record<string, { result: 'pass' | 'fail'; rules: string[]; /** What was seen (e.g. the doctype found). */ details?: string[] }>
}

/** What an import of another tool's results did on a page. */
export interface ImportReport {
  tool: string
  at: number
  url: string
  /** Verdicts pre-filled. */
  set: number
  /** Notes written on elements. */
  noted: number
  /** Criteria the tool failed but the auditor had marked otherwise. */
  conflicts: string[]
  /** Tool findings that could not be matched to a scanned element. */
  unmatched: string[]
  /** Tool rules / answers with no place in this audit. */
  unmapped: string[]
  incomplete: number
  passes: number
  /** What each rule found, for the detail list of the report. */
  items?: { criterion: string; rule: string; result: 'nc' | 'na' | 'note' | 'pass'; text: string }[]
}

export interface ManualCheckAnswer {
  state: 'ok' | 'issue'
  note: string
  /** Criterion explicitly linked by the auditor; a confirmed NC must still be recorded there. */
  criterion?: string
}

export interface AutomaticRun {
  status: 'running' | 'complete' | 'partial' | 'failed'
  startedAt: number
  finishedAt?: number
  url: string
  error?: string
}

export interface PageRecord {
  /** Previous addresses explicitly corrected by the auditor, with original evidence retained. */
  urlHistory?: { url: string; at: number }[]
  /** Latest full automatic run; absent on older audits (history is not proof of a complete run). */
  automaticRun?: AutomaticRun
  /** What the last scans did not look at (frames, shadow roots) and where they cut a list. */
  scanCoverage?: import('./scan-coverage').ScanCoverage
  id: string
  url: string
  title: string
  scanCount: number
  nextId: number
  updatedAt: number
  items: AuditItem[]
  reviews: Record<string, ImageReview>
  /** RGAA themes audited on this page (1 = Images by default). */
  themes: number[]
  /** Answers per criterion id ("2.1") for the checklist themes. */
  checklist: Record<string, ChecklistAnswer>
  /** Frames (2) and colour (3) findings, with their own display numbering. */
  findings: FindingItem[]
  findingReviews: Record<string, ImageReview>
  /** Themes that were scanned at least once (a never-scanned theme cannot be 'not applicable'). */
  scannedThemes: number[]
  nextFindingId: number
  /** Findings are numbered 1, 2, 3… within each theme. */
  nextFindingIds: Record<number, number>
  /** Manual checks (keyboard, zoom, screen reader…) by check id. */
  manualChecks?: Record<string, ManualCheckAnswer>
  /** Imports of other tools' results made on this page. */
  imports?: ImportReport[]
  /** The generated HTML of the page when it was last captured (gzip, base64). */
  snapshot?: import('./snapshot').HtmlSnapshot
  /** What the HTML validation found in that snapshot. */
  htmlCheck?: import('./html-check').HtmlCheck
}

export interface AuditMeta {
  site: string
  auditor: string
  context: string
  /** Which DINUM audit level this audit covers; absent = the complete audit. */
  level?: import('./audit-levels').AuditLevel
}

export interface Audit {
  version: 6
  /** Optimistic concurrency token, assigned only by the persistence authority. */
  storageToken?: string
  /** Stable identifier: the same audit keeps it through renames, file saves and re-imports. */
  id: string
  name: string
  createdAt: number
  /** Last change made by the user. */
  updatedAt: number
  /** Value of `updatedAt` when the audit was last saved to a file; older than `updatedAt` = changes not in the file. */
  exportedAt?: number
  meta: AuditMeta
  pages: PageRecord[]
  current: string | null
}

/** Raw result of a scan for the element-based themes other than Images (frames, colours). */
export interface RawFinding {
  /** 'iframe' | 'frame' | 'contrast-fail' | 'contrast-unknown' | 'contrast-ok' */
  type: string
  /** Number used for the boxes drawn on the page during this scan. */
  id: number
  label: string
  summary: string
  facts: Record<string, string | null>
  html: string
  contextHtml: string
  /** How many page elements this finding stands for. */
  count: number
  /** Numbers used by the hints (colour ratios, sizes…). */
  data: Record<string, number | string | boolean | null>
}

/** A finding kept in the audit: stable key, display id, scan history. */
export interface FindingItem extends RawFinding {
  /** Small picture of the element, cropped from a screenshot of the page. */
  shot?: string | null
  theme: number
  key: string
  present: boolean
  scan: number
}

/** One line of the list of audits (kept apart so the list does not load every audit). */
export interface AuditSummary {
  id: string
  name: string
  site: string
  pages: number
  createdAt: number
  updatedAt: number
  exportedAt?: number
}
