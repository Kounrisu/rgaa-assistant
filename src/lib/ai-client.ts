import { RGAA_THEME1_PROMPT_HEADER } from './prompt-template'
import type { ImageElementInfo } from './types'

/**
 * v0.1: no API call yet. This just assembles the exact text you'd paste into
 * a chat UI (screenshot first, then this text) — see README for the manual
 * testing flow. A real call (Anthropic/OpenAI) gets wired in behind this
 * same function once the manual flow is validated.
 */
export function buildTheme1Prompt(elements: ImageElementInfo[]): string {
  return RGAA_THEME1_PROMPT_HEADER + JSON.stringify(elements, null, 2)
}

export async function copyTheme1PromptToClipboard(
  elements: ImageElementInfo[],
): Promise<void> {
  await navigator.clipboard.writeText(buildTheme1Prompt(elements))
}
