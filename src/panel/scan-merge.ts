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
  const byKey = new Map(rec.findings.filter((f) => f.theme === themeNo).map((f) => [f.key, f]))
  const seen = new Set<string>()
  const occurrences = new Map<string, number>()
  const map: { from: number; to: number }[] = []
  let added = 0
  for (const r of raw) {
    const base = keyOfFinding(themeNo, r)
    const n = occurrences.get(base) ?? 0
    occurrences.set(base, n + 1)
    const key = n ? `${base}~${n}` : base
    seen.add(key)
    const existing = byKey.get(key)
    if (existing) {
      Object.assign(existing, r, { id: existing.id, key, theme: themeNo, present: true, scan: existing.scan })
      map.push({ from: r.id, to: existing.id })
    } else {
      const item: FindingItem = { ...r, id: r.type === 'contrast-ok' ? 0 : nextFindingNumber(rec, themeNo), theme: themeNo, key, present: true, scan: state.scanCount }
      rec.findings.push(item)
      byKey.set(key, item)
      map.push({ from: r.id, to: item.id })
      added++
    }
  }
  for (const f of rec.findings) if (f.theme === themeNo && !seen.has(f.key)) f.present = false
  // A finding that is gone and was never touched by a human only adds noise (and gaps in the numbering).
  const worked = (f: FindingItem) => {
    const r = rec.findingReviews[f.key]
    return Boolean(r && (r.note.trim() || (!r.auto && Object.keys(r.answers).length)))
  }
  for (const f of rec.findings.filter((x) => x.theme === themeNo && !x.present && !worked(x))) delete rec.findingReviews[f.key]
  rec.findings = rec.findings.filter((x) => x.theme !== themeNo || x.present || worked(x))
  // default verdicts from the markup, only where nothing was answered yet
  for (const f of rec.findings) {
    if (f.theme !== themeNo || !f.present) continue
    const review = (rec.findingReviews[f.key] ??= { answers: {}, note: '' })
    let filled = false
    for (const [c, v] of Object.entries(suggestFinding(f))) {
      if (review.answers[c] === undefined) {
        review.answers[c] = v
        filled = true
      }
    }
    if (f.type === 'contrast-fail' && !review.note.trim()) applyContrastVerdict(f, review, false)
    if (filled) review.auto = true
  }
  rec.findings.sort((a, b) => a.theme - b.theme || a.id - b.id)
  if (!rec.scannedThemes.includes(themeNo)) rec.scannedThemes.push(themeNo)
  return { map, added }
}

/** Next number of a theme: one more than the highest still in use, so numbering stays 1, 2, 3… */
export function nextFindingNumber(rec: PageRecord, themeNo: number): number {
  const used = Math.max(0, ...rec.findings.filter((f) => f.theme === themeNo).map((f) => f.id))
  return used + 1
}

/** Ignored by assistive tech and nameless: decorative + 1.2 compliant, until a human says otherwise. */
export function prefill(el: Item): void {
  const review = reviewOf(el)
  if (!el.ignoredBy || hintFor('1.2', el)?.tone !== 'ok') return
  const untouched = !review.kind && !Object.keys(review.answers).length
  const decorativeWithoutVerdict = review.kind === 'decorative' && review.answers['1.2'] === undefined
  if (!untouched && !decorativeWithoutVerdict) return
  review.kind = 'decorative'
  review.answers['1.2'] = 'c'
  review.auto = true
}

/** Merges a scan into the current page. Returns the new count and the renumbering for the page's boxes. */
export function mergeScan(found: ImageElementInfo[]): { added: number; map: { from: number; to: number }[] } {
  const rec = state.page!
  state.scanCount++
  const byKey = new Map(state.elements.map((el) => [el.key, el]))
  const seen = new Set<string>()
  const occurrences = new Map<string, number>()
  const map: { from: number; to: number }[] = []
  let added = 0
  for (const info of found) {
    const base = keyOf(info)
    const n = occurrences.get(base) ?? 0
    occurrences.set(base, n + 1)
    const key = n ? `${base}~${n}` : base
    seen.add(key)
    const existing = byKey.get(key)
    if (existing) {
      Object.assign(existing, info, { id: existing.id, key, present: true, scan: existing.scan })
      map.push({ from: info.id, to: existing.id })
    } else {
      const item: Item = { ...info, id: rec.nextId++, key, present: true, scan: state.scanCount }
      state.elements.push(item)
      byKey.set(key, item)
      map.push({ from: info.id, to: item.id })
      added++
    }
  }
  for (const el of state.elements) if (!seen.has(el.key)) el.present = false
  for (const el of state.elements) if (el.present) prefill(el)
  state.elements.sort((a, b) => a.scan - b.scan || a.id - b.id)
  return { added, map }
}
