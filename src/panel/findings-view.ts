import { confirmAnswer, isSuggested } from '../lib/review-confirmation'
import { reviewActions } from './review-controls'
/**
 * The themes reviewed finding by finding (Frames, Colours, Tables, Links, Structure, Forms): list, filters, detail and criteria cards.
 */
import type { FindingItem, ImageReview, Verdict } from '../lib/types'
import { state } from './state'
import { persist, pageLabel, pageInput } from './model'
import { say, dom, keepScroll, h, newTabNote } from './dom'
import { t } from '../lib/i18n'
import { listedFindings, findingMatches, findingStatus, findingFails, STATUS_LABEL, findingReview } from './review-state'
import type { FindingFilter } from './types'
import { FINDING_THEMES, themeByNumber } from '../lib/themes'
import { renderChecklist } from './checklist-view'
import { tDyn } from './helpers'
import { syncFilterBoxes, focusFinding } from './page-bridge'
import { inActiveLevel } from '../lib/audit-levels'
import { findingCriteriaOf, type FindingCriterion, hintForFinding } from '../lib/findings'
import { contrastChecker } from './contrast-checker'
import { codeBlock } from './code-view'
import { actions } from './actions'
import { apgBlocks } from './apg-view'
import type { CriterionResult } from '../lib/results'
import { focusReviewTarget } from './focus-target'
import { apgPattern } from '../lib/apg-patterns'

export function removeFinding(f: FindingItem): void {
  const rec = state.page
  if (!rec) return
  rec.findings = rec.findings.filter((x) => x !== f)
  delete rec.findingReviews[f.key]
  state.findingSel = null
  persist()
  actions.renderAll()
  say(t('Finding #{id} removed from the audit.', { id: f.id }))
}

export function updateFindingChips(): void {
  if (!state.page) return
  const list = listedFindings(state.theme)
  for (const chip of dom.themeEl.querySelectorAll<HTMLElement>('.finding-pane .chip[data-value]')) {
    const value = chip.dataset.value as FindingFilter
    const count = chip.querySelector('.count')
    if (count) count.textContent = String(list.filter((f) => findingMatches(f, value)).length)
  }
}

export function renderThemeView(): void {
  keepScroll(dom.themeEl, () => {
    dom.themeEl.replaceChildren()
    if (!(themeByNumber(state.theme)?.criteria ?? []).some((c) => inActiveLevel(c.id))) dom.themeEl.append(h('p', { class: 'hint-line out-of-level-note' }, t('No criterion of this theme belongs to the chosen audit type. Change the type in Sample and progress to audit it.')))
    else if (FINDING_THEMES.has(state.theme)) renderFindingsView()
    else if (state.theme === 1) renderImagesRest()
    else renderChecklist()
    actions.renderSummaries()
  })
}

/** The end of the Images page: the questions no single image answers (1.4, 1.5), like the end of every other element theme. */
function renderImagesRest(): void {
  const rec = state.page
  if (!rec) return
  const result = pageInput(rec).themes.find((x) => x.number === 1)
  const partial = (result?.criteria ?? []).filter((c) => (c.coverage === 'partial' && !c.manualReview) || (rec.checklist[c.id]?.manualTests && c.tests.some((x) => x.outcome === 'unassessed')))
  if (partial.length) dom.themeEl.append(partialSection(partial))
  const rest = h('div', { class: 'theme-rest' })
  renderChecklist(rest)
  dom.themeEl.append(rest)
}

/**
 * Partly covered criteria: some tests of the criterion are not assessed by this tool (server-side image maps, a canvas fallback, whether an
 * alternative is concise…). Each card says which and what to look at; ticking “checked by hand” lifts the partial coverage of the criterion.
 */
function partialSection(criteria: CriterionResult[]): HTMLElement {
  const rec = state.page!
  const open = (c: CriterionResult) => !rec.checklist[c.id]?.manualTests
  const section = h('section', { class: 'partial-section' }, h('h3', {}, t('Partly covered criteria')), h('p', { class: 'hint-line' }, t('The verdict of these criteria counts, but only for the tests this tool can assess. Check the others by hand on the page, then tick the box: the criterion is then fully covered. If one of them fails, answer Non-compliant on the image concerned and say why in its note.')))
  for (const c of criteria) {
    const answer = (rec.checklist[c.id] ??= { note: '' })
    const missing = c.tests.filter((x) => x.outcome === 'unassessed')
    const card = h('div', { class: 'card criterion partial-card', id: `partial-card-${c.id}`, 'data-open': String(open(c)), 'data-state': answer.manualTests ? 'c' : '' })
    const next = () => {
      const cards = Array.from(dom.themeEl.querySelectorAll<HTMLElement>('.partial-card[data-open="true"]'))
      const target = cards[(cards.indexOf(card) + 1) % cards.length] ?? cards[0]
      if (target) focusReviewTarget(target)
    }
    card.append(
      h('div', { class: 'criterion-head' }, h('span', { class: 'crit-id' }, `RGAA ${c.id}`), h('span', { class: 'badge manual' }, t('Partial coverage')), h('a', { class: 'crit-link', href: `https://accessibilite.numerique.gouv.fr/methode/criteres-et-tests/#${c.id}`, target: '_blank', rel: 'noreferrer' }, t('Official tests ↗'), newTabNote())),
      h('p', { class: 'question' }, c.title.replace(/`/g, '')),
      h('p', { class: 'hint info' }, t('{n} of the {total} tests of this criterion are not assessed by this tool:', { n: missing.length, total: c.tests.length })),
      h('ul', { class: 'checks' }, ...missing.map((x) => h('li', {}, h('strong', {}, `${x.id} `), x.text.replace(/`/g, ''), h('em', {}, ` — ${x.reason}`)))),
      h(
        'label',
        { class: 'manual-tests' },
        h('input', {
          type: 'checkbox',
          checked: Boolean(answer.manualTests),
          onchange: (e: Event) => {
            answer.manualTests = (e.target as HTMLInputElement).checked
            persist()
            actions.renderAll()
            say(answer.manualTests ? t('RGAA {id}: the tests the tool does not assess are checked by hand.', { id: c.id }) : t('RGAA {id}: back to partial coverage.', { id: c.id }))
          },
        }),
        ` ${t('I checked these tests by hand')}`,
      ),
      ...(open(c) && criteria.filter(open).length > 1 ? [h('button', { type: 'button', class: 'ghost-btn', onclick: next }, t('Next partly covered criterion'))] : []),
    )
    section.append(card)
  }
  return section
}

export function renderFindingsView(): void {
  const def = themeByNumber(state.theme)
  if (!state.page || !def) return
  const rec = state.page
  const list = listedFindings(state.theme)
  const passing = rec.findings.find((f) => f.theme === 3 && f.type === 'contrast-ok')
  const scanned = rec.scannedThemes.includes(state.theme)
  const label = pageLabel(rec)
  dom.themeEl.append(
    h(
      'div',
      { class: 'results-head' },
      h(
        'div',
        {},
        h('p', { class: 'hint-line' }, state.theme === 2 ? t('Every iframe / frame of the page, with its title.') : state.theme === 6 ? t('Every link of the page (identical links are grouped), with its name and destination. Links with no name or a generic text are boxed on the page.') : state.theme === 5 ? t('Every table of the page: data tables (with their header cells and title) and layout tables. Click one to find it on the page.') : state.theme === 11 ? t('Every form field of the page, with the name a screen reader would give it. Fields with no label, or only a placeholder, are boxed on the page.') : state.theme === 9 ? t('The outline of the page, like a headings map: headings with their level, and the landmarks, in reading order. Click one to find it on the page; skipped levels and missing areas are flagged.') : state.theme === 7 ? t('Every interface component that follows (or should follow) a WAI-ARIA Authoring Practices pattern: tabs, dialogs, menus, disclosures, comboboxes, sliders, custom buttons… The script checks the structure; you try the keyboard. Closed dialogs and menus are listed: open them, then rescan.') : t('Only the texts that fail or that a script cannot judge are numbered and boxed on the page. Criteria 3.1 and 3.3 need your eyes (below).')),
      ),
    ),
  )
  if (!scanned) {
    dom.themeEl.append(h('p', { class: 'hint-line' }, t('Not scanned yet. Open {url} in the browser and find the elements.', { url: rec.url, label })))
  } else if (!list.length) {
    dom.themeEl.append(h('p', { class: 'hint warn' }, t('No relevant elements detected. Confirm applicability manually in the criterion cards below.')))
  } else {
    const options: [FindingFilter, string][] =
      state.theme === 3
        ? [['all', 'All'], ['review', 'To review'], ['contrast-fail', 'Fail'], ['contrast-unknown', 'Check by eye']]
        : state.theme === 6
          ? [['all', 'All'], ['review', 'To review'], ['link-empty', 'No name'], ['link-generic', 'Generic text'], ['link-skip', 'Skip links'], ['hidden', 'Hidden content']]
          : state.theme === 9
            ? [['all', 'All'], ['review', 'To review'], ['headings', 'Headings'], ['landmarks', 'Landmarks'], ['hidden', 'Hidden content']]
            : state.theme === 11
              ? [['all', 'All'], ['review', 'To review'], ['field-nolabel', 'No label'], ['field-placeholder', 'Placeholder only'], ['hidden', 'Hidden content']]
              : state.theme === 5
                ? [['all', 'All'], ['review', 'To review'], ['table-nohead', 'No header cell'], ['table-layout', 'Layout tables'], ['hidden', 'Hidden content']]
                : state.theme === 7
                  ? [['all', 'All'], ['review', 'To review'], ['widget-fail', 'Structure problem'], ['hidden', 'Hidden content']]
                  : [['all', 'All'], ['review', 'To review']]
    if (!options.some(([v]) => v === state.findingFilter)) state.findingFilter = 'all'
    const shown = list.filter((f) => findingMatches(f, state.findingFilter))
    if (!shown.some((f) => f.id === state.findingSel)) state.findingSel = shown[0]?.id ?? null
    const chips = h('div', { class: 'filters', role: 'group', 'aria-label': t('Filter findings') })
    for (const [value, text] of options) {
      const n = list.filter((f) => findingMatches(f, value)).length
      chips.append(
        h(
          'button',
          { type: 'button', class: 'chip', 'data-value': value, 'aria-pressed': String(state.findingFilter === value), onclick: () => { state.findingFilter = value; renderThemeView(); void syncFilterBoxes() } },
          `${t(text)} `,
          h('span', { class: 'count' }, String(n)),
        ),
      )
    }
    const tabStop = shown.some((x) => x.id === state.findingSel) ? state.findingSel : shown[0]?.id
    const listEl2 = h('ol', { class: 'finding-list', onkeydown: (event: KeyboardEvent) => findingListKeyDown(event, shown) })
    for (const f of shown) {
      const st = findingStatus(f)
      const bad = findingFails(f)
      listEl2.append(
        h(
          'li',
          {},
          h(
            'button',
            {
              type: 'button',
              class: `item finding${f.present ? '' : ' absent'}`,
              'data-fid': f.id,
              ...(f.data.group === 'heading' ? { style: `margin-left:${(Number(f.data.level) - 1) * 12}px` } : {}),
              'data-kind': f.type,
              'data-status': st,
              'aria-current': String(f.id === state.findingSel),
              tabindex: f.id === tabStop ? '0' : '-1',
              onclick: () => {
                state.findingSel = f.id
                renderThemeView()
                void focusFinding(f, true)
              },
            },
            f.shot ? h('img', { class: 'shot', src: f.shot, alt: '' }) : null,
            h('span', { class: 'num' }, `#${f.id}`),
            h('span', { class: 'main' }, h('span', { class: `alt${bad ? ' missing' : ''}` }, tDyn(f.label), f.data.humanNeeded ? h('span', { class: 'type error' }, t('check by eye')) : null, f.data.hidden === 'visually-hidden' ? h('span', { class: 'type popin', title: t('Visually hidden: read by screen readers only') }, t('hidden')) : f.data.hidden === 'aria-hidden' ? h('span', { class: 'type popin', title: t('Hidden from assistive technologies (aria-hidden)') }, 'aria-hidden') : null, f.type === 'link-skip' || f.type === 'link-skip-broken' ? h('span', { class: 'type new' }, t('skip link')) : null, f.type.startsWith('widget-') ? h('span', { class: 'type' }, t(apgPattern(f.type)?.name ?? f.type)) : null), h('span', { class: 'alt' }, tDyn(f.summary))),
            h('span', { class: `dot ${st === 'todo' ? '' : st}`, role: 'img', 'aria-label': t(STATUS_LABEL[st]), title: t(STATUS_LABEL[st]) }),
          ),
        ),
      )
    }
    const f = list.find((x) => x.id === state.findingSel)
    dom.themeEl.append(h('div', { class: 'finding-layout' }, h('nav', { class: 'finding-pane', 'aria-label': t('{name} findings', { name: def.name }) }, chips, ...(state.theme === 3 && passing ? [h('p', { class: 'hint-line' }, t('Not listed — {summary} pass.', { summary: tDyn(passing.summary) }))] : []), listEl2), f ? findingDetail(f) : h('p', { class: 'hint-line' }, t('Nothing in this category.'))))
  }
  if ((themeByNumber(state.theme)?.criteria ?? []).some((c) => inActiveLevel(c.id))) {
    const rest = h('div', { class: 'theme-rest' })
    renderChecklist(rest)
    dom.themeEl.append(rest)
  }
}

export function findingDetail(f: FindingItem): HTMLElement {
  const review = findingReview(f)
  const facts = h('dl', { class: 'facts' })
  for (const [k, v] of Object.entries(f.facts)) {
    facts.append(h('dt', {}, t(k)), h('dd', { class: v === null ? 'missing' : '' }, v === null ? '—' : tDyn(v)))
  }
  const cards = findingCriteriaOf(f).map((c) => findingCard(f, review, c))
  if (f.theme === 3 && f.type !== 'contrast-ok') cards.unshift(contrastChecker(f, review))
  const evidence = h(
    'div',
    { class: 'col evidence' },
    h(
      'div',
      { class: 'card' },
      h('h3', {}, `#${f.id} — ${tDyn(f.label)}`),
      ...(f.shot ? [h('img', { class: 'shot-large', src: f.shot, alt: t('Preview of finding {id}', { id: f.id }) })] : []),
      facts,
      ...(f.present
        ? []
        : [
            h('p', { class: 'hint warn' }, t('Not found at the last scan (hidden, removed or changed). It still counts in the audit until you remove it.')),
            h('button', { type: 'button', class: 'img-ref nc', onclick: () => removeFinding(f) }, t('Remove from the audit')),
          ]),
    ),
  )
  if (f.html) evidence.append(codeBlock(t('Markup'), f.html), codeBlock(t('Context (parent markup)'), f.contextHtml, t('Yellow line = the element.')))
  const decision = h(
    'div',
    { class: 'col decision' },
    ...cards,
    h('div', { class: 'card' }, h('h3', {}, t('Notes')), h('textarea', {
      id: `fnd-note-${f.id}`,
      'aria-label': t('Notes for finding {id}', { id: f.id }),
      placeholder: t('What to fix, where…'),
      value: review.note,
      oninput: (e: Event) => { review.note = (e.target as HTMLTextAreaElement).value; persist() },
    })),
  )
  return h('section', { class: 'finding-detail', 'aria-label': t('Finding {id}', { id: f.id }) }, h('div', { class: 'cols' }, evidence, decision))
}

export function findingCard(f: FindingItem, review: ImageReview, c: FindingCriterion): HTMLElement {
  const hint = hintForFinding(f, c.id)
  const group = `fnd-${f.id}-${c.id}`
  const card = h('div', { class: 'card criterion', 'data-state': review.answers[c.id] ?? '' })
  const verdict = (value: Verdict, text: string) => [
    h('input', {
      type: 'radio',
      name: group,
      id: `${group}-${value}`,
      value,
      checked: review.answers[c.id] === value,
      onclick: () => {
        review.answers[c.id] = value
        confirmAnswer(review, c.id)
        card.dataset.state = value
        card.querySelector('.prefill-note')?.remove()
        persist()
        actions.renderThemeBar()
        actions.renderStats()
        actions.renderPageBar()
        const dot = dom.themeEl.querySelector(`.item.finding[data-fid="${f.id}"] .dot`) as HTMLElement | null
        if (dot) dot.className = `dot ${findingStatus(f) === 'todo' ? '' : findingStatus(f)}`
        updateFindingChips()
      },
    }),
    h('label', { for: `${group}-${value}` }, text),
  ]
  card.append(
    h('div', { class: 'criterion-head' }, h('span', { class: 'crit-id' }, `RGAA ${c.id}`), h('span', { class: 'level' }, t('Level {level}', { level: c.level })), h('a', { class: 'crit-link', href: `https://accessibilite.numerique.gouv.fr/methode/criteres-et-tests/#${c.id}`, target: '_blank', rel: 'noreferrer' }, t('Official tests ↗'), newTabNote())),
    h('p', { class: 'question' }, t(c.question)),
    h('ul', { class: 'checks' }, ...c.checks.map((x) => h('li', {}, t(x)))),
    ...(hint ? [h('p', { class: `hint ${hint.tone}` }, hint.text)] : []),
    ...apgBlocks(f, c.id),
    ...(isSuggested(review, c.id) ? [h('p', { class: 'hint info prefill-note' }, t('Pre-filled from the page. Click your answer to confirm it, or change it.'))] : []),
    h('fieldset', {}, h('legend', { class: 'hint-line' }, t('Verdict for criterion {id}', { id: c.id })), h('div', { class: 'verdicts' }, ...verdict('c', t('Compliant')), ...verdict('nc', t('Non-compliant')), ...verdict('na', t('Not applicable')))),
  )
  card.append(reviewActions(`finding:${f.key}:${c.id}`, () => focusFinding(f, true)))
  return card
}

/** Arrow keys in a list of findings (like the list of images): select the previous or next one, show it on the page, keep the focus on it. */
function findingListKeyDown(event: KeyboardEvent, shown: FindingItem[]): void {
  const keys: Record<string, (i: number, n: number) => number> = { ArrowDown: (i) => i + 1, ArrowUp: (i) => i - 1, PageDown: (i) => i + 5, PageUp: (i) => i - 5, Home: () => 0, End: (_i, n) => n - 1 }
  const move = keys[event.key]
  if (!move || event.altKey || event.ctrlKey || event.metaKey || !shown.length) return
  event.preventDefault()
  const current = shown.findIndex((x) => x.id === state.findingSel)
  const target = shown[Math.min(shown.length - 1, Math.max(0, move(current < 0 ? 0 : current, shown.length)))]
  state.findingSel = target.id
  renderThemeView()
  dom.themeEl.querySelector<HTMLElement>(`.item.finding[data-fid="${target.id}"]`)?.focus()
  void focusFinding(target, true)
}
