/**
 * “What is left in this theme”: the open criteria as buttons that go straight to them, a clear “theme finished” when nothing is left,
 * and, when there is nothing to check on the page (no multimedia, no form…), one button that records the open criteria as not applicable.
 */
import type { CriterionResult, ThemeResult } from '../lib/results'
import { themeTodo, type TodoItem, type TodoReason } from '../lib/theme-todo'
import { confirm as confirmVerdict } from '../lib/evidence'
import { IMAGE_CRITERION_IDS } from '../lib/rgaa'
import { findingCriterionIds } from '../lib/findings'
import { SCANNED_THEMES, themeByNumber } from '../lib/themes'
import { t } from '../lib/i18n'
import { state } from './state'
import { h, say } from './dom'
import { pageInput, persist } from './model'
import { actions } from './actions'
import { askConfirm } from './dialogs'

export type TodoTarget = 'pending' | 'suggested' | 'unconfirmed' | 'partial'

/** English labels (translated where shown). */
const REASON_LABEL: Record<TodoReason, string> = {
  todo: 'to answer',
  suggested: 'suggestion to confirm',
  failure: 'failure to confirm',
  confirm: 'to confirm',
  partial: 'partial coverage',
}

/** Where each reason leads (the same destinations as the totals of the theme). */
const TARGET: Record<TodoReason, TodoTarget> = { todo: 'pending', suggested: 'suggested', failure: 'unconfirmed', confirm: 'pending', partial: 'partial' }

export interface TodoDeps {
  /** Opens a criterion where it is answered (see chrome.openCriterion). */
  open: (theme: ThemeResult, criterion: CriterionResult, target: TodoTarget) => void
}

let lastOpened = ''

/** The criteria of this theme no single element answers (what a “nothing here” button can record). */
function pageLevelIds(theme: number): string[] {
  const perElement = theme === 1 ? IMAGE_CRITERION_IDS : findingCriterionIds(theme)
  return (themeByNumber(theme)?.criteria ?? []).map((c) => c.id).filter((id) => !perElement.includes(id))
}

/** The open criteria a human could simply mark not applicable because the page has nothing for this theme. */
export function notApplicableCandidates(theme: number, todo: TodoItem[]): string[] {
  const rec = state.page
  if (!rec) return []
  const hasElements = theme === 1 ? rec.items.length > 0 : rec.findings.some((f) => f.theme === theme && f.type !== 'contrast-ok')
  const nothingToScan = SCANNED_THEMES.has(theme) ? rec.scannedThemes.includes(theme) && !hasElements : true
  if (!nothingToScan) return []
  const page = new Set(pageLevelIds(theme))
  // only criteria with no confirmed answer: a verdict you gave is never overwritten
  return todo.filter((x) => page.has(x.id) && (x.reason === 'todo' || x.reason === 'suggested')).map((x) => x.id)
}

async function markNotApplicable(ids: string[]): Promise<void> {
  const rec = state.page
  if (!rec || !ids.length) return
  const yes = await askConfirm(
    t('Mark these criteria not applicable?'),
    t('{n} criteria of this theme have no answer yet ({ids}). They will be recorded as Not applicable: your decision, because there is nothing to check here on this page. Criteria you already answered do not change.', { n: ids.length, ids: ids.join(', ') }),
    t('Mark {n} not applicable', { n: ids.length }),
  )
  if (!yes) return
  for (const id of ids) confirmVerdict((rec.checklist[id] ??= { note: '' }), 'na')
  persist()
  actions.renderAll()
  say(t('{n} criteria recorded as not applicable.', { n: ids.length }))
}

/** The criteria where a script found nothing to check and suggests “not applicable” (no media, no form…): safe to confirm together. */
export function naSuggestionIds(theme: ThemeResult): string[] {
  return theme.criteria.filter((c) => c.outcome === 'pending' && c.suggested === 'na').map((c) => c.id)
}

async function confirmNaSuggestions(ids: string[]): Promise<void> {
  const rec = state.page
  if (!rec || !ids.length) return
  const yes = await askConfirm(
    t('Confirm the “not applicable” suggestions?'),
    t('The checks found nothing to verify for {n} criteria of this theme ({ids}) and suggest Not applicable. You confirm that this is right: look at the page if you are not sure.', { n: ids.length, ids: ids.join(', ') }),
    t('Confirm {n}', { n: ids.length }),
  )
  if (!yes) return
  for (const id of ids) confirmVerdict((rec.checklist[id] ??= { note: '' }), 'na')
  persist()
  actions.renderAll()
  say(t('{n} criteria confirmed as not applicable.', { n: ids.length }))
}

export function renderThemeTodo(host: HTMLElement, deps: TodoDeps): void {
  host.replaceChildren()
  const rec = state.page
  host.hidden = !rec || state.view !== 'review'
  if (!rec || host.hidden) return
  const theme = pageInput(rec).themes.find((x) => x.number === state.theme)
  if (!theme?.selected) return void (host.hidden = true)
  const todo = themeTodo(theme)
  if (!todo.length) {
    host.append(h('p', { class: 'todo-done' }, t('Theme finished: every criterion is confirmed and fully covered.')))
    return
  }
  const open = (item: TodoItem) => {
    const criterion = theme.criteria.find((c) => c.id === item.id)
    if (!criterion) return
    lastOpened = item.id
    deps.open(theme, criterion, TARGET[item.reason])
  }
  const after = todo.findIndex((x) => x.id === lastOpened)
  const next = todo[(after + 1) % todo.length]
  host.append(
    h(
      'div',
      { class: 'todo-line' },
      h('strong', {}, t('Left to do in this theme: {n} criteria', { n: todo.length })),
      h('button', { type: 'button', class: 'primary todo-next', onclick: () => open(next) }, after < 0 ? t('Go to the first') : t('Go to the next one')),
    ),
    h(
      'div',
      { class: 'todo-chips', role: 'group', 'aria-label': t('Open criteria of this theme') },
      ...todo.map((item) =>
        h(
          'button',
          { type: 'button', class: `todo-chip reason-${item.reason}`, 'data-crit': item.id, title: item.title.replace(/`/g, ''), onclick: () => open(item) },
          h('strong', {}, item.id),
          ` ${t(REASON_LABEL[item.reason])}`,
        ),
      ),
    ),
  )
  const detected = naSuggestionIds(theme)
  if (detected.length) {
    host.append(h('p', { class: 'todo-na' }, h('button', { type: 'button', class: 'ghost-btn todo-na-confirm', onclick: () => void confirmNaSuggestions(detected) }, t('The checks found nothing to verify: confirm the {n} “not applicable” suggestions', { n: detected.length }))))
  }
  const candidates = notApplicableCandidates(state.theme, todo)
  if (candidates.length) {
    host.append(h('p', { class: 'todo-na' }, h('button', { type: 'button', class: 'ghost-btn todo-na-btn', onclick: () => void markNotApplicable(candidates) }, t('Nothing to check here on this page: mark the {n} open criteria not applicable', { n: candidates.length }))))
  }
}
