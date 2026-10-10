import { describe, expect, it } from 'vitest'
import { auditFromFile, auditToFile, emptyAudit } from '../src/lib/audit-store'

describe('test setup', () => {
  it('round-trips an audit through its file format', () => {
    const audit = emptyAudit('Smoke')
    const back = auditFromFile(auditToFile(audit))
    expect(back.id).toBe(audit.id)
    expect(back.name).toBe('Smoke')
  })
})
