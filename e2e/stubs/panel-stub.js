// Runs in the panel page BEFORE the panel script. Stands in for the extension APIs the panel uses:
// chrome.devtools.inspectedWindow / network, chrome.runtime (messages), chrome.storage.local.
// Everything that needs the browser tab goes through window.__rgaaBridge, answered by the Playwright test (Node side).
;(() => {
  const PREFIX = 'e2e-chrome-storage:'
  const store = {
    async get(keys) {
      const all = Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).map((k) => k.slice(PREFIX.length))
      const wanted = keys == null ? all : typeof keys === 'string' ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys)
      const out = {}
      for (const k of wanted) {
        const raw = localStorage.getItem(PREFIX + k)
        if (raw !== null) out[k] = JSON.parse(raw)
      }
      return out
    },
    async set(values) {
      for (const [k, v] of Object.entries(values)) localStorage.setItem(PREFIX + k, JSON.stringify(v))
    },
    async remove(keys) {
      for (const k of Array.isArray(keys) ? keys : [keys]) localStorage.removeItem(PREFIX + k)
    },
  }
  const messageListeners = []
  const navListeners = []

  // The background page's job for RGAA_SAVE / RGAA_DELETE: the REAL write queue (src/lib/persistence.ts, bundled by globalSetup).
  const background = async (message) => {
    const persistence = (window.__rgaaPersistence ||= window.RgaaPersistence.createPersistence())
    if (message?.type === 'RGAA_SAVE') return persistence.save(message)
    if (message?.type === 'RGAA_DELETE') return persistence.remove(message)
    return window.__rgaaBridge(message) // everything else needs the tab: answered in Node
  }

  window.chrome = {
    storage: { local: store },
    runtime: {
      id: 'e2e-extension',
      // structured clone like the real message channel
      sendMessage: (message) => background(JSON.parse(JSON.stringify(message))),
      onMessage: { addListener: (fn) => void messageListeners.push(fn) },
    },
    devtools: {
      inspectedWindow: {
        tabId: 1,
        eval: (expression, callback) => {
          window
            .__rgaaBridge({ type: 'E2E_EVAL', expression })
            .then((r) => callback?.(r.result, r.error ? { isException: true, value: r.error } : undefined))
        },
      },
      network: { onNavigated: { addListener: (fn) => void navListeners.push(fn) } },
    },
  }
  // for the test: push a message / a navigation to the panel like the extension would
  window.__rgaaEmit = (message) => messageListeners.forEach((fn) => fn(message, {}, () => undefined))
  window.__rgaaNavigated = (url) => navListeners.forEach((fn) => fn(url))
})()
