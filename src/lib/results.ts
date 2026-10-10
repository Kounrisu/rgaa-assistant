import { t as tr } from './i18n'
import theme1 from './rgaa-theme1.json'
import { THEMES } from './themes'
import { FINDING_CRITERIA } from './findings'
import type { ChecklistAnswer, FindingItem, ImageElementInfo, ImageKind, ImageReview } from './types'

export type Outcome = 'c' | 'nc' | 'na' | 'pending' | 'unassessed'

export const OUTCOME_LABEL: Record<Outcome, string> = {
  c: 'Compliant',
  nc: 'Non-compliant',
  na: 'Not applicable',
  pending: 'To review',
  unassessed: 'Not assessed',
}

/** Image kinds a criterion is answered for in this extension. */
const CRITERION_KIND: Record<string, ImageKind> = {
  '1.1': 'informative',
  '1.2': 'decorative',
  '1.3': 'informative',
  '1.6': 'informative',
  '1.7': 'informative',
  '1.8': 'informative',
  '1.9': 'informative',
}

const UNASSESSED_REASON = {
  captcha: 'CAPTCHAs and test images are not covered by this extension yet.',
  imagemap: 'Server-side image maps (ismap) are not detected.',
  fallback: 'Canvas fallback content is not assessed separately.',
  concise: 'Conciseness is part of your 1.3 verdict on each image.',
  reference: 'The reference to a detailed description is not assessed separately.',
} as const

type Scope = string[] | keyof typeof UNASSESSED_REASON

/** Which element types each test covers (normalised types), or why it is not assessed. */
const SCOPE: Record<string, Scope> = {
  '1.1.1': ['img', 'role-img'], '1.1.2': ['area'], '1.1.3': ['input-image'], '1.1.4': 'imagemap',
  '1.1.5': ['svg'], '1.1.6': ['object'], '1.1.7': ['embed'], '1.1.8': ['canvas'],
  '1.2.1': ['img'], '1.2.2': ['area'], '1.2.3': ['object'], '1.2.4': ['svg'], '1.2.5': ['canvas'], '1.2.6': ['embed'],
  '1.3.1': ['img', 'role-img'], '1.3.2': ['area'], '1.3.3': ['input-image'], '1.3.4': ['object'], '1.3.5': ['embed'],
  '1.3.6': ['svg'], '1.3.7': ['canvas'], '1.3.8': 'fallback', '1.3.9': 'concise',
  '1.4.1': 'captcha', '1.4.2': 'captcha', '1.4.3': 'captcha', '1.4.4': 'captcha', '1.4.5': 'captcha', '1.4.6': 'captcha', '1.4.7': 'captcha',
  '1.5.1': 'captcha', '1.5.2': 'captcha',
  '1.6.1': ['img'], '1.6.2': ['object'], '1.6.3': ['embed'], '1.6.4': ['input-image'], '1.6.5': ['svg'], '1.6.6': 'reference',
  '1.6.7': ['canvas'], '1.6.8': 'reference', '1.6.9': 'reference', '1.6.10': ['role-img'],
  '1.7.1': ['img'], '1.7.2': ['input-image'], '1.7.3': ['object'], '1.7.4': ['embed'], '1.7.5': ['svg'], '1.7.6': ['canvas'],
  '1.8.1': ['img', 'role-img'], '1.8.2': ['input-image'], '1.8.3': ['object'], '1.8.4': ['embed'], '1.8.5': ['canvas'], '1.8.6': ['svg'],
  '1.9.1': ['img', 'input-image', 'role-img'], '1.9.2': ['object'], '1.9.3': ['embed'], '1.9.4': ['svg'], '1.9.5': ['canvas'],
}

/** Collapses "role-img (svg)" etc. onto the element the RGAA test is written for. */
export function normalisedType(el: ImageElementInfo): string {
  const m = /^role-img \((\w+)\)$/.exec(el.type)
  if (!m) return el.type
  return ['svg', 'canvas', 'object', 'embed', 'img'].includes(m[1]) ? m[1] : 'role-img'
}

export interface TestResult {
  id: string
  text: string
  outcome: Outcome
  scope: string[] | null
  reason: string
  imageIds: number[]
  nc: number[]
}
export interface CriterionResult {
  id: string
  title: string
  outcome: Outcome
  tests: TestResult[]
  /** Non-compliant findings with their notes (frames, colours). */
  ncRefs?: { id: number; label: string; note: string }[]
}
export interface Theme1Results {
  criteria: CriterionResult[]
  rate: number | null
  counts: Record<Outcome, number>
}

function testOutcome(
  testId: string,
  images: ImageElementInfo[],
  reviewOf: (el: ImageElementInfo) => ImageReview | undefined,
): Pick<TestResult, 'outcome' | 'reason' | 'imageIds' | 'nc' | 'scope'> {
  const scope = SCOPE[testId]
  if (!Array.isArray(scope)) return { outcome: 'unassessed', reason: tr(UNASSESSED_REASON[scope]), imageIds: [], nc: [], scope: null }

  const criterion = testId.split('.').slice(0, 2).join('.')
  const kind = CRITERION_KIND[criterion]
  const inScope = images.filter((el) => scope.includes(normalisedType(el)))
  if (!inScope.length) return { outcome: 'na', reason: tr('No such element on the page.'), imageIds: [], nc: [], scope }

  const nc: number[] = []
  const answered: number[] = []
  let pending = 0
  let compliant = 0
  for (const el of inScope) {
    const review = reviewOf(el)
    if (!review?.kind) {
      pending++
      continue
    }
    if (review.kind !== kind) continue // this criterion does not apply to this image
    const verdict = review.answers[criterion]
    if (!verdict) pending++
    else {
      answered.push(el.id)
      if (verdict === 'nc') nc.push(el.id)
      if (verdict === 'c') compliant++
    }
  }
  const imageIds = inScope.map((e) => e.id)
  if (nc.length) return { outcome: 'nc', reason: tr('{n} non-compliant image(s).', { n: nc.length }), imageIds, nc, scope }
  if (pending) return { outcome: 'pending', reason: tr('{n} image(s) still to review.', { n: pending }), imageIds, nc, scope }
  if (compliant) return { outcome: 'c', reason: tr('{n} image(s) checked.', { n: compliant }), imageIds, nc, scope }
  return { outcome: 'na', reason: tr('No image of this kind concerned by the test.'), imageIds, nc, scope }
}

function rollUp(outcomes: Outcome[]): Outcome {
  if (outcomes.includes('nc')) return 'nc'
  if (outcomes.includes('pending')) return 'pending'
  if (outcomes.includes('c')) return 'c'
  if (outcomes.includes('na')) return 'na'
  return 'unassessed'
}

export function computeTheme1(
  images: ImageElementInfo[],
  reviewOf: (el: ImageElementInfo) => ImageReview | undefined,
): Theme1Results {
  const present = images
  const criteria: CriterionResult[] = theme1.criteria.map((c) => {
    const tests = c.tests.map((t) => ({ id: t.id, text: t.text, ...testOutcome(t.id, present, reviewOf) }))
    return { id: c.id, title: c.title, outcome: rollUp(tests.map((t) => t.outcome)), tests }
  })
  const counts: Record<Outcome, number> = { c: 0, nc: 0, na: 0, pending: 0, unassessed: 0 }
  for (const c of criteria) counts[c.outcome]++
  const decided = counts.c + counts.nc
  return { criteria, counts, rate: decided ? Math.round((counts.c / decided) * 100) : null }
}

/** The official test number of `criterion` that covers this element type, e.g. 1.1.1 for an <img>. */
export function testIdFor(criterion: string, el: ImageElementInfo): string | null {
  const type = normalisedType(el)
  for (const [id, scope] of Object.entries(SCOPE)) {
    if (id.startsWith(`${criterion}.`) && Array.isArray(scope) && scope.includes(type)) return id
  }
  return null
}

/* ------------------------------------------------------------------ */
/* All themes                                                          */
/* ------------------------------------------------------------------ */

export interface ThemeResult {
  number: number
  name: string
  selected: boolean
  criteria: CriterionResult[]
}

/**
 * Results of every RGAA theme for one page. Images (theme 1) comes from the per-image reviews,
 * the other themes from the checklist. Themes that are not audited on this page are "not assessed".
 */
export interface FindingInputs {
  findings: FindingItem[]
  reviews: Record<string, ImageReview>
  scannedThemes: number[]
}

/** Outcome of one criterion over the findings of a theme. Never scanned means undecided. */
function findingOutcome(theme: number, criterion: string, input: FindingInputs): Pick<CriterionResult, 'outcome' | 'ncRefs'> {
  if (!input.scannedThemes.includes(theme)) return { outcome: 'pending' }
  const def = (FINDING_CRITERIA[theme] ?? []).find((c) => c.id === criterion)
  const list = input.findings.filter((f) => f.theme === theme && (!def?.types || def.types.includes(f.type)))
  if (!list.length) return { outcome: 'na' }
  let pending = 0
  let compliant = 0
  const ncRefs: { id: number; label: string; note: string }[] = []
  for (const f of list) {
    const verdict = input.reviews[f.key]?.answers[criterion]
    if (!verdict) pending++
    else if (verdict === 'nc') ncRefs.push({ id: f.id, label: f.label, note: input.reviews[f.key]?.note?.trim() ?? '' })
    else if (verdict === 'c') compliant++
  }
  if (ncRefs.length) return { outcome: 'nc', ncRefs }
  if (pending) return { outcome: 'pending' }
  return { outcome: compliant ? 'c' : 'na' }
}

/**
 * Results of every RGAA theme for one page. Images (1) comes from the per-image reviews, frames (2) and
 * colours (3.2) from the per-finding reviews, the rest from the checklist. Themes that are not audited on
 * this page are "not assessed".
 */
export function computeThemes(
  images: ImageElementInfo[],
  reviewOf: (el: ImageElementInfo) => ImageReview | undefined,
  selected: number[],
  checklist: Record<string, ChecklistAnswer>,
  fi: FindingInputs = { findings: [], reviews: {}, scannedThemes: [] },
): { themes: ThemeResult[]; images: Theme1Results } {
  const imageResults = computeTheme1(images, reviewOf)
  const themes = THEMES.map((theme): ThemeResult => {
    const isSelected = selected.includes(theme.number)
    if (theme.number === 1) {
      return {
        number: 1,
        name: theme.name,
        selected: isSelected,
        // never scanned: nothing can be called "not applicable" yet
        criteria: imageResults.criteria.map((c) =>
          !isSelected ? { ...c, outcome: 'unassessed' as Outcome, tests: [] } : !fi.scannedThemes.includes(1) && c.outcome === 'na' ? { ...c, outcome: 'pending' as Outcome } : c,
        ),
      }
    }
    const perFinding = (FINDING_CRITERIA[theme.number] ?? []).map((c) => c.id)
    return {
      number: theme.number,
      name: theme.name,
      selected: isSelected,
      criteria: theme.criteria.map((c) => {
        if (!isSelected) return { id: c.id, title: c.title, outcome: 'unassessed' as Outcome, tests: [] }
        if (perFinding.includes(c.id)) return { id: c.id, title: c.title, tests: [], ...findingOutcome(theme.number, c.id, fi) }
        const verdict = checklist[c.id]?.verdict
        return { id: c.id, title: c.title, outcome: (verdict ?? 'pending') as Outcome, tests: [] }
      }),
    }
  })
  return { themes, images: imageResults }
}
