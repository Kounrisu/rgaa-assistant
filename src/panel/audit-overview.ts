/**
 * The audit overview: dashboard (level tables, charts, results per page) and the sheets of all pages.
 */
import { h, dom } from './dom'
import { t } from '../lib/i18n'
import { pct2, type Counts, rateExact, type PageInput, auditStats, levelStats, isProvisional, auditSheets } from '../lib/audit-sheet'
import { provisionalHelp, tabsFor, sheetTable } from './results-view'
import { state } from './state'
import { pageLabel, allPageInputs } from './model'
import { exportWorkbook, openReport } from './exports'
import { slugOf } from './helpers'
import { actions } from './actions'

export function donut(label: string, cPct: number | null, caption: string): HTMLElement {
  const c = cPct ?? 0
  return h(
    'figure',
    { class: 'chart' },
    h('figcaption', {}, label),
    h(
      'div',
      { class: 'donut', style: `--c:${c}`, role: 'img', 'aria-label': cPct === null ? t('{label}: no data', { label }) : t('{label}: {c} compliant, {nc} non-compliant', { label, c: pct2(cPct), nc: pct2(100 - cPct) }) },
      h('span', {}, cPct === null ? '—' : pct2(cPct)),
    ),
    h('div', { class: 'legend' }, h('span', { class: 'lg c' }, 'C'), h('span', { class: 'lg nc' }, 'NC')),
    h('p', { class: 'chart-note' }, caption),
  )
}

/** Bars of C and NC per level, as in the official dashboard. */
export function levelBars(perLevel: Record<'A' | 'AA' | 'AAA', Counts>): HTMLElement {
  const W = 300
  const H = 170
  const left = 34
  const bottom = 26
  const plotH = H - bottom - 8
  const levels = ['A', 'AA', 'AAA'] as const
  const group = (W - left) / levels.length
  const NS = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(NS, 'svg')
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`)
  svg.setAttribute('class', 'bars')
  svg.setAttribute('role', 'img')
  svg.setAttribute('aria-label', levels.map((l) => t('{level}: {rate} compliant', { level: l, rate: pct2(rateExact(perLevel[l])) })).join('; '))
  const add = (tag: string, attrs: Record<string, string | number>, text?: string) => {
    const node = document.createElementNS(NS, tag)
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v))
    if (text) node.textContent = text
    svg.append(node)
    return node
  }
  for (const tick of [0, 25, 50, 75, 100]) {
    const y = 8 + plotH - (tick / 100) * plotH
    add('line', { x1: left, x2: W, y1: y, y2: y, class: 'grid-line' })
    add('text', { x: left - 4, y: y + 3, 'text-anchor': 'end', class: 'axis' }, `${tick}%`)
  }
  levels.forEach((l, i) => {
    const c = perLevel[l]
    const total = c.C + c.NC
    const cp = total ? (c.C / total) * 100 : 0
    const np = total ? (c.NC / total) * 100 : 0
    const x = left + i * group + group / 2
    add('rect', { x: x - 22, y: 8 + plotH - (cp / 100) * plotH, width: 20, height: Math.max(0, (cp / 100) * plotH), class: 'bar c' })
    add('rect', { x: x + 2, y: 8 + plotH - (np / 100) * plotH, width: 20, height: Math.max(0, (np / 100) * plotH), class: 'bar nc' })
    add('text', { x, y: H - 8, 'text-anchor': 'middle', class: 'axis' }, t('Level {level}', { level: l }))
  })
  return h('figure', { class: 'chart' }, h('figcaption', {}, t('Compliance by level')), svg as unknown as Node, h('div', { class: 'legend' }, h('span', { class: 'lg c' }, 'C'), h('span', { class: 'lg nc' }, 'NC')))
}

export function miniTable(caption: string, headers: string[], rows: (string | number | Node)[][], cls = ''): HTMLElement {
  const table = h('table', { class: `results-table mini ${cls}` })
  table.append(
    h('caption', {}, caption),
    h('thead', {}, h('tr', {}, ...headers.map((t) => h('th', { scope: 'col' }, t)))),
    h('tbody', {}, ...rows.map((r) => h('tr', {}, ...r.map((cell, i) => (i === 0 ? h('th', { scope: 'row' }, cell as string) : h('td', {}, cell as string)))))),
  )
  return table
}

/** The "Tableau de bord audit RGAA 4": level tables, charts, results per page and averages. */
export function dashboard(inputs: PageInput[]): HTMLElement {
  const stats = auditStats(inputs)
  const lv = levelStats(stats)
  const cOf = (c: Counts) => pct2(rateExact(c))
  const nOf = (c: Counts) => (c.C + c.NC ? pct2((c.NC / (c.C + c.NC)) * 100) : '—')
  const tone = (rate: number | null) => (rate === null ? 'none' : rate >= 100 ? 'full' : rate >= 75 ? 'good' : rate >= 50 ? 'mid' : 'low')

  const wrap = h('div', { class: 'dash2' })
  wrap.append(
    h(
      'section',
      { class: 'dash-col' },
      miniTable(t('RGAA 4 compliance'), ['', 'C', 'NC'], [['A', cOf(lv.perLevel.A), nOf(lv.perLevel.A)], [t('AA (legal)'), cOf(lv.legal), nOf(lv.legal)], ['AAA', cOf(lv.perLevel.AAA), nOf(lv.perLevel.AAA)]], 'level-table'),
      ...(isProvisional(lv.legal) ? [h('p', { class: 'hint warn' }, `${t('provisional')} — ${provisionalHelp()}`)] : []),
      h('p', { class: 'dash-note' }, t('These figures are the overall compliance level to report in the conformity statement. The reference is the legal level AA (A + AA): a site is declared compliant at 100 %. Other figures are indicative.')),
      miniTable(t('Compliance for each level'), ['', 'C', 'NC'], [['A', cOf(lv.perLevel.A), nOf(lv.perLevel.A)], ['AA', cOf(lv.perLevel.AA), nOf(lv.perLevel.AA)], ['AAA', cOf(lv.perLevel.AAA), nOf(lv.perLevel.AAA)]], 'level-table'),
      miniTable(t('Results by level'), ['', 'C', 'NC'], [['A', lv.perLevel.A.C, lv.perLevel.A.NC], ['AA', lv.perLevel.AA.C, lv.perLevel.AA.NC], ['AAA', lv.perLevel.AAA.C, lv.perLevel.AAA.NC], [t('Total'), lv.perLevel.A.C + lv.perLevel.AA.C + lv.perLevel.AAA.C, lv.perLevel.A.NC + lv.perLevel.AA.NC + lv.perLevel.AAA.NC]]),
    ),
    h(
      'section',
      { class: 'dash-col charts' },
      levelBars(lv.perLevel),
      donut(t('Compliance RGAA 4 (legal level AA)'), rateExact(lv.legal), t('C ÷ (C + NC) over the sample, levels A and AA') + (isProvisional(lv.legal) ? ` (${t('provisional')})` : '')),
      donut(t('Average per page'), lv.average, t('Average of the page rates')),
    ),
    h(
      'section',
      { class: 'dash-col' },
      h(
        'table',
        { class: 'results-table mini pages-result' },
        h('caption', {}, t('Results per page')),
        h('thead', {}, h('tr', {}, ...['', 'Page', 'C', 'NC', 'NA', '% C'].map((name) => h('th', { scope: 'col' }, t(name))))),
        h(
          'tbody',
          {},
          ...lv.pages.map((p) => {
            const rec = state.audit.pages.find((x) => pageLabel(x) === p.label)
            return h(
              'tr',
              {},
              h('th', { scope: 'row' }, p.label),
              h('td', {}, rec ? h('button', { type: 'button', class: 'link-btn-plain', title: p.title, onclick: () => actions.switchTo(rec.id) }, p.title || rec.url) : p.title),
              h('td', { class: 's-C' }, String(p.counts.C)),
              h('td', { class: 's-NC' }, String(p.counts.NC)),
              h('td', { class: 's-NA' }, String(p.counts.NA)),
              h('td', { class: `rate-cell ${tone(p.rate)}`, title: isProvisional(p.counts) ? provisionalHelp() : '' }, pct2(p.rate) + (p.rate !== null && isProvisional(p.counts) ? '*' : '')),
            )
          }),
        ),
      ),
      miniTable(t('Results: averages'), ['', ''], [[t('Average'), pct2(lv.average)], [lv.best ? t('Best page ({label})', { label: lv.best.label }) : t('Best page'), pct2(lv.best?.rate ?? null)], [lv.worst ? t('Worst page ({label})', { label: lv.worst.label }) : t('Worst page'), pct2(lv.worst?.rate ?? null)]]),
    ),
  )

  const themeTable = h('table', { class: 'results-table pages-table' })
  themeTable.append(
    h('caption', {}, t('By theme (sample level)')),
    h('thead', {}, h('tr', {}, ...['Theme', 'Audited', 'C', 'NC', 'NA', 'NT', 'Criteria respected'].map((name) => h('th', { scope: 'col' }, t(name))))),
  )
  const themeBody = h('tbody', {})
  for (const th of stats.perTheme) {
    themeBody.append(
      h(
        'tr',
        { class: th.audited ? '' : 'absent' },
        h('th', { scope: 'row' }, `${th.number}. ${th.name}`),
        h('td', {}, th.audited ? t('yes') : t('no')),
        h('td', { class: 's-C' }, String(th.counts.C)),
        h('td', { class: 's-NC' }, String(th.counts.NC)),
        h('td', { class: 's-NA' }, String(th.counts.NA)),
        h('td', { class: 's-NT' }, String(th.counts.NT)),
        h('td', {}, h('div', { class: 'meter', role: 'img', 'aria-label': t('{rate}% respected', { rate: th.rate ?? 0 }) }, h('i', { style: `width:${th.rate ?? 0}%` })), h('span', { class: 'meter-num', title: th.rate !== null && isProvisional(th.counts) ? provisionalHelp() : '' }, th.rate === null ? '—' : `${th.rate}%${isProvisional(th.counts) ? '*' : ''}`)),
      ),
    )
  }
  themeTable.append(themeBody)
  const calc = h(
    'section',
    { class: 'calc' },
    h('h3', {}, t('How compliance is calculated')),
    h('p', {}, t('Overall compliance is C ÷ (C + NC), where C is the number of compliant criteria and NC the number of non-compliant ones. Criteria that are not applicable (NA) or not tested (NT) are left out. This is the legal reference: it is the compliance rate of the sample.')),
    h('p', {}, t('Rates marked provisional (or with an asterisk) come from an incomplete audit. A criterion judged on only part of its tests keeps its result but flags the rate, a suggestion from a tool counts as to review until you confirm it, and a known failure is always kept.')),
    h('p', {}, t('Levels A / AA / AAA are derived from the WCAG success criteria each RGAA criterion references. The accessibility rate used elsewhere in this panel is the average of the page rates.')),
  )
  return h('div', {}, wrap, h('div', { class: 'results-scroll' }, themeTable), calc)
}

export function renderAudit(): void {
  dom.auditEl.replaceChildren()
  const inputs = allPageInputs()
  if (!inputs.length) return void dom.auditEl.append(h('p', { class: 'hint-line' }, t('Scan a page to start the audit.')))
  const sheets = auditSheets(inputs, state.audit.meta)
  const named = (name: string) => sheets.find((s) => s.name === name)!
  dom.auditEl.append(
    h(
      'div',
      { class: 'results-head' },
      h('div', {}, h('h2', {}, t('Audit pages overview — {n} page(s)', { n: inputs.length })), h('p', { class: 'hint-line' }, t('RGAA 4.1 · all audited themes · one sheet per page, like the official Excel grid.'))),
      h(
        'div',
        { class: 'nav' },
        h('button', { type: 'button', onclick: () => actions.setView('review') }, t('← Back to review')),
        h('button', { type: 'button', class: 'primary', onclick: () => void exportWorkbook(inputs, auditSheets(inputs, state.audit.meta), `grille-rgaa-${slugOf(state.audit.meta.site || state.audit.name)}.xlsx`) }, t('Export Excel (all pages)')),
        h('button', { type: 'button', class: 'primary', title: t('One printable page with the summary, the non-conformities and a draft accessibility statement'), onclick: () => openReport(false) }, t('Open the report')),
        h('button', { type: 'button', onclick: () => openReport(true) }, t('Download the report (HTML)')),
      ),
    ),
  )
  tabsFor(dom.auditEl, [
    { name: t('Dashboard'), render: () => dashboard(inputs) },
    { name: t('Summary'), render: () => sheetTable(named('Synthèse')) },
    { name: t('Sample'), render: () => h('div', {}, h('p', { class: 'hint-line' }, t('Pages and fields are edited in “Audit pages sample”. ')), h('button', { type: 'button', class: 'img-ref', onclick: () => actions.setView('sample') }, t('Edit the sample')), sheetTable(named('Échantillon'))) },
    { name: t('Criteria'), render: () => sheetTable(named('Critères')) },
    ...inputs.map((p) => ({ name: p.label, render: () => sheetTable(named(p.label)) })),
    { name: t('Detail by test (Images)'), render: () => sheetTable(named('Détail par test (Images)')) },
    { name: t('Detail by image'), render: () => sheetTable(named('Détail par image')) },
    ...(sheets.some((x) => x.name === 'Détail cadres et couleurs') ? [{ name: t('Frames and colours'), render: () => sheetTable(named('Détail cadres et couleurs')) }] : []),
  ], 'overviewSheet')
}
