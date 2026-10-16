/**
 * Which browser tab this DevTools panel audits. DevTools belong to ONE tab: when another tab is in front (DevTools
 * undocked, or a second window), nothing on screen says the panel still audits the first one. This shows the audited
 * tab's title, and a banner with a way back when it is not the tab in front.
 * A DevTools page cannot use chrome.tabs: the background answers (RGAA_TAB_INFO) and tells us when something changed.
 */
import { $ } from './dom'
import { t } from '../lib/i18n'
import { inspectedTab, inspectedTabId } from './page-bridge'
import { hostName } from './helpers'

export async function refreshInspectedTab(): Promise<void> {
  const tab = await inspectedTab()
  const el = $('inspected-tab')
  if (!tab.url && !tab.title) return void (el.hidden = true)
  const title = tab.title || hostName(tab.url) || tab.url
  el.hidden = false
  el.textContent = t('Audited tab: {title}', { title })
  el.title = t('This panel audits the browser tab “{title}” ({url}), whichever tab is in front.', { title, url: tab.url })
  el.classList.toggle('behind', tab.active === false)
  $('tab-banner').hidden = tab.active !== false
  $('tab-banner-text').textContent = t('Another tab is in front. This panel audits the tab “{title}”, not the one you are looking at.', { title })
}

/** Keeps the chip and the banner up to date. */
export function watchInspectedTab(): void {
  $('tab-banner-btn').addEventListener('click', () => void chrome.runtime.sendMessage({ type: 'RGAA_TAB_SHOW', tabId: inspectedTabId() }).catch(() => undefined))
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === 'RGAA_TAB_EVENT') void refreshInspectedTab()
  })
  void refreshInspectedTab()
}
