/** Runs only explicitly selected URLs, sequentially in the existing inspected tab. */
import { state } from './state'
import { actions } from './actions'
import { inspectedUrl } from './page-bridge'
import { normalizeUrl } from '../lib/audit-store'
import { isNavigableUrl } from '../lib/url-safety'
import { loadPage, persist } from './model'
import { runEverything } from './auto-checks'
import { sleep } from './helpers'
import { say } from './dom'
import { t } from '../lib/i18n'

async function waitForPage(url: string): Promise<void> {
  const deadline = Date.now() + 20_000
  while (Date.now() < deadline) {
    if (normalizeUrl(await inspectedUrl()) === normalizeUrl(url)) {
      const ready = await new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => resolve(false), 1000)
        chrome.devtools.inspectedWindow.eval('document.readyState', (value, error) => { clearTimeout(timer); resolve(!error && value === 'complete') })
      })
      if (ready) return
    }
    await sleep(250)
  }
  throw new Error(t('The registered URL did not finish loading. Check redirects, authentication and site access, then retry.'))
}

export async function runSelected(resume = false): Promise<void> {
  if (state.runBusy || state.batch?.running) return
  if (!resume) {
    const ids = state.audit.pages.filter((p) => state.batchSelection.has(p.id)).map((p) => p.id)
    if (!ids.length) return
    state.batch = { ids, index: 0, paused: false, running: false, auditId: state.audit.id }
  }
  const batch = state.batch
  if (!batch || batch.auditId !== state.audit.id) return
  batch.paused = false
  batch.running = true
  actions.renderAll()
  try {
    if (!(await state.session.saveNow())) { batch.paused = true; return }
    for (; batch.index < batch.ids.length; batch.index++) {
      if (batch.paused) break
      const rec = state.audit.pages.find((p) => p.id === batch.ids[batch.index])
      if (!rec) continue
      loadPage(rec)
      try {
        if (!isNavigableUrl(rec.url)) throw new Error(t('This address cannot be opened: only http, https and file addresses are.'))
        // Keep an already open page's dynamic state. Waiting on a reload of the same URL
        // could otherwise mistake the old document's readyState for the new one.
        if (normalizeUrl(await inspectedUrl()) !== normalizeUrl(rec.url)) {
          await new Promise<void>((resolve) => {
            const timer = setTimeout(resolve, 1500)
            chrome.devtools.inspectedWindow.eval(`location.href = ${JSON.stringify(rec.url)}`, () => { clearTimeout(timer); resolve() })
          })
        }
        await waitForPage(rec.url)
        state.liveUrl = await inspectedUrl()
        await runEverything()
      } catch (err) {
        rec.automaticRun = { status: 'failed', startedAt: Date.now(), finishedAt: Date.now(), url: rec.url, error: String((err as Error).message ?? err) }
        persist()
      }
      if (!(await state.session.saveNow())) { batch.paused = true; break }
    }
  } finally {
    batch.running = false
    actions.setView('sample')
    actions.renderAll()
    say(batch.index < batch.ids.length ? t('Batch paused. Resume to continue with the remaining pages.') : t('Batch finished. Review each page status and confirm the suggestions.'))
  }
}
