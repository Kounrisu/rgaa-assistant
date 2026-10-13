/**
 * What is left to do in a theme, criterion by criterion, and why: the answer to “how do I finish this theme?”.
 * A criterion is finished when it has a verdict the auditor confirmed and its tests are fully covered (or checked by hand).
 */
import type { CriterionResult, ThemeResult } from './results'

export type TodoReason =
  /** No answer yet. */
  | 'todo'
  /** A tool suggests an answer: confirm it or change it. */
  | 'suggested'
  /** A failure a tool found and nobody confirmed. */
  | 'failure'
  /** A compliant / not applicable answer that rests on a pre-filled answer. */
  | 'confirm'
  /** The verdict stands, but some tests of the criterion are not assessed by the tool: check them by hand. */
  | 'partial'

export interface TodoItem {
  id: string
  title: string
  reason: TodoReason
}

export function todoReason(c: CriterionResult): TodoReason | null {
  if (c.outcome === 'unassessed') return null
  if (c.outcome === 'pending') return c.suggested ? 'suggested' : 'todo'
  if (c.unconfirmed) return c.outcome === 'nc' ? 'failure' : 'confirm'
  if (c.coverage === 'partial') return 'partial'
  return null
}

/** The open criteria of a theme in the official order (none for a theme that is not part of the audit). */
export function themeTodo(theme: ThemeResult | undefined): TodoItem[] {
  if (!theme?.selected) return []
  return theme.criteria.flatMap((c) => {
    const reason = todoReason(c)
    return reason ? [{ id: c.id, title: c.title, reason }] : []
  })
}
