/**
 * The page of the sample in use: its label, the input of the results computation, loading it into the shared state,
 * and persist(), called after any change so the audit is saved.
 */
import { state } from './state'
import { pushStates } from './page-bridge'
import type { PageRecord, ImageElementInfo } from '../lib/types'
import { pad, hostName } from './helpers'
import type { PageInput } from '../lib/audit-sheet'
import type { Item } from './types'
import { computeThemes } from '../lib/results'
import { detectedOf } from '../lib/rgaa'
import { setActiveLevel } from '../lib/audit-levels'

export function persist(): void {
  const now = Date.now()
  if (state.page) {
    state.page.scanCount = state.scanCount
    state.page.updatedAt = now
  }
  state.audit.updatedAt = now
  state.session.markDirty()
  pushStates()
}

export const saveReviews = persist

/** P01, P02… follow the order of the sample, so reordering renumbers the pages. */
export const pageLabel = (rec: PageRecord) => `P${pad(state.audit.pages.indexOf(rec) + 1)}`

export function pageInput(rec: PageRecord): PageInput {
  setActiveLevel(state.audit.meta.level)
  const reviewOfRec = (el: ImageElementInfo) => rec.reviews[(el as Item).key]
  const computed = computeThemes(rec.items, reviewOfRec, rec.themes, rec.checklist, { findings: rec.findings, reviews: rec.findingReviews, scannedThemes: rec.scannedThemes, scanCoverage: rec.scanCoverage }, state.audit.meta.level)
  return {
    label: pageLabel(rec),
    results: computed.images,
    themes: computed.themes,
    checklist: rec.checklist,
    findings: rec.findings,
    findingReviews: rec.findingReviews,
    images: rec.items,
    reviewOf: reviewOfRec,
    detectedOf,
    pageUrl: rec.url,
    pageTitle: rec.title || rec.url,
    manualChecks: rec.manualChecks,
  }
}

export const allPageInputs = (): PageInput[] => state.audit.pages.map(pageInput)

/** The theme shown must be one of the page's themes: when it is not, the first of them is shown. Call it where the page or its themes change, never from a render. */
export function normalizeTheme(): void {
  const themes = state.page ? [...state.page.themes].sort((a, b) => a - b) : []
  if (state.page && !themes.includes(state.theme)) state.theme = themes[0] ?? 1
}

export function loadPage(rec: PageRecord | null): void {
  if (rec !== state.page) state.reviewCursor = undefined
  state.page = rec
  state.elements = rec ? rec.items : []
  state.reviews = rec ? rec.reviews : {}
  state.scanCount = rec ? rec.scanCount : 0
  state.selectedId = state.elements[0]?.id ?? null
  state.filter = 'all'
  state.audit.current = rec ? rec.id : null
  // Images of a page that was not scanned in this session are shown as they were last seen.
  if (rec && !state.scannedThisSession.has(rec.id)) for (const el of state.elements) el.present = true
  normalizeTheme()
}

export function nextPageLabel(): string {
  return `P${pad(state.audit.pages.length + 1)}`
}

/** The first page registered gives the audit its site, and its name while it still has the placeholder one. */
export function adoptSite(url: string): void {
  const host = hostName(url)
  if (!host) return
  if (!state.audit.meta.site.trim()) state.audit.meta.site = host
  if (!state.audit.name.trim() || state.audit.name === 'Untitled audit' || state.audit.name === 'Audit sans titre') state.audit.name = state.audit.meta.site
}
