import { t } from './i18n'

/** What a scan did and did not look at. Computed in the page (src/content/scan-coverage.ts), stored on the page record. */
export interface ScanCoverage {
  at: number
  frames: { total: number; sameOrigin: number; crossOrigin: number }
  /** Open shadow roots found in the main document (their content is not scanned by the scanners). */
  openShadowRoots: number
  /** A closed shadow root cannot be detected from a script. */
  closedShadowRoots: 'unknown'
  /** Lists cut at a limit: `shown` of `total` (total is null when only "more than shown" is known). */
  truncated: { what: string; shown: number; total: number | null }[]
  notes: string[]
}

/** Keeps the latest frame/shadow figures and, per kind of truncation, the latest value (a rescan of one theme does not erase the others). */
export function mergeCoverage(prev: ScanCoverage | undefined, next: ScanCoverage | undefined): ScanCoverage | undefined {
  if (!next) return prev
  if (!prev) return next
  const byWhat = new Map(prev.truncated.map((x) => [x.what, x]))
  for (const x of next.truncated) byWhat.set(x.what, x)
  return { ...next, truncated: [...byWhat.values()], notes: [...new Set([...prev.notes, ...next.notes])] }
}

const WHAT: Record<string, string> = {
  links: 'links',
  fields: 'form fields',
  tables: 'tables',
  'text nodes (contrast)': 'text nodes (contrast)',
  'contrast findings': 'contrast findings',
  'boxes per finding': 'boxes per finding',
  'html characters': 'characters of HTML',
}

/** Plain sentences saying what was NOT looked at. */
export function coverageLines(c: ScanCoverage): string[] {
  const out: string[] = []
  if (c.frames.total) {
    out.push(
      c.frames.crossOrigin
        ? t('{n} iframe(s) ({x} from another origin) were not scanned: their content is not part of these results.', { n: c.frames.total, x: c.frames.crossOrigin })
        : t('{n} iframe(s) were not scanned: their content is not part of these results.', { n: c.frames.total }),
    )
  }
  if (c.frames.total) out.push(t('The axe run does not enter iframes either.'))
  if (c.openShadowRoots) out.push(t('{n} open shadow root(s): the elements inside were not scanned.', { n: c.openShadowRoots }))
  out.push(t('Closed shadow roots cannot be detected: anything inside one was not scanned.'))
  for (const x of c.truncated) {
    const what = t(WHAT[x.what] ?? x.what)
    out.push(x.total === null ? t('Only the first {shown} {what} were examined (there are more).', { shown: x.shown, what }) : t('Only {shown} of {total} {what} were listed or examined.', { shown: x.shown, total: x.total, what }))
  }
  return out
}

/** Unknown closed roots are a standing limitation; known omitted content requires manual review. */
export const hasScanGaps = (scan: ScanCoverage | undefined): boolean => Boolean(scan &&
  (scan.frames.total || scan.openShadowRoots || scan.truncated.some(x => x.total === null || x.total > x.shown)))
