import type { ChecklistVerdict, ImportReport, PageRecord } from './types'

/**
 * Results of the automatic scan (the axe engine run on the page) turned into pre-filled answers.
 * A finding only ever sets "non-compliant, to confirm": a scan that finds nothing does not prove a criterion
 * is met, so passes are never turned into "compliant".
 */

export interface ToolNode {
  html: string
  target: string[]
  summary: string
}
export interface ToolViolation {
  rule: string
  impact: string | null
  help: string
  nodes: ToolNode[]
  /** The data axe computed for the node (contrast ratio…), when it gave some. */
  data?: Record<string, unknown>
}
export interface ToolResults {
  tool: string
  url: string
  violations: ToolViolation[]
  answers: { criterion: string; status: ChecklistVerdict | null; note: string; rule?: string }[]
  incomplete: number
  passes: number
  /** Checks that ran and found nothing, by criterion (a pass is shown, and only fills a fully automatic criterion). */
  passedChecks: { criterion: string; rule: string }[]
}

/** axe-core rule → RGAA 4.1 criterion. Only the rules whose meaning is clear are listed. */
export const AXE_TO_RGAA: Record<string, string> = {
  'image-alt': '1.1', 'input-image-alt': '1.1', 'role-img-alt': '1.1', 'svg-img-alt': '1.1', 'area-alt': '1.1', 'object-alt': '1.1',
  'frame-title': '2.1',
  'color-contrast': '3.2',
  'meta-viewport': '10.4',
  'link-in-text-block': '10.6',
  'link-name': '6.2',
  'button-name': '11.9', 'input-button-name': '11.9',
  label: '11.1', 'select-name': '11.1',
  'autocomplete-valid': '11.13',
  'document-title': '8.5', 'html-has-lang': '8.3', 'html-lang-valid': '8.4', 'duplicate-id': '8.2', 'duplicate-id-active': '8.2', 'duplicate-id-aria': '8.2',
  'heading-order': '9.1', 'empty-heading': '9.1', 'page-has-heading-one': '9.1',
  'landmark-one-main': '9.2',
  list: '9.3', listitem: '9.3', 'definition-list': '9.3', dlitem: '9.3',
  bypass: '12.7', region: '12.6',
  'aria-allowed-attr': '7.1', 'aria-required-attr': '7.1', 'aria-valid-attr': '7.1', 'aria-valid-attr-value': '7.1', 'aria-roles': '7.1', 'aria-required-children': '7.1', 'aria-required-parent': '7.1', 'aria-hidden-focus': '7.1',
  'meta-refresh': '13.1',
  'td-headers-attr': '5.7', 'td-has-header': '5.7', 'scope-attr-valid': '5.7', 'table-fake-caption': '5.4',
}

const themeOfCriterion = (criterion: string): number => Number(criterion.split('.')[0])
const clean = (s: unknown): string => String(s ?? '').replace(/\s+/g, ' ').trim()

/** Turns what the axe engine returned in the page into the shape used here. */
export function fromAxe(o: Record<string, unknown>): ToolResults {
  const violations: ToolViolation[] = (Array.isArray(o.violations) ? (o.violations as Record<string, unknown>[]) : []).map((v) => ({
    rule: clean(v.id),
    impact: v.impact ? clean(v.impact) : null,
    help: clean(v.help || v.description || v.id),
    nodes: (Array.isArray(v.nodes) ? (v.nodes as Record<string, unknown>[]) : []).map((n) => ({
      html: String(n.html ?? ''),
      target: Array.isArray(n.target) ? (n.target as unknown[]).flat().map(String) : [],
      summary: clean(n.failureSummary),
    })),
    data: firstData(v),
  }))
  const passed = new Set((Array.isArray(o.passedRules) ? o.passedRules : []).map(String))
  const inapplicable = new Set((Array.isArray(o.inapplicableRules) ? o.inapplicableRules : []).map(String))
  const failed = new Set(violations.map((v) => v.rule))
  // a criterion is "checked" when every axe rule that maps to it ran: at least one passed, none failed
  const byCriterion = new Map<string, string[]>()
  for (const [rule, criterion] of Object.entries(AXE_TO_RGAA)) byCriterion.set(criterion, [...(byCriterion.get(criterion) ?? []), rule])
  const passedChecks: ToolResults['passedChecks'] = []
  for (const [criterion, rules] of byCriterion) {
    if (rules.some((r) => failed.has(r)) || !rules.every((r) => passed.has(r) || inapplicable.has(r) || failed.has(r))) continue
    for (const rule of rules.filter((r) => passed.has(r))) passedChecks.push({ criterion, rule })
  }
  return { tool: 'axe', url: clean(o.url), violations, answers: [], incomplete: Number(o.incomplete) || 0, passes: Number(o.passes) || 0, passedChecks }
}

function firstData(v: Record<string, unknown>): Record<string, unknown> | undefined {
  const node = (Array.isArray(v.nodes) ? v.nodes[0] : null) as Record<string, unknown> | null
  const check = (Array.isArray(node?.any) ? (node!.any as Record<string, unknown>[])[0] : null) ?? null
  return (check?.data as Record<string, unknown> | undefined) ?? undefined
}

const srcOf = (html: string): string => /\bsrc=["']([^"']+)["']/i.exec(html)?.[1] ?? ''
const hrefOf = (html: string): string => /\bhref=["']([^"']+)["']/i.exec(html)?.[1] ?? ''
const openTag = (html: string): string => /^<[^>]+>/.exec(html.trim())?.[0].replace(/\s+/g, ' ') ?? ''
const textOf = (html: string): string => clean(html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' '))
const sameSrc = (a: string | null | undefined, b: string): boolean => {
  if (!a || !b) return false
  const x = decodeURIComponent(a.split('#')[0])
  const y = decodeURIComponent(b.split('#')[0]).replace(/^\.?\//, '')
  return x === y || x.endsWith(`/${y}`)
}

const MARK = (tool: string) => `[${tool}]`

/** Adds a line to a note once (a second import of the same file does not repeat it). */
function addLine(note: string, line: string): string {
  return note.includes(line) ? note : note ? `${note}\n${line}` : line
}

/**
 * Applies the results to a page: criterion answers, and notes on the elements the tool pointed at.
 * Never overwrites a verdict a human gave. Returns what was done, for the report.
 */
export function applyToolResults(rec: PageRecord, res: ToolResults, opts: { addThemes?: boolean } = {}): ImportReport {
  const tool = res.tool
  const mark = MARK(tool)
  const report: ImportReport = { tool, at: Date.now(), url: res.url, set: 0, noted: 0, conflicts: [], unmatched: [], unmapped: [], incomplete: res.incomplete, passes: res.passes, items: [] }
  const touched = new Set<string>()

  const touchCriterion = (criterion: string, verdict: ChecklistVerdict | null, line: string, rule: string): void => {
    const theme = themeOfCriterion(criterion)
    if (!rec.themes.includes(theme)) {
      // only a failure brings a theme into the page (a full run brings in every theme it has something to say about)
      if (verdict !== 'nc' && !opts.addThemes) return
      rec.themes = [...rec.themes, theme].sort((a, b) => a - b)
    }
    const ans = (rec.checklist[criterion] ??= { note: '' })
    if (verdict === 'nc') (ans.autoResults ??= {})[tool] = { result: 'fail', rules: [...new Set([...(ans.autoResults?.[tool]?.result === 'fail' ? ans.autoResults[tool].rules : []), rule])] }
    if (verdict && (ans.verdict === undefined || (ans.source && ans.verdict !== verdict))) {
      ans.verdict = verdict
      ans.source = tool
      report.set++
    } else if (verdict === 'nc' && ans.verdict && ans.verdict !== 'nc') report.conflicts.push(`${criterion}: ${line}`)
    ans.note = addLine(ans.note, line)
  }

  for (const v of res.violations) {
    const criterion = AXE_TO_RGAA[v.rule]
    const count = v.nodes.length
    const where = v.nodes.slice(0, 3).map((n) => n.target.join(' ')).filter(Boolean).join(' · ')
    const line = `${mark} ${v.rule}${v.impact ? ` (${v.impact})` : ''}: ${v.help} — ${count} element(s)${where ? `: ${where}` : ''}`
    if (!criterion) {
      report.unmapped.push(`${v.rule} (${count})`)
      report.items!.push({ criterion: '—', rule: v.rule, result: 'note', text: `${v.help} — ${count} element(s)` })
      continue
    }
    const theme = themeOfCriterion(criterion)

    if (theme === 1) {
      // images: a note on each image the tool names, the verdict stays with the auditor (informative or decorative?)
      for (const node of v.nodes) {
        const src = srcOf(node.html)
        const item = rec.items.find((i) => sameSrc(i.src, src)) ?? rec.items.find((i) => i.html && node.html && clean(i.html).slice(0, 80) === clean(node.html).slice(0, 80))
        if (!item) {
          report.unmatched.push(`${v.rule}: ${node.target.join(' ') || clean(node.html).slice(0, 80)}`)
          continue
        }
        const review = (rec.reviews[item.key] ??= { answers: {}, note: '' })
        review.note = addLine(review.note, `${mark} ${v.rule}: ${v.help}`)
        report.noted++
      }
      continue
    }

    if (['2.1', '3.2', '6.2', '5.4', '5.7', '11.1'].includes(criterion)) {
      const fs = rec.findings.filter((f) => f.theme === theme && f.type !== 'contrast-ok')
      for (const node of v.nodes) {
        const f =
          theme === 5 || theme === 11
            ? fs.find((x) => Boolean(openTag(node.html)) && openTag(x.html) === openTag(node.html))
            : theme === 6
            ? fs.find((x) => Boolean(x.facts.href) && (x.facts.href === hrefOf(node.html) || sameSrc(x.facts.href, hrefOf(node.html))) && (x.type === 'link-empty' || !x.facts['Accessible name']))
            : theme === 2
            ? fs.find((x) => sameSrc(x.facts.src, srcOf(node.html)) || (!srcOf(node.html) && clean(x.html).slice(0, 60) === clean(node.html).slice(0, 60)))
            : fs.find((x) => {
                const txt = textOf(node.html)
                const own = clean(x.facts.Text)
                return Boolean(txt && own && (txt.startsWith(own.slice(0, 40)) || own.startsWith(txt.slice(0, 40))))
              })
        if (!f) {
          report.unmatched.push(`${v.rule}: ${node.target.join(' ') || textOf(node.html).slice(0, 60)}`)
          continue
        }
        const review = (rec.findingReviews[f.key] ??= { answers: {}, note: '' })
        const ratio = theme === 3 && typeof v.data?.contrastRatio === 'number' ? ` (${v.data.contrastRatio}:1)` : ''
        review.note = addLine(review.note, `${mark} ${v.rule}${ratio}: ${v.help}`)
        // the script could not judge this text: the tool did, so its answer is offered as the pre-fill
        if (theme === 11 && criterion === '11.1' && review.answers['11.1'] === undefined) {
          review.answers['11.1'] = 'nc'
          review.auto = true
          report.set++
        }
        if (f.type === 'link-empty' && review.answers['6.2'] === undefined) {
          review.answers['6.2'] = 'nc'
          review.auto = true
          report.set++
        }
        if (f.type === 'contrast-unknown' && review.answers['3.2'] === undefined) {
          review.answers['3.2'] = 'nc'
          review.auto = true
          report.set++
        }
        report.noted++
      }
      continue
    }

    touchCriterion(criterion, 'nc', line, v.rule)
    report.items!.push({ criterion, rule: v.rule, result: 'nc', text: `${v.help} — ${count} element(s)` })
    touched.add(criterion)
  }

  for (const a of res.answers) {
    report.items!.push({ criterion: a.criterion, rule: a.rule ?? a.criterion, result: a.status === 'nc' ? 'nc' : a.status === 'na' ? 'na' : 'note', text: a.note })
    touched.add(a.criterion)
    const theme = themeOfCriterion(a.criterion)
    if (theme <= 3 && ['1.1', '2.1', '2.2', '3.2'].includes(a.criterion)) {
      report.unmapped.push(`${a.criterion}: ${a.status?.toUpperCase() ?? ''}${a.note ? ` — ${a.note}` : ''}`)
      continue
    }
    touchCriterion(a.criterion, a.status, a.note ? `${mark} ${a.criterion}: ${a.note}` : `${mark} ${a.criterion}: ${a.status?.toUpperCase()}`, a.rule ?? a.criterion)
  }

  // checks that ran and found nothing: shown on the criterion, and the criterion is pre-filled "compliant" (to confirm,
  // the source is kept so the card says so) unless something else failed
  const failedNow = new Set(res.violations.map((v) => AXE_TO_RGAA[v.rule]).filter(Boolean).concat(res.answers.filter((a) => a.status === 'nc').map((a) => a.criterion)))
  const byCriterion = new Map<string, string[]>()
  for (const p of res.passedChecks) if (!failedNow.has(p.criterion)) byCriterion.set(p.criterion, [...(byCriterion.get(p.criterion) ?? []), p.rule])
  for (const [criterion, rules] of byCriterion) {
    const theme = themeOfCriterion(criterion)
    if (theme <= 3) continue
    if (!rec.themes.includes(theme)) {
      if (!opts.addThemes) continue
      rec.themes = [...rec.themes, theme].sort((a, b) => a - b)
    }
    const ans = (rec.checklist[criterion] ??= { note: '' })
    ;(ans.autoResults ??= {})[tool] = { result: 'pass', rules: [...new Set(rules)] }
    for (const rule of new Set(rules)) report.items!.push({ criterion, rule, result: 'pass', text: '' })
    touched.add(criterion)
    const anyFail = Object.values(ans.autoResults).some((r) => r.result === 'fail')
    if (!anyFail && (ans.verdict === undefined || (ans.source && ans.verdict !== 'c'))) {
      ans.verdict = 'c'
      ans.source = tool
      report.set++
    }
  }

  // two tools giving opposite answers on a criterion: say so
  for (const criterion of touched) {
    const results = Object.entries(rec.checklist[criterion]?.autoResults ?? {})
    const failed = results.filter(([, r]) => r.result === 'fail').map(([name]) => name)
    const passed = results.filter(([, r]) => r.result === 'pass').map(([name]) => name)
    if (failed.length && passed.length) report.conflicts.push(`${criterion}: ${failed.join(', ')} ≠ ${passed.join(', ')}`)
  }

  ;(rec.imports ??= []).push(report)
  return report
}
