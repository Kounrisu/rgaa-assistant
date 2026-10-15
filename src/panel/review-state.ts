/**
 * What the reviews say: the status of an image or a finding, the list filters, and the colour code of the boxes on the page.
 * Reads the shared state; touches no DOM.
 */
import type { Item, Status, Filter, FStatus, FindingFilter } from './types'
import type { ImageReview, FindingItem } from '../lib/types'
import { state } from './state'
import { criteriaFor, detectedOf } from '../lib/rgaa'
import { t } from '../lib/i18n'
import { inActiveLevel } from '../lib/audit-levels'
import { findingCriteriaOf } from '../lib/findings'

export const reviewKey = (el: Item) => el.key

export function reviewOf(el: Item): ImageReview {
  return (state.reviews[reviewKey(el)] ??= { answers: {}, note: '' })
}

export function statusOf(el: Item): Status {
  const review = state.reviews[reviewKey(el)]
  if (!review?.kind) return 'todo'
  const applicable = criteriaFor(review.kind, state.audit.meta.level)
  const answers = applicable.map((c) => review.answers[c.id])
  if (!applicable.length) return 'todo' // none of its criteria belongs to this audit type
  if (answers.includes('nc')) return 'nc'
  if (answers.some((a) => a === undefined)) return 'progress'
  return 'c'
}

/** English labels: translate with t() where they are shown. */
export const STATUS_LABEL: Record<Status, string> = {
  todo: 'Not reviewed',
  progress: 'In progress',
  c: 'Compliant',
  nc: 'Non-compliant',
}

export function altLabel(el: Item): { text: string; missing: boolean } {
  const detected = detectedOf(el)
  if (detected === 'ignored') return { text: t('Ignored — {by}', { by: el.ignoredBy ?? '' }), missing: false }
  if (detected === 'unnamed') return { text: t('No text alternative'), missing: true }
  return { text: `“${el.accessibleName}”`, missing: false }
}

export function visibleElements(): Item[] {
  return state.elements.filter((el) => matches(el, state.filter))
}

/**
 * Still needs a human: no type chosen, a criterion unanswered (even when another one is already NC: one failure does not
 * finish the review of the other criteria), or answers pre-filled from the markup and not yet confirmed.
 * Same rule as `boxStates` and `findingNeedsReview`.
 */
export function needsReview(el: Item): boolean {
  const review = state.reviews[reviewKey(el)]
  if (!review?.kind) return true
  if (review.auto) return true
  return criteriaFor(review.kind, state.audit.meta.level).some((c) => review.answers[c.id] === undefined)
}

export function matches(el: Item, f: Filter): boolean {
  if (f === 'all') return true
  if (f === 'dialog') return el.inDialog
  if (f === 'gone') return !el.present
  if (f === 'review') return needsReview(el)
  if (f === 'prefilled') return Boolean(state.reviews[reviewKey(el)]?.auto)
  return detectedOf(el) === f
}

export function nextToReview(from: Item): Item | undefined {
  const list = state.elements.filter((e) => needsReview(e) && e.id !== from.id)
  return list.find((e) => e.id > from.id) ?? list[0]
}

/** Does the markup alone say this finding fails (no name, no title, no label, no header…)? One definition for the box colour and the list. */
export function findingFails(f: FindingItem): boolean {
  return (
    ['contrast-fail', 'link-empty', 'heading-empty', 'page-no-h1', 'page-no-main', 'table-nohead', 'table-layout-semantic', 'field-nolabel', 'field-placeholder'].includes(f.type) ||
    (f.theme === 2 && !f.facts.title?.trim()) ||
    (f.type.startsWith('widget-') && Number(f.data.fails ?? 0) > 0)
  )
}

/**
 * The colour code of the boxes on the page, from where each element's review stands:
 * error = no alternative / failing, review = still to judge, ignored = ignored by assistive tech,
 * c = reviewed and compliant, nc = reviewed and non-compliant.
 */
export function boxStates(themeNo: number): Record<number, string> {
  const out: Record<number, string> = {}
  if (themeNo === 1) {
    for (const el of state.elements) {
      const status = statusOf(el)
      const pending = needsReview(el)
      const detected = detectedOf(el)
      out[el.id] = !pending ? (status === 'nc' ? 'nc' : 'c') : detected === 'unnamed' ? 'error' : detected === 'ignored' ? 'ignored' : 'review'
    }
    return out
  }
  for (const f of state.page?.findings ?? []) {
    if (f.theme !== themeNo || f.type === 'contrast-ok') continue
    const pending = findingNeedsReview(f)
    const status = findingStatus(f)
    out[f.id] = !pending ? (status === 'nc' ? 'nc' : 'c') : findingFails(f) ? 'error' : 'review'
  }
  return out
}

export function findingReview(f: FindingItem): ImageReview {
  return (state.page!.findingReviews[f.key] ??= { answers: {}, note: '' })
}

export function findingStatus(f: FindingItem): FStatus {
  const answers = findingCriteriaOf(f, state.audit.meta.level).map((c) => state.page!.findingReviews[f.key]?.answers[c.id])
  if (answers.includes('nc')) return 'nc'
  if (answers.every((a) => a === undefined)) return 'todo'
  return answers.some((a) => a === undefined) ? 'progress' : 'c'
}

/** What the list shows: every finding, except the unnumbered “text that passes” line of Colours. */
export const listedFindings = (themeNo: number): FindingItem[] => (state.page?.findings ?? []).filter((f) => f.theme === themeNo && f.type !== 'contrast-ok')

/**
 * Needs a human: colours that failed or that the script could not judge, until the verdict is confirmed
 * (a pre-filled verdict does not count as confirmed). Frames: any criterion unanswered or still pre-filled.
 */
export function findingNeedsReview(f: FindingItem): boolean {
  const r = state.page?.findingReviews[f.key]
  if (f.theme === 3) {
    if (f.type !== 'contrast-fail' && f.type !== 'contrast-unknown') return false
    if (!inActiveLevel('3.2')) return false
    return !(r && r.answers['3.2'] !== undefined && !r.auto)
  }
  // a link with a usable name is pre-filled compliant and does not ask for attention; empty or generic ones do
  if (f.theme === 6 && (f.type === 'link' || f.type === 'link-skip')) return false
  if (f.theme === 9 && (f.type === 'heading' || f.type === 'landmark')) return false
  if (f.theme === 11 && f.type === 'field') return false
  if (f.theme === 5 && (f.type === 'table-layout' || (f.type === 'table-data' && !f.facts.Title))) return false
  const ids = findingCriteriaOf(f, state.audit.meta.level).map((c) => c.id)
  return ids.some((c) => r?.answers[c] === undefined) || Boolean(r?.auto)
}

export function findingMatches(f: FindingItem, value: FindingFilter): boolean {
  if (value === 'all') return true
  if (value === 'review') return findingNeedsReview(f)
  if (value === 'hidden') return Boolean(f.data.hidden)
  if (value === 'link-skip') return f.type === 'link-skip' || f.type === 'link-skip-broken'
  if (value === 'headings') return f.data.group === 'heading'
  if (value === 'landmarks') return f.data.group === 'landmark'
  if (value === 'widget-fail') return findingFails(f)
  return f.type === value
}
