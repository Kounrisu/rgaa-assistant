/**
 * The checklist themes: one card per official criterion, with a verdict, the tools' hints and a note.
 */
import { findingCriterionIds } from '../lib/findings'
import { state } from './state'
import type { ChecklistAnswer, ChecklistVerdict } from '../lib/types'
import { h, dom } from './dom'
import { t } from '../lib/i18n'
import { themeByNumber, FINDING_THEMES } from '../lib/themes'
import { pageInput, persist } from './model'
import { confirm as confirmVerdict, evidenceConflicts as evidenceConflictsOf } from '../lib/evidence'
import { actions } from './actions'

/** Checklist themes: one card per official criterion with a verdict and a note. */
export function perFindingIds(): string[] {
  return findingCriterionIds(state.theme)
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
  const autoLabel = { auto: t('Automatic'), semi: t('Semi-automatic'), manual: t('Manual') } as const

  host.append(
    h(
      'div',
      { class: 'results-head' },
      h(
        'div',
        {},
        h('h2', {}, FINDING_THEMES.has(state.theme) ? t('Other criteria of this theme') : `${def.number}. ${def.name}`),
        ...(FINDING_THEMES.has(state.theme) ? [] : [h('div', { class: 'theme-summary', 'data-theme': String(state.theme), 'aria-label': t('Totals') })]),
        h('p', { class: 'hint-line' }, FINDING_THEMES.has(state.theme) ? t('Criteria {ids} are not detectable by a script: check them on {url}.', { ids: def.criteria.filter((x) => !perFindingIds().includes(x.id)).map((x) => x.id).join(', '), url: rec.url }) : t('{n} criteria. Check them on {url} and answer each one. Nothing to scan for this theme.', { n: def.criteria.length, url: rec.url })),
      ),
    ),
  )
  const list = h('div', { class: 'checklist' })
  const perFinding = findingCriterionIds(state.theme)
  for (const c of def.criteria.filter((x) => !perFinding.includes(x.id))) {
    const answer = (rec.checklist[c.id] ??= { note: '' })
    const outcome = result.criteria.find((x) => x.id === c.id)?.outcome
    const card = h('div', { class: 'card criterion', 'data-state': answer.verdict ?? '', id: `crit-card-${c.id}` })
    const verdict = (value: ChecklistVerdict, label: string) => [
      h('input', {
        type: 'radio',
        name: `chk-${c.id}`,
        id: `chk-${c.id}-${value}`,
        value,
        checked: answer.verdict === value,
        onclick: () => {
          confirmVerdict(answer, value) // the auditor's answer replaces any tool suggestion
          card.querySelector('.source-note')?.remove()
          card.dataset.state = value
          persist()
          actions.renderThemeBar()
          actions.renderStats()
          actions.renderPageBar()
        },
      }),
      h('label', { for: `chk-${c.id}-${value}` }, label),
    ]
    card.append(
      h(
        'div',
        { class: 'criterion-head' },
        h('span', { class: 'crit-id' }, `RGAA ${c.id}`),
        h('span', { class: `badge ${c.automation}` }, autoLabel[c.automation]),
        h('a', { class: 'crit-link', href: `https://accessibilite.numerique.gouv.fr/methode/criteres-et-tests/#${c.id}`, target: '_blank', rel: 'noreferrer' }, t('Official tests ↗')),
      ),
      h('p', { class: 'question' }, c.title.replace(/`/g, '')),
      h('p', { class: 'hint info' }, c.note),
      ...autoHints(answer),
      ...(!answer.verdict && answer.suggested
        ? [
            h(
              'p',
              { class: 'hint info source-note' },
              h('strong', {}, t('Suggested: {verdict} (from {tool}).', { verdict: t(VERDICT_WORD[answer.suggested]).toLowerCase(), tool: answer.source ?? '—' })),
              ` ${t('Not counted as confirmed until you confirm it.')} `,
              h('button', { type: 'button', class: 'ghost-btn', onclick: () => { confirmVerdict(answer, answer.suggested!); persist(); actions.renderAll() } }, t('Confirm')),
              ' ',
              h('button', { type: 'button', class: 'ghost-btn', onclick: () => card.querySelector<HTMLInputElement>(`input[name="chk-${c.id}"]`)?.focus() }, t('Change')),
            ),
          ]
        : []),
      ...(evidenceConflictsOf(answer).map((x) => h('p', { class: 'hint warn' }, t('Conflicting evidence: {x}.', { x })))),
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
    list.append(card)
  }
  host.append(list)
}
