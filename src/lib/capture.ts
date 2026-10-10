import type { CaptureErrorCode, CaptureResponse } from './messages'

/** The part of chrome.tabs that taking a screenshot needs (injected, so it can be tested). */
export interface TabsApi {
  get(tabId: number): Promise<{ id?: number; active: boolean; windowId: number }>
  query(info: { active: boolean; windowId: number }): Promise<{ id?: number }[]>
  captureVisibleTab(windowId: number, options: { format: 'png' }): Promise<string>
}

const fail = (code: CaptureErrorCode, error: string): CaptureResponse => ({ code, error })

/**
 * A picture of the inspected tab, or an error: captureVisibleTab() photographs whatever tab is shown in the window,
 * which is not the inspected one when the user switched tabs. The tab is checked before and after the picture,
 * and nothing is switched automatically.
 */
export async function captureInspectedTab(tabs: TabsApi, tabId: number | undefined): Promise<CaptureResponse> {
  if (typeof tabId !== 'number') return fail('no-tab', 'no tab')
  let tab
  try {
    tab = await tabs.get(tabId)
  } catch (err) {
    return fail('no-tab', String(err))
  }
  try {
    const shown = tab.active ? await tabs.query({ active: true, windowId: tab.windowId }) : []
    if (!tab.active || shown.length !== 1 || shown[0].id !== tabId) return fail('not-active', 'the inspected tab is not the tab shown in its window')
    const dataUrl = await tabs.captureVisibleTab(tab.windowId, { format: 'png' })
    const after = await tabs.get(tabId)
    if (!after.active || after.windowId !== tab.windowId) return fail('changed', 'the tab shown changed while the picture was taken')
    return { dataUrl }
  } catch (err) {
    return fail('failed', String(err))
  }
}
