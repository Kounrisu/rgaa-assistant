/**
 * “Reading view”: what a screen reader would say, as text. For the page (landmarks, headings, lists, links, buttons,
 * fields, images in reading order) and for the tables (each data cell with the header cells that name it), so the
 * auditor can judge by ear what the markup really conveys. Problems are flagged on the line where they happen.
 */
export interface TranscriptLine {
  text: string
  /** A problem the auditor should look at. */
  warn?: boolean
}
export interface TranscriptBlock {
  title: string
  lines: TranscriptLine[]
}
export interface TranscriptResult {
  blocks: TranscriptBlock[]
  truncated: boolean
}

const squash = (value: string | null | undefined): string => (value ?? '').replace(/\s+/g, ' ').trim()
const MAX_LINES = 1500

const isHidden = (el: Element): boolean => {
  if (el.hasAttribute('hidden') || el.getAttribute('aria-hidden') === 'true') return true
  if (el.id.startsWith('rgaa-assistant-overlay')) return true
  const style = getComputedStyle(el)
  return style.display === 'none' || style.visibility === 'hidden'
}

/** The accessible name, simplified: aria-labelledby, aria-label, label, alt, content, title. */
function nameOf(el: Element): string {
  const by = el.getAttribute('aria-labelledby')
  if (by) {
    const text = squash(by.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join(' '))
    if (text) return text
  }
  const label = squash(el.getAttribute('aria-label'))
  if (label) return label
  if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
    const text = squash(Array.from(el.labels ?? []).map((l) => l.textContent).join(' '))
    if (text) return text
    if (el instanceof HTMLInputElement && ['button', 'submit', 'reset'].includes(el.type) && el.value) return squash(el.value)
    if (el instanceof HTMLInputElement && el.type === 'image') return squash(el.alt)
  }
  if (el instanceof HTMLImageElement) return squash(el.alt)
  const own = squash(el.textContent)
  if (own) return own
  const img = el.querySelector('img[alt], svg title, [aria-label]')
  const inner = img ? squash(img.getAttribute('alt') ?? img.getAttribute('aria-label') ?? img.textContent) : ''
  return inner || squash(el.getAttribute('title'))
}

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

const BLOCK = new Set(['P', 'DIV', 'SECTION', 'ARTICLE', 'LI', 'UL', 'OL', 'DL', 'DT', 'DD', 'BLOCKQUOTE', 'PRE', 'FIGURE', 'FIGCAPTION', 'HEADER', 'NAV', 'MAIN', 'ASIDE', 'FOOTER', 'FORM', 'FIELDSET', 'LEGEND', 'ADDRESS', 'DETAILS', 'SUMMARY', 'HR', 'BR', 'TR', 'BODY'])
const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'HEAD'])
const LANDMARK: Record<string, string> = { HEADER: 'banner', NAV: 'navigation', MAIN: 'main', ASIDE: 'complementary', FOOTER: 'contentinfo', FORM: 'form' }
const ROLE_LANDMARKS = new Set(['banner', 'navigation', 'main', 'complementary', 'contentinfo', 'search', 'form', 'region'])

export function pageTranscript(): TranscriptResult {
  const lines: TranscriptLine[] = []
  let buffer = ''
  let previousLevel = 0
  let truncated = false

  const push = (text: string, warn = false): void => {
    if (lines.length >= MAX_LINES) {
      truncated = true
      return
    }
    lines.push({ text, warn: warn || undefined })
  }
  const flush = (): void => {
    const text = squash(buffer)
    buffer = ''
    if (text) push(text)
  }

  const walk = (node: Node): void => {
    if (lines.length >= MAX_LINES) return void (truncated = true)
    if (node.nodeType === Node.TEXT_NODE) {
      buffer += ` ${(node as Text).data}`
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const el = node as Element
    const tag = el.tagName.toUpperCase()
    if (SKIP.has(tag) || isHidden(el)) return
    const role = (el.getAttribute('role') ?? '').toLowerCase()

    if (/^H[1-6]$/.test(tag) || role === 'heading') {
      flush()
      const level = /^H([1-6])$/.test(tag) ? Number(tag[1]) : Number(el.getAttribute('aria-level')) || 2
      const text = squash(el.textContent)
      const skipped = previousLevel > 0 && level > previousLevel + 1
      push(`Heading level ${level}: ${text || '(empty)'}${skipped ? ` — skips from level ${previousLevel}` : ''}`, !text || skipped)
      previousLevel = level
      return
    }
    if (tag === 'IMG' || role === 'img') {
      flush()
      const alt = el.getAttribute('alt')
      const name = nameOf(el)
      if (tag === 'IMG' && alt === null && !name) push('Image: no alt attribute (a screen reader reads the file name)', true)
      else if (!name && role !== 'presentation' && role !== 'none') push('Image: decorative (ignored)')
      else push(`Image: ${name}`)
      return
    }
    if (tag === 'SVG') {
      flush()
      const name = nameOf(el)
      if (name) push(`Graphic: ${name}`)
      return
    }
    if (tag === 'A' && el.hasAttribute('href')) {
      flush()
      const name = nameOf(el)
      push(`Link: ${name || '(no name)'}`, !name)
      return
    }
    if (tag === 'BUTTON' || role === 'button') {
      flush()
      const name = nameOf(el)
      push(`Button: ${name || '(no name)'}`, !name)
      return
    }
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') {
      const type = tag === 'INPUT' ? (el as HTMLInputElement).type : tag.toLowerCase()
      if (type === 'hidden') return
      flush()
      const name = nameOf(el)
      push(`Form field (${type}): ${name || '(no name)'}`, !name)
      return
    }
    if (tag === 'IFRAME') {
      flush()
      const title = squash(el.getAttribute('title'))
      push(`Frame: ${title || '(no title)'}`, !title)
      return
    }
    if (tag === 'TABLE' || role === 'table' || role === 'grid') {
      flush()
      const caption = squash(el.querySelector('caption')?.textContent) || squash(el.getAttribute('aria-label'))
      const rows = el.querySelectorAll('tr').length
      push(`Table${caption ? `, ${caption}` : ' (no title)'}, ${rows} row(s) — see the table reading for its cells`, !caption && role !== 'presentation')
      return
    }
    const landmark = ROLE_LANDMARKS.has(role) ? role : tag === 'SECTION' ? (el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby') ? 'region' : '') : LANDMARK[tag]
    if (landmark) {
      flush()
      const name = squash(el.getAttribute('aria-label'))
      push(`Landmark: ${landmark}${name ? ` “${name}”` : ''}`)
      el.childNodes.forEach(walk)
      flush()
      push(`End of landmark: ${landmark}`)
      return
    }
    if (tag === 'UL' || tag === 'OL') {
      flush()
      const items = Array.from(el.children).filter((c) => c.tagName === 'LI').length
      push(`List, ${items} item(s)`)
      el.childNodes.forEach(walk)
      flush()
      push('End of list')
      return
    }
    const block = BLOCK.has(tag)
    if (block) flush()
    el.childNodes.forEach(walk)
    if (block) flush()
  }

  walk(document.body)
  flush()
  return { blocks: [{ title: squash(document.title) || 'Page', lines }], truncated }
}

/* ------------------------------------------------------------------ */
/* Tables                                                               */
/* ------------------------------------------------------------------ */

interface Cell {
  el: HTMLTableCellElement
  row: number
  col: number
}

/** The grid with rowspan / colspan unfolded: each cell knows where it starts. */
function gridOf(table: HTMLTableElement): { cells: Cell[]; rows: number; cols: number } {
  const cells: Cell[] = []
  const taken: boolean[][] = []
  let cols = 0
  Array.from(table.rows).forEach((tr, r) => {
    let c = 0
    for (const el of Array.from(tr.cells)) {
      while (taken[r]?.[c]) c++
      cells.push({ el, row: r, col: c })
      for (let dr = 0; dr < Math.max(1, el.rowSpan); dr++) for (let dc = 0; dc < Math.max(1, el.colSpan); dc++) (taken[r + dr] ??= [])[c + dc] = true
      c += Math.max(1, el.colSpan)
      cols = Math.max(cols, c)
    }
  })
  return { cells, rows: table.rows.length, cols }
}

function tableBlock(table: HTMLTableElement, index: number): TranscriptBlock {
  const lines: TranscriptLine[] = []
  const caption = squash(table.querySelector('caption')?.textContent) || squash(table.getAttribute('aria-label')) || squash(table.getAttribute('title'))
  const role = (table.getAttribute('role') ?? '').toLowerCase()
  const { cells, rows, cols } = gridOf(table)
  const title = `Table ${index + 1}${caption ? `: ${caption}` : ''}`
  if (role === 'presentation' || role === 'none') {
    lines.push({ text: 'Layout table (role presentation): the cells are read one after the other, as plain text.' })
    for (let r = 0; r < rows; r++) {
      const text = squash(cells.filter((c) => c.row === r).map((c) => squash(c.el.textContent)).join(' · '))
      if (text) lines.push({ text })
    }
    return { title, lines }
  }
  lines.push({ text: `Table${caption ? `, ${caption}` : ', no title'}, ${rows} row(s), ${cols} column(s)`, warn: !caption })

  const headers = cells.filter((c) => c.el.tagName === 'TH' || ['columnheader', 'rowheader'].includes((c.el.getAttribute('role') ?? '').toLowerCase()))
  if (!headers.length) lines.push({ text: 'No header cell (th): a screen reader cannot tell which column or row a cell belongs to.', warn: true })

  const scopeOf = (c: Cell): 'col' | 'row' | 'both' | 'none' => {
    const scope = (c.el.getAttribute('scope') ?? '').toLowerCase()
    if (scope === 'col' || scope === 'colgroup') return 'col'
    if (scope === 'row' || scope === 'rowgroup') return 'row'
    const role = (c.el.getAttribute('role') ?? '').toLowerCase()
    if (role === 'columnheader') return 'col'
    if (role === 'rowheader') return 'row'
    if (c.el.tagName !== 'TH') return 'none'
    // no scope: the browser guesses — a th that is only followed by td in its row, or sits in the first row, heads a column / row
    const sameRow = cells.filter((o) => o.row === c.row)
    const rowAllTh = sameRow.every((o) => o.el.tagName === 'TH')
    return rowAllTh ? 'col' : c.col === 0 ? 'row' : 'col'
  }

  const byId = (id: string): HTMLElement | null => (table.contains(document.getElementById(id)) ? document.getElementById(id) : null)

  const dataCells = cells.filter((c) => !headers.includes(c))
  const readHeaders = (cell: Cell): { names: string[]; problem: string | null } => {
    const attr = squash(cell.el.getAttribute('headers'))
    if (attr) {
      const ids = attr.split(' ')
      const found = ids.map(byId)
      const missing = ids.filter((_, i) => !found[i])
      return { names: found.filter((x): x is HTMLElement => Boolean(x)).map((x) => squash(x.textContent)), problem: missing.length ? `headers points to missing id: ${missing.join(', ')}` : null }
    }
    const names: string[] = []
    for (const h of headers) {
      const scope = scopeOf(h)
      const colspan = Math.max(1, h.el.colSpan)
      const rowspan = Math.max(1, h.el.rowSpan)
      if ((scope === 'col' || scope === 'both') && h.row < cell.row && cell.col >= h.col && cell.col < h.col + colspan) names.push(squash(h.el.textContent))
      else if ((scope === 'row' || scope === 'both') && h.col < cell.col && cell.row >= h.row && cell.row < h.row + rowspan) names.push(squash(h.el.textContent))
    }
    return { names, problem: null }
  }

  for (let r = 0; r < rows; r++) {
    const rowCells = cells.filter((c) => c.row === r)
    if (!rowCells.length) continue
    if (rowCells.every((c) => headers.includes(c))) {
      lines.push({ text: `Header row ${r + 1}: ${rowCells.map((c) => squash(c.el.textContent) || '(empty header)').join(' | ')}` })
      continue
    }
    const parts: string[] = []
    let warn = false
    for (const cell of rowCells) {
      const value = squash(cell.el.textContent) || '(empty)'
      if (headers.includes(cell)) {
        parts.push(`${squash(cell.el.textContent) || '(empty header)'} [row header]`)
        continue
      }
      const { names, problem } = readHeaders(cell)
      if (problem) warn = true
      if (!names.length && headers.length) warn = true
      parts.push(`${names.length ? names.join(' – ') : '(no header)'}: ${value}${problem ? ` ✕ ${problem}` : ''}`)
    }
    lines.push({ text: `Row ${r + 1} — ${parts.join(' ; ')}`, warn: warn || undefined })
  }
  if (dataCells.length && headers.length && !dataCells.some((c) => readHeaders(c).names.length)) lines.push({ text: 'No data cell is tied to a header cell: add scope or headers.', warn: true })
  return { title, lines }
}

export function tableTranscript(): TranscriptResult {
  const tables = Array.from(document.querySelectorAll('table')).filter((t) => !isHidden(t) && !t.closest('[id^="rgaa-assistant-overlay"]'))
  const blocks = tables.slice(0, 40).map((t, i) => tableBlock(t, i))
  return { blocks: blocks.length ? blocks : [{ title: 'Tables', lines: [{ text: 'No table on this page.' }] }], truncated: tables.length > 40 }
}
