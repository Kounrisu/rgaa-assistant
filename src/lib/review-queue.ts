import type { PageRecord } from './types'
import { criteriaFor } from './rgaa'
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
export function reviewQueue(page: PageRecord): ReviewTarget[] {
  const out: ReviewTarget[] = []
  for (const theme of [...page.themes].sort((a, b) => a - b)) {
    if (theme === 1) {
      for (const item of page.items) {
        const r = page.reviews[item.key]
        out.push({ key: `image:${item.key}:kind`, theme, kind: 'image', itemId: item.id, group: `kind-${item.id}`, pending: !r?.kind })
        for (const c of r?.kind ? criteriaFor(r.kind) : []) out.push({ key: `image:${item.key}:${c.id}`, theme, kind: 'image', itemId: item.id, group: `crit-${item.id}-${c.id}`, pending: Boolean(r?.auto) || r?.answers[c.id] === undefined })
      }
      continue
    }
    for (const item of page.findings.filter((f) => f.theme === theme && f.type !== 'contrast-ok')) {
      const r = page.findingReviews[item.key]
      for (const c of findingCriteriaOf(item)) out.push({ key: `finding:${item.key}:${c.id}`, theme, kind: 'finding', itemId: item.id, group: `fnd-${item.id}-${c.id}`, pending: Boolean(r?.auto) || r?.answers[c.id] === undefined })
    }
    for (const c of themeByNumber(theme)?.criteria ?? []) {
      if (findingCriterionIds(theme).includes(c.id)) continue
      out.push({ key: `criterion:${c.id}`, theme, kind: 'criterion', group: `chk-${c.id}`, pending: !page.checklist[c.id]?.verdict })
    }
  }
  return out
}
export function nextReviewTarget(queue: ReviewTarget[], after?: string): ReviewTarget | undefined {
  const index = after ? queue.findIndex((x) => x.key === after) : -1
  return [...queue.slice(index + 1), ...queue.slice(0, index + 1)].find((x) => x.pending)
}
