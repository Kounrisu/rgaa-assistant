import type { ImageReview, Verdict } from './types'

/** Legacy reviews use auto for all answers; new reviews track each suggestion separately. */
export function isSuggested(review: ImageReview | undefined, criterion: string): boolean {
  return Boolean(review?.auto && review.answers[criterion] !== undefined &&
    (review.pendingAnswers === undefined || review.pendingAnswers.includes(criterion)))
}

export function confirmAnswer(review: ImageReview, criterion: string): void {
  review.pendingAnswers = Object.keys(review.answers).filter(id => id !== criterion && isSuggested(review, id))
  review.auto = review.pendingAnswers.length > 0
}

/** Only for the explicit bulk action whose dialog discloses all the affected answers. */
export function confirmAllAnswers(review: ImageReview): void {
  review.pendingAnswers = []
  review.auto = false
}

export function suggestAnswer(review: ImageReview, criterion: string, verdict: Verdict): void {
  const pending = Object.keys(review.answers).filter(id => isSuggested(review, id))
  review.answers[criterion] = verdict
  review.pendingAnswers = [...new Set([...pending, criterion])]
  review.auto = true
}
