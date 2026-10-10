/**
 * Theme 3: the colour contrast scan. Imported by the content script only (inlined in its bundle).
 */
import { OVERLAY_ID, boundedContext, shortHtml, visible } from './dom-utils'
import type { RawFinding } from '../lib/types'
import { noteCut } from './scan-coverage'

const hex = (c: number[]) => `#${c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()}`

/** True when another element sits on top of this text (an image, a video, an overlay): its background cannot be known. */
function coveredByOther(el: Element, textNode: Node): boolean {
  const range = document.createRange()
  range.selectNodeContents(textNode)
  const r = range.getClientRects()[0]
  if (!r) return false
  const x = r.left + r.width / 2
  const y = r.top + r.height / 2
  if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return false
  const top = document.elementFromPoint(x, y)
  if (!top || top === el || top.contains(el)) return false
  if (!el.contains(top)) return true
  // something inside the element that is stacked over its text: a picture, a video, an overlay
  return /^(IMG|VIDEO|CANVAS|PICTURE|IFRAME|SVG|OBJECT|EMBED)$/i.test(top.tagName) || ['absolute', 'fixed'].includes(getComputedStyle(top).position)
}

type RGBA = [number, number, number, number]

function parseColor(value: string): RGBA | null {
  const m = /rgba?\(([^)]+)\)/.exec(value)
  if (!m) return null
  const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number)
  return [p[0], p[1], p[2], p[3] ?? 1]
}

const over = (top: RGBA, bottom: [number, number, number]): [number, number, number] => [
  top[3] * top[0] + (1 - top[3]) * bottom[0],
  top[3] * top[1] + (1 - top[3]) * bottom[1],
  top[3] * top[2] + (1 - top[3]) * bottom[2],
]

function luminance([r, g, b]: number[]): number {
  const f = (v: number) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

const ratioOf = (a: number[], b: number[]): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

function backgroundOf(el: Element): { color: [number, number, number]; image: boolean; translucent: boolean } {
  const layers: RGBA[] = []
  let image = false
  let translucent = false
  for (let node: Element | null = el; node; node = node.parentElement) {
    const cs = getComputedStyle(node)
    if (Number(cs.opacity) < 1) translucent = true
    if (cs.backgroundImage !== 'none') image = true
    const bg = parseColor(cs.backgroundColor)
    if (bg && bg[3] > 0) {
      layers.push(bg)
      if (bg[3] >= 1) break
    }
  }
  let color: [number, number, number] = [255, 255, 255]
  for (const layer of layers.reverse()) color = over(layer, color)
  return { color, image, translucent }
}

const BACKGROUND_WORDS: Record<string, string> = {
  'no-text-colour': 'a text colour a script cannot read (gradient or transparent fill)',
  image: 'a background image or gradient',
  covered: 'an image, video or overlay on top of the text',
  translucent: 'a translucent layer',
}

interface TextHit {
  el: Element
  text: string
  fg: number[]
  bg: number[]
  ratio: number
  threshold: number
  large: boolean
  size: number
  bold: boolean
  kind: 'ok' | 'fail' | 'unknown'
  reason: string
}

const MAX_LISTED = 200

/** One finding per text element that fails or cannot be judged; the passing text is one summary line. */
export function scanContrast(): { findings: RawFinding[]; els: Element[][] } {
  const hits: TextHit[] = []
  let checked = 0
  const seen = new Set<Element>()
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const skip = /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|OPTION)$/
  const MAX_NODES = 9000
  let n = walker.nextNode()
  for (let i = 0; n && i < MAX_NODES; n = walker.nextNode(), i++) {
    const text = (n.textContent ?? '').replace(/\s+/g, ' ').trim()
    const el = n.parentElement
    if (!text || !el || skip.test(el.tagName) || seen.has(el) || el.closest(`#${OVERLAY_ID}`) || !visible(el)) continue
    seen.add(el)
    const cs = getComputedStyle(el)
    const fgRaw = parseColor(cs.color)
    if (!fgRaw || fgRaw[3] === 0) continue
    const fill = parseColor(cs.getPropertyValue('-webkit-text-fill-color'))
    const noTextColor = Boolean(fill && fill[3] === 0)
    const bgInfo = backgroundOf(el)
    const fg = over(fgRaw, bgInfo.color)
    const size = parseFloat(cs.fontSize)
    const weight = Number(cs.fontWeight) || (cs.fontWeight === 'bold' ? 700 : 400)
    const bold = weight >= 700
    const large = size >= 24 || (bold && size >= 18.5)
    const threshold = large ? 3 : 4.5
    const ratio = ratioOf(fg, bgInfo.color)
    checked++
    const covered = coveredByOther(el, n)
    const reason = noTextColor ? 'no-text-colour' : bgInfo.image ? 'image' : covered ? 'covered' : bgInfo.translucent ? 'translucent' : ''
    const kind = reason ? 'unknown' : ratio >= threshold ? 'ok' : 'fail'
    hits.push({ el, text, fg, bg: bgInfo.color, ratio, threshold, large, size, bold, kind, reason })
  }
  if (n) {
    // the walk stopped at the limit: count what was left unexamined
    let left = 0
    for (; n; n = walker.nextNode()) left++
    noteCut('text nodes (contrast)', MAX_NODES, MAX_NODES + left)
  }

  const findings: RawFinding[] = []
  const els: Element[][] = []
  const ok = hits.filter((h) => h.kind === 'ok')
  const pairs = new Set(ok.map((h) => `${hex(h.fg)}|${hex(h.bg)}|${h.large}`))
  const problems = hits.filter((h) => h.kind !== 'ok')
  noteCut('contrast findings', MAX_LISTED, problems.length)
  findings.push({
    type: 'contrast-ok',
    id: 0,
    label: 'Text with sufficient contrast',
    summary: `${ok.length} text element(s) · ${pairs.size} colour pair(s)`,
    facts: {
      'Text elements checked': String(checked),
      'Sufficient contrast': String(ok.length),
      'To review (listed below)': String(Math.min(problems.length, MAX_LISTED)),
      'Not listed (limit)': problems.length > MAX_LISTED ? String(problems.length - MAX_LISTED) : null,
    },
    html: '',
    contextHtml: '',
    count: ok.length,
    data: { humanNeeded: false, checked, okCount: ok.length },
  })
  els.push([])

  const sameFail = new Map<string, number>()
  for (const h of problems) if (h.kind === 'fail') sameFail.set(`${hex(h.fg)}|${hex(h.bg)}|${h.large}`, (sameFail.get(`${hex(h.fg)}|${hex(h.bg)}|${h.large}`) ?? 0) + 1)

  problems.slice(0, MAX_LISTED).forEach((h) => {
    const snippet = h.text.length > 48 ? `${h.text.slice(0, 47)}…` : h.text
    const unknown = h.kind === 'unknown'
    const others = unknown ? 0 : (sameFail.get(`${hex(h.fg)}|${hex(h.bg)}|${h.large}`) ?? 1) - 1
    findings.push({
      type: unknown ? 'contrast-unknown' : 'contrast-fail',
      id: findings.length,
      label: `“${snippet}”`,
      summary: unknown
        ? `${h.reason === 'no-text-colour' ? 'text colour unknown' : hex(h.fg)} on ${BACKGROUND_WORDS[h.reason] ?? 'an unknown background'} · ratio cannot be computed`
        : `${hex(h.fg)} on ${hex(h.bg)} · ${h.ratio.toFixed(2)}:1 (needs ${h.threshold}:1)`,
      facts: {
        Text: h.text.length > 120 ? `${h.text.slice(0, 119)}…` : h.text,
        'Text colour': h.reason === 'no-text-colour' ? 'cannot be read' : hex(h.fg),
        Background: unknown ? `${BACKGROUND_WORDS[h.reason] ?? 'unknown'} — cannot be computed` : hex(h.bg),
        Ratio: unknown ? 'cannot be computed' : `${h.ratio.toFixed(2)}:1`,
        Required: `${h.threshold}:1 (${h.large ? 'large text' : 'normal text'})`,
        'Font size': `${Math.round(h.size)}px${h.bold ? ' bold' : ''}`,
        'Same colours on': others ? `${others} other element(s)` : null,
        Element: `<${h.el.tagName.toLowerCase()}>`,
      },
      html: shortHtml(h.el),
      contextHtml: boundedContext(h.el),
      count: 1,
      data: {
        humanNeeded: unknown,
        reason: h.reason,
        fg: h.reason === 'no-text-colour' ? null : hex(h.fg),
        bg: unknown ? null : hex(h.bg),
        large: h.large, ratio: Number(h.ratio.toFixed(2)), threshold: h.threshold },
    })
    els.push([h.el])
  })
  return { findings, els }
}
