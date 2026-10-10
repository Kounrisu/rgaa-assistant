import { DETECTED_LABEL, criteriaFor, criterionUrl, detectedOf, hintFor, suggestedKind, type Criterion } from '../lib/rgaa'
import { auditSheets, auditStats, buildWorkbook, countsOf, isProvisional, levelStats, pageSheets, pct2, rateExact, rateOf, thumbKey, type Counts, type PageInput } from '../lib/audit-sheet'
import { confirm as confirmVerdict, evidenceConflicts as evidenceConflictsOf } from '../lib/evidence'
import { auditFromFile, auditToFile, copyOf, createPage, deleteAuditById, emptyAudit, FILE_EXTENSION, findPage, listAudits, loadActiveAudit, loadAuditById, normalizeUrl, saveAudit, setActiveId } from '../lib/audit-store'
import { getLang, setLang, t, translateStatic, type Lang } from '../lib/i18n'
import type { Sheet } from '../lib/xlsx'
import { makeThumbs } from '../lib/thumbs'
import { computeThemes, testIdFor, type Outcome } from '../lib/results'
import { colorOf } from '../lib/theme-colors'
import { contrastRatio, parseHex, toHex } from '../lib/contrast'
import { MANUAL_CHECKS, MANUAL_GROUPS } from '../lib/manual-checks'
import axeFrench from 'axe-core/locales/fr.json'
import { applyToolResults, AXE_TO_RGAA, fromAxe, type ToolResults } from '../lib/axe-import'
import { RULES, type RuleFinding } from '../lib/rgaa-rules'
import { packSnapshot, unpackSnapshot } from '../lib/snapshot'
import { initPageTools, renderPageTools, resetPageTools, setPageToolsTheme } from './page-tools-ui'
import { buildReportHtml } from '../lib/report'
import { coverageLines, mergeCoverage } from '../lib/scan-coverage'
import { checkHtml } from '../lib/html-check'
// --- Asqatasun-derived: begin ---
import type { AsqExtra } from '../lib/asqatasun-rules' // a type only: the table itself stays in the page script
// --- Asqatasun-derived: end ---
import { findingCriteriaOf, findingCriterionIds, hintForFinding, suggestFinding, type FindingCriterion } from '../lib/findings'
import { FINDING_THEMES, SCANNED_THEMES, THEMES, THEME_LABEL, themeByNumber } from '../lib/themes'
import type { Audit, AuditItem, AuditSummary, ChecklistAnswer, ChecklistVerdict, Detected, FindingItem, ImageElementInfo, ImageKind, ImageReview, PageRecord, RawFinding, Verdict } from '../lib/types'

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
const altBtn = $<HTMLButtonElement>('alt-btn')
let showAltOn = (() => { try { return localStorage.getItem('rgaa-show-alt') === 'on' } catch { return false } })()
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

/** Like t(), but each `{name}` is replaced by a node (a <strong>, a link…) instead of text. */
function tNodes(en: string, nodes: Record<string, Child>): Child[] {
  return t(en)
    .split(/(\{\w+\})/)
    .filter(Boolean)
    .map((part) => {
      const key = /^\{(\w+)\}$/.exec(part)?.[1]
      return key && key in nodes ? nodes[key] : part
    })
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
      if (response?.ok === false && scroll) say(t('This image is not on the page right now (popin closed?). Reopen it, then click Rescan.'))
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
  const name = t(THEME_LABEL[theme] ?? '')
  boxesBtn.setAttribute('aria-pressed', String(on))
  boxesBtn.textContent = on ? t('Hide {name} boxes', { name }) : t('Show {name} boxes', { name })
  try { localStorage.setItem('rgaa-boxes-by-theme', JSON.stringify(boxesOn)) } catch { /* optional */ }
  const visibility: Record<number, boolean> = {}
  for (const n of SCANNED_THEMES) visibility[n] = n === theme && boxesOn[n] !== false
  tintBtn.setAttribute('aria-pressed', String(focusTintOn))
  tintBtn.textContent = focusTintOn ? t('Yellow highlight: on') : t('Yellow highlight: off')
  altBtn.setAttribute('aria-pressed', String(showAltOn))
  altBtn.textContent = showAltOn ? t('Alt text: on') : t('Alt text: off')
  altBtn.hidden = theme !== 1
  await sendToPage(inspectedTabId(), { type: 'RGAA_OVERLAY', visibility, tint: focusTintOn, alt: showAltOn }).catch(() => undefined)
  pushStates()
  await syncFilterBoxes()
}

/** The list filter also decides which boxes are on the page (Images and Colours). */
async function syncFilterBoxes(): Promise<void> {
  let ids: number[] | null = null
  if (theme === 1 && filter !== 'all') ids = visibleElements().map((e) => e.id)
  if (FINDING_THEMES.has(theme) && findingFilter !== 'all' && page) ids = page.findings.filter((f) => f.theme === theme && findingMatches(f, findingFilter)).map((f) => f.id)
  if (theme !== 1 && !FINDING_THEMES.has(theme)) return
  await sendToPage(inspectedTabId(), { type: 'RGAA_SHOW_ONLY', theme, ids }).catch(() => undefined)
}

/**
 * Asks a question inside the panel. The browser's own confirm() popup is not shown in a DevTools panel
 * (it returns "no" at once), so a reset would silently do nothing.
 */
const confirmDialog = $<HTMLDialogElement>('confirm-dialog')
function askConfirm(title: string, text: string, okLabel?: string): Promise<boolean> {
  return new Promise((resolve) => {
    const ok = $('confirm-ok')
    const cancel = $('confirm-cancel')
    $('confirm-title').textContent = title
    $('confirm-text').textContent = text
    ok.textContent = okLabel ?? t('Confirm')
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

/**
 * The scan texts come from the page script in English, with the numbers and colours inside. They are stored that way
 * (the identity of a finding must not depend on the language) and translated here when shown.
 */
function tDyn(text: string): string {
  const rules: [RegExp, (m: RegExpExecArray) => string][] = [
    [/^(\d+) text element\(s\) · (\d+) colour pair\(s\)$/, (m) => t('{n} text element(s) · {pairs} colour pair(s)', { n: m[1], pairs: m[2] })],
    [/^(\S+) on (.+) · ratio cannot be computed$/, (m) => t('{fg} on {bg} · ratio cannot be computed', { fg: tDyn(m[1]), bg: tDyn(m[2]) })],
    [/^(#[0-9A-F]{6}) on (#[0-9A-F]{6}) · ([\d.]+):1 \(needs ([\d.]+):1\)$/, (m) => t('{fg} on {bg} · {ratio}:1 (needs {need}:1)', { fg: m[1], bg: m[2], ratio: m[3], need: m[4] })],
    [/^([\d.]+):1 \((large|normal) text\)$/, (m) => t('{need}:1 ({kind} text)', { need: m[1], kind: t(m[2]) })],
    [/^(\d+) other element\(s\)$/, (m) => t('{n} other element(s)', { n: m[1] })],
    [/^(.+) — cannot be computed$/, (m) => t('{what} — cannot be computed', { what: tDyn(m[1]) })],
    [/^(\d+)px( bold)?$/, (m) => `${m[1]} px${m[2] ? ` ${t('bold')}` : ''}`],
    [/^<(\w+)> without title$/, (m) => t('<{tag}> without title', { tag: m[1] })],
    [/^(\d+) h1$/, (m) => t('{n} h1', { n: m[1] })],
    [/^h(\d) \(empty\)$/, (m) => t('h{n} (empty)', { n: m[1] })],
    [/^h(\d) · jump from h(\d)$/, (m) => t('h{a} · jump from h{b}', { a: m[1], b: m[2] })],
    [/^<(\w+)> without label$/, (m) => t('<{tag}> without label', { tag: m[1] })],
    [/^table (\d+)×(\d+)$/, (m) => t('table {r}×{c}', { r: m[1], c: m[2] })],
    [/^(\d+) rows × (\d+) columns · (\d+) header cell\(s\)$/, (m) => t('{r} rows × {c} columns · {h} header cell(s)', { r: m[1], c: m[2], h: m[3] })],
    [/^<(\w+)> without name$/, (m) => t('<{tag}> without name', { tag: m[1] })],
  ]
  for (const [re, fn] of rules) {
    const m = re.exec(text)
    if (m) return fn(m)
  }
  return t(text)
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
type SaveState = 'saved' | 'saving' | 'error'
let saveState: SaveState = 'saved'
let savedAt = 0

/** Writes the audit now. The status next to the audit name follows: saving, saved at…, or not saved. */
async function saveNow(): Promise<void> {
  window.clearTimeout(saveTimer)
  saveTimer = undefined
  try {
    await saveAudit(audit)
    saveState = 'saved'
    savedAt = Date.now()
  } catch (err) {
    saveState = 'error'
    console.error(err)
  }
  renderAuditBar()
}

function persist(): void {
  const now = Date.now()
  if (page) {
    page.scanCount = scanCount
    page.updatedAt = now
  }
  audit.updatedAt = now
  saveState = 'saving'
  renderAuditBar()
  pushStates()
  window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => void saveNow(), 400)
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

/** English labels: translate with t() where they are shown. */
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

/** English labels: translate with t() where they are shown. */
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
    for (const [outcome, labelEn, cls] of OUTCOME_PILLS) {
      const label = t(labelEn)
      // compliant / not applicable only on the tests this tool can assess does not count here: see the partial pill
      const count = criteria.filter((c) => c.outcome === outcome && !((outcome === 'c' || outcome === 'na') && c.coverage !== 'full')).length
      host.append(
        h(
          'button',
          {
            type: 'button',
            class: `pill ${cls} sum-${outcome}`,
            disabled: count === 0,
            title: count ? t('Go to the first one ({label})', { label }) : t('Nothing {label}', { label }),
            onclick: () => (pageScope ? goToFirstOnPage(outcome) : goToFirst(n, outcome)),
          },
          h('strong', {}, String(count)),
          ` ${label}`,
        ),
      )
    }
    const toConfirm = criteria.filter((c) => c.outcome === 'pending' && c.suggested).length
    const partial = criteria.filter((c) => c.coverage === 'partial').length
    const unconfirmedNc = criteria.filter((c) => c.unconfirmed && c.outcome === 'nc').length
    if (toConfirm) host.append(h('span', { class: 'pill warn-pill', title: t('A tool suggests an answer for these criteria. Confirm or change each one: until then they count as to review.') }, t('{n} to confirm', { n: toConfirm })))
    if (unconfirmedNc) host.append(h('span', { class: 'pill warn-pill', title: t('Failures found by a tool and not yet confirmed. They are counted as non-compliant, so the rate is provisional.') }, t('{n} failure(s) to confirm', { n: unconfirmedNc })))
    if (partial) host.append(h('span', { class: 'pill warn-pill', title: t('Some tests of these criteria are not supported by this tool. The result counts, but only for the tests this tool can assess, so the rate stays provisional; a failure is always kept.') }, t('{n} partly covered', { n: partial })))
    if (!pageScope && n === 1 && elements.length) {
      const prefilled = elements.filter((e) => reviews[reviewKey(e)]?.auto).length
      host.append(
        h('span', { class: 'pill plain' }, t('{n} image(s)', { n: elements.length })),
        ...(elements.some((e) => !e.present) ? [h('span', { class: 'pill plain' }, t('{n} on page now', { n: elements.filter((e) => e.present).length }))] : []),
        ...(prefilled
          ? [h('button', { type: 'button', class: 'pill plain', title: t('Show the images whose answer was pre-filled'), onclick: () => { filter = 'prefilled'; renderFilters(); renderList(); void syncFilterBoxes() } }, t('{n} pre-filled, to confirm', { n: prefilled }))]
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
    return void say(outcome === 'pending' ? t('Nothing to review yet: scan the page, or every element has been reviewed.') : t('Nothing to show for this total.'))
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
    if (outcome === 'pending') return void say(t('Nothing left to review among the images.'))
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
  if (detected === 'ignored') return { text: t('Ignored — {by}', { by: el.ignoredBy ?? '' }), missing: false }
  if (detected === 'unnamed') return { text: t('No text alternative'), missing: true }
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
  /** English labels: translated where the chips are drawn. */
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
          title: value === 'all' ? t('Every image found so far') : value === 'review' ? t('Images with no type chosen or a criterion still unanswered') : value === 'dialog' ? t('Inside a dialog / popin') : value === 'gone' ? t('Seen in an earlier scan but no longer on the page') : value === 'prefilled' ? t('Answer pre-filled from the markup, still to confirm') : t(DETECTED_LABEL[value]),
          onclick: () => {
            filter = value
            renderFilters()
            renderList()
            void syncFilterBoxes()
          },
        },
        `${t(label)} `,
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
        'data-detected': detected,
        'data-status': status,
        'aria-current': el.id === selectedId ? 'true' : 'false',
        onclick: () => select(el.id, true),
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
          detected === 'unnamed' ? h('span', { class: 'type error' }, el.alt === null && el.tag === 'img' ? t('no alt') : t('no name')) : null,
          el.inDialog ? h('span', { class: 'type popin' }, t('popin')) : null,
          h('span', { class: 'type auto-tag', hidden: !reviews[reviewKey(el)]?.auto, title: t('Pre-filled from the markup — confirm it') }, t('pre-filled')),
          !el.present ? h('span', { class: 'type gone' }, t('not on page')) : null,
          el.scan > 1 && el.present ? h('span', { class: 'type new' }, t('scan {n}', { n: el.scan })) : null,
        ),
        h('span', { class: `alt ${detected}${alt.missing ? ' missing' : ''}`, title: labelOf(el) }, alt.text),
      ),
      h('span', { class: `dot ${status}`, role: 'img', 'aria-label': t(STATUS_LABEL[status]), title: t(STATUS_LABEL[status]) }),
    )
    listEl.append(h('li', {}, btn))
  }
  if (!listEl.children.length) listEl.append(h('li', { class: 'hint-line' }, t('No image in this category.')))
}

function refreshListState(): void {
  for (const btn of listEl.querySelectorAll<HTMLButtonElement>('.item')) {
    const el = elements.find((e) => e.id === Number(btn.dataset.id))
    if (!el) continue
    btn.setAttribute('aria-current', el.id === selectedId ? 'true' : 'false')
    btn.dataset.status = statusOf(el)
    const dot = btn.querySelector('.dot') as HTMLElement
    const status = statusOf(el)
    dot.className = `dot ${status}`
    btn.querySelector<HTMLElement>('.auto-tag')!.hidden = !reviews[reviewKey(el)]?.auto
    dot.setAttribute('aria-label', t(STATUS_LABEL[status]))
    dot.title = t(STATUS_LABEL[status])
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
        btn.textContent = t('Copied ✓')
        setTimeout(() => (btn.textContent = t('Copy')), 1500)
      },
    },
    t('Copy'),
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
  if (value === null) dd = h('dd', { class: opts.missingIfNull ? 'missing' : '' }, opts.missingIfNull ? t('attribute missing') : '—')
  else if (value === '') dd = h('dd', { class: opts.emptyHint ? 'empty-val' : '' }, t('"" (empty)'))
  else dd = h('dd', {}, value)
  return [h('dt', {}, label), dd]
}

function nextToReview(from: Item): Item | undefined {
  const list = elements.filter((e) => needsReview(e) && e.id !== from.id)
  return list.find((e) => e.id > from.id) ?? list[0]
}

/**
 * The colour code of the boxes on the page, from where each element's review stands:
 * error = no alternative / failing, review = still to judge, ignored = ignored by assistive tech,
 * c = reviewed and compliant, nc = reviewed and non-compliant.
 */
function boxStates(themeNo: number): Record<number, string> {
  const out: Record<number, string> = {}
  if (themeNo === 1) {
    for (const el of elements) {
      const status = statusOf(el)
      const pending = status === 'todo' || status === 'progress' || Boolean(reviews[reviewKey(el)]?.auto)
      const detected = detectedOf(el)
      out[el.id] = !pending ? (status === 'nc' ? 'nc' : 'c') : detected === 'unnamed' ? 'error' : detected === 'ignored' ? 'ignored' : 'review'
    }
    return out
  }
  for (const f of page?.findings ?? []) {
    if (f.theme !== themeNo || f.type === 'contrast-ok') continue
    const pending = findingNeedsReview(f)
    const status = findingStatus(f)
    const failing = f.type === 'contrast-fail' || f.type === 'link-empty' || f.type === 'heading-empty' || f.type === 'page-no-h1' || f.type === 'page-no-main' || f.type === 'table-nohead' || f.type === 'table-layout-semantic' || f.type === 'field-nolabel' || f.type === 'field-placeholder' || (themeNo === 2 && !f.facts.title?.trim())
    out[f.id] = !pending ? (status === 'nc' ? 'nc' : 'c') : failing ? 'error' : 'review'
  }
  return out
}

let statesTimer: number | undefined
/** Sends the colour code to the page, shortly after the last change. */
function pushStates(): void {
  window.clearTimeout(statesTimer)
  statesTimer = window.setTimeout(() => {
    for (const n of SCANNED_THEMES) void sendToPage(inspectedTabId(), { type: 'RGAA_STATES', theme: n, states: boxStates(n) }).catch(() => undefined)
  }, 120)
}

/**
 * Rebuilds a part of the panel without moving what you were looking at: the panel scroll, the scroll of the list and
 * of the columns are put back, and the part keeps its height while previews load (a shorter page would scroll up).
 */
function keepScroll(host: HTMLElement, rebuild: () => void): void {
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

function renderDetail(): void {
  keepScroll(detailEl, renderDetailNow)
}

function renderDetailNow(): void {
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
        `${t('Image #{id}', { id: el.id })} `,
        h('span', { class: `result ${statusOf(el)}`, id: 'result-badge' }, t(STATUS_LABEL[statusOf(el)])),
        h('span', { class: 'hint-line' }, `  ${index + 1} / ${elements.length}`),
      ),
      h(
        'div',
        { class: 'nav' },
        h('button', { type: 'button', onclick: () => focusOnPage(el.id, true) }, t('Locate on page')),
        h('button', { type: 'button', disabled: index === 0, onclick: () => goto(-1) }, t('← Prev')),
        h('button', { type: 'button', disabled: index === elements.length - 1, onclick: () => goto(1) }, t('Next →')),
        h('button', { type: 'button', class: 'next-review', disabled: !nextToReview(el), onclick: () => { const n = nextToReview(el); if (n) select(n.id, true) } }, t('Next to review ⇥')),
      ),
    ),
  )

  const detected = detectedOf(el)
  const facts = h('dl', { class: 'facts' })
  facts.append(
    ...fact(t('Type'), el.type),
    ...fact(
      t('Where'),
      [el.inDialog ? t('In a dialog / popin') : t('In the page'), t('first seen in scan {n}', { n: el.scan }), ...(el.present ? [] : [t('not on the page now')])].join(' · '),
    ),
    ...fact(t('Detected'), `${t(DETECTED_LABEL[detected])}${el.ignoredBy ? ` — ${el.ignoredBy}` : ''}`),
    ...fact(t('Accessible name'), el.accessibleName),
    ...(el.tag === 'img' || el.tag === 'input' || el.tag === 'area' ? fact('alt', el.alt, { missingIfNull: true, emptyHint: true }) : []),
    ...fact('aria-label', el.ariaLabel),
    ...fact('aria-labelledby', el.labelledByText),
    ...fact('title', el.title),
    ...(el.tag === 'svg' ? fact('<title>', el.svgTitle) : []),
    ...fact('role', el.role),
    ...fact('aria-hidden', el.ariaHidden ? t('true (self or parent)') : null),
    ...fact(t('In a link'), el.isInsideLink ? `${el.linkHref ?? ''}${el.linkText ? ` — “${el.linkText}”` : ''}` : null),
    ...fact(t('Caption'), el.figcaption),
    ...fact(t('Size'), el.naturalWidth ? `${el.naturalWidth} × ${el.naturalHeight}px` : null),
    ...fact(t('File'), el.src && !el.src.startsWith('data:') ? fileName(el.src) : null),
  )
  const cols = h('div', { class: 'cols' })
  const evidence = h('div', { class: 'col evidence' })
  const decision = h('div', { class: 'col decision' })
  cols.append(evidence, decision)
  evidence.append(
    h(
      'div',
      { class: 'card preview' },
      h('div', { class: 'preview-img' }, el.thumb ? h('img', { src: el.thumb, alt: t('Preview of image {id}', { id: el.id }) }) : h('span', { class: 'hint-line' }, t('No preview for <{type}>', { type: el.type }))),
      facts,
    ),
  )

  evidence.append(
    codeBlock(t('Image code'), el.html),
    codeBlock(t('Context (parent markup)'), el.contextHtml, t('Yellow line = the image. Orange attributes are the ones assistive technologies read.')),
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
      h('h3', {}, t('Notes')),
      h('textarea', {
        'aria-label': t('Notes for image {id}', { id: el.id }),
        placeholder: t('Why non-compliant, suggested alt text…'),
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
    h('h3', {}, missingAlt ? t('Error: no alt attribute') : t('Error: no accessible name on this <{type}>', { type: el.type })),
    h(
      'p',
      {},
      missingAlt
        ? t('This image has no alt attribute and no other name, and it is not hidden from assistive tech. Screen readers may read the file name. alt is also required by HTML (code validity, RGAA 8.2).')
        : t('This image has no accessible name and is not hidden from assistive tech.'),
    ),
    h(
      'p',
      { class: 'which' },
      ...tNodes('Which criterion fails depends on the image: {informative} if it is informative, {decorative} if it is decorative.', {
        informative: h('strong', {}, `1.1${t11 ? ` ${t('(test {id})', { id: t11 })}` : ''}`),
        decorative: h('strong', {}, `1.2${t12 ? ` ${t('(test {id})', { id: t12 })}` : ''}`),
      }),
    ),
    h(
      'div',
      { class: 'problem-actions' },
      h('button', { type: 'button', onclick: apply('informative', '1.1', missingAlt ? t('Missing alt attribute: add a text alternative that conveys the information.') : t('No accessible name: add a text alternative.')) }, t('It is informative → 1.1 Non-compliant')),
      h('button', { type: 'button', onclick: apply('decorative', '1.2', missingAlt ? t('Missing alt attribute: add alt="" (or aria-hidden) so assistive tech ignores this decorative image.') : t('Not hidden from assistive tech: add aria-hidden="true".')) }, t('It is decorative → 1.2 Non-compliant')),
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
      h('legend', {}, h('h3', {}, t('What is this image?'))),
      h('div', { class: 'segmented' }, ...option('informative', t('Informative')), ...option('decorative', t('Decorative'))),
      suggestedKind(el)
        ? h('p', { class: 'hint-line' }, t('Suggestion from the markup: {kind} ({detected}).', { kind: suggestedKind(el) === 'informative' ? t('informative') : t('decorative'), detected: t(DETECTED_LABEL[detectedOf(el)]).toLowerCase() }))
        : h('p', { class: 'hint-line warn' }, t('No text alternative and not hidden: decide whether it is informative (→ missing alternative) or decorative (→ not ignored).')),
      h(
        'p',
        { class: 'hint-line' },
        t('Informative: carries content or a function (logo, photo that illustrates, icon in a button…). Decorative: pure ornament that adds nothing.'),
      ),
    ),
  )
}

function renderCriteria(el: Item, review: ImageReview, host: HTMLElement): void {
  host.replaceChildren()
  const applicable = criteriaFor(review.kind)
  if (!applicable.length) {
    host.append(h('p', { class: 'hint-line' }, t('Choose informative or decorative to see the RGAA criteria that apply.')))
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
      h('span', { class: 'level', title: t('WCAG level {level}', { level: criterion.level }) }, t('Level {level}', { level: criterion.level })),
      h('a', { class: 'crit-link', href: criterionUrl(criterion.id), target: '_blank', rel: 'noreferrer' }, t('Official tests ↗')),
    ),
    h('p', { class: 'question' }, t(criterion.question)),
    h('p', { class: 'official' }, criterion.title),
    h('ul', { class: 'checks' }, ...criterion.checks.map((c) => h('li', {}, t(c)))),
    ...(hint ? [h('p', { class: `hint ${hint.tone}` }, hint.text)] : []),
    ...(review.auto ? [h('p', { class: 'hint info prefill-note' }, t('Pre-filled from the markup (alt="", aria-hidden or role="presentation"). Click Compliant to confirm the image really is decorative, or change the answer if the developer made a mistake.'))] : []),
    h(
      'fieldset',
      {},
      h('legend', { class: 'hint-line' }, t('Verdict for criterion {id}', { id: criterion.id })),
      h('div', { class: 'verdicts' }, ...verdict('c', t('Compliant')), ...verdict('nc', t('Non-compliant')), ...verdict('na', t('Not applicable'))),
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
    badge.textContent = t(STATUS_LABEL[statusOf(current)])
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
}


/* ------------------------------------------------------------------ */
/* Pages of the sample (P01, P02…)                                      */
/* ------------------------------------------------------------------ */

const pageSelect = $<HTMLSelectElement>('page-select')
const pageToolsEl = $('page-tools')
const progressEl = $('progress')
const nextBtn = $<HTMLButtonElement>('next-btn')
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
    manualChecks: rec.manualChecks,
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
  if (!audit.pages.length) pageSelect.append(h('option', { value: '' }, t('No page yet — add page 1 in “Audit pages sample”')))
  for (const p of audit.pages) {
    const input = pageInput(p)
    const rate = rateOf(auditStats([input]).perPage[0].counts)
    pageSelect.append(
      h('option', { value: p.id, selected: p.id === page?.id }, `${pageLabel(p)} · ${p.title || p.url} · ${t('{n} image(s)', { n: p.items.length })}${rate === null ? '' : ` · ${rate} %${isProvisional(countsOf(input)) ? ` (${t('provisional')})` : ''}`}`),
    )
  }
  pageSelect.disabled = !audit.pages.length
  pageToolsEl.hidden = !page
  nextBtn.disabled = !page
  progressEl.replaceChildren()
  if (page) {
    const c = countsOf(pageInput(page))
    const total = c.C + c.NC + c.NA + c.NT || 1
    const answered = c.C + c.NC + c.NA
    progressEl.append(
      h('span', {}, t('{done}/{total} criteria answered', { done: answered, total })),
      h('span', { class: 'meter', role: 'img', 'aria-label': t('Progress of {label}', { label: pageLabel(page) }) }, ...[['c', c.C], ['nc', c.NC], ['na', c.NA]].map(([k, n]) => h('i', { class: String(k), style: `width:${(Number(n) / total) * 100}%` }))),
    )
  }
  deletePageBtn.disabled = !page
  resetPageBtn.disabled = !page
  const onLive = Boolean(page && liveUrl && normalizeUrl(page.url) === normalizeUrl(liveUrl))
  liveUrlEl.textContent = liveUrl ? t('Browser: {url}', { url: liveUrl }) : ''
  liveUrlEl.title = liveUrl
  liveUrlEl.className = `live-url${onLive ? ' same' : ''}`
  scanBtn.disabled = !page
  scanBtn.textContent = page ? (scannedThisSession.has(page.id) ? t('Rescan {page}', { page: pageLabel(page) }) : t('Scan {page}', { page: pageLabel(page) })) : t('Scan')
  scanBtn.title = page
    ? t('Scan what the browser shows and merge the images into {page} (popins, tabs…)', { page: pageLabel(page) })
    : t('Add a page to the sample first')
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
  // you chose this page yourself: the “the browser is on another page” reminder no longer applies
  navBanner.hidden = true
  navDismissed = liveUrl && rec.url ? normalizeUrl(liveUrl) : ''
  setView(['sample', 'audit', 'audits', 'checks'].includes(view) ? 'review' : view)
  renderAll()
  persist()
  const label = pageLabel(rec)
  if (navigate && !rec.url) {
    showNavBanner(liveUrl)
    say(t('{label} has no address yet: open its page in the browser and click “Scan {label}”.', { label }))
  } else if (navigate && (!liveUrl || normalizeUrl(rec.url) !== normalizeUrl(liveUrl))) {
    goTo(rec.url)
    say(t('Opening {label} in the browser. Click “Scan {label}” once it has loaded.', { label }))
  } else {
    say(rec.items.length ? t('Viewing {label}.', { label }) : t('{label} is registered but not scanned yet. Open it in the browser and click “Scan {label}”.', { label }))
  }
}

function goTo(url: string): void {
  if (!url) return // an empty address would only reload the current page
  chrome.devtools.inspectedWindow.eval(`location.href = ${JSON.stringify(url)}`)
}

async function removePage(rec: PageRecord | null = page): Promise<void> {
  if (!rec) return
  const label = pageLabel(rec)
  if (!(await askConfirm(t('Remove {label}?', { label }), `${rec.title || rec.url}\n\n${t('The page and all its answers are deleted from the audit and the other pages are renumbered.')}`, t('Remove page')))) return
  audit.pages = audit.pages.filter((p) => p !== rec)
  scannedThisSession.delete(rec.id)
  if (page === rec) loadPage(audit.pages[0] ?? null)
  renderAll()
  persist()
  say(t('{label} removed from the audit.', { label }))
}

pageSelect.addEventListener('change', () => switchTo(pageSelect.value, true))
deletePageBtn.addEventListener('click', () => removePage())

/** The address the reminder was dismissed for (you chose a page yourself while the browser was there). */
let navDismissed = ''

function showNavBanner(url: string): void {
  navBannerBtn.hidden = false
  // the current page has lost its address
  if (page && !page.url && url) {
    const rec = page
    const owner = findPage(audit, url)
    if (owner && owner !== rec) {
      // the browser is on another page of the sample: say how to register this one, without offering a duplicate address
      navBannerText.textContent = t('{label} has no address. The browser is on {other}: open the page of {label} in the browser, then select {label} again.', { label: pageLabel(rec), other: pageLabel(owner) })
      navBannerBtn.hidden = true
      navBanner.hidden = false
      return
    }
    navBannerText.textContent = t('{label} has no address. The browser is on {url}.', { label: pageLabel(rec), url })
    navBannerBtn.textContent = t('Use this address for {label}', { label: pageLabel(rec) })
    navBannerBtn.onclick = () => {
      rec.url = normalizeUrl(url)
      adoptSite(rec.url)
      navBanner.hidden = true
      persist()
      renderAll()
      say(t('{label} now points to {url}.', { label: pageLabel(rec), url: rec.url }))
    }
    navBanner.hidden = false
    return
  }
  if (navDismissed && normalizeUrl(url) === navDismissed) return void (navBanner.hidden = true)
  const known = findPage(audit, url)
  if (known && known === page) return void (navBanner.hidden = true)
  if (known) {
    navBannerText.textContent = t('The browser is now on {label} ({title}).', { label: pageLabel(known), title: known.title || known.url })
    navBannerBtn.textContent = t('Switch to {label}', { label: pageLabel(known) })
    navBannerBtn.onclick = () => {
      navBanner.hidden = true
      switchTo(known.id)
    }
  } else {
    navBannerText.textContent = t('This URL is not in the sample yet.')
    navBannerBtn.textContent = t('Add it as {label}', { label: nextPageLabel() })
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
  const name = t(THEME_LABEL[n])
  if (!(await askConfirm(t('Reset {name} on {label}?', { name, label: pageLabel(rec) }), t('This removes what was scanned and every answer for this theme only. The other themes and the page itself are kept.'), t('Reset {name}', { name })))) return
  resetThemeData(rec, n)
  findingSel = null
  loadPage(rec)
  void clearBoxes(n)
  renderAll()
  persist()
  say(t('{name} reset on {label}.', { name, label: pageLabel(rec) }))
}

async function resetPage(rec: PageRecord | null = page): Promise<void> {
  if (!rec) return
  const label = pageLabel(rec)
  if (!(await askConfirm(t('Reset {label}?', { label }), `${rec.title || rec.url}\n\n${t('This clears its scans and every answer, in all themes. Its URL, title and chosen themes are kept.')}`, t('Reset page')))) return
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
  say(t('{label} reset. Scan it again when you are ready.', { label }))
}

async function resetAudit(): Promise<void> {
  if (!(await askConfirm(t('Reset the whole audit?'), t('This deletes all {n} page(s), their scans and answers, and the site, auditor and context fields. It cannot be undone.', { n: audit.pages.length }), t('Delete everything')))) return
  const fresh = emptyAudit(audit.name)
  audit = { ...fresh, id: audit.id, createdAt: audit.createdAt }
  scannedThisSession.clear()
  findingSel = null
  theme = 1
  loadPage(null)
  void clearBoxes()
  setView('review')
  renderAll()
  persist()
  say(t('The audit was reset. Add the first page of your sample to start again.'))
}

resetPageBtn.addEventListener('click', () => resetPage())

/* ------------------------------------------------------------------ */
/* Views: review | page results | audit overview                        */
/* ------------------------------------------------------------------ */

type View = 'review' | 'page' | 'audit' | 'sample' | 'audits' | 'checks'
let view: View = 'review'

function setView(next: View): void {
  view = next
  resultsEl.hidden = next !== 'page'
  auditEl.hidden = next !== 'audit'
  sampleEl.hidden = next !== 'sample'
  auditsEl.hidden = next !== 'audits'
  checksEl.hidden = next !== 'checks'
  checksBtn.setAttribute('aria-pressed', String(next === 'checks'))
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
  if (next === 'audits') void renderAuditsView()
  if (next === 'checks') renderChecks()
  renderAuditBar()
}


function setScanned(): void {
  const has = elements.length > 0
  clearBtn.disabled = !has && !(page?.findings.length)
  boxesBtn.disabled = !has && !(page?.findings.length)
  resultsBtn.disabled = !has
  auditBtn.disabled = !audit.pages.length
  checksBtn.disabled = !page
  autoBtn.disabled = !page || axeRunning
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
  const box = h('details', { class: 'themes-menu' }, h('summary', {}, t('Themes ({n})', { n: rec.themes.length })))
  const list = h('div', { class: 'menu', role: 'group', 'aria-label': t('Themes audited on {label}', { label: pageLabel(rec) }) })
  for (const th of THEMES) {
    list.append(
      h(
        'label',
        { class: 'menu-item' },
        h('input', {
          type: 'checkbox',
          checked: rec.themes.includes(th.number),
          onchange: (e: Event) => {
            const on = (e.target as HTMLInputElement).checked
            if (!on && rec.themes.length === 1) {
              ;(e.target as HTMLInputElement).checked = true
              return void say(t('Keep at least one theme.'))
            }
            setThemes(rec, on ? [...rec.themes, th.number] : rec.themes.filter((n) => n !== th.number))
          },
        }),
        h('span', {}, `${th.number}. ${t(THEME_LABEL[th.number])}`),
        h('span', { class: 'menu-kind' }, SCANNED_THEMES.has(th.number) ? t('scan + review') : t('{n} criteria', { n: th.criteria.length })),
      ),
    )
  }
  list.append(
    h(
      'div',
      { class: 'menu-actions' },
      h('button', { type: 'button', class: 'img-ref', onclick: () => setThemes(rec, THEMES.map((th) => th.number)) }, t('All 13')),
      h('button', { type: 'button', class: 'img-ref', onclick: () => setThemes(rec, [1]) }, t('Images only')),
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
  const tabs = h('div', { class: 'theme-tabs', role: 'tablist', 'aria-label': t('RGAA themes of this page') })
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
          title: t('{n}. {name} (its boxes on the page use this colour)', { n, name: t(THEME_LABEL[n]) }),
          onclick: () => {
            theme = n
            findingFilter = 'all'
            setView('review')
            renderThemeBar()
            renderStats()
          },
        },
        h('span', { class: 'tn' }, String(n)),
        ` ${t(THEME_LABEL[n])} `,
        h('span', { class: 'tp' }, `${done}/${total}`),
      ),
    )
  }
  themebarEl.append(
    tabs,
    h('button', { type: 'button', class: 'ghost-btn danger', title: t('Clear the scan and the answers of {name} on this page only', { name: t(THEME_LABEL[theme]) }), onclick: () => resetTheme() }, t('Reset {name}', { name: t(THEME_LABEL[theme]) })),
    themesMenu(rec),
  )
}

/** Checklist themes: one card per official criterion with a verdict and a note. */
function perFindingIds(): string[] {
  return findingCriterionIds(theme)
}

/** What the automatic checks found for a criterion (or that none covers it, once they have been run on the page). */
function autoHints(answer: ChecklistAnswer): HTMLElement[] {
  const entries = Object.entries(answer.autoResults ?? {})
  if (!entries.length) return (page?.imports?.length ?? 0) > 0 ? [h('p', { class: 'hint-line' }, t('No automatic check covers this criterion.'))] : []
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

const VERDICT_WORD: Record<ChecklistVerdict, string> = { c: 'Compliant', nc: 'Non-compliant', na: 'Not applicable' }

function renderChecklist(host: HTMLElement = themeEl): void {
  const def = themeByNumber(theme)
  if (!page || !def) return
  const rec = page
  const result = pageInput(rec).themes.find((t) => t.number === theme)!
  const autoLabel = { auto: t('Automatic'), semi: t('Semi-automatic'), manual: t('Manual') } as const

  host.append(
    h(
      'div',
      { class: 'results-head' },
      h(
        'div',
        {},
        h('h2', {}, FINDING_THEMES.has(theme) ? t('Other criteria of this theme') : `${def.number}. ${def.name}`),
        ...(FINDING_THEMES.has(theme) ? [] : [h('div', { class: 'theme-summary', 'data-theme': String(theme), 'aria-label': t('Totals') })]),
        h('p', { class: 'hint-line' }, FINDING_THEMES.has(theme) ? t('Criteria {ids} are not detectable by a script: check them on {url}.', { ids: def.criteria.filter((x) => !perFindingIds().includes(x.id)).map((x) => x.id).join(', '), url: rec.url }) : t('{n} criteria. Check them on {url} and answer each one. Nothing to scan for this theme.', { n: def.criteria.length, url: rec.url })),
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
          confirmVerdict(answer, value) // the auditor's answer replaces any tool suggestion
          card.querySelector('.source-note')?.remove()
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
              h('button', { type: 'button', class: 'ghost-btn', onclick: () => { confirmVerdict(answer, answer.suggested!); persist(); renderAll() } }, t('Confirm')),
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

/* ------------------------------------------------------------------ */
/* Frames (2) and colours (3): scanned, reviewed finding by finding      */
/* ------------------------------------------------------------------ */

let findingSel: number | null = null

const toolsEl = $('tools')
const imagesHeadEl = $('images-head')

/** Buttons that act on the boxes of the current theme live in that theme's own toolbar. */
function updateTools(): void {
  setPageToolsTheme(theme)
  void applyBoxes()
  const reviewing = Boolean(page) && view === 'review'
  imagesHeadEl.hidden = !(reviewing && theme === 1)
  // the toolbar belongs to the theme being shown: Images has its header, the other themes put it in theirs
  if (theme === 1) imagesHeadEl.append(toolsEl)
  toolsEl.hidden = !(reviewing && SCANNED_THEMES.has(theme))
}

function keyOfFinding(theme: number, f: RawFinding): string {
  if (theme === 2) return `2|${f.type}|${f.facts.src ?? ''}|${hash(f.contextHtml)}`
  if (theme === 3) return `3|${f.type}|${f.label}|${f.facts['Font size'] ?? ''}`
  return `${theme}|${f.type}|${f.label}|${f.summary}|${hash(f.html)}`
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
  say(t('Finding #{id} removed from the audit.', { id: f.id }))
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
  const answers = findingCriteriaOf(f).map((c) => page!.findingReviews[f.key]?.answers[c.id])
  if (answers.includes('nc')) return 'nc'
  if (answers.every((a) => a === undefined)) return 'todo'
  return answers.some((a) => a === undefined) ? 'progress' : 'c'
}

const focusFinding = (f: FindingItem, scroll: boolean) => {
  if (scroll && f.type === 'contrast-ok') say(t('This line stands for every text that passes: there is nothing to show on the page.'))
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
      say(t('Taking previews… {done}/{total}', { done, total: list.length }))
      const loc = await sendToPage(tabId, { type: 'RGAA_LOCATE', theme: f.theme, id: f.id }).catch(() => null)
      if (!loc?.rect) continue
      await sleep(180)
      const cap = await chrome.runtime.sendMessage({ type: 'RGAA_CAPTURE', tabId })
      if (!cap?.dataUrl) {
        say(t('Could not take previews ({error}). Check that the extension may access this site.', { error: cap?.error ?? t('no screenshot') }))
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

type FindingFilter = 'all' | 'hidden' | 'link-skip' | 'field-nolabel' | 'field-placeholder' | 'table-nohead' | 'table-layout' | 'review' | 'contrast-fail' | 'contrast-unknown' | 'link-empty' | 'link-generic' | 'headings' | 'landmarks'
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
  // a link with a usable name is pre-filled compliant and does not ask for attention; empty or generic ones do
  if (f.theme === 6 && (f.type === 'link' || f.type === 'link-skip')) return false
  if (f.theme === 9 && (f.type === 'heading' || f.type === 'landmark')) return false
  if (f.theme === 11 && f.type === 'field') return false
  if (f.theme === 5 && (f.type === 'table-layout' || (f.type === 'table-data' && !f.facts.Title))) return false
  const ids = findingCriteriaOf(f).map((c) => c.id)
  return ids.some((c) => r?.answers[c] === undefined) || Boolean(r?.auto)
}

function findingMatches(f: FindingItem, value: FindingFilter): boolean {
  if (value === 'all') return true
  if (value === 'review') return findingNeedsReview(f)
  if (value === 'hidden') return Boolean(f.data.hidden)
  if (value === 'link-skip') return f.type === 'link-skip' || f.type === 'link-skip-broken'
  if (value === 'headings') return f.data.group === 'heading'
  if (value === 'landmarks') return f.data.group === 'landmark'
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
  keepScroll(themeEl, () => {
    themeEl.replaceChildren()
    if (FINDING_THEMES.has(theme)) renderFindingsView()
    else renderChecklist()
    renderSummaries()
  })
}

function renderFindingsView(): void {
  const def = themeByNumber(theme)
  if (!page || !def) return
  const rec = page
  const list = listedFindings(theme)
  const passing = rec.findings.find((f) => f.theme === 3 && f.type === 'contrast-ok')
  const scanned = rec.scannedThemes.includes(theme)
  const label = pageLabel(rec)
  themeEl.append(
    h(
      'div',
      { class: 'results-head' },
      h(
        'div',
        {},
        h('h2', {}, `${def.number}. ${def.name}`),
        h('p', { class: 'hint-line' }, theme === 2 ? t('Every iframe / frame of the page, with its title.') : theme === 6 ? t('Every link of the page (identical links are grouped), with its name and destination. Links with no name or a generic text are boxed on the page.') : theme === 5 ? t('Every table of the page: data tables (with their header cells and title) and layout tables. Click one to find it on the page.') : theme === 11 ? t('Every form field of the page, with the name a screen reader would give it. Fields with no label, or only a placeholder, are boxed on the page.') : theme === 9 ? t('The outline of the page, like a headings map: headings with their level, and the landmarks, in reading order. Click one to find it on the page; skipped levels and missing areas are flagged.') : t('Only the texts that fail or that a script cannot judge are numbered and boxed on the page. Criteria 3.1 and 3.3 need your eyes (below).')),
        h('div', { class: 'theme-summary', 'data-theme': String(theme), 'aria-label': t('Totals') }),
      ),
      h('div', { class: 'nav' }, toolsEl),
    ),
  )
  if (!scanned) {
    themeEl.append(h('p', { class: 'hint-line' }, t('Not scanned yet. Open {url} in the browser and click “Scan {label}”.', { url: rec.url, label })))
  } else if (!list.length) {
    themeEl.append(h('p', { class: 'hint-line' }, theme === 3 && passing ? t('No text with a contrast problem found: {summary}.', { summary: tDyn(passing.summary) }) : theme === 2 ? t('No frames found on the page at the last scan: criteria are not applicable.') : theme === 6 ? t('No links found on the page at the last scan: criteria are not applicable.') : theme === 9 ? t('No heading or landmark found on the page at the last scan.') : theme === 5 ? t('No table found on the page at the last scan: criteria are not applicable.') : theme === 11 ? t('No form field found on the page at the last scan: criteria are not applicable.') : t('No text colours found on the page at the last scan: criteria are not applicable.')))
  } else {
    const options: [FindingFilter, string][] =
      theme === 3
        ? [['all', 'All'], ['review', 'To review'], ['contrast-fail', 'Fail'], ['contrast-unknown', 'Check by eye']]
        : theme === 6
          ? [['all', 'All'], ['review', 'To review'], ['link-empty', 'No name'], ['link-generic', 'Generic text'], ['link-skip', 'Skip links'], ['hidden', 'Hidden content']]
          : theme === 9
            ? [['all', 'All'], ['review', 'To review'], ['headings', 'Headings'], ['landmarks', 'Landmarks'], ['hidden', 'Hidden content']]
            : theme === 11
              ? [['all', 'All'], ['review', 'To review'], ['field-nolabel', 'No label'], ['field-placeholder', 'Placeholder only'], ['hidden', 'Hidden content']]
              : theme === 5
                ? [['all', 'All'], ['review', 'To review'], ['table-nohead', 'No header cell'], ['table-layout', 'Layout tables'], ['hidden', 'Hidden content']]
                : [['all', 'All'], ['review', 'To review']]
    if (!options.some(([v]) => v === findingFilter)) findingFilter = 'all'
    const shown = list.filter((f) => findingMatches(f, findingFilter))
    if (!shown.some((f) => f.id === findingSel)) findingSel = shown[0]?.id ?? null
    const chips = h('div', { class: 'filters', role: 'group', 'aria-label': t('Filter findings') })
    for (const [value, text] of options) {
      const n = list.filter((f) => findingMatches(f, value)).length
      chips.append(
        h(
          'button',
          { type: 'button', class: 'chip', 'data-value': value, 'aria-pressed': String(findingFilter === value), onclick: () => { findingFilter = value; renderThemeView(); void syncFilterBoxes() } },
          `${t(text)} `,
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
              ...(f.data.group === 'heading' ? { style: `margin-left:${(Number(f.data.level) - 1) * 12}px` } : {}),
              'data-kind': f.type,
              'data-status': st,
              'aria-current': String(f.id === findingSel),
              onclick: () => {
                findingSel = f.id
                renderThemeView()
                void focusFinding(f, true)
              },
            },
            f.shot ? h('img', { class: 'shot', src: f.shot, alt: '' }) : null,
            h('span', { class: 'num' }, `#${f.id}`),
            h('span', { class: 'main' }, h('span', { class: `alt${bad ? ' missing' : ''}` }, tDyn(f.label), f.data.humanNeeded ? h('span', { class: 'type error' }, t('check by eye')) : null, f.data.hidden === 'visually-hidden' ? h('span', { class: 'type popin', title: t('Visually hidden: read by screen readers only') }, t('hidden')) : f.data.hidden === 'aria-hidden' ? h('span', { class: 'type popin', title: t('Hidden from assistive technologies (aria-hidden)') }, 'aria-hidden') : null, f.type === 'link-skip' || f.type === 'link-skip-broken' ? h('span', { class: 'type new' }, t('skip link')) : null), h('span', { class: 'alt' }, tDyn(f.summary))),
            h('span', { class: `dot ${st === 'todo' ? '' : st}`, role: 'img', 'aria-label': t(STATUS_LABEL[st]), title: t(STATUS_LABEL[st]) }),
          ),
        ),
      )
    }
    const f = list.find((x) => x.id === findingSel)
    themeEl.append(h('div', { class: 'finding-layout' }, h('nav', { class: 'finding-pane', 'aria-label': t('{name} findings', { name: def.name }) }, chips, ...(theme === 3 && passing ? [h('p', { class: 'hint-line' }, t('Not listed — {summary} pass.', { summary: tDyn(passing.summary) }))] : []), listEl2), f ? findingDetail(f) : h('p', { class: 'hint-line' }, t('Nothing in this category.'))))
  }
  if ((themeByNumber(theme)?.criteria ?? []).some((c) => !findingCriterionIds(theme).includes(c.id))) {
    const rest = h('div', { class: 'theme-rest' })
    renderChecklist(rest)
    themeEl.append(rest)
  }
}

function findingDetail(f: FindingItem): HTMLElement {
  const review = findingReview(f)
  const facts = h('dl', { class: 'facts' })
  for (const [k, v] of Object.entries(f.facts)) {
    facts.append(h('dt', {}, t(k)), h('dd', { class: v === null ? 'missing' : '' }, v === null ? '—' : tDyn(v)))
  }
  const cards = findingCriteriaOf(f).map((c) => findingCard(f, review, c))
  if (f.theme === 3 && f.type !== 'contrast-ok') cards.unshift(contrastChecker(f, review))
  const evidence = h(
    'div',
    { class: 'col evidence' },
    h(
      'div',
      { class: 'card' },
      h('h3', {}, `#${f.id} — ${tDyn(f.label)}`),
      ...(f.shot ? [h('img', { class: 'shot-large', src: f.shot, alt: t('Preview of finding {id}', { id: f.id }) })] : []),
      facts,
      ...(f.present
        ? []
        : [
            h('p', { class: 'hint warn' }, t('Not found at the last scan (hidden, removed or changed). It still counts in the audit until you remove it.')),
            h('button', { type: 'button', class: 'img-ref nc', onclick: () => removeFinding(f) }, t('Remove from the audit')),
          ]),
    ),
  )
  if (f.html) evidence.append(codeBlock(t('Markup'), f.html), codeBlock(t('Context (parent markup)'), f.contextHtml, t('Yellow line = the element.')))
  const decision = h(
    'div',
    { class: 'col decision' },
    ...cards,
    h('div', { class: 'card' }, h('h3', {}, t('Notes')), h('textarea', {
      id: `fnd-note-${f.id}`,
      'aria-label': t('Notes for finding {id}', { id: f.id }),
      placeholder: t('What to fix, where…'),
      value: review.note,
      oninput: (e: Event) => { review.note = (e.target as HTMLTextAreaElement).value; persist() },
    })),
  )
  return h('section', { class: 'finding-detail', 'aria-label': t('Finding {id}', { id: f.id }) }, h('div', { class: 'cols' }, evidence, decision))
}

/** Reads a colour on the page: the page shows a magnifier with the hex, and sends back the colour you click. */
async function pickColorFromPage(): Promise<string | null> {
  say(t('Move over the page and click the colour (Esc to cancel). The magnifier shows its hex.'))
  try {
    const r = await sendToPage(inspectedTabId(), { type: 'RGAA_PICK_START' })
    if (typeof r.hex === 'string') {
      say(t('Picked {hex}.', { hex: r.hex }))
      return r.hex
    }
    say(r.error ? t('Could not take a screenshot ({error}). Check that the extension may access this site.', { error: r.error }) : t('Colour pick cancelled.'))
  } catch (err) {
    say(t('Could not pick a colour: reload the tab and try again.'))
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
    const vars = { fg: out.fg, bg: out.bg, ratio: out.ratio.toFixed(2), threshold: out.threshold }
    review.note = out.large ? t('Contrast too low: text {fg} on {bg} = {ratio}:1, large text needs {threshold}:1.', vars) : t('Contrast too low: text {fg} on {bg} = {ratio}:1, normal text needs {threshold}:1.', vars)
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
      result.textContent = !fg && !bg ? t('Fill the text and background colours: use “Pick on page”, or type a hex value.') : !fg ? t('Fill the text colour: use “Pick on page”, or type a hex value.') : t('Fill the background colour: use “Pick on page”, or type a hex value.')
      return
    }
    const ratio = contrastRatio(fg, bg)
    const ok = ratio >= threshold
    result.className = `hint ${ok ? 'ok' : 'warn'}`
    const vars = { ratio: ratio.toFixed(2), threshold }
    result.textContent = ok ? t('{ratio}:1 — passes: marked Compliant (needs {threshold}:1).', vars) : t('{ratio}:1 — fails: marked Non-compliant, problem written in the notes (needs {threshold}:1).', vars)
  }

  const row = (label: string, key: 'fg' | 'bg', scripted: string) => {
    const input = h('input', { type: 'text', class: 'hex', value: review[key] ?? scripted, placeholder: '#RRGGBB', 'aria-label': key === 'fg' ? t('Text colour (hex)') : t('Background colour (hex)'), spellcheck: false })
    const swatch = h('span', { class: 'swatch', role: 'img', 'aria-label': key === 'fg' ? t('Text colour preview') : t('Background colour preview') })
    const source = h('span', { class: 'hint-line' })
    const refresh = () => {
      const c = parseHex(input.value)
      swatch.style.background = c ? toHex(c) : 'repeating-conic-gradient(#ccc 0 25%, #fff 0 50%) 0 0 / 10px 10px'
      source.textContent = review[key] ? t('set by hand') : scripted ? t('read from the page') : t('not found: pick it')
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
        result.textContent = t('Type a hex colour like #1A2B3C.')
      }
    })
    const pick = h('button', { type: 'button', class: 'img-ref', onclick: async () => {
      const hexValue = await pickColorFromPage()
      if (!hexValue) return
      input.value = hexValue
      set(hexValue)
    } }, t('Pick on page'))
    const reset = scripted ? h('button', { type: 'button', class: 'img-ref', onclick: () => { input.value = scripted; set(undefined) } }, t('Reset')) : null
    refresh()
    return h('div', { class: 'color-row' }, h('span', { class: 'color-label' }, label), swatch, input, pick, reset, source)
  }

  card.append(
    h('h3', {}, t('Contrast checker')),
    h('p', { class: 'hint-line' }, t('Click “Pick on page”, then click right next to the text (for the background) or on a letter stroke (for the text).')),
    row(t('Text'), 'fg', scriptFg),
    row(t('Background'), 'bg', scriptBg),
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
    h('div', { class: 'criterion-head' }, h('span', { class: 'crit-id' }, `RGAA ${c.id}`), h('span', { class: 'level' }, t('Level {level}', { level: c.level })), h('a', { class: 'crit-link', href: `https://accessibilite.numerique.gouv.fr/methode/criteres-et-tests/#${c.id}`, target: '_blank', rel: 'noreferrer' }, t('Official tests ↗'))),
    h('p', { class: 'question' }, t(c.question)),
    h('ul', { class: 'checks' }, ...c.checks.map((x) => h('li', {}, t(x)))),
    ...(hint ? [h('p', { class: `hint ${hint.tone}` }, hint.text)] : []),
    ...(review.auto && review.answers[c.id] !== undefined ? [h('p', { class: 'hint info prefill-note' }, t('Pre-filled from the page. Click your answer to confirm it, or change it.'))] : []),
    h('fieldset', {}, h('legend', { class: 'hint-line' }, t('Verdict for criterion {id}', { id: c.id })), h('div', { class: 'verdicts' }, ...verdict('c', t('Compliant')), ...verdict('nc', t('Non-compliant')), ...verdict('na', t('Not applicable')))),
  )
  return card
}

function renderEmpty(): void {
  const onPage = Boolean(page && liveUrl && normalizeUrl(page.url) === normalizeUrl(liveUrl))
  emptyAddBtn.hidden = Boolean(page)
  emptyGoBtn.hidden = !page || onPage
  if (!page) {
    emptyTitle.textContent = t('Start by registering the pages of your sample')
    emptyText.textContent = t('Open the first page in the browser and add it as page 1. You scan it afterwards, when you are ready.')
    emptyAddBtn.textContent = t('Add the current URL as {label}', { label: nextPageLabel() })
  } else {
    const label = pageLabel(page)
    emptyTitle.textContent = t('{label} is registered, not scanned yet', { label })
    emptyText.textContent = onPage
      ? t('The browser is on {url}. Click “Scan {label}” to list its images.', { url: page.url, label })
      : t('Open {url} in the browser, then click “Scan {label}”.', { url: page.url, label })
    emptyGoBtn.textContent = t('Open {label} in the browser', { label })
  }
  const strong = (text: string) => h('strong', {}, text)
  $('empty-steps').replaceChildren(
    h('li', {}, ...tNodes('Register each page in {sample} (P01, P02…), with its URL.', { sample: strong(t('Audit pages sample')) })),
    h('li', {}, ...tNodes('Select a page in the {page} list: the browser opens it. Click {scan}.', { page: strong(t('Page')), scan: strong(t('Scan')) })),
    h('li', {}, ...tNodes('Open a popin or a tab and click {rescan}: its images join the same page.', { rescan: strong(t('Rescan')) })),
  )
}

emptyAddBtn.addEventListener('click', () => void addPage(liveUrl))
emptyGoBtn.addEventListener('click', () => page && goTo(page.url))
sampleBtn.addEventListener('click', () => setView(view === 'sample' ? 'review' : 'sample'))

/** Registers a page of the sample without scanning it. */
async function addPage(url: string, title?: string): Promise<void> {
  const target = url || liveUrl
  if (!target) return void say(t('No URL to add: open a page in the browser first.'))
  const known = findPage(audit, target)
  if (known) {
    say(t('{label} already uses this URL.', { label: pageLabel(known) }))
    return void switchTo(known.id)
  }
  const rec = createPage(audit, target, title ?? ((await inspectedTitle()) || target))
  adoptSite(rec.url)
  loadPage(rec)
  persist()
  setView(view === 'sample' ? 'sample' : 'review')
  renderAll()
  say(t('{label} registered. It is not scanned yet: open it in the browser and click “Scan {label}”.', { label: pageLabel(rec) }))
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
      h('div', {}, h('h2', {}, t('Audit pages sample')), h('p', { class: 'hint-line' }, t('Register each page and its URL here, then scan them one by one. P01, P02… follow this order.'))),
      h('div', { class: 'nav' }, h('button', { type: 'button', onclick: () => setView('review') }, t('← Back to review')), h('button', { type: 'button', onclick: () => setView('audit') }, t('Audit pages overview')), h('button', { type: 'button', class: 'danger-btn', disabled: !audit.pages.length && !audit.meta.site && !audit.meta.auditor, title: t('Delete every page and the audit fields'), onclick: () => resetAudit() }, t('Reset the whole audit'))),
    ),
    h('div', { class: 'sample-meta' }, field(t('Site'), 'site', t('Name of the site')), field(t('Auditor'), 'auditor', t('First name Last name')), field(t('Context'), 'context', t('Initial visit'))),
  )

  const table = h('table', { class: 'results-table sample-table' })
  table.append(
    h('caption', { class: 'sr-only' }, t('Pages of the sample')),
    h('thead', {}, h('tr', {}, ...['Page', 'Title', 'URL', 'Themes', 'Images', 'Scans', 'Actions'].map((name) => h('th', { scope: 'col' }, t(name))))),
  )
  const body = h('tbody', {})
  audit.pages.forEach((rec, i) => {
    const label = pageLabel(rec)
    const urlInput = h('input', {
      type: 'url',
      value: rec.url,
      'aria-label': t('URL of {label}', { label }),
      onchange: (e: Event) => {
        const value = (e.target as HTMLInputElement).value.trim()
        const clash = findPage(audit, value)
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
        { class: rec === page ? 'current' : '' },
        h('th', { scope: 'row' }, label),
        h('td', {}, h('input', { type: 'text', value: rec.title, 'aria-label': t('Title of {label}', { label }), oninput: (e: Event) => { rec.title = (e.target as HTMLInputElement).value; persist() }, onchange: () => renderPageBar() })),
        h('td', {}, urlInput),
        h('td', {}, themesMenu(rec)),
        h('td', {}, String(rec.items.length)),
        h('td', {}, String(rec.scanCount)),
        h(
          'td',
          { class: 'row-actions' },
          h('button', { type: 'button', class: 'img-ref', onclick: () => switchTo(rec.id, true) }, t('Open page')),
          h('button', { type: 'button', class: 'img-ref', title: t('Use the URL the browser is on now'), onclick: () => { if (!liveUrl) return; rec.url = normalizeUrl(liveUrl); persist(); renderSample(); renderPageBar() } }, t('Use current URL')),
          h('button', { type: 'button', class: 'img-ref', 'aria-label': t('Move {label} up', { label }), disabled: i === 0, onclick: () => movePage(rec, -1) }, '↑'),
          h('button', { type: 'button', class: 'img-ref', 'aria-label': t('Move {label} down', { label }), disabled: i === audit.pages.length - 1, onclick: () => movePage(rec, 1) }, '↓'),
          h('button', { type: 'button', class: 'img-ref', title: t('Clear its scans and answers, keep the page'), onclick: () => resetPage(rec) }, t('Reset')),
          h('button', { type: 'button', class: 'img-ref nc', onclick: () => removePage(rec) }, t('Remove')),
        ),
      ),
    )
  })
  table.append(body)
  sampleEl.append(h('div', { class: 'results-scroll' }, table))

  const urlNew = h('input', { type: 'url', value: liveUrl, placeholder: 'https://…', 'aria-label': t('URL of the new page') })
  const titleNew = h('input', { type: 'text', placeholder: t('Title (optional)'), 'aria-label': t('Title of the new page') })
  sampleEl.append(
    h(
      'div',
      { class: 'card add-page' },
      h('h3', {}, t('Add page {label}', { label: nextPageLabel() })),
      h('div', { class: 'add-row' }, urlNew, titleNew,
        h('button', { type: 'button', class: 'img-ref', onclick: () => { urlNew.value = liveUrl } }, t('Use current URL')),
        h('button', { type: 'button', class: 'primary', onclick: () => void addPage(urlNew.value.trim(), titleNew.value.trim() || undefined) }, t('Add to the sample'))),
      h('p', { class: 'hint-line' }, t('Adding a page does not scan it. Select it, open it in the browser, then click Scan.')),
    ),
  )
}

/* ------------------------------------------------------------------ */
/* Sheets in the browser (same content as the .xlsx)                    */
/* ------------------------------------------------------------------ */

let activeSheet = 0

function tabsFor(host: HTMLElement, tabs: { name: string; render: () => HTMLElement }[]): void {
  const bar = h('div', { class: 'sheet-tabs', role: 'tablist', 'aria-label': t('Sections') })
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
      if ('image' in c && c.image) cell.append(h('img', { class: 'sheet-thumb', src: c.image, alt: t('Image preview'), loading: 'lazy' }))
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

async function exportWorkbook(pages: PageInput[], sheets: Sheet[], fileName: string): Promise<void> {
  try {
    say(t('Building the Excel file with image previews…'))
    const sources = pages.flatMap((p, pi) => [
      ...p.images.map((el) => ({ id: thumbKey(pi, el.id), source: el.thumb })),
      ...p.findings.map((f) => ({ id: thumbKey(pi, 50000 + f.theme * 1000 + f.id), source: f.shot ?? null })),
    ])
    const thumbs = await makeThumbs(sources)
    download(buildWorkbook(sheets, thumbs) as BlobPart, XLSX_TYPE, fileName)
    say(t('Excel grid exported ({pages} page(s), {n}/{total} image previews).', { pages: pages.length, n: thumbs.size, total: sources.length }))
  } catch (err) {
    say(t('Could not build the Excel file.'))
    console.error(err)
  }
}

/* ------------------------------------------------------------------ */
/* Page results                                                         */
/* ------------------------------------------------------------------ */

/** Why a rate is marked provisional, and how criteria with unconfirmed or partial results are counted. */
const PROVISIONAL_HELP = (): string =>
  t('Provisional rate: some criteria are still to test, are only partly covered by this tool, or rest on an automatic answer you have not confirmed. A criterion judged on only part of its tests keeps its result but keeps the rate provisional; a suggested compliance counts as to review until you confirm it; a failure is always kept.')

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
        h('button', { type: 'button', onclick: () => setView('review') }, t('← Back to review')),
        h('button', { type: 'button', onclick: () => setView('audit') }, t('Audit pages overview')),
        h('button', { type: 'button', class: 'primary', onclick: () => void exportWorkbook([input], auditSheets([input], audit.meta), `grille-rgaa-${slugOf(audit.meta.site || audit.name)}-${pageLabel(page!)}.xlsx`) }, t('Export this page (.xlsx)')),
      ),
    ),
    h(
      'div',
      { class: 'results-summary' },
      h('div', { class: 'rate' }, h('strong', {}, stat.rate === null ? '—' : `${stat.rate}%`), ...(stat.rate !== null && isProvisional(stat.counts) ? [h('span', { class: 'pill warn-pill', title: PROVISIONAL_HELP() }, t('provisional'))] : []), h('span', {}, t('accessibility rate of {label} (C ÷ (C + NC), themes {themes})', { label: pageLabel(page), themes: stat.themes.join(', ') }))),
      pill('c', t('{n} compliant', { n: stat.counts.C })),
      pill('nc', t('{n} non-compliant', { n: stat.counts.NC })),
      pill('na', t('{n} not applicable', { n: stat.counts.NA })),
      pill('pending', t('{n} not tested', { n: stat.counts.NT })),
      ...(stat.counts.suggested ? [pill('pending', t('{n} to confirm', { n: stat.counts.suggested }))] : []),
      ...(stat.counts.partial ? [pill('pending', t('{n} partly covered', { n: stat.counts.partial }))] : []),
    ),
    ...(isProvisional(stat.counts) ? [h('p', { class: 'hint warn' }, PROVISIONAL_HELP())] : []),
  )
  const sheets = pageSheets(input)
  tabsFor(resultsEl, sheets.map((sheet) => ({ name: sheet.name === pageLabel(page!) ? t('Grid ({label})', { label: pageLabel(page!) }) : sheet.name, render: () => sheetTable(sheet) })))
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
      { class: 'donut', style: `--c:${c}`, role: 'img', 'aria-label': cPct === null ? t('{label}: no data', { label }) : t('{label}: {c} compliant, {nc} non-compliant', { label, c: pct2(cPct), nc: pct2(100 - cPct) }) },
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
  svg.setAttribute('aria-label', levels.map((l) => t('{level}: {rate} compliant', { level: l, rate: pct2(rateExact(perLevel[l])) })).join('; '))
  const add = (tag: string, attrs: Record<string, string | number>, text?: string) => {
    const node = document.createElementNS(NS, tag)
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v))
    if (text) node.textContent = text
    svg.append(node)
    return node
  }
  for (const tick of [0, 25, 50, 75, 100]) {
    const y = 8 + plotH - (tick / 100) * plotH
    add('line', { x1: left, x2: W, y1: y, y2: y, class: 'grid-line' })
    add('text', { x: left - 4, y: y + 3, 'text-anchor': 'end', class: 'axis' }, `${tick}%`)
  }
  levels.forEach((l, i) => {
    const c = perLevel[l]
    const total = c.C + c.NC
    const cp = total ? (c.C / total) * 100 : 0
    const np = total ? (c.NC / total) * 100 : 0
    const x = left + i * group + group / 2
    add('rect', { x: x - 22, y: 8 + plotH - (cp / 100) * plotH, width: 20, height: Math.max(0, (cp / 100) * plotH), class: 'bar c' })
    add('rect', { x: x + 2, y: 8 + plotH - (np / 100) * plotH, width: 20, height: Math.max(0, (np / 100) * plotH), class: 'bar nc' })
    add('text', { x, y: H - 8, 'text-anchor': 'middle', class: 'axis' }, t('Level {level}', { level: l }))
  })
  return h('figure', { class: 'chart' }, h('figcaption', {}, t('Compliance by level')), svg as unknown as Node, h('div', { class: 'legend' }, h('span', { class: 'lg c' }, 'C'), h('span', { class: 'lg nc' }, 'NC')))
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
      miniTable(t('RGAA 4 compliance'), ['', 'C', 'NC'], [['A', cOf(lv.perLevel.A), nOf(lv.perLevel.A)], [t('AA (legal)'), cOf(lv.legal), nOf(lv.legal)], ['AAA', cOf(lv.perLevel.AAA), nOf(lv.perLevel.AAA)]], 'level-table'),
      ...(isProvisional(lv.legal) ? [h('p', { class: 'hint warn' }, `${t('provisional')} — ${PROVISIONAL_HELP()}`)] : []),
      h('p', { class: 'dash-note' }, t('These figures are the overall compliance level to report in the conformity statement. The reference is the legal level AA (A + AA): a site is declared compliant at 100 %. Other figures are indicative.')),
      miniTable(t('Compliance for each level'), ['', 'C', 'NC'], [['A', cOf(lv.perLevel.A), nOf(lv.perLevel.A)], ['AA', cOf(lv.perLevel.AA), nOf(lv.perLevel.AA)], ['AAA', cOf(lv.perLevel.AAA), nOf(lv.perLevel.AAA)]], 'level-table'),
      miniTable(t('Results by level'), ['', 'C', 'NC'], [['A', lv.perLevel.A.C, lv.perLevel.A.NC], ['AA', lv.perLevel.AA.C, lv.perLevel.AA.NC], ['AAA', lv.perLevel.AAA.C, lv.perLevel.AAA.NC], [t('Total'), lv.perLevel.A.C + lv.perLevel.AA.C + lv.perLevel.AAA.C, lv.perLevel.A.NC + lv.perLevel.AA.NC + lv.perLevel.AAA.NC]]),
    ),
    h(
      'section',
      { class: 'dash-col charts' },
      levelBars(lv.perLevel),
      donut(t('Compliance RGAA 4 (legal level AA)'), rateExact(lv.legal), t('C ÷ (C + NC) over the sample, levels A and AA') + (isProvisional(lv.legal) ? ` (${t('provisional')})` : '')),
      donut(t('Average per page'), lv.average, t('Average of the page rates')),
    ),
    h(
      'section',
      { class: 'dash-col' },
      h(
        'table',
        { class: 'results-table mini pages-result' },
        h('caption', {}, t('Results per page')),
        h('thead', {}, h('tr', {}, ...['', 'Page', 'C', 'NC', 'NA', '% C'].map((name) => h('th', { scope: 'col' }, t(name))))),
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
              h('td', { class: `rate-cell ${tone(p.rate)}`, title: isProvisional(p.counts) ? PROVISIONAL_HELP() : '' }, pct2(p.rate) + (p.rate !== null && isProvisional(p.counts) ? '*' : '')),
            )
          }),
        ),
      ),
      miniTable(t('Results: averages'), ['', ''], [[t('Average'), pct2(lv.average)], [lv.best ? t('Best page ({label})', { label: lv.best.label }) : t('Best page'), pct2(lv.best?.rate ?? null)], [lv.worst ? t('Worst page ({label})', { label: lv.worst.label }) : t('Worst page'), pct2(lv.worst?.rate ?? null)]]),
    ),
  )

  const themeTable = h('table', { class: 'results-table pages-table' })
  themeTable.append(
    h('caption', {}, t('By theme (sample level)')),
    h('thead', {}, h('tr', {}, ...['Theme', 'Audited', 'C', 'NC', 'NA', 'NT', 'Criteria respected'].map((name) => h('th', { scope: 'col' }, t(name))))),
  )
  const themeBody = h('tbody', {})
  for (const th of stats.perTheme) {
    themeBody.append(
      h(
        'tr',
        { class: th.audited ? '' : 'absent' },
        h('th', { scope: 'row' }, `${th.number}. ${th.name}`),
        h('td', {}, th.audited ? t('yes') : t('no')),
        h('td', { class: 's-C' }, String(th.counts.C)),
        h('td', { class: 's-NC' }, String(th.counts.NC)),
        h('td', { class: 's-NA' }, String(th.counts.NA)),
        h('td', { class: 's-NT' }, String(th.counts.NT)),
        h('td', {}, h('div', { class: 'meter', role: 'img', 'aria-label': t('{rate}% respected', { rate: th.rate ?? 0 }) }, h('i', { style: `width:${th.rate ?? 0}%` })), h('span', { class: 'meter-num', title: th.rate !== null && isProvisional(th.counts) ? PROVISIONAL_HELP() : '' }, th.rate === null ? '—' : `${th.rate}%${isProvisional(th.counts) ? '*' : ''}`)),
      ),
    )
  }
  themeTable.append(themeBody)
  const calc = h(
    'section',
    { class: 'calc' },
    h('h3', {}, t('How compliance is calculated')),
    h('p', {}, t('Overall compliance is C ÷ (C + NC), where C is the number of compliant criteria and NC the number of non-compliant ones. Criteria that are not applicable (NA) or not tested (NT) are left out. This is the legal reference: it is the compliance rate of the sample.')),
    h('p', {}, t('Rates marked provisional (or with an asterisk) come from an incomplete audit. A criterion judged on only part of its tests keeps its result but flags the rate, a suggestion from a tool counts as to review until you confirm it, and a known failure is always kept.')),
    h('p', {}, t('Levels A / AA / AAA are derived from the WCAG success criteria each RGAA criterion references. The accessibility rate used elsewhere in this panel is the average of the page rates.')),
  )
  return h('div', {}, wrap, h('div', { class: 'results-scroll' }, themeTable), calc)
}

/** The audit report: one printable HTML page (summary, non-conformities per page, draft accessibility statement). */
function openReport(download_: boolean): void {
  const inputs = allPageInputs()
  if (!inputs.length) return void say(t('Add a page to the audit first.'))
  const html = buildReportHtml(audit, inputs, audit.pages)
  const date = new Date().toISOString().slice(0, 10)
  if (download_) {
    download(html, 'text/html', `${slugOf(audit.meta.site || audit.name)}_rapport_${date}.html`)
    say(t('Report downloaded. Open it in a browser and print it to PDF if you need one.'))
  } else {
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
    window.open(url, '_blank', 'noopener')
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  }
}

function renderAudit(): void {
  auditEl.replaceChildren()
  const inputs = allPageInputs()
  if (!inputs.length) return void auditEl.append(h('p', { class: 'hint-line' }, t('Scan a page to start the audit.')))
  const sheets = auditSheets(inputs, audit.meta)
  const named = (name: string) => sheets.find((s) => s.name === name)!
  auditEl.append(
    h(
      'div',
      { class: 'results-head' },
      h('div', {}, h('h2', {}, t('Audit pages overview — {n} page(s)', { n: inputs.length })), h('p', { class: 'hint-line' }, t('RGAA 4.1 · all audited themes · one sheet per page, like the official Excel grid.'))),
      h(
        'div',
        { class: 'nav' },
        h('button', { type: 'button', onclick: () => setView('review') }, t('← Back to review')),
        h('button', { type: 'button', class: 'primary', onclick: () => void exportWorkbook(inputs, auditSheets(inputs, audit.meta), `grille-rgaa-${slugOf(audit.meta.site || audit.name)}.xlsx`) }, t('Export Excel (all pages)')),
        h('button', { type: 'button', class: 'primary', title: t('One printable page with the summary, the non-conformities and a draft accessibility statement'), onclick: () => openReport(false) }, t('Open the report')),
        h('button', { type: 'button', onclick: () => openReport(true) }, t('Download the report (HTML)')),
      ),
    ),
  )
  tabsFor(auditEl, [
    { name: t('Dashboard'), render: () => dashboard(inputs) },
    { name: t('Summary'), render: () => sheetTable(named('Synthèse')) },
    { name: t('Sample'), render: () => h('div', {}, h('p', { class: 'hint-line' }, t('Pages and fields are edited in “Audit pages sample”. ')), h('button', { type: 'button', class: 'img-ref', onclick: () => setView('sample') }, t('Edit the sample')), sheetTable(named('Échantillon'))) },
    { name: t('Criteria'), render: () => sheetTable(named('Critères')) },
    ...inputs.map((p) => ({ name: p.label, render: () => sheetTable(named(p.label)) })),
    { name: t('Detail by test (Images)'), render: () => sheetTable(named('Détail par test (Images)')) },
    { name: t('Detail by image'), render: () => sheetTable(named('Détail par image')) },
    ...(sheets.some((x) => x.name === 'Détail cadres et couleurs') ? [{ name: t('Frames and colours'), render: () => sheetTable(named('Détail cadres et couleurs')) }] : []),
  ])
}

/* ------------------------------------------------------------------ */
/* Report                                                              */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Scanning                                                            */
/* ------------------------------------------------------------------ */

/** Evaluates an expression in the inspected page; '' when DevTools gives no usable string. */
function inspectedEval(expression: string): Promise<string> {
  return new Promise((resolve) => {
    try {
      chrome.devtools.inspectedWindow.eval(expression, (result: unknown, error: unknown) => resolve(error || typeof result !== 'string' ? '' : result))
    } catch {
      resolve('')
    }
  })
}

async function tabInfo(): Promise<{ url: string; title: string }> {
  const info = await chrome.runtime.sendMessage({ type: 'RGAA_TAB_INFO', tabId: inspectedTabId() }).catch(() => null)
  return { url: typeof info?.url === 'string' ? info.url : '', title: typeof info?.title === 'string' ? info.title : '' }
}

async function inspectedUrl(): Promise<string> {
  const url = await inspectedEval('location.href')
  return /^https?:|^file:/i.test(url) ? url : (await tabInfo()).url
}

async function inspectedTitle(): Promise<string> {
  return (await inspectedEval('document.title')) || (await tabInfo()).title
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

let lastScanOk = false

async function scan(): Promise<void> {
  lastScanOk = false
  if (!page) return void say(t('Add a page to the audit pages sample first (button “Audit pages sample”).'))
  const scannable = page.themes.filter((n) => SCANNED_THEMES.has(n))
  if (!scannable.length) return void say(t('None of the selected themes can be scanned: they are checklists. Select Images, Frames or Colours to scan.'))
  say(t('Scanning…'))
  try {
    const [url, title] = await Promise.all([inspectedUrl(), inspectedTitle()])
    liveUrl = url
    const rec = page
    const label = pageLabel(rec)
    if (url && !rec.url) {
      rec.url = normalizeUrl(url)
      adoptSite(rec.url)
    }
    else if (url && normalizeUrl(url) !== normalizeUrl(rec.url)) {
      const other = findPage(audit, url)
      const question = other
        ? `${t('The browser is on {other} ({url}), not on {label}.', { other: pageLabel(other), url, label })}\n\n${t('OK: scan into {other} instead.', { other: pageLabel(other) })}\n${t('Cancel: stop.')}`
        : `${t('The browser is on {url}, but {label} is registered for {registered}.', { url, label, registered: rec.url })}\n\n${t('OK: scan into {label} and update its URL.', { label })}\n${t('Cancel: stop.')}`
      if (!(await askConfirm(t('The browser is on another page'), question, t('Scan into {label}', { label: other ? pageLabel(other) : label })))) return void say(t('Scan cancelled.'))
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
      rec.scanCoverage = mergeCoverage(rec.scanCoverage, response?.coverage)
      const { added, map } = mergeScan(response?.elements ?? [])
      await sendToPage(inspectedTabId(), { type: 'RGAA_RELABEL', map })
      if (!rec.scannedThemes.includes(1)) rec.scannedThemes.push(1)
      selectedId = elements.find((e) => e.key === selectedKey)?.id ?? elements[0]?.id ?? null
      const gone = elements.filter((e) => !e.present).length
      parts.push([t('{n} image(s)', { n: elements.length }), ...(first ? [] : [t('{n} new', { n: added })]), ...(gone ? [t('{n} gone', { n: gone })] : [])].join(', '))
    } else {
      scanCount++
    }
    for (const tn of rec.themes.filter((n) => FINDING_THEMES.has(n))) {
      const response = await sendToPage(inspectedTabId(), { type: 'RGAA_SCAN_THEME', theme: tn, color: colorOf(tn) })
      rec.scanCoverage = mergeCoverage(rec.scanCoverage, response?.coverage)
      const { map, added } = mergeFindings(tn, response?.findings ?? [])
      await sendToPage(inspectedTabId(), { type: 'RGAA_RELABEL', map, theme: tn })
      const n = rec.findings.filter((f) => f.theme === tn).length
      parts.push(tn === 2 ? t('{n} frame(s)', { n }) : tn === 6 ? t('{n} link(s)', { n }) : tn === 9 ? t('{n} heading(s) and landmark(s)', { n }) : tn === 5 ? t('{n} table(s)', { n }) : tn === 11 ? t('{n} field(s)', { n }) : `${t('{n} contrast finding(s)', { n: listedFindings(tn).length })}${added ? ` (${t('{n} new', { n: added })})` : ''}`)
    }
    const missing = rec.findings.filter((f) => f.present && !f.shot && f.type !== 'contrast-ok' && rec.themes.includes(f.theme)).slice(0, 50)
    const shots = await captureShots(missing)
    if (shots) parts.push(t('{n} preview(s)', { n: shots }))
    filter = 'all'
    findingFilter = 'all'
    await applyBoxes()
    scannedThisSession.add(rec.id)
    newBanner.hidden = true
    navBanner.hidden = true
    setView('review')
    renderAll()
    persist()
    lastScanOk = true
    say(
      first
        ? t('{label} scanned: {parts}. Open a popin or a tab, then click “Rescan {label}” to add what appears.', { label, parts: parts.join(' · ') })
        : t('Rescan {n} of {label}: {parts}.', { n: scanCount, label, parts: parts.join(' · ') }),
    )
  } catch (err) {
    say(t('Could not reach the page. Reload the tab, check site access in about:addons, and try again.'))
    console.error(err)
  }
}

scanBtn.addEventListener('click', scan)
rescanBtn.addEventListener('click', scan)

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== 'RGAA_NEW_IMAGES' || !scanCount) return
  newBannerText.textContent = t('{n} new image(s) appeared on the page (popin, tab, lazy content…).', { n: message.count })
  newBanner.hidden = false
})

chrome.devtools.network.onNavigated.addListener((url: string) => {
  liveUrl = url
  // The boxes are gone with the old document: what was seen is shown as last seen until the next scan.
  scannedThisSession.clear()
  resetPageTools()
  for (const p of audit.pages) for (const el of p.items) el.present = true
  newBanner.hidden = true
  renderPageBar()
  renderList()
  renderStats()
  if (view === 'review') renderEmpty()
  if (normalizeUrl(url) !== navDismissed) navDismissed = ''
  showNavBanner(url)
})

clearBtn.addEventListener('click', async () => {
  try {
    await sendToPage(inspectedTabId(), { type: 'RGAA_CLEAR_HIGHLIGHTS' })
    for (const el of elements) el.present = false
    for (const f of page?.findings ?? []) f.present = false
    renderList()
    renderStats()
    say(t('Boxes removed from the page. The images and your answers stay in the audit; “Rescan” draws them again.'))
  } catch (err) {
    say(t('Could not reach the page.'))
    console.error(err)
  }
})

altBtn.addEventListener('click', () => {
  showAltOn = !showAltOn
  try { localStorage.setItem('rgaa-show-alt', showAltOn ? 'on' : 'off') } catch { /* optional */ }
  void applyBoxes()
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
nextBtn.addEventListener('click', () => goToFirstOnPage('pending'))

document.addEventListener('keydown', (event) => {
  const target = event.target as HTMLElement
  if (event.key === 'n' && !event.ctrlKey && !event.metaKey && !['TEXTAREA', 'INPUT', 'SELECT'].includes(target.tagName) && page && view === 'review') return void goToFirstOnPage('pending')
  if (['TEXTAREA', 'INPUT', 'SELECT'].includes(target.tagName) || view !== 'review' || theme !== 1 || !elements.length || selectedId === null) return
  const index = elements.findIndex((e) => e.id === selectedId)
  const next = event.key === 'j' ? index + 1 : event.key === 'k' ? index - 1 : -1
  if (next >= 0 && next < elements.length) select(elements[next].id, true)
})

window.addEventListener('error', (event) => say(t('Panel error: {message}', { message: event.message })))
window.addEventListener('unhandledrejection', (event) => say(t('Panel error: {message}', { message: String(event.reason) })))

/* ------------------------------------------------------------------ */
/* Manual checks and import of other tools' results (per page)           */
/* ------------------------------------------------------------------ */

const checksEl = $('checks')
const checksBtn = $<HTMLButtonElement>('checks-btn')
const autoBtn = $<HTMLButtonElement>('auto-btn')
let axeRunning = false

function manualProgress(rec: PageRecord): { done: number; issues: number; total: number } {
  const answers = Object.values(rec.manualChecks ?? {})
  return { done: answers.length, issues: answers.filter((a) => a.state === 'issue').length, total: MANUAL_CHECKS.length }
}

/** What the scans did not look at, in plain words (frames, shadow roots, lists cut at a limit). */
function coverageCard(cov: NonNullable<PageRecord['scanCoverage']>): HTMLElement {
  return h('div', { class: 'card' }, h('h3', {}, t('Scan coverage')), h('p', { class: 'hint-line' }, t('What the automatic scans did NOT look at. These parts need a manual check.')), h('ul', { class: 'checks' }, ...coverageLines(cov).map((x) => h('li', {}, x))))
}

function renderChecks(): void {
  checksEl.replaceChildren()
  if (!page) return
  const rec = page
  rec.manualChecks ??= {}
  const progress = manualProgress(rec)
  const body = h('div', { class: 'checks-body' })

  for (const group of MANUAL_GROUPS) {
    const card = h('div', { class: 'card' }, h('h3', {}, t(group)))
    for (const c of MANUAL_CHECKS.filter((x) => x.group === group)) {
      const answer = rec.manualChecks![c.id]
      const set = (state: 'todo' | 'ok' | 'issue') => {
        if (state === 'todo') delete rec.manualChecks![c.id]
        else rec.manualChecks![c.id] = { state, note: answer?.note ?? '' }
        persist()
        keepScroll(checksEl, renderChecks)
      }
      const radio = (value: 'todo' | 'ok' | 'issue', label: string) => [
        h('input', { type: 'radio', name: `mc-${c.id}`, id: `mc-${c.id}-${value}`, checked: (answer?.state ?? 'todo') === value, onclick: () => set(value) }),
        h('label', { for: `mc-${c.id}-${value}` }, label),
      ]
      card.append(
        h(
          'div',
          { class: 'check-row', 'data-state': answer?.state ?? '' },
          h('p', { class: 'question' }, t(c.text)),
          h('p', { class: 'hint-line' }, t('Feeds RGAA'), ' ', ...c.criteria.flatMap((id, i) => [i ? ', ' : '', h('a', { href: criterionUrl(id), target: '_blank', rel: 'noreferrer' }, id)])),
          h('div', { class: 'verdicts' }, ...radio('todo', t('To do')), ...radio('ok', t('Checked, OK')), ...radio('issue', t('Problem found'))),
          answer?.state === 'issue'
            ? h('textarea', {
                'aria-label': t('What is wrong, and where'),
                placeholder: t('What is wrong, and where'),
                value: answer.note,
                oninput: (e: Event) => { answer.note = (e.target as HTMLTextAreaElement).value; persist() },
              })
            : null,
        ),
      )
    }
    body.append(card)
  }

  const reports = (rec.imports ?? []).slice().reverse()
  checksEl.append(
    h(
      'div',
      { class: 'results-head' },
      h(
        'div',
        {},
        h('h2', {}, t('Checks — {label}', { label: pageLabel(rec) })),
        h('p', { class: 'hint-line' }, t('What a script cannot judge: do each check on the page, then tick it. {done}/{total} done, {issues} problem(s).', { done: progress.done, total: progress.total, issues: progress.issues })),
      ),
      h('div', { class: 'nav' }, h('button', { type: 'button', onclick: () => setView('review') }, t('← Back to review'))),
    ),
    h(
      'div',
      { class: 'card' },
      h('h3', {}, t('Automatic checks')),
      h('p', { class: 'hint-line' }, t('Runs every automatic test on the page you are inspecting: it scans all the themes, then runs axe, our RGAA checks, the Asqatasun-derived rules and the HTML check. A failure becomes a pre-filled “non-compliant” to confirm; a theme that clearly does not apply (no table, no media, no form…) is pre-filled “not applicable”. A criterion where nothing is found is pre-filled “compliant” to confirm. It covers only part of the RGAA: the manual checks below are still needed.')),
      h('div', { class: 'nav' }, h('button', { type: 'button', class: 'primary', disabled: axeRunning, onclick: () => void runEverything() }, axeRunning ? t('Running the checks…') : t('Run the automatic checks'))),
    ),
    htmlCard(rec),
    ...(rec.scanCoverage ? [coverageCard(rec.scanCoverage)] : []),
    ...reports.map((r) =>
      h(
        'div',
        { class: 'card' },
        h('h3', {}, t('Automatic checks ({tool}) — {date}', { tool: r.tool, date: dateTimeOf(r.at) })),
        h('p', { class: 'hint-line' }, t('{set} verdict(s) pre-filled, {noted} element note(s). {passes} passed rule(s) ignored, {incomplete} to check by hand.', { set: r.set, noted: r.noted, passes: r.passes, incomplete: r.incomplete })),
        ...(r.conflicts.length ? [h('p', { class: 'hint warn' }, t('The scan disagrees with your answer:')), h('ul', { class: 'checks' }, ...r.conflicts.map((x) => h('li', {}, x)))] : []),
        ...((r.items ?? []).length ? [h('details', {}, h('summary', {}, t('Rule by rule ({n})', { n: (r.items ?? []).length })), h('table', { class: 'audit-table' }, h('tbody', {}, ...(r.items ?? []).slice(0, 300).map((i) => h('tr', {}, h('td', {}, i.criterion), h('td', {}, i.rule), h('td', {}, i.result === 'nc' ? t('problem') : i.result === 'pass' ? t('nothing found') : i.result === 'na' ? t('not applicable') : t('to check')), h('td', {}, i.text))))))] : []),
        ...(r.unmatched.length ? [h('details', {}, h('summary', {}, t('{n} finding(s) not matched to a scanned element', { n: r.unmatched.length })), h('ul', { class: 'checks' }, ...r.unmatched.slice(0, 60).map((x) => h('li', {}, x))))] : []),
        ...(r.unmapped.length ? [h('details', {}, h('summary', {}, t('{n} rule(s) with no RGAA criterion in this tool', { n: r.unmapped.length })), h('p', { class: 'hint-line' }, r.unmapped.slice(0, 80).join(' · ')))] : []),
      ),
    ),
    body,
  )
}

/** The HTML of the page, captured now, kept in the audit and checked against the HTML specification (RGAA 8.2). */
async function captureAndCheckHtml(rec: PageRecord): Promise<void> {
  const snap = await sendToPage(inspectedTabId(), { type: 'RGAA_SNAPSHOT' })
  if (typeof snap.html !== 'string') throw new Error('no html')
  rec.snapshot = packSnapshot(snap.html, snap.url, snap.title)
  rec.scanCoverage = mergeCoverage(rec.scanCoverage, snap.coverage)
  await validateSnapshot(rec, snap.html)
}

async function validateSnapshot(rec: PageRecord, html: string): Promise<void> {
  const result = await checkHtml(html)
  rec.htmlCheck = result
  const answers: ToolResults['answers'] = []
  const passedChecks: ToolResults['passedChecks'] = []
  if (result.errors) {
    const top = result.groups.slice(0, 4).map((g) => `${g.rule} ×${g.count}`).join(', ')
    answers.push({ criterion: '8.2', status: 'nc', note: t('{n} HTML error(s) in the generated code ({rules}). Details on the Checks page.', { n: result.errors, rules: top }), rule: 'html-validate' })
  } else passedChecks.push({ criterion: '8.2', rule: 'html-validate' })
  applyToolResults(rec, { tool: 'html-validate', url: rec.snapshot?.url ?? rec.url, violations: [], answers, incomplete: 0, passes: passedChecks.length, passedChecks }, { addThemes: true })
}

const kb = (bytes: number) => `${Math.max(1, Math.round(bytes / 1024))} KB`

function downloadSnapshot(rec: PageRecord): void {
  if (!rec.snapshot) return
  const date = new Date(rec.snapshot.at).toISOString().slice(0, 10)
  download(unpackSnapshot(rec.snapshot), 'text/html', `${slugOf(audit.meta.site || audit.name)}_${pageLabel(rec)}_${date}.html`)
}

let htmlBusy = false
function htmlCard(rec: PageRecord): HTMLElement {
  const snap = rec.snapshot
  const check = rec.htmlCheck
  const run = async (fn: () => Promise<void>) => {
    if (htmlBusy) return
    htmlBusy = true
    keepScroll(checksEl, renderChecks)
    try {
      await fn()
      persist()
      renderAll()
    } catch (err) {
      say(t('Could not capture or check the HTML ({reason}).', { reason: String((err as Error)?.message ?? err) }))
    } finally {
      htmlBusy = false
      if (view === 'checks') keepScroll(checksEl, renderChecks)
    }
  }
  return h(
    'div',
    { class: 'card' },
    h('h3', {}, t('Page HTML')),
    h('p', { class: 'hint-line' }, t('The HTML as the browser holds it now (after scripts) is kept in the audit and checked against the HTML specification, on this computer: nothing is sent anywhere. This is what RGAA 8.2 asks (valid generated source code).')),
    snap
      ? h('p', { class: 'hint info' }, t('Captured {date} · {size} (stored as {packed}) · {url}', { date: dateTimeOf(snap.at), size: kb(snap.bytes), packed: kb(snap.gz.length * 0.75), url: snap.url }))
      : h('p', { class: 'hint info' }, t('Not captured yet. Run the automatic checks (they capture it), or capture it now.')),
    h(
      'div',
      { class: 'nav' },
      h('button', { type: 'button', class: 'primary', disabled: htmlBusy, onclick: () => void run(() => captureAndCheckHtml(rec)) }, htmlBusy ? t('Working…') : snap ? t('Capture again and check') : t('Capture and check the HTML')),
      snap ? h('button', { type: 'button', onclick: () => downloadSnapshot(rec) }, t('Download the HTML')) : null,
      snap ? h('button', { type: 'button', disabled: htmlBusy, onclick: () => void run(() => validateSnapshot(rec, unpackSnapshot(snap))) }, t('Check again')) : null,
    ),
    check
      ? check.errors === 0
        ? h('p', { class: 'hint ok' }, t('No HTML error found in the generated code.'))
        : h(
            'div',
            {},
            h('p', { class: 'hint warn' }, t('{n} HTML error(s) found, in {k} kind(s).', { n: check.errors, k: check.groups.length })),
            ...check.groups.map((g) =>
              h(
                'details',
                {},
                h('summary', {}, `${g.rule} ×${g.count} — ${g.message}`),
                h('ul', { class: 'checks' }, ...g.examples.map((e) => h('li', {}, `${t('line {line}', { line: e.line })}${e.selector ? ` · ${e.selector}` : ''} — ${e.message}`))),
              ),
            ),
          )
      : null,
  )
}

/** Our own RGAA checks: the page sends what it found, the wording and the criteria come from lib/rgaa-rules.ts. */
function rulesToResults(url: string, findings: RuleFinding[]): { own: ToolResults; asq: ToolResults } {
  const answers: ToolResults['answers'] = []
  const asqAnswers: ToolResults['answers'] = []
  for (const f of findings) {
    const meta = RULES[f.key]
    if (!meta) continue
    const note = t(meta.text, { n: f.count, detail: f.detail ? t(f.detail) : '', samples: (f.samples ?? []).join(', ') })
    for (const criterion of meta.criteria) answers.push({ criterion, status: meta.status, note, rule: f.key })
  }
  // --- Asqatasun-derived: begin ---
  // Tests ported from Asqatasun: nc = fails, review = a note only, na = not applicable. A criterion where every test ported for it
  // passed comes as `pass`: it goes to passedChecks ("nothing found", and the criterion is pre-filled "compliant, to confirm").
  const asqPassed: ToolResults['passedChecks'] = []
  for (const f of findings as (RuleFinding & { asq?: AsqExtra })[]) {
    if (!f.asq) continue
    if (f.asq.status === 'pass') {
      asqPassed.push({ criterion: f.asq.criterion, rule: f.key, detail: f.detail })
      continue
    }
    const note = t(f.asq.text, { n: f.count, samples: (f.samples ?? []).join(', '), criterion: f.asq.criterion, test: f.asq.test, detail: f.detail ?? '' })
    asqAnswers.push({ criterion: f.asq.criterion, status: f.asq.status === 'review' ? null : f.asq.status, note, rule: f.key })
  }
  // --- Asqatasun-derived: end ---
  // our checks that look for a failure and found none: shown as "checked" on their criteria
  const found = new Set(findings.map((f) => f.key))
  const passedChecks: ToolResults['passedChecks'] = []
  const seen = new Map(findings.filter((f) => f.detail).map((f) => [f.key, f.detail as string]))
  for (const [key, meta] of Object.entries(RULES)) {
    if (meta.status === 'nc' && !found.has(key)) for (const criterion of meta.criteria) passedChecks.push({ criterion, rule: key, detail: seen.get(`${key}-found`) })
  }
  // --- Asqatasun-derived: begin ---
  const asq: ToolResults = { tool: 'Asqatasun', url, violations: [], answers: asqAnswers, incomplete: 0, passes: asqPassed.length, passedChecks: asqPassed }
  // --- Asqatasun-derived: end ---
  return { own: { tool: 'RGAA', url, violations: [], answers, incomplete: 0, passes: passedChecks.length, passedChecks }, asq }
}

async function runAutoChecks(): Promise<void> {
  if (!page || axeRunning) return
  const rec = page
  axeRunning = true
  autoBtn.disabled = true
  keepScroll(checksEl, renderChecks)
  say(t('Running the automatic checks on the page…'))
  let step = 'rules'
  try {
    const own = await sendToPage(inspectedTabId(), { type: 'RGAA_RULES_RUN' })
    rec.scanCoverage = mergeCoverage(rec.scanCoverage, own?.coverage)
    await sleep(250) // let a heavy page breathe between the steps
    step = 'axe'
    const response = await chrome.runtime.sendMessage({ type: 'RGAA_AXE', tabId: inspectedTabId(), locale: getLang() === 'fr' ? axeFrench : null, rules: Object.keys(AXE_TO_RGAA) })
    if (!response || response.error) throw new Error(response?.error ?? 'no response')
    const results = fromAxe(response)
    if (results.url && rec.url && normalizeUrl(results.url) !== normalizeUrl(rec.url)) {
      const ok = await askConfirm(t('The browser is on another page'), t('The browser is on {url}, but {label} is registered for {registered}. Apply them to {label} anyway?', { url: results.url, label: pageLabel(rec), registered: rec.url }), t('Apply anyway'))
      if (!ok) return void say(t('Scan cancelled.'))
    }
    const split = rulesToResults(own.url, own.findings ?? [])
    const ownReport = applyToolResults(rec, split.own, { addThemes: true })
    // --- Asqatasun-derived: begin ---
    const asqReport = applyToolResults(rec, split.asq, { addThemes: true })
    // --- Asqatasun-derived: end ---
    const report = applyToolResults(rec, results, { addThemes: true })
    step = 'html'
    await sleep(250)
    try {
      await captureAndCheckHtml(rec)
    } catch (err) {
      console.error(err)
      say(t('Could not capture or check the HTML ({reason}).', { reason: String((err as Error)?.message ?? err) }))
    }
    persist()
    renderAll()
    say(t('Automatic checks on {label}: {n} rule(s) failed, {set} verdict(s) pre-filled, {noted} element note(s). Confirm them in the themes.', { label: pageLabel(rec), n: results.violations.length + (own.findings ?? []).filter((f: RuleFinding) => RULES[f.key]?.status === 'nc').length, set: report.set + ownReport.set + asqReport.set, noted: report.noted + ownReport.noted + asqReport.noted }))
  } catch (err) {
    const reason = `${step}: ${String((err as Error)?.message ?? err).replace(/^Error: /, '')}`
    say(t('Could not run the automatic checks ({reason}). Reload the page (F5) if you just reloaded the extension, check the extension may access this site, then try again.', { reason }))
    console.error(err)
  } finally {
    axeRunning = false
    autoBtn.disabled = !page
    if (view === 'checks') keepScroll(checksEl, renderChecks)
  }
}

checksBtn.addEventListener('click', () => setView(view === 'checks' ? 'review' : 'checks'))
/** Everything at once: scan every theme that can be scanned, then axe, our RGAA checks, the Asqatasun-derived rules and the HTML check. */
async function runEverything(): Promise<void> {
  if (!page || axeRunning) return
  const rec = page
  const scannable = [...SCANNED_THEMES].filter((n) => !rec.themes.includes(n))
  if (scannable.length) {
    rec.themes = [...rec.themes, ...scannable].sort((a, b) => a - b)
    persist()
  }
  await scan()
  if (!lastScanOk || page !== rec) return
  setView('checks')
  await runAutoChecks()
}

autoBtn.addEventListener('click', () => void runEverything())

/* ------------------------------------------------------------------ */
/* Audits: name, saved state, list of audits, file save / reopen         */
/* ------------------------------------------------------------------ */

const auditNameBtn = $<HTMLButtonElement>('audit-name-btn')
const saveStateEl = $('save-state')
const backupStateEl = $('backup-state')
const auditsBtn = $<HTMLButtonElement>('audits-btn')
const saveFileBtn = $<HTMLButtonElement>('save-file-btn')
const openFileBtn = $<HTMLButtonElement>('open-file-btn')
const auditsEl = $('audits')
const importInput = $<HTMLInputElement>('import-file')
const langFrBtn = $<HTMLButtonElement>('lang-fr')
const langEnBtn = $<HTMLButtonElement>('lang-en')
const textDialog = $<HTMLDialogElement>('text-dialog')

const slugOf = (name: string): string =>
  name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'audit'
const timeOf = (ms: number) => new Date(ms).toLocaleTimeString(getLang(), { hour: '2-digit', minute: '2-digit' })
const dateTimeOf = (ms: number) => new Date(ms).toLocaleString(getLang(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const auditTitle = (a: { name: string }) => a.name || t('Untitled audit')

/** Which audit is open, and whether it is saved (in the browser, and in a file). Always visible. */
function renderAuditBar(): void {
  auditNameBtn.textContent = auditTitle(audit)
  auditNameBtn.title = t('Rename this audit')
  saveStateEl.className = `pill ${saveState === 'saved' ? '' : saveState}`
  saveStateEl.textContent =
    saveState === 'saving' ? t('Saving…') : saveState === 'error' ? t('Not saved! Save to a file now.') : t('Saved {time}', { time: timeOf(savedAt || audit.updatedAt) })
  saveStateEl.title = saveState === 'error' ? t('Not saved: browser storage full or unavailable. Save to a file now.') : t('Saved in the browser at {time}', { time: timeOf(savedAt || audit.updatedAt) })
  const never = audit.exportedAt === undefined
  const changed = !never && audit.updatedAt > (audit.exportedAt ?? 0)
  backupStateEl.className = `pill ${never || changed ? (audit.pages.length ? 'warn' : 'muted') : 'muted'}`
  backupStateEl.textContent = never ? t('No file yet') : changed ? t('File out of date') : t('File up to date')
  backupStateEl.title = never ? t('No file saved yet') : changed ? t('Changed since the file of {time}', { time: timeOf(audit.exportedAt ?? 0) }) : t('File saved at {time}', { time: timeOf(audit.exportedAt ?? 0) })
  auditsBtn.setAttribute('aria-pressed', String(view === 'audits'))
  langFrBtn.setAttribute('aria-pressed', String(getLang() === 'fr'))
  langEnBtn.setAttribute('aria-pressed', String(getLang() === 'en'))
  document.title = `${auditTitle(audit)} — RGAA Assistant`
}

/** A text question inside the panel (the browser's prompt() is not shown in a DevTools panel). */
function askText(title: string, label: string, initial = '', okLabel = t('OK')): Promise<string | null> {
  return new Promise((resolve) => {
    const input = $<HTMLInputElement>('text-input')
    $('text-title').textContent = title
    $('text-label').textContent = label
    $('text-ok').textContent = okLabel
    $('text-cancel').textContent = t('Cancel')
    input.value = initial
    let done = false
    const finish = (value: string | null) => {
      if (done) return
      done = true
      textDialog.removeEventListener('cancel', onCancel)
      form.removeEventListener('submit', onSubmit)
      cancel.removeEventListener('click', onCancelClick)
      textDialog.close()
      resolve(value)
    }
    const form = $<HTMLFormElement>('text-form')
    const cancel = $('text-cancel')
    const onSubmit = (e: Event) => {
      e.preventDefault()
      const value = input.value.trim()
      if (value) finish(value)
      else input.focus()
    }
    const onCancel = (e: Event) => {
      e.preventDefault()
      finish(null)
    }
    const onCancelClick = () => finish(null)
    form.addEventListener('submit', onSubmit)
    cancel.addEventListener('click', onCancelClick)
    textDialog.addEventListener('cancel', onCancel)
    textDialog.showModal()
    input.select()
  })
}

async function renameAudit(): Promise<void> {
  const name = await askText(t('Rename this audit'), t('Name of the audit'), audit.name)
  if (name === null || name === audit.name) return
  audit.name = name
  persist()
  renderAuditBar()
  if (view === 'audits') void renderAuditsView()
  say(t('Audit renamed “{name}”.', { name }))
}

/** Opens `next` in the panel: the current audit is saved first. */
async function activateAudit(next: Audit): Promise<void> {
  if (saveTimer !== undefined) await saveNow()
  audit = next
  await setActiveId(next.id).catch(() => undefined)
  scannedThisSession.clear()
  findingSel = null
  theme = 1
  void clearBoxes()
  loadPage((liveUrl ? findPage(audit, liveUrl) : undefined) ?? audit.pages.find((p) => p.id === audit.current) ?? audit.pages[0] ?? null)
  saveState = 'saved'
  savedAt = audit.updatedAt
  setView('review')
  renderAll()
  renderAuditBar()
}

async function newAudit(): Promise<void> {
  const name = await askText(t('New audit'), t('Name of the audit'), '', t('Create'))
  if (name === null) return
  const fresh = emptyAudit(name)
  try {
    await saveAudit(fresh)
  } catch {
    return void say(t('Could not create the audit: browser storage is full or unavailable.'))
  }
  await activateAudit(fresh)
  say(t('Audit “{name}” created. Add the first page of your sample to start.', { name }))
}

async function openAuditById(id: string): Promise<void> {
  if (id === audit.id) return setView('review')
  const next = await loadAuditById(id)
  if (!next) return void say(t('This audit could not be read.'))
  await activateAudit(next)
  say(t('Audit “{name}” opened: {n} page(s).', { name: auditTitle(next), n: next.pages.length }))
}

async function duplicateAuditById(id: string): Promise<void> {
  const source = id === audit.id ? audit : await loadAuditById(id)
  if (!source) return
  const name = await askText(t('Duplicate this audit'), t('Name of the copy'), t('{name} (copy)', { name: auditTitle(source) }), t('Duplicate'))
  if (name === null) return
  if (source === audit && saveTimer !== undefined) await saveNow()
  const copy = copyOf(source, name)
  try {
    await saveAudit(copy)
  } catch {
    return void say(t('Could not create the audit: browser storage is full or unavailable.'))
  }
  say(t('Copy “{name}” created. It is in the list; open it when you want.', { name }))
  void renderAuditsView()
}

async function renameAuditById(id: string): Promise<void> {
  if (id === audit.id) return renameAudit()
  const other = await loadAuditById(id)
  if (!other) return
  const name = await askText(t('Rename this audit'), t('Name of the audit'), other.name)
  if (name === null) return
  other.name = name
  await saveAudit(other).catch(() => say(t('Could not save the audit.')))
  void renderAuditsView()
}

async function deleteAuditFlow(id: string): Promise<void> {
  const target = id === audit.id ? audit : await loadAuditById(id)
  if (!target) return
  const ok = await askConfirm(
    t('Delete the audit “{name}”?', { name: auditTitle(target) }),
    t('This deletes its {n} page(s), scans, answers and notes from the browser. A file you saved stays where it is. It cannot be undone.', { n: target.pages.length }),
    t('Delete'),
  )
  if (!ok) return
  await deleteAuditById(id)
  if (id === audit.id) {
    const rest = (await listAudits()).sort((a, b) => b.updatedAt - a.updatedAt)[0]
    const next = (rest ? await loadAuditById(rest.id) : null) ?? emptyAudit(t('Untitled audit'))
    if (!rest) await saveAudit(next).catch(() => undefined)
    saveTimer = undefined
    await activateAudit(next)
    setView('audits')
  } else void renderAuditsView()
  say(t('Audit “{name}” deleted.', { name: auditTitle(target) }))
}

/** Downloads the whole audit as a .rgaa.json file. */
const hostName = (url: string): string => { try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' } }

/** site_audit-name_date.rgaa.json: sorts by site, tells the audits apart, and a new save never overwrites an older one. */
function auditFileName(a: Audit): string {
  const site = slugOf(a.meta.site)
  const name = slugOf(a.name)
  const parts = [site !== 'audit' ? site : '', name !== 'audit' && !(site !== 'audit' && name.includes(site)) ? name : '', new Date().toISOString().slice(0, 10)].filter(Boolean)
  return `${parts.join('_')}${FILE_EXTENSION}`
}

/** The first page registered gives the audit its site, and its name while it still has the placeholder one. */
function adoptSite(url: string): void {
  const host = hostName(url)
  if (!host) return
  if (!audit.meta.site.trim()) audit.meta.site = host
  if (!audit.name.trim() || audit.name === 'Untitled audit' || audit.name === 'Audit sans titre') audit.name = audit.meta.site
}

async function saveAuditToFile(id: string = audit.id): Promise<void> {
  const target = id === audit.id ? audit : await loadAuditById(id)
  if (!target) return
  target.exportedAt = target.updatedAt
  const file = auditFileName(target)
  download(auditToFile(target), 'application/json', file)
  if (target === audit) await saveNow()
  else await saveAudit(target).catch(() => undefined)
  renderAuditBar()
  if (view === 'audits') void renderAuditsView()
  say(t('Audit saved as {file} (in your Downloads folder). Reopen it any time with “Open from a file”.', { file }))
}

async function importAuditFile(file: File): Promise<void> {
  let incoming: Audit
  try {
    incoming = auditFromFile(await file.text())
  } catch (err) {
    return void say((err as Error).message === 'not-json' ? t('This file is not valid JSON.') : t('This file is not an RGAA Assistant audit.'))
  }
  const existing = (await listAudits()).find((a) => a.id === incoming.id)
  if (existing) {
    const replace = await askConfirm(
      t('This audit is already in the browser'),
      t('“{name}” (saved {date}) has the same identifier as the file. Replace it with the file, or cancel to choose another option?', { name: existing.name, date: dateTimeOf(existing.updatedAt) }),
      t('Replace it'),
    )
    if (!replace) {
      const asCopy = await askConfirm(t('Import as a copy?'), t('The file is imported as a new audit and the one in the browser is kept.'), t('Import as a copy'))
      if (!asCopy) return void say(t('Import cancelled.'))
      incoming = copyOf(incoming, t('{name} (imported)', { name: auditTitle(incoming) }))
    }
  }
  try {
    await saveAudit(incoming)
  } catch {
    return void say(t('Could not import the audit: browser storage is full or unavailable.'))
  }
  await activateAudit(incoming)
  say(t('Audit “{name}” reopened from the file: {n} page(s). You can carry on.', { name: auditTitle(incoming), n: incoming.pages.length }))
}

async function renderAuditsView(): Promise<void> {
  if (saveTimer !== undefined) await saveNow()
  const list: AuditSummary[] = (await listAudits()).sort((a, b) => b.updatedAt - a.updatedAt)
  if (view !== 'audits') return
  auditsEl.replaceChildren(
    h(
      'div',
      { class: 'results-head' },
      h('div', {}, h('h2', {}, t('My audits')), h('p', { class: 'hint-line' }, t('Each audit has its own pages, scans and answers. Everything is saved in the browser as you work; save to a file to keep a copy or move it.'))),
      h('div', { class: 'nav' }, h('button', { type: 'button', onclick: () => setView('review') }, t('← Back to review')), h('button', { type: 'button', onclick: () => importInput.click() }, t('Open from a file')), h('button', { type: 'button', class: 'primary', onclick: () => void newAudit() }, t('New audit'))),
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
            { class: a.id === audit.id ? 'current' : '' },
            h('td', {}, h('strong', {}, auditTitle(a)), a.id === audit.id ? h('span', { class: 'badge' }, t('Current')) : null),
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
                a.id === audit.id ? null : h('button', { type: 'button', class: 'primary', onclick: () => void openAuditById(a.id) }, t('Open')),
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

/** Changes the language of the whole panel, now. */
function applyLanguage(lang: Lang): void {
  setLang(lang)
  statusEl.textContent = '' // an old message would stay in the previous language
  translateStatic()
  renderAll()
  renderAuditBar()
  renderPageTools()
  void applyBoxes()
}

auditNameBtn.addEventListener('click', () => void renameAudit())
auditsBtn.addEventListener('click', () => setView(view === 'audits' ? 'review' : 'audits'))
saveFileBtn.addEventListener('click', () => void saveAuditToFile())
openFileBtn.addEventListener('click', () => importInput.click())
langFrBtn.addEventListener('click', () => applyLanguage('fr'))
langEnBtn.addEventListener('click', () => applyLanguage('en'))
importInput.addEventListener('change', () => {
  const file = importInput.files?.[0]
  importInput.value = ''
  if (file) void importAuditFile(file)
})
// the last edits are written when the panel is hidden or closed
window.addEventListener('pagehide', () => { if (saveTimer !== undefined) void saveNow() })
document.addEventListener('visibilitychange', () => { if (document.hidden && saveTimer !== undefined) void saveNow() })

async function init(): Promise<void> {
  setLang(getLang())
  translateStatic()
  initPageTools(pageToolsEl, { send: (payload) => sendToPage(inspectedTabId(), payload), say })
  audit = await loadActiveAudit(t('Untitled audit'))
  saveState = 'saved'
  savedAt = audit.updatedAt
  const firstUrl = audit.pages.find((p) => p.url)?.url
  if (!audit.meta.site.trim() && firstUrl) {
    adoptSite(firstUrl)
    persist()
  }
  liveUrl = await inspectedUrl()
  loadPage((liveUrl ? findPage(audit, liveUrl) : undefined) ?? audit.pages.find((p) => p.id === audit.current) ?? audit.pages[0] ?? null)
  renderAll()
  renderAuditBar()
  if (liveUrl) showNavBanner(liveUrl)
  say(t('Audit “{name}” opened: {n} page(s).', { name: auditTitle(audit), n: audit.pages.length }))
}
void init()
