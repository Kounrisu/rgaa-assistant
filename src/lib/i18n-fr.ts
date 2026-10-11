import { FR_PANEL } from './i18n-fr-panel'
import { FR_LIB } from './i18n-fr-lib'
import { FR_UX } from './i18n-fr-ux'
import { FR_EVIDENCE } from './i18n-fr-evidence'
import { FR_PERSIST } from './i18n-fr-persist'
import { FR_SCAN } from './i18n-fr-scan'
import { FR_APG } from './i18n-fr-apg'

/** French texts, keyed by the English text used in the code. */
export const FR: Record<string, string> = {
  ...FR_LIB,
  ...FR_PANEL,
  ...FR_UX,
  ...FR_EVIDENCE,
  ...FR_PERSIST,
  ...FR_SCAN,
  ...FR_APG,
  // audit bar and audits screen are in i18n-fr-panel.ts
}
