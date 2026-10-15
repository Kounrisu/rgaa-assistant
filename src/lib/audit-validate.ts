/**
 * Hand-written validators for an audit read from a file or from the browser storage.
 * They take `unknown` and either return (the data has the shape of an Audit) or throw an AuditFormatError
 * with a code the panel can translate and a path telling where the problem is.
 */
import type { Audit } from './types'
import { MAX_SNAPSHOT_BASE64, MAX_SNAPSHOT_BYTES } from './snapshot'

export const CURRENT_VERSION = 6
/** Versions this code knows how to migrate (explicitly, see migrate() in audit-store.ts). */
export const SUPPORTED_VERSIONS: readonly number[] = [2, 3, 4, 5, 6]

/** Largest audit file accepted (bytes of the text). Checked on file.size before reading, then on the text. */
export const MAX_IMPORT_BYTES = 100 * 1024 * 1024
const MAX_PAGES = 1000
const MAX_ITEMS = 50000
const MAX_ID_LENGTH = 200

export type AuditErrorCode =
  /** The text is not JSON. */
  | 'not-json'
  /** It is JSON but not one of our files. */
  | 'not-audit'
  /** Written by a version of the extension newer (or older than any we can read) than this one. */
  | 'unsupported-version'
  | 'too-large'
  /** The structure is wrong somewhere: `path` tells where. */
  | 'invalid'
  /** A saved audit in the browser storage cannot be read. */
  | 'storage-corrupt'

export class AuditFormatError extends Error {
  constructor(
    readonly code: AuditErrorCode,
    /** Where in the audit (e.g. pages[2].reviews.img-4.answers.1.1), for the technical detail. */
    readonly path = '',
    readonly detail = '',
  ) {
    super(`${code}${path ? ` at ${path}` : ''}${detail ? `: ${detail}` : ''}`)
    this.name = 'AuditFormatError'
  }
}

type Rec = Record<string, unknown>
export const isRecord = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v)

const bad = (path: string, detail: string): never => {
  throw new AuditFormatError('invalid', path, detail)
}

const num = (v: unknown, path: string): void => {
  if (typeof v !== 'number' || !Number.isFinite(v)) bad(path, 'a number is expected')
}
const int = (v: unknown, path: string): void => {
  if (typeof v !== 'number' || !Number.isInteger(v)) bad(path, 'an integer is expected')
}
const str = (v: unknown, path: string): void => {
  if (typeof v !== 'string') bad(path, 'a text is expected')
}
const bool = (v: unknown, path: string): void => {
  if (typeof v !== 'boolean') bad(path, 'true or false is expected')
}
const optional = (v: unknown, check: (v: unknown, path: string) => void, path: string): void => {
  if (v !== undefined) check(v, path)
}
const nullable = (check: (v: unknown, path: string) => void) => (v: unknown, path: string): void => {
  if (v !== null) check(v, path)
}
const oneOf = (values: readonly string[]) => (v: unknown, path: string): void => {
  if (typeof v !== 'string' || !values.includes(v)) bad(path, `one of ${values.join(', ')} is expected`)
}
const array = (v: unknown, path: string, each: (item: unknown, path: string) => void, max = MAX_ITEMS): void => {
  if (!Array.isArray(v)) return bad(path, 'a list is expected')
  if (v.length > max) bad(path, 'too many entries')
  v.forEach((x, i) => each(x, `${path}[${i}]`))
}
const record = (v: unknown, path: string, each: (item: unknown, path: string) => void): void => {
  if (!isRecord(v)) return bad(path, 'an object is expected')
  for (const [k, x] of Object.entries(v)) each(x, `${path}.${k}`)
}
const strings = (v: unknown, path: string): void => array(v, path, str)

export const isVerdict = (v: unknown): v is 'c' | 'nc' | 'na' => v === 'c' || v === 'nc' || v === 'na'
const verdict = oneOf(['c', 'nc', 'na'])

function review(v: unknown, path: string): void {
  if (!isRecord(v)) return bad(path, 'an object is expected')
  record(v.answers, `${path}.answers`, verdict)
  str(v.note, `${path}.note`)
  optional(v.kind, oneOf(['informative', 'decorative']), `${path}.kind`)
  optional(v.auto, bool, `${path}.auto`)
  optional(v.pendingAnswers, (a, p) => array(a, p, str), `${path}.pendingAnswers`)
  for (const k of ['fg', 'bg', 'autoNote']) optional(v[k], str, `${path}.${k}`)
}

function checklistAnswer(v: unknown, path: string): void {
  if (!isRecord(v)) return bad(path, 'an object is expected')
  optional(v.verdict, verdict, `${path}.verdict`)
  str(v.note, `${path}.note`)
  optional(v.source, str, `${path}.source`)
  optional(v.manualTests, bool, `${path}.manualTests`)
  optional(v.coverageAt, num, `${path}.coverageAt`)
  optional(
    v.autoResults,
    (r, p) =>
      record(r, p, (x, xp) => {
        if (!isRecord(x)) return bad(xp, 'an object is expected')
        oneOf(['pass', 'fail'])(x.result, `${xp}.result`)
        strings(x.rules, `${xp}.rules`)
        optional(x.details, strings, `${xp}.details`)
      }),
    `${path}.autoResults`,
  )
}

const NULLABLE_TEXT = ['src', 'thumb', 'shot', 'alt', 'ariaLabel', 'labelledByText', 'title', 'svgTitle', 'accessibleName', 'ignoredBy', 'role', 'nearbyText', 'linkHref', 'linkText', 'figcaption']

function item(v: unknown, path: string): void {
  if (!isRecord(v)) return bad(path, 'an object is expected')
  num(v.id, `${path}.id`)
  for (const k of ['key', 'tag', 'type', 'html', 'contextHtml']) str(v[k], `${path}.${k}`)
  bool(v.present, `${path}.present`)
  num(v.scan, `${path}.scan`)
  for (const k of NULLABLE_TEXT) optional(v[k], nullable(str), `${path}.${k}`)
  for (const k of ['ariaHidden', 'inDialog', 'isInsideLink']) optional(v[k], bool, `${path}.${k}`)
  for (const k of ['naturalWidth', 'naturalHeight']) optional(v[k], num, `${path}.${k}`)
  optional(v.deterministic, (d, p) => record(d, p, bool), `${path}.deterministic`)
}

function finding(v: unknown, path: string): void {
  if (!isRecord(v)) return bad(path, 'an object is expected')
  num(v.id, `${path}.id`)
  int(v.theme, `${path}.theme`)
  for (const k of ['key', 'type', 'label', 'summary', 'html', 'contextHtml']) str(v[k], `${path}.${k}`)
  bool(v.present, `${path}.present`)
  num(v.scan, `${path}.scan`)
  num(v.count, `${path}.count`)
  if (!isRecord(v.facts)) bad(`${path}.facts`, 'an object is expected')
  if (!isRecord(v.data)) bad(`${path}.data`, 'an object is expected')
  optional(v.shot, nullable(str), `${path}.shot`)
}

function snapshot(v: unknown, path: string): void {
  if (!isRecord(v)) return bad(path, 'an object is expected')
  num(v.at, `${path}.at`)
  str(v.url, `${path}.url`)
  str(v.title, `${path}.title`)
  num(v.bytes, `${path}.bytes`)
  str(v.gz, `${path}.gz`)
  if ((v.bytes as number) > MAX_SNAPSHOT_BYTES || (v.gz as string).length > MAX_SNAPSHOT_BASE64) throw new AuditFormatError('too-large', path, 'page snapshot too large')
}

function htmlCheck(v: unknown, path: string): void {
  if (!isRecord(v)) return bad(path, 'an object is expected')
  num(v.at, `${path}.at`)
  num(v.errors, `${path}.errors`)
  array(v.groups, `${path}.groups`, (g, gp) => {
    if (!isRecord(g)) return bad(gp, 'an object is expected')
    str(g.rule, `${gp}.rule`)
    num(g.count, `${gp}.count`)
    str(g.message, `${gp}.message`)
    array(g.examples, `${gp}.examples`, (e, ep) => {
      if (!isRecord(e)) return bad(ep, 'an object is expected')
      str(e.rule, `${ep}.rule`)
      str(e.message, `${ep}.message`)
      num(e.line, `${ep}.line`)
      num(e.column, `${ep}.column`)
      nullable(str)(e.selector, `${ep}.selector`)
    })
  })
}

function importReport(v: unknown, path: string): void {
  if (!isRecord(v)) return bad(path, 'an object is expected')
  str(v.tool, `${path}.tool`)
  num(v.at, `${path}.at`)
  str(v.url, `${path}.url`)
  for (const k of ['set', 'noted', 'incomplete', 'passes']) num(v[k], `${path}.${k}`)
  for (const k of ['conflicts', 'unmatched', 'unmapped']) strings(v[k], `${path}.${k}`)
  optional(
    v.items,
    (a, p) =>
      array(a, p, (x, xp) => {
        if (!isRecord(x)) return bad(xp, 'an object is expected')
        str(x.criterion, `${xp}.criterion`)
        str(x.rule, `${xp}.rule`)
        oneOf(['nc', 'na', 'note', 'pass'])(x.result, `${xp}.result`)
        str(x.text, `${xp}.text`)
      }),
    `${path}.items`,
  )
}

function page(v: unknown, path: string): void {
  if (!isRecord(v)) return bad(path, 'an object is expected')
  if (typeof v.id !== 'string' || !/^P\d{2,}$/.test(v.id)) bad(`${path}.id`, 'an identifier like P01 is expected')
  str(v.url, `${path}.url`)
  str(v.title, `${path}.title`)
  for (const k of ['scanCount', 'nextId', 'updatedAt', 'nextFindingId']) num(v[k], `${path}.${k}`)
  array(v.items, `${path}.items`, item)
  record(v.reviews, `${path}.reviews`, review)
  array(v.themes, `${path}.themes`, int, 50)
  record(v.checklist, `${path}.checklist`, checklistAnswer)
  array(v.findings, `${path}.findings`, finding)
  record(v.findingReviews, `${path}.findingReviews`, review)
  array(v.scannedThemes, `${path}.scannedThemes`, int, 50)
  optional(v.urlHistory, (rows, p) => array(rows, p, (row, rp) => {
    if (!isRecord(row)) return bad(rp, 'an object is expected')
    str(row.url, `${rp}.url`)
    num(row.at, `${rp}.at`)
  }), `${path}.urlHistory`)
  record(v.nextFindingIds, `${path}.nextFindingIds`, num)
  optional(
    v.manualChecks,
    (m, p) =>
      record(m, p, (x, xp) => {
        if (!isRecord(x)) return bad(xp, 'an object is expected')
        oneOf(['ok', 'issue'])(x.state, `${xp}.state`)
        str(x.note, `${xp}.note`)
        optional(x.criterion, str, `${xp}.criterion`)
      }),
    `${path}.manualChecks`,
  )
  optional(v.automaticRun, (r, p) => {
    if (!isRecord(r)) return bad(p, 'an object is expected')
    oneOf(['running', 'complete', 'partial', 'failed'])(r.status, `${p}.status`)
    num(r.startedAt, `${p}.startedAt`)
    str(r.url, `${p}.url`)
    optional(r.finishedAt, num, `${p}.finishedAt`)
    optional(r.error, str, `${p}.error`)
  }, `${path}.automaticRun`)
  optional(v.imports, (a, p) => array(a, p, importReport, 1000), `${path}.imports`)
  optional(v.snapshot, snapshot, `${path}.snapshot`)
  optional(v.htmlCheck, htmlCheck, `${path}.htmlCheck`)
}

/** Throws unless `v` is a complete, current (v6) audit. */
export function validateAudit(v: unknown): asserts v is Audit {
  if (!isRecord(v)) return bad('audit', 'an object is expected')
  if (v.version !== CURRENT_VERSION) bad('version', `version ${CURRENT_VERSION} is expected after migration`)
  if (typeof v.id !== 'string' || !v.id || v.id.length > MAX_ID_LENGTH) bad('id', 'a non-empty identifier is expected')
  str(v.name, 'name')
  optional(v.storageToken, str, 'storageToken')
  num(v.createdAt, 'createdAt')
  num(v.updatedAt, 'updatedAt')
  optional(v.exportedAt, num, 'exportedAt')
  if (!isRecord(v.meta)) bad('meta', 'an object is expected')
  else {
    for (const k of ['site', 'auditor', 'context']) str(v.meta[k], `meta.${k}`)
    if (v.meta.level !== undefined && !['rapide', 'complementaire', 'complet'].includes(v.meta.level as string)) bad('meta.level', 'rapide, complementaire or complet is expected')
  }
  array(v.pages, 'pages', page, MAX_PAGES)
  const ids = new Set<string>()
  for (const p of v.pages as Rec[]) {
    if (ids.has(p.id as string)) bad('pages', `the page identifier ${String(p.id)} is used twice`)
    ids.add(p.id as string)
  }
  if (v.current !== null && typeof v.current !== 'string') bad('current', 'a page identifier or null is expected')
}

/**
 * The version of a raw audit, checked BEFORE any migration. A missing version is a v2 audit (the first versions
 * did not always write it). Throws unsupported-version for a future or unknown version, not-audit for a non-audit.
 */
export function readVersion(raw: unknown): number {
  if (!isRecord(raw) || !Array.isArray(raw.pages)) throw new AuditFormatError('not-audit')
  const version = raw.version === undefined ? 2 : raw.version
  if (typeof version !== 'number' || !SUPPORTED_VERSIONS.includes(version)) throw new AuditFormatError('unsupported-version', 'version', String(raw.version))
  return version
}
