/**
 * Visual aids for the manual checks, switched on and off from the panel ("page tools"):
 * reveal visually hidden content (and skip links), table structure (caption, scope, headers), tab order,
 * styles off, text spacing, language changes. Each tool draws on an overlay of its own or changes styles
 * temporarily; switching it off puts everything back.
 */
const OVERLAY_PREFIX = 'rgaa-assistant-overlay'
const TOOLS_ID = `${OVERLAY_PREFIX}-tools`

export type ToolName = 'reveal' | 'tables' | 'taborder' | 'nocss' | 'spacing' | 'lang' | 'headings' | 'loosetext'

/** What a bounding box of the page (in the page's own coordinates) says about where to draw. */
const pageRect = (el: { getBoundingClientRect(): DOMRect }) => {
  const r = el.getBoundingClientRect()
  return { left: r.left + window.scrollX, top: r.top + window.scrollY, width: r.width, height: r.height }
}

const mine = (el: Element) => Boolean(el.closest(`[id^="${OVERLAY_PREFIX}"]`))

/* ------------------------------------------------------------------ */
/* Visually hidden content                                              */
/* ------------------------------------------------------------------ */

export type HiddenKind = 'visually-hidden' | 'aria-hidden' | null

/**
 * Is this element there for assistive technologies only (visually hidden), or hidden from them (aria-hidden)?
 * An element with display:none or visibility:hidden is hidden from everyone: it is not "hidden content" here.
 */
export function hiddenKind(el: Element): HiddenKind {
  const cs = getComputedStyle(el)
  if (cs.display === 'none' || cs.visibility === 'hidden') return null
  if (el.closest('[aria-hidden="true"]')) return 'aria-hidden'
  const r = el.getBoundingClientRect()
  const clipped = cs.clip.replace(/\s/g, '') === 'rect(0px,0px,0px,0px)' || cs.clip.replace(/\s/g, '') === 'rect(1px,1px,1px,1px)' || /inset\((50|100)%\)/.test(cs.clipPath)
  const tiny = (r.width <= 2 || r.height <= 2) && (el.scrollWidth > 2 || el.scrollHeight > 2 || (el.textContent ?? '').trim().length > 0)
  const offscreen = r.right + window.scrollX < 0 || r.bottom + window.scrollY < 0 || r.left + window.scrollX < -500 || r.top + window.scrollY < -500
  const textHidden = parseFloat(cs.textIndent) <= -500
  const transparent = Number(cs.opacity) === 0
  if (clipped || tiny || offscreen || textHidden || transparent) return 'visually-hidden'
  for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
    const pc = getComputedStyle(node)
    if (pc.overflow !== 'visible' && (node.getBoundingClientRect().width <= 2 || node.getBoundingClientRect().height <= 2)) return 'visually-hidden'
  }
  return null
}

const REVEAL_ATTR = 'data-rgaa-revealed'
const revealed = new Map<HTMLElement, string | null>()
const REVEAL_STYLE: [string, string][] = [
  ['position', 'static'], ['clip', 'auto'], ['clip-path', 'none'], ['width', 'auto'], ['height', 'auto'], ['min-width', '0'], ['min-height', '0'],
  ['max-width', 'none'], ['max-height', 'none'], ['margin', '0'], ['padding', '2px'], ['overflow', 'visible'], ['opacity', '1'], ['text-indent', '0'],
  ['white-space', 'normal'], ['left', 'auto'], ['top', 'auto'], ['transform', 'none'],
  ['outline', '3px dashed #d946ef'], ['background-color', 'rgba(217, 70, 239, 0.14)'], ['color', '#111'], ['z-index', 'auto'], ['display', 'block'],
]

const CANDIDATES = 'a[href], table, caption, [role="table"], h1, h2, h3, h4, h5, h6, [role="heading"], input:not([type=hidden]), select, textarea, button, [role="button"], nav, header, footer, main, aside, section, form, label, p, span, div, ul, li'

function revealOne(el: HTMLElement): void {
  if (revealed.has(el)) return
  revealed.set(el, el.getAttribute('style'))
  el.setAttribute(REVEAL_ATTR, '1')
  for (const [prop, value] of REVEAL_STYLE) {
    // a table, a list or an inline element keeps its own display
    if (prop === 'display' && (['TABLE', 'CAPTION', 'UL', 'OL', 'LI', 'TR', 'TD', 'TH', 'A', 'SPAN', 'LABEL', 'INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(el.tagName) || getComputedStyle(el).display !== 'block')) continue
    el.style.setProperty(prop, value, 'important')
  }
}

function setReveal(on: boolean): number {
  if (!on) {
    for (const [el, style] of revealed) {
      el.removeAttribute(REVEAL_ATTR)
      if (style === null) el.removeAttribute('style')
      else el.setAttribute('style', style)
    }
    const n = revealed.size
    revealed.clear()
    return n
  }
  for (const el of Array.from(document.querySelectorAll<HTMLElement>(CANDIDATES))) {
    if (mine(el) || el.hasAttribute(REVEAL_ATTR)) continue
    if (hiddenKind(el) !== 'visually-hidden') continue
    // reveal the outermost hidden element only; its children come with it
    const parentHidden = el.parentElement && hiddenKind(el.parentElement) === 'visually-hidden'
    if (parentHidden) continue
    revealOne(el)
  }
  // an ancestor can hide its children by clipping (overflow hidden at 1px): open those too
  for (const el of Array.from(revealed.keys())) for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) if (hiddenKind(n) === 'visually-hidden') revealOne(n as HTMLElement)
  return revealed.size
}

/* ------------------------------------------------------------------ */
/* Overlay helpers                                                      */
/* ------------------------------------------------------------------ */

function toolLayer(name: string): HTMLElement {
  let root = document.getElementById(TOOLS_ID)
  if (!root) {
    root = document.createElement('div')
    root.id = TOOLS_ID
    root.style.cssText = 'position:absolute;top:0;left:0;width:0;height:0;z-index:2147483645;pointer-events:none;'
    document.body.appendChild(root)
  }
  let layer = root.querySelector<HTMLElement>(`[data-tool="${name}"]`)
  if (!layer) {
    layer = document.createElement('div')
    layer.dataset.tool = name
    root.appendChild(layer)
  }
  layer.replaceChildren()
  return layer
}

function dropLayer(name: string): void {
  document.getElementById(TOOLS_ID)?.querySelector(`[data-tool="${name}"]`)?.remove()
}

function badge(layer: HTMLElement, el: { getBoundingClientRect(): DOMRect }, text: string, color: string, outline = true): void {
  const r = pageRect(el)
  if (!r.width && !r.height) return
  const box = document.createElement('div')
  box.style.cssText = `position:absolute;left:${r.left}px;top:${r.top}px;width:${Math.max(r.width, 4)}px;height:${Math.max(r.height, 4)}px;box-sizing:border-box;${outline ? `outline:2px solid ${color};outline-offset:-1px;background:${color}22;` : ''}`
  const tag = document.createElement('span')
  tag.textContent = text
  tag.style.cssText = `position:absolute;left:0;top:0;transform:translateY(-100%);background:${color};color:#fff;font:600 11px/1.3 system-ui,sans-serif;padding:0 4px;border-radius:3px 3px 0 0;white-space:nowrap;max-width:260px;overflow:hidden;text-overflow:ellipsis;`
  box.appendChild(tag)
  layer.appendChild(box)
}

/* ------------------------------------------------------------------ */
/* Tables: caption, scope, headers                                      */
/* ------------------------------------------------------------------ */

/** Table captions this tool unhid itself (so switching it off puts only those back). */
const unhidCaptions = new Set<HTMLElement>()

function restoreCaptions(): void {
  for (const el of unhidCaptions) {
    const style = revealed.get(el)
    el.removeAttribute(REVEAL_ATTR)
    if (style === null) el.removeAttribute('style')
    else if (style !== undefined) el.setAttribute('style', style)
    revealed.delete(el)
  }
  unhidCaptions.clear()
}

function drawTables(): number {
  const layer = toolLayer('tables')
  let n = 0
  // a caption hidden for sighted users (visually hidden text) is shown, so its place and wording can be judged
  for (const cap of Array.from(document.querySelectorAll<HTMLElement>('caption'))) {
    if (!mine(cap) && !cap.hasAttribute(REVEAL_ATTR) && hiddenKind(cap) === 'visually-hidden') {
      revealOne(cap)
      unhidCaptions.add(cap)
    }
  }
  for (const t of Array.from(document.querySelectorAll('table, [role="table"], [role="grid"]')).slice(0, 80)) {
    if (mine(t)) continue
    n++
    const cap = (t.querySelector('caption')?.textContent ?? t.getAttribute('aria-label') ?? '').replace(/\s+/g, ' ').trim()
    const role = (t.getAttribute('role') ?? '').toLowerCase()
    const layout = role === 'presentation' || role === 'none'
    badge(layer, t, layout ? 'table: layout (presentation)' : cap ? `caption${t.querySelector('caption')?.hasAttribute(REVEAL_ATTR) ? ' (was hidden)' : ''}: “${cap}”` : 'table: NO caption / title', layout ? '#64748b' : cap ? '#0f766e' : '#b45309')
    for (const c of Array.from(t.querySelectorAll('th, [role="columnheader"], [role="rowheader"]')).slice(0, 400)) {
      const scope = c.getAttribute('scope')
      const id = c.getAttribute('id')
      const r = (c.getAttribute('role') ?? '').toLowerCase()
      const text = `${c.tagName.toLowerCase()}${scope ? ` scope=${scope}` : r ? ` ${r}` : ' (no scope)'}${id ? ` #${id}` : ''}`
      badge(layer, c, text, scope === 'col' || scope === 'colgroup' || r === 'columnheader' ? '#2563eb' : scope === 'row' || scope === 'rowgroup' || r === 'rowheader' ? '#16a34a' : '#ea580c')
    }
    for (const c of Array.from(t.querySelectorAll('td[headers], [role="cell"][aria-describedby]')).slice(0, 400)) {
      const ids = (c.getAttribute('headers') ?? '').split(/\s+/).filter(Boolean)
      const missing = ids.filter((id) => !document.getElementById(id))
      badge(layer, c, `headers: ${ids.join(' ') || '—'}${missing.length ? ` ✕ missing: ${missing.join(' ')}` : ''}`, missing.length ? '#dc2626' : '#7c3aed')
    }
  }
  return n
}

/* ------------------------------------------------------------------ */
/* Tab order                                                            */
/* ------------------------------------------------------------------ */

const FOCUSABLE = 'a[href], area[href], button, input:not([type=hidden]), select, textarea, summary, iframe, [contenteditable=""], [contenteditable="true"], [tabindex], audio[controls], video[controls]'

export function tabOrder(): Element[] {
  const all = Array.from(document.querySelectorAll(FOCUSABLE)).filter((el) => {
    if (mine(el) || (el as HTMLButtonElement).disabled) return false
    const ti = el.getAttribute('tabindex')
    if (ti !== null && Number(ti) < 0) return false
    const cs = getComputedStyle(el)
    return cs.display !== 'none' && cs.visibility !== 'hidden'
  })
  const positive = all.filter((el) => Number(el.getAttribute('tabindex')) > 0).sort((a, b) => Number(a.getAttribute('tabindex')) - Number(b.getAttribute('tabindex')))
  return [...positive, ...all.filter((el) => !(Number(el.getAttribute('tabindex')) > 0))]
}

function drawTabOrder(): number {
  const layer = toolLayer('taborder')
  const list = tabOrder().slice(0, 400)
  const points: string[] = []
  list.forEach((el, i) => {
    const r = pageRect(el)
    const hidden = hiddenKind(el) === 'visually-hidden'
    const positive = Number(el.getAttribute('tabindex')) > 0
    const color = positive ? '#dc2626' : hidden ? '#d946ef' : '#0369a1'
    const x = r.left + Math.min(r.width, 12) / 2
    const y = r.top + Math.min(r.height, 12) / 2
    points.push(`${x},${y}`)
    const b = document.createElement('div')
    b.textContent = String(i + 1)
    b.title = `${el.tagName.toLowerCase()}${positive ? ` tabindex=${el.getAttribute('tabindex')}` : ''}${hidden ? ' (visually hidden)' : ''}`
    b.style.cssText = `position:absolute;left:${r.left - 4}px;top:${r.top - 4}px;min-width:18px;height:18px;border-radius:9px;background:${color};color:#fff;font:700 11px/18px system-ui,sans-serif;text-align:center;padding:0 3px;box-sizing:border-box;box-shadow:0 0 0 2px #fff;`
    layer.appendChild(b)
  })
  if (points.length > 1) {
    const w = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)
    const h = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('width', String(w))
    svg.setAttribute('height', String(h))
    svg.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;'
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline')
    line.setAttribute('points', points.join(' '))
    line.setAttribute('fill', 'none')
    line.setAttribute('stroke', '#0369a1')
    line.setAttribute('stroke-width', '1.5')
    line.setAttribute('stroke-opacity', '0.55')
    svg.appendChild(line)
    layer.prepend(svg)
  }
  return list.length
}

/* ------------------------------------------------------------------ */
/* Style sheets off, text spacing, language                              */
/* ------------------------------------------------------------------ */

const disabledSheets: CSSStyleSheet[] = []
const strippedStyles = new Map<HTMLElement, string>()

function setNoCss(on: boolean): number {
  if (on) {
    for (const sheet of Array.from(document.styleSheets)) {
      if (!sheet.disabled && !(sheet.ownerNode instanceof Element && mine(sheet.ownerNode))) {
        sheet.disabled = true
        disabledSheets.push(sheet)
      }
    }
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('[style]'))) {
      if (mine(el)) continue
      strippedStyles.set(el, el.getAttribute('style') ?? '')
      el.removeAttribute('style')
    }
    return disabledSheets.length
  }
  for (const sheet of disabledSheets.splice(0)) sheet.disabled = false
  for (const [el, style] of strippedStyles) el.setAttribute('style', style)
  strippedStyles.clear()
  return 0
}

function setSpacing(on: boolean): void {
  const id = `${OVERLAY_PREFIX}-spacing`
  document.getElementById(id)?.remove()
  if (!on) return
  const style = document.createElement('style')
  style.id = id
  style.textContent = '* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }'
  document.head.appendChild(style)
}

function drawLang(): number {
  const layer = toolLayer('lang')
  const htmlLang = document.documentElement.getAttribute('lang') ?? ''
  badge(layer, document.body, `<html lang="${htmlLang || '—'}">`, htmlLang ? '#0f766e' : '#dc2626', false)
  let n = 0
  for (const el of Array.from(document.querySelectorAll('[lang]:not(html)')).slice(0, 300)) {
    if (mine(el)) continue
    n++
    badge(layer, el, `lang=${el.getAttribute('lang')}`, '#7c3aed')
  }
  return n
}

/* ------------------------------------------------------------------ */
/* Headings map and loose text (theme 9)                                */
/* ------------------------------------------------------------------ */

export function headingLevel(el: Element): number {
  const m = /^H([1-6])$/.exec(el.tagName)
  if (m) return Number(m[1])
  const aria = Number(el.getAttribute('aria-level'))
  return aria >= 1 && aria <= 6 ? aria : 2
}

export const isHeading = (el: Element): boolean => /^H[1-6]$/.test(el.tagName) || el.getAttribute('role') === 'heading'

const LEVEL_COLORS = ['#1d4ed8', '#0f766e', '#7c3aed', '#b45309', '#be185d', '#475569']

function drawHeadings(): number {
  const layer = toolLayer('headings')
  let previous = 0
  let n = 0
  for (const el of Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]')).slice(0, 400)) {
    if (mine(el) || !el.getClientRects().length) continue
    n++
    const level = headingLevel(el)
    const skipped = level > previous + 1
    const empty = !(el.textContent ?? '').trim()
    const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim()
    badge(layer, el, `H${level}${skipped ? ` ✕ skips from H${previous || 'none'}` : ''}${empty ? ' ✕ empty' : ` · ${text.slice(0, 50)}`}`, skipped || empty ? '#dc2626' : LEVEL_COLORS[level - 1])
    previous = level
  }
  return n
}

/** Elements that give a text its meaning: a text inside one of them is not “loose”. */
const TEXT_CONTEXT = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'DT', 'DD', 'TD', 'TH', 'CAPTION', 'FIGCAPTION', 'A', 'BUTTON', 'LABEL', 'LEGEND', 'SUMMARY', 'OPTION', 'BLOCKQUOTE', 'PRE', 'CITE', 'Q', 'ADDRESS', 'TIME', 'CODE', 'OUTPUT', 'TEXTAREA', 'SELECT', 'DATALIST', 'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'TITLE', 'SVG', 'MATH', 'OBJECT', 'IFRAME', 'DIALOG'])
const ROLE_CONTEXT = new Set(['heading', 'button', 'link', 'listitem', 'cell', 'gridcell', 'columnheader', 'rowheader', 'tab', 'menuitem', 'option', 'treeitem', 'caption', 'term', 'definition', 'paragraph', 'alert', 'status', 'tooltip', 'checkbox', 'radio', 'switch', 'textbox', 'img'])

/** Text nodes that sit in a plain div / span / section… with no paragraph, heading, list item, link, button or label around them. */
export function looseTextNodes(): Text[] {
  const found: Text[] = []
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node && found.length < 400; node = walker.nextNode()) {
    const text = node as Text
    if (!(text.data ?? '').trim()) continue
    const owner = text.parentElement
    let contextual = false
    for (let el = owner; el; el = el.parentElement) {
      if (TEXT_CONTEXT.has(el.tagName.toUpperCase()) || ROLE_CONTEXT.has((el.getAttribute('role') ?? '').toLowerCase()) || mine(el)) {
        contextual = true
        break
      }
    }
    if (contextual || !owner) continue
    const range = document.createRange()
    range.selectNodeContents(text)
    if (!range.getClientRects().length) continue
    found.push(text)
  }
  return found
}

function drawLoose(): number {
  const layer = toolLayer('loosetext')
  const nodes = looseTextNodes()
  for (const node of nodes) {
    const range = document.createRange()
    range.selectNodeContents(node)
    badge(layer, range, `<${node.parentElement!.tagName.toLowerCase()}> loose text`, '#ea580c')
  }
  return nodes.length
}

/* ------------------------------------------------------------------ */
/* Switch                                                               */
/* ------------------------------------------------------------------ */

const active = new Set<ToolName>()

/** Puts an overlay tool back where it belongs after the page changed (boxes after a reveal, a resize…). */
export function refreshTools(): void {
  if (active.has('tables')) drawTables()
  if (active.has('taborder')) drawTabOrder()
  if (active.has('lang')) drawLang()
  if (active.has('headings')) drawHeadings()
  if (active.has('loosetext')) drawLoose()
}

export function runTool(tool: ToolName, on: boolean, afterLayout: () => void): { ok: boolean; count?: number } {
  if (on) active.add(tool)
  else active.delete(tool)
  let count = 0
  switch (tool) {
    case 'reveal':
      count = setReveal(on)
      afterLayout()
      refreshTools()
      break
    case 'tables':
      if (on) count = drawTables()
      else {
        dropLayer('tables')
        restoreCaptions()
      }
      break
    case 'taborder':
      if (on) count = drawTabOrder()
      else dropLayer('taborder')
      break
    case 'nocss':
      count = setNoCss(on)
      afterLayout()
      refreshTools()
      break
    case 'spacing':
      setSpacing(on)
      afterLayout()
      refreshTools()
      break
    case 'lang':
      if (on) count = drawLang()
      else dropLayer('lang')
      break
    case 'headings':
      if (on) count = drawHeadings()
      else dropLayer('headings')
      break
    case 'loosetext':
      if (on) count = drawLoose()
      else dropLayer('loosetext')
      break
  }
  return { ok: true, count }
}

export function resetTools(afterLayout: () => void): void {
  for (const tool of Array.from(active)) runTool(tool, false, afterLayout)
}
