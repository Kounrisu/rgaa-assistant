// Runs in the page under test BEFORE the content script. Stands in for the part of chrome.runtime a content script uses.
;(() => {
  const listeners = []
  window.chrome = window.chrome || {}
  window.chrome.runtime = {
    id: 'e2e-extension',
    // content script -> background (new images, screenshots); the Node side answers
    sendMessage: (message) => window.__rgaaToBackground(message),
    onMessage: { addListener: (fn) => void listeners.push(fn), removeListener: () => undefined },
    getURL: (path) => `/${path}`,
  }
  // The bridge calls this with a message; it resolves with what the first listener sends back (supports `return true`).
  window.__rgaaDispatch = (message) =>
    new Promise((resolve) => {
      let answered = false
      const sendResponse = (value) => {
        if (answered) return
        answered = true
        resolve(value)
      }
      let async = false
      for (const fn of listeners) {
        try {
          if (fn(message, {}, sendResponse) === true) async = true
        } catch (err) {
          sendResponse({ error: String(err) })
        }
      }
      if (!async && !answered) resolve(undefined)
    })
})()
