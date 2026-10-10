import { migrateEvidence } from './evidence'
import type { Audit, AuditSummary, PageRecord } from './types'

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

/** Fills what older versions of an audit did not have. */
export function migrate(audit: Audit): Audit {
  const a = audit as Audit & { version: number }
  const now = Date.now()
  a.version = 3
  a.id ||= newId()
  a.name ??= ''
  a.createdAt ||= now
  a.updatedAt ||= Math.max(0, ...audit.pages.map((p) => p.updatedAt || 0)) || now
  a.meta ??= { site: '', auditor: '', context: 'Visite initiale' }
  a.pages ??= []
  for (const p of a.pages) {
    // an early bug saved the text "undefined" as the URL / title of a page
    if (!/^[a-z][a-z0-9+.-]*:/i.test(p.url ?? '')) p.url = ''
    if (p.title === 'undefined') p.title = ''
    p.themes ??= [1]
    p.checklist ??= {}
    p.findings ??= []
    p.findingReviews ??= {}
    p.scannedThemes ??= p.scanCount ? [1] : []
    p.nextFindingId ??= 1
    p.nextFindingIds ??= {}
    migrateEvidence(p) // tool-prefilled verdicts become suggestions (src/lib/evidence.ts)
  }
  return a
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

export async function listAudits(): Promise<AuditSummary[]> {
  try {
    return (await read<AuditSummary[]>(INDEX_KEY)) ?? []
  } catch {
    return []
  }
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

/** Saves the audit and its line in the list. Throws when the storage refuses. */
export async function saveAudit(audit: Audit): Promise<void> {
  const index = (await listAudits()).filter((s) => s.id !== audit.id)
  index.push(summaryOf(audit))
  await write({ [auditKey(audit.id)]: compact(audit), [INDEX_KEY]: index })
}

export async function loadAuditById(id: string): Promise<Audit | null> {
  try {
    const stored = await read<Audit>(auditKey(id))
    return stored ? migrate(stored) : null
  } catch {
    return null
  }
}

export const getActiveId = async (): Promise<string | null> => (await read<string>(ACTIVE_KEY).catch(() => undefined)) ?? null
export const setActiveId = (id: string): Promise<void> => write({ [ACTIVE_KEY]: id })

/**
 * The audit to open at start: the last one used, else the audit saved by the first versions (which had a single
 * unnamed audit), else a new empty one called `defaultName`.
 */
export async function loadActiveAudit(defaultName: string): Promise<Audit> {
  try {
    const activeId = await getActiveId()
    const active = activeId ? await loadAuditById(activeId) : null
    if (active) return active
    const index = await listAudits()
    const latest = [...index].sort((a, b) => b.updatedAt - a.updatedAt)[0]
    const fromIndex = latest ? await loadAuditById(latest.id) : null
    if (fromIndex) return fromIndex
    const legacy = await read<Audit>(LEGACY_KEY)
    if (legacy && Array.isArray(legacy.pages)) {
      const migrated = migrate(legacy)
      migrated.name ||= defaultName
      await saveAudit(migrated)
      await setActiveId(migrated.id)
      await remove([LEGACY_KEY])
      return migrated
    }
  } catch {
    /* fall through to a fresh audit */
  }
  const fresh = emptyAudit(defaultName)
  await saveAudit(fresh).catch(() => undefined)
  await setActiveId(fresh.id).catch(() => undefined)
  return fresh
}

export async function deleteAuditById(id: string): Promise<void> {
  const index = (await listAudits()).filter((s) => s.id !== id)
  await remove([auditKey(id)])
  await write({ [INDEX_KEY]: index })
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

/** Reads an audit file; throws an Error with a short reason when it is not one of ours. */
export function auditFromFile(text: string): Audit {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('not-json')
  }
  const file = data as { format?: string; audit?: Audit }
  if (file?.format !== FILE_FORMAT || !file.audit || !Array.isArray(file.audit.pages)) throw new Error('not-audit')
  return migrate(file.audit)
}
