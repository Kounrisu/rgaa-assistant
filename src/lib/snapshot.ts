import { gunzipSync, gzipSync, strFromU8, strToU8 } from 'fflate'

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

const toBase64 = (bytes: Uint8Array): string => {
  let out = ''
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(out)
}
const fromBase64 = (text: string): Uint8Array => Uint8Array.from(atob(text), (c) => c.charCodeAt(0))

export function packSnapshot(html: string, url: string, title: string): HtmlSnapshot {
  const raw = strToU8(html)
  return { at: Date.now(), url, title, bytes: raw.length, gz: toBase64(gzipSync(raw, { level: 6 })) }
}

export const unpackSnapshot = (snapshot: HtmlSnapshot): string => strFromU8(gunzipSync(fromBase64(snapshot.gz)))
