import { describe, expect, it } from 'vitest'
import { unzipSync, strFromU8 } from 'fflate'
import { buildPack, cleanHtml } from '../src/lib/audit-pack'
import { parseAnswers } from '../src/lib/audit-answers'
import { sampleAudit } from './fakes'

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

function audit() {
  const a = sampleAudit('Pack')
  const page = a.pages[0]
  page.items[0].shot = PNG
  page.items[0].html = '<img alt="A"><script>steal(document.cookie)</script>'
  return a
}
const read = (zip: Uint8Array, path: string) => strFromU8(unzipSync(zip)[path])

describe('audit pack', () => {
  it('holds the code, the picture, the evidence and an answers template', () => {
    const pack = buildPack(audit(), { pictures: true, openOnly: false, now: Date.UTC(2026, 9, 13) })
    const files = unzipSync(pack.zip)
    expect(Object.keys(files)).toEqual(expect.arrayContaining(['README.md', 'manifest.json', 'criteria.json', 'answers-template.jsonl', 'pages/P01/page.json', 'pages/P01/elements.jsonl', 'pages/P01/pictures/img-1.png']))
    const lines = read(pack.zip, 'pages/P01/elements.jsonl').trim().split('\n').map((l) => JSON.parse(l))
    const image = lines.find((l) => l.id === 'img-1')
    expect(image.picture).toBe('pictures/img-1.png')
    expect(image.auditor.answers['1.1']).toBe('c')
    expect(image.html).not.toContain('steal(')
    expect(pack.summary.pictures).toBe(1)
  })

  it('can leave the pictures out', () => {
    const pack = buildPack(audit(), { pictures: false, openOnly: false })
    expect(Object.keys(unzipSync(pack.zip)).some((p) => p.includes('/pictures/'))).toBe(false)
    expect(pack.summary.pictures).toBe(0)
  })

  it('writes one empty line per open question, and the audit type limits them', () => {
    const complete = buildPack(audit(), { pictures: false, openOnly: false })
    const rows = read(complete.zip, 'answers-template.jsonl').trim().split('\n').map((l) => JSON.parse(l))
    expect(rows.length).toBe(complete.summary.openAnswers)
    expect(rows.every((r) => r.verdict === null && r.pack === complete.id)).toBe(true)
    const a = audit()
    a.meta.level = 'rapide'
    const quick = buildPack(a, { pictures: false, openOnly: false })
    const ids = new Set(read(quick.zip, 'answers-template.jsonl').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l).criterion))
    expect([...ids].every((id) => ['1.1', '3.1', '4.1', '4.10', '5.3', '5.7', '6.1', '6.2', '7.1', '7.3', '8.3', '8.4', '8.5', '9.1', '10.3', '10.6', '10.7', '11.1', '11.2', '11.5', '11.6', '11.9', '11.10', '12.8', '12.9'].includes(id))).toBe(true)
    expect(quick.summary.openAnswers).toBeLessThan(complete.summary.openAnswers)
  })

  it('cleans scripts and inline data from the code', () => {
    expect(cleanHtml('<p>a</p><script>x()</script><img src="data:image/png;base64,' + 'A'.repeat(300) + '">')).toBe('<p>a</p><script>…</script><img src="data:…(omitted)">')
  })
})

describe('answers file', () => {
  const good = '{"pack":"p1","page":"P01","scope":"element","element":"img-1","criterion":"1.3","verdict":"nc","confidence":"high","reason":"The alt says image","evidence":["html"],"model":"m","prompt_version":"1"}'
  it('reads valid rows and reports bad ones with their line', () => {
    const { rows, errors } = parseAnswers([
      good,
      '',
      '{"pack":"p1","page":"P01","scope":"page","criterion":"8.5","verdict":"c"}',
      '{"pack":"p1","page":"P01","scope":"page","criterion":"8.5","verdict":"maybe"}',
      '{"pack":"p1","page":"P01","scope":"element","criterion":"1.1","verdict":"c"}',
      '{"pack":"p1","page":"P01","scope":"page","criterion":"8.5","verdict":"nc"}',
      'not json',
    ].join('\n'))
    expect(rows.map((r) => r.criterion)).toEqual(['1.3', '8.5'])
    expect(rows[0]).toMatchObject({ element: 'img-1', verdict: 'nc', confidence: 'high', model: 'm', promptVersion: '1' })
    expect(errors.map((e) => e.line)).toEqual([4, 5, 6, 7])
  })
  it('drops unknown fields and refuses oversize reasons', () => {
    const row = JSON.parse(good)
    row.__proto__ = { admin: true }
    row.extra = 'x'
    const parsed = parseAnswers(JSON.stringify(row) + '\n' + JSON.stringify({ ...row, reason: 'x'.repeat(3000) }))
    expect(parsed.rows).toHaveLength(1)
    expect('extra' in parsed.rows[0]).toBe(false)
    expect(parsed.errors).toHaveLength(1)
  })
})
