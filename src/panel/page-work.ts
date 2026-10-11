import type { PageRecord } from '../lib/types'
import { MANUAL_CHECKS } from '../lib/manual-checks'
import { t } from '../lib/i18n'
import { state } from './state'
import { h } from './dom'
import { pageInput, pageLabel } from './model'
import { actions } from './actions'
import { dateTimeOf } from './helpers'
import { normalizeUrl } from '../lib/audit-store'
import { reviewQueue } from '../lib/review-queue'

export function runLabel(rec: PageRecord): string {
  const run = rec.automaticRun
  if (!run) return rec.imports?.length ? t('Older results — full run status unknown') : t('Not run yet')
  if (normalizeUrl(run.url) !== normalizeUrl(rec.url)) return t('URL changed — run again')
  const label = run.status === 'running'
    ? (state.runBusy && state.page === rec ? t('Running the checks…') : t('Interrupted — run again'))
    : run.status === 'complete' ? t('Automatic run finished — review required')
    : run.status === 'partial' ? t('Partial run — HTML check failed') : t('Run failed — retry')
  return `${label} · ${dateTimeOf(run.finishedAt ?? run.startedAt)}`
}

/** Work completion counts human decisions, independently of the compliance rate. */
export function pageWork(rec: PageRecord): HTMLElement {
  const all = pageInput(rec).themes.flatMap((theme) => theme.criteria)
  const done = all.filter((c) => !c.unconfirmed && ['c', 'nc', 'na'].includes(c.outcome)).length
  const suggestions = all.filter((c) => c.suggested || c.unconfirmed).length
  const manual = MANUAL_CHECKS.filter((c) => rec.manualChecks?.[c.id]).length
  const pending = reviewQueue(rec).filter((x) => x.pending).length
  const open = () => actions.switchTo(rec.id)
  return h('article', { class: 'card page-work', 'data-page-id': rec.id },
    h('label', {}, h('input', { type: 'checkbox', checked: state.batchSelection.has(rec.id), onchange: (e: Event) => { if ((e.target as HTMLInputElement).checked) state.batchSelection.add(rec.id); else state.batchSelection.delete(rec.id); actions.renderBatch() } }), t('Select {label} for automatic checks', { label: pageLabel(rec) })),
    h('h3', {}, `${pageLabel(rec)} · ${rec.title || t('Untitled page')}`),
    h('p', { class: 'page-address' }, rec.url),
    h('p', {}, t('{done}/{total} criteria answered', { done, total: all.length })),
    h('progress', { value: done, max: all.length || 106, 'aria-label': t('Progress of {label}', { label: pageLabel(rec) }) }),
    h('p', {}, t('{n} decisions remaining in the selected themes', { n: pending })),
    h('p', {}, t('{n} criteria with suggestions to confirm', { n: suggestions })),
    h('p', { class: 'run-status' }, runLabel(rec)),
    ...(rec.automaticRun?.error ? [h('p', { class: 'hint warn' }, rec.automaticRun.error)] : []),
    h('p', {}, t('Last activity: {date}', { date: dateTimeOf(rec.updatedAt) })),
    h('div', { class: 'nav' },
      h('button', { type: 'button', class: 'primary', onclick: () => { open(); void actions.nextReview('') } }, t('Continue evaluation')),
      h('button', { type: 'button', onclick: () => { open(); actions.setView('checks') } }, t('Manual activities: {done}/{total}', { done: manual, total: MANUAL_CHECKS.length })),
      h('button', { type: 'button', onclick: () => { open(); actions.setView('page') } }, t('Page results')),
      h('button', { type: 'button', onclick: () => actions.switchTo(rec.id, true) }, t('Open page')),
    ),
  )
}
