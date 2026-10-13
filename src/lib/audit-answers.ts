/**
 * The answers file of the LLM round trip: one JSON object per line, as written in `answers-template.jsonl` of an audit pack.
 * Strict on purpose (the file comes from a model or from a colleague, never trust it): unknown fields are dropped, bad rows are
 * reported with their line number and never guessed. Nothing is applied here: this is only the reading.
 */
export type AnswerVerdict = 'c' | 'nc' | 'na' | 'unsure'
export type AnswerConfidence = 'low' | 'medium' | 'high'
export type AnswerScope = 'element' | 'page' | 'sample'

export interface AnswerRow {
  pack: string
  page: string
  scope: AnswerScope
  element?: string
  criterion: string
  verdict: AnswerVerdict
  confidence?: AnswerConfidence
  reason: string
  evidence: string[]
  model: string
  promptVersion: string
}
export interface AnswerError { line: number; message: string }
export interface ParsedAnswers { rows: AnswerRow[]; errors: AnswerError[] }

export const MAX_ANSWERS_BYTES = 8_000_000
export const MAX_ANSWER_ROWS = 20_000
const MAX_REASON = 2000

const VERDICTS: AnswerVerdict[] = ['c', 'nc', 'na', 'unsure']
const CONFIDENCES: AnswerConfidence[] = ['low', 'medium', 'high']
const SCOPES: AnswerScope[] = ['element', 'page', 'sample']
const CRITERION = /^\d{1,2}\.\d{1,2}$/
const PAGE = /^P\d{2,3}$/
const ELEMENT = /^(img|fnd)-[\w.-]{1,40}$/

const text = (v: unknown, max: number): string | null => (typeof v === 'string' && v.length <= max ? v : null)

export function parseAnswers(source: string): ParsedAnswers {
  const rows: AnswerRow[] = []
  const errors: AnswerError[] = []
  if (source.length > MAX_ANSWERS_BYTES) return { rows, errors: [{ line: 0, message: 'The file is too large.' }] }
  const lines = source.split(/\r?\n/)
  lines.forEach((raw, index) => {
    const line = index + 1
    if (!raw.trim()) return
    if (rows.length + errors.length >= MAX_ANSWER_ROWS) {
      if (errors.at(-1)?.message !== 'Too many rows: the rest is ignored.') errors.push({ line, message: 'Too many rows: the rest is ignored.' })
      return
    }
    let value: unknown
    try {
      value = JSON.parse(raw)
    } catch {
      return void errors.push({ line, message: 'Not valid JSON.' })
    }
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return void errors.push({ line, message: 'An object is expected.' })
    const v = value as Record<string, unknown>
    const pack = text(v.pack, 80)
    const page = typeof v.page === 'string' && PAGE.test(v.page) ? v.page : null
    const scope = SCOPES.find((s) => s === v.scope)
    const criterion = typeof v.criterion === 'string' && CRITERION.test(v.criterion) ? v.criterion : null
    const verdict = VERDICTS.find((x) => x === v.verdict)
    const reason = v.reason === undefined || v.reason === null ? '' : text(v.reason, MAX_REASON)
    if (!pack) return void errors.push({ line, message: 'pack is missing.' })
    if (!page) return void errors.push({ line, message: 'page must look like P01.' })
    if (!scope) return void errors.push({ line, message: 'scope must be element, page or sample.' })
    if (!criterion) return void errors.push({ line, message: 'criterion must look like 1.1.' })
    if (!verdict) return void errors.push({ line, message: 'verdict must be c, nc, na or unsure.' })
    if (reason === null) return void errors.push({ line, message: 'reason is too long.' })
    if ((verdict === 'nc' || verdict === 'unsure') && !reason.trim()) return void errors.push({ line, message: 'a reason is required for nc and unsure.' })
    let element: string | undefined
    if (scope === 'element') {
      if (typeof v.element !== 'string' || !ELEMENT.test(v.element)) return void errors.push({ line, message: 'an element id (img-… or fnd-…) is required for scope element.' })
      element = v.element
    }
    const confidence = CONFIDENCES.find((x) => x === v.confidence)
    const evidence = Array.isArray(v.evidence) ? v.evidence.filter((e): e is string => typeof e === 'string' && e.length <= 40).slice(0, 10) : []
    rows.push({
      pack,
      page,
      scope,
      ...(element ? { element } : {}),
      criterion,
      verdict,
      ...(confidence ? { confidence } : {}),
      reason: reason.trim(),
      evidence,
      model: text(v.model, 120) ?? '',
      promptVersion: text(v.prompt_version, 40) ?? '',
    })
  })
  return { rows, errors }
}
