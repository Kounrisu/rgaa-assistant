import { gzipSync } from 'fflate'
import { beforeEach, describe, expect, it } from 'vitest'
import { AuditFormatError, auditFromFile, auditToFile, checkImportSize, listAudits, loadActiveAudit, loadAuditById, migrate, parseAudit, saveAudit } from '../src/lib/audit-store'
import { MAX_IMPORT_BYTES } from '../src/lib/audit-validate'
import { MAX_SNAPSHOT_BASE64, MAX_SNAPSHOT_BYTES, SnapshotError, gzipDeclaredSize, packSnapshot, unpackSnapshot } from '../src/lib/snapshot'
import type { Audit } from '../src/lib/types'
import { FakeStorage, installChrome, sampleAudit } from './fakes'

const fileOf = (audit: unknown, extra: Record<string, unknown> = {}) => JSON.stringify({ format: 'rgaa-assistant-audit', version: 3, audit, ...extra })
const codeOf = (fn: () => unknown): string => {
  try {
    fn()
  } catch (err) {
    return err instanceof AuditFormatError ? err.code : `other:${String(err)}`
  }
  return 'none'
}
const raw = (audit: Audit) => JSON.parse(JSON.stringify(audit)) as Record<string, any>

describe('audit file validation', () => {
  it('round-trips a complete audit unchanged', () => {
    const audit = sampleAudit()
    audit.pages[0].snapshot = packSnapshot('<html></html>', 'https://example.org/', 'Home')
    expect(auditFromFile(auditToFile(audit))).toEqual(audit)
  })

  it('rejects text that is not JSON and JSON that is not an audit', () => {
    expect(codeOf(() => auditFromFile('{nope'))).toBe('not-json')
    expect(codeOf(() => auditFromFile('[]'))).toBe('not-audit')
    expect(codeOf(() => auditFromFile(JSON.stringify({ format: 'other', audit: {} })))).toBe('not-audit')
    expect(codeOf(() => auditFromFile(fileOf(null)))).toBe('not-audit')
    expect(codeOf(() => auditFromFile(fileOf({ version: 3, pages: 'x' })))).toBe('not-audit')
  })

  it('rejects an invalid verdict, wherever it is', () => {
    const a = raw(sampleAudit())
    a.pages[0].reviews['img-1'].answers['1.1'] = 'maybe'
    expect(codeOf(() => auditFromFile(fileOf(a)))).toBe('invalid')
    const b = raw(sampleAudit())
    b.pages[0].checklist['2.1'].verdict = 'yes'
    expect(codeOf(() => auditFromFile(fileOf(b)))).toBe('invalid')
  })

  it('rejects malformed nested records and says where', () => {
    const cases: [string, (a: Record<string, any>) => void][] = [
      ['pages[0]', (a) => { a.pages[0] = 'P01' }],
      ['pages[0].items', (a) => { a.pages[0].items = {} }],
      ['pages[0].items[0].id', (a) => { a.pages[0].items[0].id = '1' }],
      ['pages[0].items[0].present', (a) => { a.pages[0].items[0].present = 'yes' }],
      ['pages[0].reviews', (a) => { a.pages[0].reviews = [] }],
      ['pages[0].reviews.img-1.answers', (a) => { a.pages[0].reviews['img-1'].answers = ['c'] }],
      ['pages[0].findings[0].theme', (a) => { a.pages[0].findings[0].theme = 'two' }],
      ['pages[0].nextFindingIds.2', (a) => { a.pages[0].nextFindingIds = { 2: 'x' } }],
      ['pages[0].themes', (a) => { a.pages[0].themes = ['1'] }],
      ['pages[0].manualChecks.keyboard.state', (a) => { a.pages[0].manualChecks.keyboard.state = 'maybe' }],
      ['meta.site', (a) => { a.meta.site = 3 }],
      ['id', (a) => { a.id = 42 }],
      ['name', (a) => { a.name = 5 }],
      ['current', (a) => { a.current = 3 }],
    ]
    for (const [where, mutate] of cases) {
      const a = raw(sampleAudit())
      mutate(a)
      try {
        auditFromFile(fileOf(a))
        throw new Error(`accepted: ${where}`)
      } catch (err) {
        expect(err, where).toBeInstanceOf(AuditFormatError)
        expect((err as AuditFormatError).code, where).toBe('invalid')
        expect((err as AuditFormatError).path, where).toContain(where.split('.')[0].replace(/\[0\]$/, ''))
      }
    }
  })

  it('rejects page identifiers that are malformed or used twice', () => {
    const dup = raw(sampleAudit())
    dup.pages.push({ ...dup.pages[0] })
    expect(codeOf(() => auditFromFile(fileOf(dup)))).toBe('invalid')
    const odd = raw(sampleAudit())
    odd.pages[0].id = 'home'
    expect(codeOf(() => auditFromFile(fileOf(odd)))).toBe('invalid')
  })

  it('rejects future and unknown versions instead of relabelling them as v3', () => {
    const future = raw(sampleAudit())
    future.version = 6
    expect(codeOf(() => auditFromFile(fileOf(future)))).toBe('unsupported-version')
    expect(codeOf(() => parseAudit(future))).toBe('unsupported-version')
    expect(future.version).toBe(6) // not touched
    const old = raw(sampleAudit())
    old.version = 1
    expect(codeOf(() => parseAudit(old))).toBe('unsupported-version')
    old.version = '3'
    expect(codeOf(() => parseAudit(old))).toBe('unsupported-version')
    expect(codeOf(() => migrate(future as unknown as Audit))).toBe('unsupported-version')
    expect(codeOf(() => auditFromFile(fileOf(raw(sampleAudit()), { version: 9 })))).toBe('unsupported-version')
  })

  it('rejects oversize files before and after reading them', () => {
    expect(codeOf(() => checkImportSize(MAX_IMPORT_BYTES + 1))).toBe('too-large')
    expect(() => checkImportSize(MAX_IMPORT_BYTES)).not.toThrow()
    expect(codeOf(() => auditFromFile('x'.repeat(MAX_IMPORT_BYTES + 1)))).toBe('too-large')
  })

  it('rejects a snapshot that is declared or encoded too large', () => {
    const big = raw(sampleAudit())
    big.pages[0].snapshot = { at: 1, url: 'u', title: 't', bytes: MAX_SNAPSHOT_BYTES + 1, gz: 'AAAA' }
    expect(codeOf(() => auditFromFile(fileOf(big)))).toBe('too-large')
    const long = raw(sampleAudit())
    long.pages[0].snapshot = { at: 1, url: 'u', title: 't', bytes: 10, gz: 'A'.repeat(MAX_SNAPSHOT_BASE64 + 1) }
    expect(codeOf(() => auditFromFile(fileOf(long)))).toBe('too-large')
  })
})

describe('snapshot decompression limits', () => {
  it('unpacks a normal snapshot', () => {
    const html = '<html><body>é</body></html>'
    expect(unpackSnapshot(packSnapshot(html, 'u', 't'))).toBe(html)
  })

  it('refuses a gzip bomb (small file, huge content)', () => {
    const bomb = gzipSync(new Uint8Array(MAX_SNAPSHOT_BYTES + 1024))
    const gz = Buffer.from(bomb).toString('base64')
    expect(gz.length).toBeLessThan(MAX_SNAPSHOT_BASE64)
    expect(() => unpackSnapshot({ at: 0, url: '', title: '', bytes: 1, gz })).toThrow(SnapshotError)
  })

  it('does not trust the size announced in the gzip trailer', () => {
    const bomb = gzipSync(new Uint8Array(MAX_SNAPSHOT_BYTES + 1024))
    const lie = Uint8Array.from(bomb)
    lie.set([100, 0, 0, 0], lie.length - 4)
    expect(gzipDeclaredSize(lie)).toBe(100)
    const gz = Buffer.from(lie).toString('base64')
    expect(() => unpackSnapshot({ at: 0, url: '', title: '', bytes: 1, gz })).toThrow(SnapshotError)
  })

  it('refuses an oversize base64 text and garbage', () => {
    expect(() => unpackSnapshot({ at: 0, url: '', title: '', bytes: 1, gz: 'A'.repeat(MAX_SNAPSHOT_BASE64 + 1) })).toThrow(SnapshotError)
    expect(() => unpackSnapshot({ at: 0, url: '', title: '', bytes: 1, gz: Buffer.from('not gzip at all, really not').toString('base64') })).toThrow(SnapshotError)
  })
})

describe('migrations of older files', () => {
  it('v2 -> v3: an audit saved before names and identifiers existed', () => {
    const v2 = {
      version: 2,
      meta: { site: 'old.example', auditor: '', context: '' },
      current: null,
      pages: [
        { url: 'https://old.example/', title: 'Old', scanCount: 1, nextId: 2, updatedAt: 1000, items: [], reviews: {} },
        { url: 'undefined', title: 'undefined', scanCount: 0, nextId: 1, updatedAt: 2000, items: [], reviews: {} },
      ],
    }
    const audit = parseAudit(v2)
    expect(audit.version).toBe(5)
    expect(audit.id).toBeTruthy()
    expect(audit.name).toBe('')
    expect(audit.createdAt).toBe(1000)
    expect(audit.updatedAt).toBe(2000)
    expect(audit.pages.map((p) => p.id)).toEqual(['P01', 'P02'])
    expect(audit.pages[0]).toMatchObject({ themes: [1], checklist: {}, findings: [], findingReviews: {}, scannedThemes: [1], nextFindingId: 1, nextFindingIds: {} })
    expect(audit.pages[1]).toMatchObject({ url: '', title: '', scannedThemes: [] })
    // the same file through the file reader (a v2 audit in a v3 envelope is what an older export looks like)
    expect(auditFromFile(fileOf({ ...v2, pages: v2.pages.map((p) => ({ ...p })) })).pages).toHaveLength(2)
  })

  it('a version-less audit is read as v2', () => {
    const audit = parseAudit({ pages: [], meta: { site: '', auditor: '', context: '' } })
    expect(audit.version).toBe(5)
    expect(audit.pages).toEqual([])
  })

  it('a partially filled v3 audit gets the fields added later', () => {
    const a = raw(sampleAudit())
    for (const k of ['themes', 'checklist', 'findings', 'findingReviews', 'scannedThemes', 'nextFindingId', 'nextFindingIds']) delete a.pages[0][k]
    a.pages[0].scanCount = 2
    a.current = 'P99'
    const audit = parseAudit(a)
    expect(audit.pages[0]).toMatchObject({ themes: [1], checklist: {}, findings: [], findingReviews: {}, scannedThemes: [1], nextFindingId: 1, nextFindingIds: {} })
    expect(audit.current).toBeNull()
  })

  it('a migrated audit that is still malformed is rejected, not repaired', () => {
    const v2 = { version: 2, pages: [{ url: 'https://x.test/', items: 'nope', reviews: {} }] }
    expect(codeOf(() => parseAudit(v2))).toBe('invalid')
  })
})

describe('reading from the storage', () => {
  let storage: FakeStorage
  beforeEach(() => {
    storage = new FakeStorage()
    installChrome(storage)
  })

  it('tells found, absent and failed apart', async () => {
    const audit = sampleAudit()
    await saveAudit(audit)
    expect(await loadAuditById(audit.id)).toMatchObject({ status: 'found' })
    expect(await loadAuditById('nope')).toEqual({ status: 'absent' })
    storage.data[`rgaa-audit:${audit.id}`] = { ...audit, pages: ['P01'] }
    const corrupt = await loadAuditById(audit.id)
    expect(corrupt.status).toBe('failed')
    expect((corrupt as { error: AuditFormatError }).error.code).toBe('storage-corrupt')
    storage.failGet = true
    expect((await loadAuditById(audit.id)).status).toBe('failed')
  })

  it('a stored audit from the future is reported, not downgraded', async () => {
    const audit = sampleAudit()
    storage.data[`rgaa-audit:${audit.id}`] = { ...audit, version: 7 }
    const result = await loadAuditById(audit.id)
    expect(result.status).toBe('failed')
    expect(storage.data[`rgaa-audit:${audit.id}`]).toMatchObject({ version: 7 })
  })

  it('never replaces an unreadable active audit with a fresh empty one', async () => {
    const audit = sampleAudit()
    await saveAudit(audit)
    storage.data['rgaa-active'] = audit.id
    storage.data[`rgaa-audit:${audit.id}`] = { garbage: true, pages: [] , version: 3, id: 5}
    const writes = storage.sets
    const result = await loadActiveAudit('Untitled')
    expect(result.status).toBe('failed')
    expect(storage.sets).toBe(writes)
    expect(storage.data['rgaa-active']).toBe(audit.id)
    expect(await listAudits()).toHaveLength(1)
  })

  it('a failed read of the active pointer or of the list is a failure too', async () => {
    storage.failGet = true
    expect((await loadActiveAudit('Untitled')).status).toBe('failed')
    storage.failGet = false
    storage.data['rgaa-active'] = 'gone'
    storage.data['rgaa-index'] = 'not a list'
    expect((await loadActiveAudit('Untitled')).status).toBe('failed')
  })

  it('creates a fresh audit only when the storage is readable and empty', async () => {
    const result = await loadActiveAudit('Untitled')
    expect(result).toMatchObject({ status: 'found', created: true, saved: true })
    expect(await listAudits()).toHaveLength(1)
  })

  it('opens the audit saved by the first versions (legacy key) and migrates it', async () => {
    storage.data['rgaa-audit'] = { version: 2, meta: { site: 's', auditor: '', context: '' }, current: null, pages: [] }
    const result = await loadActiveAudit('Untitled')
    expect(result.status).toBe('found')
    if (result.status === 'found') expect(result.audit.name).toBe('Untitled')
    expect('rgaa-audit' in storage.data).toBe(false)
    expect(await listAudits()).toHaveLength(1)
  })
})
