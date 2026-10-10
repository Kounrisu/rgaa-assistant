/**
 * The generated HTML of the page for the panel's validation. Imported by the content script only (inlined in its bundle).
 */
import { OVERLAY_ID, STYLE_ID } from './dom-utils'
import type { ScanCoverage } from '../lib/scan-coverage'
import { computeCoverage, noteCut, resetCuts } from './scan-coverage'

/** The generated HTML of the page (what the browser holds now, after scripts), without our own markers. */
export function takeSnapshot(): { url: string; title: string; html: string; coverage: ScanCoverage } {
  // no deep copy of the page (heavy on big pages): our own markers are lifted out for a moment, the page is serialized, they go back
  const lifted: { node: Element; parent: Node; next: Node | null }[] = []
  for (const node of Array.from(document.querySelectorAll(`[id^="${OVERLAY_ID}"], #${STYLE_ID}`))) {
    if (node.parentNode) lifted.push({ node, parent: node.parentNode, next: node.nextSibling })
  }
  for (const { node } of lifted) node.remove()
  // our own instance marker on <html> is not part of the page either
  const instance = document.documentElement.getAttribute('data-rgaa-instance')
  if (instance !== null) document.documentElement.removeAttribute('data-rgaa-instance')
  let html = ''
  try {
    html = document.documentElement.outerHTML
  } finally {
    if (instance !== null) document.documentElement.setAttribute('data-rgaa-instance', instance)
    for (const { node, parent, next } of lifted.reverse()) parent.insertBefore(node, next)
  }
  const dt = document.doctype
  const doctype = dt ? `<!DOCTYPE ${dt.name}${dt.publicId ? ` PUBLIC "${dt.publicId}"` : ''}${dt.systemId ? ` "${dt.systemId}"` : ''}>\n` : ''
  // a very large page is cut: the audit file and the validation stay manageable
  const MAX = 6_000_000
  resetCuts()
  noteCut('html characters', MAX, html.length)
  return { url: location.href, title: document.title, coverage: computeCoverage(document), html: doctype + (html.length > MAX ? `${html.slice(0, MAX)}\n<!-- cut: page larger than ${MAX} characters -->` : html) }
}
