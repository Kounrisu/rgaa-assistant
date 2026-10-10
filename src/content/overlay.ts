/**
 * The boxes drawn over the page: image boxes (theme 1), finding boxes of the other element themes, their styles,
 * states, labels, focus, numbering and clean-up. Imported by the content script only (inlined in its bundle).
 */
import { DEFAULT_COLOR, OVERLAY_ID, STYLE_ID, removeById } from './dom-utils'
import type { LocatedElement } from '../lib/messages'
import { noteCut } from './scan-coverage'

const FOCUS_COLOR = '#facc15'

/** "#e11d48" → "rgba(225, 29, 72, 0.12)" */
function tint(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

export const boxes = new Map<number, { img: Element; box: HTMLElement }>()
/** The page element each box stands for, so the boxes can be moved when the layout changes (hidden content revealed…). */
export const boxTarget = new WeakMap<HTMLElement, Element>()

function placeBox(box: HTMLElement, el: Element): void {
  const rect = el.getBoundingClientRect()
  const fixed = isFixed(el)
  box.style.position = fixed ? 'fixed' : 'absolute'
  box.style.left = `${rect.left + (fixed ? 0 : window.scrollX)}px`
  box.style.top = `${rect.top + (fixed ? 0 : window.scrollY)}px`
  box.style.width = `${Math.max(rect.width, 2)}px`
  box.style.height = `${Math.max(rect.height, 2)}px`
}

export function repositionBoxes(): void {
  for (const { img, box } of boxes.values()) placeBox(box, img)
  for (const overlay of themeOverlays.values()) for (const item of overlay.items.values()) for (const b of item.boxes) {
    const el = boxTarget.get(b)
    if (el) placeBox(b, el)
  }
}

let focusedId: number | null = null

/** Which theme's boxes are shown. The panel decides: only the theme you are in, if its toggle is on. */
const shown: Record<number, boolean> = {}
export const isShown = (theme: number): boolean => shown[theme] !== false

export function ensureStyle(): void {
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

export function clearOverlay(): void {
  removeById(OVERLAY_ID)
  document.getElementById(STYLE_ID)?.remove()
  boxes.clear()
  focusedId = null
}

export function setFocused(id: number | null): void {
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
  ignored: { color: '#f9a8b8', dash: 'dashed', width: 2, glyph: '', glow: false },
  c: { color: '#16a34a', dash: 'solid', width: 3, glyph: '✓', glow: false },
  nc: { color: '#ff1744', dash: 'solid', width: 4, glyph: '✕', glow: true },
}

/** Alt text written next to each image box (toggle in the panel). */
let showAlt = false

/** The text of a box's label: its number, a mark for its state, and optionally what the page says as alternative. */
export function refreshLabel(box: HTMLElement): void {
  const label = box.firstElementChild as HTMLElement | null
  if (!label) return
  const glyph = STATE_STYLE[box.dataset.state ?? '']?.glyph
  const alt = showAlt && box.dataset.alt ? ` · ${box.dataset.alt}` : ''
  label.textContent = `${glyph ? `${glyph} ` : ''}${box.dataset.id ?? ''}${box.dataset.badge ? ` · ${box.dataset.badge}` : ''}${alt}`
  label.style.whiteSpace = 'nowrap'
  label.style.maxWidth = showAlt ? '360px' : ''
  label.style.overflow = showAlt ? 'hidden' : ''
  label.style.textOverflow = showAlt ? 'ellipsis' : ''
}

/** The yellow border and wash on the focused element hide its real colours; the panel can turn them off. */
let focusTint = true

export function styleBox(box: HTMLElement, focused: boolean): void {
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

export function focusImage(id: number, scroll: boolean): boolean {
  const entry = boxes.get(id)
  if (!entry) return false
  if (scroll) {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    entry.img.scrollIntoView({ block: 'center', inline: 'center', behavior: reduce ? 'auto' : 'smooth' })
  }
  setFocused(id)
  return true
}

export function isFixed(el: Element): boolean {
  for (let node: Element | null = el; node; node = node.parentElement) {
    if (getComputedStyle(node).position === 'fixed') return true
  }
  return false
}

export const imageStates: Record<number, string> = {}

/* ------------------------------------------------------------------ */
/* Other element-based themes: frames (2) and colours (3)               */
/* ------------------------------------------------------------------ */

interface ThemeOverlay {
  color: string
  container: HTMLElement
  items: Map<number, { els: Element[]; boxes: HTMLElement[]; persistent: boolean; badge?: string }>
  focused: number | null
}
export const themeOverlays = new Map<number, ThemeOverlay>()
const themeStates = new Map<ThemeOverlay, Record<number, string>>()

export function themeOverlayFor(theme: number, color: string): ThemeOverlay {
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

function makeThemeBoxes(overlay: ThemeOverlay, id: number, els: Element[], badge = ''): HTMLElement[] {
  if (!overlay.container.isConnected) document.body.appendChild(overlay.container)
  ensureStyle()
  const boxes: HTMLElement[] = []
  noteCut('boxes per finding', 60, els.length)
  els.slice(0, 60).forEach((el, i) => {
    const rect = el.getBoundingClientRect()
    const fixed = isFixed(el)
    const box = document.createElement('div')
    box.style.cssText = `position:${fixed ? 'fixed' : 'absolute'};left:${rect.left + (fixed ? 0 : window.scrollX)}px;top:${rect.top + (fixed ? 0 : window.scrollY)}px;width:${Math.max(rect.width, 2)}px;height:${Math.max(rect.height, 2)}px;box-sizing:border-box;pointer-events:none;`
    boxTarget.set(box, el)
    const label = document.createElement('span')
    label.textContent = String(id)
    label.style.cssText = 'position:absolute;top:-1px;left:-1px;transform:translateY(-100%);color:#fff;font:bold 12px/1.4 sans-serif;padding:1px 5px;border-radius:2px 2px 0 0;'
    if (i > 0) label.style.display = 'none'
    box.appendChild(label)
    box.dataset.color = overlay.color
    box.dataset.id = String(id)
    if (badge) box.dataset.badge = badge
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
export function drawThemeBoxes(theme: number, id: number, els: Element[], persistent: boolean, badge = ''): void {
  const overlay = themeOverlays.get(theme)!
  overlay.items.set(id, { els, boxes: persistent ? makeThemeBoxes(overlay, id, els, badge) : [], persistent, badge })
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

export function focusThemeFinding(theme: number, id: number, scroll: boolean): boolean {
  const overlay = themeOverlays.get(theme)
  const item = overlay?.items.get(id)
  if (!overlay || !item) return false
  if (overlay.focused !== id) clearTemporary(overlay)
  overlay.focused = id
  if (!item.boxes.length && item.els.length) item.boxes = makeThemeBoxes(overlay, id, item.els, item.badge ?? '')
  item.boxes.forEach((b) => styleBox(b, true))
  if (scroll && item.els[0]) {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    item.els[0].scrollIntoView({ block: 'center', inline: 'center', behavior: reduce ? 'auto' : 'smooth' })
  }
  return true
}

let savedScroll: { x: number; y: number } | null = null

/** Scrolls a finding's element to the middle of the screen (instantly) and reports where it is, so the panel can photograph it. */
export function locateTheme(theme: number, id: number): LocatedElement | null {
  const el = themeOverlays.get(theme)?.items.get(id)?.els[0]
  if (!el) return null
  if (!savedScroll) savedScroll = { x: window.scrollX, y: window.scrollY }
  el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' as ScrollBehavior })
  const r = el.getBoundingClientRect()
  return { rect: { x: r.left, y: r.top, w: r.width, h: r.height }, vw: window.innerWidth, vh: window.innerHeight }
}

export function relabelTheme(theme: number, map: { from: number; to: number }[]): void {
  const overlay = themeOverlays.get(theme)
  if (!overlay) return
  const next = new Map<number, { els: Element[]; boxes: HTMLElement[]; persistent: boolean; badge?: string }>()
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

/** The panel owns the numbering per audited page: rename the boxes (and keep ids stable) to match. */
export function relabel(map: { from: number; to: number }[]): void {
  const next = new Map<number, { img: Element; box: HTMLElement }>()
  for (const { from, to } of map) {
    const entry = boxes.get(from)
    if (!entry) continue
    next.set(to, entry)
    ids.registry.set(entry.img, to)
    entry.box.dataset.id = String(to)
    entry.box.dataset.state = imageStates[to] ?? ''
    refreshLabel(entry.box)
    styleBox(entry.box, false)
    ids.next = Math.max(ids.next, to + 1)
  }
  boxes.clear()
  for (const [id, entry] of next) boxes.set(id, entry)
  focusedId = null
}

/** Colours the boxes of a theme by where each element's review stands. */
export function setStates(theme: number, states: Record<number, string>): void {
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
export function showOnly(theme: number, ids: number[] | null): void {
  if (theme === 1) {
    for (const [id, entry] of boxes) entry.box.style.display = !ids || ids.includes(id) ? '' : 'none'
    return
  }
  const overlay = themeOverlays.get(theme)
  if (!overlay) return
  for (const [id, item] of overlay.items) {
    const want = ids ? ids.includes(id) : item.persistent
    if (want) {
      if (!item.boxes.length && item.els.length) item.boxes = makeThemeBoxes(overlay, id, item.els, item.badge ?? '')
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

export function clearTheme(theme: number): void {
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

// Ids stay stable across rescans so answers survive popins opening and closing.
export const ids = { registry: new WeakMap<Element, number>(), next: 1 }

/** The panel's overlay options: alt text next to the boxes, the focus tint, and which theme's boxes are shown. */
export function applyOverlayOptions(message: { alt?: unknown; tint?: unknown; visibility?: Record<number, boolean> }): void {
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
}

/** Puts the page back where `locateTheme` found it. */
export function restoreScroll(): void {
  if (savedScroll) window.scrollTo(savedScroll.x, savedScroll.y)
  savedScroll = null
}
