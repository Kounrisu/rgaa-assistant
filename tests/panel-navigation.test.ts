// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createPage, emptyAudit } from '../src/lib/audit-store'
import { THEMES } from '../src/lib/themes'
import { firstThemeWith, themeProgress } from '../src/panel/chrome'
import { state } from '../src/panel/state'

describe('review navigation and confirmed progress', () => {
  it('keeps an automatic failure in the review queue after every other criterion is answered', () => {
    const page = createPage(emptyAudit('test'), 'https://example.test', 'Test')
    page.themes = [8]
    const criteria = THEMES.find((theme) => theme.number === 8)!.criteria
    for (const c of criteria) page.checklist[c.id] = { verdict: 'c', note: '' }
    page.checklist['8.5'] = { suggested: 'nc', source: 'axe', note: '' }
    state.page = page
    expect(firstThemeWith('pending')).toBe(8)
    expect(themeProgress(page, 8)).toEqual({ done: criteria.length - 1, total: criteria.length, suggested: 1 }) // the automatic failure is counted as waiting for confirmation, not as done
    page.checklist['8.5'] = { verdict: 'nc', note: '' }
    expect(firstThemeWith('pending')).toBeNull()
    expect(themeProgress(page, 8).done).toBe(criteria.length)
  })

  it('does not count unsupported image criteria as answered', () => {
    const page = createPage(emptyAudit('test'), 'https://example.test', 'Test')
    state.page = page
    expect(themeProgress(page, 1).done).toBe(0)
  })
})
