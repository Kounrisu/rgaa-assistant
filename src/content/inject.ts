import { DEFAULT_COLOR, OVERLAY_ID, STYLE_ID, purgeOverlays, skipTarget, visible } from './dom-utils'
import { applyOverlayOptions, boxes, clearTheme, focusImage, focusThemeFinding, ids, locateTheme, relabel, relabelTheme, repositionBoxes, restoreScroll, setFocused, setStates, showOnly, themeOverlays } from './overlay'
import { highlightImages, setImageColor, startObserving, stopObserving } from './scan-images'
import { scanTheme } from './scan-elements'
import type { ScanCoverage } from '../lib/scan-coverage'
// --- Asqatasun-derived: begin ---
// Imported by this script only (no other file imports the table), so it stays inside this bundle.
import { type AsqFinding, evaluateAsqRules } from '../lib/asqatasun-rules'
// --- Asqatasun-derived: end ---
import { type ToolName, resetTools, runTool, tabOrder } from './page-tools'
import { computeCoverage, noteCut, resetCuts } from './scan-coverage'

// Reloading the extension leaves the previous copy of this script, and the boxes it drew, in the page.
// A new copy removes those boxes and takes over; an older copy goes quiet (see `isCurrent`).
const INSTANCE = `${Date.now()}-${Math.random()}`
document.documentElement.dataset.rgaaInstance = INSTANCE
const isCurrent = (): boolean => document.documentElement.dataset.rgaaInstance === INSTANCE
purgeOverlays()

/** Checks of our own that do not belong to the RGAA/Asqatasun tables: skip links. */
function runUxRules(): { key: string; count: number; detail?: string; samples?: string[] }[] {
  const out: { key: string; count: number; detail?: string; samples?: string[] }[] = []
  const early = new Set(tabOrder().slice(0, 8))
  const skips = Array.from(early).filter((a) => a.tagName === 'A' && skipTarget(a, early).skip)
  if (!skips.length) out.push({ key: 'skip-link-missing', count: 1 })
  const broken = skips.filter((a) => !skipTarget(a, early).found)
  if (broken.length) out.push({ key: 'skip-link-broken', count: broken.length, samples: broken.map((a) => a.getAttribute('href') ?? '').slice(0, 3) })
  return out
}

function resetAll(): void {
  themeOverlays.clear()
  boxes.clear()
  purgeOverlays()
  stopObserving()
  ids.registry = new WeakMap()
  ids.next = 1
}

/* Colour picker: a screenshot of the page under a magnifier that follows the cursor and shows the colour's hex. */
let pickLayer: HTMLElement | null = null
let pickDone: ((r: Record<string, unknown>) => void) | null = null
let pickToken = 0

const overlayRoots = (): HTMLElement[] =>
  Array.from(document.querySelectorAll<HTMLElement>(`[id^="${OVERLAY_ID}"]`)).filter((el) => el.id !== `${OVERLAY_ID}-pick`)
const setOverlaysHidden = (hidden: boolean): void => overlayRoots().forEach((el) => (el.style.visibility = hidden ? 'hidden' : ''))

function endPick(result: Record<string, unknown>): void {
  pickToken++
  window.removeEventListener('keydown', onPickKey, true)
  pickLayer?.remove()
  pickLayer = null
  setOverlaysHidden(false)
  pickDone?.(result)
  pickDone = null
}

function onPickKey(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return
  e.preventDefault()
  e.stopPropagation()
  endPick({ cancelled: true })
}

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

async function startPick(respond: (r: Record<string, unknown>) => void): Promise<void> {
  endPick({ cancelled: true })
  pickDone = respond
  const token = ++pickToken
  // the boxes and tints would change the colours under the cursor: photograph the page without them
  setOverlaysHidden(true)
  await nextFrame()
  await nextFrame()
  const cap = await chrome.runtime.sendMessage({ type: 'RGAA_CAPTURE' }).catch(() => null)
  if (token !== pickToken) return
  if (!cap?.dataUrl) return endPick({ error: cap?.error ?? 'no screenshot' })
  const img = new Image()
  await new Promise<void>((resolve) => {
    img.onload = () => resolve()
    img.onerror = () => resolve()
    img.src = cap.dataUrl
  })
  if (token !== pickToken) return
  if (!img.naturalWidth) return endPick({ error: 'bad screenshot' })

  const k = img.naturalWidth / window.innerWidth
  const N = 15 // pixels of the page shown in the magnifier
  const Z = 9 // magnification
  const SIZE = N * Z
  const layer = document.createElement('div')
  layer.id = `${OVERLAY_ID}-pick`
  layer.style.cssText = 'position:fixed;inset:0;z-index:2147483647;cursor:crosshair;background:transparent;'
  const loupe = document.createElement('div')
  loupe.style.cssText = `position:fixed;left:0;top:0;width:${SIZE}px;pointer-events:none;border:2px solid #fff;border-radius:6px;box-shadow:0 0 0 1px #000,0 4px 14px rgba(0,0,0,.45);background:#fff;overflow:hidden;font:600 13px/1.2 ui-monospace,monospace;display:none;`
  const view = document.createElement('canvas')
  view.width = view.height = SIZE
  view.style.cssText = `display:block;width:${SIZE}px;height:${SIZE}px;image-rendering:pixelated;`
  const ring = document.createElement('div')
  ring.style.cssText = `position:absolute;left:${Math.floor(N / 2) * Z}px;top:${Math.floor(N / 2) * Z}px;width:${Z}px;height:${Z}px;box-sizing:border-box;border:1px solid #000;outline:1px solid #fff;`
  const label = document.createElement('div')
  label.style.cssText = 'display:flex;align-items:center;gap:6px;padding:5px 7px;color:#111;background:#fff;'
  const chip = document.createElement('span')
  chip.style.cssText = 'width:14px;height:14px;border:1px solid #000;flex:none;'
  const text = document.createElement('span')
  label.append(chip, text)
  const wrap = document.createElement('div')
  wrap.style.cssText = 'position:relative;'
  wrap.append(view, ring)
  loupe.append(wrap, label)

  const sample = document.createElement('canvas')
  sample.width = sample.height = N
  const sctx = sample.getContext('2d', { willReadFrequently: true })!
  const vctx = view.getContext('2d')!
  vctx.imageSmoothingEnabled = false
  let current = ''
  const read = (x: number, y: number): string => {
    const half = Math.floor(N / 2)
    sctx.clearRect(0, 0, N, N)
    sctx.drawImage(img, Math.round(x * k) - half, Math.round(y * k) - half, N, N, 0, 0, N, N)
    vctx.clearRect(0, 0, SIZE, SIZE)
    vctx.drawImage(sample, 0, 0, SIZE, SIZE)
    const [r, g, b] = sctx.getImageData(half, half, 1, 1).data
    return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`
  }
  const move = (e: MouseEvent) => {
    current = read(e.clientX, e.clientY)
    chip.style.background = current
    text.textContent = current
    loupe.style.display = ''
    const w = SIZE + 4
    const hgt = SIZE + 40
    loupe.style.left = `${e.clientX + 24 + w > window.innerWidth ? e.clientX - 24 - w : e.clientX + 24}px`
    loupe.style.top = `${e.clientY + 24 + hgt > window.innerHeight ? e.clientY - 24 - hgt : e.clientY + 24}px`
  }
  layer.addEventListener('mousemove', move, true)
  layer.addEventListener(
    'click',
    (e) => {
      e.preventDefault()
      e.stopPropagation()
      endPick({ hex: read(e.clientX, e.clientY) })
    },
    true,
  )
  layer.append(loupe)
  document.documentElement.appendChild(layer)
  pickLayer = layer
  window.addEventListener('keydown', onPickKey, true)
}

/* ------------------------------------------------------------------ */
/* Our own RGAA checks (what a script can see; the wording is in lib/rgaa-rules.ts) */
/* ------------------------------------------------------------------ */

function shortSelector(el: Element): string {
  const id = el.id ? `#${CSS.escape(el.id)}` : ''
  const cls = !id && typeof el.className === 'string' && el.className.trim() ? `.${CSS.escape(el.className.trim().split(/\s+/)[0])}` : ''
  return `${el.tagName.toLowerCase()}${id}${cls}`
}

function runRgaaRules(): { url: string; findings: { key: string; count: number; detail?: string; samples?: string[] }[] } {
  const out: { key: string; count: number; detail?: string; samples?: string[] }[] = []
  const mine = (el: Element) => !el.closest(`[id^="${OVERLAY_ID}"]`)
  const all = (selector: string): Element[] => Array.from(document.querySelectorAll(selector)).filter(mine)
  const samples = (els: Element[], n = 3) => els.slice(0, n).map(shortSelector)
  const push = (key: string, els: Element[], detail?: string) => {
    if (els.length) out.push({ key, count: els.length, detail, samples: samples(els) })
  }

  // 8.1 (document type), 8.10 (reading direction) and 10.1 (presentation tags and attributes) are Asqatasun's tests, see runAsqatasunRules()

  // 13.2 — links that open a new window without saying so
  const INFORMS = /(nouvelle\s+(fen[eê]tre|onglet)|nouvel\s+onglet|new\s+(window|tab)|external)/i
  push(
    'target-blank',
    all('a[target="_blank"]').filter((a) => {
      const hints = [a.textContent, a.getAttribute('title'), a.getAttribute('aria-label'), ...Array.from(a.querySelectorAll('img[alt], svg title')).map((n) => n.getAttribute('alt') ?? n.textContent)]
      return visible(a) && !hints.some((h) => INFORMS.test(h ?? ''))
    }),
  )

  // 11.13 — fields about the user without autocomplete
  const PERSONAL = /(e-?mail|mail|t[eé]l|phone|pr[eé]nom|firstname|first-name|lastname|last-name|nom\b|name|adresse|address|postal|zip|ville|city|naissance|birth|username|login|identifiant|password|mot de passe)/i
  const fields = all('input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([type=image]):not([type=checkbox]):not([type=radio]):not([type=file]):not([type=range]):not([type=color]):not([type=search])').filter(visible)
  push(
    'autocomplete',
    fields.filter((f) => {
      const type = (f.getAttribute('type') ?? 'text').toLowerCase()
      const personal = ['email', 'tel', 'password'].includes(type) || PERSONAL.test([f.getAttribute('name'), f.id, f.getAttribute('aria-label'), f.getAttribute('placeholder')].join(' '))
      const ac = (f.getAttribute('autocomplete') ?? '').trim().toLowerCase()
      return personal && (!ac || ac === 'off')
    }),
  )

  // 13.3 / 13.4 (office documents) are Asqatasun's tests, see runAsqatasunRules()

  // 4 — multimedia: the tests 4.1 to 4.13 are Asqatasun's (one per test), this only says that there is no sound at all (4.10)
  if (!all('video, audio, object, embed, bgsound, iframe[src*="youtube"], iframe[src*="youtu.be"], iframe[src*="vimeo"], iframe[src*="dailymotion"]').length) out.push({ key: 'no-media', count: 0 })

  // 5 — tables
  const tables = all('table, [role="table"], [role="grid"], [role="treegrid"]')
  if (!tables.length) out.push({ key: 'no-table', count: 0 })
  else {
    const noHeaders = tables.filter((t) => t.tagName === 'TABLE' && !/^(presentation|none)$/.test(t.getAttribute('role') ?? '') && t.querySelectorAll('tr').length > 1 && !t.querySelector('th, [role="columnheader"], [role="rowheader"]'))
    push('table-no-th', noHeaders)
  }

  // 11 — forms, buttons
  const anyField = all('input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([type=image]), select, textarea, [role="textbox"], [role="combobox"], [role="listbox"], [role="checkbox"], [role="radio"], [role="switch"], [role="slider"], [role="spinbutton"], [role="searchbox"]')
  if (!anyField.length) out.push({ key: 'no-form', count: 0 })
  if (!all('button, input[type=submit], input[type=button], input[type=reset], input[type=image], [role="button"]').length) out.push({ key: 'no-button', count: 0 })

  // 6 — links
  if (!all('a[href], [role="link"]').length) out.push({ key: 'no-link', count: 0 })

  // 8.6 — a title that says nothing
  const title = document.title.trim()
  if (!title || /^(sans titre|untitled( document)?|document|home|accueil|index|new page|nouvelle page)$/i.test(title) || title === location.href) out.push({ key: 'generic-title', count: 1, detail: title || 'empty' })

  // --- Asqatasun-derived: begin ---
  out.push(...runAsqatasunRules())
  // --- Asqatasun-derived: end ---

  return { url: location.href, findings: out }
}

// --- Asqatasun-derived: begin ---
/**
 * The RGAA tests ported from Asqatasun (AGPL-3.0, see NOTICE.md): the rules and their evaluation are in
 * lib/asqatasun-rules.ts (the same code runs in jsdom, see scripts/check-asqatasun.mjs); this only hides our own
 * overlay from them. Findings are keyed `asq:<rule key>`; a criterion whose every test found nothing to check comes
 * back as `asq:na:<criterion>`. Each finding carries what the panel needs (criterion, verdict, wording).
 */
function runAsqatasunRules(): AsqFinding[] {
  return evaluateAsqRules(document, (el) => Boolean(el.closest(`[id^="${OVERLAY_ID}"]`))).findings
}
// --- Asqatasun-derived: end ---

/** The generated HTML of the page (what the browser holds now, after scripts), without our own markers. */
function takeSnapshot(): { url: string; title: string; html: string; coverage: ScanCoverage } {
  // no deep copy of the page (heavy on big pages): our own markers are lifted out for a moment, the page is serialized, they go back
  const lifted: { node: Element; parent: Node; next: Node | null }[] = []
  for (const node of Array.from(document.querySelectorAll(`[id^="${OVERLAY_ID}"], #${STYLE_ID}`))) {
    if (node.parentNode) lifted.push({ node, parent: node.parentNode, next: node.nextSibling })
  }
  for (const { node } of lifted) node.remove()
  let html = ''
  try {
    html = document.documentElement.outerHTML
  } finally {
    for (const { node, parent, next } of lifted.reverse()) parent.insertBefore(node, next)
  }
  const dt = document.doctype
  const doctype = dt ? `<!DOCTYPE ${dt.name}${dt.publicId ? ` PUBLIC "${dt.publicId}"` : ''}${dt.systemId ? ` "${dt.systemId}"` : ''}>\n` : ''
  // a very large page is cut: the audit file and the validation stay manageable
  const MAX = 6_000_000
  resetCuts()
  noteCut('html characters', MAX, html.length)
  return { url: location.href, title: document.title, coverage: computeCoverage(document), html: doctype + (html.length > MAX ? `${html.slice(0, MAX)}\n<!-- cut: page larger than ${MAX} characters -->` : html) }
}

/** Runs the axe engine (injected by the background page just before) and sends back a light copy of its findings. */
async function runAxe(locale: unknown, rules: unknown): Promise<Record<string, unknown>> {
  type AxeApi = { run: (ctx: Document, opts: object) => Promise<Record<string, unknown>>; configure: (c: object) => void }
  const axe = ((globalThis as unknown as { axe?: AxeApi }).axe ?? (window as unknown as { axe?: AxeApi }).axe) as AxeApi | undefined
  if (!axe) return { error: 'axe-not-loaded' }
  try {
    if (locale) axe.configure({ locale })
    // only the rules that map to an RGAA criterion, in this frame (waiting for other frames can hang a page for a minute)
    const only = Array.isArray(rules) && rules.length ? { runOnly: { type: 'rule', values: rules.map(String) } } : {}
    const r = (await axe.run(document, { resultTypes: ['violations', 'incomplete'], iframes: false, elementRef: false, ...only })) as {
      violations: { id: string; impact: string | null; help: string; nodes: { html: string; target: unknown[]; any?: { data?: unknown }[] }[] }[]
      incomplete: unknown[]
      passes: { id: string }[]
      inapplicable: { id: string }[]
    }
    return {
      url: location.href,
      violations: r.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        nodes: v.nodes.slice(0, 200).map((n) => ({ html: n.html.slice(0, 400), target: n.target.flat().map(String), any: n.any?.[0]?.data ? [{ data: n.any[0].data }] : [] })),
      })),
      incomplete: r.incomplete.length,
      passes: r.passes?.length ?? 0,
      passedRules: (r.passes ?? []).map((p) => p.id),
      inapplicableRules: (r.inapplicable ?? []).map((p) => p.id),
    }
  } catch (err) {
    return { error: String(err) }
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!isCurrent()) return undefined
  if (message?.type === 'RGAA_SNAPSHOT') {
    sendResponse(takeSnapshot())
    return true
  }
  if (message?.type === 'RGAA_TOOL') {
    sendResponse(runTool(message.tool as ToolName, Boolean(message.on), repositionBoxes))
    return true
  }
  if (message?.type === 'RGAA_TOOLS_RESET') {
    resetTools(repositionBoxes)
    sendResponse({ ok: true })
    return true
  }
  if (message?.type === 'RGAA_RULES_RUN') {
    resetCuts()
    const base = runRgaaRules()
    sendResponse({ ...base, findings: [...base.findings, ...runUxRules()], coverage: computeCoverage(document) })
    return true
  }
  if (message?.type === 'RGAA_AXE_RUN') {
    void runAxe(message.locale, message.rules).then(sendResponse)
    return true
  }
  if (message?.type === 'RGAA_PICK_START') {
    void startPick(sendResponse)
    return true
  }
  if (message?.type === 'RGAA_PICK_CANCEL') {
    endPick({ cancelled: true })
    sendResponse({ ok: true })
    return true
  }
  if (message?.type === 'RGAA_HIGHLIGHT_IMAGES') {
    if (message.color) setImageColor(message.color)
    const elements = highlightImages()
    startObserving()
    sendResponse({ elements, coverage: computeCoverage(document) })
    return true
  }
  if (message?.type === 'RGAA_CLEAR_HIGHLIGHTS') {
    resetAll()
    sendResponse({ ok: true })
    return true
  }
  if (message?.type === 'RGAA_LOCATE') {
    sendResponse(locateTheme(message.theme, message.id) ?? { rect: null })
    return true
  }
  if (message?.type === 'RGAA_SCROLL_RESTORE') {
    restoreScroll()
    sendResponse({ ok: true })
    return true
  }
  if (message?.type === 'RGAA_SHOW_ONLY') {
    showOnly(message.theme, message.ids ?? null)
    sendResponse({ ok: true })
    return true
  }
  if (message?.type === 'RGAA_CLEAR_THEME') {
    clearTheme(message.theme)
    sendResponse({ ok: true })
    return true
  }
  if (message?.type === 'RGAA_STATES') {
    setStates(message.theme, message.states ?? {})
    sendResponse({ ok: true })
    return true
  }
  if (message?.type === 'RGAA_OVERLAY') {
    applyOverlayOptions(message)
    sendResponse({ ok: true })
    return true
  }
  if (message?.type === 'RGAA_SCAN_THEME') {
    const findings = scanTheme(message.theme, message.color ?? DEFAULT_COLOR)
    sendResponse({ findings, coverage: computeCoverage(document) })
    return true
  }
  if (message?.type === 'RGAA_RELABEL' && message.theme && message.theme !== 1) {
    relabelTheme(message.theme, message.map)
    sendResponse({ ok: true })
    return true
  }
  if (message?.type === 'RGAA_RELABEL') {
    relabel(message.map)
    sendResponse({ ok: true })
    return true
  }
  if (message?.type === 'RGAA_FOCUS_IMAGE' && message.theme && message.theme !== 1) {
    sendResponse({ ok: focusThemeFinding(message.theme, message.id, message.scroll !== false) })
    return true
  }
  if (message?.type === 'RGAA_FOCUS_IMAGE') {
    sendResponse({ ok: focusImage(message.id, message.scroll !== false) })
    return true
  }
  if (message?.type === 'RGAA_UNFOCUS_IMAGE') {
    setFocused(null)
    sendResponse({ ok: true })
    return true
  }
  return undefined
})
