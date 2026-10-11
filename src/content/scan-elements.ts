/**
 * Element scanners for the themes 2 (frames), 6 (links), 9 (structure), 5 (tables) and 11 (form fields), and the entry
 * point that draws a theme's boxes (`scanTheme`); components (7) are in `scan-components.ts`. Imported by the content
 * script only (inlined in its bundle).
 */
import { OVERLAY_ID, boundedContext, labelledByTextFor, linkNameOf, rendered, shortHtml, skipTarget, visibilityOf, visible } from './dom-utils'
import { drawThemeBoxes, themeOverlayFor } from './overlay'
import { scanContrast } from './scan-contrast'
import type { RawFinding } from '../lib/types'
import { tabOrder } from './page-tools'
import { noteCut, resetCuts } from './scan-coverage'
import { scanComponents } from './scan-components'

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

/** Links (RGAA theme 6): one finding per distinct link (same name and destination), with every occurrence boxed. */
const GENERIC_LINK = /^(cliquez ici|clic ici|ici|en savoir plus|savoir plus|lire la suite|lire plus|voir plus|voir|plus|suite|d[eé]couvrir|d[eé]tails?|click here|here|read more|learn more|more|details?|link|lien)\s*[.…>»›]*$/i

function scanLinks(): { findings: RawFinding[]; els: Element[][] } {
  const groups = new Map<string, { els: Element[]; name: string; href: string; skip: boolean; found: boolean }>()
  const early = new Set(tabOrder().slice(0, 8))
  for (const a of Array.from(document.querySelectorAll('a[href], area[href], [role="link"]'))) {
    if (a.closest(`[id^="${OVERLAY_ID}"]`) || !rendered(a)) continue
    const name = linkNameOf(a)
    const href = a.getAttribute('href') ?? ''
    const sk = skipTarget(a, early)
    const key = `${name}|${href}`
    const g = groups.get(key) ?? { els: [], name, href, skip: sk.skip, found: sk.found }
    g.els.push(a)
    groups.set(key, g)
  }
  const findings: RawFinding[] = []
  const els: Element[][] = []
  noteCut('links', 400, groups.size)
  for (const g of Array.from(groups.values()).slice(0, 400)) {
    const first = g.els[0]
    const empty = !g.name
    const generic = !empty && GENERIC_LINK.test(g.name)
    const short = g.name.length > 48 ? `${g.name.slice(0, 47)}…` : g.name
    const vis = visibilityOf(first)
    findings.push({
      type: empty ? 'link-empty' : g.skip ? (g.found ? 'link-skip' : 'link-skip-broken') : generic ? 'link-generic' : 'link',
      id: findings.length + 1,
      label: empty ? `<${first.tagName.toLowerCase()}> without name` : `“${short}”`,
      summary: g.href || '(no href)',
      facts: {
        Text: (first.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 120) || null,
        'Accessible name': g.name || null,
        href: g.href || null,
        target: first.getAttribute('target'),
        title: first.getAttribute('title'),
        'aria-label': first.getAttribute('aria-label'),
        Occurrences: g.els.length > 1 ? String(g.els.length) : null,
        'Skip link': g.skip ? (g.found ? 'yes, target found' : 'yes, TARGET NOT FOUND') : null,
        Visibility: vis.Visibility,
        Element: `<${first.tagName.toLowerCase()}>`,
      },
      html: shortHtml(first),
      contextHtml: boundedContext(first),
      count: g.els.length,
      data: { humanNeeded: empty || generic || (g.skip && !g.found), reason: empty ? 'no-name' : generic ? 'generic' : '', hidden: vis.hidden },
    })
    els.push(g.els)
  }
  return { findings, els }
}

/** Structure (RGAA theme 9): headings with their level, and landmarks, in document order, plus page-level problems. */
const LANDMARK_BY_TAG: Record<string, string> = { nav: 'navigation', main: 'main', aside: 'complementary', form: 'form', section: 'region' }
const LANDMARK_ROLES = new Set(['banner', 'navigation', 'main', 'complementary', 'contentinfo', 'search', 'region', 'form'])

function landmarkRole(el: Element): string | null {
  const explicit = el.getAttribute('role')?.trim().toLowerCase() ?? ''
  if (LANDMARK_ROLES.has(explicit)) return explicit
  const tag = el.tagName.toLowerCase()
  if (tag === 'header' || tag === 'footer') return el.closest('article, aside, main, nav, section') ? null : tag === 'header' ? 'banner' : 'contentinfo'
  const role = LANDMARK_BY_TAG[tag]
  if (!role) return null
  const named = Boolean(el.getAttribute('aria-label') || el.getAttribute('aria-labelledby'))
  return (tag === 'form' || tag === 'section') && !named ? null : role
}

function scanStructure(): { findings: RawFinding[]; els: Element[][] } {
  const findings: RawFinding[] = []
  const els: Element[][] = []
  const nodes = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"], header, footer, nav, main, aside, form, section, [role]')).filter((e) => !e.closest(`[id^="${OVERLAY_ID}"]`) && rendered(e))
  let previous = 0
  let h1 = 0
  let main = 0
  const named = (e: Element) => (labelledByTextFor(e) || e.getAttribute('aria-label') || '').trim()
  for (const el of nodes) {
    const tag = el.tagName.toLowerCase()
    const isHeading = /^h[1-6]$/.test(tag) || el.getAttribute('role') === 'heading'
    if (isHeading) {
      const level = /^h[1-6]$/.test(tag) ? Number(tag[1]) : Number(el.getAttribute('aria-level')) || 2
      const text = (labelledByTextFor(el) || el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim() || (el.querySelector('img[alt]')?.getAttribute('alt') ?? '').trim()
      const empty = !text
      const jump = previous > 0 && level > previous + 1
      if (level === 1) h1++
      findings.push({
        type: empty ? 'heading-empty' : jump ? 'heading-jump' : 'heading',
        id: findings.length + 1,
        label: empty ? `h${level} (empty)` : `“${text.length > 56 ? `${text.slice(0, 55)}…` : text}”`,
        summary: `h${level}${jump ? ` · jump from h${previous}` : ''}`,
        facts: { Level: `h${level}`, Text: text || null, 'Previous level': previous ? `h${previous}` : null, Visibility: visibilityOf(el).Visibility, Element: `<${tag}>` },
        html: shortHtml(el),
        contextHtml: boundedContext(el),
        count: 1,
        data: { humanNeeded: empty || jump, group: 'heading', level, badge: `h${level}`, hidden: visibilityOf(el).hidden },
      })
      els.push([el])
      previous = level
      continue
    }
    const role = landmarkRole(el)
    if (!role) continue
    if (role === 'main') main++
    const name = named(el)
    findings.push({
      type: 'landmark',
      id: findings.length + 1,
      label: `${role}${name ? ` “${name}”` : ''}`,
      summary: `<${tag}>`,
      facts: { Role: role, Name: name || null, Element: `<${tag}>` },
      html: shortHtml(el),
      contextHtml: boundedContext(el),
      count: 1,
      data: { humanNeeded: false, group: 'landmark', level: 1, badge: role },
    })
    els.push([el])
  }
  const page = (type: string, label: string, facts: Record<string, string | null>) => {
    findings.unshift({ type, id: 0, label, summary: '', facts, html: '', contextHtml: '', count: 0, data: { humanNeeded: true, group: 'page', level: 0, badge: '' } })
    els.unshift([])
  }
  if (!main) page('page-no-main', 'No main landmark', {})
  if (h1 > 1) page('page-many-h1', `${h1} h1`, { Count: String(h1) })
  if (!h1) page('page-no-h1', 'No h1', {})
  findings.forEach((f, i) => (f.id = i + 1))
  return { findings, els }
}

/** Tables (RGAA theme 5): one finding per table, data or layout. */
function scanTables(): { findings: RawFinding[]; els: Element[][] } {
  const findings: RawFinding[] = []
  const els: Element[][] = []
  const allTables = Array.from(document.querySelectorAll('table, [role="table"], [role="grid"], [role="treegrid"]'))
  noteCut('tables', 200, allTables.length)
  for (const t of allTables.slice(0, 200)) {
    if (t.closest(`[id^="${OVERLAY_ID}"]`) || !rendered(t)) continue
    const vis = visibilityOf(t)
    const role = (t.getAttribute('role') ?? '').toLowerCase()
    const layoutRole = role === 'presentation' || role === 'none'
    const th = t.querySelectorAll('th, [role="columnheader"], [role="rowheader"]').length
    const rows = t.querySelectorAll('tr, [role="row"]').length
    const cols = Math.max(0, ...Array.from(t.querySelectorAll('tr, [role="row"]')).map((r) => r.children.length))
    const caption = (t.querySelector('caption')?.textContent ?? t.getAttribute('aria-label') ?? labelledByTextFor(t) ?? t.getAttribute('title') ?? '').replace(/\s+/g, ' ').trim()
    const summary = t.getAttribute('summary') || t.getAttribute('aria-describedby')
    const semantic = Boolean(th || t.querySelector('caption, thead, tfoot') || t.hasAttribute('summary') || t.querySelector('[headers], [scope]'))
    const type = layoutRole ? (semantic ? 'table-layout-semantic' : 'table-layout') : th ? 'table-data' : 'table-nohead'
    findings.push({
      type,
      id: findings.length + 1,
      label: caption ? `“${caption.length > 56 ? `${caption.slice(0, 55)}…` : caption}”` : `table ${rows}×${cols}`,
      summary: `${rows} rows × ${cols} columns · ${th} header cell(s)`,
      facts: { Rows: String(rows), Columns: String(cols), 'Header cells (th)': String(th), Title: caption || null, Summary: summary, role: role || null, Visibility: vis.Visibility, Element: `<${t.tagName.toLowerCase()}>` },
      html: shortHtml(t),
      contextHtml: boundedContext(t),
      count: 1,
      data: { humanNeeded: type !== 'table-data' || Boolean(caption), hasTitle: Boolean(caption), hasHeaders: th > 0, layout: layoutRole, hidden: vis.hidden },
    })
    els.push([t])
  }
  return { findings, els }
}

/** Form fields (RGAA theme 11): one finding per field, with the name a screen reader would give it. */
const PERSONAL_FIELD = /(e-?mail|mail|t[eé]l|phone|pr[eé]nom|firstname|first-name|lastname|last-name|\bnom\b|\bname\b|adresse|address|postal|zip|ville|city|naissance|birth|username|login|identifiant|password|mot de passe)/i

function fieldNameOf(f: Element): { name: string; source: string } {
  const id = f.getAttribute('id')
  const byFor = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null
  const wrap = f.closest('label')
  const label = (byFor ?? wrap)?.textContent?.replace(/\s+/g, ' ').trim()
  const labelled = labelledByTextFor(f)
  if (labelled) return { name: labelled, source: 'aria-labelledby' }
  const aria = f.getAttribute('aria-label')?.trim()
  if (aria) return { name: aria, source: 'aria-label' }
  if (label) return { name: label, source: 'label' }
  const title = f.getAttribute('title')?.trim()
  if (title) return { name: title, source: 'title' }
  const ph = f.getAttribute('placeholder')?.trim()
  if (ph) return { name: ph, source: 'placeholder' }
  return { name: '', source: '' }
}

function scanFields(): { findings: RawFinding[]; els: Element[][] } {
  const findings: RawFinding[] = []
  const els: Element[][] = []
  const sel = 'input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([type=image]), select, textarea, [role="textbox"], [role="combobox"], [role="listbox"], [role="checkbox"], [role="radio"], [role="switch"], [role="slider"], [role="spinbutton"], [role="searchbox"]'
  const allFields = Array.from(document.querySelectorAll(sel))
  noteCut('fields', 300, allFields.length)
  for (const f of allFields.slice(0, 300)) {
    if (f.closest(`[id^="${OVERLAY_ID}"]`) || !rendered(f)) continue
    const vis = visibilityOf(f)
    const tag = f.tagName.toLowerCase()
    const type = (f.getAttribute('type') ?? (tag === 'input' ? 'text' : tag)).toLowerCase()
    const { name, source } = fieldNameOf(f)
    const ac = (f.getAttribute('autocomplete') ?? '').trim().toLowerCase()
    const personal = ['email', 'tel', 'password'].includes(type) || PERSONAL_FIELD.test([f.getAttribute('name'), f.id, f.getAttribute('aria-label'), f.getAttribute('placeholder'), name].join(' '))
    const kind = !name ? 'field-nolabel' : source === 'placeholder' ? 'field-placeholder' : 'field'
    findings.push({
      type: kind,
      id: findings.length + 1,
      label: name ? `“${name.length > 48 ? `${name.slice(0, 47)}…` : name}”` : `<${tag}> without label`,
      summary: `${type}${source ? ` · ${source}` : ''}`,
      facts: { Type: type, 'Accessible name': name || null, 'Name comes from': source || null, Autocomplete: ac || null, Required: f.hasAttribute('required') || f.getAttribute('aria-required') === 'true' ? 'yes' : null, name: f.getAttribute('name'), Visibility: vis.Visibility, Element: `<${tag}>` },
      html: shortHtml(f),
      contextHtml: boundedContext(f),
      count: 1,
      data: { humanNeeded: kind !== 'field', personal, hasAutocomplete: Boolean(ac) && ac !== 'off', hidden: vis.hidden },
    })
    els.push([f])
  }
  return { findings, els }
}

export function scanTheme(theme: number, color: string): RawFinding[] {
  resetCuts()
  const { findings, els } = theme === 2 ? scanFrames() : theme === 6 ? scanLinks() : theme === 9 ? scanStructure() : theme === 5 ? scanTables() : theme === 11 ? scanFields() : theme === 7 ? scanComponents() : scanContrast()
  themeOverlayFor(theme, color)
  // every element keeps its box, unless the page has so many that only the ones to look at stay (hundreds of boxes slow a page down)
  const many = findings.length > 350
  findings.forEach((f, i) => drawThemeBoxes(theme, f.id, els[i], theme === 3 ? f.type !== 'contrast-ok' : [2, 5, 6, 7, 9, 11].includes(theme) && !many ? els[i].length > 0 : f.data.humanNeeded === true, typeof f.data.badge === 'string' ? f.data.badge : ''))
  return findings
}
