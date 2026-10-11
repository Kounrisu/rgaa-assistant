import { runLabel } from './page-work'
/**
 * The Checks view: automatic checks, the page HTML card, scan coverage, the reports of each tool and the manual checks.
 */
import type { PageRecord } from '../lib/types'
import { MANUAL_CHECKS, MANUAL_GROUPS } from '../lib/manual-checks'
import { h, dom, keepScroll, download, say } from './dom'
import { t } from '../lib/i18n'
import { coverageLines } from '../lib/scan-coverage'
import { state } from './state'
import { pageInput, persist, pageLabel } from './model'
import { criterionUrl } from '../lib/rgaa'
import { captureAndCheckHtml, validateSnapshot } from './auto-checks'
import { dateTimeOf, slugOf, kb } from './helpers'
import { unpackSnapshot } from '../lib/snapshot'
import { actions } from './actions'
import { goToFirst } from './chrome'
import { VERDICT_WORD } from './checklist-view'
import { evidenceConflicts } from '../lib/evidence'

export function manualProgress(rec: PageRecord): { done: number; issues: number; total: number } {
  const answers = Object.values(rec.manualChecks ?? {})
  return { done: answers.length, issues: answers.filter((a) => a.state === 'issue').length, total: MANUAL_CHECKS.length }
}

/** What the scans did not look at, in plain words (frames, shadow roots, lists cut at a limit). */
export function coverageCard(cov: NonNullable<PageRecord['scanCoverage']>): HTMLElement {
  return h('div', { class: 'card' }, h('h3', {}, t('Scan coverage')), h('p', { class: 'hint-line' }, t('What the automatic scans did NOT look at. These parts need a manual check.')), h('ul', { class: 'checks' }, ...coverageLines(cov).map((x) => h('li', {}, x))))
}

/** Direct links to the decisions a run needs from the auditor, independent of tool history. */
function reviewQueue(rec: PageRecord): HTMLElement {
  const criteria = pageInput(rec).themes.filter((theme) => theme.selected).flatMap((theme) => theme.criteria)
  const suggestions = criteria.filter((c) => c.suggested || c.unconfirmed || evidenceConflicts(rec.checklist[c.id]).length)
  const pending = criteria.filter((c) => c.outcome === 'pending' || c.unconfirmed).length
  const jump = (id: string) => {
    state.theme = Number(id.split('.')[0])
    actions.setView('review')
    actions.renderThemeBar()
    const card = document.getElementById(`crit-card-${id}`)
    if (card) {
      card.scrollIntoView({ block: 'center' })
      card.querySelector<HTMLInputElement>('input[type="radio"]')?.focus({ preventScroll: true })
    } else goToFirst(state.theme, 'pending')
  }
  return h('section', { class: 'card review-queue', 'aria-label': t('Review automatic findings') },
    h('h3', {}, t('Review automatic findings')),
    h('p', {}, t('{n} criteria need your review. Automatic suggestions do not replace your decision.', { n: pending })),
    h('button', { type: 'button', class: 'primary', disabled: !pending, onclick: () => void actions.nextReview('') }, t('Review next unresolved item')),
    ...(suggestions.length ? [h('details', { class: 'queue-suggestions' }, h('summary', {}, t('Suggestions and conflicts ({n})', { n: suggestions.length })), h('ul', { class: 'review-queue-list' }, ...suggestions.map((c) => h('li', {},
      h('button', { type: 'button', 'data-review-criterion': c.id, onclick: () => jump(c.id) },
        `RGAA ${c.id} · ${evidenceConflicts(rec.checklist[c.id]).length ? t('Conflicting evidence') : t('Suggested: {verdict}', { verdict: t(VERDICT_WORD[c.suggested ?? (c.outcome === 'nc' ? 'nc' : c.outcome === 'na' ? 'na' : 'c')]) })}`),
      h('span', {}, c.title.replace(/`/g, '')),
    ))))] : []),
  )
}

export function renderChecks(): void {
  dom.checksEl.replaceChildren()
  if (!state.page) return
  const rec = state.page
  rec.manualChecks ??= {}
  const progress = manualProgress(rec)
  const body = h('div', { class: 'checks-body' })

  for (const group of MANUAL_GROUPS) {
    const card = h('div', { class: 'card' }, h('h3', {}, t(group)))
    for (const c of MANUAL_CHECKS.filter((x) => x.group === group)) {
      const answer = rec.manualChecks![c.id]
      const set = (state: 'todo' | 'ok' | 'issue') => {
        if (state === 'todo') delete rec.manualChecks![c.id]
        else rec.manualChecks![c.id] = { state, note: answer?.note ?? '' }
        persist()
        keepScroll(dom.checksEl, renderChecks)
      }
      const radio = (value: 'todo' | 'ok' | 'issue', label: string) => [
        h('input', { type: 'radio', name: `mc-${c.id}`, id: `mc-${c.id}-${value}`, checked: (answer?.state ?? 'todo') === value, onchange: () => { set(value); document.getElementById(`mc-${c.id}-${value}`)?.focus({ preventScroll: true }) } }),
        h('label', { for: `mc-${c.id}-${value}` }, label),
      ]
      card.append(
        h(
          'div',
          { class: 'check-row', 'data-state': answer?.state ?? '' },
          h('p', { class: 'question' }, t(c.text)),
          h('p', { class: 'hint-line' }, t('Feeds RGAA'), ' ', ...c.criteria.flatMap((id, i) => [i ? ', ' : '', h('a', { href: criterionUrl(id), target: '_blank', rel: 'noreferrer' }, id)])),
          h('div', { class: 'verdicts' }, ...radio('todo', t('To do')), ...radio('ok', t('Checked, OK')), ...radio('issue', t('Problem found'))),
          answer?.state === 'issue'
            ? h('textarea', {
                'aria-label': t('What is wrong, and where'),
                placeholder: t('What is wrong, and where'),
                value: answer.note,
                oninput: (e: Event) => { answer.note = (e.target as HTMLTextAreaElement).value; persist() },
              })
            : null,
        ),
      )
    }
    body.append(card)
  }

  const reports = (rec.imports ?? []).slice().reverse()
  dom.checksEl.append(
    h(
      'div',
      { class: 'results-head' },
      h(
        'div',
        {},
        h('h2', {}, t('Manual checks — {label}', { label: pageLabel(rec) })),
        h('p', { class: 'hint-line' }, t('What a script cannot judge: do each check on the page, then tick it. {done}/{total} done, {issues} problem(s).', { done: progress.done, total: progress.total, issues: progress.issues })),
      ),
      h('div', { class: 'nav' }, h('button', { type: 'button', onclick: () => actions.setView('review') }, t('← Back to review'))),
    ),
    h('p', { class: 'hint-line' }, runLabel(rec)),
    ...(reports.length ? [reviewQueue(rec)] : []),
    body,
    h('details', { class: 'card run-history', id: 'run-history' },
      h('summary', {}, t('Automatic run history ({n})', { n: reports.length })),
    ...reports.map((r) =>
      h(
        'div',
        { class: 'card' },
        h('h3', {}, t('Automatic checks ({tool}) — {date}', { tool: r.tool, date: dateTimeOf(r.at) })),
        h('p', { class: 'hint-line' }, t('{set} verdict(s) pre-filled, {noted} element note(s). {passes} passed rule(s) ignored, {incomplete} to check by hand.', { set: r.set, noted: r.noted, passes: r.passes, incomplete: r.incomplete })),
        ...(r.conflicts.length ? [h('p', { class: 'hint warn' }, t('The scan disagrees with your answer:')), h('ul', { class: 'checks' }, ...r.conflicts.map((x) => h('li', {}, x)))] : []),
        ...((r.items ?? []).length ? [h('details', {}, h('summary', {}, t('Rule by rule ({n})', { n: (r.items ?? []).length })), h('table', { class: 'audit-table' }, h('tbody', {}, ...(r.items ?? []).slice(0, 300).map((i) => h('tr', {}, h('td', {}, i.criterion), h('td', {}, i.rule), h('td', {}, i.result === 'nc' ? t('problem') : i.result === 'pass' ? t('nothing found') : i.result === 'na' ? t('not applicable') : t('to check')), h('td', {}, i.text))))))] : []),
        ...(r.unmatched.length ? [h('details', {}, h('summary', {}, t('{n} finding(s) not matched to a scanned element', { n: r.unmatched.length })), h('ul', { class: 'checks' }, ...r.unmatched.slice(0, 60).map((x) => h('li', {}, x))))] : []),
        ...(r.unmapped.length ? [h('details', {}, h('summary', {}, t('{n} rule(s) with no RGAA criterion in this tool', { n: r.unmapped.length })), h('p', { class: 'hint-line' }, r.unmapped.slice(0, 80).join(' · ')))] : []),
      ),
    )),
    h('details', { class: 'card scan-details' }, h('summary', {}, t('Scan coverage and page HTML')), htmlCard(rec), ...(rec.scanCoverage ? [coverageCard(rec.scanCoverage)] : [])),
  )
}

export function downloadSnapshot(rec: PageRecord): void {
  if (!rec.snapshot) return
  const date = new Date(rec.snapshot.at).toISOString().slice(0, 10)
  download(unpackSnapshot(rec.snapshot), 'text/html', `${slugOf(state.audit.meta.site || state.audit.name)}_${pageLabel(rec)}_${date}.html`)
}

let htmlBusy = false

export function htmlCard(rec: PageRecord): HTMLElement {
  const snap = rec.snapshot
  const check = rec.htmlCheck
  const run = async (fn: () => Promise<void>) => {
    if (htmlBusy) return
    htmlBusy = true
    keepScroll(dom.checksEl, renderChecks)
    try {
      await fn()
      persist()
      actions.renderAll()
    } catch (err) {
      say(t('Could not capture or check the HTML ({reason}).', { reason: String((err as Error)?.message ?? err) }))
    } finally {
      htmlBusy = false
      if (state.view === 'checks') keepScroll(dom.checksEl, renderChecks)
    }
  }
  return h(
    'div',
    { class: 'card' },
    h('h3', {}, t('Page HTML')),
    h('p', { class: 'hint-line' }, t('The HTML as the browser holds it now (after scripts) is kept in the audit and checked against the HTML specification, on this computer: nothing is sent anywhere. This is what RGAA 8.2 asks (valid generated source code).')),
    snap
      ? h('p', { class: 'hint info' }, t('Captured {date} · {size} (stored as {packed}) · {url}', { date: dateTimeOf(snap.at), size: kb(snap.bytes), packed: kb(snap.gz.length * 0.75), url: snap.url }))
      : h('p', { class: 'hint info' }, t('Not captured yet. Run the automatic checks (they capture it), or capture it now.')),
    h(
      'div',
      { class: 'nav' },
      h('button', { type: 'button', class: 'primary', disabled: htmlBusy, onclick: () => void run(() => captureAndCheckHtml(rec)) }, htmlBusy ? t('Working…') : snap ? t('Capture again and check') : t('Capture and check the HTML')),
      snap ? h('button', { type: 'button', onclick: () => downloadSnapshot(rec) }, t('Download the HTML')) : null,
      snap ? h('button', { type: 'button', disabled: htmlBusy, onclick: () => void run(() => validateSnapshot(rec, unpackSnapshot(snap))) }, t('Check again')) : null,
    ),
    check
      ? check.errors === 0
        ? h('p', { class: 'hint ok' }, t('No HTML error found in the generated code.'))
        : h(
            'div',
            {},
            h('p', { class: 'hint warn' }, t('{n} HTML error(s) found, in {k} kind(s).', { n: check.errors, k: check.groups.length })),
            ...check.groups.map((g) =>
              h(
                'details',
                {},
                h('summary', {}, `${g.rule} ×${g.count} — ${g.message}`),
                h('ul', { class: 'checks' }, ...g.examples.map((e) => h('li', {}, `${t('line {line}', { line: e.line })}${e.selector ? ` · ${e.selector}` : ''} — ${e.message}`))),
              ),
            ),
          )
      : null,
  )
}
