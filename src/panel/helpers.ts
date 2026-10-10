import type { ImageElementInfo, Audit } from '../lib/types'
import { t, getLang } from '../lib/i18n'
import type { Item } from './types'
import { FILE_EXTENSION } from '../lib/audit-store'

export function hash(text: string): string {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return (h >>> 0).toString(36)
}

export const keyOf = (el: ImageElementInfo) =>
  `${el.type}|${el.src && !el.src.startsWith('data:') ? el.src : hash(el.html)}|${hash(el.contextHtml)}`

/**
 * The scan texts come from the page script in English, with the numbers and colours inside. They are stored that way
 * (the identity of a finding must not depend on the language) and translated here when shown.
 */
export function tDyn(text: string): string {
  const rules: [RegExp, (m: RegExpExecArray) => string][] = [
    [/^(\d+) text element\(s\) · (\d+) colour pair\(s\)$/, (m) => t('{n} text element(s) · {pairs} colour pair(s)', { n: m[1], pairs: m[2] })],
    [/^(\S+) on (.+) · ratio cannot be computed$/, (m) => t('{fg} on {bg} · ratio cannot be computed', { fg: tDyn(m[1]), bg: tDyn(m[2]) })],
    [/^(#[0-9A-F]{6}) on (#[0-9A-F]{6}) · ([\d.]+):1 \(needs ([\d.]+):1\)$/, (m) => t('{fg} on {bg} · {ratio}:1 (needs {need}:1)', { fg: m[1], bg: m[2], ratio: m[3], need: m[4] })],
    [/^([\d.]+):1 \((large|normal) text\)$/, (m) => t('{need}:1 ({kind} text)', { need: m[1], kind: t(m[2]) })],
    [/^(\d+) other element\(s\)$/, (m) => t('{n} other element(s)', { n: m[1] })],
    [/^(.+) — cannot be computed$/, (m) => t('{what} — cannot be computed', { what: tDyn(m[1]) })],
    [/^(\d+)px( bold)?$/, (m) => `${m[1]} px${m[2] ? ` ${t('bold')}` : ''}`],
    [/^<(\w+)> without title$/, (m) => t('<{tag}> without title', { tag: m[1] })],
    [/^(\d+) h1$/, (m) => t('{n} h1', { n: m[1] })],
    [/^h(\d) \(empty\)$/, (m) => t('h{n} (empty)', { n: m[1] })],
    [/^h(\d) · jump from h(\d)$/, (m) => t('h{a} · jump from h{b}', { a: m[1], b: m[2] })],
    [/^<(\w+)> without label$/, (m) => t('<{tag}> without label', { tag: m[1] })],
    [/^table (\d+)×(\d+)$/, (m) => t('table {r}×{c}', { r: m[1], c: m[2] })],
    [/^(\d+) rows × (\d+) columns · (\d+) header cell\(s\)$/, (m) => t('{r} rows × {c} columns · {h} header cell(s)', { r: m[1], c: m[2], h: m[3] })],
    [/^<(\w+)> without name$/, (m) => t('<{tag}> without name', { tag: m[1] })],
  ]
  for (const [re, fn] of rules) {
    const m = re.exec(text)
    if (m) return fn(m)
  }
  return t(text)
}

export function labelOf(el: Item): string {
  return el.src && !el.src.startsWith('data:') ? fileName(el.src) : `<${el.type}>`
}

export function fileName(src: string): string {
  try {
    return decodeURIComponent(new URL(src).pathname.split('/').pop() || src)
  } catch {
    return src
  }
}

export const VOID_TAGS = new Set(['img', 'br', 'hr', 'input', 'meta', 'link', 'source', 'area', 'col', 'embed', 'wbr', 'track', 'param'])

export function formatHtml(source: string): string[] {
  const tokens = source.match(/<!--[\s\S]*?-->|<[^>]*>?|[^<]+/g) ?? []
  const lines: string[] = []
  let depth = 0
  for (const token of tokens) {
    if (token.startsWith('</')) {
      depth = Math.max(0, depth - 1)
      lines.push('  '.repeat(depth) + token)
    } else if (token.startsWith('<!--')) {
      lines.push('  '.repeat(depth) + token)
    } else if (token.startsWith('<')) {
      lines.push('  '.repeat(depth) + token)
      const name = /^<([a-z][\w-]*)/i.exec(token)?.[1]?.toLowerCase()
      if (name && !VOID_TAGS.has(name) && !token.endsWith('/>')) depth++
    } else {
      const text = token.replace(/\s+/g, ' ').trim()
      if (text) lines.push('  '.repeat(depth) + text)
    }
  }
  return lines
}

export const pad = (n: number) => String(n).padStart(2, '0')

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export const kb = (bytes: number) => `${Math.max(1, Math.round(bytes / 1024))} KB`

export const slugOf = (name: string): string =>
  name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'audit'

export const timeOf = (ms: number) => new Date(ms).toLocaleTimeString(getLang(), { hour: '2-digit', minute: '2-digit' })

export const dateTimeOf = (ms: number) => new Date(ms).toLocaleString(getLang(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export const auditTitle = (a: { name: string }) => a.name || t('Untitled audit')

/** Downloads the whole audit as a .rgaa.json file. */
export const hostName = (url: string): string => { try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' } }

/** site_audit-name_date.rgaa.json: sorts by site, tells the audits apart, and a new save never overwrites an older one. */
export function auditFileName(a: Audit): string {
  const site = slugOf(a.meta.site)
  const name = slugOf(a.name)
  const parts = [site !== 'audit' ? site : '', name !== 'audit' && !(site !== 'audit' && name.includes(site)) ? name : '', new Date().toISOString().slice(0, 10)].filter(Boolean)
  return `${parts.join('_')}${FILE_EXTENSION}`
}
