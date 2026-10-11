/**
 * Everything that talks to the inspected tab: the typed messages to the content script, the boxes on the page (show, hide, colour code),
 * its address and title, the small pictures of the findings.
 */
import type { ContentMessage, ContentResponse, CaptureResponse, TabInfoResponse } from '../lib/messages'
import { state } from './state'
import { say, dom } from './dom'
import { t } from '../lib/i18n'
import { THEME_LABEL, SCANNED_THEMES, FINDING_THEMES } from '../lib/themes'
import { visibleElements, findingMatches, boxStates } from './review-state'
import type { FindingItem } from '../lib/types'
import { sleep } from './helpers'
import { isNavigableUrl } from '../lib/url-safety'

export function inspectedTabId(): number {
  return chrome.devtools.inspectedWindow.tabId
}

export async function sendToPage<M extends ContentMessage>(tabId: number, payload: M): Promise<ContentResponse<M>> {
  const response = await chrome.runtime.sendMessage({ type: 'RGAA_RELAY', tabId, payload })
  if (!response || response.error) throw new Error(response?.error ?? 'No response from page')
  return response
}

export const focusOnPage = async (id: number, scroll: boolean, themeNo = 1) => {
  if (scroll && state.boxesOn[themeNo] === false) {
    state.boxesOn[themeNo] = true
    await applyBoxes()
  }
  return sendToPage(inspectedTabId(), { type: 'RGAA_FOCUS_IMAGE', id, scroll, theme: themeNo })
    .then((response) => {
      if (response?.ok === false && scroll) say(t('This image is not on the page right now (popin closed?). Reopen it, then click Rescan.'))
    })
    .catch(console.error)
}

/** Only the theme you are in shows boxes on the page, and only if its own toggle is on. */
export async function applyBoxes(): Promise<void> {
  const on = state.boxesOn[state.theme] !== false
  const name = t(THEME_LABEL[state.theme] ?? '')
  dom.boxesBtn.setAttribute('aria-pressed', String(on))
  dom.boxesBtn.textContent = on ? t('Hide {name} boxes', { name }) : t('Show {name} boxes', { name })
  try { localStorage.setItem('rgaa-boxes-by-theme', JSON.stringify(state.boxesOn)) } catch { /* optional */ }
  const visibility: Record<number, boolean> = {}
  for (const n of SCANNED_THEMES) visibility[n] = n === state.theme && state.boxesOn[n] !== false
  dom.tintBtn.setAttribute('aria-pressed', String(state.focusTintOn))
  dom.tintBtn.textContent = state.focusTintOn ? t('Yellow highlight: on') : t('Yellow highlight: off')
  dom.altBtn.setAttribute('aria-pressed', String(state.showAltOn))
  dom.altBtn.textContent = state.showAltOn ? t('Alt text: on') : t('Alt text: off')
  dom.altBtn.hidden = state.theme !== 1
  await sendToPage(inspectedTabId(), { type: 'RGAA_OVERLAY', visibility, tint: state.focusTintOn, alt: state.showAltOn }).catch(() => undefined)
  pushStates()
  await syncFilterBoxes()
}

/** The list filter also decides which boxes are on the page (Images and Colours). */
export async function syncFilterBoxes(): Promise<void> {
  let ids: number[] | null = null
  if (state.theme === 1 && state.filter !== 'all') ids = visibleElements().map((e) => e.id)
  if (FINDING_THEMES.has(state.theme) && state.findingFilter !== 'all' && state.page) ids = state.page.findings.filter((f) => f.theme === state.theme && findingMatches(f, state.findingFilter)).map((f) => f.id)
  if (state.theme !== 1 && !FINDING_THEMES.has(state.theme)) return
  await sendToPage(inspectedTabId(), { type: 'RGAA_SHOW_ONLY', theme: state.theme, ids }).catch(() => undefined)
}

let statesTimer: number | undefined

/** Sends the colour code to the page, shortly after the last change. */
export function pushStates(): void {
  window.clearTimeout(statesTimer)
  statesTimer = window.setTimeout(() => {
    for (const n of SCANNED_THEMES) void sendToPage(inspectedTabId(), { type: 'RGAA_STATES', theme: n, states: boxStates(n) }).catch(() => undefined)
  }, 120)
}

export function goTo(url: string): void {
  if (!url) return // an empty address would only reload the current page
  // an audit file can hold any string: `javascript:` would run in the page you are inspecting
  if (!isNavigableUrl(url)) return void say(t('This address cannot be opened: only http, https and file addresses are.'))
  chrome.devtools.inspectedWindow.eval(`location.href = ${JSON.stringify(url)}`)
}

export async function clearBoxes(themeNo?: number): Promise<void> {
  const payload: ContentMessage = themeNo ? { type: 'RGAA_CLEAR_THEME', theme: themeNo } : { type: 'RGAA_CLEAR_HIGHLIGHTS' }
  await sendToPage(inspectedTabId(), payload).catch(() => undefined)
}

export const focusFinding = (f: FindingItem, scroll: boolean) => {
  if (scroll && f.type === 'contrast-ok') say(t('This line stands for every text that passes: there is nothing to show on the page.'))
  return focusOnPage(f.id, scroll, f.theme)
}

/** Crops a screenshot of the page to one element, small enough to live in the audit and in the Excel file. */
export function cropShot(dataUrl: string, loc: { rect: { x: number; y: number; w: number; h: number }; vw: number }): Promise<string | null> {
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
export async function captureShots(list: FindingItem[]): Promise<number> {
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
      const cap: CaptureResponse | undefined = await chrome.runtime.sendMessage({ type: 'RGAA_CAPTURE', tabId })
      if (!cap || !('dataUrl' in cap) || !cap.dataUrl) {
        // nothing is saved: a picture of another tab must never be attached to this page
        const code = cap && 'code' in cap ? cap.code : undefined
        if (code === 'not-active' || code === 'changed') say(t('The inspected tab is not the one shown. Switch back to it, then try again.'))
        else say(t('Could not take previews ({error}). Check that the extension may access this site.', { error: cap && 'error' in cap ? cap.error : t('no screenshot') }))
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

/** Evaluates an expression in the inspected page; '' when DevTools gives no usable string. */
export function inspectedEval(expression: string): Promise<string> {
  return new Promise((resolve) => {
    try {
      chrome.devtools.inspectedWindow.eval(expression, (result: unknown, error: unknown) => resolve(error || typeof result !== 'string' ? '' : result))
    } catch {
      resolve('')
    }
  })
}

export async function tabInfo(): Promise<{ url: string; title: string }> {
  const info: TabInfoResponse | null = await chrome.runtime.sendMessage({ type: 'RGAA_TAB_INFO', tabId: inspectedTabId() }).catch(() => null)
  return { url: typeof info?.url === 'string' ? info.url : '', title: typeof info?.title === 'string' ? info.title : '' }
}

export async function inspectedUrl(): Promise<string> {
  const url = await inspectedEval('location.href')
  return /^https?:|^file:/i.test(url) ? url : (await tabInfo()).url
}

export async function inspectedTitle(): Promise<string> {
  return (await inspectedEval('document.title')) || (await tabInfo()).title
}
