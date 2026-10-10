/**
 * Helpers shared by the content-script modules: overlay ids, "is it really seen" tests, name helpers, html excerpts.
 * Imported by the content script only (inlined in its bundle).
 */
import { hiddenKind } from './page-tools'
import { cloneWithTarget } from './scan-context'

export const OVERLAY_ID = 'rgaa-assistant-overlay'
export const STYLE_ID = 'rgaa-assistant-style'

// The panel sends each theme's colour with its scan (single source: lib/theme-colors.ts).
// The content script modules (this one included) must stay free of runtime imports shared with the panel or the
// background: a shared chunk would turn the content script into an ES module, which a content script cannot be.
// Type-only imports are erased and are fine.
export const DEFAULT_COLOR = '#e11d48'

/** Removes every overlay container with this id, even duplicates left by an older copy. */
export function removeById(id: string): void {
  document.querySelectorAll(`[id="${id}"]`).forEach((node) => node.remove())
}
export function purgeOverlays(): void {
  document.querySelectorAll('[id^="rgaa-assistant-overlay"], [id="rgaa-assistant-style"]').forEach((node) => node.remove())
}

export function labelledByTextFor(el: Element): string | null {
  const ids = el.getAttribute('aria-labelledby')
  if (!ids) return null
  const text = ids
    .split(/\s+/)
    .map((id) => document.getElementById(id)?.textContent?.trim())
    .filter(Boolean)
    .join(' ')
  return text || null
}

export function shortHtml(el: Element, max = 400): string {
  const clone = el.cloneNode(false) as Element
  const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 80)
  clone.textContent = text
  const html = clone.outerHTML
  return html.length > max ? `${html.slice(0, max)} …` : html
}

export function boundedContext(el: Element): string {
  const parent = el.parentElement ?? el
  const clone = cloneWithTarget(parent, el, 'script, style, noscript, svg')
  const html = clone.outerHTML
  return html.length > 2500 ? `${html.slice(0, 2500)} …` : html
}

/** Really seen by a person: not display:none, transparent, clipped, collapsed, hidden off-screen or sr-only. */
export function visible(el: Element): boolean {
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

/** Is the element shown (not display:none, not visibility:hidden)? Unlike visible(), an empty element with no size still counts: an empty link or heading is what we look for. */
export function rendered(el: Element): boolean {
  const check = (el as Element & { checkVisibility?: (o?: object) => boolean }).checkVisibility
  if (typeof check === 'function') return check.call(el, { visibilityProperty: true, checkVisibilityCSS: true })
  const cs = getComputedStyle(el)
  return cs.display !== 'none' && cs.visibility !== 'hidden'
}


/** What the page says about whether the element can be seen, for the lists. */
export function visibilityOf(el: Element): { Visibility: string | null; hidden: string | null } {
  const kind = hiddenKind(el)
  return { Visibility: kind === 'visually-hidden' ? 'visually hidden (read by screen readers only)' : kind === 'aria-hidden' ? 'hidden from assistive technologies (aria-hidden)' : null, hidden: kind }
}

const SKIP_TEXT = /(aller au contenu|contenu principal|acc[eè]s direct|passer au|aller [àa] la navigation|[ée]vitement|skip to|skip navigation|jump to|main content)/i

/** Is this link a skip link: an in-page link among the first focusable elements, or one whose text says so? */
export function skipTarget(a: Element, early: Set<Element>): { skip: boolean; found: boolean } {
  const href = a.getAttribute('href') ?? ''
  if (!href.startsWith('#') || href.length < 2) return { skip: false, found: false }
  const name = linkNameOf(a)
  if (!early.has(a) && !SKIP_TEXT.test(name)) return { skip: false, found: false }
  const id = decodeURIComponent(href.slice(1))
  return { skip: true, found: Boolean(document.getElementById(id) || document.getElementsByName(id).length) }
}

export function linkNameOf(a: Element): string {
  const labelled = labelledByTextFor(a)
  if (labelled) return labelled
  const aria = a.getAttribute('aria-label')?.trim()
  if (aria) return aria
  const text = (a.textContent ?? '').replace(/\s+/g, ' ').trim()
  if (text) return text
  const img = a.querySelector('img[alt]:not([alt=""]), [role="img"][aria-label]')
  const imgName = img?.getAttribute('alt')?.trim() || img?.getAttribute('aria-label')?.trim()
  if (imgName) return imgName
  const svgTitle = a.querySelector('svg title')?.textContent?.trim()
  if (svgTitle) return svgTitle
  return a.getAttribute('title')?.trim() ?? ''
}
