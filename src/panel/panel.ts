import { DETECTED_LABEL, criteriaFor, criterionUrl, detectedOf, hintFor, suggestedKind, type Criterion } from '../lib/rgaa'
import { auditSheets, auditStats, buildWorkbook, levelStats, pageSheets, pct2, rateExact, rateOf, thumbKey, type Counts, type PageInput } from '../lib/audit-sheet'
import { createPage, emptyAudit, findPage, loadAudit, normalizeUrl, saveAudit } from '../lib/audit-store'
import type { Sheet } from '../lib/xlsx'
import { makeThumbs } from '../lib/thumbs'
import { computeThemes, testIdFor, type Outcome } from '../lib/results'
import { colorOf } from '../lib/theme-colors'
import { contrastRatio, parseHex, toHex } from '../lib/contrast'
import { FINDING_CRITERIA, findingCriterionIds, hintForFinding, suggestFinding, type FindingCriterion } from '../lib/findings'
import { FINDING_THEMES, SCANNED_THEMES, THEMES, THEME_LABEL, themeByNumber } from '../lib/themes'
import type { Audit, AuditItem, ChecklistVerdict, Detected, FindingItem, ImageElementInfo, ImageKind, ImageReview, PageRecord, RawFinding, Verdict } from '../lib/types'

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T

const scanBtn = $<HTMLButtonElement>('scan-btn')
const clearBtn = $<HTMLButtonElement>('clear-btn')
const statusEl = $('status')
const appEl = $('app')
const emptyEl = $('empty')
const listEl = $('element-list')
const detailEl = $('detail')
const filtersEl = $('filters')
const resultsEl = $('results')
const resultsBtn = $<HTMLButtonElement>('results-btn')
const newBanner = $('new-banner')
const newBannerText = $('new-banner-text')
const rescanBtn = $<HTMLButtonElement>('rescan-btn')
const boxesBtn = $<HTMLButtonElement>('boxes-btn')
const tintBtn = $<HTMLButtonElement>('tint-btn')
let focusTintOn = (() => { try { return localStorage.getItem('rgaa-focus-tint') !== 'off' } catch { return true } })()

type Item = AuditItem

function hash(text: string): string {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return (h >>> 0).toString(36)
}

const keyOf = (el: ImageElementInfo) =>
  `${el.type}|${el.src && !el.src.startsWith('data:') ? el.src : hash(el.html)}|${hash(el.contextHtml)}`

let audit: Audit = emptyAudit()
let page: PageRecord | null = null
let liveUrl = ''
const scannedThisSession = new Set<string>()
let elements: Item[] = []
let scanCount = 0
let selectedId: number | null = null
let reviews: Record<string, ImageReview> = {}
let theme = 1
type Filter = 'all' | Detected | 'dialog' | 'gone' | 'review' | 'prefilled'
let filter: Filter = 'all'

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

type Child = Node | string | null | undefined | false
function h<K extends keyof HTMLElementTagNameMap>(
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

function say(message: string): void {
  statusEl.textContent = message
}

function inspectedTabId(): number {
  return chrome.devtools.inspectedWindow.tabId
}

async function sendToPage(tabId: number, payload: unknown) {
  const response = await chrome.runtime.sendMessage({ type: 'RGAA_RELAY', tabId, payload })
  if (!response || response.error) throw new Error(response?.error ?? 'No response from page')
  return response
}

const focusOnPage = async (id: number, scroll: boolean, themeNo = 1) => {
  if (scroll && boxesOn[themeNo] === false) {
    boxesOn[themeNo] = true
    await applyBoxes()
  }
  return sendToPage(inspectedTabId(), { type: 'RGAA_FOCUS_IMAGE', id, scroll, theme: themeNo })
    .then((response) => {
      if (response?.ok === false && scroll) say('This image is not on the page right now (popin closed?). Reopen it, then click Rescan.')
    })
    .catch(console.error)
}

/** Per theme: are its boxes on? Saved in the browser; the default is on. */
const boxesOn: Record<number, boolean> = (() => {
  try { return JSON.parse(localStorage.getItem('rgaa-boxes-by-theme') ?? '{}') } catch { return {} }
})()

/** Only the theme you are in shows boxes on the page, and only if its own toggle is on. */
async function applyBoxes(): Promise<void> {
  const on = boxesOn[theme] !== false
  const name = THEME_LABEL[theme] ?? ''
  boxesBtn.setAttribute('aria-pressed', String(on))
  boxesBtn.textContent = on ? `Hide ${name} boxes` : `Show ${name} boxes`
  try { localStorage.setItem('rgaa-boxes-by-theme', JSON.stringify(boxesOn)) } catch { /* optional */ }
  const visibility: Record<number, boolean> = {}
  for (const n of SCANNED_THEMES) visibility[n] = n === theme && boxesOn[n] !== false
  tintBtn.setAttribute('aria-pressed', String(focusTintOn))
  tintBtn.textContent = `Yellow tint: ${focusTintOn ? 'on' : 'off'}`
  await sendToPage(inspectedTabId(), { type: 'RGAA_OVERLAY', visibility, tint: focusTintOn }).catch(() => undefined)
  await syncFilterBoxes()
}

/** The list filter also decides which boxes are on the page (Images and Colours). */
async function syncFilterBoxes(): Promise<void> {
  let ids: number[] | null = null
  if (theme === 1 && filter !== 'all') ids = visibleElements().map((e) => e.id)
  if ((theme === 2 || theme === 3) && findingFilter !== 'all' && page) ids = page.findings.filter((f) => f.theme === theme && findingMatches(f, findingFilter)).map((f) => f.id)
  if (theme !== 1 && theme !== 2 && theme !== 3) return
  await sendToPage(inspectedTabId(), { type: 'RGAA_SHOW_ONLY', theme, ids }).catch(() => undefined)
}

/**
 * Asks a question inside the panel. The browser's own confirm() popup is not shown in a DevTools panel
 * (it returns "no" at once), so a reset would silently do nothing.
 */
const confirmDialog = $<HTMLDialogElement>('confirm-dialog')
function askConfirm(title: string, text: string, okLabel = 'Confirm'): Promise<boolean> {
  return new Promise((resolve) => {
    const ok = $('confirm-ok')
    const cancel = $('confirm-cancel')
    $('confirm-title').textContent = title
    $('confirm-text').textContent = text
    ok.textContent = okLabel
    const finish = (answer: boolean) => {
      ok.removeEventListener('click', onOk)
      cancel.removeEventListener('click', onNo)
      confirmDialog.removeEventListener('cancel', onNo)
      if (confirmDialog.open) confirmDialog.close()
      resolve(answer)
    }
    const onOk = () => finish(true)
    const onNo = (event: Event) => {
      event.preventDefault() // Escape would otherwise close the dialog without answering
      finish(false)
    }
    ok.addEventListener('click', onOk)
    cancel.addEventListener('click', onNo)
    confirmDialog.addEventListener('cancel', onNo)
    confirmDialog.showModal()
  })
}

function labelOf(el: Item): string {
  return el.src && !el.src.startsWith('data:') ? fileName(el.src) : `<${el.type}>`
}

function fileName(src: string): string {
  try {
    return decodeURIComponent(new URL(src).pathname.split('/').pop() || src)
  } catch {
    return src
  }
}

/* ------------------------------------------------------------------ */
/* Persistence (the whole audit, in chrome.storage.local)               */
/* ------------------------------------------------------------------ */

const reviewKey = (el: Item) => el.key
let saveTimer: number | undefined

function persist(): void {
  if (page) {
    page.scanCount = scanCount
    page.updatedAt = Date.now()
  }
  window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => {
    saveAudit(audit).catch(() => say('Could not save the audit (storage full or unavailable).'))
  }, 400)
}
const saveReviews = persist

function reviewOf(el: Item): ImageReview {
  return (reviews[reviewKey(el)] ??= { answers: {}, note: '' })
}

type Status = 'todo' | 'progress' | 'c' | 'nc'
function statusOf(el: Item): Status {
  const review = reviews[reviewKey(el)]
  if (!review?.kind) return 'todo'
  const applicable = criteriaFor(review.kind)
  const answers = applicable.map((c) => review.answers[c.id])
  if (answers.includes('nc')) return 'nc'
  if (answers.some((a) => a === undefined)) return 'progress'
  return 'c'
}

const STATUS_LABEL: Record<Status, string> = {
  todo: 'Not reviewed',
  progress: 'In progress',
  c: 'Compliant',
  nc: 'Non-compliant',
}

/* ------------------------------------------------------------------ */
/* Header stats                                                        */
/* ------------------------------------------------------------------ */

/** Kept as the single entry point the rest of the panel calls after any answer. */
function renderStats(): void {
  renderSummaries()
}

const OUTCOME_PILLS: [Outcome, string, string][] = [
  ['c', 'compliant', 'ok'],
  ['nc', 'non-compliant', 'bad'],
  ['pending', 'to review', 'warn-pill'],
  ['na', 'not applicable', ''],
  ['unassessed', 'not tested', ''],
]

/**
 * The totals of a theme, in the theme's own header: criteria compliant, non-compliant, to review,
 * not applicable, not tested. Each total jumps to the first element it stands for.
 */
function renderSummaries(): void {
  for (const host of document.querySelectorAll<HTMLElement>('.theme-summary')) {
    const pageScope = host.dataset.scope === 'page'
    const n = Number(host.dataset.theme)
    host.replaceChildren()
    if (!page) continue
    const all = pageInput(page).themes
    // page scope: every criterion of the chosen themes; theme scope: that theme's criteria
    const criteria = pageScope ? all.filter((t) => t.selected).flatMap((t) => t.criteria) : (all.find((x) => x.number === n)?.criteria ?? [])
    if (!pageScope && !all.find((x) => x.number === n)?.selected) continue
    if (!criteria.length) continue
    const t = { criteria }
    for (const [outcome, label, cls] of OUTCOME_PILLS) {
      const count = t.criteria.filter((c) => c.outcome === outcome).length
      host.append(
        h(
          'button',
          {
            type: 'button',
            class: `pill ${cls} sum-${outcome}`,
            disabled: count === 0,
            title: count ? `Go to the first one (${label})` : `Nothing ${label}`,
            onclick: () => (pageScope ? goToFirstOnPage(outcome) : goToFirst(n, outcome)),
          },
          h('strong', {}, String(count)),
          ` ${label}`,
        ),
      )
    }
    if (!pageScope && n === 1 && elements.length) {
      const prefilled = elements.filter((e) => reviews[reviewKey(e)]?.auto).length
      host.append(
        h('span', { class: 'pill plain' }, `${elements.length} images`),
        ...(elements.some((e) => !e.present) ? [h('span', { class: 'pill plain' }, `${elements.filter((e) => e.present).length} on page now`)] : []),
        ...(prefilled
          ? [h('button', { type: 'button', class: 'pill plain', title: 'Show the images whose answer was pre-filled', onclick: () => { filter = 'prefilled'; renderFilters(); renderList(); void syncFilterBoxes() } }, `${prefilled} pre-filled, to confirm`)]
          : []),
      )
    }
  }
}

/** The first chosen theme (in order) that has something to jump to for this status. */
function firstThemeWith(outcome: Outcome): number | null {
  if (!page) return null
  const rec = page
  for (const t of pageInput(rec).themes.filter((x) => x.selected)) {
    if (!t.criteria.some((c) => c.outcome === outcome)) continue
    if (outcome === 'pending') {
      // a theme that was never scanned has criteria "to review" but no element to go to
      const perFinding = findingCriterionIds(t.number)
      const pendingCards = t.criteria.some((c) => c.outcome === 'pending' && !perFinding.includes(c.id) && t.number !== 1)
      const hasElement =
        t.number === 1 ? elements.some((e) => needsReview(e)) : FINDING_THEMES.has(t.number) ? rec.findings.some((f) => f.theme === t.number && findingNeedsReview(f)) : false
      if (!hasElement && !pendingCards) continue
    }
    return t.number
  }
  return null
}

/** Page-level totals (all chosen themes): open the first theme that has such an item, then go to its first element. */
function goToFirstOnPage(outcome: Outcome): void {
  const n = firstThemeWith(outcome)
  if (n === null) {
    return void say(outcome === 'pending' ? 'Nothing to review yet: scan the page, or every element has been reviewed.' : 'Nothing to show for this total.')
  }
  theme = n
  findingFilter = 'all'
  setView('review')
  renderThemeBar()
  goToFirst(n, outcome)
}

/** Where a total leads: the first image / finding / criterion behind it, or its row in the grid. */
function goToFirst(n: number, outcome: Outcome): void {
  if (!page) return
  const rec = page
  const result = pageInput(rec).themes.find((x) => x.number === n)
  const first = result?.criteria.find((c) => c.outcome === outcome)
  const verdictOf = (o: Outcome) => (o === 'c' ? 'c' : o === 'nc' ? 'nc' : o === 'na' ? 'na' : null)

  if (n === 1) {
    const pick =
      outcome === 'pending' ? elements.find((e) => needsReview(e)) : outcome === 'c' || outcome === 'nc' ? elements.find((e) => statusOf(e) === outcome) : undefined
    if (pick) {
      filter = outcome === 'pending' ? 'review' : 'all'
      renderFilters()
      renderList()
      select(pick.id, true)
      void syncFilterBoxes()
      return
    }
    if (outcome === 'pending') return void say('Nothing left to review among the images.')
    if (first) return openGridAt(first.id)
    return
  }

  if (FINDING_THEMES.has(n)) {
    const list = rec.findings.filter((f) => f.theme === n)
    const v = verdictOf(outcome)
    const pick =
      outcome === 'pending'
        ? list.find((f) => findingNeedsReview(f))
        : v
          ? list.find((f) => Object.values(rec.findingReviews[f.key]?.answers ?? {}).includes(v))
          : undefined
    if (pick) {
      findingFilter = outcome === 'pending' ? 'review' : 'all'
      findingSel = pick.id
      renderThemeView()
      void focusFinding(pick, true)
      void syncFilterBoxes()
      return
    }
  }

  // checklist criteria (every theme but Images, plus 3.1 / 3.3): scroll to the card
  if (first) {
    const card = themeEl.querySelector<HTMLElement>(`[id="crit-card-${first.id}"]`)
    if (card) {
      card.scrollIntoView({ block: 'center', behavior: 'smooth' })
      card.classList.add('flash')
      setTimeout(() => card.classList.remove('flash'), 1800)
      return
    }
    openGridAt(first.id)
  }
}

/** Opens the page grid on a criterion's row (for totals that have no element to point at). */
function openGridAt(criterionId: string): void {
  activeSheet = 0
  setView('page')
  const row = resultsEl.querySelector<HTMLElement>(`tr[data-crit="${criterionId}"]`)
  row?.scrollIntoView({ block: 'center' })
  row?.classList.add('flash')
  setTimeout(() => row?.classList.remove('flash'), 1800)
}

/* ------------------------------------------------------------------ */
/* List                                                                */
/* ------------------------------------------------------------------ */

function altLabel(el: Item): { text: string; missing: boolean } {
  const detected = detectedOf(el)
  if (detected === 'ignored') return { text: `Ignored — ${el.ignoredBy}`, missing: false }
  if (detected === 'unnamed') return { text: 'No text alternative', missing: true }
  return { text: `“${el.accessibleName}”`, missing: false }
}

function visibleElements(): Item[] {
  return elements.filter((el) => matches(el, filter))
}

/** Present on the page but not fully answered: no type chosen, or a criterion still unanswered. */
function needsReview(el: Item): boolean {
  const status = statusOf(el)
  return status === 'todo' || status === 'progress'
}

function matches(el: Item, f: Filter): boolean {
  if (f === 'all') return true
  if (f === 'dialog') return el.inDialog
  if (f === 'gone') return !el.present
  if (f === 'review') return needsReview(el)
  if (f === 'prefilled') return Boolean(reviews[reviewKey(el)]?.auto)
  return detectedOf(el) === f
}

function renderFilters(): void {
  filtersEl.replaceChildren()
  const count = (d: Filter) => elements.filter((e) => matches(e, d)).length
  const chips: [Filter, string][] = [
    ['all', 'All'],
    ['review', 'To review'],
    ['ignored', 'Ignored'],
    ['named', 'With alternative'],
    ['unnamed', 'No alternative'],
    ['prefilled', 'Pre-filled'],
    ['dialog', 'In a popin'],
    ['gone', 'Not on page now'],
  ]
  for (const [value, label] of chips) {
    if ((value === 'dialog' || value === 'gone' || value === 'prefilled') && count(value) === 0) continue
    filtersEl.append(
      h(
        'button',
        {
          type: 'button',
          class: `chip ${value}`,
          'aria-pressed': String(filter === value),
          title: value === 'all' ? 'Every image found so far' : value === 'review' ? 'Images with no type chosen or a criterion still unanswered' : value === 'dialog' ? 'Inside a dialog / popin' : value === 'gone' ? 'Seen in an earlier scan but no longer on the page' : value === 'prefilled' ? 'Answer pre-filled from the markup, still to confirm' : DETECTED_LABEL[value],
          onclick: () => {
            filter = value
            renderFilters()
            renderList()
            void syncFilterBoxes()
          },
        },
        `${label} `,
        h('span', { class: 'count' }, String(count(value))),
      ),
    )
  }
}

function renderList(): void {
  listEl.replaceChildren()
  for (const el of visibleElements()) {
    const alt = altLabel(el)
    const status = statusOf(el)
    const detected = detectedOf(el)
    const btn = h(
      'button',
      {
        type: 'button',
        class: `item${el.present ? '' : ' absent'}`,
        'data-id': el.id,
        'aria-current': el.id === selectedId ? 'true' : 'false',
        onclick: () => select(el.id, true),
        onmouseenter: () => focusOnPage(el.id, false),
        onfocus: () => focusOnPage(el.id, false),
      },
      el.thumb
        ? h('img', { class: 'thumb', src: el.thumb, alt: '', loading: 'lazy' })
        : h('span', { class: 'thumb placeholder', 'aria-hidden': 'true' }, el.tag),
      h(
        'span',
        { class: 'main' },
        h(
          'span',
          { class: 'num' },
          `#${el.id}`,
          h('span', { class: 'type' }, el.type),
          detected === 'unnamed' ? h('span', { class: 'type error' }, el.alt === null && el.tag === 'img' ? 'no alt' : 'no name') : null,
          el.inDialog ? h('span', { class: 'type popin' }, 'popin') : null,
          h('span', { class: 'type auto-tag', hidden: !reviews[reviewKey(el)]?.auto, title: 'Pre-filled from the markup — confirm it' }, 'pre-filled'),
          !el.present ? h('span', { class: 'type gone' }, 'not on page') : null,
          el.scan > 1 && el.present ? h('span', { class: 'type new' }, `scan ${el.scan}`) : null,
        ),
        h('span', { class: `alt ${detected}${alt.missing ? ' missing' : ''}`, title: labelOf(el) }, alt.text),
      ),
      h('span', { class: `dot ${status}`, role: 'img', 'aria-label': STATUS_LABEL[status], title: STATUS_LABEL[status] }),
    )
    listEl.append(h('li', {}, btn))
  }
  if (!listEl.children.length) listEl.append(h('li', { class: 'hint-line' }, 'No image in this category.'))
}

function refreshListState(): void {
  for (const btn of listEl.querySelectorAll<HTMLButtonElement>('.item')) {
    const el = elements.find((e) => e.id === Number(btn.dataset.id))
    if (!el) continue
    btn.setAttribute('aria-current', el.id === selectedId ? 'true' : 'false')
    const dot = btn.querySelector('.dot') as HTMLElement
    const status = statusOf(el)
    dot.className = `dot ${status}`
    btn.querySelector<HTMLElement>('.auto-tag')!.hidden = !reviews[reviewKey(el)]?.auto
    dot.setAttribute('aria-label', STATUS_LABEL[status])
    dot.title = STATUS_LABEL[status]
  }
}

/* ------------------------------------------------------------------ */
/* Code rendering                                                      */
/* ------------------------------------------------------------------ */

const VOID_TAGS = new Set(['img', 'br', 'hr', 'input', 'meta', 'link', 'source', 'area', 'col', 'embed', 'wbr', 'track', 'param'])
const A11Y_ATTR = /^(alt|role|title|aria-[\w-]+|longdesc|tabindex|figcaption)$/i

function formatHtml(source: string): string[] {
  const tokens = source.match(/<!--[\s\S]*?-->|<[^>]*>?|[^<]+/g) ?? []
  const lines: string[] = []
  let depth = 0
  for (const token of tokens) {
    if (token.startsWith('</')) {
      depth = Math.max(0, depth - 1)
      lines.push('  '.repeat(depth) + token)
    } else if (token.startsWith('<!--')) {
      lines.push('  '.repeat(depth) + token)
    } else if (token.startsWith('<')) {
      lines.push('  '.repeat(depth) + token)
      const name = /^<([a-z][\w-]*)/i.exec(token)?.[1]?.toLowerCase()
      if (name && !VOID_TAGS.has(name) && !token.endsWith('/>')) depth++
    } else {
      const text = token.replace(/\s+/g, ' ').trim()
      if (text) lines.push('  '.repeat(depth) + text)
    }
  }
  return lines
}

function highlightLine(line: string): HTMLElement {
  const indent = /^\s*/.exec(line)![0]
  const body = line.slice(indent.length)
  const isTarget = body.includes('data-rgaa-target')
  const row = h('span', { class: `line${isTarget ? ' target' : ''}` }, indent)

  if (body.startsWith('<!--')) {
    row.append(h('span', { class: 'comment' }, body))
  } else if (body.startsWith('<')) {
    const match = /^<(\/?)([\w-]*)([\s\S]*?)(\/?)>?$/.exec(body)
    if (!match) {
      row.append(h('span', { class: 'text' }, body))
    } else {
      const [, close, name, attrs, selfClose] = match
      row.append(h('span', { class: 'tag' }, `<${close}${name}`))
      for (const attr of attrs.matchAll(/\s+([^\s=>"']+)(?:=("[^"]*"|'[^']*'|[^\s>]+))?/g)) {
        if (attr[1] === 'data-rgaa-target') continue
        row.append(' ', h('span', { class: `attr${A11Y_ATTR.test(attr[1]) ? ' a11y' : ''}` }, attr[1]))
        if (attr[2] !== undefined) {
          const value = attr[2].length > 90 ? `${attr[2].slice(0, 87)}…"` : attr[2]
          row.append('=', h('span', { class: 'val' }, value))
        }
      }
      row.append(h('span', { class: 'tag' }, `${selfClose}>`))
    }
  } else {
    row.append(h('span', { class: 'text' }, body))
  }
  return row
}

function codeBlock(title: string, source: string, hint?: string): HTMLElement {
  const lines = formatHtml(source)
  const pre = h('pre', { class: 'code', tabIndex: 0, 'aria-label': title })
  pre.append(...lines.map(highlightLine))
  const copy = h(
    'button',
    {
      type: 'button',
      class: 'small-btn',
      onclick: async (event: Event) => {
        const btn = event.currentTarget as HTMLButtonElement
        await navigator.clipboard.writeText(source.replace(/\s*data-rgaa-target=""/g, ''))
        btn.textContent = 'Copied ✓'
        setTimeout(() => (btn.textContent = 'Copy'), 1500)
      },
    },
    'Copy',
  )
  return h(
    'div',
    { class: 'card' },
    h('div', { class: 'code-head' }, h('h3', {}, title), copy),
    pre,
    hint ? h('p', { class: 'hint-line' }, hint) : null,
  )
}

/* ------------------------------------------------------------------ */
/* Detail                                                              */
/* ------------------------------------------------------------------ */

function fact(label: string, value: string | null, opts: { missingIfNull?: boolean; emptyHint?: boolean } = {}): Node[] {
  let dd: HTMLElement
  if (value === null) dd = h('dd', { class: opts.missingIfNull ? 'missing' : '' }, opts.missingIfNull ? 'attribute missing' : '—')
  else if (value === '') dd = h('dd', { class: opts.emptyHint ? 'empty-val' : '' }, '"" (empty)')
  else dd = h('dd', {}, value)
  return [h('dt', {}, label), dd]
}

function nextToReview(from: Item): Item | undefined {
  const list = elements.filter((e) => needsReview(e) && e.id !== from.id)
  return list.find((e) => e.id > from.id) ?? list[0]
}

function renderDetail(): void {
  const scrollTop = detailEl.scrollTop
  const colScroll = [...detailEl.querySelectorAll('.col')].map((c) => c.scrollTop)
  const el = elements.find((e) => e.id === selectedId)
  detailEl.replaceChildren()
  if (!el) return
  const review = reviewOf(el)
  const index = elements.indexOf(el)

  const goto = (delta: number) => select(elements[index + delta].id, true)
  detailEl.append(
    h(
      'div',
      { class: 'detail-head' },
      h(
        'h2',
        {},
        `Image #${el.id} `,
        h('span', { class: `result ${statusOf(el)}`, id: 'result-badge' }, STATUS_LABEL[statusOf(el)]),
        h('span', { class: 'hint-line' }, `  ${index + 1} / ${elements.length}`),
      ),
      h(
        'div',
        { class: 'nav' },
        h('button', { type: 'button', onclick: () => focusOnPage(el.id, true) }, 'Locate on page'),
        h('button', { type: 'button', disabled: index === 0, onclick: () => goto(-1) }, '← Prev'),
        h('button', { type: 'button', disabled: index === elements.length - 1, onclick: () => goto(1) }, 'Next →'),
        h('button', { type: 'button', class: 'next-review', disabled: !nextToReview(el), onclick: () => { const n = nextToReview(el); if (n) select(n.id, true) } }, 'Next to review ⇥'),
      ),
    ),
  )

  const detected = detectedOf(el)
  const facts = h('dl', { class: 'facts' })
  facts.append(
    ...fact('Type', el.type),
    ...fact('Where', `${el.inDialog ? 'In a dialog / popin' : 'In the page'} · first seen in scan ${el.scan}${el.present ? '' : ' · not on the page now'}`),
    ...fact('Detected', `${DETECTED_LABEL[detected]}${el.ignoredBy ? ` — ${el.ignoredBy}` : ''}`),
    ...fact('Accessible name', el.accessibleName),
    ...(el.tag === 'img' || el.tag === 'input' || el.tag === 'area' ? fact('alt', el.alt, { missingIfNull: true, emptyHint: true }) : []),
    ...fact('aria-label', el.ariaLabel),
    ...fact('aria-labelledby', el.labelledByText),
    ...fact('title', el.title),
    ...(el.tag === 'svg' ? fact('<title>', el.svgTitle) : []),
    ...fact('role', el.role),
    ...fact('aria-hidden', el.ariaHidden ? 'true (self or parent)' : null),
    ...fact('In a link', el.isInsideLink ? `${el.linkHref ?? ''}${el.linkText ? ` — “${el.linkText}”` : ''}` : null),
    ...fact('Caption', el.figcaption),
    ...fact('Size', el.naturalWidth ? `${el.naturalWidth} × ${el.naturalHeight}px` : null),
    ...fact('File', el.src && !el.src.startsWith('data:') ? fileName(el.src) : null),
  )
  const cols = h('div', { class: 'cols' })
  const evidence = h('div', { class: 'col evidence' })
  const decision = h('div', { class: 'col decision' })
  cols.append(evidence, decision)
  evidence.append(
    h(
      'div',
      { class: 'card preview' },
      h('div', { class: 'preview-img' }, el.thumb ? h('img', { src: el.thumb, alt: `Preview of image ${el.id}` }) : h('span', { class: 'hint-line' }, `No preview for <${el.type}>`)),
      facts,
    ),
  )

  evidence.append(
    codeBlock('Image code', el.html),
    codeBlock('Context (parent markup)', el.contextHtml, 'Yellow line = the image. Orange attributes are the ones assistive technologies read.'),
  )

  const banner = problemBanner(el, review)
  if (banner) decision.append(banner)
  decision.append(renderKindPicker(el, review))
  const criteriaHost = h('div', { id: 'criteria' })
  decision.append(criteriaHost)
  renderCriteria(el, review, criteriaHost)

  decision.append(
    h(
      'div',
      { class: 'card' },
      h('h3', {}, 'Notes'),
      h('textarea', {
        'aria-label': `Notes for image ${el.id}`,
        placeholder: 'Why non-compliant, suggested alt text…',
        value: review.note,
        oninput: (event: Event) => {
          review.note = (event.target as HTMLTextAreaElement).value
          saveReviews()
        },
      }),
    ),
  )
  detailEl.append(cols)
  detailEl.scrollTop = scrollTop
  detailEl.querySelectorAll('.col').forEach((c, i) => (c.scrollTop = colScroll[i] ?? 0))
}

/** Shown on images that are neither hidden nor named: the failure depends on what the image is. */
function problemBanner(el: Item, review: ImageReview): HTMLElement | null {
  if (detectedOf(el) !== 'unnamed') return null
  const missingAlt = el.alt === null && ['img', 'input', 'area'].includes(el.tag)
  const t11 = testIdFor('1.1', el)
  const t12 = testIdFor('1.2', el)
  const apply = (kind: ImageKind, criterion: string, note: string) => () => {
    review.kind = kind
    review.auto = false
    review.answers[criterion] = 'nc'
    if (!review.note.trim()) review.note = note
    saveReviews()
    refreshAll()
    renderDetail()
  }
  return h(
    'div',
    { class: 'card problem', role: 'alert' },
    h('h3', {}, missingAlt ? 'Error: no alt attribute' : `Error: no accessible name on this <${el.type}>`),
    h(
      'p',
      {},
      missingAlt
        ? 'This image has no alt attribute and no other name, and it is not hidden from assistive tech. Screen readers may read the file name. alt is also required by HTML (code validity, RGAA 8.2).'
        : 'This image has no accessible name and is not hidden from assistive tech.',
    ),
    h(
      'p',
      { class: 'which' },
      'Which criterion fails depends on the image: ',
      h('strong', {}, `1.1${t11 ? ` (test ${t11})` : ''}`),
      ' if it is informative, ',
      h('strong', {}, `1.2${t12 ? ` (test ${t12})` : ''}`),
      ' if it is decorative.',
    ),
    h(
      'div',
      { class: 'problem-actions' },
      h('button', { type: 'button', onclick: apply('informative', '1.1', missingAlt ? 'Missing alt attribute: add a text alternative that conveys the information.' : 'No accessible name: add a text alternative.') }, 'It is informative → 1.1 Non-compliant'),
      h('button', { type: 'button', onclick: apply('decorative', '1.2', missingAlt ? 'Missing alt attribute: add alt="" (or aria-hidden) so assistive tech ignores this decorative image.' : 'Not hidden from assistive tech: add aria-hidden="true".') }, 'It is decorative → 1.2 Non-compliant'),
    ),
  )
}

function renderKindPicker(el: Item, review: ImageReview): HTMLElement {
  const name = `kind-${el.id}`
  const option = (value: ImageKind, label: string) => [
    h('input', {
      type: 'radio',
      name,
      id: `${name}-${value}`,
      value,
      checked: review.kind === value,
      onchange: () => {
        review.kind = value
        review.auto = false
        saveReviews()
        const host = $('criteria')
        renderCriteria(el, review, host)
        refreshAll()
      },
    }),
    h('label', { for: `${name}-${value}` }, label),
  ]
  return h(
    'div',
    { class: 'card' },
    h(
      'fieldset',
      {},
      h('legend', {}, h('h3', {}, 'What is this image?')),
      h('div', { class: 'segmented' }, ...option('informative', 'Informative'), ...option('decorative', 'Decorative')),
      suggestedKind(el)
        ? h('p', { class: 'hint-line' }, `Suggestion from the markup: ${suggestedKind(el)} (${DETECTED_LABEL[detectedOf(el)].toLowerCase()}).`)
        : h('p', { class: 'hint-line warn' }, 'No text alternative and not hidden: decide whether it is informative (→ missing alternative) or decorative (→ not ignored).'),
      h(
        'p',
        { class: 'hint-line' },
        'Informative: carries content or a function (logo, photo that illustrates, icon in a button…). Decorative: pure ornament that adds nothing.',
      ),
    ),
  )
}

function renderCriteria(el: Item, review: ImageReview, host: HTMLElement): void {
  host.replaceChildren()
  const applicable = criteriaFor(review.kind)
  if (!applicable.length) {
    host.append(h('p', { class: 'hint-line' }, 'Choose informative or decorative to see the RGAA criteria that apply.'))
    return
  }
  for (const criterion of applicable) host.append(criterionCard(el, review, criterion))
}

function criterionCard(el: Item, review: ImageReview, criterion: Criterion): HTMLElement {
  const hint = hintFor(criterion.id, el)
  const group = `crit-${el.id}-${criterion.id}`
  const card = h('div', { class: 'card criterion', 'data-state': review.answers[criterion.id] ?? '' })

  const verdict = (value: Verdict, label: string) => [
    h('input', {
      type: 'radio',
      name: group,
      id: `${group}-${value}`,
      value,
      checked: review.answers[criterion.id] === value,
      onclick: () => {
        review.answers[criterion.id] = value
        review.auto = false
        card.dataset.state = value
        card.querySelector('.prefill-note')?.remove()
        saveReviews()
        refreshAll()
      },
    }),
    h('label', { for: `${group}-${value}` }, label),
  ]

  card.append(
    h(
      'div',
      { class: 'criterion-head' },
      h('span', { class: 'crit-id' }, `RGAA ${criterion.id}`),
      h('span', { class: 'level', title: `WCAG level ${criterion.level}` }, `Level ${criterion.level}`),
      h('a', { class: 'crit-link', href: criterionUrl(criterion.id), target: '_blank', rel: 'noreferrer' }, 'Official tests ↗'),
    ),
    h('p', { class: 'question' }, criterion.question),
    h('p', { class: 'official' }, criterion.title),
    h('ul', { class: 'checks' }, ...criterion.checks.map((c) => h('li', {}, c))),
    ...(hint ? [h('p', { class: `hint ${hint.tone}` }, hint.text)] : []),
    ...(review.auto ? [h('p', { class: 'hint info prefill-note' }, 'Pre-filled from the markup (alt="", aria-hidden or role="presentation"). Click Compliant to confirm the image really is decorative, or change the answer if the developer made a mistake.')] : []),
    h(
      'fieldset',
      {},
      h('legend', { class: 'hint-line' }, `Verdict for criterion ${criterion.id}`),
      h('div', { class: 'verdicts' }, ...verdict('c', 'Compliant'), ...verdict('nc', 'Non-compliant'), ...verdict('na', 'Not applicable')),
    ),
  )
  return card
}

/* ------------------------------------------------------------------ */
/* Selection & refresh                                                 */
/* ------------------------------------------------------------------ */

function refreshAll(): void {
  const badge = document.getElementById('result-badge')
  const current = elements.find((e) => e.id === selectedId)
  if (badge && current) {
    badge.className = `result ${statusOf(current)}`
    badge.textContent = STATUS_LABEL[statusOf(current)]
  }
  renderStats()
  refreshListState()
  renderFilters()
}

function select(id: number, scroll: boolean): void {
  selectedId = id
  if (filter !== 'all' && !visibleElements().some((e) => e.id === id)) {
    filter = 'all'
    renderFilters()
    renderList()
  }
  refreshListState()
  renderDetail()
  focusOnPage(id, scroll)
  listEl.querySelector(`.item[data-id="${id}"]`)?.scrollIntoView({ block: 'nearest' })
}


/* ------------------------------------------------------------------ */
/* Pages of the sample (P01, P02…)                                      */
/* ------------------------------------------------------------------ */

const pageSelect = $<HTMLSelectElement>('page-select')
const liveUrlEl = $('live-url')
const deletePageBtn = $<HTMLButtonElement>('delete-page-btn')
const resetPageBtn = $<HTMLButtonElement>('reset-page-btn')
const navBanner = $('nav-banner')
const navBannerText = $('nav-banner-text')
const navBannerBtn = $<HTMLButtonElement>('nav-banner-btn')
const auditEl = $('audit')
const auditBtn = $<HTMLButtonElement>('audit-btn')
const sampleEl = $('sample')
const themeEl = $('theme-view')
const themebarEl = $('themebar')
const sampleBtn = $<HTMLButtonElement>('sample-btn')
const emptyTitle = $('empty-title')
const emptyText = $('empty-text')
const emptyAddBtn = $<HTMLButtonElement>('empty-add-btn')
const emptyGoBtn = $<HTMLButtonElement>('empty-go-btn')

const pad = (n: number) => String(n).padStart(2, '0')
/** P01, P02… follow the order of the sample, so reordering renumbers the pages. */
const pageLabel = (rec: PageRecord) => `P${pad(audit.pages.indexOf(rec) + 1)}`

function pageInput(rec: PageRecord): PageInput {
  const reviewOfRec = (el: ImageElementInfo) => rec.reviews[(el as Item).key]
  const computed = computeThemes(rec.items, reviewOfRec, rec.themes, rec.checklist, { findings: rec.findings, reviews: rec.findingReviews, scannedThemes: rec.scannedThemes })
  return {
    label: pageLabel(rec),
    results: computed.images,
    themes: computed.themes,
    checklist: rec.checklist,
    findings: rec.findings,
    findingReviews: rec.findingReviews,
    images: rec.items,
    reviewOf: reviewOfRec,
    detectedOf,
    pageUrl: rec.url,
    pageTitle: rec.title || rec.url,
  }
}

const allPageInputs = (): PageInput[] => audit.pages.map(pageInput)

function loadPage(rec: PageRecord | null): void {
  page = rec
  elements = rec ? rec.items : []
  reviews = rec ? rec.reviews : {}
  scanCount = rec ? rec.scanCount : 0
  selectedId = elements[0]?.id ?? null
  filter = 'all'
  audit.current = rec ? rec.id : null
  // Images of a page that was not scanned in this session are shown as they were last seen.
  if (rec && !scannedThisSession.has(rec.id)) for (const el of elements) el.present = true
}

function renderPageBar(): void {
  pageSelect.replaceChildren()
  if (!audit.pages.length) pageSelect.append(h('option', { value: '' }, 'No page yet — add page 1 in “Audit pages sample”'))
  for (const p of audit.pages) {
    const input = pageInput(p)
    const rate = rateOf(auditStats([input]).perPage[0].counts)
    pageSelect.append(
      h('option', { value: p.id, selected: p.id === page?.id }, `${pageLabel(p)} · ${p.title || p.url} · ${p.items.length} image(s)${rate === null ? '' : ` · ${rate} %`}`),
    )
  }
  pageSelect.disabled = !audit.pages.length
  deletePageBtn.disabled = !page
  resetPageBtn.disabled = !page
  const onLive = Boolean(page && liveUrl && normalizeUrl(page.url) === normalizeUrl(liveUrl))
  liveUrlEl.textContent = liveUrl ? `Browser: ${liveUrl}` : ''
  liveUrlEl.title = liveUrl
  liveUrlEl.className = `live-url${onLive ? ' same' : ''}`
  scanBtn.disabled = !page
  scanBtn.textContent = page ? `${scannedThisSession.has(page.id) ? 'Rescan' : 'Scan'} ${pageLabel(page)}` : 'Scan'
  scanBtn.title = page
    ? `Scan what the browser shows and merge the images into ${pageLabel(page)} (popins, tabs…)`
    : 'Add a page to the sample first'
}

function nextPageLabel(): string {
  return `P${pad(audit.pages.length + 1)}`
}

function renderAll(): void {
  renderPageBar()
  renderThemeBar()
  renderFilters()
  renderList()
  renderStats()
  renderDetail()
  setScanned()
  if (view === 'page') renderResults()
  if (view === 'audit') renderAudit()
  if (view === 'sample') renderSample()
}

/** Selects a page of the sample; with `navigate`, the browser tab goes to its URL too. */
function switchTo(id: string, navigate = false): void {
  const rec = audit.pages.find((p) => p.id === id)
  if (!rec) return
  if (rec !== page) loadPage(rec)
  setView(view === 'sample' || view === 'audit' ? 'review' : view)
  renderAll()
  persist()
  const label = pageLabel(rec)
  if (navigate && (!liveUrl || normalizeUrl(rec.url) !== normalizeUrl(liveUrl))) {
    goTo(rec.url)
    say(`Opening ${label} in the browser. Click “Scan ${label}” once it has loaded.`)
  } else {
    say(rec.items.length ? `Viewing ${label}.` : `${label} is registered but not scanned yet. Open it in the browser and click “Scan ${label}”.`)
  }
}

function goTo(url: string): void {
  chrome.devtools.inspectedWindow.eval(`location.href = ${JSON.stringify(url)}`)
}

async function removePage(rec: PageRecord | null = page): Promise<void> {
  if (!rec) return
  const label = pageLabel(rec)
  if (!(await askConfirm(`Remove ${label}?`, `${rec.title || rec.url}\n\nThe page and all its answers are deleted from the audit and the other pages are renumbered.`, 'Remove page'))) return
  audit.pages = audit.pages.filter((p) => p !== rec)
  scannedThisSession.delete(rec.id)
  if (page === rec) loadPage(audit.pages[0] ?? null)
  renderAll()
  persist()
  say(`${label} removed from the audit.`)
}

pageSelect.addEventListener('change', () => switchTo(pageSelect.value, true))
deletePageBtn.addEventListener('click', () => removePage())

function showNavBanner(url: string): void {
  const known = findPage(audit, url)
  if (known && known === page) return void (navBanner.hidden = true)
  if (known) {
    navBannerText.textContent = `The browser is now on ${pageLabel(known)} (${known.title || known.url}).`
    navBannerBtn.textContent = `Switch to ${pageLabel(known)}`
    navBannerBtn.onclick = () => {
      navBanner.hidden = true
      switchTo(known.id)
    }
  } else {
    navBannerText.textContent = 'This URL is not in the sample yet.'
    navBannerBtn.textContent = `Add it as ${nextPageLabel()}`
    navBannerBtn.onclick = () => {
      navBanner.hidden = true
      void addPage(url)
    }
  }
  navBanner.hidden = false
}

/* ------------------------------------------------------------------ */
/* Resets: one theme of a page, one page, the whole audit               */
/* ------------------------------------------------------------------ */

async function clearBoxes(themeNo?: number): Promise<void> {
  const payload = themeNo ? { type: 'RGAA_CLEAR_THEME', theme: themeNo } : { type: 'RGAA_CLEAR_HIGHLIGHTS' }
  await sendToPage(inspectedTabId(), payload).catch(() => undefined)
}

function resetThemeData(rec: PageRecord, n: number): void {
  if (n === 1) {
    rec.items.splice(0)
    for (const k of Object.keys(rec.reviews)) delete rec.reviews[k]
  }
  if (FINDING_THEMES.has(n)) {
    for (const f of rec.findings.filter((x) => x.theme === n)) delete rec.findingReviews[f.key]
    rec.findings = rec.findings.filter((x) => x.theme !== n)
  }
  for (const c of themeByNumber(n)?.criteria ?? []) delete rec.checklist[c.id]
  rec.scannedThemes = rec.scannedThemes.filter((t) => t !== n)
  scannedThisSession.delete(rec.id)
}

async function resetTheme(n = theme): Promise<void> {
  if (!page) return
  const rec = page
  const name = THEME_LABEL[n]
  if (!(await askConfirm(`Reset ${name} on ${pageLabel(rec)}?`, `This removes what was scanned and every answer for this theme only. The other themes and the page itself are kept.`, `Reset ${name}`))) return
  resetThemeData(rec, n)
  findingSel = null
  loadPage(rec)
  void clearBoxes(n)
  renderAll()
  persist()
  say(`${name} reset on ${pageLabel(rec)}.`)
}

async function resetPage(rec: PageRecord | null = page): Promise<void> {
  if (!rec) return
  const label = pageLabel(rec)
  if (!(await askConfirm(`Reset ${label}?`, `${rec.title || rec.url}\n\nThis clears its scans and every answer, in all themes. Its URL, title and chosen themes are kept.`, 'Reset page'))) return
  for (const n of THEMES.map((t) => t.number)) resetThemeData(rec, n)
  rec.scanCount = 0
  rec.nextId = 1
  rec.nextFindingId = 1
  rec.nextFindingIds = {}
  rec.updatedAt = Date.now()
  findingSel = null
  if (rec === page) {
    loadPage(rec)
    void clearBoxes()
  }
  renderAll()
  persist()
  say(`${label} reset. Scan it again when you are ready.`)
}

async function resetAudit(): Promise<void> {
  if (!(await askConfirm('Reset the whole audit?', `This deletes all ${audit.pages.length} page(s), their scans and answers, and the site, auditor and context fields. It cannot be undone.`, 'Delete everything'))) return
  audit = emptyAudit()
  scannedThisSession.clear()
  findingSel = null
  theme = 1
  loadPage(null)
  void clearBoxes()
  setView('review')
  renderAll()
  persist()
  say('The audit was reset. Add the first page of your sample to start again.')
}

resetPageBtn.addEventListener('click', () => resetPage())

/* ------------------------------------------------------------------ */
/* Views: review | page results | audit overview                        */
/* ------------------------------------------------------------------ */

type View = 'review' | 'page' | 'audit' | 'sample'
let view: View = 'review'

function setView(next: View): void {
  view = next
  resultsEl.hidden = next !== 'page'
  auditEl.hidden = next !== 'audit'
  sampleEl.hidden = next !== 'sample'
  const imagesTheme = theme === 1
  appEl.hidden = next !== 'review' || !imagesTheme || !elements.length
  emptyEl.hidden = next !== 'review' || !imagesTheme || elements.length > 0
  themeEl.hidden = next !== 'review' || imagesTheme
  themebarEl.hidden = !page
  updateTools()
  resultsBtn.setAttribute('aria-pressed', String(next === 'page'))
  auditBtn.setAttribute('aria-pressed', String(next === 'audit'))
  sampleBtn.setAttribute('aria-pressed', String(next === 'sample'))
  if (next === 'review') {
    renderSummaries()
    renderEmpty()
    if (!imagesTheme) renderThemeView()
  }
  if (next === 'page') renderResults()
  if (next === 'audit') renderAudit()
  if (next === 'sample') renderSample()
}


function setScanned(): void {
  const has = elements.length > 0
  clearBtn.disabled = !has && !(page?.findings.length)
  boxesBtn.disabled = !has && !(page?.findings.length)
  resultsBtn.disabled = !has
  auditBtn.disabled = !audit.pages.length
  scanBtn.disabled = !page
  setView(view === 'page' && !has ? 'review' : view)
}

/* ------------------------------------------------------------------ */
/* Themes: which RGAA themes are audited on a page                      */
/* ------------------------------------------------------------------ */

/** Share of a theme's criteria that have an answer (criteria this tool cannot assess count as done). */
function themeProgress(rec: PageRecord, n: number): { done: number; total: number } {
  const t = pageInput(rec).themes.find((x) => x.number === n)
  const total = t?.criteria.length ?? 0
  const pending = t?.criteria.filter((c) => c.outcome === 'pending').length ?? 0
  return { done: total - pending, total }
}

function setThemes(rec: PageRecord, themes: number[]): void {
  rec.themes = [...new Set(themes)].sort((a, b) => a - b)
  if (rec === page && !rec.themes.includes(theme)) theme = rec.themes[0] ?? 1
  persist()
  // keep the menu open while ticking several themes
  if (view === 'sample') {
    renderPageBar()
    renderThemeBar()
    return
  }
  const open = document.querySelector<HTMLDetailsElement>('.themebar .themes-menu')?.open
  renderAll()
  if (open) document.querySelector<HTMLDetailsElement>('.themebar .themes-menu')?.setAttribute('open', '')
}

/** A drop-down with one checkbox per RGAA theme. */
function themesMenu(rec: PageRecord): HTMLElement {
  const box = h('details', { class: 'themes-menu' }, h('summary', {}, `Themes (${rec.themes.length})`))
  const list = h('div', { class: 'menu', role: 'group', 'aria-label': `Themes audited on ${pageLabel(rec)}` })
  for (const t of THEMES) {
    list.append(
      h(
        'label',
        { class: 'menu-item' },
        h('input', {
          type: 'checkbox',
          checked: rec.themes.includes(t.number),
          onchange: (e: Event) => {
            const on = (e.target as HTMLInputElement).checked
            if (!on && rec.themes.length === 1) {
              ;(e.target as HTMLInputElement).checked = true
              return void say('Keep at least one theme.')
            }
            setThemes(rec, on ? [...rec.themes, t.number] : rec.themes.filter((n) => n !== t.number))
          },
        }),
        h('span', {}, `${t.number}. ${THEME_LABEL[t.number]}`),
        h('span', { class: 'menu-kind' }, SCANNED_THEMES.has(t.number) ? 'scan + review' : `${t.criteria.length} criteria`),
      ),
    )
  }
  list.append(
    h(
      'div',
      { class: 'menu-actions' },
      h('button', { type: 'button', class: 'img-ref', onclick: () => setThemes(rec, THEMES.map((t) => t.number)) }, 'All 13'),
      h('button', { type: 'button', class: 'img-ref', onclick: () => setThemes(rec, [1]) }, 'Images only'),
    ),
  )
  box.append(list)
  return box
}

function renderThemeBar(): void {
  document.documentElement.style.setProperty('--tc', colorOf(theme))
  themebarEl.replaceChildren()
  if (!page) return
  const rec = page
  const selected = [...rec.themes].sort((a, b) => a - b)
  if (!selected.includes(theme)) theme = selected[0] ?? 1
  const tabs = h('div', { class: 'theme-tabs', role: 'tablist', 'aria-label': 'RGAA themes of this page' })
  for (const n of selected) {
    const { done, total } = themeProgress(rec, n)
    tabs.append(
      h(
        'button',
        {
          type: 'button',
          role: 'tab',
          class: `theme-tab${done === total ? ' complete' : ''}`,
          'aria-selected': String(n === theme),
          style: `--tc:${colorOf(n)}`,
          title: `${n}. ${THEME_LABEL[n]} (its boxes on the page use this colour)`,
          onclick: () => {
            theme = n
            findingFilter = 'all'
            setView('review')
            renderThemeBar()
            renderStats()
          },
        },
        h('span', { class: 'tn' }, String(n)),
        ` ${THEME_LABEL[n]} `,
        h('span', { class: 'tp' }, `${done}/${total}`),
      ),
    )
  }
  themebarEl.append(
    tabs,
    h('button', { type: 'button', class: 'ghost-btn danger', title: `Clear the scan and the answers of ${THEME_LABEL[theme]} on this page only`, onclick: () => resetTheme() }, `Reset ${THEME_LABEL[theme]}`),
    themesMenu(rec),
  )
}

/** Checklist themes: one card per official criterion with a verdict and a note. */
function perFindingIds(): string[] {
  return findingCriterionIds(theme)
}

function renderChecklist(host: HTMLElement = themeEl): void {
  const def = themeByNumber(theme)
  if (!page || !def) return
  const rec = page
  const result = pageInput(rec).themes.find((t) => t.number === theme)!
  const autoLabel = { auto: 'Automatic', semi: 'Semi-automatic', manual: 'Manual' } as const

  host.append(
    h(
      'div',
      { class: 'results-head' },
      h(
        'div',
        {},
        h('h2', {}, FINDING_THEMES.has(theme) ? 'Other criteria of this theme' : `${def.number}. ${def.name}`),
        ...(FINDING_THEMES.has(theme) ? [] : [h('div', { class: 'theme-summary', 'data-theme': String(theme), 'aria-label': 'Totals' })]),
        h('p', { class: 'hint-line' }, FINDING_THEMES.has(theme) ? `Criteria ${def.criteria.filter((x) => !perFindingIds().includes(x.id)).map((x) => x.id).join(', ')} are not detectable by a script: check them on ${rec.url}.` : `${def.criteria.length} criteria. Check them on ${rec.url} and answer each one. Nothing to scan for this theme.`),
      ),
    ),
  )
  const list = h('div', { class: 'checklist' })
  const perFinding = findingCriterionIds(theme)
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
          answer.verdict = value
          card.dataset.state = value
          persist()
          renderThemeBar()
          renderStats()
          renderPageBar()
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
        h('a', { class: 'crit-link', href: `https://accessibilite.numerique.gouv.fr/methode/criteres-et-tests/#${c.id}`, target: '_blank', rel: 'noreferrer' }, 'Official tests ↗'),
      ),
      h('p', { class: 'question' }, c.title.replace(/`/g, '')),
      h('p', { class: 'hint info' }, c.note),
      h(
        'details',
        { class: 'tests-detail' },
        h('summary', {}, `${c.tests.length} test(s)`),
        h(
          'ul',
          { class: 'checks' },
          ...c.tests.map((t) => h('li', {}, h('strong', {}, `${t.id} `), t.text.replace(/`/g, ''), ...(t.conditions.length ? [h('ul', {}, ...t.conditions.map((x) => h('li', {}, x.replace(/`/g, ''))))] : []))),
        ),
      ),
      h('fieldset', {}, h('legend', { class: 'hint-line' }, `Verdict for criterion ${c.id}`), h('div', { class: 'verdicts' }, ...verdict('c', 'Compliant'), ...verdict('nc', 'Non-compliant'), ...verdict('na', 'Not applicable'))),
      h('textarea', {
        'aria-label': `Notes for criterion ${c.id}`,
        placeholder: 'What to fix, where, evidence…',
        value: answer.note,
        oninput: (e: Event) => { answer.note = (e.target as HTMLTextAreaElement).value; persist() },
      }),
    )
    if (outcome === 'pending') card.classList.add('todo')
    list.append(card)
  }
  host.append(list)
}

/* ------------------------------------------------------------------ */
/* Frames (2) and colours (3): scanned, reviewed finding by finding      */
/* ------------------------------------------------------------------ */

let findingSel: number | null = null

const toolsEl = $('tools')
const imagesHeadEl = $('images-head')

/** Buttons that act on the boxes of the current theme live in that theme's own toolbar. */
function updateTools(): void {
  void applyBoxes()
  const reviewing = Boolean(page) && view === 'review'
  imagesHeadEl.hidden = !(reviewing && theme === 1)
  // the toolbar belongs to the theme being shown: Images has its header, the other themes put it in theirs
  if (theme === 1) imagesHeadEl.append(toolsEl)
  toolsEl.hidden = !(reviewing && SCANNED_THEMES.has(theme))
}

function keyOfFinding(theme: number, f: RawFinding): string {
  return theme === 2 ? `2|${f.type}|${f.facts.src ?? ''}|${hash(f.contextHtml)}` : `3|${f.type}|${f.label}|${f.facts['Font size'] ?? ''}`
}

/** Merges the scan of one theme into the current page; returns the renumbering for the boxes. */
function mergeFindings(themeNo: number, raw: RawFinding[]): { map: { from: number; to: number }[]; added: number } {
  const rec = page!
  // Findings from the first versions (colours grouped by colour pair) are replaced by one finding per element.
  if (themeNo === 3) {
    for (const f of rec.findings.filter((x) => x.theme === 3 && x.type !== 'contrast-ok' && !x.label.startsWith('“'))) delete rec.findingReviews[f.key]
    rec.findings = rec.findings.filter((x) => x.theme !== 3 || x.type === 'contrast-ok' || x.label.startsWith('“'))
  }
  if (themeNo === 3) {
    // Older audits numbered the “passing text” line #1: it is now unnumbered (0) and the problems run 1, 2, 3…
    const mine = rec.findings.filter((x) => x.theme === 3)
    for (const f of mine) if (f.type === 'contrast-ok') f.id = 0
    mine.filter((x) => x.type !== 'contrast-ok').sort((a, b) => a.id - b.id).forEach((f, i) => (f.id = i + 1))
  }
  const byKey = new Map(rec.findings.filter((f) => f.theme === themeNo).map((f) => [f.key, f]))
  const seen = new Set<string>()
  const occurrences = new Map<string, number>()
  const map: { from: number; to: number }[] = []
  let added = 0
  for (const r of raw) {
    const base = keyOfFinding(themeNo, r)
    const n = occurrences.get(base) ?? 0
    occurrences.set(base, n + 1)
    const key = n ? `${base}~${n}` : base
    seen.add(key)
    const existing = byKey.get(key)
    if (existing) {
      Object.assign(existing, r, { id: existing.id, key, theme: themeNo, present: true, scan: existing.scan })
      map.push({ from: r.id, to: existing.id })
    } else {
      const item: FindingItem = { ...r, id: r.type === 'contrast-ok' ? 0 : nextFindingNumber(rec, themeNo), theme: themeNo, key, present: true, scan: scanCount }
      rec.findings.push(item)
      byKey.set(key, item)
      map.push({ from: r.id, to: item.id })
      added++
    }
  }
  for (const f of rec.findings) if (f.theme === themeNo && !seen.has(f.key)) f.present = false
  // A finding that is gone and was never touched by a human only adds noise (and gaps in the numbering).
  const worked = (f: FindingItem) => {
    const r = rec.findingReviews[f.key]
    return Boolean(r && (r.note.trim() || (!r.auto && Object.keys(r.answers).length)))
  }
  for (const f of rec.findings.filter((x) => x.theme === themeNo && !x.present && !worked(x))) delete rec.findingReviews[f.key]
  rec.findings = rec.findings.filter((x) => x.theme !== themeNo || x.present || worked(x))
  // default verdicts from the markup, only where nothing was answered yet
  for (const f of rec.findings) {
    if (f.theme !== themeNo || !f.present) continue
    const review = (rec.findingReviews[f.key] ??= { answers: {}, note: '' })
    let filled = false
    for (const [c, v] of Object.entries(suggestFinding(f))) {
      if (review.answers[c] === undefined) {
        review.answers[c] = v
        filled = true
      }
    }
    if (f.type === 'contrast-fail' && !review.note.trim()) applyContrastVerdict(f, review, false)
    if (filled) review.auto = true
  }
  rec.findings.sort((a, b) => a.theme - b.theme || a.id - b.id)
  if (!rec.scannedThemes.includes(themeNo)) rec.scannedThemes.push(themeNo)
  return { map, added }
}

function removeFinding(f: FindingItem): void {
  const rec = page
  if (!rec) return
  rec.findings = rec.findings.filter((x) => x !== f)
  delete rec.findingReviews[f.key]
  findingSel = null
  persist()
  renderAll()
  say(`Finding #${f.id} removed from the audit.`)
}

/** Next number of a theme: one more than the highest still in use, so numbering stays 1, 2, 3… */
function nextFindingNumber(rec: PageRecord, themeNo: number): number {
  const used = Math.max(0, ...rec.findings.filter((f) => f.theme === themeNo).map((f) => f.id))
  return used + 1
}

function findingReview(f: FindingItem): ImageReview {
  return (page!.findingReviews[f.key] ??= { answers: {}, note: '' })
}

type FStatus = 'todo' | 'progress' | 'c' | 'nc'
function findingStatus(f: FindingItem): FStatus {
  const answers = (FINDING_CRITERIA[f.theme] ?? []).map((c) => page!.findingReviews[f.key]?.answers[c.id])
  if (answers.includes('nc')) return 'nc'
  if (answers.every((a) => a === undefined)) return 'todo'
  return answers.some((a) => a === undefined) ? 'progress' : 'c'
}

const focusFinding = (f: FindingItem, scroll: boolean) => {
  if (scroll && f.type === 'contrast-ok') say('This line stands for every text that passes: there is nothing to show on the page.')
  return focusOnPage(f.id, scroll, f.theme)
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** Crops a screenshot of the page to one element, small enough to live in the audit and in the Excel file. */
function cropShot(dataUrl: string, loc: { rect: { x: number; y: number; w: number; h: number }; vw: number }): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const k = img.naturalWidth / loc.vw
      const pad = 8
      const x = Math.max(0, (loc.rect.x - pad) * k)
      const y = Math.max(0, (loc.rect.y - pad) * k)
      const w = Math.min(img.naturalWidth - x, (loc.rect.w + pad * 2) * k)
      const h = Math.min(img.naturalHeight - y, (loc.rect.h + pad * 2) * k)
      if (w < 4 || h < 4) return resolve(null)
      const scale = Math.min(1, 280 / w, 140 / h)
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(w * scale))
      canvas.height = Math.max(1, Math.round(h * scale))
      canvas.getContext('2d')!.drawImage(img, x, y, w, h, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => resolve(null)
    img.src = dataUrl
  })
}

/**
 * Takes a small picture of each finding: scroll it to the middle of the screen, photograph the tab,
 * crop. The boxes are hidden meanwhile so they are not in the pictures, and the scroll position is restored.
 */
async function captureShots(list: FindingItem[]): Promise<number> {
  if (!list.length) return 0
  const tabId = inspectedTabId()
  let done = 0
  try {
    await sendToPage(tabId, { type: 'RGAA_OVERLAY', visibility: { 1: false, 2: false, 3: false } })
    for (const f of list) {
      say(`Taking previews… ${done}/${list.length}`)
      const loc = await sendToPage(tabId, { type: 'RGAA_LOCATE', theme: f.theme, id: f.id }).catch(() => null)
      if (!loc?.rect) continue
      await sleep(180)
      const cap = await chrome.runtime.sendMessage({ type: 'RGAA_CAPTURE', tabId })
      if (!cap?.dataUrl) {
        say(`Could not take previews (${cap?.error ?? 'no screenshot'}). Check that the extension may access this site.`)
        break
      }
      f.shot = await cropShot(cap.dataUrl, loc)
      if (f.shot) done++
    }
  } finally {
    await sendToPage(tabId, { type: 'RGAA_SCROLL_RESTORE' }).catch(() => undefined)
    await applyBoxes()
  }
  return done
}

/** What the list shows: every finding, except the unnumbered “text that passes” line of Colours. */
const listedFindings = (themeNo: number): FindingItem[] => (page?.findings ?? []).filter((f) => f.theme === themeNo && f.type !== 'contrast-ok')

type FindingFilter = 'all' | 'review' | 'contrast-fail' | 'contrast-unknown'
let findingFilter: FindingFilter = 'all'

/**
 * Needs a human: colours that failed or that the script could not judge, until the verdict is confirmed
 * (a pre-filled verdict does not count as confirmed). Frames: any criterion unanswered or still pre-filled.
 */
function findingNeedsReview(f: FindingItem): boolean {
  const r = page?.findingReviews[f.key]
  if (f.theme === 3) {
    if (f.type !== 'contrast-fail' && f.type !== 'contrast-unknown') return false
    return !(r && r.answers['3.2'] !== undefined && !r.auto)
  }
  const ids = (FINDING_CRITERIA[f.theme] ?? []).map((c) => c.id)
  return ids.some((c) => r?.answers[c] === undefined) || Boolean(r?.auto)
}

function findingMatches(f: FindingItem, value: FindingFilter): boolean {
  if (value === 'all') return true
  if (value === 'review') return findingNeedsReview(f)
  return f.type === value
}

function updateFindingChips(): void {
  if (!page) return
  const list = listedFindings(theme)
  for (const chip of themeEl.querySelectorAll<HTMLElement>('.finding-pane .chip[data-value]')) {
    const value = chip.dataset.value as FindingFilter
    const count = chip.querySelector('.count')
    if (count) count.textContent = String(list.filter((f) => findingMatches(f, value)).length)
  }
}

function renderThemeView(): void {
  themeEl.replaceChildren()
  if (FINDING_THEMES.has(theme)) renderFindingsView()
  else renderChecklist()
  renderSummaries()
}

function renderFindingsView(): void {
  const def = themeByNumber(theme)
  if (!page || !def) return
  const rec = page
  const list = listedFindings(theme)
  const passing = rec.findings.find((f) => f.theme === 3 && f.type === 'contrast-ok')
  const scanned = rec.scannedThemes.includes(theme)
  const label = pageLabel(rec)
  const noun = theme === 2 ? 'frames' : 'text colours'
  themeEl.append(
    h(
      'div',
      { class: 'results-head' },
      h(
        'div',
        {},
        h('h2', {}, `${def.number}. ${def.name}`),
        h('p', { class: 'hint-line' }, theme === 2 ? 'Every iframe / frame of the page, with its title.' : 'Only the texts that fail or that a script cannot judge are numbered and boxed on the page. Criteria 3.1 and 3.3 need your eyes (below).'),
        h('div', { class: 'theme-summary', 'data-theme': String(theme), 'aria-label': 'Totals' }),
      ),
      h('div', { class: 'nav' }, toolsEl),
    ),
  )
  if (!scanned) {
    themeEl.append(h('p', { class: 'hint-line' }, `Not scanned yet. Open ${rec.url} in the browser and click “Scan ${label}”.`))
  } else if (!list.length) {
    themeEl.append(h('p', { class: 'hint-line' }, theme === 3 && passing ? `No text with a contrast problem found: ${passing.summary}.` : `No ${noun} found on the page at the last scan: criteria are not applicable.`))
  } else {
    const options: [FindingFilter, string][] =
      theme === 3
        ? [['all', 'All'], ['review', 'To review'], ['contrast-fail', 'Fail'], ['contrast-unknown', 'Check by eye']]
        : [['all', 'All'], ['review', 'To review']]
    if (!options.some(([v]) => v === findingFilter)) findingFilter = 'all'
    const shown = list.filter((f) => findingMatches(f, findingFilter))
    if (!shown.some((f) => f.id === findingSel)) findingSel = shown[0]?.id ?? null
    const chips = h('div', { class: 'filters', role: 'group', 'aria-label': 'Filter findings' })
    for (const [value, text] of options) {
      const n = list.filter((f) => findingMatches(f, value)).length
      chips.append(
        h(
          'button',
          { type: 'button', class: 'chip', 'data-value': value, 'aria-pressed': String(findingFilter === value), onclick: () => { findingFilter = value; renderThemeView(); void syncFilterBoxes() } },
          `${text} `,
          h('span', { class: 'count' }, String(n)),
        ),
      )
    }
    const listEl2 = h('ol', { class: 'finding-list' })
    for (const f of shown) {
      const st = findingStatus(f)
      const bad = f.type === 'contrast-fail' || (f.type !== 'contrast-ok' && f.type !== 'contrast-unknown' && f.facts.title === null)
      listEl2.append(
        h(
          'li',
          {},
          h(
            'button',
            {
              type: 'button',
              class: `item finding${f.present ? '' : ' absent'}`,
              'data-fid': f.id,
              'aria-current': String(f.id === findingSel),
              onclick: () => {
                findingSel = f.id
                renderThemeView()
                void focusFinding(f, true)
              },
              onmouseenter: () => void focusFinding(f, false),
            },
            f.shot ? h('img', { class: 'shot', src: f.shot, alt: '' }) : null,
            h('span', { class: 'num' }, `#${f.id}`),
            h('span', { class: 'main' }, h('span', { class: `alt${bad ? ' missing' : ''}` }, f.label, f.data.humanNeeded ? h('span', { class: 'type error' }, 'check by eye') : null), h('span', { class: 'alt' }, f.summary)),
            h('span', { class: `dot ${st === 'todo' ? '' : st}`, role: 'img', 'aria-label': STATUS_LABEL[st], title: STATUS_LABEL[st] }),
          ),
        ),
      )
    }
    const f = list.find((x) => x.id === findingSel)
    themeEl.append(h('div', { class: 'finding-layout' }, h('nav', { class: 'finding-pane', 'aria-label': `${def.name} findings` }, chips, ...(theme === 3 && passing ? [h('p', { class: 'hint-line' }, `Not listed — ${passing.summary} pass.`)] : []), listEl2), f ? findingDetail(f) : h('p', { class: 'hint-line' }, 'Nothing in this category.')))
  }
  if (theme === 3) {
    const rest = h('div', { class: 'theme-rest' })
    renderChecklist(rest)
    themeEl.append(rest)
  }
}

function findingDetail(f: FindingItem): HTMLElement {
  const review = findingReview(f)
  const facts = h('dl', { class: 'facts' })
  for (const [k, v] of Object.entries(f.facts)) {
    facts.append(h('dt', {}, k), h('dd', { class: v === null ? 'missing' : '' }, v === null ? '—' : v))
  }
  const cards = FINDING_CRITERIA[f.theme].map((c) => findingCard(f, review, c))
  if (f.theme === 3 && f.type !== 'contrast-ok') cards.unshift(contrastChecker(f, review))
  const evidence = h(
    'div',
    { class: 'col evidence' },
    h(
      'div',
      { class: 'card' },
      h('h3', {}, `#${f.id} — ${f.label}`),
      ...(f.shot ? [h('img', { class: 'shot-large', src: f.shot, alt: `Preview of finding ${f.id}` })] : []),
      facts,
      ...(f.present
        ? []
        : [
            h('p', { class: 'hint warn' }, 'Not found at the last scan (hidden, removed or changed). It still counts in the audit until you remove it.'),
            h('button', { type: 'button', class: 'img-ref nc', onclick: () => removeFinding(f) }, 'Remove from the audit'),
          ]),
    ),
  )
  if (f.html) evidence.append(codeBlock('Markup', f.html), codeBlock('Context (parent markup)', f.contextHtml, 'Yellow line = the element.'))
  const decision = h(
    'div',
    { class: 'col decision' },
    ...cards,
    h('div', { class: 'card' }, h('h3', {}, 'Notes'), h('textarea', {
      id: `fnd-note-${f.id}`,
      'aria-label': `Notes for finding ${f.id}`,
      placeholder: 'What to fix, where…',
      value: review.note,
      oninput: (e: Event) => { review.note = (e.target as HTMLTextAreaElement).value; persist() },
    })),
  )
  return h('section', { class: 'finding-detail', 'aria-label': `Finding ${f.id}` }, h('div', { class: 'cols' }, evidence, decision))
}

/** Reads a colour on the page: the page shows a magnifier with the hex, and sends back the colour you click. */
async function pickColorFromPage(): Promise<string | null> {
  say('Move over the page and click the colour (Esc to cancel). The magnifier shows its hex.')
  try {
    const r = await sendToPage(inspectedTabId(), { type: 'RGAA_PICK_START' })
    if (typeof r.hex === 'string') {
      say(`Picked ${r.hex}.`)
      return r.hex
    }
    say(r.error ? `Could not take a screenshot (${r.error}). Check that the extension may access this site.` : 'Colour pick cancelled.')
  } catch (err) {
    say('Could not pick a colour: reload the tab and try again.')
    console.error(err)
  }
  return null
}

/** The ratio of a contrast finding, from the colours checked by hand or else the ones the script read. */
function contrastOutcome(f: FindingItem, review: ImageReview) {
  const fgHex = review.fg ?? (typeof f.data.fg === 'string' ? f.data.fg : '')
  const bgHex = review.bg ?? (typeof f.data.bg === 'string' ? f.data.bg : '')
  const fg = parseHex(fgHex)
  const bg = parseHex(bgHex)
  if (!fg || !bg) return null
  const threshold = typeof f.data.threshold === 'number' ? f.data.threshold : f.data.large === true ? 3 : 4.5
  const ratio = contrastRatio(fg, bg)
  return { ratio, threshold, ok: ratio >= threshold, fg: toHex(fg), bg: toHex(bg), large: f.data.large === true }
}

/**
 * Compliant when the ratio passes; non-compliant, with the problem written in the notes, when it does not.
 * The note is only replaced when it is empty or was written by this checker.
 */
function applyContrastVerdict(f: FindingItem, review: ImageReview, setVerdict: boolean): void {
  const out = contrastOutcome(f, review)
  if (!out) return
  if (setVerdict) {
    review.answers['3.2'] = out.ok ? 'c' : 'nc'
    review.auto = false
  }
  const mine = !review.note.trim() || review.note === review.autoNote
  if (!mine) return
  if (out.ok) {
    review.note = ''
    delete review.autoNote
  } else {
    review.note = `Contrast too low: text ${out.fg} on ${out.bg} = ${out.ratio.toFixed(2)}:1, ${out.large ? 'large' : 'normal'} text needs ${out.threshold}:1.`
    review.autoNote = review.note
  }
}

/** Brings the verdict buttons, the note and the status dot of an open finding in line with its review. */
function syncContrastUI(f: FindingItem, review: ImageReview): void {
  for (const v of ['c', 'nc', 'na'] as const) {
    const radio = document.getElementById(`fnd-${f.id}-3.2-${v}`) as HTMLInputElement | null
    if (!radio) continue
    radio.checked = review.answers['3.2'] === v
    const card = radio.closest<HTMLElement>('.criterion')
    if (card) {
      card.dataset.state = review.answers['3.2'] ?? ''
      card.querySelector('.prefill-note')?.remove()
    }
  }
  const note = document.getElementById(`fnd-note-${f.id}`) as HTMLTextAreaElement | null
  if (note) note.value = review.note
  const dot = themeEl.querySelector(`.item.finding[data-fid="${f.id}"] .dot`) as HTMLElement | null
  if (dot) dot.className = `dot ${findingStatus(f) === 'todo' ? '' : findingStatus(f)}`
  renderThemeBar()
  renderStats()
  renderPageBar()
  updateFindingChips()
}

/** Text and background colours of a contrast finding: read by the script, editable, pickable on the page. */
function contrastChecker(f: FindingItem, review: ImageReview): HTMLElement {
  const scriptFg = typeof f.data.fg === 'string' ? f.data.fg : ''
  const scriptBg = typeof f.data.bg === 'string' ? f.data.bg : ''
  const threshold = typeof f.data.threshold === 'number' ? f.data.threshold : f.data.large === true ? 3 : 4.5
  const card = h('div', { class: 'card contrast-checker' })
  const result = h('p', { class: 'hint info' })

  const update = () => {
    const fg = parseHex(review.fg ?? scriptFg)
    const bg = parseHex(review.bg ?? scriptBg)
    if (!fg || !bg) {
      result.className = 'hint info'
      result.textContent = `Fill the ${!fg && !bg ? 'text and background colours' : !fg ? 'text colour' : 'background colour'}: use “Pick on page”, or type a hex value.`
      return
    }
    const ratio = contrastRatio(fg, bg)
    const ok = ratio >= threshold
    result.className = `hint ${ok ? 'ok' : 'warn'}`
    result.textContent = `${ratio.toFixed(2)}:1 — ${ok ? 'passes: marked Compliant' : 'fails: marked Non-compliant, problem written in the notes'} (needs ${threshold}:1).`
  }

  const row = (label: string, key: 'fg' | 'bg', scripted: string) => {
    const input = h('input', { type: 'text', class: 'hex', value: review[key] ?? scripted, placeholder: '#RRGGBB', 'aria-label': `${label} colour (hex)`, spellcheck: false })
    const swatch = h('span', { class: 'swatch', role: 'img', 'aria-label': `${label} colour preview` })
    const source = h('span', { class: 'hint-line' })
    const refresh = () => {
      const c = parseHex(input.value)
      swatch.style.background = c ? toHex(c) : 'repeating-conic-gradient(#ccc 0 25%, #fff 0 50%) 0 0 / 10px 10px'
      source.textContent = review[key] ? 'set by hand' : scripted ? 'read from the page' : 'not found: pick it'
    }
    const set = (value: string | undefined) => {
      if (value === undefined || value === scripted) delete review[key]
      else review[key] = value
      refresh()
      update()
      applyContrastVerdict(f, review, true)
      persist()
      syncContrastUI(f, review)
    }
    input.addEventListener('input', () => {
      const c = parseHex(input.value)
      if (c) set(toHex(c))
      else {
        swatch.style.background = ''
        result.className = 'hint info'
        result.textContent = 'Type a hex colour like #1A2B3C.'
      }
    })
    const pick = h('button', { type: 'button', class: 'img-ref', onclick: async () => {
      const hexValue = await pickColorFromPage()
      if (!hexValue) return
      input.value = hexValue
      set(hexValue)
    } }, 'Pick on page')
    const reset = scripted ? h('button', { type: 'button', class: 'img-ref', onclick: () => { input.value = scripted; set(undefined) } }, 'Reset') : null
    refresh()
    return h('div', { class: 'color-row' }, h('span', { class: 'color-label' }, label), swatch, input, pick, reset, source)
  }

  card.append(
    h('h3', {}, 'Contrast checker'),
    h('p', { class: 'hint-line' }, 'Click “Pick on page”, then click right next to the text (for the background) or on a letter stroke (for the text).'),
    row('Text', 'fg', scriptFg),
    row('Background', 'bg', scriptBg),
    result,
  )
  update()
  return card
}

function findingCard(f: FindingItem, review: ImageReview, c: FindingCriterion): HTMLElement {
  const hint = hintForFinding(f, c.id)
  const group = `fnd-${f.id}-${c.id}`
  const card = h('div', { class: 'card criterion', 'data-state': review.answers[c.id] ?? '' })
  const verdict = (value: Verdict, text: string) => [
    h('input', {
      type: 'radio',
      name: group,
      id: `${group}-${value}`,
      value,
      checked: review.answers[c.id] === value,
      onclick: () => {
        review.answers[c.id] = value
        review.auto = false
        card.dataset.state = value
        card.querySelector('.prefill-note')?.remove()
        persist()
        renderThemeBar()
        renderStats()
        renderPageBar()
        const dot = themeEl.querySelector(`.item.finding[data-fid="${f.id}"] .dot`) as HTMLElement | null
        if (dot) dot.className = `dot ${findingStatus(f) === 'todo' ? '' : findingStatus(f)}`
        updateFindingChips()
      },
    }),
    h('label', { for: `${group}-${value}` }, text),
  ]
  card.append(
    h('div', { class: 'criterion-head' }, h('span', { class: 'crit-id' }, `RGAA ${c.id}`), h('span', { class: 'level' }, `Level ${c.level}`), h('a', { class: 'crit-link', href: `https://accessibilite.numerique.gouv.fr/methode/criteres-et-tests/#${c.id}`, target: '_blank', rel: 'noreferrer' }, 'Official tests ↗')),
    h('p', { class: 'question' }, c.question),
    h('ul', { class: 'checks' }, ...c.checks.map((x) => h('li', {}, x))),
    ...(hint ? [h('p', { class: `hint ${hint.tone}` }, hint.text)] : []),
    ...(review.auto && review.answers[c.id] !== undefined ? [h('p', { class: 'hint info prefill-note' }, 'Pre-filled from the page. Click your answer to confirm it, or change it.')] : []),
    h('fieldset', {}, h('legend', { class: 'hint-line' }, `Verdict for criterion ${c.id}`), h('div', { class: 'verdicts' }, ...verdict('c', 'Compliant'), ...verdict('nc', 'Non-compliant'), ...verdict('na', 'Not applicable'))),
  )
  return card
}

function renderEmpty(): void {
  const onPage = Boolean(page && liveUrl && normalizeUrl(page.url) === normalizeUrl(liveUrl))
  emptyAddBtn.hidden = Boolean(page)
  emptyGoBtn.hidden = !page || onPage
  if (!page) {
    emptyTitle.textContent = 'Start by registering the pages of your sample'
    emptyText.textContent = 'Open the first page in the browser and add it as page 1. You scan it afterwards, when you are ready.'
    emptyAddBtn.textContent = `Add the current URL as ${nextPageLabel()}`
  } else {
    const label = pageLabel(page)
    emptyTitle.textContent = `${label} is registered, not scanned yet`
    emptyText.textContent = onPage
      ? `The browser is on ${page.url}. Click “Scan ${label}” to list its images.`
      : `Open ${page.url} in the browser, then click “Scan ${label}”.`
    emptyGoBtn.textContent = `Open ${label} in the browser`
  }
}

emptyAddBtn.addEventListener('click', () => void addPage(liveUrl))
emptyGoBtn.addEventListener('click', () => page && goTo(page.url))
sampleBtn.addEventListener('click', () => setView(view === 'sample' ? 'review' : 'sample'))

/** Registers a page of the sample without scanning it. */
async function addPage(url: string, title?: string): Promise<void> {
  const target = url || liveUrl
  if (!target) return void say('No URL to add: open a page in the browser first.')
  const known = findPage(audit, target)
  if (known) {
    say(`${pageLabel(known)} already uses this URL.`)
    return void switchTo(known.id)
  }
  const rec = createPage(audit, target, title ?? ((await inspectedTitle()) || target))
  loadPage(rec)
  persist()
  setView(view === 'sample' ? 'sample' : 'review')
  renderAll()
  say(`${pageLabel(rec)} registered. It is not scanned yet: open it in the browser and click “Scan ${pageLabel(rec)}”.`)
}

function movePage(rec: PageRecord, dir: -1 | 1): void {
  const i = audit.pages.indexOf(rec)
  const j = i + dir
  if (j < 0 || j >= audit.pages.length) return
  ;[audit.pages[i], audit.pages[j]] = [audit.pages[j], audit.pages[i]]
  persist()
  renderAll()
}

/** The sample: which URL is page 1, page 2… Editable, and where pages are registered before scanning. */
function renderSample(): void {
  sampleEl.replaceChildren()
  const field = (label: string, key: keyof Audit['meta'], placeholder: string) =>
    h(
      'label',
      { class: 'field' },
      h('span', {}, label),
      h('input', { type: 'text', value: audit.meta[key], placeholder, oninput: (e: Event) => { audit.meta[key] = (e.target as HTMLInputElement).value; persist() } }),
    )
  sampleEl.append(
    h(
      'div',
      { class: 'results-head' },
      h('div', {}, h('h2', {}, 'Audit pages sample'), h('p', { class: 'hint-line' }, 'Register each page and its URL here, then scan them one by one. P01, P02… follow this order.')),
      h('div', { class: 'nav' }, h('button', { type: 'button', onclick: () => setView('review') }, '← Back to review'), h('button', { type: 'button', onclick: () => setView('audit') }, 'Audit pages overview'), h('button', { type: 'button', class: 'danger-btn', disabled: !audit.pages.length && !audit.meta.site && !audit.meta.auditor, title: 'Delete every page and the audit fields', onclick: () => resetAudit() }, 'Reset the whole audit')),
    ),
    h('div', { class: 'sample-meta' }, field('Site', 'site', 'Name of the site'), field('Auditor', 'auditor', 'First name Last name'), field('Context', 'context', 'Visite initiale')),
  )

  const table = h('table', { class: 'results-table sample-table' })
  table.append(
    h('caption', { class: 'sr-only' }, 'Pages of the sample'),
    h('thead', {}, h('tr', {}, ...['Page', 'Title', 'URL', 'Themes', 'Images', 'Scans', 'Actions'].map((t) => h('th', { scope: 'col' }, t)))),
  )
  const body = h('tbody', {})
  audit.pages.forEach((rec, i) => {
    const label = pageLabel(rec)
    const urlInput = h('input', {
      type: 'url',
      value: rec.url,
      'aria-label': `URL of ${label}`,
      onchange: (e: Event) => {
        const value = (e.target as HTMLInputElement).value.trim()
        const clash = findPage(audit, value)
        if (clash && clash !== rec) {
          say(`${pageLabel(clash)} already uses this URL.`)
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
        { class: rec === page ? 'current' : '' },
        h('th', { scope: 'row' }, label),
        h('td', {}, h('input', { type: 'text', value: rec.title, 'aria-label': `Title of ${label}`, oninput: (e: Event) => { rec.title = (e.target as HTMLInputElement).value; persist() }, onchange: () => renderPageBar() })),
        h('td', {}, urlInput),
        h('td', {}, themesMenu(rec)),
        h('td', {}, String(rec.items.length)),
        h('td', {}, String(rec.scanCount)),
        h(
          'td',
          { class: 'row-actions' },
          h('button', { type: 'button', class: 'img-ref', onclick: () => switchTo(rec.id, true) }, 'Open'),
          h('button', { type: 'button', class: 'img-ref', title: 'Use the URL the browser is on now', onclick: () => { if (!liveUrl) return; rec.url = normalizeUrl(liveUrl); persist(); renderSample(); renderPageBar() } }, 'Use current URL'),
          h('button', { type: 'button', class: 'img-ref', 'aria-label': `Move ${label} up`, disabled: i === 0, onclick: () => movePage(rec, -1) }, '↑'),
          h('button', { type: 'button', class: 'img-ref', 'aria-label': `Move ${label} down`, disabled: i === audit.pages.length - 1, onclick: () => movePage(rec, 1) }, '↓'),
          h('button', { type: 'button', class: 'img-ref', title: 'Clear its scans and answers, keep the page', onclick: () => resetPage(rec) }, 'Reset'),
          h('button', { type: 'button', class: 'img-ref nc', onclick: () => removePage(rec) }, 'Remove'),
        ),
      ),
    )
  })
  table.append(body)
  sampleEl.append(h('div', { class: 'results-scroll' }, table))

  const urlNew = h('input', { type: 'url', value: liveUrl, placeholder: 'https://…', 'aria-label': 'URL of the new page' })
  const titleNew = h('input', { type: 'text', placeholder: 'Title (optional)', 'aria-label': 'Title of the new page' })
  sampleEl.append(
    h(
      'div',
      { class: 'card add-page' },
      h('h3', {}, `Add page ${nextPageLabel()}`),
      h('div', { class: 'add-row' }, urlNew, titleNew,
        h('button', { type: 'button', class: 'img-ref', onclick: () => { urlNew.value = liveUrl } }, 'Use current URL'),
        h('button', { type: 'button', class: 'primary', onclick: () => void addPage(urlNew.value.trim(), titleNew.value.trim() || undefined) }, 'Add to the sample')),
      h('p', { class: 'hint-line' }, 'Adding a page does not scan it. Select it, open it in the browser, then click Scan.'),
    ),
  )
}

/* ------------------------------------------------------------------ */
/* Sheets in the browser (same content as the .xlsx)                    */
/* ------------------------------------------------------------------ */

let activeSheet = 0

function tabsFor(host: HTMLElement, tabs: { name: string; render: () => HTMLElement }[]): void {
  const bar = h('div', { class: 'sheet-tabs', role: 'tablist', 'aria-label': 'Sections' })
  const panel = h('div', { class: 'results-scroll', role: 'tabpanel' })
  const show = (index: number) => {
    activeSheet = Math.min(index, tabs.length - 1)
    bar.querySelectorAll('button').forEach((b, i) => {
      b.setAttribute('aria-selected', String(i === activeSheet))
      b.tabIndex = i === activeSheet ? 0 : -1
    })
    panel.replaceChildren(tabs[activeSheet].render())
  }
  tabs.forEach((t, i) => bar.append(h('button', { type: 'button', role: 'tab', onclick: () => show(i) }, t.name)))
  bar.addEventListener('keydown', (event) => {
    const dir = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!dir) return
    const next = (activeSheet + dir + tabs.length) % tabs.length
    show(next)
    ;(bar.children[next] as HTMLElement).focus()
  })
  host.append(bar, panel)
  show(activeSheet)
}

/** Renders one sheet exactly as it is exported to Excel. */
function sheetTable(sheet: Sheet): HTMLElement {
  const table = h('table', { class: 'results-table grid' })
  table.append(h('caption', { class: 'sr-only' }, sheet.name))
  const colgroup = h('colgroup', {})
  for (const w of sheet.widths) colgroup.append(h('col', { style: `min-width:${Math.round(w * 7)}px` }))
  table.append(colgroup)
  const cols = sheet.widths.length
  const body = h('tbody', {})
  sheet.rows.forEach((row, ri) => {
    if (!row.length) return body.append(h('tr', { class: 'gap' }, h('td', { colSpan: cols })))
    const cells = row.map((c) => (c !== null && typeof c === 'object' ? c : { v: c ?? '', s: undefined }))
    const isHead = cells.length > 1 && cells.every((c) => c.s === 'head' || c.v === '') && cells.some((c) => c.s === 'head') && ri > 0
    const single = cells.length === 1
    const crit = cells.length >= 7 && typeof cells[1].v === 'string' && /^\d+\.\d+$/.test(cells[1].v) ? cells[1].v : null
    const tr = h('tr', { class: single ? 'sheet-title' : '', 'data-crit': crit })
    cells.forEach((c, ci) => {
      const tag = isHead || (c.s === 'head' && ci === 0) ? 'th' : 'td'
      const cell = h(tag as 'td', { class: `s-${c.s ?? 'default'}`, colSpan: single ? cols : 1, scope: tag === 'th' ? (isHead ? 'col' : 'row') : undefined })
      if ('image' in c && c.image) cell.append(h('img', { class: 'sheet-thumb', src: c.image, alt: 'Aperçu de l’image', loading: 'lazy' }))
      else appendWithImageLinks(cell, String(c.v))
      tr.append(cell)
    })
    body.append(tr)
  })
  table.append(body)
  return table
}

/** "#3" tokens become buttons that jump to that image in the review view (current page only). */
function appendWithImageLinks(cell: HTMLElement, text: string): void {
  for (const part of text.split(/(#\d+)/g)) {
    const m = /^#(\d+)$/.exec(part)
    if (m && view === 'page' && elements.some((e) => e.id === Number(m[1]))) {
      const id = Number(m[1])
      cell.append(h('button', { type: 'button', class: 'img-ref', onclick: () => { setView('review'); select(id, true) } }, part))
    } else if (part) cell.append(part)
  }
}

function download(bytes: BlobPart, type: string, name: string): void {
  const url = URL.createObjectURL(new Blob([bytes], { type }))
  const a = h('a', { href: url, download: name })
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const hostOf = (url: string) => { try { return new URL(url).hostname } catch { return 'audit' } }

async function exportWorkbook(pages: PageInput[], sheets: Sheet[], fileName: string): Promise<void> {
  try {
    say('Building the Excel file with image previews…')
    const sources = pages.flatMap((p, pi) => [
      ...p.images.map((el) => ({ id: thumbKey(pi, el.id), source: el.thumb })),
      ...p.findings.map((f) => ({ id: thumbKey(pi, 50000 + f.theme * 1000 + f.id), source: f.shot ?? null })),
    ])
    const thumbs = await makeThumbs(sources)
    download(buildWorkbook(sheets, thumbs) as BlobPart, XLSX_TYPE, fileName)
    say(`Excel grid exported (${pages.length} page(s), ${thumbs.size}/${sources.length} image previews).`)
  } catch (err) {
    say('Could not build the Excel file.')
    console.error(err)
  }
}

/* ------------------------------------------------------------------ */
/* Page results                                                         */
/* ------------------------------------------------------------------ */

function renderResults(): void {
  resultsEl.replaceChildren()
  if (!page) return
  const input = pageInput(page)
  const stat = auditStats([input]).perPage[0]
  const pill = (cls: string, text: string) => h('span', { class: `outcome ${cls}` }, text)
  resultsEl.append(
    h(
      'div',
      { class: 'results-head' },
      h('div', {}, h('h2', {}, `${pageLabel(page)} — ${page.title || page.url}`), h('p', { class: 'hint-line' }, page.url)),
      h(
        'div',
        { class: 'nav' },
        h('button', { type: 'button', onclick: () => setView('review') }, '← Back to review'),
        h('button', { type: 'button', onclick: () => setView('audit') }, 'Audit pages overview'),
        h('button', { type: 'button', class: 'primary', onclick: () => void exportWorkbook([input], auditSheets([input], audit.meta), `grille-rgaa-images-${pageLabel(page!)}-${hostOf(page!.url)}.xlsx`) }, 'Export this page (.xlsx)'),
      ),
    ),
    h(
      'div',
      { class: 'results-summary' },
      h('div', { class: 'rate' }, h('strong', {}, stat.rate === null ? '—' : `${stat.rate}%`), h('span', {}, `accessibility rate of ${pageLabel(page)} (C ÷ (C + NC), themes ${stat.themes.join(', ')})`)),
      pill('c', `${stat.counts.C} compliant`),
      pill('nc', `${stat.counts.NC} non-compliant`),
      pill('na', `${stat.counts.NA} not applicable`),
      pill('pending', `${stat.counts.NT} not tested`),
    ),
  )
  const sheets = pageSheets(input)
  tabsFor(resultsEl, sheets.map((sheet) => ({ name: sheet.name === pageLabel(page!) ? `Grille (${pageLabel(page!)})` : sheet.name, render: () => sheetTable(sheet) })))
}

/* ------------------------------------------------------------------ */
/* Audit overview: all pages                                            */
/* ------------------------------------------------------------------ */

function donut(label: string, cPct: number | null, caption: string): HTMLElement {
  const c = cPct ?? 0
  return h(
    'figure',
    { class: 'chart' },
    h('figcaption', {}, label),
    h(
      'div',
      { class: 'donut', style: `--c:${c}`, role: 'img', 'aria-label': cPct === null ? `${label}: no data` : `${label}: ${pct2(cPct)} compliant, ${pct2(100 - cPct)} non-compliant` },
      h('span', {}, cPct === null ? '—' : pct2(cPct)),
    ),
    h('div', { class: 'legend' }, h('span', { class: 'lg c' }, 'C'), h('span', { class: 'lg nc' }, 'NC')),
    h('p', { class: 'chart-note' }, caption),
  )
}

/** Bars of C and NC per level, as in the official dashboard. */
function levelBars(perLevel: Record<'A' | 'AA' | 'AAA', Counts>): HTMLElement {
  const W = 300
  const H = 170
  const left = 34
  const bottom = 26
  const plotH = H - bottom - 8
  const levels = ['A', 'AA', 'AAA'] as const
  const group = (W - left) / levels.length
  const NS = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(NS, 'svg')
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`)
  svg.setAttribute('class', 'bars')
  svg.setAttribute('role', 'img')
  svg.setAttribute('aria-label', levels.map((l) => `${l}: ${pct2(rateExact(perLevel[l]))} compliant`).join('; '))
  const add = (tag: string, attrs: Record<string, string | number>, text?: string) => {
    const node = document.createElementNS(NS, tag)
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v))
    if (text) node.textContent = text
    svg.append(node)
    return node
  }
  for (const t of [0, 25, 50, 75, 100]) {
    const y = 8 + plotH - (t / 100) * plotH
    add('line', { x1: left, x2: W, y1: y, y2: y, class: 'grid-line' })
    add('text', { x: left - 4, y: y + 3, 'text-anchor': 'end', class: 'axis' }, `${t}%`)
  }
  levels.forEach((l, i) => {
    const c = perLevel[l]
    const total = c.C + c.NC
    const cp = total ? (c.C / total) * 100 : 0
    const np = total ? (c.NC / total) * 100 : 0
    const x = left + i * group + group / 2
    add('rect', { x: x - 22, y: 8 + plotH - (cp / 100) * plotH, width: 20, height: Math.max(0, (cp / 100) * plotH), class: 'bar c' })
    add('rect', { x: x + 2, y: 8 + plotH - (np / 100) * plotH, width: 20, height: Math.max(0, (np / 100) * plotH), class: 'bar nc' })
    add('text', { x, y: H - 8, 'text-anchor': 'middle', class: 'axis' }, `Level ${l}`)
  })
  return h('figure', { class: 'chart' }, h('figcaption', {}, 'Compliance by level'), svg as unknown as Node, h('div', { class: 'legend' }, h('span', { class: 'lg c' }, 'C'), h('span', { class: 'lg nc' }, 'NC')))
}

function miniTable(caption: string, headers: string[], rows: (string | number | Node)[][], cls = ''): HTMLElement {
  const table = h('table', { class: `results-table mini ${cls}` })
  table.append(
    h('caption', {}, caption),
    h('thead', {}, h('tr', {}, ...headers.map((t) => h('th', { scope: 'col' }, t)))),
    h('tbody', {}, ...rows.map((r) => h('tr', {}, ...r.map((cell, i) => (i === 0 ? h('th', { scope: 'row' }, cell as string) : h('td', {}, cell as string)))))),
  )
  return table
}

/** The "Tableau de bord audit RGAA 4": level tables, charts, results per page and averages. */
function dashboard(inputs: PageInput[]): HTMLElement {
  const stats = auditStats(inputs)
  const lv = levelStats(stats)
  const cOf = (c: Counts) => pct2(rateExact(c))
  const nOf = (c: Counts) => (c.C + c.NC ? pct2((c.NC / (c.C + c.NC)) * 100) : '—')
  const tone = (rate: number | null) => (rate === null ? 'none' : rate >= 100 ? 'full' : rate >= 75 ? 'good' : rate >= 50 ? 'mid' : 'low')

  const wrap = h('div', { class: 'dash2' })
  wrap.append(
    h(
      'section',
      { class: 'dash-col' },
      miniTable('Conformité RGAA 4', ['', 'C', 'NC'], [['A', cOf(lv.perLevel.A), nOf(lv.perLevel.A)], ['AA (Légal)', cOf(lv.legal), nOf(lv.legal)], ['AAA', cOf(lv.perLevel.AAA), nOf(lv.perLevel.AAA)]], 'level-table'),
      h('p', { class: 'dash-note' }, 'These figures are the overall compliance level to report in the conformity statement. The reference is the legal level AA (A + AA): a site is declared compliant at 100 %. Other figures are indicative.'),
      miniTable('Compliance for each level', ['', 'C', 'NC'], [['A', cOf(lv.perLevel.A), nOf(lv.perLevel.A)], ['AA', cOf(lv.perLevel.AA), nOf(lv.perLevel.AA)], ['AAA', cOf(lv.perLevel.AAA), nOf(lv.perLevel.AAA)]], 'level-table'),
      miniTable('Results by level', ['', 'C', 'NC'], [['A', lv.perLevel.A.C, lv.perLevel.A.NC], ['AA', lv.perLevel.AA.C, lv.perLevel.AA.NC], ['AAA', lv.perLevel.AAA.C, lv.perLevel.AAA.NC], ['Total', lv.perLevel.A.C + lv.perLevel.AA.C + lv.perLevel.AAA.C, lv.perLevel.A.NC + lv.perLevel.AA.NC + lv.perLevel.AAA.NC]]),
    ),
    h(
      'section',
      { class: 'dash-col charts' },
      levelBars(lv.perLevel),
      donut('Compliance RGAA 4 (legal level AA)', rateExact(lv.legal), 'C ÷ (C + NC) over the sample, levels A and AA'),
      donut('Average per page', lv.average, 'Average of the page rates'),
    ),
    h(
      'section',
      { class: 'dash-col' },
      h(
        'table',
        { class: 'results-table mini pages-result' },
        h('caption', {}, 'Results per page'),
        h('thead', {}, h('tr', {}, ...['', 'Page', 'C', 'NC', 'NA', '% C'].map((t) => h('th', { scope: 'col' }, t)))),
        h(
          'tbody',
          {},
          ...lv.pages.map((p) => {
            const rec = audit.pages.find((x) => pageLabel(x) === p.label)
            return h(
              'tr',
              {},
              h('th', { scope: 'row' }, p.label),
              h('td', {}, rec ? h('button', { type: 'button', class: 'link-btn-plain', title: p.title, onclick: () => switchTo(rec.id) }, p.title || rec.url) : p.title),
              h('td', { class: 's-C' }, String(p.counts.C)),
              h('td', { class: 's-NC' }, String(p.counts.NC)),
              h('td', { class: 's-NA' }, String(p.counts.NA)),
              h('td', { class: `rate-cell ${tone(p.rate)}` }, pct2(p.rate)),
            )
          }),
        ),
      ),
      miniTable('Results: averages', ['', ''], [['Average', pct2(lv.average)], [`Best page${lv.best ? ` (${lv.best.label})` : ''}`, pct2(lv.best?.rate ?? null)], [`Worst page${lv.worst ? ` (${lv.worst.label})` : ''}`, pct2(lv.worst?.rate ?? null)]]),
    ),
  )

  const themeTable = h('table', { class: 'results-table pages-table' })
  themeTable.append(
    h('caption', {}, 'By theme (sample level)'),
    h('thead', {}, h('tr', {}, ...['Theme', 'Audited', 'C', 'NC', 'NA', 'NT', 'Criteria respected'].map((t) => h('th', { scope: 'col' }, t)))),
  )
  const themeBody = h('tbody', {})
  for (const t of stats.perTheme) {
    themeBody.append(
      h(
        'tr',
        { class: t.audited ? '' : 'absent' },
        h('th', { scope: 'row' }, `${t.number}. ${t.name}`),
        h('td', {}, t.audited ? 'yes' : 'no'),
        h('td', { class: 's-C' }, String(t.counts.C)),
        h('td', { class: 's-NC' }, String(t.counts.NC)),
        h('td', { class: 's-NA' }, String(t.counts.NA)),
        h('td', { class: 's-NT' }, String(t.counts.NT)),
        h('td', {}, h('div', { class: 'meter', role: 'img', 'aria-label': `${t.rate ?? 0}% respected` }, h('i', { style: `width:${t.rate ?? 0}%` })), h('span', { class: 'meter-num' }, t.rate === null ? '—' : `${t.rate}%`)),
      ),
    )
  }
  themeTable.append(themeBody)
  const calc = h(
    'section',
    { class: 'calc' },
    h('h3', {}, 'How compliance is calculated'),
    h('p', {}, 'Overall compliance is C ÷ (C + NC), where C is the number of compliant criteria and NC the number of non-compliant ones. Criteria that are not applicable (NA) or not tested (NT) are left out. This is the legal reference: it is the compliance rate of the sample.'),
    h('p', {}, 'Levels A / AA / AAA are derived from the WCAG success criteria each RGAA criterion references. The accessibility rate used elsewhere in this panel is the average of the page rates.'),
  )
  return h('div', {}, wrap, h('div', { class: 'results-scroll' }, themeTable), calc)
}

function renderAudit(): void {
  auditEl.replaceChildren()
  const inputs = allPageInputs()
  if (!inputs.length) return void auditEl.append(h('p', { class: 'hint-line' }, 'Scan a page to start the audit.'))
  const sheets = auditSheets(inputs, audit.meta)
  const named = (name: string) => sheets.find((s) => s.name === name)!
  auditEl.append(
    h(
      'div',
      { class: 'results-head' },
      h('div', {}, h('h2', {}, `Audit pages overview — ${inputs.length} page(s)`), h('p', { class: 'hint-line' }, 'RGAA 4.1 · all audited themes · one sheet per page, like the official Excel grid.')),
      h(
        'div',
        { class: 'nav' },
        h('button', { type: 'button', onclick: () => setView('review') }, '← Back to review'),
        h('button', { type: 'button', class: 'primary', onclick: () => void exportWorkbook(inputs, auditSheets(inputs, audit.meta), `grille-rgaa-images-${hostOf(inputs[0].pageUrl)}.xlsx`) }, 'Export Excel (all pages)'),
      ),
    ),
  )
  tabsFor(auditEl, [
    { name: 'Dashboard', render: () => dashboard(inputs) },
    { name: 'Synthèse', render: () => sheetTable(named('Synthèse')) },
    { name: 'Échantillon', render: () => h('div', {}, h('p', { class: 'hint-line' }, 'Pages and fields are edited in “Sample”. '), h('button', { type: 'button', class: 'img-ref', onclick: () => setView('sample') }, 'Edit the sample'), sheetTable(named('Échantillon'))) },
    { name: 'Critères', render: () => sheetTable(named('Critères')) },
    ...inputs.map((p) => ({ name: p.label, render: () => sheetTable(named(p.label)) })),
    { name: 'Détail par test (Images)', render: () => sheetTable(named('Détail par test (Images)')) },
    { name: 'Détail par image', render: () => sheetTable(named('Détail par image')) },
    ...(sheets.some((x) => x.name === 'Détail cadres et couleurs') ? [{ name: 'Cadres et couleurs', render: () => sheetTable(named('Détail cadres et couleurs')) }] : []),
  ])
}

/* ------------------------------------------------------------------ */
/* Report                                                              */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Scanning                                                            */
/* ------------------------------------------------------------------ */

function inspectedUrl(): Promise<string> {
  return new Promise((resolve) => {
    chrome.devtools.inspectedWindow.eval('location.href', (result: unknown, error: unknown) =>
      resolve(error || typeof result !== 'string' ? '' : result),
    )
  })
}

function inspectedTitle(): Promise<string> {
  return new Promise((resolve) => {
    chrome.devtools.inspectedWindow.eval('document.title', (result: unknown, error: unknown) =>
      resolve(error || typeof result !== 'string' ? '' : result),
    )
  })
}

/** Ignored by assistive tech and nameless: decorative + 1.2 compliant, until a human says otherwise. */
function prefill(el: Item): void {
  const review = reviewOf(el)
  if (!el.ignoredBy || hintFor('1.2', el)?.tone !== 'ok') return
  const untouched = !review.kind && !Object.keys(review.answers).length
  const decorativeWithoutVerdict = review.kind === 'decorative' && review.answers['1.2'] === undefined
  if (!untouched && !decorativeWithoutVerdict) return
  review.kind = 'decorative'
  review.answers['1.2'] = 'c'
  review.auto = true
}

/** Merges a scan into the current page. Returns the new count and the renumbering for the page's boxes. */
function mergeScan(found: ImageElementInfo[]): { added: number; map: { from: number; to: number }[] } {
  const rec = page!
  scanCount++
  const byKey = new Map(elements.map((el) => [el.key, el]))
  const seen = new Set<string>()
  const occurrences = new Map<string, number>()
  const map: { from: number; to: number }[] = []
  let added = 0
  for (const info of found) {
    const base = keyOf(info)
    const n = occurrences.get(base) ?? 0
    occurrences.set(base, n + 1)
    const key = n ? `${base}~${n}` : base
    seen.add(key)
    const existing = byKey.get(key)
    if (existing) {
      Object.assign(existing, info, { id: existing.id, key, present: true, scan: existing.scan })
      map.push({ from: info.id, to: existing.id })
    } else {
      const item: Item = { ...info, id: rec.nextId++, key, present: true, scan: scanCount }
      elements.push(item)
      byKey.set(key, item)
      map.push({ from: info.id, to: item.id })
      added++
    }
  }
  for (const el of elements) if (!seen.has(el.key)) el.present = false
  for (const el of elements) if (el.present) prefill(el)
  elements.sort((a, b) => a.scan - b.scan || a.id - b.id)
  return { added, map }
}

async function scan(): Promise<void> {
  if (!page) return void say('Add a page to the audit pages sample first (button “Audit pages sample”).')
  const scannable = page.themes.filter((t) => SCANNED_THEMES.has(t))
  if (!scannable.length) return void say('None of the selected themes can be scanned: they are checklists. Select Images, Frames or Colours to scan.')
  say('Scanning…')
  try {
    const [url, title] = await Promise.all([inspectedUrl(), inspectedTitle()])
    liveUrl = url
    const rec = page
    const label = pageLabel(rec)
    if (url && normalizeUrl(url) !== normalizeUrl(rec.url)) {
      const other = findPage(audit, url)
      const question = other
        ? `The browser is on ${pageLabel(other)} (${url}), not on ${label}.\n\nOK: scan into ${pageLabel(other)} instead.\nCancel: stop.`
        : `The browser is on ${url}, but ${label} is registered for ${rec.url}.\n\nOK: scan into ${label} and update its URL.\nCancel: stop.`
      if (!(await askConfirm('The browser is on another page', question, other ? `Scan into ${pageLabel(other)}` : `Scan into ${label}`))) return void say('Scan cancelled.')
      if (other) {
        switchTo(other.id)
        return void (await scan())
      }
      rec.url = normalizeUrl(url)
    }
    if (!rec.title && title) rec.title = title

    const parts: string[] = []
    const first = scanCount === 0
    const selectedKey = elements.find((e) => e.id === selectedId)?.key
    if (rec.themes.includes(1)) {
      const response = await sendToPage(inspectedTabId(), { type: 'RGAA_HIGHLIGHT_IMAGES', color: colorOf(1) })
      const { added, map } = mergeScan(response?.elements ?? [])
      await sendToPage(inspectedTabId(), { type: 'RGAA_RELABEL', map })
      if (!rec.scannedThemes.includes(1)) rec.scannedThemes.push(1)
      selectedId = elements.find((e) => e.key === selectedKey)?.id ?? elements[0]?.id ?? null
      const gone = elements.filter((e) => !e.present).length
      parts.push(`${elements.length} image(s)${first ? '' : `, ${added} new`}${gone ? `, ${gone} gone` : ''}`)
    } else {
      scanCount++
    }
    for (const t of rec.themes.filter((n) => FINDING_THEMES.has(n))) {
      const response = await sendToPage(inspectedTabId(), { type: 'RGAA_SCAN_THEME', theme: t, color: colorOf(t) })
      const { map, added } = mergeFindings(t, response?.findings ?? [])
      await sendToPage(inspectedTabId(), { type: 'RGAA_RELABEL', map, theme: t })
      const n = rec.findings.filter((f) => f.theme === t).length
      parts.push(t === 2 ? `${n} frame(s)` : `${listedFindings(t).length} contrast finding(s)${added ? ` (${added} new)` : ''}`)
    }
    const missing = rec.findings.filter((f) => f.present && !f.shot && f.type !== 'contrast-ok' && rec.themes.includes(f.theme)).slice(0, 80)
    const shots = await captureShots(missing)
    if (shots) parts.push(`${shots} preview(s)`)
    filter = 'all'
    findingFilter = 'all'
    await applyBoxes()
    scannedThisSession.add(rec.id)
    newBanner.hidden = true
    navBanner.hidden = true
    setView('review')
    renderAll()
    persist()
    say(`${first ? `${label} scanned` : `Rescan ${scanCount} of ${label}`}: ${parts.join(' · ')}.${first ? ` Open a popin or a tab, then click “Rescan ${label}” to add what appears.` : ''}`)
  } catch (err) {
    say('Could not reach the page. Reload the tab, check site access in about:addons, and try again.')
    console.error(err)
  }
}

scanBtn.addEventListener('click', scan)
rescanBtn.addEventListener('click', scan)

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== 'RGAA_NEW_IMAGES' || !scanCount) return
  newBannerText.textContent = `${message.count} new image(s) appeared on the page (popin, tab, lazy content…).`
  newBanner.hidden = false
})

chrome.devtools.network.onNavigated.addListener((url: string) => {
  liveUrl = url
  // The boxes are gone with the old document: what was seen is shown as last seen until the next scan.
  scannedThisSession.clear()
  for (const p of audit.pages) for (const el of p.items) el.present = true
  newBanner.hidden = true
  renderPageBar()
  renderList()
  renderStats()
  if (view === 'review') renderEmpty()
  showNavBanner(url)
})

clearBtn.addEventListener('click', async () => {
  try {
    await sendToPage(inspectedTabId(), { type: 'RGAA_CLEAR_HIGHLIGHTS' })
    for (const el of elements) el.present = false
    for (const f of page?.findings ?? []) f.present = false
    renderList()
    renderStats()
    say('Boxes removed from the page. The images and your answers stay in the audit; “Rescan” draws them again.')
  } catch (err) {
    say('Could not reach the page.')
    console.error(err)
  }
})

tintBtn.addEventListener('click', () => {
  focusTintOn = !focusTintOn
  try { localStorage.setItem('rgaa-focus-tint', focusTintOn ? 'on' : 'off') } catch { /* optional */ }
  void applyBoxes()
})

boxesBtn.addEventListener('click', () => {
  boxesOn[theme] = boxesOn[theme] === false
  void applyBoxes()
})
resultsBtn.addEventListener('click', () => setView(view === 'page' ? 'review' : 'page'))
auditBtn.addEventListener('click', () => setView(view === 'audit' ? 'review' : 'audit'))

/* Keyboard: j / k move between images (outside text fields). */
document.addEventListener('keydown', (event) => {
  const target = event.target as HTMLElement
  if (['TEXTAREA', 'INPUT', 'SELECT'].includes(target.tagName) || view !== 'review' || theme !== 1 || !elements.length || selectedId === null) return
  const index = elements.findIndex((e) => e.id === selectedId)
  const next = event.key === 'j' ? index + 1 : event.key === 'k' ? index - 1 : -1
  if (next >= 0 && next < elements.length) select(elements[next].id, true)
})

window.addEventListener('error', (event) => say(`Panel error: ${event.message}`))
window.addEventListener('unhandledrejection', (event) => say(`Panel error: ${String(event.reason)}`))

async function init(): Promise<void> {
  audit = await loadAudit()
  liveUrl = await inspectedUrl()
  loadPage((liveUrl ? findPage(audit, liveUrl) : undefined) ?? audit.pages.find((p) => p.id === audit.current) ?? audit.pages[0] ?? null)
  renderAll()
  if (liveUrl) showNavBanner(liveUrl)
  if (page) say(`Audit restored: ${audit.pages.length} page(s). Viewing ${page.id}.`)
}
void init()
