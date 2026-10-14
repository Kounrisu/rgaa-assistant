import { beforeEach, describe, expect, it, vi } from 'vitest'
import { captureInspectedTab, type TabsApi } from '../src/lib/capture'
import { FakeStorage, installChrome, sampleAudit } from './fakes'

interface FakeTab {
  id: number
  windowId: number
  active: boolean
}

/** chrome.tabs with a few windows; `shot` records every screenshot taken. */
function fakeTabs(tabs: FakeTab[]) {
  const shots: { windowId: number; of: number | undefined }[] = []
  const api: TabsApi = {
    get: async (id) => {
      const tab = tabs.find((t) => t.id === id)
      if (!tab) throw new Error(`No tab with id: ${id}`)
      return { ...tab }
    },
    query: async ({ windowId }) => tabs.filter((t) => t.windowId === windowId && t.active).map((t) => ({ id: t.id })),
    captureVisibleTab: async (windowId) => {
      // like Chrome: the picture is of the ACTIVE tab of that window
      shots.push({ windowId, of: tabs.find((t) => t.windowId === windowId && t.active)?.id })
      return `data:image/png;base64,tab-${shots.at(-1)?.of}`
    },
  }
  return { api, shots, tabs }
}

describe('captureInspectedTab', () => {
  it('photographs the inspected tab when it is the one shown', async () => {
    const { api, shots } = fakeTabs([{ id: 1, windowId: 10, active: true }, { id: 2, windowId: 10, active: false }])
    expect(await captureInspectedTab(api, 1)).toEqual({ dataUrl: 'data:image/png;base64,tab-1' })
    expect(shots).toEqual([{ windowId: 10, of: 1 }])
  })

  it('an inactive inspected tab produces no screenshot at all', async () => {
    const { api, shots } = fakeTabs([{ id: 1, windowId: 10, active: false }, { id: 2, windowId: 10, active: true }])
    const result = await captureInspectedTab(api, 1)
    expect(result).toMatchObject({ code: 'not-active' })
    expect('dataUrl' in result).toBe(false)
    expect(shots).toEqual([]) // the picture of tab 2 was never taken, let alone attributed to tab 1
  })

  it('a tab active in another window is checked against its own window', async () => {
    const { api, shots } = fakeTabs([{ id: 1, windowId: 10, active: true }, { id: 3, windowId: 20, active: true }])
    expect(await captureInspectedTab(api, 3)).toEqual({ dataUrl: 'data:image/png;base64,tab-3' })
    expect(shots).toEqual([{ windowId: 20, of: 3 }])
  })

  it('refuses when the window reports another active tab than the inspected one', async () => {
    const { api, shots, tabs } = fakeTabs([{ id: 1, windowId: 10, active: true }, { id: 2, windowId: 10, active: true }])
    expect(tabs).toHaveLength(2)
    expect(await captureInspectedTab(api, 1)).toMatchObject({ code: 'not-active' })
    expect(shots).toEqual([])
  })

  it('reports a tab switch that happens during the capture, without returning the picture', async () => {
    const { api, tabs } = fakeTabs([{ id: 1, windowId: 10, active: true }, { id: 2, windowId: 10, active: false }])
    const capture = api.captureVisibleTab
    api.captureVisibleTab = async (w, o) => {
      const url = await capture(w, o)
      tabs[0].active = false
      tabs[1].active = true
      return url
    }
    const result = await captureInspectedTab(api, 1)
    expect(result).toMatchObject({ code: 'changed' })
    expect('dataUrl' in result).toBe(false)
  })

  it('reports an unknown tab, a missing id and a failing capture', async () => {
    const { api } = fakeTabs([{ id: 1, windowId: 10, active: true }])
    expect(await captureInspectedTab(api, 99)).toMatchObject({ code: 'no-tab' })
    expect(await captureInspectedTab(api, undefined)).toMatchObject({ code: 'no-tab' })
    api.captureVisibleTab = async () => {
      throw new Error('Cannot access contents of the page')
    }
    expect(await captureInspectedTab(api, 1)).toMatchObject({ code: 'failed', error: expect.stringContaining('Cannot access') })
  })
})

describe('the background page', () => {
  type Listener = (message: unknown, sender: unknown, respond: (r: unknown) => void) => boolean | undefined
  let listener: Listener
  let storage: FakeStorage
  const tabs = [{ id: 1, windowId: 10, active: false }, { id: 2, windowId: 10, active: true }]

  beforeEach(async () => {
    storage = new FakeStorage()
    const api = fakeTabs(tabs).api
    installChrome(storage, {
      runtime: { onMessage: { addListener: (fn: Listener) => { listener = fn } }, sendMessage: async () => undefined },
      windows: { onFocusChanged: { addListener: () => undefined } },
      tabs: { get: api.get, query: api.query, captureVisibleTab: api.captureVisibleTab, onActivated: { addListener: () => undefined }, onUpdated: { addListener: () => undefined } },
    })
    vi.resetModules()
    await import('../src/background')
  })

  const ask = (message: unknown, sender: unknown = {}) =>
    new Promise<any>((resolve) => {
      const async = listener(message, sender, resolve)
      expect(async).toBe(true)
    })

  it('answers RGAA_CAPTURE from the panel (tabId) and from a page script (sender.tab)', async () => {
    expect(await ask({ type: 'RGAA_CAPTURE', tabId: 1 })).toMatchObject({ code: 'not-active' })
    expect(await ask({ type: 'RGAA_CAPTURE' }, { tab: { id: 1 } })).toMatchObject({ code: 'not-active' })
    expect(await ask({ type: 'RGAA_CAPTURE' }, { tab: { id: 2 } })).toEqual({ dataUrl: 'data:image/png;base64,tab-2' })
  })

  it('RGAA_SAVE from two panels at once keeps both audits in the index; RGAA_DELETE removes one', async () => {
    storage.latency = 3
    const a = sampleAudit('A')
    const b = sampleAudit('B')
    const [ra, rb] = await Promise.all([ask({ type: 'RGAA_SAVE', audit: a, revision: 4 }), ask({ type: 'RGAA_SAVE', audit: b, revision: 9 })])
    expect(ra).toEqual({ ok: true, revision: 4 })
    expect(rb).toEqual({ ok: true, revision: 9 })
    expect((storage.data['rgaa-index'] as { id: string }[]).map((s) => s.id).sort()).toEqual([a.id, b.id].sort())
    expect(await ask({ type: 'RGAA_DELETE', id: a.id })).toMatchObject({ ok: true })
    expect((storage.data['rgaa-index'] as { id: string }[]).map((s) => s.id)).toEqual([b.id])
  })

  it('RGAA_SAVE reports a storage failure to the panel', async () => {
    storage.failSet = true
    expect(await ask({ type: 'RGAA_SAVE', audit: sampleAudit(), revision: 1 })).toMatchObject({ ok: false, code: 'storage' })
  })

  it('ignores messages it does not know', () => {
    expect(listener({ type: 'SOMETHING_ELSE' }, {}, () => undefined)).toBeUndefined()
  })
})
