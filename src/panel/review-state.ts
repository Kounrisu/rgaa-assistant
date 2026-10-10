import type { Item, Status, Filter, FStatus, FindingFilter } from './types'
import type { ImageReview, FindingItem } from '../lib/types'
import { state } from './state'
import { criteriaFor, detectedOf } from '../lib/rgaa'
import { t } from '../lib/i18n'
import { findingCriteriaOf } from '../lib/findings'

export const reviewKey = (el: Item) => el.key

export function reviewOf(el: Item): ImageReview {
  return (state.reviews[reviewKey(el)] ??= { answers: {}, note: '' })
}

export function statusOf(el: Item): Status {
  const review = state.reviews[reviewKey(el)]
  if (!review?.kind) return 'todo'
  const applicable = criteriaFor(review.kind)
  const answers = applicable.map((c) => review.answers[c.id])
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

/** Present on the page but not fully answered: no type chosen, or a criterion still unanswered. */
export function needsReview(el: Item): boolean {
  const status = statusOf(el)
  return status === 'todo' || status === 'progress'
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
      const pending = status === 'todo' || status === 'progress' || Boolean(state.reviews[reviewKey(el)]?.auto)
      const detected = detectedOf(el)
      out[el.id] = !pending ? (status === 'nc' ? 'nc' : 'c') : detected === 'unnamed' ? 'error' : detected === 'ignored' ? 'ignored' : 'review'
    }
    return out
  }
  for (const f of state.page?.findings ?? []) {
    if (f.theme !== themeNo || f.type === 'contrast-ok') continue
    const pending = findingNeedsReview(f)
    const status = findingStatus(f)
    const failing = f.type === 'contrast-fail' || f.type === 'link-empty' || f.type === 'heading-empty' || f.type === 'page-no-h1' || f.type === 'page-no-main' || f.type === 'table-nohead' || f.type === 'table-layout-semantic' || f.type === 'field-nolabel' || f.type === 'field-placeholder' || (themeNo === 2 && !f.facts.title?.trim())
    out[f.id] = !pending ? (status === 'nc' ? 'nc' : 'c') : failing ? 'error' : 'review'
  }
  return out
}

export function findingReview(f: FindingItem): ImageReview {
  return (state.page!.findingReviews[f.key] ??= { answers: {}, note: '' })
}

export function findingStatus(f: FindingItem): FStatus {
  const answers = findingCriteriaOf(f).map((c) => state.page!.findingReviews[f.key]?.answers[c.id])
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
    return !(r && r.answers['3.2'] !== undefined && !r.auto)
  }
  // a link with a usable name is pre-filled compliant and does not ask for attention; empty or generic ones do
  if (f.theme === 6 && (f.type === 'link' || f.type === 'link-skip')) return false
  if (f.theme === 9 && (f.type === 'heading' || f.type === 'landmark')) return false
  if (f.theme === 11 && f.type === 'field') return false
  if (f.theme === 5 && (f.type === 'table-layout' || (f.type === 'table-data' && !f.facts.Title))) return false
  const ids = findingCriteriaOf(f).map((c) => c.id)
  return ids.some((c) => r?.answers[c] === undefined) || Boolean(r?.auto)
}

export function findingMatches(f: FindingItem, value: FindingFilter): boolean {
  if (value === 'all') return true
  if (value === 'review') return findingNeedsReview(f)
  if (value === 'hidden') return Boolean(f.data.hidden)
  if (value === 'link-skip') return f.type === 'link-skip' || f.type === 'link-skip-broken'
  if (value === 'headings') return f.data.group === 'heading'
  if (value === 'landmarks') return f.data.group === 'landmark'
  return f.type === value
}
