/**
 * Scan coverage, measured in the page: what the scanners cannot see (frames, shadow roots) and where a list was cut.
 * Imported by the content script only; the type comes from the shared library but is erased at build time.
 */
import type { ScanCoverage } from '../lib/scan-coverage'

const cuts = new Map<string, { shown: number; total: number | null }>()

/** Forgets the truncations noted by a previous scan. */
export function resetCuts(): void {
  cuts.clear()
}

/** Notes that a list was cut: `shown` kept out of `total` (null = more exist, count unknown). Nothing is noted when nothing was cut. */
export function noteCut(what: string, shown: number, total: number | null): void {
  if (total !== null && total <= shown) return
  const prev = cuts.get(what)
  if (!prev || (total ?? Infinity) > (prev.total ?? Infinity)) cuts.set(what, { shown, total })
}

function isCrossOrigin(frame: HTMLIFrameElement | HTMLFrameElement, doc: Document): boolean {
  const src = frame.getAttribute('src')
  if (frame.hasAttribute('srcdoc') || !src || /^about:(blank|srcdoc)$/i.test(src.trim())) {
    // srcdoc / empty frames inherit the origin, unless sandboxed without allow-same-origin
    return frame.hasAttribute('sandbox') && !(frame.getAttribute('sandbox') ?? '').split(/\s+/).includes('allow-same-origin')
  }
  try {
    const origin = new URL(src, doc.baseURI).origin
    if (origin !== 'null' && origin !== new URL(doc.baseURI).origin) return true
  } catch {
    return true
  }
  try {
    return !frame.contentDocument?.documentElement
  } catch {
    return true
  }
}

/** Counts open shadow roots in the document, including those nested in other shadow roots. */
export function countOpenShadowRoots(root: ParentNode): number {
  let n = 0
  for (const el of Array.from(root.querySelectorAll('*'))) {
    if (el.shadowRoot) n += 1 + countOpenShadowRoots(el.shadowRoot)
  }
  return n
}

export function computeCoverage(doc: Document, now = Date.now()): ScanCoverage {
  const frames = Array.from(doc.querySelectorAll<HTMLIFrameElement | HTMLFrameElement>('iframe, frame'))
  const crossOrigin = frames.filter((f) => isCrossOrigin(f, doc)).length
  const notes: string[] = []
  if (frames.length) notes.push('The scanners look at the main document only; the axe run is made with iframes: false.')
  return {
    at: now,
    frames: { total: frames.length, sameOrigin: frames.length - crossOrigin, crossOrigin },
    openShadowRoots: countOpenShadowRoots(doc),
    closedShadowRoots: 'unknown',
    truncated: Array.from(cuts, ([what, v]) => ({ what, ...v })),
    notes,
  }
}
