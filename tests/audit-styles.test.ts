import { describe, expect, it } from 'vitest'
import { FR } from '../src/lib/i18n-fr'
import { auditSheets, sheetsForTheme, themesWithSheets } from '../src/lib/audit-styles'

describe('the audit style sheets', () => {
  const sheets = auditSheets()

  it('are 19 distinct, non-empty sheets with a valid RGAA theme', () => {
    expect(sheets).toHaveLength(19)
    expect(new Set(sheets.map((s) => s.id)).size).toBe(19)
    expect(new Set(sheets.map((s) => s.name)).size).toBe(19)
    for (const s of sheets) {
      expect(s.css.trim().length, s.name).toBeGreaterThan(20)
      expect(s.themes.length, s.name).toBeGreaterThan(0)
      expect(s.themes.every((t) => Number.isInteger(t) && t >= 0 && t <= 13), s.name).toBe(true)
      // balanced braces: a transcription slip would break every rule after it
      expect(s.css.split('{').length, s.name).toBe(s.css.split('}').length)
    }
  })

  it('keep the Stylus names (the auditor looks for them in Stylus) and the theme in their number', () => {
    expect(sheets.map((s) => s.name)).toEqual([
      '0.Thématiques NA', '01.Images', '02.Cadres', '05.Tableaux', '06.Liens', '07.ARIA role state properties', '08.07.Langue', '08.09.Detournement de balises',
      '08.10.Direction', '09.01.Titres', '09.02.Structure', '09.03.Listes', '10.01.Attributs et balises de mise en forme', '10.07.Focus', '10.08.Textes cachés',
      '11.5.Regroupements', '12.06.Landmarks', '13.Documents bureautiques', 'Reduction images',
    ])
    for (const s of sheets.filter((x) => /^\d/.test(x.name))) expect(s.themes, s.name).toEqual([Number(/^(\d+)/.exec(s.name)![1])])
  })

  it('load nothing from the network', () => {
    for (const s of sheets) expect(s.css, s.name).not.toMatch(/@import|url\s*\(|image-set|src\s*\(/i)
  })

  it('keep the CSS escape of a generated new line (\\A), which a plain template string would have eaten', () => {
    const css = (name: string) => sheets.find((s) => s.name === name)!.css
    expect(css('01.Images')).toContain('" img\\A"')
    expect(css('01.Images')).toContain("\" role='img'\\A\"")
    expect(css('09.02.Structure')).toContain('" header\\A"')
    expect(css('12.06.Landmarks')).toContain("role='banner'\\A")
  })

  it('are found by theme: Links has 06.Liens, Structure has three, the whole-page sheet is theme 0', () => {
    expect(sheetsForTheme(6).map((s) => s.name)).toEqual(['06.Liens'])
    expect(sheetsForTheme(9).map((s) => s.name)).toEqual(['09.01.Titres', '09.02.Structure', '09.03.Listes'])
    expect(sheetsForTheme(1).map((s) => s.name)).toEqual(['01.Images', 'Reduction images'])
    expect(sheetsForTheme(0).map((s) => s.name)).toEqual(['0.Thématiques NA'])
    expect(sheetsForTheme(3)).toEqual([])
  })

  it('the theme being reviewed comes first in the menu, then the others in order', () => {
    expect(themesWithSheets(6)[0]).toBe(6)
    expect(themesWithSheets(6).slice(1)).toEqual([0, 1, 2, 5, 7, 8, 9, 10, 11, 12, 13])
    expect(themesWithSheets(3)).toEqual([0, 1, 2, 5, 6, 7, 8, 9, 10, 11, 12, 13])
  })

  it('the menu texts have a French translation', () => {
    for (const key of ['Audit styles', 'Audit styles (Stylus)', 'Switch all off', 'How do you work?', 'Apply the style sheets here', 'Whole page']) expect(FR[key], key).toBeTruthy()
  })
})
