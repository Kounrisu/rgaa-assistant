// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createPage, emptyAudit } from '../src/lib/audit-store'
import { setLang } from '../src/lib/i18n'
import type { FindingItem, ImageElementInfo, ImageReview, PageRecord, RawFinding } from '../src/lib/types'
import { applyContrastVerdict, contrastOutcome } from '../src/panel/contrast-checker'
import { keyOf } from '../src/panel/helpers'
import { keyOfFinding, mergeFindings, mergeScan, nextFindingNumber, prefill } from '../src/panel/scan-merge'
import { pageOrder } from '../src/panel/page-order'
import { state } from '../src/panel/state'
import type { Item } from '../src/panel/types'

const info = (id: number, over: Partial<ImageElementInfo> = {}): ImageElementInfo =>
  ({ id, tag: 'img', type: 'img', src: `https://x.test/${id}.png`, thumb: null, alt: 'x', ariaLabel: null, labelledByText: null, title: null, svgTitle: null, accessibleName: 'x', ignoredBy: null, role: null, ariaHidden: false, inDialog: false, nearbyText: null, isInsideLink: false, linkHref: null, linkText: null, figcaption: null, naturalWidth: 1, naturalHeight: 1, html: `<img id="${id}">`, contextHtml: `<p><img id="${id}"></p>`, ...over }) as ImageElementInfo

const raw = (over: Partial<RawFinding> = {}): RawFinding => ({ type: 'iframe', id: 1, label: 'iframe', summary: 's', facts: {}, html: '<iframe>', contextHtml: '<div><iframe></div>', count: 1, data: {}, ...over })

let rec: PageRecord
function seed(): void {
  const audit = emptyAudit('t')
  rec = createPage(audit, 'https://x.test/', 'X')
  state.audit = audit
  state.page = rec
  state.elements = rec.items
  state.reviews = rec.reviews
  state.scanCount = 0
}

beforeEach(() => {
  setLang('en')
  seed()
})
afterEach(() => setLang('fr'))

describe('mergeScan: a scan joins the images already known', () => {
  it('numbers new images from the page counter and returns the renumbering for the boxes', () => {
    const { added, map } = mergeScan([info(7), info(8)])
    expect(added).toBe(2)
    expect(map).toEqual([{ from: 7, to: 1 }, { from: 8, to: 2 }])
    expect(state.scanCount).toBe(1)
    expect(state.elements.map((e) => [e.id, e.scan, e.present, e.key])).toEqual([
      [1, 1, true, keyOf(info(7))],
      [2, 1, true, keyOf(info(8))],
    ])
    expect(rec.nextId).toBe(3)
  })

  it('a second scan keeps ids, marks the missing image as gone and adds the new one with its scan number', () => {
    mergeScan([info(1), info(2)])
    const { added, map } = mergeScan([info(2, { alt: 'changed' }), info(3)])
    expect(added).toBe(1)
    expect(map).toEqual([{ from: 2, to: 2 }, { from: 3, to: 3 }])
    const byId = Object.fromEntries(state.elements.map((e) => [e.id, e]))
    expect(byId[1].present).toBe(false)
    expect(byId[2]).toMatchObject({ present: true, scan: 1, alt: 'changed' })
    expect(byId[3]).toMatchObject({ present: true, scan: 2 })
    expect(state.scanCount).toBe(2)
    // sorted by the scan they first appeared in, then by id
    expect(state.elements.map((e) => e.id)).toEqual([1, 2, 3])
  })

  it('identical elements get their own key (~1, ~2...) and keep it from scan to scan', () => {
    const twin = (id: number) => info(id, { src: 'https://x.test/same.png', html: '<img>', contextHtml: '<p><img></p>' })
    mergeScan([twin(1), twin(2), twin(3)])
    expect(state.elements.map((e) => e.key.split('~')[1] ?? '')).toEqual(['', '1', '2'])
    const { added } = mergeScan([twin(1), twin(2), twin(3)])
    expect(added).toBe(0)
    expect(state.elements).toHaveLength(3)
  })

  it('keeps a unique unchanged image and its review when siblings/context change, including after reopening', () => {
    mergeScan([info(1)])
    const key = state.elements[0].key
    state.reviews[key] = { kind: 'informative', answers: { '1.1': 'c' }, note: 'Auditor note' }
    const changedContext = info(17, { ...info(1), id: 17, contextHtml: '<p>New sibling<img id="1"></p>' })
    // numbers follow the page order: the new image comes first on the page, so it is #1 and the known image is #2 (its answers stay with it)
    expect(mergeScan([info(2), changedContext])).toEqual({ added: 1, renumbered: 1, map: [{ from: 2, to: 1 }, { from: 17, to: 2 }] })
    expect(state.elements).toHaveLength(2)
    expect(state.elements.find((e) => e.key === key)).toMatchObject({ id: 2, key, present: true, contextHtml: changedContext.contextHtml })
    // Reopen using only the persisted record: matching needs no session cache.
    rec = JSON.parse(JSON.stringify(rec))
    state.page = rec
    state.elements = rec.items
    state.reviews = rec.reviews
    expect(mergeScan([changedContext, info(2)]).added).toBe(0)
    expect(state.reviews[key]).toEqual({ kind: 'informative', answers: { '1.1': 'c' }, note: 'Auditor note' })
  })

  it('does not guess between duplicate images whose contexts changed', () => {
    const a = info(1)
    const b = { ...a, id: 2, contextHtml: '<aside><img id="1"></aside>' }
    mergeScan([a, b])
    const oldKeys = state.elements.map(el => el.key)
    state.reviews[oldKeys[0]] = { answers: { '1.1': 'nc' }, note: 'First only' }
    expect(mergeScan([{ ...a, contextHtml: '<section><img id="1"></section>' }]).added).toBe(1)
    expect(state.elements.filter(el => el.present).map(el => el.id)).toEqual([3])
    expect(state.reviews[oldKeys[0]].note).toBe('First only')
  })

  it('does not reuse a context-only match when the image markup or link destination changed', () => {
    mergeScan([info(1)])
    expect(mergeScan([info(1, { html: '<img id="1" alt="Changed">', contextHtml: '<p>Changed</p>' })]).added).toBe(1)
    expect(mergeScan([info(1, { linkHref: '/another', contextHtml: '<a href="/another"><img id="1"></a>' })]).added).toBe(1)
  })

  it('pre-fills what the markup answers: decorative if ignored, informative 1.1 compliant if named, informative 1.1 non-compliant if nothing names it', () => {
    mergeScan([
      info(1, { alt: '', accessibleName: null, ignoredBy: 'aria-hidden="true"' }),
      info(2, { alt: 'Logo' }),
      info(3, { accessibleName: null, alt: null, ignoredBy: null }),
    ])
    const [a, b, c] = state.elements
    expect(state.reviews[a.key]).toEqual({ kind: 'decorative', answers: { '1.2': 'c' }, note: '', auto: true })
    expect(state.reviews[b.key]).toEqual({ kind: 'informative', answers: { '1.1': 'c' }, note: '', auto: true })
    expect(state.reviews[c.key]).toEqual({ kind: 'informative', answers: { '1.1': 'nc' }, note: '', auto: true })
  })

  it('pre-filling never touches an image the auditor already worked on', () => {
    mergeScan([info(1, { alt: 'Logo' })])
    const key = state.elements[0].key
    state.reviews[key] = { kind: 'decorative', answers: { '1.2': 'nc' }, note: 'mine' }
    mergeScan([info(1, { alt: 'Logo' })])
    expect(state.reviews[key]).toEqual({ kind: 'decorative', answers: { '1.2': 'nc' }, note: 'mine' })
  })

  it('prefill never overwrites an answer the auditor gave', () => {
    const el = { ...info(1, { alt: '', accessibleName: null, ignoredBy: 'aria-hidden="true"' }), key: 'k', present: true, scan: 1 } as Item
    state.reviews.k = { kind: 'informative', answers: {}, note: '' }
    prefill(el)
    expect(state.reviews.k).toEqual({ kind: 'informative', answers: {}, note: '' })
    state.reviews.k = { kind: 'decorative', answers: { '1.2': 'nc' }, note: '' }
    prefill(el)
    expect(state.reviews.k.answers['1.2']).toBe('nc')
    state.reviews.k = { kind: 'decorative', answers: {}, note: '' } // decorative, no verdict yet: filled
    prefill(el)
    expect(state.reviews.k).toMatchObject({ answers: { '1.2': 'c' }, auto: true })
  })
})

describe('mergeFindings: a theme scan joins the findings already known', () => {
  const frames = [raw({ id: 1, type: 'iframe', facts: { title: 'Carte' }, html: '<iframe title="Carte">' }), raw({ id: 2, type: 'iframe', facts: { title: null }, html: '<iframe>' })]

  it('keys findings per theme, pre-fills the verdicts from the markup and records the theme as scanned', () => {
    expect(keyOfFinding(2, frames[0])).toMatch(/^2\|iframe\|\|/)
    const { added, map } = mergeFindings(2, frames)
    expect(added).toBe(2)
    expect(map).toEqual([{ from: 1, to: 1 }, { from: 2, to: 2 }])
    expect(rec.scannedThemes).toContain(2)
    expect(rec.findings.map((f) => [f.id, f.theme, f.present])).toEqual([[1, 2, true], [2, 2, true]])
    const [ok, bad] = rec.findings
    expect(rec.findingReviews[ok.key]).toMatchObject({ answers: { '2.1': 'c' }, auto: true })
    expect(rec.findingReviews[bad.key]).toMatchObject({ answers: { '2.1': 'nc' }, auto: true })
  })

  it('a rescan keeps ids and answers; a finding that went away is dropped unless a human worked on it', () => {
    mergeFindings(2, frames)
    const [first, second] = [...rec.findings]
    rec.findingReviews[first.key].auto = false
    rec.findingReviews[first.key].note = 'my note'
    const { added } = mergeFindings(2, [raw({ id: 1, type: 'iframe', facts: { title: 'Autre' }, html: '<iframe title="Autre">', contextHtml: '<section><iframe title="Autre"></section>' })])
    expect(added).toBe(1)
    // the second one (never touched by a human) is gone from the audit, the first one stays but is no longer present
    expect(rec.findings.find((f) => f.key === second.key)).toBeUndefined()
    expect(rec.findingReviews[second.key]).toBeUndefined()
    expect(rec.findings.find((f) => f.key === first.key)).toMatchObject({ present: false, id: 1 })
    expect(rec.findingReviews[first.key].note).toBe('my note')
    // the vanished #2 is dropped first, so the new finding reuses its number: 1, 2 (no gap)
    expect(rec.findings.find((f) => f.html.includes('Autre'))!.id).toBe(2)
    expect(rec.findings.filter((f) => f.theme === 2).map((f) => f.id).sort()).toEqual([1, 2])
  })

  it('nextFindingNumber is one more than the highest in use, per theme', () => {
    mergeFindings(2, frames)
    expect(nextFindingNumber(rec, 2)).toBe(3)
    expect(nextFindingNumber(rec, 6)).toBe(1)
  })

  it('Colours: the passing line is unnumbered (0), problems run 1, 2, 3 and get their contrast note', () => {
    const failing = raw({ type: 'contrast-fail', id: 5, label: '“Texte pâle”', summary: 'x', data: { fg: '#bbbbbb', bg: '#ffffff', large: false } })
    const passing = raw({ type: 'contrast-ok', id: 9, label: 'ok', summary: '4 text element(s) · 2 colour pair(s)' })
    mergeFindings(3, [passing, failing])
    expect(rec.findings.map((f) => [f.type, f.id])).toEqual([['contrast-ok', 0], ['contrast-fail', 1]])
    const fail = rec.findings.find((f) => f.type === 'contrast-fail') as FindingItem
    const review = rec.findingReviews[fail.key]
    expect(review.answers['3.2']).toBe('nc')
    expect(review.note).toMatch(/Contrast too low: text #BBBBBB on #FFFFFF = 1\.9\d:1, normal text needs 4\.5:1/)
    expect(review.autoNote).toBe(review.note)
  })
})

describe('contrast checker maths', () => {
  const f = (data: FindingItem['data']): FindingItem => ({ ...raw({ type: 'contrast-fail', data }), theme: 3, key: 'k', present: true, scan: 1 })

  it('contrastOutcome reads the colours of the script, the hand-set ones win, and a bad hex gives nothing', () => {
    const out = contrastOutcome(f({ fg: '#000000', bg: '#ffffff' }), { answers: {}, note: '' })!
    expect(out.ratio).toBeCloseTo(21, 5)
    expect(out).toMatchObject({ threshold: 4.5, ok: true, fg: '#000000', bg: '#FFFFFF', large: false })
    const byHand = contrastOutcome(f({ fg: '#000000', bg: '#ffffff' }), { answers: {}, note: '', fg: '#cccccc' })!
    expect(byHand.ok).toBe(false)
    expect(contrastOutcome(f({ fg: 'nope', bg: '#ffffff' }), { answers: {}, note: '' })).toBeNull()
    expect(contrastOutcome(f({}), { answers: {}, note: '' })).toBeNull()
  })

  it('large text needs 3:1 and an explicit threshold wins', () => {
    expect(contrastOutcome(f({ fg: '#777777', bg: '#ffffff', large: true }), { answers: {}, note: '' })).toMatchObject({ threshold: 3, ok: true, large: true })
    expect(contrastOutcome(f({ fg: '#777777', bg: '#ffffff', large: true, threshold: 7 }), { answers: {}, note: '' })).toMatchObject({ threshold: 7, ok: false })
  })

  it('applyContrastVerdict writes the verdict and a note, replacing only a note the checker wrote itself', () => {
    const finding = f({ fg: '#bbbbbb', bg: '#ffffff' })
    const review: ImageReview = { answers: {}, note: '', auto: true }
    applyContrastVerdict(finding, review, true)
    expect(review.answers['3.2']).toBe('nc')
    expect(review.auto).toBe(false)
    expect(review.note).toMatch(/^Contrast too low/)
    expect(review.autoNote).toBe(review.note)
    // the auditor edits the note: the checker leaves it alone
    review.note = 'my words'
    review.fg = '#000000'
    applyContrastVerdict(finding, review, true)
    expect(review.answers['3.2']).toBe('c')
    expect(review.note).toBe('my words')
    // the note is the checker's own again: a passing ratio clears it
    review.note = review.autoNote!
    applyContrastVerdict(finding, review, true)
    expect(review.note).toBe('')
    expect(review.autoNote).toBeUndefined()
  })

  it('applyContrastVerdict without setVerdict only touches the note', () => {
    const review: ImageReview = { answers: {}, note: '' }
    applyContrastVerdict(f({ fg: '#bbbbbb', bg: '#ffffff' }), review, false)
    expect(review.answers).toEqual({})
    expect(review.note).toMatch(/^Contrast too low/)
  })
})

describe('numbers follow the page order', () => {
  const keys = (list: { key: string }[]) => list.map((x) => x.key)

  it('pageOrder: found items in the latest scan order, absent ones stay behind the neighbour they had', () => {
    const items = ['a', 'b', 'c', 'd'].map((key) => ({ key }))
    // b is not found this time; e is new at the top; d now sits before c
    const merged = [...items, { key: 'e' }]
    expect(keys(pageOrder(merged, ['e', 'a', 'd', 'c']))).toEqual(['e', 'a', 'b', 'd', 'c'])
    // an absent item that was first stays first
    expect(keys(pageOrder([{ key: 'x' }, { key: 'y' }], ['y']))).toEqual(['x', 'y'])
    // nothing found: order unchanged
    expect(keys(pageOrder(items, []))).toEqual(['a', 'b', 'c', 'd'])
  })

  it('an image found by a rescan at the top of the page becomes #1; the others shift and keep their answers', () => {
    mergeScan([info(1), info(2)])
    const keyOne = state.elements[0].key
    state.reviews[keyOne] = { kind: 'informative', answers: { '1.1': 'c' }, note: 'logo' }
    const { added, renumbered, map } = mergeScan([info(9), info(1), info(2)])
    expect(added).toBe(1)
    expect(renumbered).toBe(2)
    expect(state.elements.map((e) => [e.id, e.src])).toEqual([[1, 'https://x.test/9.png'], [2, 'https://x.test/1.png'], [3, 'https://x.test/2.png']])
    expect(map).toEqual([{ from: 9, to: 1 }, { from: 1, to: 2 }, { from: 2, to: 3 }])
    expect(state.reviews[keyOne]).toMatchObject({ kind: 'informative', note: 'logo' }) // the answer stayed with the image
    expect(rec.nextId).toBe(4)
  })

  it('an image that is not on the page now keeps its place between its neighbours', () => {
    mergeScan([info(1), info(2), info(3)])
    mergeScan([info(1), info(3)]) // 2 is gone (a closed popin)
    expect(state.elements.map((e) => [e.id, e.present, e.src?.slice(-5)])).toEqual([[1, true, '1.png'], [2, false, '2.png'], [3, true, '3.png']])
    mergeScan([info(1), info(5), info(3)]) // a new one appears between 1 and 3
    expect(state.elements.map((e) => e.src?.slice(-5))).toEqual(['1.png', '2.png', '5.png', '3.png'])
    expect(state.elements.map((e) => e.id)).toEqual([1, 2, 3, 4])
  })

  it('findings of a theme are numbered in the order of the latest scan, and their answers follow them', () => {
    mergeFindings(6, [raw({ type: 'link', id: 1, label: 'B', summary: 'b' }), raw({ type: 'link', id: 2, label: 'C', summary: 'c' })])
    const second = rec.findings.find((f) => f.label === 'C')!
    rec.findingReviews[second.key] = { answers: { '6.1': 'nc' }, note: 'n' }
    const { map } = mergeFindings(6, [raw({ type: 'link', id: 1, label: 'A', summary: 'a' }), raw({ type: 'link', id: 2, label: 'B', summary: 'b' }), raw({ type: 'link', id: 3, label: 'C', summary: 'c' })])
    expect(rec.findings.filter((f) => f.theme === 6).map((f) => [f.id, f.label])).toEqual([[1, 'A'], [2, 'B'], [3, 'C']])
    expect(map).toEqual([{ from: 1, to: 1 }, { from: 2, to: 2 }, { from: 3, to: 3 }])
    expect(rec.findingReviews[second.key]).toMatchObject({ answers: { '6.1': 'nc' }, note: 'n' })
  })
  it('Colours: texts that are no longer found are dropped unless a human worked on them (the checker’s own note does not count)', () => {
    const fail = (id: number, label: string) => raw({ type: 'contrast-fail', id, label, summary: label, facts: {}, html: `<p>${label}</p>`, contextHtml: `<div><p>${label}</p></div>`, data: { fg: '#bbbbbb', bg: '#ffffff', large: false } })
    mergeFindings(3, [fail(1, '“A”'), fail(2, '“B”'), fail(3, '“C”')])
    const [a, b, c] = ['“A”', '“B”', '“C”'].map((l) => rec.findings.find((f) => f.label === l)!)
    expect(rec.findingReviews[a.key].autoNote).toBeTruthy() // every failing text got the checker's note
    rec.findingReviews[b.key].note = 'à corriger par l’équipe' // a human note
    rec.findingReviews[c.key].answers['3.2'] = 'na' // a human answer
    rec.findingReviews[c.key].auto = false
    mergeFindings(3, [fail(1, '“D”')]) // A, B and C are not on the page any more
    const labels = rec.findings.filter((f) => f.theme === 3).map((f) => f.label)
    expect(labels).not.toContain('“A”') // only the checker's note and a pre-filled answer: dropped
    expect(rec.findingReviews[a.key]).toBeUndefined()
    expect(labels).toContain('“B”') // the human note: kept, flagged as gone
    expect(labels).toContain('“C”') // the human answer: kept
    expect(rec.findings.find((f) => f.label === '“B”')!.present).toBe(false)
  })
})
