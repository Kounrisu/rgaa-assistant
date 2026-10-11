import { h } from './dom'
import { t } from '../lib/i18n'
import { actions } from './actions'

export function reviewContinue(key: string): HTMLButtonElement {
  return h('button', { type: 'button', class: 'review-continue', 'data-review-after': key, onclick: () => void actions.nextReview(key) }, t('Next to evaluate'))
}

/**
 * The buttons under an element-level criterion card: “Locate on page” (same effect as clicking the element in the list:
 * its box takes the focus outline and the page scrolls to it) first, then “Next to evaluate”.
 */
export function reviewActions(key: string, locate: () => unknown): HTMLElement {
  return h(
    'div',
    { class: 'review-actions' },
    h('button', { type: 'button', class: 'review-locate', onclick: () => void locate() }, t('Locate on page')),
    reviewContinue(key),
  )
}
