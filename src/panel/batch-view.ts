import { state } from './state'
import { actions } from './actions'
import { dom, h } from './dom'
import { t } from '../lib/i18n'

export function renderBatch(): void {
  const b = state.batch?.auditId === state.audit.id ? state.batch : undefined
  dom.batchEl.hidden = state.view !== 'sample' && !b?.running
  dom.batchEl.replaceChildren(
    h('summary', {}, t('Automatic checks on selected pages')),
    h('p', { class: 'hint-line' }, t('Select pages below. This replaces the page in the inspected browser tab for each URL, using your browser session. Keep DevTools open. Dynamic states still need checks on the page.')),
    h('p', { role: 'status' }, b ? t('{done}/{total} pages processed', { done: b.index, total: b.ids.length }) : t('{n} pages selected', { n: state.batchSelection.size })),
    h('div', { class: 'nav' },
      h('button', { type: 'button', disabled: !state.batchSelection.size || state.scanBusy || state.runBusy || b?.running, onclick: () => void actions.runSelected() }, t('Run selected pages')),
      ...(b?.running ? [h('button', { type: 'button', disabled: b.paused, onclick: () => { b.paused = true; renderBatch() } }, t('Pause after this page'))] : []),
      ...(b && !b.running && b.index < b.ids.length ? [h('button', { type: 'button', disabled: state.scanBusy, onclick: () => void actions.runSelected(true) }, t('Resume remaining pages'))] : []),
    ),
  )
}
