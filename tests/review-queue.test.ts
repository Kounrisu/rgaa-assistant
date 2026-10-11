import { describe, expect, it } from 'vitest'
import { createPage, emptyAudit, parseAudit } from '../src/lib/audit-store'
import { nextReviewTarget, reviewQueue } from '../src/lib/review-queue'
import type { AuditItem } from '../src/lib/types'

describe('review continuation', () => {
  it('keeps unanswered image criteria after NC and continues from an answered position', () => {
    const page = createPage(emptyAudit(), 'https://example.test/', '')
    page.items = [{ id: 1, key: 'image1' }, { id: 2, key: 'image2' }] as AuditItem[]
    page.reviews.image1 = { kind: 'informative', answers: { '1.1': 'nc' }, note: '' }
    const queue = reviewQueue(page)
    expect(nextReviewTarget(queue, 'image:image1:1.1')?.key).toBe('image:image1:1.3')
    expect(queue.filter((x) => x.pending).length).toBeGreaterThan(1)
    expect(nextReviewTarget(queue, 'image:image2:kind')?.itemId).toBe(1)
  })
  it('confirms prefilled images and traverses themes to manual criteria', () => {
    const page = createPage(emptyAudit(), 'https://example.test/', '')
    page.themes = [1, 8]
    page.items = [{ id: 1, key: 'image' }] as AuditItem[]
    page.reviews.image = { kind: 'decorative', answers: { '1.2': 'c' }, auto: true, note: '' }
    expect(nextReviewTarget(reviewQueue(page))?.key).toBe('image:image:1.2')
    page.reviews.image.auto = false
    expect(nextReviewTarget(reviewQueue(page), 'image:image:1.2')?.key).toBe('criterion:8.1')
    page.themes = [1]
    expect(nextReviewTarget(reviewQueue(page))).toBeUndefined()
  })
})
describe('automatic run migration', () => {
  it('leaves older run history unknown and preserves human answers', () => {
    const audit = emptyAudit()
    const page = createPage(audit, 'https://example.test/', '')
    page.checklist['8.1'] = { verdict: 'nc', note: 'Human evidence' }
    const legacy = { ...audit, version: 3 }
    const migrated = parseAudit(legacy)
    expect(migrated.version).toBe(4)
    expect(migrated.pages[0].automaticRun).toBeUndefined()
    expect(migrated.pages[0].checklist['8.1']).toEqual(page.checklist['8.1'])
  })
  it('roundtrips runs and rejects malformed status', () => {
    const audit = emptyAudit()
    const page = createPage(audit, 'https://example.test/', '')
    page.automaticRun = { status: 'partial', url: page.url, startedAt: 100, finishedAt: 200 }
    expect(parseAudit(JSON.parse(JSON.stringify(audit))).pages[0].automaticRun).toEqual(page.automaticRun)
    expect(() => parseAudit({ ...audit, pages: [{ ...page, automaticRun: { ...page.automaticRun, status: 'compliant' } }] })).toThrow()
  })
})
