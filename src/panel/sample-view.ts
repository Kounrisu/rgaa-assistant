import { disclosure } from './disclosures'
import { pageWork } from './page-work'
/**
 * The sample: the pages to audit (P01, P02...), their URLs, and the audit fields.
 */
import { state } from './state'
import { say, dom, h } from './dom'
import { t } from '../lib/i18n'
import { findPage, createPage, normalizeUrl } from '../lib/audit-store'
import { pageLabel, adoptSite, loadPage, persist, nextPageLabel } from './model'
import { inspectedTitle } from './page-bridge'
import type { PageRecord, Audit } from '../lib/types'
import { renderPageBar, themesMenu, showNavBanner } from './chrome'
import { actions } from './actions'

/** Registers a page of the sample without scanning it. */
export async function addPage(url: string, title?: string): Promise<void> {
  const target = url || state.liveUrl
  if (!target) return void say(t('No URL to add: open a page in the browser first.'))
  const known = findPage(state.audit, target)
  if (known) {
    say(t('{label} already uses this URL.', { label: pageLabel(known) }))
    return void actions.switchTo(known.id)
  }
  const rec = createPage(state.audit, target, title ?? ((await inspectedTitle()) || target))
  adoptSite(rec.url)
  loadPage(rec)
  persist()
  actions.setView(state.view === 'sample' ? 'sample' : 'review')
  actions.renderAll()
  // the "this URL is not in the sample yet" banner is about this very page: re-evaluate it now, not at the next tab event
  if (state.liveUrl) showNavBanner(state.liveUrl)
  say(t('{label} registered. Open it in the browser to find its elements.', { label: pageLabel(rec) }))
}

export function movePage(rec: PageRecord, dir: -1 | 1): void {
  const i = state.audit.pages.indexOf(rec)
  const j = i + dir
  if (j < 0 || j >= state.audit.pages.length) return
  ;[state.audit.pages[i], state.audit.pages[j]] = [state.audit.pages[j], state.audit.pages[i]]
  persist()
  actions.renderAll()
}

/** The sample: which URL is page 1, page 2… Editable, and where pages are registered before scanning. */
export function renderSample(): void {
  dom.sampleEl.replaceChildren()
  const field = (label: string, key: keyof Audit['meta'], placeholder: string) =>
    h(
      'label',
      { class: 'field' },
      h('span', {}, label),
      h('input', { type: 'text', value: state.audit.meta[key], placeholder, oninput: (e: Event) => { state.audit.meta[key] = (e.target as HTMLInputElement).value; persist() } }),
    )
  dom.sampleEl.append(
    h(
      'div',
      { class: 'results-head' },
      h('div', {}, h('h2', {}, t('Sample and progress')), h('p', { class: 'hint-line' }, t('Follow the audit page by page: automatic suggestions, human decisions and manual activities.'))),
    ),
  )

  const table = h('table', { class: 'results-table sample-table' })
  table.append(
    h('caption', { class: 'sr-only' }, t('Pages of the sample')),
    h('thead', {}, h('tr', {}, ...['Page', 'Title', 'URL', 'Themes', 'Images', 'Scans', 'Actions'].map((name) => h('th', { scope: 'col' }, t(name))))),
  )
  const body = h('tbody', {})
  state.audit.pages.forEach((rec, i) => {
    const label = pageLabel(rec)
    const urlInput = h('input', {
      type: 'url',
      value: rec.url,
      'aria-label': t('URL of {label}', { label }),
      onchange: (e: Event) => {
        const value = (e.target as HTMLInputElement).value.trim()
        const clash = findPage(state.audit, value)
        if (clash && clash !== rec) {
          say(t('{label} already uses this URL.', { label: pageLabel(clash) }))
          ;(e.target as HTMLInputElement).value = rec.url
          return
        }
        rec.url = normalizeUrl(value)
        persist()
        renderPageBar()
      },
    })
    body.append(
      h(
        'tr',
        { class: rec === state.page ? 'current' : '' },
        h('th', { scope: 'row' }, label),
        h('td', {}, h('input', { type: 'text', value: rec.title, 'aria-label': t('Title of {label}', { label }), oninput: (e: Event) => { rec.title = (e.target as HTMLInputElement).value; persist() }, onchange: () => renderPageBar() })),
        h('td', {}, urlInput),
        h('td', {}, themesMenu(rec)),
        h('td', {}, String(rec.items.length)),
        h('td', {}, String(rec.scanCount)),
        h(
          'td',
          { class: 'row-actions' },
          h('button', { type: 'button', class: 'img-ref', onclick: () => actions.switchTo(rec.id, true) }, t('Open page')),
          h('button', { type: 'button', class: 'img-ref', title: t('Use the URL the browser is on now'), onclick: () => { if (!state.liveUrl) return; rec.url = normalizeUrl(state.liveUrl); persist(); renderSample(); renderPageBar() } }, t('Use current URL')),
          h('button', { type: 'button', class: 'img-ref', 'aria-label': t('Move {label} up', { label }), disabled: i === 0, onclick: () => movePage(rec, -1) }, '↑'),
          h('button', { type: 'button', class: 'img-ref', 'aria-label': t('Move {label} down', { label }), disabled: i === state.audit.pages.length - 1, onclick: () => movePage(rec, 1) }, '↓'),
          h('button', { type: 'button', class: 'img-ref', title: t('Clear its scans and answers, keep the page'), onclick: () => actions.resetPage(rec) }, t('Reset')),
          h('button', { type: 'button', class: 'img-ref nc', onclick: () => actions.removePage(rec) }, t('Remove')),
        ),
      ),
    )
  })
  table.append(body)
  dom.sampleEl.append(h('div', { class: 'results-scroll', tabindex: '0', role: 'region', 'aria-label': t('Pages of the sample') }, table))

  const urlNew = h('input', { type: 'url', value: state.liveUrl, placeholder: 'https://…', 'aria-label': t('URL of the new page') })
  const titleNew = h('input', { type: 'text', placeholder: t('Title (optional)'), 'aria-label': t('Title of the new page') })
  dom.sampleEl.append(
    h(
      'div',
      { class: 'card add-page' },
      h('h3', {}, t('Add page {label}', { label: nextPageLabel() })),
      h('div', { class: 'add-row' }, urlNew, titleNew,
        h('button', { type: 'button', class: 'img-ref', onclick: () => { urlNew.value = state.liveUrl } }, t('Use current URL')),
        h('button', { type: 'button', class: 'primary', onclick: () => void addPage(urlNew.value.trim(), titleNew.value.trim() || undefined) }, t('Add to the sample'))),
      h('p', { class: 'hint-line' }, t('Adding a page does not scan it. Select it, open it in the browser, then find its elements.')),
    ),
  )
  dom.sampleEl.append(
    disclosure('sample-settings', { class: 'sample-management' }, h('summary', {}, t('Audit details and settings')),
      h('div', { class: 'sample-meta' }, field(t('Site'), 'site', t('Name of the site')), field(t('Auditor'), 'auditor', t('First name Last name')), field(t('Context'), 'context', t('Initial visit'))),
      h('button', { type: 'button', class: 'danger-btn', disabled: !state.audit.pages.length && !state.audit.meta.site && !state.audit.meta.auditor, onclick: () => actions.resetAudit() }, t('Reset the whole audit'))),
    dom.batchEl,
    h('div', { class: 'sample-work' }, ...state.audit.pages.map(pageWork)),
  )
  for (const child of dom.sampleEl.children) if (child !== dom.batchEl) (child as HTMLElement).inert = state.runBusy || Boolean(state.batch?.running)
}
