/**
 * Audit style sheets: CSS that outlines and labels one kind of element on the page (images, links, headings, ARIA roles…) while the
 * auditor looks at it. They are the sheets the owner uses with the Stylus extension (see audit-styles-data.ts). The panel can apply them
 * itself, theme by theme, or, for an auditor who prefers Stylus, only remind them which Stylus sheet goes with the theme being reviewed
 * (the names are the Stylus names).
 */
import { AUDIT_SHEETS, type BundledSheet } from './audit-styles-data'

export type StyleSheetDef = BundledSheet

/** `app`: the panel applies the sheets. `stylus`: the auditor uses Stylus, the panel only names the sheets of the theme. */
export type StylesMode = 'app' | 'stylus'

export const auditSheets = (): StyleSheetDef[] => [...AUDIT_SHEETS].sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true }))

/** The sheets that help with an RGAA theme (and the ones for the whole page, 0, which help with every theme). */
export const sheetsForTheme = (theme: number): StyleSheetDef[] => auditSheets().filter((s) => s.themes.includes(theme))

/** The RGAA themes that have at least one sheet, the one being shown first, then 0 (whole page), then the others. */
export function themesWithSheets(current: number): number[] {
  const all = [...new Set(auditSheets().flatMap((s) => s.themes))]
  return all.sort((a, b) => (a === current ? -1 : b === current ? 1 : a - b))
}
