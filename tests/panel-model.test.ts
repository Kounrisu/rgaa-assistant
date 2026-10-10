// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPage, emptyAudit } from '../src/lib/audit-store'
import type { FindingItem, ImageElementInfo, PageRecord } from '../src/lib/types'
import { loadPage, nextPageLabel, pageInput, pageLabel, persist } from '../src/panel/model'
import { resetThemeData } from '../src/panel/router'
import { state } from '../src/panel/state'
import type { AuditSession } from '../src/panel/audit-session'
import type { Item } from '../src/panel/types'

const item = (id: number): Item => ({ id, key: `k${id}`, tag: 'img', type: 'img', src: `a${id}.png`, accessibleName: 'x', ignoredBy: null, present: false, scan: 1, html: '', contextHtml: '' }) as unknown as Item
const finding = (theme: number, id: number): FindingItem => ({ type: 'iframe', id, label: 'l', summary: '', facts: {}, html: '', contextHtml: '', count: 1, data: {}, theme, key: `f${theme}-${id}`, present: true, scan: 1 })

let marked = 0
beforeEach(() => {
  vi.useFakeTimers()
  state.audit = emptyAudit('t')
  state.page = null
  state.elements = []
  state.reviews = {}
  state.scanCount = 0
  state.selectedId = null
  state.filter = 'all'
  state.scannedThisSession.clear()
  marked = 0
  state.session = { markDirty: () => void marked++ } as unknown as AuditSession
})
afterEach(() => {
  vi.clearAllTimers() // persist() schedules the push of the box colours to the page
  vi.useRealTimers()
})

describe('model: the page in use', () => {
  it('labels pages P01, P02... by their place in the sample', () => {
    const a = createPage(state.audit, 'https://x.test/a', 'A')
    const b = createPage(state.audit, 'https://x.test/b', 'B')
    expect([pageLabel(a), pageLabel(b), nextPageLabel()]).toEqual(['P01', 'P02', 'P03'])
    state.audit.pages.reverse()
    expect(pageLabel(a)).toBe('P02')
  })

  it('loadPage points the shared state at the page and selects its first image', () => {
    const rec = createPage(state.audit, 'https://x.test/a', 'A')
    rec.items = [item(4), item(5)]
    rec.reviews = { k4: { answers: {}, note: 'n' } }
    rec.scanCount = 3
    state.filter = 'review'
    loadPage(rec)
    expect(state.page).toBe(rec)
    expect(state.elements).toBe(rec.items)
    expect(state.reviews).toBe(rec.reviews)
    expect(state.scanCount).toBe(3)
    expect(state.selectedId).toBe(4)
    expect(state.filter).toBe('all')
    expect(state.audit.current).toBe(rec.id)
  })

  it('loadPage shows the images as last seen, unless this page was scanned in this session', () => {
    const seen = createPage(state.audit, 'https://x.test/a', 'A')
    seen.items = [item(1)]
    loadPage(seen)
    expect(seen.items[0].present).toBe(true)
    const scanned = createPage(state.audit, 'https://x.test/b', 'B')
    scanned.items = [item(1)]
    state.scannedThisSession.add(scanned.id)
    loadPage(scanned)
    expect(scanned.items[0].present).toBe(false)
  })

  it('loadPage(null) empties the shared state', () => {
    loadPage(createPage(state.audit, 'https://x.test/a', 'A'))
    loadPage(null)
    expect(state).toMatchObject({ page: null, elements: [], reviews: {}, scanCount: 0, selectedId: null })
    expect(state.audit.current).toBeNull()
  })

  it('persist stamps the page and the audit, copies the scan count and tells the session', () => {
    vi.setSystemTime(new Date('2026-05-06T07:08:09Z'))
    const rec = createPage(state.audit, 'https://x.test/a', 'A')
    loadPage(rec)
    state.scanCount = 5
    persist()
    expect(rec.scanCount).toBe(5)
    expect(rec.updatedAt).toBe(Date.parse('2026-05-06T07:08:09Z'))
    expect(state.audit.updatedAt).toBe(rec.updatedAt)
    expect(marked).toBe(1)
  })

  it('pageInput gives the results computation the page as it is', () => {
    const rec = createPage(state.audit, 'https://x.test/a', 'A')
    rec.items = [item(1)]
    rec.title = ''
    const input = pageInput(rec)
    expect(input).toMatchObject({ label: 'P01', pageUrl: 'https://x.test/a', pageTitle: 'https://x.test/a', images: rec.items, checklist: rec.checklist })
    expect(input.reviewOf({ key: 'k1' } as unknown as ImageElementInfo)).toBeUndefined()
    rec.reviews.k1 = { answers: {}, note: '' }
    expect(input.reviewOf({ key: 'k1' } as unknown as ImageElementInfo)).toBe(rec.reviews.k1)
  })
})

describe('router: resetThemeData clears one theme of a page and nothing else', () => {
  function seeded(): PageRecord {
    const rec = createPage(state.audit, 'https://x.test/a', 'A')
    rec.items = [item(1)]
    rec.reviews = { k1: { answers: {}, note: '' } }
    rec.findings = [finding(2, 1), finding(6, 1)]
    rec.findingReviews = { 'f2-1': { answers: {}, note: '' }, 'f6-1': { answers: {}, note: '' } }
    rec.checklist = { '2.1': { note: '' }, '6.1': { note: '' }, '4.1': { note: '' } }
    rec.scannedThemes = [1, 2, 6]
    state.scannedThisSession.add(rec.id)
    return rec
  }

  it('Images: the images and their reviews go', () => {
    const rec = seeded()
    resetThemeData(rec, 1)
    expect(rec.items).toEqual([])
    expect(rec.reviews).toEqual({})
    expect(rec.findings).toHaveLength(2)
    expect(rec.scannedThemes).toEqual([2, 6])
  })

  it('a finding theme: its findings, their reviews and its checklist answers go; the other themes stay', () => {
    const rec = seeded()
    resetThemeData(rec, 2)
    expect(rec.findings.map((f) => f.theme)).toEqual([6])
    expect(Object.keys(rec.findingReviews)).toEqual(['f6-1'])
    expect(Object.keys(rec.checklist).sort()).toEqual(['4.1', '6.1'])
    expect(rec.scannedThemes).toEqual([1, 6])
    expect(rec.items).toHaveLength(1)
  })

  it('the page is no longer counted as scanned in this session', () => {
    const rec = seeded()
    resetThemeData(rec, 6)
    expect(state.scannedThisSession.has(rec.id)).toBe(false)
  })
})
