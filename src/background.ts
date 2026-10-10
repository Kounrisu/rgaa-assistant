// DevTools pages can't use chrome.tabs, so the panel asks us to relay
// messages to the content script of the inspected tab.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // A picture of what the tab shows; the panel crops it to the element it is interested in.
  if (message?.type === 'RGAA_CAPTURE') {
    chrome.tabs
      .get(message.tabId ?? sender.tab?.id)
      .then((tab) => chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' }))
      .then((dataUrl) => sendResponse({ dataUrl }), (err) => sendResponse({ error: String(err) }))
    return true
  }
  // Firefox sometimes gives DevTools no result for eval('location.href'): ask the tab itself.
  if (message?.type === 'RGAA_TAB_INFO') {
    chrome.tabs
      .get(message.tabId)
      .then((tab) => sendResponse({ url: tab.url ?? '', title: tab.title ?? '' }), () => sendResponse({ url: '', title: '' }))
    return true
  }
  // Automatic checks: the axe engine is injected into the page only when asked, then run there.
  if (message?.type === 'RGAA_AXE') {
    chrome.scripting
      .executeScript({ target: { tabId: message.tabId }, files: ['axe.min.js'] })
      .then(() => chrome.tabs.sendMessage(message.tabId, { type: 'RGAA_AXE_RUN', locale: message.locale ?? null }))
      .then(sendResponse, (err) => sendResponse({ error: String(err) }))
    return true
  }
  if (message?.type !== 'RGAA_RELAY') return undefined
  chrome.tabs
    .sendMessage(message.tabId, message.payload)
    .then(sendResponse, (err) => sendResponse({ error: String(err) }))
  return true
})
