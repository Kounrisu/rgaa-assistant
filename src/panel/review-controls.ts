import { h } from './dom'
import { t } from '../lib/i18n'
import { actions } from './actions'

export function reviewContinue(key: string): HTMLButtonElement {
  return h('button', { type: 'button', class: 'review-continue', 'data-review-after': key, onclick: () => void actions.nextReview(key) }, t('Next to evaluate'))
}
