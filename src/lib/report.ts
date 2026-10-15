import { allowsComplianceRate, LEVEL_LABEL } from './audit-levels'
import { auditStats, isProvisional, levelStats, rateOf, type Counts, type PageInput } from './audit-sheet'
import { getLang, t } from './i18n'
import { MANUAL_CHECKS } from './manual-checks'
import { unresolvedManualIssues } from './manual-evidence'
import { dataImage, previewOf } from './url-safety'
import { coverageLines } from './scan-coverage'
import { CRITERION_LEVEL } from './themes'
import type { Audit, PageRecord } from './types'

/**
 * The audit report: one self-contained HTML file (inline styles, print-ready) with the summary, the results per
 * theme and per page, every non-conformity with its elements and notes, the automatic and manual checks, and a
 * draft of the accessibility statement. Open it in a browser and print it to PDF, or paste it into a document.
 */
const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
const pct = (n: number | null): string => (n === null ? '—' : `${n} %`)
/** A rate, marked provisional while the audit it comes from is incomplete (see isProvisional). */
const pctP = (n: number | null, c: Counts | boolean): string => (n !== null && (typeof c === 'boolean' ? c : isProvisional(c)) ? `${pct(n)} <span class="prov">${esc(t('provisional'))}</span>` : pct(n))
const nl = (s: string): string => esc(s).replace(/\n/g, '<br>')

type Conformity = 'fully' | 'partially' | 'non' | 'unknown'
/** Draft rule for the state of conformity: all met, at least half met, less than half. The auditor can change the wording. */
export const conformityOf = (rate: number | null): Conformity => (rate === null ? 'unknown' : rate === 100 ? 'fully' : rate >= 50 ? 'partially' : 'non')
const CONFORMITY_TEXT: Record<Conformity, string> = {
  fully: 'totally compliant',
  partially: 'partially compliant',
  non: 'not compliant',
  unknown: 'not yet assessed',
}

const bar = (c: Counts): string => {
  const total = c.C + c.NC + c.NA + c.NT || 1
  const seg = (n: number, color: string, label: string) => (n ? `<i style="width:${(n / total) * 100}%;background:${color}" title="${esc(label)} ${n}"></i>` : '')
  return `<span class="bar">${seg(c.C, '#15803d', 'C')}${seg(c.NC, '#be123c', 'NC')}${seg(c.NA, '#94a3b8', 'NA')}${seg(c.NT, '#e2b93b', 'NT')}</span>`
}

const counts = (c: Counts): string =>
  `<span class="c">${c.C} C</span> · <span class="nc">${c.NC} NC</span> · ${c.NA} NA · ${c.NT} NT` +
  (c.suggested ? ` · ${esc(t('{n} to confirm', { n: c.suggested }))}` : '') +
  (c.partial ? ` · ${esc(t('{n} partly covered', { n: c.partial }))}` : '')

function nonCompliances(page: PageRecord, input: PageInput): string {
  const rows: string[] = []
  for (const theme of input.themes.filter((x) => x.selected)) {
    for (const c of theme.criteria.filter((x) => x.outcome === 'nc')) {
      const items: string[] = []
      for (const ref of c.ncRefs ?? []) {
        const finding = page.findings.find((f) => f.theme === theme.number && f.id === ref.id)
        const shotSrc = dataImage(finding?.shot)
        const shot = shotSrc && shotSrc.length < 40000 ? `<img class="shot" src="${esc(shotSrc)}" alt="">` : ''
        items.push(`<li>${shot}<b>#${ref.id}</b> ${esc(ref.label)}${ref.note ? ` — ${nl(ref.note)}` : ''}</li>`)
      }
      for (const test of c.tests.filter((x) => x.nc.length)) {
        const thumbs = test.nc
          .slice(0, 6)
          .map((id) => { const it = page.items.find((i) => i.id === id); return it ? previewOf(it) : null })
          .map((src) => dataImage(src))
          .filter((src): src is string => Boolean(src && src.length < 40000))
          .map((src) => `<img class="shot" src="${esc(src)}" alt="">`)
          .join('')
        items.push(`<li>${thumbs}<b>${esc(test.id)}</b> — ${test.nc.map((n) => `#${n}`).join(', ')}${test.reason ? ` — ${esc(test.reason)}` : ''}</li>`)
      }
      const imageIds = new Set(c.tests.flatMap(test => test.nc))
      for (const id of imageIds) {
        const image = page.items.find(item => item.id === id)
        const note = image && page.reviews[image.key]?.note.trim()
        if (note) items.push(`<li><b>${esc(t('Auditor note'))} · #${id} · ${esc(c.id)}</b><p class="note">${nl(note)}</p></li>`)
      }
      const note = input.checklist[c.id]?.note?.trim()
      const flags = [
        c.unconfirmed ? t('Detected automatically, not confirmed by the auditor.') : '',
        c.coverage === 'partial' ? t('Partial coverage: {n} test(s) not assessed by RGAA Assistant.', { n: c.unassessedTests ?? 0 }) : '',
        ...(c.conflicts ?? []).map((x) => t('Conflicting evidence: {x}.', { x })),
      ].filter(Boolean)
      rows.push(
        `<tr><td class="id">${esc(c.id)}<br><small>${esc(CRITERION_LEVEL[c.id] ?? 'A')}</small></td><td><b>${esc(c.title)}</b>${flags.length ? `<p class="flag">${flags.map(esc).join('<br>')}</p>` : ''}${items.length ? `<ul>${items.join('')}</ul>` : ''}${note ? `<p class="note">${nl(note)}</p>` : ''}</td></tr>`,
      )
    }
  }
  return rows.length ? `<table class="grid"><thead><tr><th>${esc(t('Criterion'))}</th><th>${esc(t('Non-compliance'))}</th></tr></thead><tbody>${rows.join('')}</tbody></table>` : `<p>${esc(t('No non-compliance recorded on this page.'))}</p>`
}

function coverageOf(page: PageRecord): string {
  const history = page.urlHistory?.length ? `<p>${esc(t('Previous addresses retained with this evidence:'))} ${page.urlHistory.map(row => esc(row.url)).join(' · ')}</p>` : ''
  if (!page.scanCoverage) return history
  return `${history}<h4>${esc(t('Scan coverage'))}</h4><ul>${coverageLines(page.scanCoverage).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`
}

function checksOf(page: PageRecord): string {
  const parts: string[] = []
  const manual = page.manualChecks ?? {}
  const done = Object.keys(manual).length
  const issues = MANUAL_CHECKS.filter((c) => manual[c.id]?.state === 'issue')
  parts.push(`<p>${esc(t('Manual checks: {done}/{total} done, {issues} problem(s).', { done, total: MANUAL_CHECKS.length, issues: issues.length }))}</p>`)
  if (issues.length) parts.push(`<ul>${issues.map((c) => `<li>${esc(t(c.text))}${manual[c.id].note ? ` — ${nl(manual[c.id].note)}` : ''}</li>`).join('')}</ul>`)
  const latest = new Map<string, NonNullable<PageRecord['imports']>[number]>()
  for (const r of page.imports ?? []) latest.set(r.tool, r)
  if (latest.size) {
    parts.push(
      `<p>${esc(t('Automatic checks'))} : ${[...latest.values()].map((r) => `${esc(r.tool)} (${new Date(r.at).toLocaleDateString(getLang())}, ${esc(t('{set} verdict(s) pre-filled', { set: r.set }))})`).join(' · ')}</p>`,
    )
  }
  if (page.htmlCheck) parts.push(`<p>${esc(t('HTML validation: {n} error(s).', { n: page.htmlCheck.errors }))}</p>`)
  return parts.join('')
}

export function buildReportHtml(audit: Audit, inputs: PageInput[], pages: PageRecord[], date = new Date()): string {
  const stats = auditStats(inputs)
  const levels = levelStats(stats)
  const ratesAllowed = allowsComplianceRate(audit.meta.level)
  const rate = (n: number | null, c: Counts | boolean) => ratesAllowed ? pctP(n, c) : '—'
  const legalRate = rateOf(levels.legal)
  const statementAllowed = ratesAllowed && pages.length > 0 && stats.sampleCriteria.length === 106 && legalRate !== null &&
    stats.perPage.every(p => !isProvisional(p.counts)) && inputs.every(p => p.themes.every(th => th.criteria.every(c => !c.conflicts?.length))) &&
    pages.every((page, i) => !unresolvedManualIssues(page.manualChecks, inputs[i].themes).length)
  const state = conformityOf(legalRate)
  const day = date.toLocaleDateString(getLang(), { day: 'numeric', month: 'long', year: 'numeric' })
  const title = `${t('Accessibility audit report')} — ${audit.name || audit.meta.site}`

  const sample = stats.perPage
    .map((p) => `<tr><td>${esc(p.label)}</td><td>${esc(p.title)}<br><small>${esc(p.url)}</small></td><td>${rate(p.rate, p.counts)}</td><td>${bar(p.counts)}<br><small>${counts(p.counts)}</small></td></tr>`)
    .join('')
  const themes = stats.perTheme
    .filter((x) => x.audited)
    .map((x) => `<tr><td>${x.number}. ${esc(x.name)}</td><td>${rate(x.rate, x.counts)}</td><td>${bar(x.counts)}<br><small>${counts(x.counts)}</small></td></tr>`)
    .join('')
  const perPage = pages
    .map((page, i) => `<section class="page"><h3>${esc(stats.perPage[i].label)} — ${esc(stats.perPage[i].title)}</h3><p><small>${esc(stats.perPage[i].url)}</small></p>${nonCompliances(page, inputs[i])}<h4>${esc(t('Checks'))}</h4>${checksOf(page)}${coverageOf(page)}</section>`)
    .join('')
  const failing = stats.sampleCriteria.filter((c) => c.status === 'NC')
  const unresolved = pages.flatMap((page, i) => unresolvedManualIssues(page.manualChecks, inputs[i].themes).map(check => `${stats.perPage[i].label} · ${t(check.text)} · RGAA ${check.criteria.join(', ')}`))
  const provisional = isProvisional(levels.legal) || stats.perPage.some(p => isProvisional(p.counts)) || unresolved.length > 0
  const toConfirm = stats.sampleCriteria.filter((c) => c.suggested && c.status === 'NT').length
  const partial = stats.sampleCriteria.filter((c) => c.partial).length

  return `<!doctype html>
<html lang="${getLang()}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
  :root { color-scheme: light; }
  body { font: 14px/1.5 system-ui, -apple-system, 'Segoe UI', sans-serif; color: #171a26; max-width: 960px; margin: 0 auto; padding: 24px; }
  h1 { font-size: 26px; margin: 0 0 4px; } h2 { font-size: 19px; margin: 32px 0 8px; border-bottom: 2px solid #4f46e5; padding-bottom: 4px; } h3 { font-size: 16px; margin: 20px 0 4px; } h4 { font-size: 14px; margin: 14px 0 4px; }
  table { border-collapse: collapse; width: 100%; margin: 8px 0; } th, td { border: 1px solid #cfd5e3; padding: 6px 8px; text-align: left; vertical-align: top; } th { background: #eef0f8; }
  td.id { white-space: nowrap; font-weight: 700; } small { color: #5d6478; } .c { color: #15803d; font-weight: 600; } .nc { color: #be123c; font-weight: 600; }
  .bar { display: inline-flex; width: 160px; height: 10px; border-radius: 5px; overflow: hidden; background: #e8eaf2; vertical-align: middle; } .bar i { display: block; height: 100%; }
  .kpis { display: flex; gap: 12px; flex-wrap: wrap; margin: 12px 0; } .kpi { border: 1px solid #cfd5e3; border-radius: 10px; padding: 10px 16px; min-width: 150px; } .kpi b { display: block; font-size: 24px; }
  .prov { font-size: 11px; font-weight: 600; color: #8a5a00; background: #fdf0c8; padding: 0 6px; border-radius: 8px; white-space: nowrap; } .warn { background: #fdf0c8; border-left: 3px solid #b7791f; padding: 6px 10px; } p.flag { color: #8a5a00; font-size: 12px; margin: 2px 0; }
  .note { background: #f6f7fb; border-left: 3px solid #4f46e5; padding: 4px 8px; margin: 6px 0; } img.shot { max-width: 180px; max-height: 90px; border: 1px solid #cfd5e3; margin: 0 8px 4px 0; vertical-align: top; }
  .statement { background: #f6f7fb; border: 1px solid #cfd5e3; border-radius: 10px; padding: 12px 18px; } .todo { background: #fdf0c8; padding: 0 4px; }
  section.page { break-inside: avoid-page; } @media print { body { padding: 0; } h2 { break-after: avoid; } tr { break-inside: avoid; } }
</style></head><body>
<h1>${esc(title)}</h1>
<p>${esc(t(LEVEL_LABEL[audit.meta.level ?? 'complet']))} · ${esc(t('RGAA 4.1 audit'))} · ${esc(audit.meta.site)} · ${esc(day)}${audit.meta.auditor ? ` · ${esc(audit.meta.auditor)}` : ''}${audit.meta.context ? ` · ${esc(audit.meta.context)}` : ''}</p>

<h2>1. ${esc(t('Summary'))}</h2>
<div class="kpis">
  ${ratesAllowed ? `  <div class="kpi"><b>${rate(legalRate, provisional)}</b>${esc(t('Criteria met (levels A and AA, whole sample)'))}</div>
  <div class="kpi"><b>${rate(stats.averageRate, stats.perPage.some((p) => isProvisional(p.counts)))}</b>${esc(t('Average rate of the pages'))}</div>
` : ''}
  <div class="kpi"><b>${pages.length}</b>${esc(t('Pages in the sample'))}</div>
  <div class="kpi"><b>${failing.length}</b>${esc(t('Non-compliant criteria'))}</div>
</div>
${statementAllowed ? `<p>${esc(t('The audited content is {state}, with a rate of {rate} of the applicable criteria met (C / (C + NC), levels A and AA).', { state: t(CONFORMITY_TEXT[state]), rate: pct(legalRate) }))}</p>` : `<p class="warn">${esc(t('Diagnostic results only. This audit does not yet support a conformity claim or an accessibility statement.'))}</p>`}
${provisional ? `<p class="warn"><b>${esc(t('Provisional result.'))}</b> ${esc(t('The audit is incomplete: criteria remain to be tested, some are only partly covered by the tool, or rest on automatic pre-filled answers the auditor has not confirmed. A criterion judged on only part of its tests keeps its result but is flagged. Do not publish this rate as the final conformity level.'))} ${esc(t('{toConfirm} criteria await confirmation of an automatic suggestion; {partial} have partial coverage.', { toConfirm, partial }))}</p>` : ''}

<h2>2. ${esc(t('Sample of pages'))}</h2>
${unresolved.length ? `<p class="warn">${esc(t('Resolve manual problems before final reporting. Link each problem to a criterion and record its verdict, or correct the observation after review.'))}</p><ul>${unresolved.map(text => `<li>${esc(text)}</li>`).join('')}</ul>` : ''}
<table><thead><tr><th>#</th><th>${esc(t('Page'))}</th><th>${esc(t('Rate'))}</th><th>${esc(t('Results'))}</th></tr></thead><tbody>${sample}</tbody></table>

<h2>3. ${esc(t('Results per theme'))}</h2>
<table><thead><tr><th>${esc(t('Theme'))}</th><th>${esc(t('Rate'))}</th><th>${esc(t('Results'))}</th></tr></thead><tbody>${themes}</tbody></table>
<p><small>C = ${esc(t('Compliant'))} · NC = ${esc(t('Non-compliant'))} · NA = ${esc(t('Not applicable'))} · NT = ${esc(t('Not tested'))}</small></p>

<h2>4. ${esc(t('Non-conformities and checks per page'))}</h2>
${perPage}

${statementAllowed ? `<h2>5. ${esc(t('Draft accessibility statement'))}</h2>
<div class="statement">
  <p><b>${esc(t('State of conformity'))}</b> — ${esc(audit.meta.site)} ${esc(t('is'))} <b>${esc(t(CONFORMITY_TEXT[state]))}</b> ${esc(t('with the RGAA 4.1.'))} ${esc(t('The audit shows {rate} of the criteria met.', { rate: pct(legalRate) }))}${provisional ? ` <b>${esc(t('Provisional: the audit is incomplete.'))}</b>` : ''}</p>
  <p><b>${esc(t('Content that is not accessible'))}</b></p>
  ${failing.length ? `<ul>${failing.map((c) => `<li>${esc(c.id)} — ${esc(c.title)}</li>`).join('')}</ul>` : `<p>${esc(t('None found by the audit.'))}</p>`}
  <p><b>${esc(t('Exemptions for disproportionate burden'))}</b> — <span class="todo">${esc(t('to fill in'))}</span></p>
  <p><b>${esc(t('Content not subject to the accessibility obligation'))}</b> — <span class="todo">${esc(t('to fill in'))}</span></p>
  <p><b>${esc(t('How this statement was drawn up'))}</b> — ${esc(t('Statement drawn up on {date}.', { date: day }))} ${esc(t('Technologies used: HTML, CSS, JavaScript.'))} <span class="todo">${esc(t('Test environment (browsers, assistive technologies): to fill in'))}</span></p>
  <p><b>${esc(t('Pages checked'))}</b></p>
  <ul>${stats.perPage.map((p) => `<li>${esc(p.title)} — ${esc(p.url)}</li>`).join('')}</ul>
  <p><b>${esc(t('Feedback and contact'))}</b> — <span class="todo">${esc(t('to fill in'))}</span></p>
</div>` : ''}

<h2>6. ${esc(t('Method and tools'))}</h2>
<p>${esc(t('This report contains the recorded decisions, automatic suggestions and manual checks for the selected audit scope. Automatic checks cover only part of RGAA. Unconfirmed answers and incomplete coverage keep the results provisional.'))}</p>
</body></html>`
}
