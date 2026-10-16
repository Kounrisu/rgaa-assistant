import { describe, expect, it } from 'vitest'
import { COMPLEMENTAIRE_CRITERIA, RAPIDE_CRITERIA, inLevel, levelCriteria } from '../src/lib/audit-levels'
import { computeThemes } from '../src/lib/results'
import { THEMES } from '../src/lib/themes'

describe('audit levels', () => {
  it('lists 25 + 25 distinct criteria that all exist in the RGAA', () => {
    const ids = new Set(THEMES.flatMap((t) => t.criteria.map((c) => c.id)))
    expect(RAPIDE_CRITERIA).toHaveLength(25)
    expect(COMPLEMENTAIRE_CRITERIA).toHaveLength(25)
    expect(new Set([...RAPIDE_CRITERIA, ...COMPLEMENTAIRE_CRITERIA]).size).toBe(50)
    for (const id of [...RAPIDE_CRITERIA, ...COMPLEMENTAIRE_CRITERIA]) expect(ids.has(id), id).toBe(true)
  })
  it('the complementary audit continues the quick one; the complete audit has no limit', () => {
    expect(levelCriteria('complementaire')!.size).toBe(50)
    expect(levelCriteria('complet')).toBeNull()
    expect(inLevel('rapide', '1.1')).toBe(true)
    expect(inLevel('rapide', '1.3')).toBe(false)
    expect(inLevel('complementaire', '1.3')).toBe(true)
    expect(inLevel(undefined, '13.12')).toBe(true)
  })
  it('a partial level counts only its criteria in every theme', () => {
    const count = (level?: 'rapide' | 'complementaire' | 'complet') =>
      computeThemes([], () => undefined, [1, 6, 8, 11], {}, undefined, level).themes.filter((t) => t.selected).reduce((n, t) => n + t.criteria.length, 0)
    expect(count('complet')).toBe(9 + 2 + 10 + 13)
    expect(count('rapide')).toBe(['1.1', '6.1', '6.2', '8.3', '8.4', '8.5', '11.1', '11.2', '11.5', '11.6', '11.9', '11.10'].length)
  })
})

describe('review screens follow the audit type', () => {
  it('an image is asked only the criteria of the level', async () => {
    const { criteriaFor } = await import('../src/lib/rgaa')
    const { setActiveLevel } = await import('../src/lib/audit-levels')
    const { findingCriteriaOf } = await import('../src/lib/findings')
    try {
      setActiveLevel('rapide')
      expect(criteriaFor('informative').map((c) => c.id)).toEqual(['1.1'])
      expect(criteriaFor('decorative')).toEqual([])
      expect(findingCriteriaOf({ theme: 6, type: 'link' }).map((c) => c.id)).toEqual(['6.1', '6.2'])
      expect(findingCriteriaOf({ theme: 2, type: 'iframe' })).toEqual([])
      setActiveLevel('complementaire')
      expect(criteriaFor('informative').map((c) => c.id)).toEqual(['1.1', '1.3', '1.6', '1.7'])
      setActiveLevel('complet')
      expect(criteriaFor('informative').length).toBeGreaterThan(4)
    } finally {
      setActiveLevel(undefined)
    }
  })
})
