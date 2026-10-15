import { reviewContinue } from './review-controls'
/**
 * The checklist themes: one card per official criterion, with a verdict, the tools' hints and a note.
 */
import { findingCriterionIds } from '../lib/findings'
import { IMAGE_CRITERION_IDS } from '../lib/rgaa'
import { inActiveLevel } from '../lib/audit-levels'
import { state } from './state'
import type { ChecklistAnswer, ChecklistVerdict } from '../lib/types'
import { h, dom, newTabNote } from './dom'
import { t } from '../lib/i18n'
import { themeByNumber, FINDING_THEMES } from '../lib/themes'
import { pageInput, persist } from './model'
import { confirm as confirmVerdict, evidenceConflicts as evidenceConflictsOf } from '../lib/evidence'
import { actions } from './actions'

/** Checklist themes: one card per official criterion with a verdict and a note. */
/** Themes reviewed element by element (images, frames, colours, tables…): their checklist only holds the criteria no element can answer. */
export const perElementTheme = (): boolean => state.theme === 1 || FINDING_THEMES.has(state.theme)

export function perFindingIds(): string[] {
  return state.theme === 1 ? IMAGE_CRITERION_IDS : findingCriterionIds(state.theme)
}

/** What the automatic checks found for a criterion (or that none covers it, once they have been run on the page). */
export function autoHints(answer: ChecklistAnswer): HTMLElement[] {
  const entries = Object.entries(answer.autoResults ?? {})
  if (!entries.length) return (state.page?.imports?.length ?? 0) > 0 ? [h('p', { class: 'hint-line' }, t('No automatic check covers this criterion.'))] : []
  const disagree = entries.some(([, r]) => r.result === 'pass') && entries.some(([, r]) => r.result === 'fail')
  const lines = entries.map(([tool, r]) =>
    h(
      'p',
      { class: `hint ${r.result === 'pass' ? 'ok' : 'warn'}` },
      r.result === 'pass'
        ? `${t('Automatic checks ({tool}): nothing found by {rules}. This does not prove the criterion is met: check the rest by hand.', { tool, rules: r.rules.join(', ') })}${r.details?.length ? ` ${t('Seen: {details}.', { details: r.details.map((d) => d.replace(/ · standards mode$/, ` · ${t('standards mode')}`)).join(' ; ') })}` : ''}`
        : t('Automatic checks ({tool}) found a problem: {rules}.', { tool, rules: r.rules.join(', ') }),
    ),
  )
  return disagree ? [h('p', { class: 'hint warn' }, t('The automatic tools disagree on this criterion: check it by hand.')), ...lines] : lines
}

export const VERDICT_WORD: Record<ChecklistVerdict, string> = { c: 'Compliant', nc: 'Non-compliant', na: 'Not applicable' }

export function renderChecklist(host: HTMLElement = dom.themeEl): void {
  const def = themeByNumber(state.theme)
  if (!state.page || !def) return
  const rec = state.page
  const result = pageInput(rec).themes.find((t) => t.number === state.theme)!
  const hasManualScope = result.criteria.some(c => c.manualReview)
  const autoLabel = { auto: t('Automatic'), semi: t('Semi-automatic'), manual: t('Manual') } as const

  host.append(
    h(
      'div',
      { class: 'results-head' },
      h(
        'div',
        {},
        ...(perElementTheme() ? [h('h3', {}, hasManualScope ? t('Manual scope checks and other criteria') : t('Other criteria of this theme'))] : []),
        h('p', { class: 'hint-line' }, hasManualScope ? t('Review these criteria across the whole page, including content outside the scan.') : perElementTheme() ? t('Criteria {ids} are not detectable by a script: check them on {url}.', { ids: def.criteria.filter((x) => !perFindingIds().includes(x.id) && inActiveLevel(x.id)).map((x) => x.id).join(', '), url: rec.url }) : t('{n} criteria. Check them on {url} and answer each one. Nothing to scan for this theme.', { n: def.criteria.filter((x) => inActiveLevel(x.id)).length, url: rec.url })),
      ),
    ),
  )
  const list = h('div', { class: 'checklist' })
  const perFinding = perFindingIds()
  for (const c of def.criteria.filter((x) => (!perFinding.includes(x.id) || result.criteria.find(c => c.id === x.id)?.manualReview) && inActiveLevel(x.id))) {
    const answer = (rec.checklist[c.id] ??= { note: '' })
    const computed = result.criteria.find((x) => x.id === c.id)
    const outcome = computed?.outcome
    const manual = Boolean(computed?.manualReview)
    const currentVerdict = !manual || answer.coverageAt === (rec.scanCoverage?.at ?? 0) ? answer.verdict : undefined
    const card = h('div', { class: 'card criterion', 'data-state': currentVerdict ?? '', id: `crit-card-${c.id}` })
    const conflicts = h('div', { class: 'evidence-conflicts', 'aria-live': 'polite' })
    const refreshConflicts = () => conflicts.replaceChildren(...evidenceConflictsOf(answer).map((x) => h('p', { class: 'hint warn' }, t('Conflicting evidence: {x}.', { x }))))
    const setVerdict = (value: ChecklistVerdict) => {
      confirmVerdict(answer, value)
      if (manual) answer.coverageAt = rec.scanCoverage?.at ?? 0
      card.querySelector('.source-note')?.remove()
      card.dataset.state = value
      card.classList.remove('todo')
      card.querySelectorAll<HTMLInputElement>('input[type="radio"]').forEach((input) => { input.checked = input.value === value })
      refreshConflicts()
      persist()
      actions.renderThemeBar()
      actions.renderStats()
      actions.renderPageBar()
    }
    refreshConflicts()
    const verdict = (value: ChecklistVerdict, label: string) => [
      h('input', {
        type: 'radio', name: `chk-${c.id}`, id: `chk-${c.id}-${value}`, value,
        checked: currentVerdict === value,
        onchange: () => setVerdict(value),
      }),
      h('label', { for: `chk-${c.id}-${value}` }, label),
    ]
    card.append(
      h(
        'div',
        { class: 'criterion-head' },
        h('span', { class: 'crit-id' }, `RGAA ${c.id}`),
        h('span', { class: `badge ${c.automation}` }, autoLabel[c.automation]),
        h('a', { class: 'crit-link', href: `https://accessibilite.numerique.gouv.fr/methode/criteres-et-tests/#${c.id}`, target: '_blank', rel: 'noreferrer' }, t('Official tests ↗'), newTabNote()),
      ),
      h('p', { class: 'question' }, c.title.replace(/`/g, '')),
      h('p', { class: 'hint info' }, c.note),
      ...(manual ? [h('p', { class: 'hint warn' }, t('Manual scope check: no relevant element was detected, or the scan skipped content. Inspect the whole page, including frames, shadow content and truncated results. Record your decision for this missing coverage; detected failures remain recorded. A new scan requires a new decision.'))] : []),
      ...autoHints(answer),
      ...(!answer.verdict && answer.suggested
        ? [
            h(
              'p',
              { class: 'hint info source-note' },
              h('strong', {}, t('Suggested: {verdict} (from {tool}).', { verdict: t(VERDICT_WORD[answer.suggested]).toLowerCase(), tool: answer.source ?? '—' })),
              ` ${t('Not counted as confirmed until you confirm it.')} `,
              h('button', { type: 'button', class: 'ghost-btn', onclick: () => { const value = answer.suggested!; setVerdict(value); card.querySelector<HTMLInputElement>('input:checked')?.focus() } }, t('Confirm')),
              ' ',
              h('button', { type: 'button', class: 'ghost-btn', onclick: () => card.querySelector<HTMLInputElement>(`input[name="chk-${c.id}"]`)?.focus() }, t('Change')),
            ),
          ]
        : []),
      conflicts,
      h(
        'details',
        { class: 'tests-detail' },
        h('summary', {}, t('{n} test(s)', { n: c.tests.length })),
        h(
          'ul',
          { class: 'checks' },
          ...c.tests.map((t) => h('li', {}, h('strong', {}, `${t.id} `), t.text.replace(/`/g, ''), ...(t.conditions.length ? [h('ul', {}, ...t.conditions.map((x) => h('li', {}, x.replace(/`/g, ''))))] : []))),
        ),
      ),
      h('fieldset', {}, h('legend', { class: 'hint-line' }, t('Verdict for criterion {id}', { id: c.id })), h('div', { class: 'verdicts' }, ...verdict('c', t('Compliant')), ...verdict('nc', t('Non-compliant')), ...verdict('na', t('Not applicable')))),
      h('textarea', {
        'aria-label': t('Notes for criterion {id}', { id: c.id }),
        placeholder: t('What to fix, where, evidence…'),
        value: answer.note,
        oninput: (e: Event) => { answer.note = (e.target as HTMLTextAreaElement).value; persist() },
      }),
    )
    if (outcome === 'pending') card.classList.add('todo')
    card.append(reviewContinue(`criterion:${c.id}`))
    list.append(card)
  }
  host.append(list)
}
