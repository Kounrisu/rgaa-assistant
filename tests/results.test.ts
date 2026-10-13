import { describe, expect, it } from 'vitest'
import { checklistOutcome, computeTheme1, computeThemes, rollUp, statusOf } from '../src/lib/results'
import { auditStats, isProvisional, type PageInput } from '../src/lib/audit-sheet'
import type { ImageElementInfo, ImageReview } from '../src/lib/types'

const img = (id: number): ImageElementInfo => ({ id, type: 'img', tag: 'img', src: `a${id}.png` }) as ImageElementInfo

describe('rollUp: verdict and coverage are independent', () => {
  it('C + unassessed is compliant on the assessed tests only, with partial coverage', () => {
    const r = rollUp(['c', 'na', 'unassessed'])
    expect(r).toMatchObject({ outcome: 'c', coverage: 'partial', assessedTests: 2, unassessedTests: 1 })
    // the verdict is kept (the auditor cannot confirm tests this tool never assesses); the coverage flag makes rates provisional
    expect(statusOf(r)).toBe('C')
    expect(isProvisional({ C: 1, NC: 0, NA: 0, NT: 0, partial: 1, suggested: 0, unconfirmed: 0 })).toBe(true)
  })
  it('NC + unassessed keeps the failure and the incomplete coverage', () => {
    const r = rollUp(['nc', 'c', 'unassessed'])
    expect(r.outcome).toBe('nc')
    expect(r.coverage).toBe('partial')
    expect(statusOf(r)).toBe('NC')
  })
  it('fully assessed C / NA combinations aggregate as before', () => {
    expect(rollUp(['c', 'na', 'c'])).toMatchObject({ outcome: 'c', coverage: 'full' })
    expect(statusOf(rollUp(['c', 'na']))).toBe('C')
    expect(rollUp(['na', 'na'])).toMatchObject({ outcome: 'na', coverage: 'full' })
    expect(statusOf(rollUp(['na']))).toBe('NA')
    expect(rollUp(['c', 'pending']).outcome).toBe('pending')
  })
  it('only unassessed tests: nothing is assessed', () => {
    const r = rollUp(['unassessed', 'unassessed'])
    expect(r).toMatchObject({ outcome: 'unassessed', coverage: 'none' })
    expect(statusOf(r)).toBe('NT')
  })
})

describe('theme 1 aggregation', () => {
  const reviews: Record<number, ImageReview> = { 1: { kind: 'informative', answers: { '1.1': 'c' }, note: '' } }
  it('a compliant image still leaves 1.1 partly covered (server-side image maps are not assessed)', () => {
    const res = computeTheme1([img(1)], (el) => reviews[el.id])
    const c11 = res.criteria.find((c) => c.id === '1.1')!
    expect(c11.outcome).toBe('c')
    expect(c11.coverage).toBe('partial')
    expect(statusOf(c11)).toBe('C') // kept, but flagged: the rate that counts it is provisional
  })
  it('a non-compliant image stays NC with partial coverage', () => {
    const bad: Record<number, ImageReview> = { 1: { kind: 'informative', answers: { '1.1': 'nc' }, note: '' } }
    const c11 = computeTheme1([img(1)], (el) => bad[el.id]).criteria.find((c) => c.id === '1.1')!
    expect(c11.outcome).toBe('nc')
    expect(c11.coverage).toBe('partial')
    expect(statusOf(c11)).toBe('NC')
  })
  it('a pre-filled (auto) per-element verdict is flagged unconfirmed', () => {
    const auto: Record<number, ImageReview> = { 1: { kind: 'informative', answers: { '1.1': 'nc' }, note: '', auto: true } }
    expect(computeTheme1([img(1)], (el) => auto[el.id]).criteria.find((c) => c.id === '1.1')!.unconfirmed).toBe(true)
  })
})

describe('checklist criteria and suggestions', () => {
  it('an automatic pass alone is pending, with the suggestion attached', () => {
    const r = checklistOutcome({ note: '', suggested: 'c', source: 'axe', autoResults: { axe: { result: 'pass', rules: ['x'] } } })
    expect(r).toMatchObject({ outcome: 'pending', suggested: 'c' })
  })
  it('a suggested failure is kept as a known, unconfirmed failure', () => {
    expect(checklistOutcome({ note: '', suggested: 'nc', source: 'axe' })).toMatchObject({ outcome: 'nc', unconfirmed: true })
  })
  it('a human verdict wins and conflicting evidence stays visible', () => {
    const r = checklistOutcome({ note: '', verdict: 'c', suggested: 'nc', autoResults: { axe: { result: 'fail', rules: ['r'] } } })
    expect(r.outcome).toBe('c')
    expect(r.unconfirmed).toBeUndefined()
    expect(r.conflicts?.length).toBeGreaterThan(0)
  })
})

describe('counts and provisional rates', () => {
  const page = (checklist: Parameters<typeof computeThemes>[3]): PageInput => {
    const computed = computeThemes([], () => undefined, [8], checklist)
    return { label: 'P01', results: computed.images, themes: computed.themes, checklist, findings: [], findingReviews: {}, images: [], reviewOf: () => undefined, detectedOf: () => 'named', pageUrl: 'https://x.test/', pageTitle: 'X' }
  }
  it('suggested compliance is not counted as C and is reported as to confirm', () => {
    const stat = auditStats([page({ '8.5': { note: '', suggested: 'c', source: 'axe' } })]).perPage[0]
    expect(stat.counts.C).toBe(0)
    expect(stat.counts.suggested).toBe(1)
    expect(stat.rate).toBeNull()
  })
  it('a confirmed verdict counts; the rate stays provisional while criteria are untested', () => {
    const stat = auditStats([page({ '8.5': { note: '', verdict: 'c' } })]).perPage[0]
    expect(stat.counts.C).toBe(1)
    expect(stat.rate).toBe(100)
    expect(isProvisional(stat.counts)).toBe(true) // the other criteria of the theme are still untested
  })
  it('a rate resting on an unconfirmed failure is provisional even with nothing untested', () => {
    expect(isProvisional({ C: 1, NC: 1, NA: 0, NT: 0, partial: 0, suggested: 0, unconfirmed: 1 })).toBe(true)
    expect(isProvisional({ C: 1, NC: 1, NA: 0, NT: 0, partial: 0, suggested: 0, unconfirmed: 0 })).toBe(false)
  })
})

describe('icon fonts are images for the RGAA', () => {
  it('normalisedType: an icon font is covered by the tests written for role="img"', async () => {
    const { normalisedType } = await import('../src/lib/results')
    const el = (type: string) => ({ type }) as ImageElementInfo
    expect(normalisedType(el('icon-font (span)'))).toBe('role-img')
    expect(normalisedType(el('icon-font (i)'))).toBe('role-img')
    expect(normalisedType(el('role-img (svg)'))).toBe('svg')
    expect(normalisedType(el('img'))).toBe('img')
  })
})
