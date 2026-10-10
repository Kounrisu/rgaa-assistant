import { state } from './state'
import { renderAuditBar } from './chrome'
import type { AuditSummary } from '../lib/types'
import { listAudits } from '../lib/audit-store'
import { say, dom, h } from './dom'
import { describeAuditError } from './audit-session'
import { t } from '../lib/i18n'
import { auditTitle, dateTimeOf } from './helpers'
import { actions } from './actions'

export const renameAudit = (): Promise<unknown> => state.session.renameAuditById(state.audit.id).then(() => { renderAuditBar(); if (state.view === 'audits') void renderAuditsView() })

export const newAudit = (): Promise<boolean> => state.session.newAudit()

export const openAuditById = (id: string): Promise<boolean> => state.session.openAuditById(id).then((ok) => { if (ok) actions.setView('review'); return ok })

export const duplicateAuditById = (id: string): Promise<void> => state.session.duplicateAuditById(id)

export const renameAuditById = (id: string): Promise<unknown> => state.session.renameAuditById(id)

export const saveAuditToFile = (id?: string): Promise<void> => state.session.saveAuditToFile(id)

export const importAuditFile = (file: File): Promise<boolean> => state.session.importAuditFile(file)

export async function deleteAuditFlow(id: string): Promise<void> {
  const wasOpen = id === state.audit.id
  if ((await state.session.deleteAuditFlow(id)) && wasOpen) actions.setView('audits')
}

export async function renderAuditsView(): Promise<void> {
  await state.session.flush()
  let list: AuditSummary[]
  try {
    list = (await listAudits()).sort((a, b) => b.updatedAt - a.updatedAt)
  } catch (err) {
    return void say(describeAuditError(err))
  }
  if (state.view !== 'audits') return
  dom.auditsEl.replaceChildren(
    h(
      'div',
      { class: 'results-head' },
      h('div', {}, h('h2', {}, t('My audits')), h('p', { class: 'hint-line' }, t('Each audit has its own pages, scans and answers. Everything is saved in the browser as you work; save to a file to keep a copy or move it.'))),
      h('div', { class: 'nav' }, h('button', { type: 'button', onclick: () => actions.setView('review') }, t('← Back to review')), h('button', { type: 'button', onclick: () => dom.importInput.click() }, t('Open from a file')), h('button', { type: 'button', class: 'primary', onclick: () => void newAudit() }, t('New audit'))),
    ),
    h(
      'table',
      { class: 'audit-table' },
      h('thead', {}, h('tr', {}, ...[t('Name'), t('Site'), t('Pages'), t('Last change'), t('File'), ''].map((x) => h('th', { scope: 'col' }, x)))),
      h(
        'tbody',
        {},
        ...list.map((a) =>
          h(
            'tr',
            { class: a.id === state.audit.id ? 'current' : '' },
            h('td', {}, h('strong', {}, auditTitle(a)), a.id === state.audit.id ? h('span', { class: 'badge' }, t('Current')) : null),
            h('td', {}, a.site || '—'),
            h('td', {}, String(a.pages)),
            h('td', {}, dateTimeOf(a.updatedAt)),
            h('td', {}, a.exportedAt === undefined ? t('never') : a.updatedAt > a.exportedAt ? t('changed since {time}', { time: dateTimeOf(a.exportedAt) }) : t('up to date')),
            h(
              'td',
              {},
              h(
                'div',
                { class: 'row-actions' },
                a.id === state.audit.id ? null : h('button', { type: 'button', class: 'primary', onclick: () => void openAuditById(a.id) }, t('Open')),
                h('button', { type: 'button', onclick: () => void renameAuditById(a.id) }, t('Rename')),
                h('button', { type: 'button', onclick: () => void duplicateAuditById(a.id) }, t('Duplicate')),
                h('button', { type: 'button', onclick: () => void saveAuditToFile(a.id) }, t('Save to file')),
                h('button', { type: 'button', class: 'danger-btn', onclick: () => void deleteAuditFlow(a.id) }, t('Delete')),
              ),
            ),
          ),
        ),
      ),
    ),
  )
}
