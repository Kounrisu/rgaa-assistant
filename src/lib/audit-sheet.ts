import { OUTCOME_LABEL, statusOf, type CriterionResult, type Outcome, type Status, type Theme1Results, type ThemeResult } from './results'
import { CRITERION_LEVEL, THEME_LABEL, type Level } from './themes'
import type { Thumb } from './thumbs'
import { buildXlsx, type CellInput, type Sheet } from './xlsx'
import { findingCriteriaOf } from './findings'
import { tFr } from './i18n'
import { MANUAL_CHECKS } from './manual-checks'
import type { AuditMeta, ChecklistAnswer, Detected, FindingItem, ImageElementInfo, ImageReview, ManualCheckAnswer } from './types'

/** Status of one TEST (theme 1 detail). Criteria use `statusOf`, which also looks at coverage. */
const STATUS: Record<Outcome, Status> = { c: 'C', nc: 'NC', na: 'NA', pending: 'NT', unassessed: 'NT' }
const DETECTED_FR: Record<Detected, string> = {
  ignored: 'Ignorée par les technologies d’assistance',
  named: 'Avec alternative textuelle',
  unnamed: 'Sans alternative textuelle',
}
const CRITERIA_FOR_IMAGES = ['1.1', '1.2', '1.3', '1.6', '1.7', '1.8', '1.9']
const ROW_PT = 54 // fits a 64 px thumbnail

/** Everything needed to describe one audited page of the sample. */
export interface PageInput {
  label: string
  /** Per-test results of the Images theme (detail sheet). */
  results: Theme1Results
  /** Every RGAA theme, with the audited ones filled in. */
  themes: ThemeResult[]
  checklist: Record<string, ChecklistAnswer>
  findings: FindingItem[]
  findingReviews: Record<string, ImageReview>
  images: ImageElementInfo[]
  reviewOf: (el: ImageElementInfo) => ImageReview | undefined
  detectedOf: (el: ImageElementInfo) => Detected
  pageUrl: string
  pageTitle: string
  manualChecks?: Record<string, ManualCheckAnswer>
}

const head = (labels: string[]): CellInput[] => labels.map((v) => ({ v, s: 'head' as const }))
const title = (v: string): CellInput[] => [{ v, s: 'title' }]
const fileOf = (el: ImageElementInfo) =>
  el.src && !el.src.startsWith('data:') ? decodeURIComponent(el.src.split('?')[0].split('/').pop() ?? '') : `<${el.type}>`
/** Unique per image across pages, used to match thumbnails to cells. */
export const thumbKey = (pageIndex: number, imageId: number) => pageIndex * 100000 + imageId

/* ------------------------------------------------------------------ */
/* Statistics                                                          */
/* ------------------------------------------------------------------ */

/**
 * C / NC / NA / NT per status (see `statusOf`: a criterion with partial coverage keeps its verdict), plus
 * flags kept apart from the verdict: `partial` = criteria (any status) with incomplete coverage, `suggested` = criteria
 * waiting for the auditor to confirm a tool suggestion, `unconfirmed` = counted C/NC/NA that still rest on a pre-filled
 * verdict nobody confirmed.
 */
export interface Counts { C: number; NC: number; NA: number; NT: number; partial: number; suggested: number; unconfirmed: number }
export const rateOf = (c: Counts): number | null => (c.C + c.NC ? Math.round((c.C / (c.C + c.NC)) * 100) : null)
const emptyCounts = (): Counts => ({ C: 0, NC: 0, NA: 0, NT: 0, partial: 0, suggested: 0, unconfirmed: 0 })

/**
 * A rate is PROVISIONAL while the audit is incomplete: some criteria are not tested (NT), some counted criteria are
 * only partly covered by this tool, or a counted verdict is still an unconfirmed pre-fill. Only a rate with NT = 0,
 * no partial coverage and nothing unconfirmed is final for its scope.
 */
export const isProvisional = (c: Counts): boolean => c.NT > 0 || c.unconfirmed > 0 || c.partial > 0
export const PROVISIONAL_FR = 'provisoire'
export const PROVISIONAL_NOTE_FR =
  'Taux provisoire : des critères restent à tester, ne sont couverts que partiellement par RGAA Assistant (leur résultat ne porte que sur les tests que l’outil sait évaluer), ou reposent sur un pré-remplissage automatique non confirmé. Seule une relecture complète par l’auditeur donne un taux définitif.'
export const withProvisional = (text: string, c: Counts): string => (text !== '—' && text !== 'indisponible' && isProvisional(c) ? `${text} (${PROVISIONAL_FR})` : text)

/** Every criterion of the referential, in official order, with its theme. */
const flat = (p: PageInput) => p.themes.flatMap((theme) => theme.criteria.map((c) => ({ theme, c })))

export function countsOf(p: PageInput): Counts {
  const n = emptyCounts()
  for (const { c } of flat(p)) {
    const st = statusOf(c)
    n[st]++
    if (c.coverage === 'partial') n.partial++
    if (c.outcome === 'pending' && c.suggested) n.suggested++
    if (c.unconfirmed && st !== 'NT') n.unconfirmed++
  }
  return n
}

/** A criterion over the whole sample: NC if any page is NC, C only if no page is left untested. */
export function sampleStatus(statuses: Status[]): Status {
  if (statuses.includes('NC')) return 'NC'
  if (statuses.includes('NT')) return 'NT'
  if (statuses.includes('C')) return 'C'
  return 'NA'
}

export interface AuditStats {
  perPage: { label: string; title: string; url: string; images: number; themes: number[]; counts: Counts; rate: number | null }[]
  /** Average of the page rates (the RGAA "taux moyen de conformité"). */
  averageRate: number | null
  sampleCounts: Counts
  sampleRate: number | null
  sampleCriteria: { id: string; title: string; theme: number; status: Status; partial: boolean; suggested: boolean; unconfirmed: boolean }[]
  perTheme: { number: number; name: string; audited: boolean; counts: Counts; rate: number | null }[]
}

export function auditStats(pages: PageInput[]): AuditStats {
  const perPage = pages.map((p) => {
    const counts = countsOf(p)
    return {
      label: p.label,
      title: p.pageTitle,
      url: p.pageUrl,
      images: p.images.length,
      themes: p.themes.filter((t) => t.selected).map((t) => t.number),
      counts,
      rate: rateOf(counts),
    }
  })
  const rates = perPage.map((p) => p.rate).filter((r): r is number => r !== null)
  const reference = pages[0] ? flat(pages[0]) : []
  const sampleCriteria = reference.map(({ theme, c }, i) => ({
    id: c.id,
    title: c.title,
    theme: theme.number,
    status: sampleStatus(pages.map((p) => statusOf(flat(p)[i].c))),
    partial: pages.some((p) => flat(p)[i].c.coverage === 'partial'),
    suggested: pages.some((p) => flat(p)[i].c.outcome === 'pending' && flat(p)[i].c.suggested),
    unconfirmed: pages.some((p) => flat(p)[i].c.unconfirmed),
  }))
  const sampleCounts = emptyCounts()
  const tally = (counts: Counts, c: (typeof sampleCriteria)[number]) => {
    counts[c.status]++
    if (c.partial) counts.partial++
    if (c.suggested && c.status === 'NT') counts.suggested++
    if (c.unconfirmed && c.status !== 'NT') counts.unconfirmed++
  }
  for (const c of sampleCriteria) tally(sampleCounts, c)
  const perTheme = (pages[0]?.themes ?? []).map((theme) => {
    const counts = emptyCounts()
    for (const c of sampleCriteria.filter((x) => x.theme === theme.number)) tally(counts, c)
    return {
      number: theme.number,
      name: theme.name,
      audited: pages.some((p) => p.themes.find((t) => t.number === theme.number)?.selected),
      counts,
      rate: rateOf(counts),
    }
  })
  return {
    perPage,
    averageRate: rates.length ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : null,
    sampleCounts,
    sampleRate: rateOf(sampleCounts),
    sampleCriteria,
    perTheme,
  }
}

export const rateExact = (c: Counts): number | null => (c.C + c.NC ? (c.C / (c.C + c.NC)) * 100 : null)
/** 41,67 % — two decimals and a comma, as in the official dashboard. */
export const pct2 = (r: number | null): string =>
  r === null ? '—' : `${r.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`

export interface LevelStats {
  perLevel: Record<Level, Counts>
  /** The legal level (AA) includes the A criteria. */
  legal: Counts
  pages: { label: string; title: string; counts: Counts; rate: number | null }[]
  /** The average of page rates is provisional as soon as one page rate is. */
  averageProvisional: boolean
  average: number | null
  best: { label: string; rate: number } | null
  worst: { label: string; rate: number } | null
  /** Average of the page rates, split as C / NC for the "moyenne par page" chart. */
  averageSplit: { C: number; NC: number } | null
}

export function levelStats(stats: AuditStats): LevelStats {
  const perLevel: Record<Level, Counts> = { A: emptyCounts(), AA: emptyCounts(), AAA: emptyCounts() }
  for (const c of stats.sampleCriteria) {
    const counts = perLevel[CRITERION_LEVEL[c.id] ?? 'A']
    counts[c.status]++
    if (c.partial) counts.partial++
    if (c.suggested && c.status === 'NT') counts.suggested++
    if (c.unconfirmed && c.status !== 'NT') counts.unconfirmed++
  }
  const legal = emptyCounts()
  for (const k of Object.keys(legal) as (keyof Counts)[]) legal[k] = perLevel.A[k] + perLevel.AA[k]
  const pages = stats.perPage.map((p) => ({ label: p.label, title: p.title, counts: p.counts, rate: rateExact(p.counts) }))
  const rated = pages.filter((p): p is typeof p & { rate: number } => p.rate !== null)
  const average = rated.length ? rated.reduce((a, p) => a + p.rate, 0) / rated.length : null
  return {
    perLevel,
    legal,
    pages,
    averageProvisional: pages.some((p) => isProvisional(p.counts)),
    average,
    best: rated.length ? rated.reduce((a, b) => (b.rate > a.rate ? b : a)) : null,
    worst: rated.length ? rated.reduce((a, b) => (b.rate < a.rate ? b : a)) : null,
    averageSplit: average === null ? null : { C: average, NC: 100 - average },
  }
}

/* ------------------------------------------------------------------ */
/* Sheets                                                              */
/* ------------------------------------------------------------------ */

export function sampleSheet(pages: PageInput[], meta: AuditMeta): Sheet {
  return {
    name: 'Échantillon',
    widths: [24, 40, 70, 24],
    rows: [
      title('RGAA 4.1.2 – GRILLE D’ÉVALUATION'),
      [],
      [{ v: 'Date', s: 'head' }, new Date().toLocaleDateString('fr-FR')],
      [{ v: 'Auditeur ou auditrice', s: 'head' }, meta.auditor],
      [{ v: 'Contexte', s: 'head' }, meta.context],
      [{ v: 'Site', s: 'head' }, meta.site],
      [],
      head(['N° page', 'Titre de la page', 'URL', 'Thématiques auditées']),
      ...pages.map((p) => [p.label, { v: p.pageTitle, s: 'wrap' as const }, { v: p.pageUrl, s: 'wrap' as const }, p.themes.filter((t) => t.selected).map((t) => t.number).join(', ')]),
    ],
  }
}

export function summarySheet(pages: PageInput[]): Sheet {
  const stats = auditStats(pages)
  const pct = (r: number | null) => (r === null ? 'indisponible' : `${r} %`)
  const themeHead = stats.perTheme.map((t) => `${t.number}. ${t.name}`)
  const themeRow = (label: string, status: Status, pick: (c: Counts) => number) =>
    [{ v: label, s: status } as CellInput, ...stats.perTheme.map((t) => ({ v: pick(t.counts), s: status }) as CellInput)]
  return {
    name: 'Synthèse',
    widths: [30, 36, 46, 12, 9, 7, 7, 7, 7, 20, ...stats.perTheme.slice(1).map(() => 12)],
    rows: [
      title('Synthèse de l’audit RGAA 4.1.2'),
      [],
      [{ v: 'Taux d’accessibilité (moyenne des pages)', s: 'head' }, { v: stats.perPage.some((p) => isProvisional(p.counts)) ? `${pct(stats.averageRate)} (${PROVISIONAL_FR})` : pct(stats.averageRate), s: 'crit' }],
      [{ v: 'Critères respectés sur l’ensemble de l’échantillon', s: 'head' }, { v: withProvisional(pct(stats.sampleRate), stats.sampleCounts), s: 'crit' }],
      [{ v: 'Pages auditées', s: 'head' }, pages.length],
      [],
      title('Synthèse par page'),
      head(['Page', 'Titre', 'URL', 'Thématiques', 'Images', 'C', 'NC', 'NA', 'NT', 'Critères respectés', 'À confirmer', 'Couverture partielle']),
      ...stats.perPage.map((p) => [
        p.label,
        { v: p.title, s: 'wrap' as const },
        { v: p.url, s: 'wrap' as const },
        p.themes.join(', '),
        p.images,
        { v: p.counts.C, s: 'C' as const },
        { v: p.counts.NC, s: 'NC' as const },
        { v: p.counts.NA, s: 'NA' as const },
        { v: p.counts.NT, s: 'NT' as const },
        { v: withProvisional(pct(p.rate), p.counts), s: 'crit' as const },
        p.counts.suggested,
        p.counts.partial,
      ]),
      [],
      title('Synthèse par thématiques et par statuts (échantillon)'),
      head(['Statut', ...themeHead]),
      themeRow('C – Conforme', 'C', (c) => c.C),
      themeRow('NC – Non conforme', 'NC', (c) => c.NC),
      themeRow('NA – Non applicable', 'NA', (c) => c.NA),
      themeRow('NT – Non testé', 'NT', (c) => c.NT),
      themeRow('dont suggestion automatique à confirmer', 'NT', (c) => c.suggested),
      themeRow('Couverture partielle (tests non évalués)', 'NT', (c) => c.partial),
      [{ v: 'Critères respectés', s: 'head' }, ...stats.perTheme.map((t) => ({ v: withProvisional(pct(t.rate), t.counts), s: 'crit' }) as CellInput)],
      [],
      [{ v: 'Pourcentage = C / (C + NC). Les critères NA et NT sont exclus du calcul. Un pré-remplissage automatique n’est pas une validation : tant que l’auditeur ne l’a pas confirmé, le critère reste NT.', s: 'default' }],
      [{ v: PROVISIONAL_NOTE_FR, s: 'default' }],
    ],
  }
}

/** The "Résultats" dashboard of the official audit workbook, as tables. */
export function resultsSheet(pages: PageInput[]): Sheet {
  const stats = auditStats(pages)
  const lv = levelStats(stats)
  const row = (label: string, c: Counts): CellInput[] => [
    { v: label, s: 'crit' },
    { v: withProvisional(pct2(rateExact(c)), c), s: 'C' },
    { v: c.C + c.NC ? pct2((c.NC / (c.C + c.NC)) * 100) : '—', s: 'NC' },
  ]
  const counts = (label: string, c: Counts): CellInput[] => [{ v: label, s: 'crit' }, c.C, c.NC]
  return {
    name: 'Résultats',
    widths: [30, 44, 10, 10, 10, 14],
    rows: [
      title('Tableau de bord audit RGAA 4'),
      [],
      head(['Conformité RGAA 4', 'C', 'NC']),
      row('A', lv.perLevel.A),
      row('AA (Légal)', lv.legal),
      row('AAA', lv.perLevel.AAA),
      ['Les résultats ci-dessus représentent le niveau de conformité global tel qu’il doit être reporté dans la déclaration de conformité. Le niveau de référence est le niveau légal AA. Pour qu’un site soit déclaré conforme au RGAA, ce niveau doit être de 100 %.'],
      [],
      head(['Conformité pour chaque niveau', 'C', 'NC']),
      row('A', lv.perLevel.A),
      row('AA', lv.perLevel.AA),
      row('AAA', lv.perLevel.AAA),
      [],
      head(['Résultats par niveau', 'C', 'NC']),
      counts('A', lv.perLevel.A),
      counts('AA', lv.perLevel.AA),
      counts('AAA', lv.perLevel.AAA),
      [{ v: 'Total', s: 'head' }, lv.perLevel.A.C + lv.perLevel.AA.C + lv.perLevel.AAA.C, lv.perLevel.A.NC + lv.perLevel.AA.NC + lv.perLevel.AAA.NC],
      [],
      head(['Résultats par page', 'Titre', 'C', 'NC', 'NA', '% C']),
      ...lv.pages.map((p) => [
        { v: p.label, s: 'crit' as const },
        { v: p.title, s: 'wrap' as const },
        { v: p.counts.C, s: 'C' as const },
        { v: p.counts.NC, s: 'NC' as const },
        { v: p.counts.NA, s: 'NA' as const },
        { v: withProvisional(pct2(p.rate), p.counts), s: 'crit' as const },
      ]),
      [],
      head(['Résultats : moyennes', '', '', '', '', '']),
      [{ v: 'Moyenne', s: 'crit' }, '', '', '', '', lv.averageProvisional && lv.average !== null ? `${pct2(lv.average)} (${PROVISIONAL_FR})` : pct2(lv.average)],
      [{ v: 'Meilleure page', s: 'crit' }, lv.best?.label ?? '', '', '', '', pct2(lv.best?.rate ?? null)],
      [{ v: 'Plus mauvaise page', s: 'crit' }, lv.worst?.label ?? '', '', '', '', pct2(lv.worst?.rate ?? null)],
      [],
      title('Calcul de la conformité'),
      ['La conformité globale est calculée de la manière suivante : C / (C + NC) où C est le nombre de critères conformes et NC le nombre de critères non conformes. C’est ce nombre qui est la référence légale, il représente le taux de conformité de l’échantillon.'],
      ['Les niveaux A / AA / AAA sont déduits des critères WCAG référencés par chaque critère RGAA.'],
      [PROVISIONAL_NOTE_FR],
    ],
  }
}

export function criteriaSheet(pages: PageInput[]): Sheet {
  const stats = auditStats(pages)
  const rows: CellInput[][] = [
    title('Critères par page'),
    [],
    head(['Thématique', 'Critère', 'Recommandation', ...pages.map((p) => p.label), 'Échantillon']),
  ]
  const perPage = pages.map(flat)
  let lastTheme = 0
  stats.sampleCriteria.forEach((c, i) => {
    rows.push([
      { v: c.theme !== lastTheme ? (THEME_LABEL[c.theme] ?? '').toUpperCase() : '', s: 'crit' },
      { v: c.id, s: 'crit' },
      { v: c.title, s: 'wrap' },
      ...perPage.map((f) => {
        const st = statusOf(f[i].c)
        return { v: st, s: st } as CellInput
      }),
      { v: c.status, s: c.status },
    ])
    lastTheme = c.theme
  })
  return { name: 'Critères', widths: [20, 9, 70, ...pages.map(() => 7), 13], rows, freezeRow: 3 }
}

/** Evidence lines added to the "modifications" column: partial coverage, pending suggestion, conflicting evidence. */
function evidenceNotes(criterion: CriterionResult): string[] {
  const out: string[] = []
  if (criterion.coverage === 'partial') out.push(`Couverture partielle : ${criterion.unassessedTests} test(s) sur ${(criterion.assessedTests ?? 0) + (criterion.unassessedTests ?? 0)} non évalué(s) par RGAA Assistant (à vérifier à la main).`)
  if (criterion.suggested) {
    const word = { c: 'conforme', nc: 'non conforme', na: 'non applicable' }[criterion.suggested]
    out.push(`Suggestion automatique : ${word}, à confirmer par l’auditeur.`)
  }
  if (criterion.unconfirmed && !criterion.suggested) out.push('Repose sur un pré-remplissage automatique non confirmé.')
  for (const c of criterion.conflicts ?? []) out.push(`Résultats contradictoires : ${c}.`)
  return out
}

function modifications(theme: ThemeResult, criterion: CriterionResult, page: PageInput): string {
  const base = modificationsText(theme, criterion, page)
  if (!theme.selected) return base
  return [base, ...evidenceNotes(criterion)].filter(Boolean).join('\n')
}

function modificationsText(theme: ThemeResult, criterion: CriterionResult, page: PageInput): string {
  if (!theme.selected) return 'Thématique non auditée sur cette page.'
  if (theme.number === 1) {
    const ids = [...new Set(criterion.tests.flatMap((t) => t.nc))].sort((a, b) => a - b)
    if (!ids.length) {
      if (criterion.outcome === 'unassessed') return 'Non évalué par RGAA Assistant (CAPTCHA / images-test).'
      if (criterion.outcome === 'pending') return 'Relecture en cours : des images restent à vérifier.'
      return ''
    }
    return ids
      .map((id) => {
        const el = page.images.find((e) => e.id === id)
        if (!el) return `#${id}`
        const note = page.reviewOf(el)?.note.trim()
        return `#${id} (${fileOf(el)})${note ? ` : ${note}` : ' : à corriger'}`
      })
      .join('\n')
  }
  if (criterion.ncRefs?.length) return criterion.ncRefs.map((r) => `#${r.id} ${r.label}${r.note ? ` : ${r.note}` : ' : à corriger'}`).join('\n')
  const answer = page.checklist[criterion.id]
  if (criterion.outcome === 'pending') return 'À vérifier.'
  return answer?.note?.trim() ?? ''
}

/** One page, laid out like the official RGAA grid sheet (P01…): every criterion of every theme. */
export function gridSheet(page: PageInput): Sheet {
  const rows: CellInput[][] = [
    title('RGAA 4.1.2 – GRILLE D’ÉVALUATION'),
    [`${page.pageTitle} : ${page.pageUrl}`],
    head(['Thématique', 'Critère', 'Recommandation', 'Statut', 'Dérogation', 'Modifications à apporter', 'Commentaires en cas de dérogations']),
  ]
  for (const theme of page.themes) {
    theme.criteria.forEach((c, i) => {
      const status = statusOf(c)
      rows.push([
        { v: i === 0 ? theme.name.toUpperCase() : '', s: 'crit' },
        { v: c.id, s: 'crit' },
        { v: c.title, s: 'wrap' },
        { v: status, s: status },
        { v: 'N', s: 'NA' },
        { v: modifications(theme, c, page), s: 'wrap' },
        { v: '', s: 'wrap' },
      ])
    })
  }
  return {
    name: page.label,
    widths: [20, 9, 70, 10, 13, 60, 40],
    rows,
    statusValidation: `D4:D${rows.length}`,
    freezeRow: 3,
  }
}

export function testsSheet(pages: PageInput[]): Sheet {
  const rows: CellInput[][] = [
    title('Détail par test – thématique Images (1)'),
    [],
    head(['Page', 'Critère', 'Test', 'Intitulé du test', 'Éléments concernés', 'Résultat', 'Images', 'Remarque']),
  ]
  for (const page of pages) {
    if (!page.themes[0]?.selected) continue
    for (const c of page.results.criteria) {
      for (const t of c.tests) {
        const status = STATUS[t.outcome]
        rows.push([
          { v: page.label, s: 'crit' },
          { v: c.id, s: 'crit' },
          { v: t.id, s: 'crit' },
          { v: t.text.replace(/`/g, ''), s: 'wrap' },
          { v: t.scope ? t.scope.map((x) => `<${x}>`).join(' ') : '—', s: 'wrap' },
          { v: `${status} – ${OUTCOME_LABEL[t.outcome]}`, s: status },
          { v: t.imageIds.map((i) => `#${i}`).join(' '), s: 'wrap' },
          { v: t.nc.length ? `Non conforme : ${t.nc.map((i) => `#${i}`).join(' ')}. ${t.reason}` : t.reason, s: 'wrap' },
        ])
      }
    }
  }
  return { name: 'Détail par test (Images)', widths: [7, 9, 9, 70, 22, 22, 18, 50], rows, freezeRow: 3 }
}

export function imagesSheet(pages: PageInput[]): Sheet {
  const rows: CellInput[][] = [
    title('Détail par image'),
    [],
    head(['Page', 'N°', 'Aperçu', 'Type', 'Fichier / source', 'Constat automatique', 'Nom accessible', 'Code HTML', 'Nature (auditeur)', ...CRITERIA_FOR_IMAGES, 'Remarque']),
  ]
  pages.forEach((page, pageIndex) => {
    for (const el of page.images) {
      const review = page.reviewOf(el)
      const kind = review?.kind === 'informative' ? 'Informative' : review?.kind === 'decorative' ? 'Décorative' : 'Non renseignée'
      const verdicts = CRITERIA_FOR_IMAGES.map((id) => {
        const applies = (id === '1.2') === (review?.kind === 'decorative')
        const v = review?.kind && applies ? review.answers[id] : undefined
        const s = v ? (v.toUpperCase() as 'C' | 'NC' | 'NA') : review?.kind && applies ? 'NT' : null
        return s ? ({ v: s, s } as CellInput) : { v: '—', s: 'default' as const }
      })
      rows.push([
        { v: page.label, s: 'crit' },
        el.id,
        { v: '', s: 'wrap', image: el.thumb ?? undefined, imageId: thumbKey(pageIndex, el.id) },
        `${el.type}${el.inDialog ? ' (popin)' : ''}`,
        { v: el.src && !el.src.startsWith('data:') ? el.src : '(graphique intégré)', s: 'wrap' },
        { v: DETECTED_FR[page.detectedOf(el)] + (el.ignoredBy ? ` (${el.ignoredBy})` : ''), s: 'wrap' },
        { v: el.accessibleName ?? '', s: 'wrap' },
        { v: el.html, s: 'code' },
        kind + (review?.auto ? ' (pré-remplie)' : ''),
        ...verdicts,
        { v: review?.note ?? '', s: 'wrap' },
      ])
    }
  })
  return { name: 'Détail par image', widths: [7, 6, 13, 14, 40, 30, 30, 50, 22, 7, 7, 7, 7, 7, 7, 7, 45], rows, freezeRow: 3 }
}

export function manualSheet(pages: PageInput[]): Sheet {
  const rows: CellInput[][] = [title('Contrôles manuels (clavier, zoom, lecteur d’écran…)'), [], head(['Page', 'Groupe', 'Contrôle', 'Critères RGAA concernés', 'Résultat', 'Remarque'])]
  for (const page of pages) {
    for (const c of MANUAL_CHECKS) {
      const a = page.manualChecks?.[c.id]
      rows.push([
        { v: page.label, s: 'crit' },
        { v: tFr(c.group), s: 'wrap' },
        { v: tFr(c.text), s: 'wrap' },
        c.criteria.join(', '),
        a ? (a.state === 'ok' ? { v: 'OK', s: 'C' as const } : { v: 'Problème', s: 'NC' as const }) : { v: 'À faire', s: 'default' as const },
        { v: a?.note ?? '', s: 'wrap' },
      ])
    }
  }
  return { name: 'Contrôles manuels', widths: [7, 18, 70, 18, 11, 50], rows, freezeRow: 3 }
}

export function findingsSheet(pages: PageInput[]): Sheet {
  const rows: CellInput[][] = [
    title('Détail des éléments – cadres, couleurs, liens et structure'),
    [],
    head(['Page', 'Thème', 'N°', 'Aperçu', 'Type', 'Constat', 'Détails', 'Critère', 'Statut', 'Remarque']),
  ]
  const criteriaOf = (f: FindingItem) => findingCriteriaOf(f).map((c) => c.id)
  pages.forEach((page, pageIndex) => {
    for (const f of page.findings) {
      const review = page.findingReviews[f.key]
      for (const c of criteriaOf(f)) {
        const v = review?.answers[c]
        const st: Status = v ? (v.toUpperCase() as Status) : 'NT'
        rows.push([
          { v: page.label, s: 'crit' },
          f.theme,
          f.id,
          { v: '', s: 'wrap', image: f.shot ?? undefined, imageId: thumbKey(pageIndex, 50000 + f.theme * 1000 + f.id) },
          f.type,
          { v: f.label, s: 'wrap' },
          { v: Object.entries(f.facts).filter(([, val]) => val).map(([k, val]) => `${k}: ${val}`).join('\n'), s: 'wrap' },
          { v: c, s: 'crit' },
          { v: st, s: st },
          { v: review?.note ?? '', s: 'wrap' },
        ])
      }
    }
  })
  return { name: 'Détail cadres et couleurs', widths: [7, 7, 6, 14, 14, 40, 60, 9, 9, 40], rows, freezeRow: 3 }
}

/** The sheets of one page: what the "Page results" view shows. */
export const pageSheets = (page: PageInput): Sheet[] => [gridSheet(page), summarySheet([page]), testsSheet([page]), imagesSheet([page]), ...(page.findings.length ? [findingsSheet([page])] : []), ...(page.manualChecks && Object.keys(page.manualChecks).length ? [manualSheet([page])] : [])]

/** The sheets of the whole audit: what the "Audit" view shows and the .xlsx contains. */
export const auditSheets = (pages: PageInput[], meta: AuditMeta): Sheet[] => [
  sampleSheet(pages, meta),
  criteriaSheet(pages),
  resultsSheet(pages),
  summarySheet(pages),
  ...pages.map(gridSheet),
  testsSheet(pages),
  imagesSheet(pages),
  ...(pages.some((p) => p.findings.length) ? [findingsSheet(pages)] : []),
  ...(pages.some((p) => p.manualChecks && Object.keys(p.manualChecks).length) ? [manualSheet(pages)] : []),
]

/** Embeds the image previews (when available) and writes the .xlsx. */
export function buildWorkbook(sheets: Sheet[], thumbs: Map<number, Thumb> = new Map()): Uint8Array {
  for (const sheet of sheets) {
    sheet.rows.forEach((row, ri) => {
      row.forEach((cell, ci) => {
        if (!cell || typeof cell !== 'object' || cell.imageId === undefined) return
        const thumb = thumbs.get(cell.imageId)
        if (!thumb) return
        ;(sheet.images ??= []).push({ row: ri, col: ci, png: thumb.png, width: thumb.width, height: thumb.height, label: 'Aperçu de l’image' })
        ;(sheet.rowHeights ??= {})[ri] = ROW_PT
      })
    })
  }
  return buildXlsx(sheets)
}
