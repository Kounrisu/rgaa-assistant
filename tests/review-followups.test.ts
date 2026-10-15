// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { strFromU8 } from 'fflate'
import { sampleAudit } from './fakes'
import { parseAudit } from '../src/lib/audit-store'
import { buildPack } from '../src/lib/audit-pack'
import { setActiveLevel } from '../src/lib/audit-levels'
import { buildReportHtml } from '../src/lib/report'
import { computeThemes } from '../src/lib/results'
import { auditSheets, countsOf, isProvisional, type PageInput } from '../src/lib/audit-sheet'
import { unresolvedManualIssues } from '../src/lib/manual-evidence'
import { setLang } from '../src/lib/i18n'
import { FR } from '../src/lib/i18n-fr'
import { THEMES } from '../src/lib/themes'
import { isNavigableUrl } from '../src/lib/url-safety'
import type { PageRecord } from '../src/lib/types'

function input(page: PageRecord): PageInput {
  const reviewOf = (el: { id: number }) => page.reviews[page.items.find(i => i.id === el.id)!.key]
  const result = computeThemes(page.items, reviewOf, page.themes, page.checklist, { findings: page.findings, reviews: page.findingReviews, scannedThemes: page.scannedThemes })
  return { label: 'P01', pageTitle: page.title, pageUrl: page.url, themes: result.themes, results: result.images, images: page.items, reviewOf, detectedOf: () => 'named', checklist: page.checklist, findings: page.findings, findingReviews: page.findingReviews, manualChecks: page.manualChecks }
}

describe('remaining review corrections', () => {
  it('keeps a manual problem unresolved until its explicit criterion link has a confirmed NC', () => {
    const a = sampleAudit(); const p = a.pages[0]
    p.manualChecks = { 'kb-trap': { state: 'issue', note: 'Escape cannot close the dialog' } }
    p.checklist['12.9'] = { note: '', verdict: 'c' }
    const unresolved = () => unresolvedManualIssues(p.manualChecks, input(p).themes)
    expect(unresolved()).toHaveLength(1)
    expect(isProvisional({ C: 106, NC: 0, NA: 0, NT: 0, partial: 0, suggested: 0, unconfirmed: 0, manualIssues: countsOf(input(p)).manualIssues })).toBe(true)
    p.checklist['12.9'].verdict = 'nc'
    expect(unresolved()).toHaveLength(1) // an unrelated verdict cannot silently resolve a problem
    p.manualChecks['kb-trap'].criterion = '12.9'
    expect(unresolved()).toHaveLength(0)
    delete p.checklist['12.9'].verdict
    p.checklist['12.9'].suggested = 'nc'
    expect(unresolved()).toHaveLength(1)
    setLang('en')
    expect(buildReportHtml(a, [input(p)], [p])).toContain('Resolve manual problems before final reporting')
    const complete = input(p)
    for (const theme of complete.themes) for (const criterion of theme.criteria) Object.assign(criterion, { outcome: 'c', coverage: 'full', unconfirmed: false, suggested: undefined, conflicts: [] })
    expect(buildReportHtml(a, [complete], [p])).not.toContain('class="statement"')
    complete.themes.flatMap(t => t.criteria).find(c => c.id === '12.9')!.outcome = 'nc'
    expect(buildReportHtml(a, [complete], [p])).toContain('class="statement"')
  })

  it('preserves human image notes across JSON, Excel and escaped multiline HTML', () => {
    setLang('en')
    const a = sampleAudit(); const p = a.pages[0]
    p.scannedThemes = [1]
    const note = 'Human explanation <script>unsafe</script>\nSuggested alternative'
    p.reviews['img-1'].answers['1.1'] = 'nc'; p.reviews['img-1'].note = note
    expect(parseAudit(JSON.parse(JSON.stringify(a))).pages[0].reviews['img-1'].note).toBe(note)
    expect(JSON.stringify(auditSheets([input(p)], a.meta))).toContain('Human explanation <script>')
    const html = buildReportHtml(a, [input(p)], [p])
    expect(html).toContain('Human explanation &lt;script&gt;unsafe&lt;/script&gt;<br>Suggested alternative')
    expect(html).not.toContain('<script>unsafe</script>')
    expect(html.match(/Human explanation/g)).toHaveLength(1)
  })

  it('migrates old observations without inventing a link or URL history, and validates v6 additions', () => {
    const raw = JSON.parse(JSON.stringify(sampleAudit()))
    raw.version = 5
    raw.pages[0].manualChecks = { 'kb-trap': { state: 'issue', note: 'Keep this evidence' } }
    const migrated = parseAudit(raw)
    expect(migrated.version).toBe(6)
    expect(migrated.pages[0].manualChecks!['kb-trap'].criterion).toBeUndefined()
    migrated.pages[0].urlHistory = [{ url: 'https://old.example.org', at: 1 }]
    migrated.pages[0].manualChecks!['kb-trap'].criterion = '12.9'
    expect(parseAudit(JSON.parse(JSON.stringify(migrated)))).toEqual(migrated)
    const invalid = JSON.parse(JSON.stringify(migrated))
    invalid.pages[0].urlHistory[0].at = 'yesterday'
    expect(() => parseAudit(invalid)).toThrow()
  })

  it('export questions and workbook rows do not depend on the previously rendered audit scope', () => {
    const a = sampleAudit(); const p = a.pages[0]
    p.findings.push({ ...p.findings[0], theme: 11, type: 'field', id: 2, key: 'field-2' })
    const build = () => buildPack(a, { pictures: false, openOnly: false, now: 1 })
    setActiveLevel('rapide')
    const quick = build(); const quickSheets = auditSheets([input(p)], a.meta)
    setActiveLevel('complet')
    const full = build()
    expect(quick.files).toEqual(full.files)
    expect(quickSheets).toEqual(auditSheets([input(p)], a.meta))
    expect(strFromU8(full.files['answers-template.jsonl'])).toContain('11.13')
  })

  it('applies export exclusions to exact files without modifying the saved audit', () => {
    const a = sampleAudit(); const p = a.pages[0]
    p.items[0].html = '<input type="hidden" value="private-token">'
    p.items[0].nearbyText = 'private-customer'; p.reviews['img-1'].note = 'private-note'
    const before = JSON.stringify(a)
    const full = buildPack(a, { pictures: false, openOnly: false })
    expect(strFromU8(full.files['pages/P01/elements.jsonl'])).toContain('private-token')
    const redacted = buildPack(a, { pictures: false, openOnly: false, exclude: ['html', 'text', 'notes', 'urls'] })
    const files = Object.values(redacted.files).map(bytes => strFromU8(bytes)).join('\n')
    expect(files).not.toContain('private-token'); expect(files).not.toContain('private-customer'); expect(files).not.toContain('private-note')
    expect(files).not.toContain('https://example.org/')
    expect(JSON.stringify(a)).toBe(before)
  })

  it('requires translations for every dynamic instructional note', () => {
    for (const theme of THEMES) for (const c of theme.criteria) expect(FR[c.note], c.id).toBeTruthy()
  })
  it('rejects malformed, credentialed and unsupported navigation URLs', () => {
    for (const url of ['not-a-url', 'https://', 'https://user:password@example.org', 'javascript:alert(1)', 'https://[broken']) expect(isNavigableUrl(url), url).toBe(false)
    for (const url of ['https://example.org/path?q=1', 'http://localhost:3000', 'file:///C:/audit/page.html']) expect(isNavigableUrl(url), url).toBe(true)
  })
})
