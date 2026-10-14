import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, type BrowserContext, type Page } from '@playwright/test'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (...parts: string[]) => readFileSync(join(root, ...parts), 'utf8')

export const SITE_URL = 'http://127.0.0.1:4174/index.html'
export const PANEL_URL = 'http://127.0.0.1:4173/src/panel/panel.html'

/** The built content script, found the way the browser finds it: through dist/manifest.json. */
function contentScriptSource(): string {
  const manifest = JSON.parse(read('dist', 'manifest.json'))
  const files: string[] = manifest.content_scripts.flatMap((c: { js?: string[] }) => c.js ?? [])
  if (!files.length) throw new Error('no content script in dist/manifest.json')
  return files.map((f) => read('dist', f)).join('\n;\n')
}

export interface Rig {
  site: Page
  panel: Page
  /** Console errors and uncaught exceptions of both pages, for the failure report. */
  problems: string[]
  /** Loads the built panel page again (a new page load; the storage stays). */
  reloadPanel(): Promise<void>
}

/**
 * Two pages play the DevTools setup: `site` is the inspected tab (fixture site + the BUILT content script),
 * `panel` is the BUILT panel page. A stub of the extension API in each page and the bridge below replace the
 * browser: the panel's messages (RGAA_RELAY, RGAA_AXE, RGAA_CAPTURE, RGAA_TAB_INFO, inspectedWindow.eval) are answered here.
 */
export async function openRig(context: BrowserContext): Promise<Rig> {
  const problems: string[] = []
  const site = await context.newPage()
  const panel = await context.newPage()
  for (const [name, page] of [['site', site], ['panel', panel]] as const) {
    // The structure preview is a sandboxed frame (no script, no storage): the test stand-in injected into every frame cannot run there, which is expected.
    const inSandbox = (text: string) => /sandboxed/.test(text)
    page.on('console', (m) => m.type() === 'error' && !inSandbox(m.text()) && problems.push(`[${name}] console.error: ${m.text()}`))
    page.on('pageerror', (e) => !inSandbox(e.message) && problems.push(`[${name}] uncaught: ${e.message}`))
    // nothing may leave the loopback: an external request is a bug of the test or of the app
    page.on('request', (r) => {
      if (!/^(http:\/\/127\.0\.0\.1|data:|blob:|about:)/.test(r.url())) problems.push(`[${name}] external request: ${r.url()}`)
    })
  }

  let axeInjected = false
  const dispatch = (payload: unknown) => site.evaluate((m) => (window as any).__rgaaDispatch(m), payload)

  /** What the background page does for the messages that need the tab. */
  const background = async (message: any): Promise<unknown> => {
    switch (message?.type) {
      case 'E2E_EVAL':
        try {
          if (message.expression.startsWith('location.href = ')) {
            const url = JSON.parse(message.expression.slice('location.href = '.length))
            await site.goto(url)
            axeInjected = false
            await site.addScriptTag({ content: contentScriptSource() })
            await panel.evaluate((url) => (window as any).__rgaaNavigated(url), site.url())
            return { result: site.url() }
          }
          return { result: await site.evaluate(message.expression) }
        } catch (err) {
          return { error: String(err) }
        }
      case 'RGAA_RELAY':
        return dispatch(message.payload)
      case 'RGAA_TAB_INFO':
        return { url: site.url(), title: await site.title() }
      case 'RGAA_STYLE':
        // the real background injects the CSS with scripting.insertCSS (not available here): a <style> element stands in for it
        await site.evaluate(
          ([id, css, on]) => {
            document.querySelectorAll(`style[data-e2e-style="${id}"]`).forEach((n) => n.remove())
            if (!on) return
            const style = document.createElement('style')
            style.dataset.e2eStyle = String(id)
            style.textContent = String(css)
            document.head.append(style)
          },
          [message.id, message.css, message.on],
        )
        return { ok: true }
      case 'RGAA_CAPTURE':
        return { dataUrl: `data:image/png;base64,${(await site.screenshot({ type: 'png' })).toString('base64')}` }
      case 'RGAA_AXE':
        if (!axeInjected) {
          await site.addScriptTag({ path: join(root, 'dist', 'axe.min.js') })
          axeInjected = true
        }
        return dispatch({ type: 'RGAA_AXE_RUN', locale: message.locale ?? null, rules: message.rules ?? null })
      case 'RGAA_AXE_LOAD':
        if (!axeInjected) {
          await site.addScriptTag({ path: join(root, 'dist', 'axe.min.js') })
          axeInjected = true
        }
        return { ok: true }
      case 'RGAA_NEW_IMAGES':
        return undefined
      default:
        return { error: `the e2e background does not know ${message?.type}` }
    }
  }

  // site page: stub of chrome.runtime BEFORE the content script, then the content script (as at document_idle)
  await site.exposeFunction('__rgaaToBackground', async (m: unknown) => background(m))
  await site.addInitScript({ content: read('e2e', 'stubs', 'site-stub.js') })
  await site.goto(SITE_URL)
  await site.addScriptTag({ content: contentScriptSource() })

  // panel page: stub of the extension API, the real write queue, the French UI
  await panel.exposeFunction('__rgaaBridge', async (m: unknown) => background(m))
  await panel.addInitScript({ content: read('e2e', '.build', 'persistence.js') })
  await panel.addInitScript({ content: read('e2e', 'stubs', 'panel-stub.js') })
  await panel.addInitScript(() => {
    if (!localStorage.getItem('rgaa-lang')) localStorage.setItem('rgaa-lang', 'fr')
  })
  await panel.goto(PANEL_URL)

  return {
    site,
    panel,
    problems,
    reloadPanel: async () => {
      await panel.reload()
    },
  }
}

/** Element-only scans are a secondary page action, distinct from the full automatic run. */
export async function scanElements(panel: Page): Promise<void> {
  await panel.locator('#scan-btn').click()
  // a page has every theme by default: the scan (elements, then the previews) takes a moment; wait until it is over
  await expect(panel.locator('#status')).not.toContainText('Analyse en cours', { timeout: 60_000 })
}
