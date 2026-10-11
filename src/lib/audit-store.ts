import { migrateEvidence } from './evidence'
import { isNavigableUrl } from './url-safety'
import type { Audit, AuditSummary, PageRecord } from './types'
import { AuditFormatError, CURRENT_VERSION, MAX_IMPORT_BYTES, isRecord, readVersion, validateAudit } from './audit-validate'

export { AuditFormatError } from './audit-validate'

const LEGACY_KEY = 'rgaa-audit'
const INDEX_KEY = 'rgaa-index'
const ACTIVE_KEY = 'rgaa-active'
const auditKey = (id: string) => `rgaa-audit:${id}`
const MAX_INLINE_THUMB = 30000

export const FILE_FORMAT = 'rgaa-assistant-audit'
export const FILE_EXTENSION = '.rgaa.json'

const newId = (): string => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`)

export const emptyAudit = (name = ''): Audit => {
  const now = Date.now()
  return {
    version: 3,
    id: newId(),
    name,
    createdAt: now,
    updatedAt: now,
    meta: { site: '', auditor: '', context: 'Visite initiale' },
    pages: [],
    current: null,
  }
}

/** The page identity: same URL ignoring the #fragment, so popins and tabs on one page stay together. */
export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url)
    u.hash = ''
    return u.href
  } catch {
    return url
  }
}

export function findPage(audit: Audit, url: string): PageRecord | undefined {
  const wanted = normalizeUrl(url)
  return audit.pages.find((p) => normalizeUrl(p.url) === wanted)
}

export function createPage(audit: Audit, url: string, title: string): PageRecord {
  let n = audit.pages.length + 1
  while (audit.pages.some((p) => p.id === `P${String(n).padStart(2, '0')}`)) n++
  const page: PageRecord = {
    id: `P${String(n).padStart(2, '0')}`,
    url: normalizeUrl(url),
    title,
    scanCount: 0,
    nextId: 1,
    updatedAt: Date.now(),
    items: [],
    reviews: {},
    themes: [1],
    checklist: {},
    findings: [],
    findingReviews: {},
    scannedThemes: [],
    nextFindingId: 1,
    nextFindingIds: {},
  }
  audit.pages.push(page)
  return page
}

/* ------------------------------------------------------------------ */
/* Raw storage: chrome.storage.local in the extension, localStorage in a plain page */
/* ------------------------------------------------------------------ */

const hasStorageApi = () => typeof chrome !== 'undefined' && Boolean(chrome.storage?.local)

async function read<T>(key: string): Promise<T | undefined> {
  if (hasStorageApi()) return (await chrome.storage.local.get(key))[key] as T | undefined
  const raw = localStorage.getItem(key)
  return raw ? (JSON.parse(raw) as T) : undefined
}

async function write(values: Record<string, unknown>): Promise<void> {
  if (hasStorageApi()) return chrome.storage.local.set(values)
  for (const [k, v] of Object.entries(values)) localStorage.setItem(k, JSON.stringify(v))
}

async function remove(keys: string[]): Promise<void> {
  if (hasStorageApi()) return chrome.storage.local.remove(keys)
  for (const k of keys) localStorage.removeItem(k)
}

/* ------------------------------------------------------------------ */
/* Versions: explicit migrations, then a full validation                */
/* ------------------------------------------------------------------ */

type Rec = Record<string, unknown>
const missing = (v: unknown): boolean => v === undefined || v === null
const fill = (o: Rec, key: string, value: unknown): void => {
  if (missing(o[key])) o[key] = value
}

/** v2 -> v3: audits saved before they had an id, a name, dates and page identifiers. */
function v2ToV3(a: Rec): void {
  const now = Date.now()
  fill(a, 'id', newId())
  fill(a, 'name', '')
  fill(a, 'meta', { site: '', auditor: '', context: 'Visite initiale' })
  const pages = (a.pages as unknown[]).filter(isRecord)
  const times = pages.map((p) => (typeof p.updatedAt === 'number' ? p.updatedAt : 0)).filter(Boolean)
  if (!a.createdAt) a.createdAt = times.length ? Math.min(...times) : now
  if (!a.updatedAt) a.updatedAt = times.length ? Math.max(...times) : now
  const used = new Set(pages.map((p) => p.id).filter((id) => typeof id === 'string'))
  let n = 1
  for (const p of pages) {
    if (typeof p.id === 'string' && p.id) continue
    while (used.has(`P${String(n).padStart(2, '0')}`)) n++
    p.id = `P${String(n).padStart(2, '0')}`
    used.add(p.id as string)
  }
  fill(a, 'current', null)
}

/** One entry per version that can still be read: it brings an audit of that version to the next one. */
const MIGRATIONS: Record<number, (a: Rec) => void> = { 2: v2ToV3 }

/**
 * Brings a raw audit up to the current version, in place. The version is checked first (a newer or unknown version
 * throws unsupported-version instead of being relabelled), then the explicit migrations run, then the fields
 * added later within v3 are filled. It tolerates malformed input (validateAudit reports it afterwards).
 */
export function migrate(audit: Audit): Audit {
  const a = audit as unknown as Rec
  for (let v = readVersion(a); v < CURRENT_VERSION; v++) MIGRATIONS[v](a)
  a.version = CURRENT_VERSION
  const now = Date.now()
  const pages = a.pages as unknown[]
  fill(a, 'id', newId())
  fill(a, 'name', '')
  if (!a.createdAt) a.createdAt = now
  if (!a.updatedAt) a.updatedAt = Math.max(0, ...pages.filter(isRecord).map((p) => (typeof p.updatedAt === 'number' ? p.updatedAt : 0))) || now
  fill(a, 'meta', { site: '', auditor: '', context: 'Visite initiale' })
  for (const p of pages) {
    if (!isRecord(p)) continue
    // an early bug saved the text "undefined" as the URL / title of a page; and a file can hold any string, e.g. `javascript:`,
    // which the panel would send to the inspected tab: only http, https and file addresses are kept
    if (!isNavigableUrl(p.url)) p.url = ''
    if (p.title === 'undefined') p.title = ''
    fill(p, 'title', '')
    fill(p, 'scanCount', 0)
    fill(p, 'items', [])
    fill(p, 'reviews', {})
    fill(p, 'updatedAt', a.updatedAt)
    if (missing(p.nextId)) p.nextId = Array.isArray(p.items) ? Math.max(0, ...p.items.map((i) => (isRecord(i) && typeof i.id === 'number' ? i.id : 0))) + 1 : 1
    fill(p, 'themes', [1])
    fill(p, 'checklist', {})
    fill(p, 'findings', [])
    fill(p, 'findingReviews', {})
    fill(p, 'scannedThemes', p.scanCount ? [1] : [])
    fill(p, 'nextFindingId', 1)
    fill(p, 'nextFindingIds', {})
    // tool-prefilled checklist verdicts become suggestions (src/lib/evidence.ts); a malformed checklist is left to the validator
    if (isRecord(p.checklist)) migrateEvidence(p as unknown as Pick<PageRecord, 'checklist'>)
  }
  if (typeof a.current === 'string' && !pages.some((p) => isRecord(p) && p.id === a.current)) a.current = null
  fill(a, 'current', null)
  return a as unknown as Audit
}

/** Migrates then validates the whole structure. Throws an AuditFormatError; never returns a half-valid audit. */
export function parseAudit(raw: unknown): Audit {
  readVersion(raw)
  const audit = migrate(raw as Audit)
  validateAudit(audit)
  return audit
}

const summaryOf = (a: Audit): AuditSummary => ({
  id: a.id,
  name: a.name,
  site: a.meta.site,
  pages: a.pages.length,
  createdAt: a.createdAt,
  updatedAt: a.updatedAt,
  exportedAt: a.exportedAt,
})

const isSummary = (v: unknown): v is AuditSummary =>
  isRecord(v) && typeof v.id === 'string' && typeof v.name === 'string' && typeof v.updatedAt === 'number' && typeof v.pages === 'number'

/** The list of audits. Throws when the storage cannot be read or the index is corrupt (it is never guessed as empty). */
export async function listAudits(): Promise<AuditSummary[]> {
  const index = await read<unknown>(INDEX_KEY)
  if (index === undefined) return []
  if (!Array.isArray(index)) throw new AuditFormatError('storage-corrupt', INDEX_KEY, 'the list of audits is not a list')
  return index.filter(isSummary)
}

/** Large inline previews (svg / canvas data URLs) are dropped to keep the stored audit small. */
function compact(audit: Audit): Audit {
  return {
    ...audit,
    pages: audit.pages.map((p) => ({
      ...p,
      items: p.items.map((i) => (i.thumb && i.thumb.length > MAX_INLINE_THUMB ? { ...i, thumb: null } : i)),
    })),
  }
}

/**
 * Saves the audit and its line in the list. Throws when the storage refuses.
 * UNSERIALIZED read-modify-write of the index: only the persistence authority (src/lib/persistence.ts, run by the
 * background page) may call it, one task at a time.
 */
export async function saveAudit(audit: Audit): Promise<void> {
  const index = (await listAudits()).filter((s) => s.id !== audit.id)
  index.push(summaryOf(audit))
  await write({ [auditKey(audit.id)]: compact(audit), [INDEX_KEY]: index })
}

/** Found, genuinely absent, or failed (storage error / corrupt data): a failure is never the same as absent. */
export type LoadResult = { status: 'found'; audit: Audit } | { status: 'absent' } | { status: 'failed'; error: Error }

const asError = (err: unknown): Error => (err instanceof Error ? err : new Error(String(err)))
const asCorrupt = (err: unknown, key: string): Error =>
  err instanceof AuditFormatError ? new AuditFormatError('storage-corrupt', err.path || key, err.code + (err.detail ? ` ${err.detail}` : '')) : asError(err)

export async function loadAuditById(id: string): Promise<LoadResult> {
  let stored: unknown
  try {
    stored = await read<unknown>(auditKey(id))
  } catch (error) {
    return { status: 'failed', error: asError(error) }
  }
  if (stored === undefined || stored === null) return { status: 'absent' }
  try {
    return { status: 'found', audit: parseAudit(stored) }
  } catch (error) {
    return { status: 'failed', error: asCorrupt(error, auditKey(id)) }
  }
}

/** Throws when the storage cannot be read. */
export const getActiveId = async (): Promise<string | null> => (await read<string>(ACTIVE_KEY)) ?? null
export const setActiveId = (id: string): Promise<void> => write({ [ACTIVE_KEY]: id })

export type ActiveLoad = { status: 'found'; audit: Audit; created: boolean; saved: boolean } | { status: 'failed'; error: Error }

/**
 * The audit to open at start: the last one used, else the most recent one of the list, else the audit saved by the
 * first versions (a single unnamed audit), else a new empty one called `defaultName`. Any read or validation failure
 * on the way returns 'failed': a fresh audit is created only when the storage is readable and really has nothing,
 * so an unreadable audit is never replaced by an empty one. `persist` is the (serialized) writer.
 */
export async function loadActiveAudit(defaultName: string, persist: (audit: Audit) => Promise<void> = saveAudit): Promise<ActiveLoad> {
  try {
    const activeId = await getActiveId()
    if (activeId) {
      const active = await loadAuditById(activeId)
      if (active.status === 'found') return { status: 'found', audit: active.audit, created: false, saved: true }
      if (active.status === 'failed') return active
    }
    const latest = [...(await listAudits())].sort((a, b) => b.updatedAt - a.updatedAt)[0]
    if (latest) {
      const fromIndex = await loadAuditById(latest.id)
      if (fromIndex.status === 'found') return { status: 'found', audit: fromIndex.audit, created: false, saved: true }
      if (fromIndex.status === 'failed') return fromIndex
    }
    const legacy = await read<unknown>(LEGACY_KEY)
    if (legacy !== undefined && legacy !== null) {
      let migrated: Audit
      try {
        migrated = parseAudit(legacy)
      } catch (error) {
        return { status: 'failed', error: asCorrupt(error, LEGACY_KEY) }
      }
      migrated.name ||= defaultName
      await persist(migrated)
      await setActiveId(migrated.id)
      await remove([LEGACY_KEY])
      return { status: 'found', audit: migrated, created: false, saved: true }
    }
  } catch (error) {
    return { status: 'failed', error: asError(error) }
  }
  const fresh = emptyAudit(defaultName)
  let saved = true
  try {
    await persist(fresh)
    await setActiveId(fresh.id)
  } catch {
    saved = false
  }
  return { status: 'found', audit: fresh, created: true, saved }
}

/** UNSERIALIZED, like saveAudit: called by the persistence authority only. */
export async function deleteAuditById(id: string): Promise<void> {
  const index = (await listAudits()).filter((s) => s.id !== id)
  await write({ [INDEX_KEY]: index })
  await remove([auditKey(id)])
}

/** A copy with its own identifier, so both live side by side. */
export function copyOf(audit: Audit, name: string): Audit {
  const copy = JSON.parse(JSON.stringify(audit)) as Audit
  const now = Date.now()
  copy.id = newId()
  copy.name = name
  copy.createdAt = now
  copy.updatedAt = now
  delete copy.exportedAt
  return copy
}

/* ------------------------------------------------------------------ */
/* Audit file (.rgaa.json): everything, to save elsewhere or carry on later */
/* ------------------------------------------------------------------ */

export function auditToFile(audit: Audit): string {
  return JSON.stringify({ format: FILE_FORMAT, version: 3, exportedAt: Date.now(), audit }, null, 1)
}

/** Rejects a file that is too big before it is read at all (File.size). */
export function checkImportSize(bytes: number): void {
  if (bytes > MAX_IMPORT_BYTES) throw new AuditFormatError('too-large', '', `${bytes} bytes`)
}

/**
 * Reads an audit file as unknown data and validates it completely. Throws an AuditFormatError (not-json, not-audit,
 * unsupported-version, too-large, invalid) and never returns something half valid.
 */
export function auditFromFile(text: string): Audit {
  checkImportSize(text.length)
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new AuditFormatError('not-json')
  }
  if (!isRecord(data) || data.format !== FILE_FORMAT || !isRecord(data.audit)) throw new AuditFormatError('not-audit')
  // the version of the file itself, then the one of the audit (parseAudit)
  if (data.version !== undefined && (typeof data.version !== 'number' || data.version > CURRENT_VERSION || data.version < 2)) throw new AuditFormatError('unsupported-version', 'version', String(data.version))
  return dropForeignPreviews(parseAudit(data.audit))
}

/**
 * A file can list any preview address, and the panel loads previews: opening a tampered file would make requests to a
 * server the auditor never visited. Previews stored as images (data:) stay; an address is kept only when it is on the
 * same host as its page. They come back at the next scan.
 */
function dropForeignPreviews(audit: Audit): Audit {
  const host = (url: string): string => {
    try {
      return new URL(url).hostname
    } catch {
      return ''
    }
  }
  for (const page of audit.pages) {
    const pageHost = host(page.url)
    for (const item of page.items) {
      if (typeof item.thumb !== 'string' || item.thumb.startsWith('data:')) continue
      if (!pageHost || host(item.thumb) !== pageHost) item.thumb = null
    }
  }
  return audit
}
