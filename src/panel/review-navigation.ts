import { reviewQueue, nextReviewTarget } from '../lib/review-queue'
import { state } from './state'
import { actions } from './actions'
import { dom, say } from './dom'
import { t } from '../lib/i18n'
import { select } from './images-view'
import { focusFinding } from './page-bridge'

/** Explicit save-and-continue. A failed save keeps the auditor on their answer. */
export async function nextReview(after?: string): Promise<void> {
  const page = state.page
  if (!page || !(await state.session.saveNow()) || state.page !== page) return
  const queue = reviewQueue(page, state.audit.meta.level)
  const focused = document.activeElement instanceof HTMLInputElement ? document.activeElement.name : ''
  const current = queue.filter((x) => x.theme === state.theme && (x.kind === 'image' ? x.itemId === state.selectedId : x.kind === 'finding' ? x.itemId === state.findingSel : false))
  const remembered = state.reviewCursor?.page === page.id ? queue.find((x) => x.key === state.reviewCursor?.key) : undefined
  const samePosition = remembered?.theme === state.theme && (remembered.kind === 'criterion' || current.includes(remembered))
  const cursor = after ?? queue.find((x) => x.group === focused)?.key ??
    (samePosition ? remembered?.key : current.at(-1)?.key)
  const target = nextReviewTarget(queue, cursor)
  if (!target) return void say(t('No unanswered decision in the current review queue. Check unscanned themes and manual activities before finishing the audit.'))
  state.reviewCursor = { page: page.id, key: target.key }
  state.theme = target.theme
  state.filter = 'all'
  state.findingFilter = 'all'
  if (target.kind === 'finding') state.findingSel = target.itemId!
  if (target.kind === 'image') state.selectedId = target.itemId!
  actions.setView('review')
  actions.renderAll()
  if (target.kind === 'image') select(target.itemId!, true)
  if (target.kind === 'finding') {
    const f = page.findings.find((x) => x.theme === target.theme && x.id === target.itemId)
    if (f) void focusFinding(f, true)
  }
  const host = target.kind === 'image' ? dom.detailEl : dom.themeEl
  const input = host.querySelector<HTMLInputElement>(`input[name="${target.group}"]`)
  input?.closest('.card')?.scrollIntoView({ block: 'center' })
  input?.focus({ preventScroll: true })
}
