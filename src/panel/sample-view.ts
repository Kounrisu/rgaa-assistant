import { disclosure } from './disclosures'
import { pageWork } from './page-work'
/**
 * The sample: the pages to audit (P01, P02...), their URLs, and the audit fields.
 */
import { state } from './state'
import { say, dom, h, captureFocus } from './dom'
import { askChoice } from './dialogs'
import { isNavigableUrl } from '../lib/url-safety'
import { t } from '../lib/i18n'
import { findPage, createPage, normalizeUrl } from '../lib/audit-store'
import { pageLabel, adoptSite, loadPage, persist, nextPageLabel } from './model'
import { inspectedTitle } from './page-bridge'
import type { PageRecord } from '../lib/types'
import { renderPageBar, themesMenu, showNavBanner } from './chrome'
import { actions } from './actions'
import { AUDIT_LEVELS, LEVEL_COUNT, LEVEL_HELP, LEVEL_LABEL, type AuditLevel } from '../lib/audit-levels'

/** Registers a page of the sample without scanning it. */
export async function addPage(url: string, title?: string): Promise<void> {
  if (state.scanBusy) return void say(t('Wait for the scan to finish before changing pages or audits.'))
  const target = url || state.liveUrl
  if (!target) return void say(t('No URL to add: open a page in the browser first.'))
  if (!isNavigableUrl(target)) return void say(t('Enter a valid HTTP, HTTPS or file URL without credentials.'))
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
  const button = document.getElementById(`page-${dir === -1 ? 'up' : 'down'}-${rec.id}`) as HTMLButtonElement | null
  const fallback = document.getElementById(`page-${dir === -1 ? 'down' : 'up'}-${rec.id}`)
  ;(button?.disabled ? fallback : button)?.focus({ preventScroll: true })
}

/** The sample: which URL is page 1, page 2… Editable, and where pages are registered before scanning. */
export function renderSample(): void {
  const restoreFocus = captureFocus()
  dom.sampleEl.replaceChildren()
  const field = (label: string, key: 'site' | 'auditor' | 'context', placeholder: string) =>
    h(
      'label',
      { class: 'field' },
      h('span', {}, label),
      h('input', { type: 'text', value: state.audit.meta[key], placeholder, oninput: (e: Event) => { state.audit.meta[key] = (e.target as HTMLInputElement).value; persist() } }),
    )
  const level: AuditLevel = state.audit.meta.level ?? 'complet'
  dom.sampleEl.append(
    h(
      'fieldset',
      { class: 'card audit-level' },
      h('legend', {}, t('Type of audit')),
      h('div', { class: 'level-options' }, ...AUDIT_LEVELS.map((value) => [
        h('input', { type: 'radio', name: 'audit-level', id: `audit-level-${value}`, value, checked: level === value, onchange: () => {
          if (value === 'complet') delete state.audit.meta.level
          else state.audit.meta.level = value
          persist()
          actions.renderAll()
          say(t('Audit type: {level}.', { level: `${t(LEVEL_LABEL[value])} (${LEVEL_COUNT[value]})` }))
        } }),
        h('label', { for: `audit-level-${value}` }, `${t(LEVEL_LABEL[value])} (${t('{n} criteria', { n: LEVEL_COUNT[value] })})`),
      ]).flat()),
      h('p', { class: 'hint-line' }, t(LEVEL_HELP[level])),
    ),
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
      id: `page-url-${rec.id}`,
      type: 'url',
      value: rec.url,
      'aria-label': t('URL of {label}', { label }),
      onchange: () => void changePageUrl(rec, urlInput.value, urlInput),
    })
    body.append(
      h(
        'tr',
        { class: rec === state.page ? 'current' : '' },
        h('th', { scope: 'row' }, label),
        h('td', {}, h('input', { type: 'text', value: rec.title, 'aria-label': t('Title of {label}', { label }), oninput: (e: Event) => { rec.title = (e.target as HTMLInputElement).value; persist() }, onchange: () => renderPageBar() })),
        h('td', {}, urlInput, ...(rec.urlHistory?.length ? [h('p', { class: 'hint-line' }, t('Previous addresses retained with this evidence:'), ' ', rec.urlHistory.map(row => row.url).join(' · '))] : [])),
        h('td', {}, themesMenu(rec, 'sample')),
        h('td', {}, String(rec.items.length)),
        h('td', {}, String(rec.scanCount)),
        h(
          'td',
          { class: 'row-actions' },
          h('button', { type: 'button', class: 'img-ref', onclick: () => actions.switchTo(rec.id, true) }, t('Open page')),
          h('button', { type: 'button', class: 'img-ref', title: t('Use the URL the browser is on now'), onclick: () => void changePageUrl(rec, state.liveUrl, urlInput) }, t('Use current URL')),
          h('button', { id: `page-up-${rec.id}`, type: 'button', class: 'img-ref', 'aria-label': t('Move {label} up', { label }), disabled: i === 0, onclick: () => movePage(rec, -1) }, '↑'),
          h('button', { id: `page-down-${rec.id}`, type: 'button', class: 'img-ref', 'aria-label': t('Move {label} down', { label }), disabled: i === state.audit.pages.length - 1, onclick: () => movePage(rec, 1) }, '↓'),
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
      h('p', { class: 'hint-line' }, t('Review shortcuts: Ctrl+Alt+N for the next decision; Ctrl+Alt+J / K for the next / previous image. Arrow keys work in the image list.')),
      h('div', { class: 'sample-meta' }, field(t('Site'), 'site', t('Name of the site')), field(t('Auditor'), 'auditor', t('First name Last name')), field(t('Context'), 'context', t('Initial visit'))),
      h('button', { type: 'button', class: 'danger-btn', disabled: !state.audit.pages.length && !state.audit.meta.site && !state.audit.meta.auditor, onclick: () => actions.resetAudit() }, t('Reset the whole audit'))),
    dom.batchEl,
    h('div', { class: 'sample-work' }, ...state.audit.pages.map(pageWork)),
  )
  for (const child of dom.sampleEl.children) if (child !== dom.batchEl) (child as HTMLElement).inert = state.scanBusy || state.runBusy || Boolean(state.batch?.running)
  restoreFocus()
}

/** Both URL entry points use the same validation and explicit evidence treatment. */
async function changePageUrl(rec: PageRecord, raw: string, input: HTMLInputElement): Promise<void> {
  const value = raw.trim()
  input.value = value
  const clash = findPage(state.audit, value)
  const error = !isNavigableUrl(value) ? t('Enter a valid HTTP, HTTPS or file URL without credentials.') : clash && clash !== rec ? t('{label} already uses this URL.', { label: pageLabel(clash) }) : ''
  input.setCustomValidity(error)
  input.setAttribute('aria-invalid', String(Boolean(error)))
  input.parentElement?.querySelector('.url-error')?.remove()
  if (error) {
    const message = h('p', { class: 'hint warn url-error', id: `url-error-${rec.id}`, role: 'alert' }, error)
    input.after(message); input.setAttribute('aria-describedby', message.id)
    input.reportValidity(); return
  }
  input.removeAttribute('aria-describedby')
  const url = normalizeUrl(value)
  if (url === rec.url) { input.value = rec.url; return }
  const audit = state.audit
  const choice = await askChoice(t('Change the page address'), t('Correcting the same page keeps its evidence and records the previous URL. For different content, create a fresh page; the original page and its evidence stay in the sample.'), [
    { id: 'new', label: t('Create a fresh page'), primary: true },
    { id: 'correct', label: t('Correct the same page address') },
    { id: 'cancel', label: t('Cancel') },
  ])
  if (state.audit !== audit || !audit.pages.includes(rec)) return
  if (choice === 'new') {
    const fresh = createPage(audit, url, url)
    fresh.themes = [...rec.themes]
    loadPage(fresh)
  } else if (choice === 'correct') {
    ;(rec.urlHistory ??= []).push({ url: rec.url, at: Date.now() })
    rec.url = url
    delete rec.automaticRun
    state.scannedThisSession.delete(rec.id)
  } else { input.value = rec.url; return }
  persist(); actions.renderAll()
}
