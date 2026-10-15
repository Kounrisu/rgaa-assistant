import { suggestAnswer, isSuggested } from '../lib/review-confirmation'
/**
 * How a scan joins what the page already holds: images (mergeScan) and findings (mergeFindings).
 * Ids, answers and the verdicts pre-filled from the markup are kept or set here.
 */
import type { RawFinding, FindingItem, PageRecord, ImageElementInfo } from '../lib/types'
import { hash, keyOf } from './helpers'
import { state } from './state'
import { suggestFinding } from '../lib/findings'
import { applyContrastVerdict } from './contrast-checker'
import type { Item } from './types'
import { reviewOf } from './review-state'
import { pageOrder } from './page-order'
import { hintFor } from '../lib/rgaa'

export function keyOfFinding(theme: number, f: RawFinding): string {
  if (theme === 2) return `2|${f.type}|${f.facts.src ?? ''}|${hash(f.contextHtml)}`
  if (theme === 3) return `3|${f.type}|${f.label}|${f.facts['Font size'] ?? ''}`
  return `${theme}|${f.type}|${f.label}|${f.summary}|${hash(f.html)}`
}

/** Merges the scan of one theme into the current page; returns the renumbering for the boxes. */
export function mergeFindings(themeNo: number, raw: RawFinding[]): { map: { from: number; to: number }[]; added: number } {
  const rec = state.page!
  // Findings from the first versions (colours grouped by colour pair) are replaced by one finding per element.
  if (themeNo === 3) {
    for (const f of rec.findings.filter((x) => x.theme === 3 && x.type !== 'contrast-ok' && !x.label.startsWith('“'))) delete rec.findingReviews[f.key]
    rec.findings = rec.findings.filter((x) => x.theme !== 3 || x.type === 'contrast-ok' || x.label.startsWith('“'))
  }
  if (themeNo === 3) {
    // Older audits numbered the “passing text” line #1: it is now unnumbered (0) and the problems run 1, 2, 3…
    const mine = rec.findings.filter((x) => x.theme === 3)
    for (const f of mine) if (f.type === 'contrast-ok') f.id = 0
    mine.filter((x) => x.type !== 'contrast-ok').sort((a, b) => a.id - b.id).forEach((f, i) => (f.id = i + 1))
  }
  // The key of every finding of this scan (same key twice: ~1, ~2…), before anything is numbered.
  const occurrences = new Map<string, number>()
  const rawKeys = raw.map((r) => {
    const base = keyOfFinding(themeNo, r)
    const n = occurrences.get(base) ?? 0
    occurrences.set(base, n + 1)
    return n ? `${base}~${n}` : base
  })
  const seen = new Set(rawKeys)
  // A finding that is gone and was never touched by a human only adds noise: drop it FIRST, so the numbers it frees
  // are reused by the new findings and the numbering stays 1, 2, 3… instead of 1, 3.
  // “Touched by a human”: a note they wrote (the contrast checker writes its own note on every failing text: that one does not count)
  // or an answer they gave (an answer pre-filled by the scan does not count).
  const worked = (f: FindingItem) => {
    const r = rec.findingReviews[f.key]
    return Boolean(r && ((r.note.trim() && r.note !== r.autoNote) || Object.keys(r.answers).some(id => !isSuggested(r, id))))
  }
  for (const f of rec.findings.filter((x) => x.theme === themeNo && !seen.has(x.key) && !worked(x))) delete rec.findingReviews[f.key]
  rec.findings = rec.findings.filter((x) => x.theme !== themeNo || seen.has(x.key) || worked(x))
  const byKey = new Map(rec.findings.filter((f) => f.theme === themeNo).map((f) => [f.key, f]))
  const matched: { from: number; item: FindingItem }[] = []
  let added = 0
  raw.forEach((r, i) => {
    const key = rawKeys[i]
    const existing = byKey.get(key)
    if (existing) {
      Object.assign(existing, r, { id: existing.id, key, theme: themeNo, present: true, scan: existing.scan })
      matched.push({ from: r.id, item: existing })
    } else {
      const item: FindingItem = { ...r, id: r.type === 'contrast-ok' ? 0 : nextFindingNumber(rec, themeNo), theme: themeNo, key, present: true, scan: state.scanCount }
      rec.findings.push(item)
      byKey.set(key, item)
      matched.push({ from: r.id, item })
      added++
    }
  })
  // what is still here but not in this scan (a finding the auditor worked on) stays, marked as gone
  for (const f of rec.findings) if (f.theme === themeNo && !seen.has(f.key)) f.present = false
  // default verdicts from the markup, only where nothing was answered yet
  for (const f of rec.findings) {
    if (f.theme !== themeNo || !f.present) continue
    const review = (rec.findingReviews[f.key] ??= { answers: {}, note: '' })
    for (const [c, v] of Object.entries(suggestFinding(f))) {
      if (review.answers[c] === undefined) {
        suggestAnswer(review, c, v)
      }
    }
    if (f.type === 'contrast-fail' && !review.note.trim()) applyContrastVerdict(f, review, false)
  }
  // Numbers follow the page (reading order of the latest scan), like the images; answers follow the element through its key.
  // The unnumbered “text that passes” line of Colours keeps 0.
  const numbered = rec.findings.filter((f) => f.theme === themeNo && f.type !== 'contrast-ok')
  const selected = state.page === rec && state.theme === themeNo ? numbered.find((f) => f.id === state.findingSel) : undefined
  const ordered = pageOrder(numbered, rawKeys.filter((k) => byKey.get(k)?.type !== 'contrast-ok'))
  ordered.forEach((f, i) => (f.id = i + 1))
  if (selected) state.findingSel = selected.id
  rec.findings = [...rec.findings.filter((f) => f.theme !== themeNo), ...rec.findings.filter((f) => f.theme === themeNo && f.type === 'contrast-ok'), ...ordered]
  rec.findings.sort((a, b) => a.theme - b.theme || a.id - b.id)
  if (!rec.scannedThemes.includes(themeNo)) rec.scannedThemes.push(themeNo)
  return { map: matched.map(({ from, item }) => ({ from, to: item.id })), added }
}

/** Next number of a theme: one more than the highest still in use, so numbering stays 1, 2, 3… */
export function nextFindingNumber(rec: PageRecord, themeNo: number): number {
  const used = Math.max(0, ...rec.findings.filter((f) => f.theme === themeNo).map((f) => f.id))
  return used + 1
}

/**
 * What the markup already answers, until a human says otherwise (flagged `auto`: it counts as “to confirm”, never as confirmed):
 * - ignored by assistive tech and nameless: decorative, 1.2 compliant;
 * - it has an accessible name: informative, 1.1 compliant (the text alternative exists: its relevance, 1.3 and the others, stay yours);
 * - no name and not ignored: informative, 1.1 non-compliant (decorative would fail 1.2 for the same reason: either way it fails).
 */
export function prefill(el: Item): void {
  const review = reviewOf(el)
  const untouched = !review.kind && !Object.keys(review.answers).length
  if (el.ignoredBy) {
    if (hintFor('1.2', el)?.tone !== 'ok') return
    const decorativeWithoutVerdict = review.kind === 'decorative' && review.answers['1.2'] === undefined
    if (!untouched && !decorativeWithoutVerdict) return
    review.kind = 'decorative'
    suggestAnswer(review, '1.2', 'c')
    return
  }
  if (!untouched) return
  review.kind = 'informative'
  suggestAnswer(review, '1.1', el.accessibleName ? 'c' : 'nc')
}

/** Merges a scan into the current page. Returns the new count and the renumbering for the page's boxes. */
export function mergeScan(found: ImageElementInfo[]): { added: number; renumbered: number; map: { from: number; to: number }[] } {
  const rec = state.page!
  state.scanCount++
  const byKey = new Map(state.elements.map((el) => [el.key, el]))
  const before = new Map(state.elements.map((el) => [el.key, el.id])) // the numbers of the images known before this scan
  // Surrounding text/siblings are evidence, but can change without replacing the image.
  // Fall back only for a unique, unchanged image (including its link destination).
  // Never guess between identical images or transfer an answer after its markup changes.
  const identity = (el: ImageElementInfo) => JSON.stringify([el.type, el.src, el.html, el.linkHref])
  const oldByIdentity = new Map<string, Item[]>()
  for (const el of state.elements) {
    const key = identity(el)
    oldByIdentity.set(key, [...(oldByIdentity.get(key) ?? []), el])
  }
  const counts = new Map<string, number>()
  for (const el of found) counts.set(identity(el), (counts.get(identity(el)) ?? 0) + 1)
  const seen = new Set<string>()
  const occurrences = new Map<string, number>()
  const keys = found.map(info => {
    const base = keyOf(info)
    const n = occurrences.get(base) ?? 0
    occurrences.set(base, n + 1)
    return n ? `${base}~${n}` : base
  })
  const reserved = new Set(keys.filter(key => byKey.has(key)))
  const matched: { from: number; item: Item }[] = []
  const foundKeys: string[] = []
  let added = 0
  for (const [index, info] of found.entries()) {
    let key = keys[index]
    let existing = byKey.get(key)
    if (!existing) {
      const candidates = oldByIdentity.get(identity(info)) ?? []
      if (counts.get(identity(info)) === 1 && candidates.length === 1 && !reserved.has(candidates[0].key) && !seen.has(candidates[0].key)) {
        existing = candidates[0]
        key = existing.key // keep the review storage key and its human answers
      }
    }
    seen.add(key)
    foundKeys.push(key)
    if (existing) {
      Object.assign(existing, info, { id: existing.id, key, present: true, scan: existing.scan })
      matched.push({ from: info.id, item: existing })
    } else {
      const item: Item = { ...info, id: 0, key, present: true, scan: state.scanCount }
      state.elements.push(item)
      byKey.set(key, item)
      matched.push({ from: info.id, item })
      added++
    }
  }
  for (const el of state.elements) if (!seen.has(el.key)) el.present = false
  for (const el of state.elements) if (el.present) prefill(el)
  // Numbers follow the page: #1 is the first image in reading order, whatever order the scans found them in. Answers belong to the
  // element (its key), not to its number. Images not found this time stay next to the neighbours they had.
  state.elements.splice(0, state.elements.length, ...pageOrder(state.elements, foundKeys))
  state.elements.forEach((el, i) => (el.id = i + 1))
  rec.nextId = state.elements.length + 1
  const renumbered = state.elements.filter((el) => before.get(el.key) !== undefined && before.get(el.key) !== el.id).length
  return { added, renumbered, map: matched.map(({ from, item }) => ({ from, to: item.id })) }
}
