import { describe, expect, it } from 'vitest'
import { auditFromFile, auditToFile, parseAudit } from '../src/lib/audit-store'
import { sampleAudit } from './fakes'

/** The evidence migration runs inside the audit migration: tool pre-filled verdicts never come back as confirmed. */
describe('loading an audit migrates tool-prefilled verdicts to suggestions', () => {
  const withChecklist = () => {
    const audit = sampleAudit('Evidence')
    if (!audit.pages.length) throw new Error('sample audit needs a page')
    audit.pages[0].checklist = {
      '8.5': { verdict: 'c', source: 'axe', note: '', autoResults: { axe: { result: 'pass', rules: ['document-title'] } } },
      '8.3': { verdict: 'c', note: 'checked by hand' },
    }
    return audit
  }

  it('a verdict that came from a tool becomes a suggestion', () => {
    const loaded = parseAudit(JSON.parse(JSON.stringify(withChecklist())))
    const answer = loaded.pages[0].checklist['8.5']
    expect(answer.verdict).toBeUndefined()
    expect(answer.suggested).toBe('c')
    expect(answer.source).toBe('axe')
  })

  it('a verdict the auditor gave is left alone, also through a file round trip', () => {
    const loaded = auditFromFile(auditToFile(withChecklist()))
    expect(loaded.pages[0].checklist['8.3']).toMatchObject({ verdict: 'c', note: 'checked by hand' })
    expect(loaded.pages[0].checklist['8.3'].suggested).toBeUndefined()
  })
})
