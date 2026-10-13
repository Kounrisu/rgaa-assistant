import { reviewActions } from './review-controls'
import { previewBackgroundControl } from './preview-bg'
import { previewOf } from '../lib/url-safety'
/**
 * The Images theme: the list with its filters, the detail of an image, the kind and criteria cards.
 */
import { dom, h, keepScroll, tNodes, $ } from './dom'
import type { Filter, Item } from './types'
import { state } from './state'
import { matches, visibleElements, altLabel, statusOf, reviewKey, STATUS_LABEL, reviewOf } from './review-state'
import { t } from '../lib/i18n'
import { DETECTED_LABEL, detectedOf, suggestedKind, criteriaFor, type Criterion, hintFor, criterionUrl } from '../lib/rgaa'
import { syncFilterBoxes, focusOnPage } from './page-bridge'
import { labelOf, fileName } from './helpers'
import { codeBlock } from './code-view'
import { saveReviews } from './model'
import type { ImageReview, ImageKind, Verdict } from '../lib/types'
import { testIdFor } from '../lib/results'
import { actions } from './actions'

export function renderFilters(): void {
  dom.filtersEl.replaceChildren()
  const count = (d: Filter) => state.elements.filter((e) => matches(e, d)).length
  /** English labels: translated where the chips are drawn. */
  const chips: [Filter, string][] = [
    ['all', 'All'],
    ['review', 'To review'],
    ['ignored', 'Ignored'],
    ['named', 'With alternative'],
    ['unnamed', 'No alternative'],
    ['prefilled', 'Pre-filled'],
    ['dialog', 'In a popin'],
    ['gone', 'Not on page now'],
  ]
  for (const [value, label] of chips) {
    if ((value === 'dialog' || value === 'gone' || value === 'prefilled') && count(value) === 0) continue
    dom.filtersEl.append(
      h(
        'button',
        {
          type: 'button',
          class: `chip ${value}`,
          'aria-pressed': String(state.filter === value),
          title: value === 'all' ? t('Every image found so far') : value === 'review' ? t('Images with no type chosen or a criterion still unanswered') : value === 'dialog' ? t('Inside a dialog / popin') : value === 'gone' ? t('Seen in an earlier scan but no longer on the page') : value === 'prefilled' ? t('Answer pre-filled from the markup, still to confirm') : t(DETECTED_LABEL[value]),
          onclick: () => {
            state.filter = value
            renderFilters()
            renderList()
            void syncFilterBoxes()
          },
        },
        `${t(label)} `,
        h('span', { class: 'count' }, String(count(value))),
      ),
    )
  }
}

export function renderList(): void {
  dom.listEl.replaceChildren()
  const shown = visibleElements()
  // one stop for the Tab key in the whole list (the selected image, else the first); the arrows move inside it
  const tabStop = shown.some((e) => e.id === state.selectedId) ? state.selectedId : shown[0]?.id
  for (const el of shown) {
    const alt = altLabel(el)
    const status = statusOf(el)
    const detected = detectedOf(el)
    const btn = h(
      'button',
      {
        type: 'button',
        class: `item${el.present ? '' : ' absent'}`,
        'data-id': el.id,
        'data-detected': detected,
        'data-status': status,
        'aria-current': el.id === state.selectedId ? 'true' : 'false',
        tabindex: el.id === tabStop ? '0' : '-1',
        onclick: () => select(el.id, true),
      },
      previewOf(el)
        ? h('img', { class: 'thumb', src: previewOf(el)!, alt: '', loading: 'lazy' })
        : h('span', { class: 'thumb placeholder', 'aria-hidden': 'true' }, el.tag),
      h(
        'span',
        { class: 'main' },
        h(
          'span',
          { class: 'num' },
          `#${el.id}`,
          h('span', { class: 'type' }, el.type),
          detected === 'unnamed' ? h('span', { class: 'type error' }, el.alt === null && el.tag === 'img' ? t('no alt') : t('no name')) : null,
          el.inDialog ? h('span', { class: 'type popin' }, t('popin')) : null,
          h('span', { class: 'type auto-tag', hidden: !state.reviews[reviewKey(el)]?.auto, title: t('Pre-filled from the markup — confirm it') }, t('pre-filled')),
          !el.present ? h('span', { class: 'type gone' }, t('not on page')) : null,
          el.scan > 1 && el.present ? h('span', { class: 'type new' }, t('scan {n}', { n: el.scan })) : null,
        ),
        h('span', { class: `alt ${detected}${alt.missing ? ' missing' : ''}`, title: labelOf(el) }, alt.text),
      ),
      h('span', { class: `dot ${status}`, role: 'img', 'aria-label': t(STATUS_LABEL[status]), title: t(STATUS_LABEL[status]) }),
    )
    dom.listEl.append(h('li', {}, btn))
  }
  if (!dom.listEl.children.length) dom.listEl.append(h('li', { class: 'hint-line' }, t('No image in this category.')))
}

export function refreshListState(): void {
  for (const btn of dom.listEl.querySelectorAll<HTMLButtonElement>('.item')) {
    const el = state.elements.find((e) => e.id === Number(btn.dataset.id))
    if (!el) continue
    btn.setAttribute('aria-current', el.id === state.selectedId ? 'true' : 'false')
    btn.tabIndex = el.id === state.selectedId ? 0 : -1
    btn.dataset.status = statusOf(el)
    const dot = btn.querySelector('.dot') as HTMLElement
    const status = statusOf(el)
    dot.className = `dot ${status}`
    btn.querySelector<HTMLElement>('.auto-tag')!.hidden = !state.reviews[reviewKey(el)]?.auto
    dot.setAttribute('aria-label', t(STATUS_LABEL[status]))
    dot.title = t(STATUS_LABEL[status])
  }
}

export function fact(label: string, value: string | null, opts: { missingIfNull?: boolean; emptyHint?: boolean } = {}): Node[] {
  let dd: HTMLElement
  if (value === null) dd = h('dd', { class: opts.missingIfNull ? 'missing' : '' }, opts.missingIfNull ? t('attribute missing') : '—')
  else if (value === '') dd = h('dd', { class: opts.emptyHint ? 'empty-val' : '' }, t('"" (empty)'))
  else dd = h('dd', {}, value)
  return [h('dt', {}, label), dd]
}

export function renderDetail(): void {
  keepScroll(dom.detailEl, renderDetailNow)
}

export function renderDetailNow(): void {
  const scrollTop = dom.detailEl.scrollTop
  const colScroll = [...dom.detailEl.querySelectorAll('.col')].map((c) => c.scrollTop)
  const el = state.elements.find((e) => e.id === state.selectedId)
  dom.detailEl.replaceChildren()
  if (!el) return
  const review = reviewOf(el)
  const index = state.elements.indexOf(el)

  const goto = (delta: number) => select(state.elements[index + delta].id, true)
  dom.detailEl.append(
    h(
      'div',
      { class: 'detail-head' },
      h(
        'h2',
        {},
        previewOf(el) ? h('img', { class: 'compact-preview', src: previewOf(el)!, alt: t('Preview of image {id}', { id: el.id }) }) : null,
        `${t('Image #{id}', { id: el.id })} `,
        h('span', { class: `result ${statusOf(el)}`, id: 'result-badge' }, t(STATUS_LABEL[statusOf(el)])),
        h('span', { class: 'hint-line' }, `  ${t('image {n} of {total}', { n: index + 1, total: state.elements.length })}`),
        h('span', { class: 'hint-line criteria-progress', id: 'criteria-progress' }, criteriaProgressText(el)),
      ),
      h(
        'div',
        { class: 'nav' },
        h('button', { type: 'button', onclick: () => focusOnPage(el.id, true) }, t('Locate on page')),
        h('button', { type: 'button', disabled: index === 0, onclick: () => goto(-1) }, t('← Prev')),
        h('button', { type: 'button', disabled: index === state.elements.length - 1, onclick: () => goto(1) }, t('Next →')),
      ),
    ),
  )

  const detected = detectedOf(el)
  const facts = h('dl', { class: 'facts' })
  facts.append(
    ...fact(t('Type'), el.type),
    ...fact(
      t('Where'),
      [el.inDialog ? t('In a dialog / popin') : t('In the page'), t('first seen in scan {n}', { n: el.scan }), ...(el.present ? [] : [t('not on the page now')])].join(' · '),
    ),
    ...fact(t('Detected'), `${t(DETECTED_LABEL[detected])}${el.ignoredBy ? ` — ${el.ignoredBy}` : ''}`),
    ...fact(t('Accessible name'), el.accessibleName),
    ...(el.tag === 'img' || el.tag === 'input' || el.tag === 'area' ? fact('alt', el.alt, { missingIfNull: true, emptyHint: true }) : []),
    ...fact('aria-label', el.ariaLabel),
    ...fact('aria-labelledby', el.labelledByText),
    ...fact('title', el.title),
    ...(el.tag === 'svg' ? fact('<title>', el.svgTitle) : []),
    ...fact('role', el.role),
    ...fact('aria-hidden', el.ariaHidden ? t('true (self or parent)') : null),
    ...fact(t('In a link'), el.isInsideLink ? `${el.linkHref ?? ''}${el.linkText ? ` — “${el.linkText}”` : ''}` : null),
    ...fact(t('Caption'), el.figcaption),
    ...fact(t('Size'), el.naturalWidth ? `${el.naturalWidth} × ${el.naturalHeight}px` : null),
    ...fact(t('File'), el.src && !el.src.startsWith('data:') ? fileName(el.src) : null),
  )
  const cols = h('div', { class: 'cols' })
  const evidence = h('div', { class: 'col evidence' })
  const decision = h('div', { class: 'col decision' })
  cols.append(evidence, decision)
  evidence.append(
    h(
      'div',
      { class: 'card preview' },
      h('div', { class: 'preview-img' }, previewOf(el) ? h('img', { src: previewOf(el)!, alt: t('Preview of image {id}', { id: el.id }) }) : h('span', { class: 'hint-line' }, t('No preview for <{type}>', { type: el.type }))),
      ...(previewOf(el) ? [previewBackgroundControl()] : []),
      facts,
    ),
  )

  evidence.append(
    codeBlock(t('Image code'), el.html),
    codeBlock(t('Context (parent markup)'), el.contextHtml, t('Yellow line = the image. Orange attributes are the ones assistive technologies read.')),
  )

  const banner = problemBanner(el, review)
  if (banner) decision.append(banner)
  decision.append(renderKindPicker(el, review))
  const criteriaHost = h('div', { id: 'criteria' })
  decision.append(criteriaHost)
  renderCriteria(el, review, criteriaHost)

  decision.append(
    h(
      'div',
      { class: 'card' },
      h('h3', {}, t('Notes')),
      h('textarea', {
        'aria-label': t('Notes for image {id}', { id: el.id }),
        placeholder: t('Why non-compliant, suggested alt text…'),
        value: review.note,
        oninput: (event: Event) => {
          review.note = (event.target as HTMLTextAreaElement).value
          saveReviews()
        },
      }),
    ),
  )
  dom.detailEl.append(cols)
  dom.detailEl.scrollTop = scrollTop
  dom.detailEl.querySelectorAll('.col').forEach((c, i) => (c.scrollTop = colScroll[i] ?? 0))
}

/** Shown on images that are neither hidden nor named: the failure depends on what the image is. */
export function problemBanner(el: Item, review: ImageReview): HTMLElement | null {
  if (detectedOf(el) !== 'unnamed') return null
  const missingAlt = el.alt === null && ['img', 'input', 'area'].includes(el.tag)
  const t11 = testIdFor('1.1', el)
  const t12 = testIdFor('1.2', el)
  const apply = (kind: ImageKind, criterion: string, note: string) => () => {
    review.kind = kind
    review.auto = false
    review.answers[criterion] = 'nc'
    if (!review.note.trim()) review.note = note
    saveReviews()
    refreshAll()
    renderDetail()
  }
  return h(
    'div',
    { class: 'card problem', role: 'alert' },
    h('h3', {}, missingAlt ? t('Error: no alt attribute') : t('Error: no accessible name on this <{type}>', { type: el.type })),
    h(
      'p',
      {},
      missingAlt
        ? t('This image has no alt attribute and no other name, and it is not hidden from assistive tech. Screen readers may read the file name. alt is also required by HTML (code validity, RGAA 8.2).')
        : t('This image has no accessible name and is not hidden from assistive tech.'),
    ),
    h(
      'p',
      { class: 'which' },
      ...tNodes('Which criterion fails depends on the image: {informative} if it is informative, {decorative} if it is decorative.', {
        informative: h('strong', {}, `1.1${t11 ? ` ${t('(test {id})', { id: t11 })}` : ''}`),
        decorative: h('strong', {}, `1.2${t12 ? ` ${t('(test {id})', { id: t12 })}` : ''}`),
      }),
    ),
    h(
      'div',
      { class: 'problem-actions' },
      h('button', { type: 'button', onclick: apply('informative', '1.1', missingAlt ? t('Missing alt attribute: add a text alternative that conveys the information.') : t('No accessible name: add a text alternative.')) }, t('It is informative → 1.1 Non-compliant')),
      h('button', { type: 'button', onclick: apply('decorative', '1.2', missingAlt ? t('Missing alt attribute: add alt="" (or aria-hidden) so assistive tech ignores this decorative image.') : t('Not hidden from assistive tech: add aria-hidden="true".')) }, t('It is decorative → 1.2 Non-compliant')),
    ),
  )
}

export function renderKindPicker(el: Item, review: ImageReview): HTMLElement {
  const name = `kind-${el.id}`
  const option = (value: ImageKind, label: string) => [
    h('input', {
      type: 'radio',
      name,
      id: `${name}-${value}`,
      value,
      checked: review.kind === value,
      onclick: () => {
        review.kind = value
        review.auto = false
        saveReviews()
        const host = $('criteria')
        renderCriteria(el, review, host)
        refreshAll()
      },
    }),
    h('label', { for: `${name}-${value}` }, label),
  ]
  return h(
    'div',
    { class: 'card' },
    h(
      'fieldset',
      {},
      h('legend', {}, h('h3', {}, t('What is this image?'))),
      h('div', { class: 'segmented' }, ...option('informative', t('Informative')), ...option('decorative', t('Decorative'))),
      suggestedKind(el)
        ? h('p', { class: 'hint-line' }, t('Suggestion from the markup: {kind} ({detected}).', { kind: suggestedKind(el) === 'informative' ? t('informative') : t('decorative'), detected: t(DETECTED_LABEL[detectedOf(el)]).toLowerCase() }))
        : h('p', { class: 'hint-line warn' }, t('No text alternative and not hidden: decide whether it is informative (→ missing alternative) or decorative (→ not ignored).')),
      h(
        'p',
        { class: 'hint-line' },
        t('Informative: carries content or a function (logo, photo that illustrates, icon in a button…). Decorative: pure ornament that adds nothing.'),
      ),
    ),
    reviewActions(`image:${el.key}:kind`, () => focusOnPage(el.id, true)),
  )
}

export function renderCriteria(el: Item, review: ImageReview, host: HTMLElement): void {
  host.replaceChildren()
  const applicable = criteriaFor(review.kind)
  if (!applicable.length) {
    host.append(h('p', { class: 'hint-line' }, t('Choose informative or decorative to see the RGAA criteria that apply.')))
    return
  }
  for (const criterion of applicable) host.append(criterionCard(el, review, criterion))
}

export function criterionCard(el: Item, review: ImageReview, criterion: Criterion): HTMLElement {
  const hint = hintFor(criterion.id, el)
  const group = `crit-${el.id}-${criterion.id}`
  const card = h('div', { class: 'card criterion', 'data-state': review.answers[criterion.id] ?? '' })

  const verdict = (value: Verdict, label: string) => [
    h('input', {
      type: 'radio',
      name: group,
      id: `${group}-${value}`,
      value,
      checked: review.answers[criterion.id] === value,
      onclick: () => {
        review.answers[criterion.id] = value
        review.auto = false
        card.dataset.state = value
        card.querySelector('.prefill-note')?.remove()
        saveReviews()
        refreshAll()
      },
    }),
    h('label', { for: `${group}-${value}` }, label),
  ]

  card.append(
    h(
      'div',
      { class: 'criterion-head' },
      h('span', { class: 'crit-id' }, `RGAA ${criterion.id}`),
      h('span', { class: 'level', title: t('WCAG level {level}', { level: criterion.level }) }, t('Level {level}', { level: criterion.level })),
      h('a', { class: 'crit-link', href: criterionUrl(criterion.id), target: '_blank', rel: 'noreferrer' }, t('Official tests ↗')),
    ),
    h('p', { class: 'question' }, t(criterion.question)),
    h('p', { class: 'official' }, criterion.title),
    h('ul', { class: 'checks' }, ...criterion.checks.map((c) => h('li', {}, t(c)))),
    ...(hint ? [h('p', { class: `hint ${hint.tone}` }, hint.text)] : []),
    ...(review.auto ? [h('p', { class: 'hint info prefill-note' }, t('Pre-filled from the markup (alt="", aria-hidden or role="presentation"). Click Compliant to confirm the image really is decorative, or change the answer if the developer made a mistake.'))] : []),
    h(
      'fieldset',
      {},
      h('legend', { class: 'hint-line' }, t('Verdict for criterion {id}', { id: criterion.id })),
      h('div', { class: 'verdicts' }, ...verdict('c', t('Compliant')), ...verdict('nc', t('Non-compliant')), ...verdict('na', t('Not applicable'))),
    ),
  )
  card.append(reviewActions(`image:${el.key}:${criterion.id}`, () => focusOnPage(el.id, true)))
  return card
}

/** “3/7 criteria of this image answered · next: 1.3”: what is left for this image, visible without scrolling to the cards. Empty before the type is chosen. */
export function criteriaProgressText(el: Item): string {
  const review = state.reviews[reviewKey(el)]
  if (!review?.kind) return ''
  const list = criteriaFor(review.kind)
  const open = list.find((c) => review.answers[c.id] === undefined)
  const done = list.length - list.filter((c) => review.answers[c.id] === undefined).length
  const text = open ? t('{done}/{total} criteria of this image answered · next: {id}', { done, total: list.length, id: open.id }) : t('{done}/{total} criteria of this image answered', { done, total: list.length })
  return review.auto && done ? `${text} · ${t('pre-filled, confirm it')}` : text
}

export function refreshAll(): void {
  const badge = document.getElementById('result-badge')
  const current = state.elements.find((e) => e.id === state.selectedId)
  if (badge && current) {
    badge.className = `result ${statusOf(current)}`
    badge.textContent = t(STATUS_LABEL[statusOf(current)])
  }
  const progress = document.getElementById('criteria-progress')
  if (progress && current) progress.textContent = criteriaProgressText(current)
  actions.renderStats()
  refreshListState()
  renderFilters()
}

export function select(id: number, scroll: boolean): void {
  state.selectedId = id
  if (state.filter !== 'all' && !visibleElements().some((e) => e.id === id)) {
    state.filter = 'all'
    renderFilters()
    renderList()
  }
  refreshListState()
  renderDetail()
  focusOnPage(id, scroll)
}

/**
 * Keyboard in the list of images: Tab enters the list once (on the selected image) and leaves it with the next Tab; the arrows
 * (and Home / End / Page Up / Page Down) move to the previous or next image of the shown list, select it and show it on the page.
 */
export function listKeyDown(event: KeyboardEvent): void {
  const keys: Record<string, (i: number, n: number) => number> = {
    ArrowDown: (i) => i + 1,
    ArrowUp: (i) => i - 1,
    PageDown: (i) => i + 5,
    PageUp: (i) => i - 5,
    Home: () => 0,
    End: (_i, n) => n - 1,
  }
  const move = keys[event.key]
  if (!move || event.altKey || event.ctrlKey || event.metaKey) return
  const shown = visibleElements()
  if (!shown.length) return
  event.preventDefault()
  const current = shown.findIndex((e) => e.id === state.selectedId)
  const target = shown[Math.min(shown.length - 1, Math.max(0, move(current < 0 ? 0 : current, shown.length)))]
  select(target.id, true)
  dom.listEl.querySelector<HTMLElement>(`.item[data-id="${target.id}"]`)?.focus()
}
