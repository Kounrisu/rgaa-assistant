import type { Audit, PageRecord } from './types'

const KEY = 'rgaa-audit'
const MAX_INLINE_THUMB = 30000

export const emptyAudit = (): Audit => ({
  version: 2,
  meta: { site: '', auditor: '', context: 'Visite initiale' },
  pages: [],
  current: null,
})

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

const hasStorageApi = () => typeof chrome !== 'undefined' && Boolean(chrome.storage?.local)

/** Older saved audits only knew about Images. */
function migrate(audit: Audit): Audit {
  for (const p of audit.pages) {
    p.themes ??= [1]
    p.checklist ??= {}
    p.findings ??= []
    p.findingReviews ??= {}
    p.scannedThemes ??= p.scanCount ? [1] : []
    p.nextFindingId ??= 1
    p.nextFindingIds ??= {}
  }
  return audit
}

export async function loadAudit(): Promise<Audit> {
  try {
    if (hasStorageApi()) {
      const stored = (await chrome.storage.local.get(KEY))[KEY] as Audit | undefined
      if (stored?.version === 2) return migrate(stored)
    } else {
      const raw = localStorage.getItem(KEY)
      if (raw) return migrate(JSON.parse(raw) as Audit)
    }
  } catch {
    /* fall through to a fresh audit */
  }
  return emptyAudit()
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

export async function saveAudit(audit: Audit): Promise<void> {
  const data = compact(audit)
  if (hasStorageApi()) await chrome.storage.local.set({ [KEY]: data })
  else localStorage.setItem(KEY, JSON.stringify(data))
}
