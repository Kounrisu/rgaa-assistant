/**
 * Which browser tab this DevTools panel audits. DevTools belong to ONE tab: when another tab is in front (DevTools
 * undocked, or a second window), nothing on screen says the panel still audits the first one. This shows the audited
 * tab's title, and a banner with a way back when it is not the tab in front.
 */
import { $ } from './dom'
import { t } from '../lib/i18n'
import { inspectedTab, inspectedTabId } from './page-bridge'
import { hostName } from './helpers'

const chip = () => $('inspected-tab')
let lastTitle = ''

export async function refreshInspectedTab(): Promise<void> {
  const tab = await inspectedTab()
  if (!tab.url && !tab.title) return void (chip().hidden = true)
  lastTitle = tab.title || hostName(tab.url) || tab.url
  const el = chip()
  el.hidden = false
  el.textContent = t('Audited tab: {title}', { title: lastTitle })
  el.title = t('This panel audits the browser tab “{title}” ({url}), whichever tab is in front.', { title: lastTitle, url: tab.url })
  el.classList.toggle('behind', tab.active === false)
  const banner = $('tab-banner')
  banner.hidden = tab.active !== false
  $('tab-banner-text').textContent = t('Another tab is in front. This panel audits the tab “{title}”, not the one you are looking at.', { title: lastTitle })
}

/** Keeps the chip and the banner up to date; does nothing where the browser gives no tab events. */
export function watchInspectedTab(): void {
  $('tab-banner-btn').addEventListener('click', async () => {
    try {
      const tab = await chrome.tabs.update(inspectedTabId(), { active: true })
      if (tab?.windowId !== undefined) await chrome.windows.update(tab.windowId, { focused: true })
    } catch {
      // the tab was closed: the chip will say so on the next refresh
    }
  })
  void refreshInspectedTab()
  if (!chrome.tabs?.onActivated) return
  chrome.tabs.onActivated.addListener(() => void refreshInspectedTab())
  chrome.tabs.onUpdated?.addListener((id) => { if (id === inspectedTabId()) void refreshInspectedTab() })
  chrome.windows?.onFocusChanged?.addListener(() => void refreshInspectedTab())
}
