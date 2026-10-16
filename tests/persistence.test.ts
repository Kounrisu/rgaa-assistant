import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyAudit, listAudits, loadAuditById, saveAudit } from '../src/lib/audit-store'
import type { SaveResponse } from '../src/lib/messages'
import { createPersistence } from '../src/lib/persistence'
import type { Audit } from '../src/lib/types'
import { createAuditSession, type Choice, type SessionDeps, type Transport } from '../src/panel/audit-session'
import { FakeStorage, deferred, installChrome, sampleAudit } from './fakes'

let storage: FakeStorage
beforeEach(() => {
  storage = new FakeStorage()
  installChrome(storage)
})

describe('the persistence authority', () => {
  it('overlapping saves of different audits both end up in the index', async () => {
    storage.latency = 5
    const persistence = createPersistence()
    const a = sampleAudit('A')
    const b = sampleAudit('B')
    const results = await Promise.all([persistence.save({ audit: a, revision: 1 }), persistence.save({ audit: b, revision: 1 })])
    expect(results.every((r) => r.ok)).toBe(true)
    expect((await listAudits()).map((s) => s.id).sort()).toEqual([a.id, b.id].sort())
  })

  it('control: the same saves without the queue do lose an index entry', async () => {
    storage.latency = 5
    await Promise.all([saveAudit(sampleAudit('A')), saveAudit(sampleAudit('B'))])
    expect(await listAudits()).toHaveLength(1)
  })

  it('a save and a delete queued together keep the order', async () => {
    storage.latency = 2
    const persistence = createPersistence()
    const a = sampleAudit('A')
    const b = sampleAudit('B')
    await persistence.save({ audit: a, revision: 1 })
    await Promise.all([persistence.save({ audit: b, revision: 1 }), persistence.remove({ id: a.id })])
    expect((await listAudits()).map((s) => s.id)).toEqual([b.id])
    expect((await loadAuditById(a.id)).status).toBe('absent')
  })

  it('keeps working after a write failed, and reports the failure', async () => {
    const persistence = createPersistence()
    storage.failSet = true
    const failed = await persistence.save({ audit: sampleAudit(), revision: 1 })
    expect(failed).toMatchObject({ ok: false, code: 'storage' })
    storage.failSet = false
    expect(await persistence.save({ audit: sampleAudit(), revision: 2 })).toMatchObject({ ok: true, revision: 2 })
  })

  it('refuses to store an invalid audit', async () => {
    const persistence = createPersistence()
    const broken = sampleAudit() as unknown as { pages: unknown[] }
    broken.pages.push('nope')
    expect(await persistence.save({ audit: broken as unknown as Audit, revision: 1 })).toMatchObject({ ok: false, code: 'invalid' })
    expect(storage.sets).toBe(0)
  })
})

/* ---------------- the panel's side: save state machine and lifecycle ---------------- */

interface Harness {
  deps: SessionDeps
  session: ReturnType<typeof createAuditSession>
  current: { audit: Audit }
  said: string[]
  choices: string[][]
  answers: (string | null)[]
  downloads: string[]
  activated: number
}

function harness(transport: Transport, audit: Audit = sampleAudit('Open')): Harness {
  const current = { audit }
  const h: Harness = { current, said: [], choices: [], answers: [], downloads: [], activated: 0, deps: undefined as unknown as SessionDeps, session: undefined as never }
  h.deps = {
    getAudit: () => current.audit,
    setAudit: (a) => { current.audit = a },
    onActivated: () => { h.activated++ },
    onState: () => undefined,
    onListChanged: () => undefined,
    say: (m) => { h.said.push(m) },
    askText: async (_t, _l, initial) => initial ?? 'name',
    askConfirm: async () => true,
    askChoice: async (_t, _x, choices: Choice[]) => {
      h.choices.push(choices.map((c) => c.id))
      return h.answers.shift() ?? null
    },
    download: (_text, _mime, name) => { h.downloads.push(name) },
    fileNameOf: (a) => `${a.name}.rgaa.json`,
    transport,
    delayMs: 10,
  }
  h.session = createAuditSession(h.deps)
  return h
}

const okTransport = (calls: { id: string; revision: number; names: string[] }[] = []): Transport => {
  const persistence = createPersistence()
  return {
    save: (audit, revision) => {
      calls.push({ id: audit.id, revision, names: [audit.name] })
      return persistence.save({ audit, revision })
    },
    remove: (id) => persistence.remove({ id }),
  }
}

describe('save state machine', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('a completed older save does not mark newer changes as saved', async () => {
    const first = deferred<SaveResponse>()
    const second = deferred<SaveResponse>()
    const sent: Audit[] = []
    const queue = [first, second]
    const transport: Transport = {
      save: (audit) => {
        sent.push(audit)
        return queue.shift()!.promise
      },
      remove: async () => ({ ok: true, revision: 0 }),
    }
    const h = harness(transport)
    h.current.audit.name = 'v1'
    h.session.markDirty() // revision 1
    const saving = h.session.saveNow()
    await vi.advanceTimersByTimeAsync(0)
    expect(sent).toHaveLength(1)
    h.current.audit.name = 'v2' // edited while the first write is in flight
    h.session.markDirty() // revision 2
    first.resolve({ ok: true, revision: 1 })
    await vi.advanceTimersByTimeAsync(0)
    expect(h.session.savedRevision).toBe(1)
    expect(h.session.saveState).not.toBe('saved')
    expect(h.session.hasPending()).toBe(true)
    expect(sent).toHaveLength(2) // another write follows at once, with the newer content
    expect(sent[0].name).toBe('v1') // each save sent a snapshot taken at its own moment
    expect(sent[1].name).toBe('v2')
    second.resolve({ ok: true, revision: 2 })
    expect(await saving).toBe(true)
    expect(h.session.saveState).toBe('saved')
    expect(h.session.savedRevision).toBe(2)
  })

  it('the snapshot is taken at the call: later edits do not leak into a write in flight', async () => {
    const pending = deferred<SaveResponse>()
    let sent: Audit | undefined
    const h = harness({ save: (a) => ((sent = a), pending.promise), remove: async () => ({ ok: true, revision: 0 }) })
    h.session.markDirty()
    const saving = h.session.saveNow()
    await vi.advanceTimersByTimeAsync(0)
    h.current.audit.meta.site = 'changed later'
    expect(sent?.meta.site).toBe('example.org')
    pending.resolve({ ok: true, revision: 1 })
    h.session.markDirty()
    await vi.advanceTimersByTimeAsync(0)
    await saving
  })

  it('a failed save keeps the audit dirty, reports false and can be retried', async () => {
    let fail = true
    const h = harness({ save: async () => (fail ? { ok: false, code: 'storage', error: 'quota' } : { ok: true, revision: 1 }), remove: async () => ({ ok: true, revision: 0 }) })
    h.session.markDirty()
    expect(await h.session.saveNow()).toBe(false)
    expect(h.session.saveState).toBe('error')
    expect(h.session.lastError).toBe('quota')
    expect(h.session.hasPending()).toBe(true)
    fail = false
    expect(await h.session.retry()).toBe(true)
    expect(h.session.saveState).toBe('saved')
    expect(h.session.hasPending()).toBe(false)
  })

  it('the debounce writes once after a burst of edits', async () => {
    const calls: { id: string; revision: number; names: string[] }[] = []
    const h = harness(okTransport(calls))
    for (let i = 0; i < 5; i++) h.session.markDirty()
    await vi.advanceTimersByTimeAsync(50)
    expect(calls).toHaveLength(1)
    expect(calls[0].revision).toBe(5)
    expect(h.session.saveState).toBe('saved')
  })
})

describe('switching audits after a failed save', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  const failing: Transport = { save: async () => ({ ok: false, code: 'storage', error: 'quota' }), remove: async () => ({ ok: true, revision: 0 }) }

  it('refuses to activate (stays) and keeps the unsaved audit', async () => {
    const h = harness(failing)
    const open = h.current.audit
    h.session.markDirty()
    h.answers.push('stay')
    const next = emptyAudit('Next')
    expect(await h.session.activate(next)).toBe(false)
    expect(h.current.audit).toBe(open)
    expect(h.choices[0]).toEqual(['retry', 'file', 'discard', 'stay'])
    expect(h.session.hasPending()).toBe(true)
  })

  it('a dismissed dialog counts as staying', async () => {
    const h = harness(failing)
    h.session.markDirty()
    expect(await h.session.activate(emptyAudit('Next'))).toBe(false)
  })

  it('retry succeeds once the storage works again, then the switch happens', async () => {
    storage.failSet = true
    const persistence = createPersistence()
    const h = harness({ save: (a, r) => persistence.save({ audit: a, revision: r }), remove: async () => ({ ok: true, revision: 0 }) })
    const next = emptyAudit('Next')
    storage.failSet = false
    await persistence.save({ audit: next, revision: 0 })
    storage.failSet = true
    h.deps.askChoice = async () => {
      storage.failSet = false // the user frees some space, then retries
      return 'retry'
    }
    h.session = createAuditSession(h.deps)
    h.session.markDirty()
    expect(await h.session.activate(next)).toBe(true)
    expect(h.current.audit).toBe(next)
    expect((await loadAuditById(sampleAuditId(storage))).status).toBe('found') // the previous audit was written by the retry
  })

  it('"save to a file" downloads the unsaved audit, then switches', async () => {
    const h = harness(failing)
    const open = h.current.audit
    h.session.markDirty()
    h.answers.push('file')
    const next = emptyAudit('Next')
    expect(await h.session.activate(next)).toBe(true)
    expect(h.downloads).toEqual([`${open.name}.rgaa.json`])
    expect(h.current.audit).toBe(next)
  })

  it('"discard" switches only when the user said so explicitly', async () => {
    const h = harness(failing)
    h.session.markDirty()
    h.answers.push('discard')
    const next = emptyAudit('Next')
    expect(await h.session.activate(next)).toBe(true)
    expect(h.current.audit).toBe(next)
    expect(h.session.hasPending()).toBe(false)
  })
})

const sampleAuditId = (s: FakeStorage): string => {
  const key = Object.keys(s.data).find((k) => k.startsWith('rgaa-audit:') && (s.data[k] as Audit).name === 'Open')
  return key!.slice('rgaa-audit:'.length)
}

describe('a failed load is not an absent audit', () => {
  it('start-up reports the failure, keeps the pointer and writes nothing', async () => {
    const real = sampleAudit('Real')
    await saveAudit(real)
    storage.data['rgaa-active'] = real.id
    storage.data[`rgaa-audit:${real.id}`] = { ...real, pages: ['broken'] }
    const writes = storage.sets
    const h = harness(okTransport())
    expect(await h.session.loadInitial()).toBe(false)
    expect(h.session.blocked).toBe(true)
    expect(h.session.saveState).toBe('error')
    expect(h.said.length).toBeGreaterThan(0)
    // editing the placeholder never writes over the real audit
    h.session.markDirty()
    expect(await h.session.saveNow()).toBe(false)
    expect(storage.sets).toBe(writes)
    expect(storage.data['rgaa-active']).toBe(real.id)
    expect((storage.data[`rgaa-audit:${real.id}`] as Audit).pages).toEqual(['broken'])
  })

  it('opening an audit that cannot be read keeps the current audit', async () => {
    const other = sampleAudit('Other')
    await saveAudit(other)
    storage.data[`rgaa-audit:${other.id}`] = { nonsense: 1 }
    const h = harness(okTransport())
    const open = h.current.audit
    expect(await h.session.openAuditById(other.id)).toBe(false)
    expect(h.current.audit).toBe(open)
    expect(await h.session.openAuditById('missing')).toBe(false)
    expect(h.said).toHaveLength(2)
    expect(h.said[0]).not.toBe(h.said[1]) // unreadable and missing are told differently
  })
})

describe('importing a file', () => {
  const fileOf = (text: string, size = text.length) => ({ size, text: async () => text }) as unknown as File

  it('a bad file shows its error and leaves the current audit and the storage intact', async () => {
    const h = harness(okTransport())
    const open = h.current.audit
    h.session.markDirty()
    const before = JSON.stringify(open)
    const writes = storage.sets
    const bad = [
      fileOf('{oops'),
      fileOf('[]'),
      fileOf(JSON.stringify({ format: 'rgaa-assistant-audit', version: 3, audit: { version: 9, pages: [] } })),
      fileOf(JSON.stringify({ format: 'rgaa-assistant-audit', version: 3, audit: { version: 3, id: 'x', pages: [{ id: 'P01' }, 5] } })),
      fileOf('{}', 200 * 1024 * 1024),
    ]
    for (const file of bad) expect(await h.session.importAuditFile(file)).toBe(false)
    expect(new Set(h.said).size).toBe(bad.length) // each error is specific
    expect(h.current.audit).toBe(open)
    expect(JSON.stringify(open)).toBe(before)
    expect(storage.sets).toBe(writes)
    expect(h.activated).toBe(0)
  })

  it('a good file is stored then opened', async () => {
    const h = harness(okTransport())
    const incoming = sampleAudit('Imported')
    const text = JSON.stringify({ format: 'rgaa-assistant-audit', version: 3, audit: incoming })
    expect(await h.session.importAuditFile(fileOf(text))).toBe(true)
    expect(h.current.audit.id).toBe(incoming.id)
    expect((await loadAuditById(incoming.id)).status).toBe('found')
  })

  it('does not open the file when the storage refuses it', async () => {
    const h = harness(okTransport())
    const open = h.current.audit
    storage.failSet = true
    const text = JSON.stringify({ format: 'rgaa-assistant-audit', version: 3, audit: sampleAudit('Imported') })
    expect(await h.session.importAuditFile(fileOf(text))).toBe(false)
    expect(h.current.audit).toBe(open)
  })
})
