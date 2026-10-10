import { captureInspectedTab } from './lib/capture'
import type { BackgroundMessage, TabInfoResponse } from './lib/messages'
import { createPersistence } from './lib/persistence'

// The only writer of the audits: panels send RGAA_SAVE / RGAA_DELETE and the writes run one at a time.
const persistence = createPersistence()

// DevTools pages can't use chrome.tabs, so the panel asks us to relay
// messages to the content script of the inspected tab.
chrome.runtime.onMessage.addListener((message: BackgroundMessage, sender, sendResponse) => {
  switch (message?.type) {
    case 'RGAA_SAVE':
      void persistence.save(message).then(sendResponse)
      return true
    case 'RGAA_DELETE':
      void persistence.remove(message).then(sendResponse)
      return true
    // A picture of what the tab shows; the panel crops it to the element it is interested in.
    // Only the inspected tab, and only while it is the one shown in its window (see capture.ts).
    case 'RGAA_CAPTURE':
      void captureInspectedTab(chrome.tabs, message.tabId ?? sender.tab?.id).then(sendResponse)
      return true
    // Firefox sometimes gives DevTools no result for eval('location.href'): ask the tab itself.
    case 'RGAA_TAB_INFO':
      chrome.tabs
        .get(message.tabId)
        .then((tab): TabInfoResponse => ({ url: tab.url ?? '', title: tab.title ?? '' }), (): TabInfoResponse => ({ url: '', title: '' }))
        .then(sendResponse)
      return true
    // Automatic checks: the axe engine is injected into the page only when asked, then run there.
    case 'RGAA_AXE':
      chrome.scripting
        .executeScript({ target: { tabId: message.tabId }, files: ['axe.min.js'] })
        .then(() => chrome.tabs.sendMessage(message.tabId, { type: 'RGAA_AXE_RUN', locale: message.locale ?? null, rules: message.rules ?? null }))
        .then(sendResponse, (err) => sendResponse({ error: String(err) }))
      return true
    case 'RGAA_RELAY':
      chrome.tabs
        .sendMessage(message.tabId, message.payload)
        .then(sendResponse, (err) => sendResponse({ error: String(err) }))
      return true
    default:
      return undefined
  }
})
