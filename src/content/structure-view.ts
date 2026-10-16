/**
 * A rebuilt copy of the page that keeps only its HTML structure (landmarks, headings, paragraphs, lists, tables, links, buttons,
 * images as their alternative), so the auditor sees what the markup says without the site's design. Text that sits in a plain
 * div / span with no paragraph or heading around it is flagged. The result is plain, escaped HTML meant for a sandboxed frame.
 */
import { headingLevel, isHeading, looseTextNodes } from './page-tools'

const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'HEAD', 'META', 'LINK', 'TITLE'])
const KEEP = new Set(['P', 'UL', 'OL', 'LI', 'DL', 'DT', 'DD', 'BLOCKQUOTE', 'PRE', 'FIGURE', 'FIGCAPTION', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TD', 'TH', 'CAPTION', 'COLGROUP', 'EM', 'STRONG', 'B', 'I', 'CODE', 'SMALL', 'SUB', 'SUP', 'ABBR', 'CITE', 'Q', 'TIME', 'MARK', 'ADDRESS', 'DETAILS', 'SUMMARY', 'HR', 'BR', 'FORM', 'FIELDSET', 'LEGEND', 'LABEL'])
const LANDMARK: Record<string, string> = { HEADER: 'banner', NAV: 'navigation', MAIN: 'main', ASIDE: 'complementary', FOOTER: 'contentinfo', SECTION: 'region', ARTICLE: 'article', FORM: 'form' }
const MAX_NODES = 6000

const esc = (value: string): string => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const squash = (value: string): string => value.replace(/\s+/g, ' ').trim()

export function structurePreview(): { title: string; lang: string; html: string; headings: number; loose: number; truncated: boolean } {
  const loose = new Set<Node>(looseTextNodes())
  let nodes = 0
  let headings = 0
  let truncated = false

  const hidden = (el: Element): boolean => {
    if (el.hasAttribute('hidden') || el.getAttribute('aria-hidden') === 'true') return true
    const style = getComputedStyle(el)
    return style.display === 'none' || style.visibility === 'hidden'
  }
  const children = (el: Element): string => Array.from(el.childNodes).map(walk).join('')

  const walk = (node: Node): string => {
    if (++nodes > MAX_NODES) {
      truncated = true
      return ''
    }
    if (node.nodeType === Node.TEXT_NODE) {
      const text = squash((node as Text).data)
      if (!text) return ''
      const shown = esc(text.length > 600 ? `${text.slice(0, 600)}…` : text)
      return loose.has(node) ? `<span class="loose" title="Text with no paragraph, heading, list item, link or button around it">${shown}</span>` : shown
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return ''
    const el = node as Element
    const tag = el.tagName.toUpperCase()
    if (SKIP.has(tag) || el.id.startsWith('rgaa-assistant-overlay') || hidden(el)) return ''
    const role = (el.getAttribute('role') ?? '').toLowerCase()
    if (isHeading(el)) {
      headings++
      const level = headingLevel(el)
      const text = children(el)
      return `<h${level} class="h">${text || '<em class="bad">empty heading</em>'}</h${level}>`
    }
    if (tag === 'IMG' || role === 'img' || tag === 'SVG') {
      const name = el.getAttribute('alt') ?? el.getAttribute('aria-label') ?? el.querySelector('title')?.textContent ?? ''
      const none = tag === 'IMG' && el.getAttribute('alt') === null
      return `<span class="img${none || (!name && role !== 'presentation' && el.getAttribute('alt') !== '') ? ' bad' : ''}">${none ? 'image: no alt attribute' : name ? `image: ${esc(squash(name))}` : 'image: no text alternative (decorative?)'}</span>`
    }
    if (tag === 'A' && el.hasAttribute('href')) return `<a class="link" title="${esc(el.getAttribute('href') ?? '')}">${children(el) || '<em class="bad">link with no text</em>'}</a>`
    if (tag === 'BUTTON' || role === 'button') return `<span class="btn">${children(el) || esc(el.getAttribute('aria-label') ?? '') || '<em class="bad">button with no name</em>'}</span>`
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') {
      const type = tag === 'INPUT' ? (el as HTMLInputElement).type : tag.toLowerCase()
      return type === 'hidden' ? '' : `<span class="field">[${esc(type)}${el.getAttribute('aria-label') ? `: ${esc(el.getAttribute('aria-label')!)}` : ''}]</span>`
    }
    if (tag === 'IFRAME') return `<span class="frame">frame: ${esc(el.getAttribute('title') ?? 'no title')}</span>`
    if (tag === 'VIDEO' || tag === 'AUDIO' || tag === 'CANVAS') return `<span class="frame">${tag.toLowerCase()}</span>`
    const landmark = (role && ['banner', 'navigation', 'main', 'complementary', 'contentinfo', 'region', 'search', 'form'].includes(role) ? role : LANDMARK[tag]) as string | undefined
    if (landmark && (landmark !== 'region' || el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby')) ) {
      const name = el.getAttribute('aria-label')
      return `<section class="lm"><span class="lmtag">${landmark}${name ? ` · ${esc(name)}` : ''}</span>${children(el)}</section>`
    }
    if (KEEP.has(tag)) {
      const attrs = ['scope', 'colspan', 'rowspan'].filter((a) => el.hasAttribute(a)).map((a) => ` ${a}="${esc(el.getAttribute(a)!.slice(0, 8))}"`).join('')
      const lower = tag.toLowerCase()
      return tag === 'HR' || tag === 'BR' ? `<${lower}>` : `<${lower}${attrs}>${children(el)}</${lower}>`
    }
    // a plain div / span / section…: no meaning of its own, only its content counts
    return children(el)
  }

  const html = walk(document.body)
  return { title: document.title, lang: document.documentElement.getAttribute('lang') ?? '', html, headings, loose: loose.size, truncated }
}
