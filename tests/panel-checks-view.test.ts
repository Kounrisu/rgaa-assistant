// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createPage, emptyAudit } from '../src/lib/audit-store'
import { MANUAL_CHECKS } from '../src/lib/manual-checks'
import { manualProgress } from '../src/panel/checks-view'

describe('manualProgress: how far the manual checks of a page are', () => {
  it('counts the answered checks and the ones where a problem was found', () => {
    const rec = createPage(emptyAudit('t'), 'https://x.test/', 'X')
    expect(manualProgress(rec)).toEqual({ done: 0, issues: 0, total: MANUAL_CHECKS.length })
    rec.manualChecks = {
      [MANUAL_CHECKS[0].id]: { state: 'ok', note: '' },
      [MANUAL_CHECKS[1].id]: { state: 'issue', note: 'no focus visible' },
      [MANUAL_CHECKS[2].id]: { state: 'issue', note: '' },
    }
    expect(manualProgress(rec)).toEqual({ done: 3, issues: 2, total: MANUAL_CHECKS.length })
  })
})
