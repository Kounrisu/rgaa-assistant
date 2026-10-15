import { computeThemes } from './results'
import { isSuggested } from './review-confirmation'
import type { PageRecord, ImageElementInfo } from './types'
import { criteriaFor, IMAGE_CRITERION_IDS } from './rgaa'
import { inLevel, type AuditLevel } from './audit-levels'
import { findingCriteriaOf, findingCriterionIds } from './findings'
import { themeByNumber } from './themes'

/** Includes answered positions so that answering does not lose the cursor. */
export interface ReviewTarget {
  key: string
  theme: number
  group: string
  itemId?: number
  kind: 'image' | 'finding' | 'criterion'
  pending: boolean
}
export function reviewQueue(page: PageRecord, level?: AuditLevel): ReviewTarget[] {
  const out: ReviewTarget[] = []
  const results = computeThemes(page.items, el => page.reviews[(el as ImageElementInfo & { key: string }).key], page.themes, page.checklist, { findings: page.findings, reviews: page.findingReviews, scannedThemes: page.scannedThemes, scanCoverage: page.scanCoverage }, level).themes
  const manual = new Set(results.flatMap(t => t.criteria.filter(c => c.manualReview).map(c => c.id)))
  const pending = (id: string) => !page.checklist[id]?.verdict || (manual.has(id) && page.checklist[id]?.coverageAt !== (page.scanCoverage?.at ?? 0))
  for (const theme of [...page.themes].sort((a, b) => a - b)) {
    if (theme === 1) {
      for (const item of page.items) {
        const r = page.reviews[item.key]
        out.push({ key: `image:${item.key}:kind`, theme, kind: 'image', itemId: item.id, group: `kind-${item.id}`, pending: !r?.kind })
        for (const c of r?.kind ? criteriaFor(r.kind, level) : []) out.push({ key: `image:${item.key}:${c.id}`, theme, kind: 'image', itemId: item.id, group: `crit-${item.id}-${c.id}`, pending: isSuggested(r, c.id) || r?.answers[c.id] === undefined })
      }
      // the questions no image answers (1.4, 1.5) close the Images page
      for (const c of themeByNumber(1)?.criteria ?? []) {
        if ((IMAGE_CRITERION_IDS.includes(c.id) && !manual.has(c.id)) || !inLevel(level, c.id)) continue
        out.push({ key: `criterion:${c.id}`, theme, kind: 'criterion', group: `chk-${c.id}`, pending: pending(c.id) })
      }
      continue
    }
    for (const item of page.findings.filter((f) => f.theme === theme && f.type !== 'contrast-ok')) {
      const r = page.findingReviews[item.key]
      for (const c of findingCriteriaOf(item, level)) out.push({ key: `finding:${item.key}:${c.id}`, theme, kind: 'finding', itemId: item.id, group: `fnd-${item.id}-${c.id}`, pending: isSuggested(r, c.id) || r?.answers[c.id] === undefined })
    }
    for (const c of themeByNumber(theme)?.criteria ?? []) {
      if ((findingCriterionIds(theme).includes(c.id) && !manual.has(c.id)) || !inLevel(level, c.id)) continue
      out.push({ key: `criterion:${c.id}`, theme, kind: 'criterion', group: `chk-${c.id}`, pending: pending(c.id) })
    }
  }
  return out
}
export function nextReviewTarget(queue: ReviewTarget[], after?: string): ReviewTarget | undefined {
  const index = after ? queue.findIndex((x) => x.key === after) : -1
  return [...queue.slice(index + 1), ...queue.slice(0, index + 1)].find((x) => x.pending)
}
