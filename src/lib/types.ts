export interface ImageElementInfo {
  id: number
  tag: string
  /** img, svg, canvas, input-image, area, object, embed, or "role-img (div)". */
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
}

export type ImageKind = 'informative' | 'decorative'
export type Verdict = 'c' | 'nc' | 'na'

export interface ImageReview {
  kind?: ImageKind
  answers: Record<string, Verdict>
  note: string
  /** Pre-filled from the markup; cleared as soon as the user touches the answer. */
  auto?: boolean
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
  verdict?: ChecklistVerdict
  note: string
}

export interface PageRecord {
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
}

export interface AuditMeta {
  site: string
  auditor: string
  context: string
}

export interface Audit {
  version: 2
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
