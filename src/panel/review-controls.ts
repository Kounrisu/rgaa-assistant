import { h } from './dom'
import { t } from '../lib/i18n'
import { actions } from './actions'
import { state } from './state'
import { reviewQueue, nextReviewTarget } from '../lib/review-queue'

export function reviewContinue(key: string): HTMLButtonElement {
  const target = state.page && nextReviewTarget(reviewQueue(state.page, state.audit.meta.level), key)
  const destination = target ? `${target.kind === 'image' ? t('Image #{id}', { id: target.itemId! }) : target.kind === 'finding' ? t('Element #{id}', { id: target.itemId! }) : ''} · ${target.group.startsWith('kind-') ? t('Image type') : `RGAA ${target.key.split(':').at(-1)}`}`.replace(/^ · /, '') : t('Review remaining manual work')
  return h('button', { type: 'button', class: 'review-continue', 'data-review-after': key, onclick: () => void actions.nextReview(key) }, t('Next: {target}', { target: destination }))
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
