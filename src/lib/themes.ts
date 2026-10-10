import data from '../rgaa/rgaa-tests.json'

export type Automation = 'auto' | 'semi' | 'manual'

export interface TestDef {
  id: string
  text: string
  conditions: string[]
  automation: Automation
  script: string | null
  human: string | null
}
export interface CriterionDef {
  id: string
  title: string
  wcag: string[]
  automation: Automation
  note: string
  tests: TestDef[]
}
export interface ThemeDef {
  number: number
  name: string
  criteria: CriterionDef[]
}

export const THEMES: ThemeDef[] = data.topics as ThemeDef[]
export const themeByNumber = (n: number): ThemeDef | undefined => THEMES.find((t) => t.number === n)

/** Themes that have an element-level scan and review. The others are criteria checklists. */
export const SCANNED_THEMES = new Set([1, 2, 3])
/** Themes reviewed finding by finding (like images, but simpler). */
export const FINDING_THEMES = new Set([2, 3])
export const DEFAULT_THEMES = [1]

/** Short, French-free tab labels. */
export const THEME_LABEL: Record<number, string> = {
  1: 'Images', 2: 'Frames', 3: 'Colours', 4: 'Multimedia', 5: 'Tables', 6: 'Links', 7: 'Scripts',
  8: 'Mandatory elements', 9: 'Structure', 10: 'Presentation', 11: 'Forms', 12: 'Navigation', 13: 'Consultation',
}

export const criteriaCount = (n: number): number => themeByNumber(n)?.criteria.length ?? 0

export type Level = 'A' | 'AA' | 'AAA'

/**
 * RGAA level of each criterion, derived from the WCAG success criteria it references
 * (the lowest level when it references several; 10.7 is AA in the RGAA).
 */
export const CRITERION_LEVEL: Record<string, Level> = (() => {
  const out: Record<string, Level> = {}
  const rank: Level[] = ['A', 'AA', 'AAA']
  for (const theme of THEMES) {
    for (const c of theme.criteria) {
      const found = [...c.wcag.join(' ').matchAll(/\((AAA|AA|A)\)/g)].map((m) => m[1] as Level)
      out[c.id] = found.length ? found.sort((a, b) => rank.indexOf(a) - rank.indexOf(b))[0] : 'A'
    }
  }
  out['10.7'] = 'AA'
  return out
})()
