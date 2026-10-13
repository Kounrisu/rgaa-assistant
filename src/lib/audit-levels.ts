/**
 * The three audit levels of the DINUM method (Ara): audit rapide (25 criteria), audit complémentaire (the next 25, so 50 in
 * total) and the complete audit (all 106). Lists: docs/audit-levels-ara.md (to be checked against the DINUM pages).
 * A partial level never gives a compliance rate or a statement: it says which level it was computed at.
 */
export type AuditLevel = 'rapide' | 'complementaire' | 'complet'
export const AUDIT_LEVELS: AuditLevel[] = ['complet', 'rapide', 'complementaire']

export const RAPIDE_CRITERIA = ['1.1', '3.1', '4.1', '4.10', '5.3', '5.7', '6.1', '6.2', '7.1', '7.3', '8.3', '8.4', '8.5', '9.1', '10.3', '10.6', '10.7', '11.1', '11.2', '11.5', '11.6', '11.9', '11.10', '12.8', '12.9']
export const COMPLEMENTAIRE_CRITERIA = ['1.3', '1.5', '1.6', '1.7', '4.2', '4.4', '4.8', '4.9', '5.4', '5.6', '7.2', '8.2', '8.6', '8.10', '10.2', '10.8', '10.9', '10.10', '13.1', '13.3', '13.4', '13.5', '13.6', '13.7', '13.8']

/** English labels (the key of the French text). */
export const LEVEL_LABEL: Record<AuditLevel, string> = {
  complet: 'Complete audit',
  rapide: 'Quick audit',
  complementaire: 'Complementary audit',
}
export const LEVEL_COUNT: Record<AuditLevel, number> = { complet: 106, rapide: 25, complementaire: 50 }

/** The criteria of a level; `null` = every criterion. The complementary audit continues the quick one: it covers both lists. */
export function levelCriteria(level: AuditLevel | undefined): Set<string> | null {
  if (!level || level === 'complet') return null
  return new Set(level === 'rapide' ? RAPIDE_CRITERIA : [...RAPIDE_CRITERIA, ...COMPLEMENTAIRE_CRITERIA])
}
/**
 * The level of the audit being worked on. The review screens (which criteria an image, a link or a form is asked) read it here, so that
 * a quick or complementary audit asks exactly its criteria. The panel sets it each time it draws; the default (complete) asks everything.
 */
let activeLevel: AuditLevel | undefined
export const setActiveLevel = (level: AuditLevel | undefined): void => { activeLevel = level }
export const inActiveLevel = (id: string): boolean => inLevel(activeLevel, id)
export const activeLevelIsPartial = (): boolean => Boolean(activeLevel) && activeLevel !== 'complet'

export const inLevel = (level: AuditLevel | undefined, id: string): boolean => levelCriteria(level)?.has(id) ?? true
