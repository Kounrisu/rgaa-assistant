import { describe, expect, it } from 'vitest'
import { computeThemes } from '../src/lib/results'
import { themeTodo, todoReason } from '../src/lib/theme-todo'
import type { ImageElementInfo, ImageReview } from '../src/lib/types'

const img = (id: number): ImageElementInfo => ({ id, type: 'img', tag: 'img', src: `a${id}.png`, accessibleName: 'x', ignoredBy: null }) as ImageElementInfo
const run = (images: ImageElementInfo[], reviews: Record<number, ImageReview>, checklist: Record<string, { verdict?: 'c' | 'nc' | 'na'; note: string; manualTests?: boolean }> = {}, selected = [1]) =>
  computeThemes(images, (el) => reviews[el.id], selected, checklist, { findings: [], reviews: {}, scannedThemes: [1] })

describe('a failure the auditor confirmed is confirmed, whatever other images are still pre-filled', () => {
  it('1.1: one confirmed non-compliant image makes the failure confirmed; only pre-filled ones keep it "to confirm"', () => {
    const humanNc: ImageReview = { kind: 'informative', answers: { '1.1': 'nc' }, note: '' }
    const autoC: ImageReview = { kind: 'informative', answers: { '1.1': 'c' }, note: '', auto: true }
    const autoNc: ImageReview = { kind: 'informative', answers: { '1.1': 'nc' }, note: '', auto: true }
    const crit = (r: ReturnType<typeof run>) => r.images.criteria.find((c) => c.id === '1.1')!
    expect(crit(run([img(1), img(2)], { 1: humanNc, 2: autoC })).unconfirmed).toBeFalsy()
    expect(crit(run([img(1), img(2)], { 1: autoNc, 2: autoC })).unconfirmed).toBe(true)
    expect(crit(run([img(1), img(2)], { 1: autoNc, 2: humanNc })).unconfirmed).toBeFalsy()
  })
})

describe('Images: questions no image answers (1.4, 1.5) and partly covered criteria', () => {
  const theme1 = (r: ReturnType<typeof run>) => r.themes.find((t) => t.number === 1)!

  it('1.4 and 1.5 are answered for the page, like checklist criteria, and count as fully covered', () => {
    const open = theme1(run([img(1)], {}))
    expect(open.criteria.find((c) => c.id === '1.4')).toMatchObject({ outcome: 'pending', coverage: 'full' })
    const answered = theme1(run([img(1)], {}, { '1.4': { verdict: 'na', note: '' }, '1.5': { verdict: 'c', note: '' } }))
    expect(answered.criteria.find((c) => c.id === '1.4')).toMatchObject({ outcome: 'na', coverage: 'full' })
    expect(answered.criteria.find((c) => c.id === '1.5')).toMatchObject({ outcome: 'c', coverage: 'full' })
  })

  it('a criterion with tests the tool does not assess stays partial until the auditor ticks "checked by hand"', () => {
    const reviews: Record<number, ImageReview> = { 1: { kind: 'informative', answers: { '1.1': 'c', '1.3': 'c', '1.6': 'na', '1.7': 'na', '1.8': 'na', '1.9': 'na' }, note: '' } }
    const before = theme1(run([img(1)], reviews))
    const partial = before.criteria.filter((c) => c.coverage === 'partial').map((c) => c.id)
    expect(partial).toContain('1.1') // 1.1.4 (server-side image maps) is not assessed
    const after = theme1(run([img(1)], reviews, { '1.1': { note: '', manualTests: true } }))
    expect(after.criteria.find((c) => c.id === '1.1')!.coverage).toBe('full')
    expect(after.criteria.find((c) => c.id === '1.1')!.outcome).toBe('c') // the verdict is untouched
    expect(after.criteria.filter((c) => c.coverage === 'partial').map((c) => c.id)).toEqual(partial.filter((id) => id !== '1.1'))
  })
})

describe('themeTodo: what is left, and why', () => {
  it('lists the open criteria with their reason, in order, and nothing for a finished theme', () => {
    const reviews: Record<number, ImageReview> = { 1: { kind: 'decorative', answers: { '1.2': 'c' }, note: '', auto: true } }
    const r = run([img(1)], reviews)
    const todo = themeTodo(r.themes.find((t) => t.number === 1))
    expect(todo.find((x) => x.id === '1.2')?.reason).toBe('confirm') // pre-filled C: confirm it
    expect(todo.find((x) => x.id === '1.4')?.reason).toBe('todo')
    expect(todo.map((x) => x.id)).toEqual([...todo.map((x) => x.id)].sort((a, b) => Number(a.split('.')[1]) - Number(b.split('.')[1])))
    // nothing left once everything is confirmed and covered
    const done = run([], {}, Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`1.${i + 1}`, { verdict: 'na' as const, note: 'Whole page checked', coverageAt: 0 }])))
    expect(themeTodo(done.themes.find((t) => t.number === 1))).toEqual([])
  })

  it('a theme that is not part of the audit has nothing to do; reasons by criterion result', () => {
    expect(themeTodo(run([], {}, {}, [8]).themes.find((t) => t.number === 1))).toEqual([])
    expect(todoReason({ id: 'x', title: '', outcome: 'pending', tests: [], coverage: 'full', suggested: 'c' })).toBe('suggested')
    expect(todoReason({ id: 'x', title: '', outcome: 'nc', tests: [], coverage: 'full', unconfirmed: true })).toBe('failure')
    expect(todoReason({ id: 'x', title: '', outcome: 'c', tests: [], coverage: 'partial' })).toBe('partial')
    expect(todoReason({ id: 'x', title: '', outcome: 'c', tests: [], coverage: 'full' })).toBeNull()
    expect(todoReason({ id: 'x', title: '', outcome: 'unassessed', tests: [], coverage: 'none' })).toBeNull()
  })
})
