/**
 * The panel page: its elements, looked up once (`dom`), and the small DOM helpers every view uses (`h`, `$`, `say`, `tNodes`, `keepScroll`, `download`).
 */
import type { Child } from './types'
import { t } from '../lib/i18n'

export const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Record<string, unknown> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue
    if (key === 'class') node.className = String(value)
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value as EventListener)
    else if (key in node && key !== 'list') (node as unknown as Record<string, unknown>)[key] = value
    else node.setAttribute(key, String(value))
  }
  for (const child of children) if (child) node.append(child)
  return node
}

/** Like t(), but each `{name}` is replaced by a node (a <strong>, a link…) instead of text. */
export function tNodes(en: string, nodes: Record<string, Child>): Child[] {
  return t(en)
    .split(/(\{\w+\})/)
    .filter(Boolean)
    .map((part) => {
      const key = /^\{(\w+)\}$/.exec(part)?.[1]
      return key && key in nodes ? nodes[key] : part
    })
}

/**
 * Rebuilds a part of the panel without moving what you were looking at: the panel scroll, the scroll of the list and
 * of the columns are put back, and the part keeps its height while previews load (a shorter page would scroll up).
 */
export function keepScroll(host: HTMLElement, rebuild: () => void): void {
  const root = (document.scrollingElement ?? document.documentElement) as HTMLElement
  const sel = '.col'
  const y = root.scrollTop
  const inner = [...host.querySelectorAll<HTMLElement>(sel)].map((e) => e.scrollTop)
  host.style.minHeight = `${host.offsetHeight}px`
  rebuild()
  host.querySelectorAll<HTMLElement>(sel).forEach((e, i) => (e.scrollTop = inner[i] ?? 0))
  root.scrollTop = y
  window.setTimeout(() => (host.style.minHeight = ''), 700)
}

export function download(bytes: BlobPart, type: string, name: string): void {
  const url = URL.createObjectURL(new Blob([bytes], { type }))
  const a = h('a', { href: url, download: name })
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

/**
 * The elements of panel.html the panel code works with, looked up once. Every module reads them from here
 * (`dom.scanBtn`) instead of declaring its own constants.
 */
export const dom = {
  batchEl: $<HTMLDetailsElement>('batch-controls'),
  auditBar: document.querySelector<HTMLElement>('.auditbar')!,
  pageBar: document.querySelector<HTMLElement>('.pagebar')!,
  auditNavigation: document.querySelector<HTMLElement>('.audit-navigation')!,
  pageNavigation: document.querySelector<HTMLElement>('.page-navigation')!,
  openPageBtn: $<HTMLButtonElement>('open-page-btn'),
  reviewBtn: $<HTMLButtonElement>('review-btn'),
  evaluatePageBtn: $<HTMLButtonElement>('evaluate-page-btn'),
  scanBtn: $<HTMLButtonElement>('scan-btn'),
  clearBtn: $<HTMLButtonElement>('clear-btn'),
  statusEl: $('status'),
  appEl: $('app'),
  emptyEl: $('empty'),
  listEl: $('element-list'),
  detailEl: $('detail'),
  filtersEl: $('filters'),
  resultsEl: $('results'),
  resultsBtn: $<HTMLButtonElement>('results-btn'),
  newBanner: $('new-banner'),
  newBannerText: $('new-banner-text'),
  rescanBtn: $<HTMLButtonElement>('rescan-btn'),
  boxesBtn: $<HTMLButtonElement>('boxes-btn'),
  tintBtn: $<HTMLButtonElement>('tint-btn'),
  altBtn: $<HTMLButtonElement>('alt-btn'),
  confirmDialog: $<HTMLDialogElement>('confirm-dialog'),
  pageSelect: $<HTMLSelectElement>('page-select'),
  pageToolsEl: $('page-tools'),
  progressEl: $('progress'),
  pageProgressEl: $('page-progress'),
  nextBtn: $<HTMLButtonElement>('next-btn'),
  liveUrlEl: $('live-url'),
  resetThemeBtn: $<HTMLButtonElement>('reset-theme-btn'),
  pageSummaryTitle: $('page-summary-title'),
  themeSummaryTitle: $('theme-summary-title'),
  themeTodoEl: $('theme-todo'),
  themeSummaryEl: $('theme-summary'),
  imageInventoryEl: $('image-inventory'),
  displayToolsEl: $('display-tools'),
  navBanner: $('nav-banner'),
  navBannerText: $('nav-banner-text'),
  navBannerBtn: $<HTMLButtonElement>('nav-banner-btn'),
  auditEl: $('audit'),
  auditBtn: $<HTMLButtonElement>('audit-btn'),
  sampleEl: $('sample'),
  themeEl: $('theme-view'),
  themebarEl: $('themebar'),
  sampleBtn: $<HTMLButtonElement>('sample-btn'),
  emptyTitle: $('empty-title'),
  emptyText: $('empty-text'),
  emptyAddBtn: $<HTMLButtonElement>('empty-add-btn'),
  emptyGoBtn: $<HTMLButtonElement>('empty-go-btn'),
  toolsEl: $('tools'),
  themeHeadEl: $('theme-head'),
  checksEl: $('checks'),
  checksBtn: $<HTMLButtonElement>('checks-btn'),
  autoBtn: $<HTMLButtonElement>('auto-btn'),
  auditNameBtn: $<HTMLButtonElement>('audit-name-btn'),
  auditLevelEl: $('audit-level'),
  saveStateEl: $('save-state'),
  saveRetryBtn: $<HTMLButtonElement>('save-retry-btn'),
  backupStateEl: $('backup-state'),
  auditsBtn: $<HTMLButtonElement>('audits-btn'),
  saveFileBtn: $<HTMLButtonElement>('save-file-btn'),
  openFileBtn: $<HTMLButtonElement>('open-file-btn'),
  auditsEl: $('audits'),
  importInput: $<HTMLInputElement>('import-file'),
  langFrBtn: $<HTMLButtonElement>('lang-fr'),
  langEnBtn: $<HTMLButtonElement>('lang-en'),
  textDialog: $<HTMLDialogElement>('text-dialog'),
  choiceDialog: $<HTMLDialogElement>('choice-dialog'),
}

/** Writes a message in the status line at the top of the panel. */
export function say(message: string): void {
  dom.statusEl.textContent = message
}
