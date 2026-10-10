/**
 * Theme 1: the image scan (candidates, text alternatives, ignored-by, thumbnails, html excerpts) and the watcher that
 * tells the panel when new images appear. Imported by the content script only (inlined in its bundle).
 */
import { DEFAULT_COLOR, OVERLAY_ID, labelledByTextFor } from './dom-utils'
import { boxTarget, boxes, clearOverlay, ensureStyle, ids, imageStates, isFixed, isShown, refreshLabel, styleBox } from './overlay'
import type { ImageElementInfo } from '../lib/types'
import { cloneWithTarget } from './scan-context'

let imageColor = DEFAULT_COLOR

let observer: MutationObserver | null = null
let observeTimer: number | undefined

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
  const clone = cloneWithTarget(context, el, 'script, style, noscript')
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
  boxTarget.set(box, img)
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

export function highlightImages(): ImageElementInfo[] {
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

    let id = ids.registry.get(el)
    if (id === undefined) {
      id = ids.next++
      ids.registry.set(el, id)
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

function countNewImages(): number {
  return findCandidates().filter((el) => {
    if (ids.registry.has(el)) return false
    const rect = rectFor(el)
    return rect.width > 0 && rect.height > 0
  }).length
}

export function startObserving(): void {
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

export function setImageColor(color: string): void {
  imageColor = color
}

/** Stops watching the page for new images. */
export function stopObserving(): void {
  observer?.disconnect()
  observer = null
}
