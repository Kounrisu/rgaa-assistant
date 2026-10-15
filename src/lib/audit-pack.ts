import { computeThemes } from './results'
import { isSuggested } from './review-confirmation'
/**
 * An “audit pack”: the audit as files a person or a language model can read — the code and the picture of every element, what the
 * tools found, what the auditor answered, and an empty answers file to complete. Pure: no network, no DOM. The model's answers come back
 * through `audit-answers.ts` and are only ever suggestions. Plan: docs/PLAN-llm-roundtrip.md.
 */
import { strToU8, zipSync } from 'fflate'
import type { Audit, AuditItem, FindingItem, PageRecord } from './types'
import { THEMES } from './themes'
import { IMAGE_CRITERION_IDS, criteriaFor, detectedOf, suggestedKind } from './rgaa'
import { FINDING_CRITERIA, findingCriteriaOf } from './findings'
import { dataImage } from './url-safety'
import { inLevel, LEVEL_COUNT } from './audit-levels'

export const PACK_SCHEMA = 1
export const PROMPT_VERSION = '1'

export interface PackOptions {
  /** Put the picture of each element in the pack (they can show personal data). */
  pictures: boolean
  /** Only the elements and criteria that still need an answer. */
  openOnly: boolean
  now?: number
}
export interface PackSummary { pages: number; elements: number; openAnswers: number; pictures: number; bytes: number }
export interface Pack { id: string; files: Record<string, Uint8Array>; /** The .zip, ready to save. */ zip: Uint8Array; summary: PackSummary }

const pad = (n: number) => String(n).padStart(2, '0')
export const pageLabelOf = (audit: Audit, rec: PageRecord): string => `P${pad(audit.pages.indexOf(rec) + 1)}`

/** Page code without scripts and without huge inline data, cut to a size a model can read. */
export function cleanHtml(html: string, max = 4000): string {
  const cleaned = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '<script>…</script>')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '<style>…</style>')
    .replace(/data:[a-z/+.-]+;base64,[A-Za-z0-9+/=]{80,}/gi, 'data:…(omitted)')
  return cleaned.length > max ? `${cleaned.slice(0, max)}…` : cleaned
}

function pictureBytes(dataUrl: string | null): { bytes: Uint8Array; ext: string } | null {
  const url = dataImage(dataUrl)
  const match = url ? /^data:image\/(png|jpe?g|gif|webp);base64,(.*)$/i.exec(url) : null
  if (!match) return null
  try {
    const binary = atob(match[2])
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return { bytes, ext: match[1].toLowerCase().replace('jpeg', 'jpg') }
  } catch {
    return null
  }
}

const jsonl = (rows: unknown[]) => rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : '')
const PER_ELEMENT = new Set([...IMAGE_CRITERION_IDS, ...Object.values(FINDING_CRITERIA).flatMap((list) => list.map((c) => c.id))])

export function buildPack(audit: Audit, opts: PackOptions): Pack {
  const now = opts.now ?? Date.now()
  const date = new Date(now).toISOString().slice(0, 10)
  const id = `${audit.id.slice(0, 8)}-${date}`
  const level = audit.meta.level
  const files: Record<string, Uint8Array> = {}
  const put = (path: string, content: string | Uint8Array) => { files[path] = typeof content === 'string' ? strToU8(content) : content }
  const summary: PackSummary = { pages: audit.pages.length, elements: 0, openAnswers: 0, pictures: 0, bytes: 0 }
  const template: unknown[] = []
  const slot = (page: string, scope: 'element' | 'page', criterion: string, element?: string) => {
    template.push({ pack: id, page, scope, ...(element ? { element } : {}), criterion, verdict: null, confidence: null, reason: '', evidence: [], model: '', prompt_version: PROMPT_VERSION })
    summary.openAnswers++
  }
  const picture = (page: string, key: string, shot: string | null | undefined, thumb: string | null): string | null => {
    if (!opts.pictures) return null
    const found = pictureBytes(shot ?? null) ?? pictureBytes(thumb)
    if (!found) return null
    const path = `pages/${page}/pictures/${key}.${found.ext}`
    put(path, found.bytes)
    summary.pictures++
    return path.replace(`pages/${page}/`, '')
  }

  audit.pages.forEach((rec) => {
    const page = pageLabelOf(audit, rec)
    const elements: unknown[] = []

    for (const el of rec.items as AuditItem[]) {
      const review = rec.reviews[el.key]
      const kind = review?.kind ?? suggestedKind(el) ?? undefined
      const open = criteriaFor(kind).filter((c) => inLevel(level, c.id) && (review?.answers[c.id] === undefined || isSuggested(review, c.id)))
      if (opts.openOnly && !open.length) continue
      const key = `img-${el.id}`
      elements.push({
        id: key, theme: 1, kind: 'image', present: el.present,
        tag: el.tag, type: el.type, src: el.src && !el.src.startsWith('data:') ? el.src : null,
        alt: el.alt, aria_label: el.ariaLabel, labelled_by_text: el.labelledByText, title: el.title, svg_title: el.svgTitle,
        accessible_name: el.accessibleName, role: el.role, aria_hidden: el.ariaHidden, ignored_by: el.ignoredBy,
        in_dialog: el.inDialog, nearby_text: el.nearbyText, link_href: el.linkHref, link_text: el.linkText, figcaption: el.figcaption,
        natural_size: [el.naturalWidth, el.naturalHeight],
        html: cleanHtml(el.html), context_html: cleanHtml(el.contextHtml, 3000),
        picture: picture(page, key, el.shot, el.thumb),
        tool: { detected: detectedOf(el), suggested_kind: suggestedKind(el) },
        auditor: review ? { kind: review.kind ?? null, answers: review.answers, note: review.note, confirmed: !review.auto, confirmed_criteria: Object.keys(review.answers).filter(id => !isSuggested(review, id)) } : null,
        open_criteria: open.map((c) => c.id),
      })
      summary.elements++
      for (const c of open) slot(page, 'element', c.id, key)
    }

    for (const f of rec.findings as FindingItem[]) {
      const review = rec.findingReviews[f.key]
      const open = findingCriteriaOf(f).filter((c) => inLevel(level, c.id) && (review?.answers[c.id] === undefined || isSuggested(review, c.id)))
      if (opts.openOnly && !open.length) continue
      if (f.type === 'contrast-ok') continue
      const key = `fnd-${f.theme}-${f.id}`
      elements.push({
        id: key, theme: f.theme, kind: f.type, present: f.present, label: f.label, summary: f.summary, facts: f.facts, count: f.count,
        html: cleanHtml(f.html), context_html: cleanHtml(f.contextHtml, 3000),
        picture: picture(page, key, f.shot, null),
        auditor: review ? { answers: review.answers, note: review.note, confirmed: !review.auto, confirmed_criteria: Object.keys(review.answers).filter(id => !isSuggested(review, id)) } : null,
        open_criteria: open.map((c) => c.id),
      })
      summary.elements++
      for (const c of open) slot(page, 'element', c.id, key)
    }

    const results = computeThemes(rec.items, el => rec.reviews[(el as AuditItem).key], rec.themes, rec.checklist, { findings: rec.findings, reviews: rec.findingReviews, scannedThemes: rec.scannedThemes, scanCoverage: rec.scanCoverage }, level)
    const manual = new Set(results.themes.flatMap(t => t.criteria.filter(c => c.manualReview).map(c => c.id)))
    const pageCriteria = THEMES.filter((t) => rec.themes.includes(t.number)).flatMap((t) =>
      t.criteria.filter((c) => inLevel(level, c.id) && (!PER_ELEMENT.has(c.id) || manual.has(c.id))).map((c) => ({ theme: t.number, c })),
    )
    const checklist = pageCriteria.map(({ theme, c }) => {
      const a = rec.checklist[c.id]
      return { criterion: c.id, theme, title: c.title.replace(/`/g, ''), auditor: manual.has(c.id) && a?.coverageAt !== (rec.scanCoverage?.at ?? 0) ? null : a?.verdict ?? null, manual_coverage: manual.has(c.id), note: a?.note ?? '', tool_suggestion: a?.suggested ?? null, tool: a?.source ?? null, tool_results: a?.autoResults ?? null }
    })
    for (const row of checklist) if (!row.auditor) slot(page, 'page', row.criterion)

    put(`pages/${page}/page.json`, JSON.stringify({ page, url: rec.url, title: rec.title, themes: rec.themes, scan_coverage: rec.scanCoverage ?? null, checklist }, null, 2))
    put(`pages/${page}/elements.jsonl`, jsonl(elements))
  })

  put('criteria.json', JSON.stringify(THEMES.map((t) => ({ theme: t.number, name: t.name, criteria: t.criteria.filter((c) => inLevel(level, c.id)).map((c) => ({ id: c.id, title: c.title.replace(/`/g, ''), tests: c.tests.map((x) => ({ id: x.id, text: x.text.replace(/`/g, '') })) })) })).filter((t) => t.criteria.length), null, 2))
  put('answers-template.jsonl', jsonl(template))
  put('README.md', readme(id, audit))
  put('manifest.json', JSON.stringify({ pack: id, schema: PACK_SCHEMA, prompt_version: PROMPT_VERSION, audit: audit.id, site: audit.meta.site, rgaa: '4.1', level: level ?? 'complet', criteria_in_scope: LEVEL_COUNT[level ?? 'complet'], created: new Date(now).toISOString(), pages: audit.pages.map((p) => ({ page: pageLabelOf(audit, p), url: p.url })), summary, files: Object.keys(files).sort() }, null, 2))

  const zipped = zipSync(files)
  summary.bytes = zipped.length
  return { id, files, zip: zipped, summary }
}

function readme(id: string, audit: Audit): string {
  return `# RGAA audit pack ${id}

Audit of **${audit.meta.site || audit.name}** against RGAA 4.1, prepared by RGAA Assistant. You are asked to help a human auditor.

## What is in this pack
- \`criteria.json\` — the RGAA criteria in scope, with the official tests.
- \`pages/Pxx/page.json\` — the page, and its page-level criteria with the answers of the auditor and what the tools suggested.
- \`pages/Pxx/elements.jsonl\` — one element per line (images, links, forms, tables…): its code (\`html\`, \`context_html\`), its accessible name data,
  what the tools found, what the auditor answered, and \`picture\` (a file under \`pages/Pxx/pictures/\`) when included.
- \`answers-template.jsonl\` — **one line per open question. This is the file to complete.**

## How to answer
Return \`answers.jsonl\`: the template lines with these fields filled in, nothing else changed (keep \`pack\`, \`page\`, \`scope\`, \`element\`, \`criterion\`).
- \`verdict\`: \`"c"\` (compliant), \`"nc"\` (not compliant), \`"na"\` (not applicable) or \`"unsure"\`.
- \`confidence\`: \`"low"\`, \`"medium"\` or \`"high"\`.
- \`reason\`: one or two sentences saying what you saw (required for \`nc\` and \`unsure\`). Quote the code or describe the picture.
- \`evidence\`: which sources you used, among \`"html"\`, \`"context"\`, \`"picture"\`, \`"name"\`, \`"tool"\`.
- \`model\`: the name of the model you are. \`prompt_version\`: keep "${PROMPT_VERSION}".

## Rules
1. Judge only from what is in the pack. If the code or the picture does not let you decide, answer \`"unsure"\` and say what is missing. Never invent.
2. Your answers are **suggestions**: a human confirms every verdict. Say \`unsure\` rather than guess.
3. The tools' suggestions (\`tool\`) can be wrong; the auditor's answers (\`auditor\`, when \`confirmed\` is true) are the reference — do not contradict them without a reason.
4. For text alternatives, judge relevance from the picture and the surrounding text (RGAA 1.3), not only from the presence of an attribute.
5. One JSON object per line, valid JSON, no comments, no extra text before or after.
`
}
