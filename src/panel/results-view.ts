/**
 * The results of the page (one grid per official test), and the sheet tables shared with the audit overview.
 */
import { h, dom } from './dom'
import { t } from '../lib/i18n'
import { state } from './state'
import type { Sheet } from '../lib/xlsx'
import { select } from './images-view'
import { pageInput, pageLabel } from './model'
import { auditStats, auditSheets, isProvisional, pageSheets } from '../lib/audit-sheet'
import { exportWorkbook } from './exports'
import { slugOf } from './helpers'
import { actions } from './actions'

export function tabsFor(host: HTMLElement, tabs: { name: string; render: () => HTMLElement }[], which: 'resultsSheet' | 'overviewSheet'): void {
  const bar = h('div', { class: 'sheet-tabs', role: 'tablist', 'aria-label': t('Sections') })
  const panel = h('div', { class: 'results-scroll', role: 'tabpanel' })
  const show = (index: number) => {
    state[which] = Math.min(index, tabs.length - 1)
    bar.querySelectorAll('button').forEach((b, i) => {
      b.setAttribute('aria-selected', String(i === state[which]))
      b.tabIndex = i === state[which] ? 0 : -1
    })
    panel.replaceChildren(tabs[state[which]].render())
  }
  tabs.forEach((t, i) => bar.append(h('button', { type: 'button', role: 'tab', onclick: () => show(i) }, t.name)))
  bar.addEventListener('keydown', (event) => {
    const dir = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!dir) return
    const next = (state[which] + dir + tabs.length) % tabs.length
    show(next)
    ;(bar.children[next] as HTMLElement).focus()
  })
  host.append(bar, panel)
  show(state[which])
}

/** Renders one sheet exactly as it is exported to Excel. */
export function sheetTable(sheet: Sheet): HTMLElement {
  const table = h('table', { class: 'results-table grid' })
  table.append(h('caption', { class: 'sr-only' }, sheet.name))
  const colgroup = h('colgroup', {})
  for (const w of sheet.widths) colgroup.append(h('col', { style: `min-width:${Math.round(w * 7)}px` }))
  table.append(colgroup)
  const cols = sheet.widths.length
  const body = h('tbody', {})
  sheet.rows.forEach((row, ri) => {
    if (!row.length) return body.append(h('tr', { class: 'gap' }, h('td', { colSpan: cols })))
    const cells = row.map((c) => (c !== null && typeof c === 'object' ? c : { v: c ?? '', s: undefined }))
    const isHead = cells.length > 1 && cells.every((c) => c.s === 'head' || c.v === '') && cells.some((c) => c.s === 'head') && ri > 0
    const single = cells.length === 1
    const crit = cells.length >= 7 && typeof cells[1].v === 'string' && /^\d+\.\d+$/.test(cells[1].v) ? cells[1].v : null
    const tr = h('tr', { class: single ? 'sheet-title' : '', 'data-crit': crit })
    cells.forEach((c, ci) => {
      const tag = isHead || (c.s === 'head' && ci === 0) ? 'th' : 'td'
      const cell = h(tag as 'td', { class: `s-${c.s ?? 'default'}`, colSpan: single ? cols : 1, scope: tag === 'th' ? (isHead ? 'col' : 'row') : undefined })
      if ('image' in c && c.image) cell.append(h('img', { class: 'sheet-thumb', src: c.image, alt: t('Image preview'), loading: 'lazy' }))
      else appendWithImageLinks(cell, String(c.v))
      tr.append(cell)
    })
    body.append(tr)
  })
  table.append(body)
  return table
}

/** "#3" tokens become buttons that jump to that image in the review view (current page only). */
export function appendWithImageLinks(cell: HTMLElement, text: string): void {
  for (const part of text.split(/(#\d+)/g)) {
    const m = /^#(\d+)$/.exec(part)
    if (m && state.view === 'page' && state.elements.some((e) => e.id === Number(m[1]))) {
      const id = Number(m[1])
      cell.append(h('button', { type: 'button', class: 'img-ref', onclick: () => { actions.setView('review'); select(id, true) } }, part))
    } else if (part) cell.append(part)
  }
}

/** Why a rate is marked provisional, and how criteria with unconfirmed or partial results are counted. */
export const provisionalHelp = (): string =>
  t('Provisional rate: some criteria are still to test, are only partly covered by this tool, or rest on an automatic answer you have not confirmed. A criterion judged on only part of its tests keeps its result but keeps the rate provisional; a suggested compliance counts as to review until you confirm it; a failure is always kept.')

export function renderResults(): void {
  dom.resultsEl.replaceChildren()
  if (!state.page) return
  const input = pageInput(state.page)
  const stat = auditStats([input]).perPage[0]
  const pill = (cls: string, text: string) => h('span', { class: `outcome ${cls}` }, text)
  dom.resultsEl.append(
    h(
      'div',
      { class: 'results-head' },
      h('div', {}, h('h2', {}, `${pageLabel(state.page)} — ${state.page.title || state.page.url}`), h('p', { class: 'hint-line' }, state.page.url)),
      h(
        'div',
        { class: 'nav' },
        h('button', { type: 'button', onclick: () => actions.setView('review') }, t('← Back to review')),
        h('button', { type: 'button', onclick: () => actions.setView('audit') }, t('Audit pages overview')),
        h('button', { type: 'button', class: 'primary', onclick: () => void exportWorkbook([input], auditSheets([input], state.audit.meta), `grille-rgaa-${slugOf(state.audit.meta.site || state.audit.name)}-${pageLabel(state.page!)}.xlsx`) }, t('Export this page (.xlsx)')),
      ),
    ),
    h(
      'div',
      { class: 'results-summary' },
      h('div', { class: 'rate' }, h('strong', {}, stat.rate === null ? '—' : `${stat.rate}%`), ...(stat.rate !== null && isProvisional(stat.counts) ? [h('span', { class: 'pill warn-pill', title: provisionalHelp() }, t('provisional'))] : []), h('span', {}, t('accessibility rate of {label} (C ÷ (C + NC), themes {themes})', { label: pageLabel(state.page), themes: stat.themes.join(', ') }))),
      pill('c', t('{n} compliant', { n: stat.counts.C })),
      pill('nc', t('{n} non-compliant', { n: stat.counts.NC })),
      pill('na', t('{n} not applicable', { n: stat.counts.NA })),
      pill('pending', t('{n} not tested', { n: stat.counts.NT })),
      ...(stat.counts.suggested ? [pill('pending', t('{n} to confirm', { n: stat.counts.suggested }))] : []),
      ...(stat.counts.partial ? [pill('pending', t('{n} partly covered', { n: stat.counts.partial }))] : []),
    ),
    ...(isProvisional(stat.counts) ? [h('p', { class: 'hint warn' }, provisionalHelp())] : []),
  )
  const sheets = pageSheets(input)
  tabsFor(dom.resultsEl, sheets.map((sheet) => ({ name: sheet.name === pageLabel(state.page!) ? t('Grid ({label})', { label: pageLabel(state.page!) }) : sheet.name, render: () => sheetTable(sheet) })), 'resultsSheet')
}
