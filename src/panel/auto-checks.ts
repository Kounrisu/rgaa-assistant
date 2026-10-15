/**
 * The automatic checks: capture and validate the page HTML, turn our RGAA rules into tool results, run axe + RGAA + Asqatasun-derived rules + HTML.
 */
import type { PageRecord } from '../lib/types'
import { sendToPage, inspectedTabId, inspectedUrl } from './page-bridge'
import { packSnapshot } from '../lib/snapshot'
import { mergeCoverage } from '../lib/scan-coverage'
import { checkHtml } from '../lib/html-check'
import { type ToolResults, applyToolResults, AXE_TO_RGAA, fromAxe } from '../lib/axe-import'
import { t, getLang } from '../lib/i18n'
import { type RuleFinding, RULES } from '../lib/rgaa-rules'
// --- Asqatasun-derived: begin ---
import type { AsqExtra } from '../lib/asqatasun-rules' // a type only: the table itself stays in the page script
// --- Asqatasun-derived: end ---
import { state } from './state'
import { dom, keepScroll, say } from './dom'
import { sleep } from './helpers'
import axeFrench from 'axe-core/locales/fr.json'
import { normalizeUrl } from '../lib/audit-store'
import { pageLabel, persist } from './model'
import { SCANNED_THEMES } from '../lib/themes'
import { actions } from './actions'

/** The HTML of the page, captured now, kept in the audit and checked against the HTML specification (RGAA 8.2). */
export async function captureAndCheckHtml(rec: PageRecord): Promise<void> {
  const snap = await sendToPage(inspectedTabId(), { type: 'RGAA_SNAPSHOT' })
  if (normalizeUrl(snap.url) !== normalizeUrl(rec.url)) throw new Error(t('The browser changed page during the checks. Run them again on the registered URL.'))
  if (typeof snap.html !== 'string') throw new Error('no html')
  rec.snapshot = packSnapshot(snap.html, snap.url, snap.title)
  rec.scanCoverage = mergeCoverage(rec.scanCoverage, snap.coverage)
  await validateSnapshot(rec, snap.html)
}

export async function validateSnapshot(rec: PageRecord, html: string): Promise<void> {
  const result = await checkHtml(html)
  rec.htmlCheck = result
  const answers: ToolResults['answers'] = []
  const passedChecks: ToolResults['passedChecks'] = []
  if (result.errors) {
    const top = result.groups.slice(0, 4).map((g) => `${g.rule} ×${g.count}`).join(', ')
    answers.push({ criterion: '8.2', status: 'nc', note: t('{n} HTML error(s) in the generated code ({rules}). Details on the Checks page.', { n: result.errors, rules: top }), rule: 'html-validate' })
  } else passedChecks.push({ criterion: '8.2', rule: 'html-validate' })
  applyToolResults(rec, { tool: 'html-validate', url: rec.snapshot?.url ?? rec.url, violations: [], answers, incomplete: 0, passes: passedChecks.length, passedChecks }, { addThemes: true })
}

/** Our own RGAA checks: the page sends what it found, the wording and the criteria come from lib/rgaa-rules.ts. */
export function rulesToResults(url: string, findings: RuleFinding[]): { own: ToolResults; asq: ToolResults } {
  const answers: ToolResults['answers'] = []
  const asqAnswers: ToolResults['answers'] = []
  for (const f of findings) {
    const meta = RULES[f.key]
    if (!meta) continue
    const note = t(meta.text, { n: f.count, detail: f.detail ? t(f.detail) : '', samples: (f.samples ?? []).join(', ') })
    for (const criterion of meta.criteria) answers.push({ criterion, status: meta.status, note, rule: f.key })
  }
  // --- Asqatasun-derived: begin ---
  // Tests ported from Asqatasun: nc = fails, review = a note only, na = not applicable. A criterion where every test ported for it
  // passed comes as `pass`: it goes to passedChecks ("nothing found", and the criterion is pre-filled "compliant, to confirm").
  const asqPassed: ToolResults['passedChecks'] = []
  for (const f of findings as (RuleFinding & { asq?: AsqExtra })[]) {
    if (!f.asq) continue
    if (f.asq.status === 'pass') {
      asqPassed.push({ criterion: f.asq.criterion, rule: f.key, detail: f.detail })
      continue
    }
    const note = t(f.asq.text, { n: f.count, samples: (f.samples ?? []).join(', '), criterion: f.asq.criterion, test: f.asq.test, detail: f.detail ?? '' })
    asqAnswers.push({ criterion: f.asq.criterion, status: f.asq.status === 'review' ? null : f.asq.status, note, rule: f.key })
  }
  // --- Asqatasun-derived: end ---
  // our checks that look for a failure and found none: shown as "checked" on their criteria
  const found = new Set(findings.map((f) => f.key))
  const passedChecks: ToolResults['passedChecks'] = []
  const seen = new Map(findings.filter((f) => f.detail).map((f) => [f.key, f.detail as string]))
  for (const [key, meta] of Object.entries(RULES)) {
    if (meta.status === 'nc' && !found.has(key)) for (const criterion of meta.criteria) passedChecks.push({ criterion, rule: key, detail: seen.get(`${key}-found`) })
  }
  // --- Asqatasun-derived: begin ---
  const asq: ToolResults = { tool: 'Asqatasun', url, violations: [], answers: asqAnswers, incomplete: 0, passes: asqPassed.length, passedChecks: asqPassed }
  // --- Asqatasun-derived: end ---
  return { own: { tool: 'RGAA', url, violations: [], answers, incomplete: 0, passes: passedChecks.length, passedChecks }, asq }
}

export async function runAutoChecks(): Promise<'complete' | 'partial' | 'failed'> {
  if (!state.page || state.axeRunning) return 'failed'
  const rec = state.page
  state.axeRunning = true
  dom.autoBtn.disabled = true
  keepScroll(dom.checksEl, actions.renderChecks)
  say(t('Running the automatic checks on the page…'))
  let step = 'rules'
  try {
    const own = await sendToPage(inspectedTabId(), { type: 'RGAA_RULES_RUN' })
    rec.scanCoverage = mergeCoverage(rec.scanCoverage, own?.coverage)
    await sleep(250) // let a heavy page breathe between the steps
    step = 'axe'
    const response = await chrome.runtime.sendMessage({ type: 'RGAA_AXE', tabId: inspectedTabId(), locale: getLang() === 'fr' ? axeFrench : null, rules: Object.keys(AXE_TO_RGAA) })
    if (!response || response.error) throw new Error(response?.error ?? 'no response')
    const results = fromAxe(response)
    if (results.url && rec.url && normalizeUrl(results.url) !== normalizeUrl(rec.url)) {
      throw new Error(t('The browser changed page during the checks. Run them again on the registered URL.'))
    }
    if (normalizeUrl(own.url) !== normalizeUrl(rec.url) || normalizeUrl(await inspectedUrl()) !== normalizeUrl(rec.url)) throw new Error(t('The browser changed page during the checks. Run them again on the registered URL.'))
    const split = rulesToResults(own.url, own.findings ?? [])
    const ownReport = applyToolResults(rec, split.own, { addThemes: true })
    // --- Asqatasun-derived: begin ---
    const asqReport = applyToolResults(rec, split.asq, { addThemes: true })
    // --- Asqatasun-derived: end ---
    const report = applyToolResults(rec, results, { addThemes: true })
    step = 'html'
    await sleep(250)
    let complete = true
    try {
      await captureAndCheckHtml(rec)
    } catch (err) {
      complete = false
      if (rec.automaticRun) rec.automaticRun.error = String((err as Error).message ?? err)
      console.error(err)
      say(t('Could not capture or check the HTML ({reason}).', { reason: String((err as Error)?.message ?? err) }))
    }
    persist()
    actions.renderAll()
    say(t('Automatic checks on {label}: {n} rule(s) failed, {set} verdict(s) pre-filled, {noted} element note(s). Confirm them in the themes.', { label: pageLabel(rec), n: results.violations.length + (own.findings ?? []).filter((f: RuleFinding) => RULES[f.key]?.status === 'nc').length, set: report.set + ownReport.set + asqReport.set, noted: report.noted + ownReport.noted + asqReport.noted }))
    return complete ? 'complete' : 'partial'
  } catch (err) {
    const reason = `${step}: ${String((err as Error)?.message ?? err).replace(/^Error: /, '')}`
    say(t('Could not run the automatic checks ({reason}). Reload the page (F5) if you just reloaded the extension, check the extension may access this site, then try again.', { reason }))
    console.error(err)
    if (rec.automaticRun) rec.automaticRun.error = reason
    return 'failed'
  } finally {
    state.axeRunning = false
    dom.autoBtn.disabled = !state.page
    if (state.view === 'checks') keepScroll(dom.checksEl, actions.renderChecks)
  }
}

/** Everything at once: scan every theme that can be scanned, then axe, our RGAA checks, the Asqatasun-derived rules and the HTML check. */
export async function runEverything(): Promise<void> {
  if (!state.page || state.runBusy || state.scanBusy) return
  const rec = state.page
  state.runBusy = true
  rec.automaticRun = { status: 'running', startedAt: Date.now(), url: rec.url }
  persist()
  actions.renderAll()
  try {
    const url = await inspectedUrl()
    if (normalizeUrl(url) !== normalizeUrl(rec.url)) throw new Error(t('Open the registered page in the browser before running automatic checks.'))
    if (!(await state.session.saveNow())) throw new Error(t('Save failed. Retry before running checks.'))
    rec.themes = [...new Set([...rec.themes, ...SCANNED_THEMES])].sort((a, b) => a - b)
    await actions.scan()
    if (!state.lastScanOk || state.page !== rec) throw new Error(t('The page scan did not finish.'))
    actions.setView('checks')
    rec.automaticRun.status = await runAutoChecks()
    if (rec.automaticRun.status === 'partial') say(t('Partial run — HTML check failed'))
  } catch (err) {
    rec.automaticRun.status = 'failed'
    rec.automaticRun.error = String((err as Error).message ?? err)
    say(rec.automaticRun.error)
  } finally {
    rec.automaticRun.finishedAt = Date.now()
    state.runBusy = false
    persist()
    actions.renderAll()
  }
}
