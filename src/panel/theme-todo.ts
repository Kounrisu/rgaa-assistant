import { confirmAllAnswers, isSuggested } from '../lib/review-confirmation'
/**
 * “What is left in this theme”: the open criteria as buttons that go straight to them, a clear “theme finished” when nothing is left,
 * and, when there is nothing to check on the page (no multimedia, no form…), one button that records the open criteria as not applicable.
 */
import type { CriterionResult, ThemeResult } from '../lib/results'
import { themeTodo, type TodoItem, type TodoReason } from '../lib/theme-todo'
import { confirm as confirmVerdict } from '../lib/evidence'
import { IMAGE_CRITERION_IDS } from '../lib/rgaa'
import { inActiveLevel } from '../lib/audit-levels'
import { findingCriterionIds } from '../lib/findings'
import { FINDING_THEMES, SCANNED_THEMES, themeByNumber } from '../lib/themes'
import { t } from '../lib/i18n'
import { state } from './state'
import { h, say } from './dom'
import { pageInput, persist } from './model'
import { actions } from './actions'
import { askConfirm } from './dialogs'
import { reviewKey } from './review-state'
import { renderFilters, renderList, select } from './images-view'
import { syncFilterBoxes } from './page-bridge'
import { focusReviewTarget } from './focus-target'
import { dom } from './dom'

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
  return (themeByNumber(theme)?.criteria ?? []).map((c) => c.id).filter((id) => !perElement.includes(id) && inActiveLevel(id))
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
  for (const id of ids) {
    const answer = (rec.checklist[id] ??= { note: '' })
    confirmVerdict(answer, 'na')
    answer.coverageAt = rec.scanCoverage?.at ?? 0
  }
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
    t('The checks found nothing to verify for {n} criteria ({ids}). Inspect the whole page, including frames, shadow content and truncated results, before confirming Not applicable.', { n: ids.length, ids: ids.join(', ') }),
    t('Confirm {n}', { n: ids.length }),
  )
  if (!yes) return
  for (const id of ids) {
    const answer = (rec.checklist[id] ??= { note: '' })
    confirmVerdict(answer, 'na')
    answer.coverageAt = rec.scanCoverage?.at ?? 0
  }
  persist()
  actions.renderAll()
  say(t('{n} criteria confirmed as not applicable.', { n: ids.length }))
}

/** Elements of a finding theme (links, forms…) whose answers the scan pre-filled and nobody confirmed: the reason a criterion stays “to confirm”. */
function prefilledFindingKeys(theme: number): string[] {
  const rec = state.page
  if (!rec || !FINDING_THEMES.has(theme)) return []
  return rec.findings.filter((f) => f.theme === theme && rec.findingReviews[f.key]?.auto && Object.keys(rec.findingReviews[f.key].answers).length).map((f) => f.key)
}

async function confirmPrefilledFindings(keys: string[]): Promise<void> {
  const rec = state.page
  if (!rec || !keys.length) return
  const scope = keys.map(key => ({ finding: rec.findings.find(f => f.key === key)!, ids: Object.keys(rec.findingReviews[key].answers).filter(id => isSuggested(rec.findingReviews[key], id)) }))
  const count = scope.reduce((n, item) => n + item.ids.length, 0)
  const yes = await askConfirm(
    t('Confirm the pre-filled answers?'),
    t('You confirm the {n} answers the scan pre-filled from the markup in this theme. Look at the ones that matter first (a link name can be present and still meaningless). Answers you change yourself are not affected.', { n: count }) + '\n\n' + scope.map(item => `#${item.finding.id}: ${item.ids.join(', ')}`).join('\n'),
    t('Confirm {n}', { n: count }),
  )
  if (!yes) return
  for (const k of keys) confirmAllAnswers(rec.findingReviews[k])
  persist()
  actions.renderAll()
  say(t('{n} pre-filled answers confirmed.', { n: count }))
}

type PrefilledGroup = 'ignored' | 'named' | 'nameless'

/** The images whose answer the scan pre-filled and nobody confirmed, by what the scan found: hidden from assistive tech, named, or nameless (a failure). */
function prefilledImages(): Record<PrefilledGroup, string[]> {
  const out: Record<PrefilledGroup, string[]> = { ignored: [], named: [], nameless: [] }
  for (const el of state.elements) {
    const key = reviewKey(el)
    const review = state.reviews[key]
    if (!review?.auto) continue
    out[review.kind === 'decorative' ? 'ignored' : review.answers['1.1'] === 'nc' ? 'nameless' : 'named'].push(key)
  }
  return out
}

const GROUP_TEXT: Record<PrefilledGroup, { label: string; ask: string }> = {
  ignored: {
    label: 'Decorative / hidden from assistive technologies',
    ask: 'These images are hidden from assistive technologies (alt="", aria-hidden, role="presentation"): the scan pre-filled them as decorative, 1.2 compliant. You confirm that they really are decorative.',
  },
  named: {
    label: 'With a text alternative',
    ask: 'These images have a text alternative: the scan pre-filled 1.1 compliant. This does not judge whether the text is relevant (1.3): that stays yours.',
  },
  nameless: {
    label: 'Without any name (failure)',
    ask: 'Nothing names these images and they are not hidden: the scan pre-filled a failure (1.1 non-compliant). You confirm each is really a failure: look at them first.',
  },
}

async function confirmPrefilledImageGroup(group: PrefilledGroup, keys: string[]): Promise<void> {
  if (!keys.length) return
  const yes = await askConfirm(t('Confirm these pre-filled images?'), `${t(GROUP_TEXT[group].ask)}\n\n${t('{n} images. Look at them first with the “Pre-filled” filter.', { n: keys.length })}\n\n${keys.map(key => `#${state.elements.find(el => reviewKey(el) === key)?.id}: ${Object.keys(state.reviews[key].answers).filter(id => isSuggested(state.reviews[key], id)).join(', ')}`).join('\n')}`, t('Confirm {n}', { n: keys.length }))
  if (!yes) return
  for (const k of keys) confirmAllAnswers(state.reviews[k])
  persist()
  actions.renderAll()
  say(t('{n} pre-filled images confirmed.', { n: keys.length }))
}

function showPrefilledImages(): void {
  state.filter = 'prefilled'
  renderFilters()
  renderList()
  const first = state.elements.find((e) => state.reviews[reviewKey(e)]?.auto)
  if (first) { select(first.id, true); focusReviewTarget(dom.detailEl) }
  void syncFilterBoxes()
}

/** Images theme: one clear place to validate the pre-filled images, by kind. */
function prefilledImagesBlock(): HTMLElement | null {
  const groups = prefilledImages()
  const total = groups.ignored.length + groups.named.length + groups.nameless.length
  if (!total) return null
  return h(
    'div',
    { class: 'prefilled-block' },
    h('p', {}, h('strong', {}, t('{n} images hold an answer pre-filled by the scan.', { n: total })), ' ', t('Until you confirm them they do not count: a criterion is confirmed only when all its images are.')),
    h(
      'div',
      { class: 'prefilled-actions' },
      h('button', { type: 'button', class: 'ghost-btn', onclick: showPrefilledImages }, t('Look at them')),
      ...(['ignored', 'named', 'nameless'] as PrefilledGroup[]).filter((g) => groups[g].length).map((g) =>
        h('button', { type: 'button', class: `primary prefilled-confirm prefilled-${g}`, onclick: () => void confirmPrefilledImageGroup(g, groups[g]) }, `${t('Confirm')}: ${t(GROUP_TEXT[g].label)} (${groups[g].length})`),
      ),
    ),
  )
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
  const imagesBlock = state.theme === 1 ? prefilledImagesBlock() : null
  if (imagesBlock) host.append(imagesBlock)
  const prefilled = prefilledFindingKeys(state.theme)
  if (prefilled.length) {
    host.append(h('p', { class: 'todo-na' }, t('{n} element(s) of this theme still hold the answer the scan pre-filled; a criterion is confirmed only when all of its elements are.', { n: prefilled.length }), ' ', h('button', { type: 'button', class: 'ghost-btn todo-prefilled-confirm', onclick: () => void confirmPrefilledFindings(prefilled) }, t('Confirm the {n} pre-filled answers', { n: prefilled.length }))))
  }
  const detected = naSuggestionIds(theme)
  if (detected.length) {
    host.append(h('p', { class: 'todo-na' }, h('button', { type: 'button', class: 'ghost-btn todo-na-confirm', onclick: () => void confirmNaSuggestions(detected) }, t('The checks found nothing to verify: confirm the {n} “not applicable” suggestions', { n: detected.length }))))
  }
  const candidates = notApplicableCandidates(state.theme, todo)
  if (candidates.length) {
    host.append(h('p', { class: 'todo-na' }, h('button', { type: 'button', class: 'ghost-btn todo-na-btn', onclick: () => void markNotApplicable(candidates) }, t('Nothing to check here on this page: mark the {n} open criteria not applicable', { n: candidates.length }))))
  }
}
