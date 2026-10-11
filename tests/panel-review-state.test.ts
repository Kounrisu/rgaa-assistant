// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { criteriaFor } from '../src/lib/rgaa'
import { createPage, emptyAudit } from '../src/lib/audit-store'
import type { FindingItem, ImageKind, ImageReview, Verdict } from '../src/lib/types'
import { boxStates, findingFails, findingMatches, findingNeedsReview, findingReview, findingStatus, listedFindings, matches, needsReview, nextToReview, reviewOf, statusOf, visibleElements } from '../src/panel/review-state'
import { state } from '../src/panel/state'
import type { Item } from '../src/panel/types'

let nextId = 1
const item = (over: Partial<Item> = {}): Item => {
  const id = nextId++
  return { id, key: `k${id}`, tag: 'img', type: 'img', src: `a${id}.png`, thumb: null, alt: null, ariaLabel: null, labelledByText: null, title: null, svgTitle: null, accessibleName: 'Logo', ignoredBy: null, role: null, ariaHidden: false, inDialog: false, nearbyText: null, isInsideLink: false, linkHref: null, linkText: null, figcaption: null, naturalWidth: 10, naturalHeight: 10, html: '<img>', contextHtml: '<p><img></p>', present: true, scan: 1, ...over } as Item
}
const finding = (over: Partial<FindingItem> = {}): FindingItem => {
  const id = nextId++
  return { type: 'iframe', id, label: 'Frame', summary: '', facts: {}, html: '', contextHtml: '', count: 1, data: {}, theme: 2, key: `f${id}`, present: true, scan: 1, shot: null, ...over }
}
const answered = (kind: ImageKind, verdict: Verdict, except?: string): ImageReview => ({
  kind,
  note: '',
  answers: Object.fromEntries(criteriaFor(kind).filter((c) => c.id !== except).map((c) => [c.id, verdict])),
})

/** The shared state seeded with a page: its images, their reviews and its findings. */
function seed(items: Item[], reviews: Record<string, ImageReview> = {}, findings: FindingItem[] = [], findingReviews: Record<string, ImageReview> = {}): void {
  const audit = emptyAudit('t')
  const rec = createPage(audit, 'https://x.test/', 'X')
  rec.items = items
  rec.reviews = reviews
  rec.findings = findings
  rec.findingReviews = findingReviews
  state.audit = audit
  state.page = rec
  state.elements = items
  state.reviews = reviews
  state.filter = 'all'
}

describe('review state of the images', () => {
  beforeEach(() => {
    nextId = 1
    seed([])
  })

  it('statusOf: todo without a kind, progress while a criterion is open, nc as soon as one fails, c when all pass', () => {
    const a = item()
    const b = item()
    const c = item()
    const d = item()
    const e = item()
    seed([a, b, c, d, e], {
      [b.key]: { note: '', answers: {} },
      [c.key]: answered('informative', 'c', criteriaFor('informative')[0].id),
      [d.key]: { ...answered('informative', 'c'), answers: { ...answered('informative', 'c').answers, [criteriaFor('informative')[0].id]: 'nc' } },
      [e.key]: answered('decorative', 'c'),
    })
    expect(statusOf(a)).toBe('todo')
    expect(statusOf(b)).toBe('todo') // no kind chosen yet
    expect(statusOf(c)).toBe('progress')
    expect(statusOf(d)).toBe('nc')
    expect(statusOf(e)).toBe('c')
    expect([a, b, c, d, e].map(needsReview)).toEqual([true, true, true, false, false])
  })

  it('needsReview: one NC answer does not finish the review while other criteria are open (reported by the UX audit of 2026-10-11)', () => {
    const [ncWithGaps, ncComplete, prefilled, confirmed] = [item(), item(), item(), item()]
    const first = criteriaFor('informative')[0].id
    seed([ncWithGaps, ncComplete, prefilled, confirmed], {
      [ncWithGaps.key]: { kind: 'informative', note: '', answers: { [first]: 'nc' } },
      [ncComplete.key]: { ...answered('informative', 'c'), answers: { ...answered('informative', 'c').answers, [first]: 'nc' } },
      [prefilled.key]: { ...answered('decorative', 'c'), auto: true },
      [confirmed.key]: answered('decorative', 'c'),
    })
    expect(statusOf(ncWithGaps)).toBe('nc') // the list and the box still say non-compliant
    expect(needsReview(ncWithGaps)).toBe(true) // but it stays in the review queue
    expect(needsReview(ncComplete)).toBe(false)
    expect(needsReview(prefilled)).toBe(true) // pre-filled from the markup: a human has to confirm
    expect(needsReview(confirmed)).toBe(false)
    state.filter = 'review'
    expect(visibleElements().map((e) => e.id)).toEqual([ncWithGaps.id, prefilled.id])
    expect(nextToReview(ncWithGaps)?.id).toBe(prefilled.id)
    expect(nextToReview(prefilled)?.id).toBe(ncWithGaps.id)
    // the box colour agrees with the queue
    const boxes = boxStates(1)
    expect(boxes[ncWithGaps.id]).toBe('review')
    expect(boxes[prefilled.id]).toBe('review')
    expect(boxes[ncComplete.id]).toBe('nc')
    expect(boxes[confirmed.id]).toBe('c')
  })

  it('reviewOf creates the review once, under the element key', () => {
    const a = item()
    seed([a])
    const r = reviewOf(a)
    expect(r).toEqual({ answers: {}, note: '' })
    expect(reviewOf(a)).toBe(r)
    expect(state.reviews[a.key]).toBe(r)
  })

  it('matches and visibleElements follow the filter', () => {
    const named = item()
    const unnamed = item({ accessibleName: null })
    const ignored = item({ ignoredBy: 'alt=""', accessibleName: null })
    const popin = item({ inDialog: true })
    const gone = item({ present: false })
    seed([named, unnamed, ignored, popin, gone], { [named.key]: { ...answered('informative', 'c'), auto: true }, [ignored.key]: answered('decorative', 'c') })
    const ids = (f: typeof state.filter) => {
      state.filter = f
      return visibleElements().map((e) => e.id)
    }
    expect(ids('all')).toEqual([named, unnamed, ignored, popin, gone].map((e) => e.id))
    expect(ids('unnamed')).toEqual([unnamed.id])
    expect(ids('ignored')).toEqual([ignored.id])
    expect(ids('named')).toEqual([named.id, popin.id, gone.id])
    expect(ids('dialog')).toEqual([popin.id])
    expect(ids('gone')).toEqual([gone.id])
    expect(ids('prefilled')).toEqual([named.id])
    expect(ids('review')).toEqual([named.id, unnamed.id, popin.id, gone.id].filter((id) => needsReview(state.elements.find((e) => e.id === id)!)))
    expect(matches(unnamed, 'all')).toBe(true)
  })

  it('nextToReview: the next one after this id, else the first one, never the same element', () => {
    const [a, b, c, d] = [item(), item(), item(), item()]
    seed([a, b, c, d], { [b.key]: answered('decorative', 'c'), [d.key]: answered('decorative', 'c') })
    expect(nextToReview(a)?.id).toBe(c.id)
    expect(nextToReview(c)?.id).toBe(a.id) // wraps round
    expect(nextToReview(b)?.id).toBe(c.id)
    seed([a], {})
    expect(nextToReview(a)).toBeUndefined()
  })

  describe('boxStates: the colour code of the boxes on the page', () => {
    it('Images: error / ignored / review while pending, c / nc once answered', () => {
      const unnamed = item({ accessibleName: null })
      const ignored = item({ ignoredBy: 'alt=""', accessibleName: null })
      const named = item()
      const done = item()
      const failed = item()
      const prefilled = item({ ignoredBy: 'alt=""', accessibleName: null })
      const failing = answered('informative', 'c')
      failing.answers[criteriaFor('informative')[0].id] = 'nc'
      seed([unnamed, ignored, named, done, failed, prefilled], {
        [done.key]: answered('informative', 'c'),
        [failed.key]: failing,
        [prefilled.key]: { ...answered('decorative', 'c'), auto: true },
      })
      expect(boxStates(1)).toEqual({
        [unnamed.id]: 'error',
        [ignored.id]: 'ignored',
        [named.id]: 'review',
        [done.id]: 'c',
        [failed.id]: 'nc',
        [prefilled.id]: 'ignored', // a pre-filled answer still counts as pending
      })
    })

    it('findings: only the theme asked for, never the passing-contrast line', () => {
      const ok = finding({ theme: 3, type: 'contrast-ok', id: 0 })
      const fail = finding({ theme: 3, type: 'contrast-fail', id: 1 })
      const unknown = finding({ theme: 3, type: 'contrast-unknown', id: 2 })
      const frame = finding({ theme: 2, type: 'iframe', id: 1, facts: { title: ' ' } })
      const confirmedOk = finding({ theme: 3, type: 'contrast-fail', id: 3 })
      seed([], {}, [ok, fail, unknown, frame, confirmedOk], { [confirmedOk.key]: { note: '', answers: { '3.2': 'nc' } } })
      expect(boxStates(3)).toEqual({ 1: 'error', 2: 'review', 3: 'nc' })
      expect(boxStates(2)).toEqual({ 1: 'error' }) // a frame without a title
      expect(boxStates(6)).toEqual({})
    })
  })
})

describe('review state of the findings', () => {
  beforeEach(() => {
    nextId = 1
    seed([])
  })

  it('findingNeedsReview: Colours need a confirmed 3.2 verdict, ordinary links and headings never ask', () => {
    const fail = finding({ theme: 3, type: 'contrast-fail' })
    const passing = finding({ theme: 3, type: 'contrast-ok' })
    const link = finding({ theme: 6, type: 'link' })
    const emptyLink = finding({ theme: 6, type: 'link-empty' })
    const heading = finding({ theme: 9, type: 'heading' })
    const field = finding({ theme: 11, type: 'field' })
    const layout = finding({ theme: 5, type: 'table-layout' })
    const untitled = finding({ theme: 5, type: 'table-data', facts: {} })
    const frame = finding({ theme: 2, type: 'iframe' })
    seed([], {}, [fail, passing, link, emptyLink, heading, field, layout, untitled, frame], {
      [frame.key]: { note: '', answers: { '2.1': 'c', '2.2': 'c' } },
    })
    expect([fail, passing, link, emptyLink, heading, field, layout, untitled, frame].map(findingNeedsReview)).toEqual([true, false, false, true, false, false, false, false, false])
    // a pre-filled verdict is not confirmed; the auditor's own answer is
    state.page!.findingReviews[fail.key] = { note: '', answers: { '3.2': 'c' }, auto: true }
    expect(findingNeedsReview(fail)).toBe(true)
    state.page!.findingReviews[fail.key] = { note: '', answers: { '3.2': 'c' } }
    expect(findingNeedsReview(fail)).toBe(false)
  })

  it('findingStatus and findingReview', () => {
    const f = finding({ theme: 2, type: 'iframe' })
    seed([], {}, [f])
    expect(findingStatus(f)).toBe('todo')
    const r = findingReview(f)
    expect(findingReview(f)).toBe(r)
    r.answers['2.1'] = 'c'
    expect(findingStatus(f)).toBe('progress')
    r.answers['2.2'] = 'c'
    expect(findingStatus(f)).toBe('c')
    r.answers['2.2'] = 'nc'
    expect(findingStatus(f)).toBe('nc')
  })

  it('findingMatches and listedFindings', () => {
    const hidden = finding({ theme: 6, type: 'link', data: { hidden: 'aria-hidden' } })
    const skip = finding({ theme: 6, type: 'link-skip' })
    const skipBroken = finding({ theme: 6, type: 'link-skip-broken' })
    const h = finding({ theme: 9, type: 'heading', data: { group: 'heading', level: 2 } })
    const lm = finding({ theme: 9, type: 'landmark', data: { group: 'landmark' } })
    const ok = finding({ theme: 3, type: 'contrast-ok' })
    seed([], {}, [hidden, skip, skipBroken, h, lm, ok])
    expect(findingMatches(hidden, 'hidden')).toBe(true)
    expect(findingMatches(skip, 'hidden')).toBe(false)
    expect(findingMatches(skip, 'link-skip')).toBe(true)
    expect(findingMatches(skipBroken, 'link-skip')).toBe(true)
    expect(findingMatches(h, 'headings')).toBe(true)
    expect(findingMatches(lm, 'headings')).toBe(false)
    expect(findingMatches(lm, 'landmarks')).toBe(true)
    expect(findingMatches(hidden, 'link-empty')).toBe(false)
    expect(findingMatches(hidden, 'all')).toBe(true)
    expect(listedFindings(3)).toEqual([]) // the passing line is not listed
    expect(listedFindings(6).map((f) => f.type)).toEqual(['link', 'link-skip', 'link-skip-broken'])
  })
})

describe('findingFails: one definition for the box colour and the list highlight', () => {
  const finding = (over: Partial<FindingItem>): FindingItem =>
    ({ id: 1, key: 'k', theme: 2, type: 'iframe', label: 'x', summary: '', facts: {}, html: '', contextHtml: '', count: 1, data: {}, present: true, scan: 1, ...over }) as FindingItem

  it('a frame with no title or a blank title fails, a frame with a title does not', () => {
    expect(findingFails(finding({ facts: { title: null } }))).toBe(true)
    expect(findingFails(finding({ facts: { title: '   ' } }))).toBe(true)
    expect(findingFails(finding({ facts: { title: 'Carte' } }))).toBe(false)
  })
  it('a link, a table or a field never fails just because its own title attribute is missing', () => {
    expect(findingFails(finding({ theme: 6, type: 'link', facts: { title: null } }))).toBe(false)
    expect(findingFails(finding({ theme: 6, type: 'link-empty', facts: { title: null } }))).toBe(true)
    expect(findingFails(finding({ theme: 11, type: 'field-nolabel', facts: {} }))).toBe(true)
    expect(findingFails(finding({ theme: 5, type: 'table-data', facts: { title: null } }))).toBe(false)
  })
})
