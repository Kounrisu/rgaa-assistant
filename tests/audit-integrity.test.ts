// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { createPage, emptyAudit, loadAuditById, parseAudit } from '../src/lib/audit-store'
import { auditSheets, auditStats, pageSheets, type PageInput } from '../src/lib/audit-sheet'
import { buildReportHtml } from '../src/lib/report'
import { computeThemes } from '../src/lib/results'
import { confirmAnswer, isSuggested, suggestAnswer } from '../src/lib/review-confirmation'
import { reviewQueue } from '../src/lib/review-queue'
import { createPersistence } from '../src/lib/persistence'
import { setLang } from '../src/lib/i18n'
import { setActiveLevel } from '../src/lib/audit-levels'
import type { Audit, ImageReview, PageRecord } from '../src/lib/types'
import type { ScanCoverage } from '../src/lib/scan-coverage'
import { FakeStorage, installChrome, sampleAudit } from './fakes'

const coverage = (): ScanCoverage => ({ at: 12, frames: { total: 1, sameOrigin: 0, crossOrigin: 1 }, openShadowRoots: 1, closedShadowRoots: 'unknown', truncated: [], notes: [] })
const input = (audit: Audit, page = audit.pages[0]): PageInput => {
  const reviewOf = (el: { id: number }) => page.reviews[page.items.find(i => i.id === el.id)!.key]
  const result = computeThemes(page.items, reviewOf, page.themes, page.checklist, { findings: page.findings, reviews: page.findingReviews, scannedThemes: page.scannedThemes, scanCoverage: page.scanCoverage }, audit.meta.level)
  return { label: page.id, pageTitle: page.title, pageUrl: page.url, results: result.images, themes: result.themes, images: page.items, reviewOf, detectedOf: () => 'named', checklist: page.checklist, findings: page.findings, findingReviews: page.findingReviews }
}
const criterion = (a: Audit, id: string) => input(a).themes.flatMap(t => t.criteria).find(c => c.id === id)!

beforeEach(() => { installChrome(new FakeStorage()); setLang('en'); setActiveLevel('complet') })

describe('criterion-specific confirmation', () => {
  it('one answer leaves other suggestions pending in results and review navigation', () => {
    const a = sampleAudit()
    const p = a.pages[0]
    p.scannedThemes = [2]
    const r = p.findingReviews['f-1'] = { answers: { '2.1': 'c', '2.2': 'c' }, auto: true, note: '' } satisfies ImageReview
    confirmAnswer(r, '2.1')
    expect(isSuggested(r, '2.1')).toBe(false)
    expect(isSuggested(r, '2.2')).toBe(true)
    expect(criterion(a, '2.1').unconfirmed).toBeFalsy()
    expect(criterion(a, '2.2').unconfirmed).toBe(true)
    expect(reviewQueue(p).filter(t => t.kind === 'finding').map(t => t.pending)).toEqual([false, true])
    confirmAnswer(r, '2.2')
    expect(r.auto).toBe(false)
  })
  it('a later suggestion does not reclassify existing human answers', () => {
    const r: ImageReview = { answers: { '2.1': 'c' }, note: '' }
    suggestAnswer(r, '2.2', 'nc')
    expect(isSuggested(r, '2.1')).toBe(false)
    expect(isSuggested(r, '2.2')).toBe(true)
    confirmAnswer(r, '2.2')
    suggestAnswer(r, '2.2', 'c')
    expect(isSuggested(r, '2.2')).toBe(true)
  })
  it('migrates v4 suggestions without granting new confirmations and validates new fields', () => {
    const raw = sampleAudit() as unknown as Record<string, unknown>
    raw.version = 4
    const p = (raw.pages as PageRecord[])[0]
    p.reviews['img-1'].auto = true
    const a = parseAudit(raw)
    expect(a.version).toBe(5)
    expect(a.storageToken).toBe(`legacy:${a.id}`)
    expect(a.pages[0].reviews['img-1'].pendingAnswers).toEqual(['1.1', '1.2'])
    expect(parseAudit(JSON.parse(JSON.stringify(a)))).toEqual(a)
    ;(a.pages[0].reviews['img-1'] as unknown as Record<string, unknown>).pendingAnswers = [42]
    expect(() => parseAudit(a)).toThrow()
  })
})

describe('scan absence and omitted content', () => {
  it('explicit NA answers on detected elements do not need a second applicability decision', () => {
    const a = sampleAudit(); const p = a.pages[0]
    p.scannedThemes = [1, 2]
    p.reviews['img-1'].answers['1.8'] = 'na'
    p.findingReviews['f-1'] = { answers: { '2.1': 'na', '2.2': 'na' }, note: 'Human assessment' }
    expect(criterion(a, '2.1')).toMatchObject({ outcome: 'na', coverage: 'full' })
    expect(criterion(a, '2.1').manualReview).toBeUndefined()
    expect(criterion(a, '1.8').manualReview).toBeUndefined()
  })
  it('empty image and frame scans suggest NA until the auditor explicitly confirms the scope', () => {
    const a = emptyAudit(); const p = createPage(a, 'https://x.test', 'X')
    p.scannedThemes = [1, 2]
    for (const id of ['1.1', '1.2', '2.1', '2.2']) {
      expect(criterion(a, id)).toMatchObject({ outcome: 'pending', suggested: 'na', coverage: 'partial', manualReview: true })
      expect(reviewQueue(p).find(t => t.key === `criterion:${id}`)?.pending).toBe(true)
      p.checklist[id] = { verdict: 'na', note: 'Whole page checked', coverageAt: 0 }
      expect(criterion(a, id)).toMatchObject({ outcome: 'na', coverage: 'full' })
    }
  })
  it.each(['frames', 'shadow', 'truncated'] as const)('%s gaps block a complete result, retain failures and expire manual decisions on rescan', gap => {
    const a = sampleAudit(); const p = a.pages[0]
    p.scannedThemes = [1, 2]
    p.scanCoverage = { ...coverage(), frames: { total: gap === 'frames' ? 1 : 0, sameOrigin: 0, crossOrigin: 0 }, openShadowRoots: gap === 'shadow' ? 1 : 0, truncated: gap === 'truncated' ? [{ what: 'links', shown: 10, total: 20 }] : [] }
    p.findingReviews['f-1'] = { answers: { '2.1': 'c', '2.2': 'nc' }, note: '' }
    expect(criterion(a, '2.1')).toMatchObject({ outcome: 'pending', coverage: 'partial' })
    expect(criterion(a, '2.2')).toMatchObject({ outcome: 'nc', coverage: 'partial' })
    p.checklist['2.1'] = { verdict: 'c', note: 'Frames checked manually', coverageAt: 12 }
    p.checklist['2.2'] = { verdict: 'na', note: '', coverageAt: 12 }
    expect(criterion(a, '2.1')).toMatchObject({ outcome: 'c', coverage: 'full' })
    expect(criterion(a, '2.2').outcome).toBe('nc')
    p.scanCoverage.at++
    expect(criterion(a, '2.1')).toMatchObject({ outcome: 'pending', coverage: 'partial' })
  })
})

describe('export eligibility', () => {
  it.each(['rapide', 'complementaire'] as const)('%s exports counts without a rate or a draft statement', level => {
    const a = sampleAudit(); a.meta.level = level
    const p = input(a)
    for (const sheets of [auditSheets([p], a.meta), pageSheets(p, level)]) {
      const summary = JSON.stringify(sheets.filter(s => ['Résultats', 'Synthèse'].includes(s.name)))
      expect(summary).toContain('Diagnostic partiel')
      expect(summary).not.toMatch(/\d+(?:[.,]\d+)?\s*%|AA \(Légal\)/)
    }
    const html = buildReportHtml(a, [p], a.pages)
    expect(html).toContain('Diagnostic results only')
    expect(html).not.toContain('Draft accessibility statement')
    expect(html).not.toContain('The audited content is')
  })
  it('an incomplete full audit cannot assert total conformity or draft a statement', () => {
    const a = sampleAudit(); const p = input(a)
    expect(auditStats([p]).perPage[0].counts.NT).toBeGreaterThan(0)
    const html = buildReportHtml(a, [p], a.pages)
    expect(html).not.toContain('totally compliant')
    expect(html).not.toContain('Draft accessibility statement')
  })
  it('a full, reviewed set of criteria can produce a draft, but a hidden pending page blocks it', () => {
    const a = sampleAudit(); const p = input(a)
    p.themes = p.themes.map(th => ({ ...th, selected: true, criteria: th.criteria.map(c => ({ ...c, outcome: 'c', coverage: 'full', unconfirmed: false, conflicts: [] })) }))
    expect(buildReportHtml(a, [p], a.pages)).toContain('Draft accessibility statement')
    const second = structuredClone(a.pages[0]); second.id = 'P02'; a.pages.push(second)
    expect(buildReportHtml(a, [p, input(a, second)], a.pages)).not.toContain('Draft accessibility statement')
  })
})

describe('persisted concurrency tokens', () => {
  it('rejects a stale panel across background restarts and after deletion', async () => {
    const a = sampleAudit()
    let authority = createPersistence()
    const first = await authority.save({ audit: a, revision: 1 })
    expect(first.ok).toBe(true)
    if (!first.ok) throw new Error('save failed')
    a.storageToken = first.storageToken
    const stale = structuredClone(a)
    a.name = 'Newer work'
    expect((await authority.save({ audit: a, revision: 2 })).ok).toBe(true)
    authority = createPersistence()
    expect(await authority.save({ audit: stale, revision: 99 })).toMatchObject({ ok: false, code: 'conflict' })
    const saved = await loadAuditById(a.id)
    expect(saved.status === 'found' && saved.audit.name).toBe('Newer work')
    await authority.remove({ id: a.id })
    expect(await authority.save({ audit: stale, revision: 100 })).toMatchObject({ ok: false, code: 'conflict' })
    expect((await loadAuditById(a.id)).status).toBe('absent')
  })
  it('only one of two simultaneous edits of the same revision wins', async () => {
    const authority = createPersistence(); const a = sampleAudit()
    const first = await authority.save({ audit: a, revision: 0 })
    if (!first.ok) throw new Error('save failed')
    a.storageToken = first.storageToken
    const results = await Promise.all([authority.save({ audit: { ...a, name: 'One' }, revision: 1 }), authority.save({ audit: { ...a, name: 'Two' }, revision: 1 })])
    expect(results.map(r => r.ok)).toEqual([true, false])
  })
})
