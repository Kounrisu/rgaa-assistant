import { describe, expect, it } from 'vitest'
import { applyToolResults, type ToolResults } from '../src/lib/axe-import'
import { confirm, evidenceConflicts, migrateEvidence, pendingSuggestion } from '../src/lib/evidence'
import { createPage, emptyAudit, migrate } from '../src/lib/audit-store'
import type { Audit } from '../src/lib/types'

const run = (over: Partial<ToolResults> = {}): ToolResults => ({ tool: 'axe', url: 'https://x.test/', violations: [], answers: [], incomplete: 0, passes: 1, passedChecks: [], ...over })
const fresh = () => createPage(emptyAudit('t'), 'https://x.test/', 'X')
const pass = (criterion = '8.5'): ToolResults['passedChecks'] => [{ criterion, rule: 'document-title' }]
const fail = (rule = 'document-title'): ToolResults['violations'] => [{ rule, impact: 'serious', help: 'h', nodes: [{ html: '<title>', target: ['title'], summary: '' }] }]

describe('automatic results are evidence and suggestions', () => {
  it('a pass is stored as a suggestion, never as a verdict', () => {
    const page = fresh()
    applyToolResults(page, run({ passedChecks: pass() }), { addThemes: true })
    const a = page.checklist['8.5']
    expect(a.verdict).toBeUndefined()
    expect(a.suggested).toBe('c')
    expect(a.source).toBe('axe')
    expect(a.autoResults?.axe.result).toBe('pass')
    expect(pendingSuggestion(a)).toBe('c')
  })

  it('a human verdict survives another automatic run, a suggestion is refreshed', () => {
    const page = fresh()
    applyToolResults(page, run({ passedChecks: pass() }), { addThemes: true })
    applyToolResults(page, run({ violations: fail() }), { addThemes: true })
    expect(page.checklist['8.5'].suggested).toBe('nc') // refreshed: the failure replaces the pass suggestion
    confirm(page.checklist['8.5'], 'c')
    applyToolResults(page, run({ violations: fail() }), { addThemes: true })
    const a = page.checklist['8.5']
    expect(a.verdict).toBe('c')
    expect(a.suggested).toBeUndefined()
    expect(a.source).toBeUndefined()
  })

  it('a failure after a human "compliant" is reported as a conflict and stays visible', () => {
    const page = fresh()
    page.themes = [1, 8]
    page.checklist['8.5'] = { note: '', verdict: 'c' }
    const report = applyToolResults(page, run({ violations: fail() }))
    expect(report.conflicts.some((c) => c.startsWith('8.5'))).toBe(true)
    expect(evidenceConflicts(page.checklist['8.5']).length).toBe(1)
    expect(page.checklist['8.5'].verdict).toBe('c')
  })

  it('tools that disagree are flagged', () => {
    const page = fresh()
    applyToolResults(page, run({ tool: 'axe', passedChecks: pass() }), { addThemes: true })
    applyToolResults(page, run({ tool: 'other', violations: fail() }), { addThemes: true })
    expect(evidenceConflicts(page.checklist['8.5'])[0]).toContain('≠')
  })
})

describe('migration of saved audits', () => {
  it('turns tool-prefilled verdicts into suggestions and leaves human verdicts alone', () => {
    const page = fresh()
    page.checklist['8.5'] = { note: '', verdict: 'c', source: 'axe' }
    page.checklist['8.3'] = { note: '', verdict: 'nc' }
    page.checklist['8.4'] = { note: 'n' }
    migrateEvidence(page)
    expect(page.checklist['8.5']).toMatchObject({ suggested: 'c', source: 'axe' })
    expect(page.checklist['8.5'].verdict).toBeUndefined()
    expect(page.checklist['8.3']).toEqual({ note: '', verdict: 'nc' })
    expect(page.checklist['8.4']).toEqual({ note: 'n' })
    migrateEvidence(page) // idempotent
    expect(page.checklist['8.5'].suggested).toBe('c')
  })

  it('runs as part of migrate() on a loaded audit', () => {
    const audit = emptyAudit('old')
    const page = createPage(audit, 'https://x.test/', 'X')
    page.checklist['8.5'] = { note: '', verdict: 'c', source: 'axe' }
    const back = migrate(JSON.parse(JSON.stringify(audit)) as Audit)
    expect(back.pages[0].checklist['8.5'].verdict).toBeUndefined()
    expect(back.pages[0].checklist['8.5'].suggested).toBe('c')
  })
})
