/** A jump moves keyboard focus as well as the viewport: the card is scrolled to the middle, its answer (or first choice) takes the focus and the card flashes. */
export function focusReviewTarget(target: HTMLElement): void {
  const input = target.querySelector<HTMLElement>('input[type="radio"]:checked') ?? target.querySelector<HTMLElement>('input[type="radio"]')
  if (!input) target.tabIndex = -1
  ;(input ?? target).focus({ preventScroll: true })
  target.scrollIntoView({ block: 'center' })
  target.classList.add('flash')
  setTimeout(() => target.classList.remove('flash'), 1800)
}
