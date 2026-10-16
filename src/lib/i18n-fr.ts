import { FR_WORKFLOW } from './i18n-fr-workflow'
import { FR_PANEL } from './i18n-fr-panel'
import { FR_LIB } from './i18n-fr-lib'
import { FR_UX } from './i18n-fr-ux'
import { FR_EVIDENCE } from './i18n-fr-evidence'
import { FR_PERSIST } from './i18n-fr-persist'
import { FR_SCAN } from './i18n-fr-scan'
import { FR_APG } from './i18n-fr-apg'
import { FR_MANUAL } from './i18n-fr-manual'
import { FR_STYLES } from './i18n-fr-styles'
import { FR_TODO } from './i18n-fr-todo'
import { FR_PACK } from './i18n-fr-pack'

/** French texts, keyed by the English text used in the code. */
export const FR: Record<string, string> = {
  ...FR_WORKFLOW,
  ...FR_LIB,
  ...FR_PANEL,
  ...FR_UX,
  ...FR_EVIDENCE,
  ...FR_PERSIST,
  ...FR_SCAN,
  ...FR_APG,
  ...FR_MANUAL,
  ...FR_STYLES,
  ...FR_TODO,
  ...FR_PACK,
  // audit bar and audits screen are in i18n-fr-panel.ts
}
