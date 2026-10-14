/**
 * Opens the reading page (page reading, table reading, structure preview) in a browser tab of its own, like the RGAA
 * coverage page: the panel is too small to read a whole page. The data is handed over through the extension storage.
 */
import { state } from './state'
import type { TranscriptResult } from '../content/transcript'
import type { StructureData } from './structure-preview'

export const VIEW_KEY = 'rgaa-view-data'

export type ViewData =
  | { kind: 'reading'; title: string; result: TranscriptResult; url: string; at: number; lang: string }
  | { kind: 'structure'; title: string; result: StructureData; url: string; at: number; lang: string }

type Extra = 'url' | 'at' | 'lang'
type ViewInput = ViewData extends infer V ? (V extends ViewData ? Omit<V, Extra> : never) : never

export async function openView(data: ViewInput, lang: string): Promise<void> {
  await chrome.storage.local.set({ [VIEW_KEY]: { ...data, url: state.liveUrl, at: Date.now(), lang } as ViewData })
  window.open('../reading/reading.html', '_blank', 'noopener')
}
