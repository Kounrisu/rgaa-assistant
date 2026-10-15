import { MANUAL_CHECKS } from './manual-checks'
import type { ManualCheckAnswer } from './types'
import type { ThemeResult } from './results'

/** A manual problem is supporting evidence, never an implicit verdict. */
export function unresolvedManualIssues(checks: Record<string, ManualCheckAnswer> | undefined, themes: ThemeResult[]) {
  const criteria = themes.filter(t => t.selected).flatMap(t => t.criteria)
  return MANUAL_CHECKS.filter(check => {
    const answer = checks?.[check.id]
    if (answer?.state !== 'issue') return false
    const linked = criteria.find(c => c.id === answer.criterion)
    return !check.criteria.includes(answer.criterion ?? '') || !linked || linked.outcome !== 'nc' || linked.unconfirmed
  })
}
