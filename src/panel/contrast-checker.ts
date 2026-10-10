import { say, dom, h } from './dom'
import { t } from '../lib/i18n'
import { sendToPage, inspectedTabId } from './page-bridge'
import type { FindingItem, ImageReview } from '../lib/types'
import { parseHex, contrastRatio, toHex } from '../lib/contrast'
import { findingStatus } from './review-state'
import { persist } from './model'
import { actions } from './actions'

/** Reads a colour on the page: the page shows a magnifier with the hex, and sends back the colour you click. */
export async function pickColorFromPage(): Promise<string | null> {
  say(t('Move over the page and click the colour (Esc to cancel). The magnifier shows its hex.'))
  try {
    const r = await sendToPage(inspectedTabId(), { type: 'RGAA_PICK_START' })
    if (typeof r.hex === 'string') {
      say(t('Picked {hex}.', { hex: r.hex }))
      return r.hex
    }
    say(r.error ? t('Could not take a screenshot ({error}). Check that the extension may access this site.', { error: r.error }) : t('Colour pick cancelled.'))
  } catch (err) {
    say(t('Could not pick a colour: reload the tab and try again.'))
    console.error(err)
  }
  return null
}

/** The ratio of a contrast finding, from the colours checked by hand or else the ones the script read. */
export function contrastOutcome(f: FindingItem, review: ImageReview) {
  const fgHex = review.fg ?? (typeof f.data.fg === 'string' ? f.data.fg : '')
  const bgHex = review.bg ?? (typeof f.data.bg === 'string' ? f.data.bg : '')
  const fg = parseHex(fgHex)
  const bg = parseHex(bgHex)
  if (!fg || !bg) return null
  const threshold = typeof f.data.threshold === 'number' ? f.data.threshold : f.data.large === true ? 3 : 4.5
  const ratio = contrastRatio(fg, bg)
  return { ratio, threshold, ok: ratio >= threshold, fg: toHex(fg), bg: toHex(bg), large: f.data.large === true }
}

/**
 * Compliant when the ratio passes; non-compliant, with the problem written in the notes, when it does not.
 * The note is only replaced when it is empty or was written by this checker.
 */
export function applyContrastVerdict(f: FindingItem, review: ImageReview, setVerdict: boolean): void {
  const out = contrastOutcome(f, review)
  if (!out) return
  if (setVerdict) {
    review.answers['3.2'] = out.ok ? 'c' : 'nc'
    review.auto = false
  }
  const mine = !review.note.trim() || review.note === review.autoNote
  if (!mine) return
  if (out.ok) {
    review.note = ''
    delete review.autoNote
  } else {
    const vars = { fg: out.fg, bg: out.bg, ratio: out.ratio.toFixed(2), threshold: out.threshold }
    review.note = out.large ? t('Contrast too low: text {fg} on {bg} = {ratio}:1, large text needs {threshold}:1.', vars) : t('Contrast too low: text {fg} on {bg} = {ratio}:1, normal text needs {threshold}:1.', vars)
    review.autoNote = review.note
  }
}

/** Brings the verdict buttons, the note and the status dot of an open finding in line with its review. */
export function syncContrastUI(f: FindingItem, review: ImageReview): void {
  for (const v of ['c', 'nc', 'na'] as const) {
    const radio = document.getElementById(`fnd-${f.id}-3.2-${v}`) as HTMLInputElement | null
    if (!radio) continue
    radio.checked = review.answers['3.2'] === v
    const card = radio.closest<HTMLElement>('.criterion')
    if (card) {
      card.dataset.state = review.answers['3.2'] ?? ''
      card.querySelector('.prefill-note')?.remove()
    }
  }
  const note = document.getElementById(`fnd-note-${f.id}`) as HTMLTextAreaElement | null
  if (note) note.value = review.note
  const dot = dom.themeEl.querySelector(`.item.finding[data-fid="${f.id}"] .dot`) as HTMLElement | null
  if (dot) dot.className = `dot ${findingStatus(f) === 'todo' ? '' : findingStatus(f)}`
  actions.renderThemeBar()
  actions.renderStats()
  actions.renderPageBar()
  actions.updateFindingChips()
}

/** Text and background colours of a contrast finding: read by the script, editable, pickable on the page. */
export function contrastChecker(f: FindingItem, review: ImageReview): HTMLElement {
  const scriptFg = typeof f.data.fg === 'string' ? f.data.fg : ''
  const scriptBg = typeof f.data.bg === 'string' ? f.data.bg : ''
  const threshold = typeof f.data.threshold === 'number' ? f.data.threshold : f.data.large === true ? 3 : 4.5
  const card = h('div', { class: 'card contrast-checker' })
  const result = h('p', { class: 'hint info' })

  const update = () => {
    const fg = parseHex(review.fg ?? scriptFg)
    const bg = parseHex(review.bg ?? scriptBg)
    if (!fg || !bg) {
      result.className = 'hint info'
      result.textContent = !fg && !bg ? t('Fill the text and background colours: use “Pick on page”, or type a hex value.') : !fg ? t('Fill the text colour: use “Pick on page”, or type a hex value.') : t('Fill the background colour: use “Pick on page”, or type a hex value.')
      return
    }
    const ratio = contrastRatio(fg, bg)
    const ok = ratio >= threshold
    result.className = `hint ${ok ? 'ok' : 'warn'}`
    const vars = { ratio: ratio.toFixed(2), threshold }
    result.textContent = ok ? t('{ratio}:1 — passes: marked Compliant (needs {threshold}:1).', vars) : t('{ratio}:1 — fails: marked Non-compliant, problem written in the notes (needs {threshold}:1).', vars)
  }

  const row = (label: string, key: 'fg' | 'bg', scripted: string) => {
    const input = h('input', { type: 'text', class: 'hex', value: review[key] ?? scripted, placeholder: '#RRGGBB', 'aria-label': key === 'fg' ? t('Text colour (hex)') : t('Background colour (hex)'), spellcheck: false })
    const swatch = h('span', { class: 'swatch', role: 'img', 'aria-label': key === 'fg' ? t('Text colour preview') : t('Background colour preview') })
    const source = h('span', { class: 'hint-line' })
    const refresh = () => {
      const c = parseHex(input.value)
      swatch.style.background = c ? toHex(c) : 'repeating-conic-gradient(#ccc 0 25%, #fff 0 50%) 0 0 / 10px 10px'
      source.textContent = review[key] ? t('set by hand') : scripted ? t('read from the page') : t('not found: pick it')
    }
    const set = (value: string | undefined) => {
      if (value === undefined || value === scripted) delete review[key]
      else review[key] = value
      refresh()
      update()
      applyContrastVerdict(f, review, true)
      persist()
      syncContrastUI(f, review)
    }
    input.addEventListener('input', () => {
      const c = parseHex(input.value)
      if (c) set(toHex(c))
      else {
        swatch.style.background = ''
        result.className = 'hint info'
        result.textContent = t('Type a hex colour like #1A2B3C.')
      }
    })
    const pick = h('button', { type: 'button', class: 'img-ref', onclick: async () => {
      const hexValue = await pickColorFromPage()
      if (!hexValue) return
      input.value = hexValue
      set(hexValue)
    } }, t('Pick on page'))
    const reset = scripted ? h('button', { type: 'button', class: 'img-ref', onclick: () => { input.value = scripted; set(undefined) } }, t('Reset')) : null
    refresh()
    return h('div', { class: 'color-row' }, h('span', { class: 'color-label' }, label), swatch, input, pick, reset, source)
  }

  card.append(
    h('h3', {}, t('Contrast checker')),
    h('p', { class: 'hint-line' }, t('Click “Pick on page”, then click right next to the text (for the background) or on a letter stroke (for the text).')),
    row(t('Text'), 'fg', scriptFg),
    row(t('Background'), 'bg', scriptBg),
    result,
  )
  update()
  return card
}
