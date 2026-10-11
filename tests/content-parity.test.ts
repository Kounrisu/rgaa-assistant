/**
 * Golden parity test of the content script (src/content/inject.ts and the modules it imports).
 *
 * How it works: the content script is bundled by esbuild into one IIFE string (the same shape as in the extension),
 * then evaluated in a jsdom window loaded with a fixture page and a `chrome` stub that collects the onMessage listeners.
 * The messages the panel sends (scans, overlay handling, snapshot, own rules) are replayed and every response, plus the
 * markup of the overlay the script draws in the page, is compared with a committed snapshot (tests/snapshots/content-parity).
 * A refactoring of the content script must leave these files unchanged.
 *
 * Limits: jsdom has no layout. `getBoundingClientRect` is replaced by a deterministic stub (see installLayoutStub):
 * boxes are 100x20 px placed in document order, elements in a `display:none` branch get an empty box, and elements
 * pushed off-screen by `left <= -999px` get a 1x1 px box. So the visibility-based results (what is "visible",
 * the position of the boxes) reflect that stub, not a real browser. Canvas, the colour picker, axe and real
 * hit-testing (elementFromPoint) are not covered. Stub choices are the only source of "fake" values.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { buildSync } from 'esbuild'
import { JSDOM, VirtualConsole } from 'jsdom'
import { beforeAll, describe, expect, it } from 'vitest'

const root = fileURLToPath(new URL('..', import.meta.url))
const pagesDir = fileURLToPath(new URL('./fixtures/pages/', import.meta.url))

let bundle = ''
beforeAll(() => {
  const out = buildSync({
    entryPoints: [`${root}src/content/inject.ts`],
    bundle: true,
    write: false,
    format: 'iife',
    target: 'es2022',
    logLevel: 'silent',
  })
  bundle = out.outputFiles[0].text
})

type Listener = (message: unknown, sender: unknown, sendResponse: (r: unknown) => void) => unknown

interface Page {
  dom: JSDOM
  send: (message: Record<string, unknown>) => { returned: unknown; response: unknown }
  overlayHtml: () => string[]
}

/** Deterministic layout: see the file header. */
function installLayoutStub(window: JSDOM['window']): void {
  const order = new WeakMap<Element, number>()
  window.document.querySelectorAll('*').forEach((el, i) => order.set(el, i))
  const empty = { x: 0, y: 0, left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }
  const rect = (left: number, top: number, width: number, height: number) => ({ x: left, y: top, left, top, width, height, right: left + width, bottom: top + height, toJSON: () => ({}) })
  window.Element.prototype.getBoundingClientRect = function (this: Element) {
    const i = order.get(this)
    if (i === undefined) return empty as DOMRect
    for (let n: Element | null = this; n; n = n.parentElement) {
      if (window.getComputedStyle(n).display === 'none') return empty as DOMRect
    }
    const cs = window.getComputedStyle(this)
    if (cs.position === 'absolute' && parseFloat(cs.left) <= -999) return rect(-9999, 0, 1, 1) as DOMRect
    return rect(8, 8 + 30 * i, 100, 20) as DOMRect
  }
  const w = window as unknown as Record<string, unknown>
  w.CSS = { escape: (s: string) => String(s).replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`) }
  window.Element.prototype.scrollIntoView = () => undefined
  w.matchMedia = () => ({ matches: false })
  if (!window.Range.prototype.getClientRects) window.Range.prototype.getClientRects = (() => []) as never
}

function loadPage(html: string): Page {
  const dom = new JSDOM(html, { url: 'https://page.test/start', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: new VirtualConsole() })
  const { window } = dom
  installLayoutStub(window)
  const listeners: Listener[] = []
  ;(window as unknown as Record<string, unknown>).chrome = {
    runtime: {
      id: 'test',
      onMessage: { addListener: (l: Listener) => listeners.push(l) },
      sendMessage: () => Promise.resolve(undefined),
    },
  }
  window.eval(bundle)
  expect(listeners).toHaveLength(1)
  return {
    dom,
    send(message) {
      let response: unknown
      const returned = listeners[0](message, {}, (r) => (response = r))
      return { returned, response }
    },
    overlayHtml: () => Array.from(window.document.querySelectorAll('[id^="rgaa-assistant-overlay"], #rgaa-assistant-style')).map((n) => n.outerHTML),
  }
}

/** Plain JSON; timestamps and the per-load instance marker (Date.now + random) normalised. */
function normalise(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (key, v) => (key === 'at' && typeof v === 'number' ? 0 : typeof v === 'string' ? v.replace(/data-rgaa-instance="[^"]*"/g, 'data-rgaa-instance="X"') : v)),
  )
}

function replay(html: string): unknown {
  const page = loadPage(html)
  const log: Record<string, unknown> = {}
  const step = (name: string, message: Record<string, unknown>) => (log[name] = normalise(page.send(message)))

  step('highlight images', { type: 'RGAA_HIGHLIGHT_IMAGES', color: '#e11d48' })
  for (const theme of [2, 3, 5, 6, 7, 9, 11]) step(`scan theme ${theme}`, { type: 'RGAA_SCAN_THEME', theme, color: `#0000${theme.toString(16).padStart(2, '0')}` })
  step('rules run', { type: 'RGAA_RULES_RUN' })
  step('snapshot', { type: 'RGAA_SNAPSHOT' })
  log['overlay after scans'] = page.overlayHtml()

  step('states theme 1', { type: 'RGAA_STATES', theme: 1, states: { 1: 'c', 2: 'nc', 3: 'review' } })
  step('states theme 6', { type: 'RGAA_STATES', theme: 6, states: { 1: 'error', 2: 'ignored', 3: 'c' } })
  step('overlay options', { type: 'RGAA_OVERLAY', visibility: { 1: true, 6: false }, tint: false, alt: true })
  step('focus image 1', { type: 'RGAA_FOCUS_IMAGE', id: 1, scroll: false })
  step('focus link 2', { type: 'RGAA_FOCUS_IMAGE', id: 2, scroll: false, theme: 6 })
  step('focus unknown', { type: 'RGAA_FOCUS_IMAGE', id: 9999, scroll: true, theme: 6 })
  step('show only theme 6', { type: 'RGAA_SHOW_ONLY', theme: 6, ids: [1, 2] })
  step('show only theme 1', { type: 'RGAA_SHOW_ONLY', theme: 1, ids: [1] })
  step('locate', { type: 'RGAA_LOCATE', theme: 6, id: 1 })
  step('locate unknown', { type: 'RGAA_LOCATE', theme: 6, id: 9999 })
  step('scroll restore', { type: 'RGAA_SCROLL_RESTORE' })
  step('unfocus', { type: 'RGAA_UNFOCUS_IMAGE' })
  step('relabel theme 1', { type: 'RGAA_RELABEL', map: [{ from: 1, to: 11 }, { from: 2, to: 12 }] })
  step('relabel theme 6', { type: 'RGAA_RELABEL', theme: 6, map: [{ from: 1, to: 21 }] })
  step('overlay options 2', { type: 'RGAA_OVERLAY', visibility: { 1: true, 6: true }, tint: true, alt: false })
  step('tool reveal on', { type: 'RGAA_TOOL', tool: 'reveal', on: true })
  step('tool tables on', { type: 'RGAA_TOOL', tool: 'tables', on: true })
  step('tool taborder on', { type: 'RGAA_TOOL', tool: 'taborder', on: true })
  log['overlay after interactions'] = page.overlayHtml()
  step('tools reset', { type: 'RGAA_TOOLS_RESET' })
  step('pick cancel', { type: 'RGAA_PICK_CANCEL' })
  step('unknown message', { type: 'RGAA_NOPE' })
  step('clear theme 3', { type: 'RGAA_CLEAR_THEME', theme: 3 })
  step('clear theme 1', { type: 'RGAA_CLEAR_THEME', theme: 1 })
  log['overlay after clear themes'] = page.overlayHtml()
  step('clear highlights', { type: 'RGAA_CLEAR_HIGHLIGHTS' })
  log['overlay after clear all'] = page.overlayHtml()
  return log
}

describe('content script parity', () => {
  const files = readdirSync(pagesDir).filter((f) => f.endsWith('.html')).sort()
  it('has fixtures', () => expect(files.length).toBeGreaterThanOrEqual(9))
  for (const file of files) {
    it(`replies identically on ${file}`, async () => {
      const log = replay(readFileSync(pagesDir + file, 'utf8'))
      await expect(JSON.stringify(log, null, 2) + '\n').toMatchFileSnapshot(`./snapshots/content-parity/${file.replace(/\.html$/, '')}.json`)
    }, 30_000) // a page with many components takes a few seconds in jsdom when the whole suite runs
  }
})
