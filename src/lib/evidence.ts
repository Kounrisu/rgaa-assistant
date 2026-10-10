import type { ChecklistAnswer, ChecklistVerdict, PageRecord } from './types'

/**
 * Evidence vs verdicts. What the automatic checks found is EVIDENCE (`autoResults`) and, at most, a SUGGESTED
 * verdict (`suggested` + `source`). Only the auditor's own answer (`verdict`) is a confirmed verdict.
 * Rules: a human verdict is never overwritten by a run; a suggestion is refreshed by each run; a tool failure
 * always wins over a tool pass as a suggestion.
 */

/** The confirmed (human) verdict of an answer, if any. */
export const confirmedVerdict = (a: ChecklistAnswer | undefined): ChecklistVerdict | undefined => a?.verdict

/** The pending suggestion of an answer: none once the auditor has answered. */
export const pendingSuggestion = (a: ChecklistAnswer | undefined): ChecklistVerdict | undefined => (a?.verdict ? undefined : a?.suggested)

/**
 * Offers an automatic verdict on an answer. Returns true when the suggestion changed.
 * A human verdict is left alone; a failure suggestion is not replaced by a pass/na while a tool still reports a failure.
 */
export function suggest(a: ChecklistAnswer, verdict: ChecklistVerdict, source: string): boolean {
  if (a.verdict !== undefined) return false
  if (a.suggested === 'nc' && verdict !== 'nc' && Object.values(a.autoResults ?? {}).some((r) => r.result === 'fail')) return false
  const changed = a.suggested !== verdict || a.source !== source
  a.suggested = verdict
  a.source = source
  return changed
}

/** The auditor confirms (or sets) a verdict: the suggestion is consumed. */
export function confirm(a: ChecklistAnswer, verdict: ChecklistVerdict): void {
  a.verdict = verdict
  delete a.suggested
  delete a.source
}

/** Disagreements the auditor should see: tools against each other, or a tool failure against a human "compliant". */
export function evidenceConflicts(a: ChecklistAnswer | undefined): string[] {
  const results = Object.entries(a?.autoResults ?? {})
  const failed = results.filter(([, r]) => r.result === 'fail').map(([name]) => name)
  const passed = results.filter(([, r]) => r.result === 'pass').map(([name]) => name)
  const out: string[] = []
  if (failed.length && passed.length) out.push(`${failed.join(', ')} ≠ ${passed.join(', ')}`)
  if (failed.length && (a?.verdict === 'c' || a?.verdict === 'na')) out.push(`${failed.join(', ')} → ${a.verdict}`)
  return out
}

/**
 * MIGRATION (older saved audits): a checklist answer with a `source` and a verdict was pre-filled by a tool and
 * never touched by the auditor (answering used to clear `source`). It becomes a suggestion, never a confirmed
 * verdict. Answers without `source` are human and are left alone. Idempotent.
 */
export function migrateEvidence(page: Pick<PageRecord, 'checklist'>): void {
  for (const a of Object.values(page.checklist ?? {})) {
    if (a.source && a.verdict !== undefined) {
      a.suggested = a.verdict
      delete a.verdict
    }
  }
}
