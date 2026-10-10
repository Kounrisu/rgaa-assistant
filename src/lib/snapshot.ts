import { Gunzip, gzipSync, strFromU8, strToU8 } from 'fflate'

/** The generated HTML of a page, kept in the audit gzipped (a page is often 100-500 KB of text). */
export interface HtmlSnapshot {
  at: number
  url: string
  title: string
  /** Size of the HTML in bytes, before compression. */
  bytes: number
  /** gzip of the HTML, base64. */
  gz: string
}

/** Largest page HTML kept, and largest it may unpack to (protects against a file that expands to gigabytes). */
export const MAX_SNAPSHOT_BYTES = 30 * 1024 * 1024
/** Largest base64 text of a gzipped snapshot accepted from storage or from a file. */
export const MAX_SNAPSHOT_BASE64 = 20 * 1024 * 1024

export class SnapshotError extends Error {
  constructor(readonly code: 'snapshot-too-large' | 'snapshot-invalid') {
    super(code)
    this.name = 'SnapshotError'
  }
}

const toBase64 = (bytes: Uint8Array): string => {
  let out = ''
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(out)
}
const fromBase64 = (text: string): Uint8Array => Uint8Array.from(atob(text), (c) => c.charCodeAt(0))

export function packSnapshot(html: string, url: string, title: string): HtmlSnapshot {
  const raw = strToU8(html)
  if (raw.length > MAX_SNAPSHOT_BYTES) throw new SnapshotError('snapshot-too-large')
  return { at: Date.now(), url, title, bytes: raw.length, gz: toBase64(gzipSync(raw, { level: 6 })) }
}

/** The size the gzip trailer announces (ISIZE, the last four bytes, little-endian), or -1 when too short. */
export function gzipDeclaredSize(data: Uint8Array): number {
  const n = data.length
  return n < 18 ? -1 : (data[n - 4] | (data[n - 3] << 8) | (data[n - 2] << 16) | (data[n - 1] << 24)) >>> 0
}

/**
 * Unpacks a snapshot with limits: the base64 text is capped, the size announced by the gzip trailer is checked,
 * and the stream itself is cut as soon as it produces more than `maxBytes` (the trailer can lie).
 */
export function unpackSnapshot(snapshot: HtmlSnapshot, maxBytes = MAX_SNAPSHOT_BYTES): string {
  if (typeof snapshot.gz !== 'string' || snapshot.gz.length > MAX_SNAPSHOT_BASE64) throw new SnapshotError('snapshot-too-large')
  let data: Uint8Array
  try {
    data = fromBase64(snapshot.gz)
  } catch {
    throw new SnapshotError('snapshot-invalid')
  }
  if (gzipDeclaredSize(data) > maxBytes) throw new SnapshotError('snapshot-too-large')
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    const stream = new Gunzip((chunk) => {
      total += chunk.length
      if (total > maxBytes) throw new SnapshotError('snapshot-too-large')
      chunks.push(chunk)
    })
    stream.push(data, true)
  } catch (err) {
    throw err instanceof SnapshotError ? err : new SnapshotError('snapshot-invalid')
  }
  const out = new Uint8Array(total)
  let at = 0
  for (const c of chunks) {
    out.set(c, at)
    at += c.length
  }
  return strFromU8(out)
}
