import { FR_PANEL } from './i18n-fr-panel'
import { FR_LIB } from './i18n-fr-lib'
import { FR_UX } from './i18n-fr-ux'

/** French texts, keyed by the English text used in the code. */
export const FR: Record<string, string> = {
  ...FR_LIB,
  ...FR_PANEL,
  ...FR_UX,
  // audit bar and audits screen are in i18n-fr-panel.ts
}
