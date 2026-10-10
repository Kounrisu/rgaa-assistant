import { themeByNumber } from './themes'
import type { ChecklistVerdict } from './types'

/**
 * Our own RGAA checks, written from the official test wording: what the page script detects (inject.ts) and what each
 * detection means for the RGAA criteria. The script only sends back `key`, a count and samples; the wording is here.
 */
export interface RuleMeta {
  /** Criteria the finding is about. */
  criteria: string[]
  /** 'nc' = fails (to confirm), 'na' = the criterion does not apply on this page, null = a note only. */
  status: ChecklistVerdict | null
  /** English wording (the key of the French dictionary); {n}, {detail} and {samples} are filled in. */
  text: string
}

const theme = (n: number, except: string[] = []): string[] => (themeByNumber(n)?.criteria ?? []).map((c) => c.id).filter((id) => !except.includes(id))

export const RULES: Record<string, RuleMeta> = {
  doctype: { criteria: ['8.1'], status: 'nc', text: 'The document type is missing or not valid: the page is displayed in quirks mode ({detail}).' },
  'presentation-tags': { criteria: ['10.1'], status: 'nc', text: '{n} tag(s) used for presentation only: {detail}. Examples: {samples}' },
  'presentation-attrs': { criteria: ['10.1'], status: 'nc', text: '{n} element(s) with presentation attributes ({detail}). Examples: {samples}' },
  'dir-invalid': { criteria: ['8.10'], status: 'nc', text: '{n} element(s) with an invalid dir attribute. Examples: {samples}' },
  'target-blank': { criteria: ['13.2'], status: 'nc', text: '{n} link(s) open a new window without saying so. Examples: {samples}' },
  autocomplete: { criteria: ['11.13'], status: 'nc', text: '{n} field(s) about the user have no autocomplete attribute. Examples: {samples}' },
  downloads: { criteria: ['13.3', '13.4'], status: null, text: '{n} link(s) to office documents ({detail}): check that each one is accessible or has an accessible version. Examples: {samples}' },
  'media-found': { criteria: theme(4), status: null, text: '{n} video, audio or embedded media found ({detail}): check them against the criteria of this theme.' },
  'no-media': { criteria: theme(4), status: 'na', text: 'No video, audio or embedded media on the page.' },
  'no-table': { criteria: theme(5), status: 'na', text: 'No table on the page.' },
  'table-no-th': { criteria: ['5.6'], status: null, text: '{n} data table(s) without header cells (th): check that headers are declared. Examples: {samples}' },
  'no-form': { criteria: theme(11, ['11.9']), status: 'na', text: 'No form field on the page.' },
  'no-button': { criteria: ['11.9'], status: 'na', text: 'No button on the page.' },
  'no-link': { criteria: theme(6), status: 'na', text: 'No link on the page.' },
  'generic-title': { criteria: ['8.6'], status: null, text: 'The page title looks generic or empty ({detail}): check that it is relevant.' },
}

/** What the page script sends back for one rule. */
export interface RuleFinding {
  key: string
  count: number
  detail?: string
  samples?: string[]
}
