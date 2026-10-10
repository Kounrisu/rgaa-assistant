import type { ImageElementInfo, RawFinding } from '../lib/types'
// --- Asqatasun-derived: begin ---
// Imported by this script only (no other file imports the table), so it stays inside this bundle.
import { ASQ_CRITERION_TESTS, ASQ_NA_TEXT, ASQ_RULES, type AsqExtra, type AsqRule } from '../lib/asqatasun-rules'
// --- Asqatasun-derived: end ---

const OVERLAY_ID = 'rgaa-assistant-overlay'
const STYLE_ID = 'rgaa-assistant-style'
const FOCUS_COLOR = '#facc15'
// The panel sends each theme's colour with its scan (single source: lib/theme-colors.ts).
// This file must stay free of shared imports: a shared chunk would turn it into an ES module,
// which a content script cannot be.
const DEFAULT_COLOR = '#e11d48'

// Reloading the extension leaves the previous copy of this script, and the boxes it drew, in the page.
// A new copy removes those boxes and takes over; an older copy goes quiet (see `isCurrent`).
const INSTANCE = `${Date.now()}-${Math.random()}`
document.documentElement.dataset.rgaaInstance = INSTANCE
const isCurrent = (): boolean => document.documentElement.dataset.rgaaInstance === INSTANCE
/** Removes every overlay container with this id, even duplicates left by an older copy. */
function removeById(id: string): void {
  document.querySelectorAll(`[id="${id}"]`).forEach((node) => node.remove())
}
function purgeOverlays(): void {
  document.querySelectorAll('[id^="rgaa-assistant-overlay"], [id="rgaa-assistant-style"]').forEach((node) => node.remove())
}
purgeOverlays()
let imageColor = DEFAULT_COLOR

/** "#e11d48" → "rgba(225, 29, 72, 0.12)" */
function tint(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

const boxes = new Map<number, { img: Element; box: HTMLElement }>()
let focusedId: number | null = null

// Ids stay stable across rescans so answers survive popins opening and closing.
let registry = new WeakMap<Element, number>()
let nextId = 1
let observer: MutationObserver | null = null
let observeTimer: number | undefined
/** Which theme's boxes are shown. The panel decides: only the theme you are in, if its toggle is on. */
const shown: Record<number, boolean> = {}
const isShown = (theme: number): boolean => shown[theme] !== false

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    @keyframes rgaa-assistant-pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.02); }
    }
    @media (prefers-reduced-motion: reduce) {
      #${OVERLAY_ID} [data-focused="true"] { animation: none !important; }
    }
  `
  document.head.appendChild(style)
}

function clearOverlay(): void {
  removeById(OVERLAY_ID)
  document.getElementById(STYLE_ID)?.remove()
  boxes.clear()
  focusedId = null
}

function setFocused(id: number | null): void {
  if (focusedId !== null) {
    const prev = boxes.get(focusedId)
    if (prev) styleBox(prev.box, false)
  }
  focusedId = id
  if (id === null) return
  const current = boxes.get(id)
  if (current) styleBox(current.box, true)
}

/** How a box looks according to where its review stands (sent by the panel). */
const STATE_STYLE: Record<string, { color: string; dash: string; width: number; glyph: string; glow: boolean }> = {
  error: { color: '#ff1744', dash: 'solid', width: 4, glyph: '!', glow: true },
  review: { color: '#ff1744', dash: 'dashed', width: 3, glyph: '?', glow: true },
  ignored: { color: '#7f1d1d', dash: 'dashed', width: 2, glyph: '', glow: false },
  c: { color: '#16a34a', dash: 'solid', width: 3, glyph: '✓', glow: false },
  nc: { color: '#ff1744', dash: 'solid', width: 4, glyph: '✕', glow: true },
}

/** Alt text written next to each image box (toggle in the panel). */
let showAlt = false

/** The text of a box's label: its number, a mark for its state, and optionally what the page says as alternative. */
function refreshLabel(box: HTMLElement): void {
  const label = box.firstElementChild as HTMLElement | null
  if (!label) return
  const glyph = STATE_STYLE[box.dataset.state ?? '']?.glyph
  const alt = showAlt && box.dataset.alt ? ` · ${box.dataset.alt}` : ''
  label.textContent = `${glyph ? `${glyph} ` : ''}${box.dataset.id ?? ''}${alt}`
  label.style.whiteSpace = 'nowrap'
  label.style.maxWidth = showAlt ? '360px' : ''
  label.style.overflow = showAlt ? 'hidden' : ''
  label.style.textOverflow = showAlt ? 'ellipsis' : ''
}

/** The yellow border and wash on the focused element hide its real colours; the panel can turn them off. */
let focusTint = true

function styleBox(box: HTMLElement, focused: boolean): void {
  const label = box.firstElementChild as HTMLElement
  const color = box.dataset.color ?? DEFAULT_COLOR
  box.dataset.focused = String(focused)
  if (focused && !focusTint) {
    // plain mode: a thin black dashed line with a white halo (readable on any background, no colour cast on the element)
    box.style.border = '2px dashed #111'
    box.style.background = 'transparent'
    box.style.boxShadow = '0 0 0 2px #fff'
    box.style.animation = 'none'
    box.style.zIndex = '1'
    label.style.background = '#111'
    label.style.color = '#fff'
    label.style.fontSize = '14px'
  } else if (focused) {
    box.style.border = `4px solid ${FOCUS_COLOR}`
    box.style.background = 'rgba(250, 204, 21, 0.25)'
    box.style.boxShadow = `0 0 0 3px ${color}, 0 0 0 5px #000${box.dataset.dim === '1' ? ', 0 0 0 9999px rgba(0, 0, 0, 0.3)' : ''}`
    box.style.animation = 'rgaa-assistant-pulse 0.9s ease-in-out 3'
    box.style.zIndex = '1'
    label.style.background = FOCUS_COLOR
    label.style.color = '#000'
    label.style.fontSize = '16px'
  } else {
    const st = STATE_STYLE[box.dataset.state ?? '']
    const c = st?.color ?? color
    box.style.border = `${st?.width ?? 3}px ${st?.dash ?? 'solid'} ${c}`
    box.style.background = tint(c, st?.glow ? 0.16 : 0.1)
    box.style.boxShadow = st?.glow ? `0 0 0 1px #fff, 0 0 10px 2px ${tint(c, 0.75)}` : '0 0 0 1px #fff'
    box.style.animation = 'none'
    box.style.zIndex = '0'
    label.style.background = c
    label.style.color = '#fff'
    label.style.fontSize = '12px'
  }
}

function focusImage(id: number, scroll: boolean): boolean {
  const entry = boxes.get(id)
  if (!entry) return false
  if (scroll) {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    entry.img.scrollIntoView({ block: 'center', inline: 'center', behavior: reduce ? 'auto' : 'smooth' })
  }
  setFocused(id)
  return true
}

function nearbyTextFor(img: Element): string | null {
  const figcaption = img.closest('figure')?.querySelector('figcaption')
  if (figcaption?.textContent?.trim()) return figcaption.textContent.trim()

  const describedBy = img.getAttribute('aria-describedby')
  if (describedBy) {
    const text = describedBy
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent?.trim())
      .filter(Boolean)
      .join(' ')
    if (text) return text
  }

  const parentText = img.parentElement?.textContent?.trim()
  return parentText ? parentText.slice(0, 200) : null
}

function altMatchesFilenamePattern(alt: string | null, src: string): boolean {
  if (!alt) return false
  const filename = src.split('/').pop()?.split('?')[0] ?? ''
  if (!filename) return false
  const normalizedAlt = alt.trim().toLowerCase()
  const normalizedFilename = filename.toLowerCase()
  return (
    normalizedAlt === normalizedFilename ||
    normalizedAlt === normalizedFilename.replace(/\.[a-z0-9]+$/, '') ||
    /\.(png|jpe?g|gif|svg|webp)$/i.test(normalizedAlt)
  )
}

const MAX_HTML = 4000
const IMAGE_SELECTOR = 'img, svg, [role="img"], input[type="image"], area, object[type^="image"], embed[type^="image"], canvas'

type Candidate = Element

function trimSvg(svg: Element): void {
  const keep = Array.from(svg.children).filter((c) => /^(title|desc)$/i.test(c.tagName))
  const more = svg.children.length - keep.length
  svg.replaceChildren(...keep)
  if (more > 0) svg.append(document.createComment(` … ${more} more element(s) `))
}

function labelledByTextFor(el: Element): string | null {
  const ids = el.getAttribute('aria-labelledby')
  if (!ids) return null
  const text = ids
    .split(/\s+/)
    .map((id) => document.getElementById(id)?.textContent?.trim())
    .filter(Boolean)
    .join(' ')
  return text || null
}

function svgTitleFor(el: Element): string | null {
  if (el.tagName.toLowerCase() !== 'svg') return null
  const title = Array.from(el.children).find((c) => c.tagName.toLowerCase() === 'title')
  return title?.textContent?.trim() || null
}

function typeOf(el: Element): string {
  const tag = el.tagName.toLowerCase()
  if (tag === 'input') return 'input-image'
  if (tag !== 'img' && el.getAttribute('role') === 'img') return `role-img (${tag})`
  return tag
}

function hasExplicitHiddenAncestor(el: Element): boolean {
  return el.closest('[aria-hidden="true"]') !== null
}

/** Why assistive tech ignores this element, or null if it exposes it. */
function ignoredByFor(el: Element, hasName: boolean): string | null {
  if (el.closest('[aria-hidden="true"]')) {
    return el.getAttribute('aria-hidden') === 'true' ? 'aria-hidden="true"' : 'aria-hidden="true" on a parent'
  }
  const role = el.getAttribute('role')
  if (role === 'presentation' || role === 'none') return `role="${role}"`
  const tag = el.tagName.toLowerCase()
  if ((tag === 'img' || tag === 'input' || tag === 'area') && el.getAttribute('alt') === '' && !hasName) return 'alt=""'
  return null
}

function thumbFor(el: Element, rect: DOMRect): string | null {
  const tag = el.tagName.toLowerCase()
  try {
    if (tag === 'img') return (el as HTMLImageElement).currentSrc || (el as HTMLImageElement).src
    if (tag === 'input') return (el as HTMLInputElement).src
    if (tag === 'object') return (el as HTMLObjectElement).data
    if (tag === 'embed') return (el as HTMLEmbedElement).src
    if (tag === 'canvas') return (el as HTMLCanvasElement).toDataURL('image/png')
    if (tag === 'svg') {
      const clone = el.cloneNode(true) as SVGElement
      clone.querySelectorAll('script').forEach((n) => n.remove())
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
      clone.setAttribute('width', String(Math.round(rect.width)))
      clone.setAttribute('height', String(Math.round(rect.height)))
      clone.style.color = getComputedStyle(el).color
      return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(clone))}`
    }
  } catch {
    /* tainted canvas, etc. */
  }
  return null
}

function ownHtmlFor(el: Element): string {
  const tag = el.tagName.toLowerCase()
  const clone = el.cloneNode(tag === 'svg' || tag === 'canvas' || tag === 'object') as Element
  if (tag === 'svg') trimSvg(clone)
  const html = clone.outerHTML
  return html.length > MAX_HTML ? html.slice(0, MAX_HTML) + ' …' : html
}

function contextHtmlFor(el: Element): string {
  const context = el.closest('a, button, figure, picture') ?? el.parentElement ?? el
  const clone = context.cloneNode(true) as Element
  clone.querySelectorAll('script, style, noscript').forEach((n) => n.remove())
  const index = Array.from(context.querySelectorAll('*')).indexOf(el)
  const target = context === el ? clone : clone.querySelectorAll('*')[index]
  target?.setAttribute('data-rgaa-target', '')
  clone.querySelectorAll('svg').forEach(trimSvg)
  const html = clone.outerHTML
  return html.length > MAX_HTML ? html.slice(0, MAX_HTML) + ' …' : html
}

function deterministicChecksFor(el: Element, alt: string | null, src: string | null): Record<string, boolean> {
  return {
    altMissing: ['img', 'input', 'area'].includes(el.tagName.toLowerCase()) && alt === null,
    altEmpty: alt === '',
    altMatchesFilenamePattern: altMatchesFilenamePattern(alt, src ?? ''),
    ariaHidden: hasExplicitHiddenAncestor(el),
  }
}

/** Elements to audit: no nested duplicates inside an svg, each element once. */
function findCandidates(): Candidate[] {
  const all = Array.from(document.querySelectorAll(IMAGE_SELECTOR))
  return all.filter((el) => {
    const parentSvg = el.parentElement?.closest('svg')
    return !parentSvg
  })
}

function rectFor(el: Element): DOMRect {
  if (el.tagName.toLowerCase() === 'area') {
    const map = el.closest('map')
    const name = map?.getAttribute('name') ?? map?.id
    const img = name ? document.querySelector<HTMLElement>(`img[usemap="#${CSS.escape(name)}"]`) : null
    if (img) return img.getBoundingClientRect()
  }
  return el.getBoundingClientRect()
}

function isFixed(el: Element): boolean {
  for (let node: Element | null = el; node; node = node.parentElement) {
    if (getComputedStyle(node).position === 'fixed') return true
  }
  return false
}

function drawBox(container: HTMLElement, id: number, img: Element, rect: DOMRect, alt: string): void {
  const box = document.createElement('div')
  const fixed = isFixed(img)
  box.style.cssText = `
    position: ${fixed ? 'fixed' : 'absolute'};
    left: ${rect.left + (fixed ? 0 : window.scrollX)}px;
    top: ${rect.top + (fixed ? 0 : window.scrollY)}px;
    width: ${rect.width}px;
    height: ${rect.height}px;
    box-sizing: border-box;
    pointer-events: none;
  `
  const label = document.createElement('span')
  label.textContent = String(id)
  label.style.cssText = `
    position: absolute;
    top: -1px;
    left: -1px;
    transform: translateY(-100%);
    color: #fff;
    font: bold 12px/1.4 sans-serif;
    padding: 1px 5px;
    border-radius: 2px 2px 0 0;
  `
  box.appendChild(label)
  box.dataset.color = imageColor
  box.dataset.dim = '1'
  box.dataset.id = String(id)
  box.dataset.alt = alt
  box.dataset.state = imageStates[id] ?? ''
  container.appendChild(box)
  refreshLabel(box)
  styleBox(box, false)
  boxes.set(id, { img, box })
}

/** What the page offers as text alternative, in a few words, for the label next to the image. */
function altSummaryFor(el: Element): string {
  const tag = el.tagName.toLowerCase()
  const q = (v: string) => `“${v.replace(/\s+/g, ' ').trim().slice(0, 80)}”`
  const alt = ['img', 'input', 'area'].includes(tag) ? el.getAttribute('alt') : null
  const labelled = labelledByTextFor(el)
  if (labelled) return `aria-labelledby ${q(labelled)}`
  const aria = el.getAttribute('aria-label')
  if (aria) return `aria-label ${q(aria)}`
  if (alt) return `alt ${q(alt)}`
  const svg = svgTitleFor(el)
  if (svg) return `title ${q(svg)}`
  const title = el.getAttribute('title')
  if (title) return `title ${q(title)}`
  if (alt === '') return 'alt=""'
  if (hasExplicitHiddenAncestor(el)) return 'aria-hidden'
  return 'no alternative'
}

const imageStates: Record<number, string> = {}

function highlightImages(): ImageElementInfo[] {
  clearOverlay()

  const container = document.createElement('div')
  container.id = OVERLAY_ID
  ensureStyle()
  container.style.cssText = 'position: absolute; top: 0; left: 0; z-index: 2147483647; pointer-events: none;'
  container.style.display = isShown(1) ? '' : 'none'
  document.body.appendChild(container)

  const elements: ImageElementInfo[] = []

  findCandidates().forEach((el) => {
    const rect = rectFor(el)
    if (rect.width === 0 || rect.height === 0) return

    let id = registry.get(el)
    if (id === undefined) {
      id = nextId++
      registry.set(el, id)
    }
    drawBox(container, id, el, rect, altSummaryFor(el))

    const tag = el.tagName.toLowerCase()
    const alt = ['img', 'input', 'area'].includes(tag) ? el.getAttribute('alt') : null
    const ariaLabel = el.getAttribute('aria-label')
    const labelledByText = labelledByTextFor(el)
    const title = el.getAttribute('title')
    const svgTitle = svgTitleFor(el)
    const accessibleName = labelledByText || ariaLabel || alt || svgTitle || title || null
    const thumb = thumbFor(el, rect)
    const src = tag === 'img' || tag === 'input' || tag === 'embed' || tag === 'object' ? thumb : null

    elements.push({
      id,
      tag,
      type: typeOf(el),
      src,
      thumb,
      alt,
      ariaLabel,
      labelledByText,
      title,
      svgTitle,
      accessibleName,
      ignoredBy: ignoredByFor(el, Boolean(ariaLabel || labelledByText || title || svgTitle)),
      role: el.getAttribute('role'),
      ariaHidden: hasExplicitHiddenAncestor(el),
      inDialog: el.closest('dialog, [role="dialog"], [role="alertdialog"], [aria-modal="true"]') !== null,
      nearbyText: nearbyTextFor(el),
      isInsideLink: el.closest('a') !== null,
      linkHref: el.closest('a')?.getAttribute('href') ?? null,
      linkText: el.closest('a')?.textContent?.trim().slice(0, 200) || null,
      figcaption: el.closest('figure')?.querySelector('figcaption')?.textContent?.trim() || null,
      naturalWidth: tag === 'img' ? (el as HTMLImageElement).naturalWidth : Math.round(rect.width),
      naturalHeight: tag === 'img' ? (el as HTMLImageElement).naturalHeight : Math.round(rect.height),
      html: ownHtmlFor(el),
      contextHtml: contextHtmlFor(el),
      deterministic: deterministicChecksFor(el, alt, src && !src.startsWith('data:') ? src : null),
    })
  })

  return elements
}


/* ------------------------------------------------------------------ */
/* Other element-based themes: frames (2) and colours (3)               */
/* ------------------------------------------------------------------ */

interface ThemeOverlay {
  color: string
  container: HTMLElement
  items: Map<number, { els: Element[]; boxes: HTMLElement[]; persistent: boolean }>
  focused: number | null
}
const themeOverlays = new Map<number, ThemeOverlay>()
const themeStates = new Map<ThemeOverlay, Record<number, string>>()

function themeOverlayFor(theme: number, color: string): ThemeOverlay {
  let overlay = themeOverlays.get(theme)
  if (overlay) {
    overlay.color = color
    overlay.container.replaceChildren()
    overlay.items.clear()
    overlay.focused = null
    return overlay
  }
  removeById(`${OVERLAY_ID}-t${theme}`)
  const container = document.createElement('div')
  container.id = `${OVERLAY_ID}-t${theme}`
  container.style.cssText = 'position: absolute; top: 0; left: 0; z-index: 2147483646; pointer-events: none;'
  container.style.display = isShown(theme) ? '' : 'none'
  overlay = { color, container, items: new Map(), focused: null }
  themeOverlays.set(theme, overlay)
  return overlay
}

function makeThemeBoxes(overlay: ThemeOverlay, id: number, els: Element[]): HTMLElement[] {
  if (!overlay.container.isConnected) document.body.appendChild(overlay.container)
  ensureStyle()
  const boxes: HTMLElement[] = []
  els.slice(0, 60).forEach((el, i) => {
    const rect = el.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const fixed = isFixed(el)
    const box = document.createElement('div')
    box.style.cssText = `position:${fixed ? 'fixed' : 'absolute'};left:${rect.left + (fixed ? 0 : window.scrollX)}px;top:${rect.top + (fixed ? 0 : window.scrollY)}px;width:${rect.width}px;height:${rect.height}px;box-sizing:border-box;pointer-events:none;`
    const label = document.createElement('span')
    label.textContent = String(id)
    label.style.cssText = 'position:absolute;top:-1px;left:-1px;transform:translateY(-100%);color:#fff;font:bold 12px/1.4 sans-serif;padding:1px 5px;border-radius:2px 2px 0 0;'
    if (i > 0) label.style.display = 'none'
    box.appendChild(label)
    box.dataset.color = overlay.color
    box.dataset.id = String(id)
    box.dataset.state = themeStates.get(overlay)?.[id] ?? ''
    overlay.container.appendChild(box)
    refreshLabel(box)
    styleBox(box, false)
    boxes.push(box)
  })
  return boxes
}

/**
 * Registers a finding. Boxes stay on the page only when a human has to decide (`persistent`);
 * the others get a box when you click or hover them in the panel.
 */
function drawThemeBoxes(theme: number, id: number, els: Element[], persistent: boolean): void {
  const overlay = themeOverlays.get(theme)!
  overlay.items.set(id, { els, boxes: persistent ? makeThemeBoxes(overlay, id, els) : [], persistent })
}

function clearTemporary(overlay: ThemeOverlay): void {
  if (overlay.focused === null) return
  const prev = overlay.items.get(overlay.focused)
  if (!prev) return
  if (prev.persistent) prev.boxes.forEach((b) => styleBox(b, false))
  else {
    prev.boxes.forEach((b) => b.remove())
    prev.boxes = []
  }
}

function focusThemeFinding(theme: number, id: number, scroll: boolean): boolean {
  const overlay = themeOverlays.get(theme)
  const item = overlay?.items.get(id)
  if (!overlay || !item) return false
  if (overlay.focused !== id) clearTemporary(overlay)
  overlay.focused = id
  if (!item.boxes.length && item.els.length) item.boxes = makeThemeBoxes(overlay, id, item.els)
  item.boxes.forEach((b) => styleBox(b, true))
  if (scroll && item.els[0]) {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    item.els[0].scrollIntoView({ block: 'center', inline: 'center', behavior: reduce ? 'auto' : 'smooth' })
  }
  return true
}

let savedScroll: { x: number; y: number } | null = null

/** Scrolls a finding's element to the middle of the screen (instantly) and reports where it is, so the panel can photograph it. */
function locateTheme(theme: number, id: number): Record<string, unknown> | null {
  const el = themeOverlays.get(theme)?.items.get(id)?.els[0]
  if (!el) return null
  if (!savedScroll) savedScroll = { x: window.scrollX, y: window.scrollY }
  el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' as ScrollBehavior })
  const r = el.getBoundingClientRect()
  return { rect: { x: r.left, y: r.top, w: r.width, h: r.height }, vw: window.innerWidth, vh: window.innerHeight }
}

function relabelTheme(theme: number, map: { from: number; to: number }[]): void {
  const overlay = themeOverlays.get(theme)
  if (!overlay) return
  const next = new Map<number, { els: Element[]; boxes: HTMLElement[]; persistent: boolean }>()
  for (const { from, to } of map) {
    const item = overlay.items.get(from)
    if (!item) continue
    next.set(to, item)
    for (const b of item.boxes) {
      b.dataset.id = String(to)
      refreshLabel(b)
    }
  }
  overlay.items = next
  overlay.focused = null
}

const hex = (c: number[]) => `#${c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()}`

function shortHtml(el: Element, max = 400): string {
  const clone = el.cloneNode(false) as Element
  const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 80)
  clone.textContent = text
  const html = clone.outerHTML
  return html.length > max ? `${html.slice(0, max)} …` : html
}

function boundedContext(el: Element): string {
  const parent = el.parentElement ?? el
  const clone = parent.cloneNode(true) as Element
  clone.querySelectorAll('script, style, noscript, svg').forEach((n) => n.remove())
  const target = parent === el ? clone : clone.querySelectorAll('*')[Array.from(parent.querySelectorAll('*')).indexOf(el)]
  target?.setAttribute('data-rgaa-target', '')
  const html = clone.outerHTML
  return html.length > 2500 ? `${html.slice(0, 2500)} …` : html
}

/** Really seen by a person: not display:none, transparent, clipped, collapsed, hidden off-screen or sr-only. */
function visible(el: Element): boolean {
  const rect = el.getBoundingClientRect()
  if (rect.width < 2 || rect.height < 2) return false
  const check = (el as Element & { checkVisibility?: (o: Record<string, boolean>) => boolean }).checkVisibility
  if (typeof check === 'function' && !check.call(el, { checkOpacity: true, checkVisibilityCSS: true, opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true })) return false
  if (rect.right + window.scrollX <= 0 || rect.bottom + window.scrollY <= 0) return false
  for (let node: Element | null = el; node && node !== document.documentElement; node = node.parentElement) {
    const cs = getComputedStyle(node)
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.fontSize === '0px') return false
    if (cs.overflow !== 'visible' || cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
      const r = node.getBoundingClientRect()
      if (r.width <= 2 || r.height <= 2) return false
    }
    if (/rect\(\s*0(px)?[\s,]+0(px)?[\s,]+0(px)?[\s,]+0(px)?\s*\)/.test(cs.clip)) return false
    if (/inset\((50|100)%/.test(cs.clipPath)) return false
    if (parseFloat(cs.textIndent) <= -999) return false
  }
  return true
}

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

function scanFrames(): { findings: RawFinding[]; els: Element[][] } {
  const findings: RawFinding[] = []
  const els: Element[][] = []
  Array.from(document.querySelectorAll('iframe, frame')).forEach((el) => {
    if (!visible(el)) return
    const rect = el.getBoundingClientRect()
    const tag = el.tagName.toLowerCase()
    const title = el.getAttribute('title')
    const src = el.getAttribute('src')
    findings.push({
      type: tag,
      id: findings.length + 1,
      label: title ? `“${title}”` : `<${tag}> without title`,
      summary: src ?? '(no src)',
      facts: {
        title,
        name: el.getAttribute('name'),
        src,
        'aria-label': el.getAttribute('aria-label'),
        'aria-labelledby': labelledByTextFor(el),
        'aria-hidden': el.closest('[aria-hidden="true"]') ? 'true' : null,
        role: el.getAttribute('role'),
        Size: `${Math.round(rect.width)} × ${Math.round(rect.height)}px`,
      },
      html: (el.cloneNode(false) as Element).outerHTML,
      contextHtml: boundedContext(el),
      count: 1,
      data: { humanNeeded: true, hasTitle: title !== null, titleEmpty: title !== null && title.trim() === '', size: Math.round(rect.width * rect.height) },
    })
    els.push([el])
  })
  return { findings, els }
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
function scanContrast(): { findings: RawFinding[]; els: Element[][] } {
  const hits: TextHit[] = []
  let checked = 0
  const seen = new Set<Element>()
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const skip = /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|OPTION)$/
  for (let n = walker.nextNode(), i = 0; n && i < 9000; n = walker.nextNode(), i++) {
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

  const findings: RawFinding[] = []
  const els: Element[][] = []
  const ok = hits.filter((h) => h.kind === 'ok')
  const pairs = new Set(ok.map((h) => `${hex(h.fg)}|${hex(h.bg)}|${h.large}`))
  const problems = hits.filter((h) => h.kind !== 'ok')
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

function scanTheme(theme: number, color: string): RawFinding[] {
  const { findings, els } = theme === 2 ? scanFrames() : scanContrast()
  themeOverlayFor(theme, color)
  findings.forEach((f, i) => drawThemeBoxes(theme, f.id, els[i], theme === 3 ? f.type !== 'contrast-ok' : f.data.humanNeeded === true))
  return findings
}

function countNewImages(): number {
  return findCandidates().filter((el) => {
    if (registry.has(el)) return false
    const rect = rectFor(el)
    return rect.width > 0 && rect.height > 0
  }).length
}

function startObserving(): void {
  if (observer) return
  observer = new MutationObserver((mutations) => {
    if (mutations.every((m) => (m.target as Element).closest?.(`#${OVERLAY_ID}`))) return
    window.clearTimeout(observeTimer)
    observeTimer = window.setTimeout(() => {
      const count = countNewImages()
      if (count > 0) chrome.runtime.sendMessage({ type: 'RGAA_NEW_IMAGES', count }).catch(() => undefined)
    }, 600)
  })
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style', 'hidden', 'open', 'aria-hidden', 'src'],
  })
}

/** The panel owns the numbering per audited page: rename the boxes (and keep ids stable) to match. */
function relabel(map: { from: number; to: number }[]): void {
  const next = new Map<number, { img: Element; box: HTMLElement }>()
  for (const { from, to } of map) {
    const entry = boxes.get(from)
    if (!entry) continue
    next.set(to, entry)
    registry.set(entry.img, to)
    entry.box.dataset.id = String(to)
    entry.box.dataset.state = imageStates[to] ?? ''
    refreshLabel(entry.box)
    styleBox(entry.box, false)
    nextId = Math.max(nextId, to + 1)
  }
  boxes.clear()
  for (const [id, entry] of next) boxes.set(id, entry)
  focusedId = null
}

/** Colours the boxes of a theme by where each element's review stands. */
function setStates(theme: number, states: Record<number, string>): void {
  if (theme === 1) {
    for (const k of Object.keys(imageStates)) delete imageStates[Number(k)]
    Object.assign(imageStates, states)
    for (const [id, { box }] of boxes) {
      box.dataset.state = states[id] ?? ''
      refreshLabel(box)
      if (box.dataset.focused !== 'true') styleBox(box, false)
    }
    return
  }
  const overlay = themeOverlays.get(theme)
  if (!overlay) return
  themeStates.set(overlay, states)
  for (const [id, item] of overlay.items) {
    for (const b of item.boxes) {
      b.dataset.state = states[id] ?? ''
      refreshLabel(b)
      if (b.dataset.focused !== 'true') styleBox(b, false)
    }
  }
}

function setVisibility(map: Record<number, boolean>): void {
  for (const [k, v] of Object.entries(map)) shown[Number(k)] = v
  document.querySelectorAll<HTMLElement>(`[id="${OVERLAY_ID}"]`).forEach((el) => (el.style.display = isShown(1) ? '' : 'none'))
  for (const [theme, o] of themeOverlays) o.container.style.display = isShown(theme) ? '' : 'none'
}

/**
 * The panel's filter decides which boxes of a theme are on the page: `ids` = only those, null = the default.
 * Images: all boxes by default. Findings: only the ones a human must judge by default.
 */
function showOnly(theme: number, ids: number[] | null): void {
  if (theme === 1) {
    for (const [id, entry] of boxes) entry.box.style.display = !ids || ids.includes(id) ? '' : 'none'
    return
  }
  const overlay = themeOverlays.get(theme)
  if (!overlay) return
  for (const [id, item] of overlay.items) {
    const want = ids ? ids.includes(id) : item.persistent
    if (want) {
      if (!item.boxes.length && item.els.length) item.boxes = makeThemeBoxes(overlay, id, item.els)
      item.boxes.forEach((b) => (b.style.display = ''))
    } else if (overlay.focused !== id) {
      if (item.persistent) item.boxes.forEach((b) => (b.style.display = 'none'))
      else {
        item.boxes.forEach((b) => b.remove())
        item.boxes = []
      }
    }
  }
}

function clearTheme(theme: number): void {
  if (theme === 1) {
    removeById(OVERLAY_ID)
    boxes.clear()
    focusedId = null
    return
  }
  themeOverlays.get(theme)?.container.remove()
  removeById(`${OVERLAY_ID}-t${theme}`)
  themeOverlays.delete(theme)
}

function resetAll(): void {
  themeOverlays.clear()
  boxes.clear()
  purgeOverlays()
  observer?.disconnect()
  observer = null
  registry = new WeakMap()
  nextId = 1
}

/* Colour picker: a screenshot of the page under a magnifier that follows the cursor and shows the colour's hex. */
let pickLayer: HTMLElement | null = null
let pickDone: ((r: Record<string, unknown>) => void) | null = null
let pickToken = 0

const overlayRoots = (): HTMLElement[] =>
  Array.from(document.querySelectorAll<HTMLElement>(`[id^="${OVERLAY_ID}"]`)).filter((el) => el.id !== `${OVERLAY_ID}-pick`)
const setOverlaysHidden = (hidden: boolean): void => overlayRoots().forEach((el) => (el.style.visibility = hidden ? 'hidden' : ''))

function endPick(result: Record<string, unknown>): void {
  pickToken++
  window.removeEventListener('keydown', onPickKey, true)
  pickLayer?.remove()
  pickLayer = null
  setOverlaysHidden(false)
  pickDone?.(result)
  pickDone = null
}

function onPickKey(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return
  e.preventDefault()
  e.stopPropagation()
  endPick({ cancelled: true })
}

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

async function startPick(respond: (r: Record<string, unknown>) => void): Promise<void> {
  endPick({ cancelled: true })
  pickDone = respond
  const token = ++pickToken
  // the boxes and tints would change the colours under the cursor: photograph the page without them
  setOverlaysHidden(true)
  await nextFrame()
  await nextFrame()
  const cap = await chrome.runtime.sendMessage({ type: 'RGAA_CAPTURE' }).catch(() => null)
  if (token !== pickToken) return
  if (!cap?.dataUrl) return endPick({ error: cap?.error ?? 'no screenshot' })
  const img = new Image()
  await new Promise<void>((resolve) => {
    img.onload = () => resolve()
    img.onerror = () => resolve()
    img.src = cap.dataUrl
  })
  if (token !== pickToken) return
  if (!img.naturalWidth) return endPick({ error: 'bad screenshot' })

  const k = img.naturalWidth / window.innerWidth
  const N = 15 // pixels of the page shown in the magnifier
  const Z = 9 // magnification
  const SIZE = N * Z
  const layer = document.createElement('div')
  layer.id = `${OVERLAY_ID}-pick`
  layer.style.cssText = 'position:fixed;inset:0;z-index:2147483647;cursor:crosshair;background:transparent;'
  const loupe = document.createElement('div')
  loupe.style.cssText = `position:fixed;left:0;top:0;width:${SIZE}px;pointer-events:none;border:2px solid #fff;border-radius:6px;box-shadow:0 0 0 1px #000,0 4px 14px rgba(0,0,0,.45);background:#fff;overflow:hidden;font:600 13px/1.2 ui-monospace,monospace;display:none;`
  const view = document.createElement('canvas')
  view.width = view.height = SIZE
  view.style.cssText = `display:block;width:${SIZE}px;height:${SIZE}px;image-rendering:pixelated;`
  const ring = document.createElement('div')
  ring.style.cssText = `position:absolute;left:${Math.floor(N / 2) * Z}px;top:${Math.floor(N / 2) * Z}px;width:${Z}px;height:${Z}px;box-sizing:border-box;border:1px solid #000;outline:1px solid #fff;`
  const label = document.createElement('div')
  label.style.cssText = 'display:flex;align-items:center;gap:6px;padding:5px 7px;color:#111;background:#fff;'
  const chip = document.createElement('span')
  chip.style.cssText = 'width:14px;height:14px;border:1px solid #000;flex:none;'
  const text = document.createElement('span')
  label.append(chip, text)
  const wrap = document.createElement('div')
  wrap.style.cssText = 'position:relative;'
  wrap.append(view, ring)
  loupe.append(wrap, label)

  const sample = document.createElement('canvas')
  sample.width = sample.height = N
  const sctx = sample.getContext('2d', { willReadFrequently: true })!
  const vctx = view.getContext('2d')!
  vctx.imageSmoothingEnabled = false
  let current = ''
  const read = (x: number, y: number): string => {
    const half = Math.floor(N / 2)
    sctx.clearRect(0, 0, N, N)
    sctx.drawImage(img, Math.round(x * k) - half, Math.round(y * k) - half, N, N, 0, 0, N, N)
    vctx.clearRect(0, 0, SIZE, SIZE)
    vctx.drawImage(sample, 0, 0, SIZE, SIZE)
    const [r, g, b] = sctx.getImageData(half, half, 1, 1).data
    return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`
  }
  const move = (e: MouseEvent) => {
    current = read(e.clientX, e.clientY)
    chip.style.background = current
    text.textContent = current
    loupe.style.display = ''
    const w = SIZE + 4
    const hgt = SIZE + 40
    loupe.style.left = `${e.clientX + 24 + w > window.innerWidth ? e.clientX - 24 - w : e.clientX + 24}px`
    loupe.style.top = `${e.clientY + 24 + hgt > window.innerHeight ? e.clientY - 24 - hgt : e.clientY + 24}px`
  }
  layer.addEventListener('mousemove', move, true)
  layer.addEventListener(
    'click',
    (e) => {
      e.preventDefault()
      e.stopPropagation()
      endPick({ hex: read(e.clientX, e.clientY) })
    },
    true,
  )
  layer.append(loupe)
  document.documentElement.appendChild(layer)
  pickLayer = layer
  window.addEventListener('keydown', onPickKey, true)
}

/* ------------------------------------------------------------------ */
/* Our own RGAA checks (what a script can see; the wording is in lib/rgaa-rules.ts) */
/* ------------------------------------------------------------------ */

function shortSelector(el: Element): string {
  const id = el.id ? `#${CSS.escape(el.id)}` : ''
  const cls = !id && typeof el.className === 'string' && el.className.trim() ? `.${CSS.escape(el.className.trim().split(/\s+/)[0])}` : ''
  return `${el.tagName.toLowerCase()}${id}${cls}`
}

function runRgaaRules(): { url: string; findings: { key: string; count: number; detail?: string; samples?: string[] }[] } {
  const out: { key: string; count: number; detail?: string; samples?: string[] }[] = []
  const mine = (el: Element) => !el.closest(`[id^="${OVERLAY_ID}"]`)
  const all = (selector: string): Element[] => Array.from(document.querySelectorAll(selector)).filter(mine)
  const samples = (els: Element[], n = 3) => els.slice(0, n).map(shortSelector)
  const push = (key: string, els: Element[], detail?: string) => {
    if (els.length) out.push({ key, count: els.length, detail, samples: samples(els) })
  }

  // 8.1 — document type
  if (!document.doctype || document.compatMode === 'BackCompat') out.push({ key: 'doctype', count: 1, detail: document.doctype ? document.doctype.name : 'no doctype' })

  // 10.1 — tags and attributes that only serve presentation
  const tags = all('basefont, big, blink, center, font, marquee, s, strike, tt')
  if (tags.length) {
    const names = [...new Set(tags.map((e) => e.tagName.toLowerCase()))]
    push('presentation-tags', tags, names.join(', '))
  }
  const ATTRS = ['align', 'alink', 'background', 'bgcolor', 'border', 'cellpadding', 'cellspacing', 'clear', 'color', 'compact', 'face', 'frameborder', 'hspace', 'link', 'marginheight', 'marginwidth', 'noshade', 'nowrap', 'scrolling', 'text', 'valign', 'vlink', 'vspace']
  const withAttrs = all(ATTRS.map((a) => `[${a}]`).join(',')).filter((e) => !e.closest('svg') && ATTRS.some((a) => e.hasAttribute(a) && !(['link', 'text', 'alink', 'vlink'].includes(a) && e.tagName !== 'BODY')))
  if (withAttrs.length) {
    const names = [...new Set(withAttrs.flatMap((e) => ATTRS.filter((a) => e.hasAttribute(a))))]
    push('presentation-attrs', withAttrs, names.slice(0, 8).join(', '))
  }

  // 8.10 — reading direction
  push('dir-invalid', all('[dir]').filter((e) => !/^(ltr|rtl)$/i.test(e.getAttribute('dir') ?? '')))

  // 13.2 — links that open a new window without saying so
  const INFORMS = /(nouvelle\s+(fen[eê]tre|onglet)|nouvel\s+onglet|new\s+(window|tab)|external)/i
  push(
    'target-blank',
    all('a[target="_blank"]').filter((a) => {
      const hints = [a.textContent, a.getAttribute('title'), a.getAttribute('aria-label'), ...Array.from(a.querySelectorAll('img[alt], svg title')).map((n) => n.getAttribute('alt') ?? n.textContent)]
      return visible(a) && !hints.some((h) => INFORMS.test(h ?? ''))
    }),
  )

  // 11.13 — fields about the user without autocomplete
  const PERSONAL = /(e-?mail|mail|t[eé]l|phone|pr[eé]nom|firstname|first-name|lastname|last-name|nom\b|name|adresse|address|postal|zip|ville|city|naissance|birth|username|login|identifiant|password|mot de passe)/i
  const fields = all('input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([type=image]):not([type=checkbox]):not([type=radio]):not([type=file]):not([type=range]):not([type=color]):not([type=search])').filter(visible)
  push(
    'autocomplete',
    fields.filter((f) => {
      const type = (f.getAttribute('type') ?? 'text').toLowerCase()
      const personal = ['email', 'tel', 'password'].includes(type) || PERSONAL.test([f.getAttribute('name'), f.id, f.getAttribute('aria-label'), f.getAttribute('placeholder')].join(' '))
      const ac = (f.getAttribute('autocomplete') ?? '').trim().toLowerCase()
      return personal && (!ac || ac === 'off')
    }),
  )

  // 13.3 / 13.4 — office documents
  const DOC = /\.(pdf|docx?|odt|xlsx?|ods|pptx?|odp|rtf)(?:[?#]|$)/i
  const docs = all('a[href]').filter((a) => DOC.test(a.getAttribute('href') ?? ''))
  if (docs.length) push('downloads', docs, [...new Set(docs.map((a) => (/\.(\w+)(?:[?#]|$)/.exec(a.getAttribute('href') ?? '')?.[1] ?? '').toLowerCase()))].join(', '))

  // 4 — multimedia: present (to check) or absent (not applicable)
  const media = all('video, audio, object, embed, bgsound, iframe[src*="youtube"], iframe[src*="youtu.be"], iframe[src*="vimeo"], iframe[src*="dailymotion"]')
  if (media.length) push('media-found', media, [...new Set(media.map((e) => e.tagName.toLowerCase()))].join(', '))
  else out.push({ key: 'no-media', count: 0 })

  // 5 — tables
  const tables = all('table, [role="table"], [role="grid"], [role="treegrid"]')
  if (!tables.length) out.push({ key: 'no-table', count: 0 })
  else {
    const noHeaders = tables.filter((t) => t.tagName === 'TABLE' && !/^(presentation|none)$/.test(t.getAttribute('role') ?? '') && t.querySelectorAll('tr').length > 1 && !t.querySelector('th, [role="columnheader"], [role="rowheader"]'))
    push('table-no-th', noHeaders)
  }

  // 11 — forms, buttons
  const anyField = all('input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([type=image]), select, textarea, [role="textbox"], [role="combobox"], [role="listbox"], [role="checkbox"], [role="radio"], [role="switch"], [role="slider"], [role="spinbutton"], [role="searchbox"]')
  if (!anyField.length) out.push({ key: 'no-form', count: 0 })
  if (!all('button, input[type=submit], input[type=button], input[type=reset], input[type=image], [role="button"]').length) out.push({ key: 'no-button', count: 0 })

  // 6 — links
  if (!all('a[href], [role="link"]').length) out.push({ key: 'no-link', count: 0 })

  // 8.6 — a title that says nothing
  const title = document.title.trim()
  if (!title || /^(sans titre|untitled( document)?|document|home|accueil|index|new page|nouvelle page)$/i.test(title) || title === location.href) out.push({ key: 'generic-title', count: 1, detail: title || 'empty' })

  // --- Asqatasun-derived: begin ---
  out.push(...runAsqatasunRules())
  // --- Asqatasun-derived: end ---

  return { url: location.href, findings: out }
}

// --- Asqatasun-derived: begin ---
/**
 * The RGAA tests ported from Asqatasun (AGPL-3.0, see NOTICE.md): the rules are data in lib/asqatasun-rules.ts, this
 * function only runs them. Findings are keyed `asq:<rule key>`; a criterion whose every test found nothing to check
 * comes back as `asq:na:<criterion>`. Each finding carries what the panel needs (criterion, verdict, wording).
 */
function runAsqatasunRules(): { key: string; count: number; samples?: string[]; asq: AsqExtra }[] {
  const found: { key: string; count: number; samples?: string[]; asq: AsqExtra }[] = []
  const mine = (el: Element) => !el.closest(`[id^="${OVERLAY_ID}"]`)
  const query = (selector: string): Element[] => Array.from(document.querySelectorAll(selector)).filter(mine)
  const ownText = (el: Element): string =>
    Array.from(el.childNodes)
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent ?? '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
  const dt = document.doctype
  const html5 = Boolean(dt && dt.name.toLowerCase() === 'html' && !dt.publicId && (!dt.systemId || dt.systemId === 'about:legacy-compat'))
  const mentionsCaptcha = (el: Element): boolean =>
    el !== document.documentElement && el !== document.body && (/captcha/i.test(ownText(el)) || Array.from(el.attributes).some((a) => /captcha/i.test(a.value)))
  let pageMentionsCaptcha: boolean | undefined
  const ancestorsMention = (el: Element, test: (x: Element) => boolean): boolean => {
    for (let a = el.parentElement; a; a = a.parentElement) if (test(a)) return true
    return false
  }

  const select = (r: AsqRule): Element[] => {
    let els = query(r.selector)
    if (r.exclude) els = els.filter((el) => !el.matches(r.exclude as string))
    if (r.ownText) {
      const re = new RegExp(r.ownText)
      els = els.filter((el) => re.test(ownText(el)))
    }
    if (r.attrRe) {
      const [attr, source] = r.attrRe
      const re = new RegExp(source, 'i')
      els = els.filter((el) => re.test(el.getAttribute(attr) ?? ''))
    }
    if (r.followedBySameTag) {
      els = els.filter((el) => {
        let next = el.nextSibling
        while (next && (next.nodeType === Node.COMMENT_NODE || (next.nodeType === Node.TEXT_NODE && !(next.textContent ?? '').trim()))) next = next.nextSibling
        return next?.nodeType === Node.ELEMENT_NODE && (next as Element).tagName === el.tagName
      })
    }
    if (r.captcha && els.length) {
      pageMentionsCaptcha ??= /captcha/i.test(document.documentElement.outerHTML)
      els = pageMentionsCaptcha
        ? els.filter((el) => {
            // a sibling or an ancestor counts when it is another kind of element (or a div)
            const other = (x: Element) => (x.tagName !== el.tagName || el.tagName === 'DIV') && mentionsCaptcha(x)
            return mentionsCaptcha(el) || Array.from(el.parentElement?.children ?? []).some((s) => s !== el && other(s)) || ancestorsMention(el, other)
          })
        : []
    }
    return els
  }

  // per test: did every rule of the test find nothing to check ("na"), or did one find something / say pass?
  const naTests = new Set<string>()
  const busyTests = new Set<string>()
  for (const r of ASQ_RULES) {
    try {
      if (r.html5 && !html5) continue
      const els = select(r)
      if (els.length && els.length >= (r.minCount ?? 1)) {
        busyTests.add(r.test)
        found.push({ key: `asq:${r.key ?? r.test}`, count: els.length, samples: els.slice(0, 3).map(shortSelector), asq: { criterion: r.criterion, status: r.whenFound, text: r.text } })
      } else if (r.whenNone === 'na' && !(r.scope ? query(r.scope).length : els.length)) {
        naTests.add(r.test)
      } else busyTests.add(r.test)
    } catch {
      busyTests.add(r.test) // a selector this browser does not understand: say nothing
    }
  }
  for (const [criterion, tests] of Object.entries(ASQ_CRITERION_TESTS)) {
    if (tests.every((t) => naTests.has(t) && !busyTests.has(t))) found.push({ key: `asq:na:${criterion}`, count: 0, asq: { criterion, status: 'na', text: ASQ_NA_TEXT } })
  }
  return found
}
// --- Asqatasun-derived: end ---

/** The generated HTML of the page (what the browser holds now, after scripts), without our own markers. */
function takeSnapshot(): { url: string; title: string; html: string } {
  const clone = document.documentElement.cloneNode(true) as HTMLElement
  clone.querySelectorAll(`[id^="${OVERLAY_ID}"], #${STYLE_ID}`).forEach((el) => el.remove())
  const dt = document.doctype
  const doctype = dt ? `<!DOCTYPE ${dt.name}${dt.publicId ? ` PUBLIC "${dt.publicId}"` : ''}${dt.systemId ? ` "${dt.systemId}"` : ''}>\n` : ''
  return { url: location.href, title: document.title, html: doctype + clone.outerHTML }
}

/** Runs the axe engine (injected by the background page just before) and sends back a light copy of its findings. */
async function runAxe(locale: unknown): Promise<Record<string, unknown>> {
  type AxeApi = { run: (ctx: Document, opts: object) => Promise<Record<string, unknown>>; configure: (c: object) => void }
  const axe = ((globalThis as unknown as { axe?: AxeApi }).axe ?? (window as unknown as { axe?: AxeApi }).axe) as AxeApi | undefined
  if (!axe) return { error: 'axe-not-loaded' }
  try {
    if (locale) axe.configure({ locale })
    const r = (await axe.run(document, { resultTypes: ['violations', 'incomplete'] })) as {
      violations: { id: string; impact: string | null; help: string; nodes: { html: string; target: unknown[]; any?: { data?: unknown }[] }[] }[]
      incomplete: unknown[]
      passes: { id: string }[]
      inapplicable: { id: string }[]
    }
    return {
      url: location.href,
      violations: r.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        nodes: v.nodes.slice(0, 200).map((n) => ({ html: n.html.slice(0, 400), target: n.target.flat().map(String), any: n.any?.[0]?.data ? [{ data: n.any[0].data }] : [] })),
      })),
      incomplete: r.incomplete.length,
      passes: r.passes?.length ?? 0,
      passedRules: (r.passes ?? []).map((p) => p.id),
      inapplicableRules: (r.inapplicable ?? []).map((p) => p.id),
    }
  } catch (err) {
    return { error: String(err) }
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!isCurrent()) return undefined
  if (message?.type === 'RGAA_SNAPSHOT') {
    sendResponse(takeSnapshot())
    return true
  }
  if (message?.type === 'RGAA_RULES_RUN') {
    sendResponse(runRgaaRules())
    return true
  }
  if (message?.type === 'RGAA_AXE_RUN') {
    void runAxe(message.locale).then(sendResponse)
    return true
  }
  if (message?.type === 'RGAA_PICK_START') {
    void startPick(sendResponse)
    return true
  }
  if (message?.type === 'RGAA_PICK_CANCEL') {
    endPick({ cancelled: true })
    sendResponse({ ok: true })
    return true
  }
  if (message?.type === 'RGAA_HIGHLIGHT_IMAGES') {
    if (message.color) imageColor = message.color
    const elements = highlightImages()
    startObserving()
    sendResponse({ elements })
    return true
  }
  if (message?.type === 'RGAA_CLEAR_HIGHLIGHTS') {
    resetAll()
    sendResponse({ ok: true })
    return true
  }
  if (message?.type === 'RGAA_LOCATE') {
    sendResponse(locateTheme(message.theme, message.id) ?? { rect: null })
    return true
  }
  if (message?.type === 'RGAA_SCROLL_RESTORE') {
    if (savedScroll) window.scrollTo(savedScroll.x, savedScroll.y)
    savedScroll = null
    sendResponse({ ok: true })
    return true
  }
  if (message?.type === 'RGAA_SHOW_ONLY') {
    showOnly(message.theme, message.ids ?? null)
    sendResponse({ ok: true })
    return true
  }
  if (message?.type === 'RGAA_CLEAR_THEME') {
    clearTheme(message.theme)
    sendResponse({ ok: true })
    return true
  }
  if (message?.type === 'RGAA_STATES') {
    setStates(message.theme, message.states ?? {})
    sendResponse({ ok: true })
    return true
  }
  if (message?.type === 'RGAA_OVERLAY') {
    if (typeof message.alt === 'boolean' && message.alt !== showAlt) {
      showAlt = message.alt
      for (const { box } of boxes.values()) refreshLabel(box)
    }
    if (typeof message.tint === 'boolean' && message.tint !== focusTint) {
      focusTint = message.tint
      for (const o of themeOverlays.values()) o.container.querySelectorAll<HTMLElement>('[data-focused="true"]').forEach((b) => styleBox(b, true))
      document.querySelectorAll<HTMLElement>(`[id="${OVERLAY_ID}"] [data-focused="true"]`).forEach((b) => styleBox(b, true))
    }
    setVisibility(message.visibility ?? {})
    sendResponse({ ok: true })
    return true
  }
  if (message?.type === 'RGAA_SCAN_THEME') {
    sendResponse({ findings: scanTheme(message.theme, message.color ?? DEFAULT_COLOR) })
    return true
  }
  if (message?.type === 'RGAA_RELABEL' && message.theme && message.theme !== 1) {
    relabelTheme(message.theme, message.map)
    sendResponse({ ok: true })
    return true
  }
  if (message?.type === 'RGAA_RELABEL') {
    relabel(message.map)
    sendResponse({ ok: true })
    return true
  }
  if (message?.type === 'RGAA_FOCUS_IMAGE' && message.theme && message.theme !== 1) {
    sendResponse({ ok: focusThemeFinding(message.theme, message.id, message.scroll !== false) })
    return true
  }
  if (message?.type === 'RGAA_FOCUS_IMAGE') {
    sendResponse({ ok: focusImage(message.id, message.scroll !== false) })
    return true
  }
  if (message?.type === 'RGAA_UNFOCUS_IMAGE') {
    setFocused(null)
    sendResponse({ ok: true })
    return true
  }
  return undefined
})
