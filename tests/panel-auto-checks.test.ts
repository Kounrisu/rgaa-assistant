// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { setLang } from '../src/lib/i18n'
import { RULES, type RuleFinding } from '../src/lib/rgaa-rules'
import { rulesToResults } from '../src/panel/auto-checks'

beforeEach(() => setLang('en'))
afterEach(() => setLang('fr'))

describe('rulesToResults: what the page script found becomes tool results', () => {
  it('turns a finding into one answer per criterion of its rule, with the note filled in', () => {
    const { own } = rulesToResults('https://x.test/', [{ key: 'target-blank', count: 2, samples: ['a', 'b'] }])
    expect(own.tool).toBe('RGAA')
    expect(own.url).toBe('https://x.test/')
    expect(own.answers).toEqual([{ criterion: '13.2', status: 'nc', note: '2 link(s) open a new window without saying so. Examples: a, b', rule: 'target-blank' }])
  })

  it('ignores a rule it does not know and fills {detail} from the finding', () => {
    const { own } = rulesToResults('u', [{ key: 'not-a-rule', count: 1 }, { key: 'generic-title', count: 1, detail: 'Untitled' }])
    expect(own.answers).toHaveLength(1)
    expect(own.answers[0]).toMatchObject({ criterion: '8.6', status: null, rule: 'generic-title' })
    expect(own.answers[0].note).toContain('(Untitled)')
  })

  it('a rule that looks for a failure and found none is a passed check on each of its criteria', () => {
    const { own } = rulesToResults('u', [{ key: 'target-blank', count: 1 }])
    const nc = Object.entries(RULES).filter(([, m]) => m.status === 'nc')
    const expected = nc.filter(([key]) => key !== 'target-blank').flatMap(([key, m]) => m.criteria.map((criterion) => `${criterion}:${key}`))
    expect(own.passedChecks.map((p) => `${p.criterion}:${p.rule}`)).toEqual(expected)
    expect(own.passes).toBe(own.passedChecks.length)
    expect(own.passedChecks.some((p) => p.rule === 'target-blank')).toBe(false)
  })

  it('a "not applicable" rule answers na on all its criteria', () => {
    const { own } = rulesToResults('u', [{ key: 'no-table', count: 0 }])
    expect(own.answers.length).toBe(RULES['no-table'].criteria.length)
    expect(own.answers.every((a) => a.status === 'na' && a.rule === 'no-table')).toBe(true)
  })

  // --- Asqatasun-derived: begin ---
  it('Asqatasun findings are split off: nc / na with a note, review as a note only, pass as a passed check', () => {
    const asq = (status: 'nc' | 'review' | 'na' | 'pass') => ({ criterion: '10.7', test: '10.7.1', status, text: '{n} element(s) for test {test} of {criterion}. {samples}' })
    const findings = [
      { key: 'asq-1', count: 3, samples: ['x'], asq: asq('nc') },
      { key: 'asq-2', count: 1, asq: asq('review') },
      { key: 'asq-3', count: 0, asq: asq('na') },
      { key: 'asq-4', count: 0, detail: 'fine', asq: asq('pass') },
    ] as RuleFinding[]
    const { asq: out, own } = rulesToResults('https://x.test/', findings)
    expect(out.tool).toBe('Asqatasun')
    expect(out.answers.map((a) => [a.rule, a.status])).toEqual([['asq-1', 'nc'], ['asq-2', null], ['asq-3', 'na']])
    expect(out.answers[0].note).toBe('3 element(s) for test 10.7.1 of 10.7. x')
    expect(out.passedChecks).toEqual([{ criterion: '10.7', rule: 'asq-4', detail: 'fine' }])
    expect(out.passes).toBe(1)
    // they are not mixed into our own answers
    expect(own.answers).toEqual([])
  })
  // --- Asqatasun-derived: end ---
})
