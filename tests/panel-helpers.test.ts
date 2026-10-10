// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setLang } from '../src/lib/i18n'
import { emptyAudit } from '../src/lib/audit-store'
import type { Audit, ImageElementInfo } from '../src/lib/types'
import { auditFileName, auditTitle, fileName, formatHtml, hash, hostName, kb, keyOf, labelOf, pad, slugOf, tDyn } from '../src/panel/helpers'
import type { Item } from '../src/panel/types'

describe('panel helpers (pure functions moved out of panel.ts)', () => {
  beforeEach(() => setLang('en'))
  afterEach(() => {
    vi.useRealTimers()
    setLang('fr')
  })

  it('hash is a stable FNV-1a fingerprint in base 36', () => {
    expect(hash('')).toBe((2166136261).toString(36))
    expect(hash('abc')).toBe(hash('abc'))
    expect(hash('abc')).not.toBe(hash('abd'))
    expect(hash('<img src="a.png">')).toMatch(/^[0-9a-z]+$/)
  })

  it('keyOf identifies an image by its source, or by its markup when the source is a data: URL', () => {
    const base = { type: 'img', src: 'https://x.test/a.png', html: '<img>', contextHtml: '<p><img></p>' } as ImageElementInfo
    expect(keyOf(base)).toBe(`img|https://x.test/a.png|${hash('<p><img></p>')}`)
    expect(keyOf({ ...base, src: 'data:image/png;base64,AAAA' })).toBe(`img|${hash('<img>')}|${hash('<p><img></p>')}`)
    expect(keyOf({ ...base, src: '' })).toBe(`img|${hash('<img>')}|${hash('<p><img></p>')}`)
  })

  it('fileName decodes the last path segment and falls back to the raw text', () => {
    expect(fileName('https://x.test/img/logo%20bleu.png?v=2')).toBe('logo bleu.png')
    expect(fileName('https://x.test/')).toBe('https://x.test/')
    expect(fileName('not a url')).toBe('not a url')
  })

  it('labelOf shows the file name, or the tag for inline data', () => {
    expect(labelOf({ src: 'https://x.test/a/b.svg', type: 'img' } as Item)).toBe('b.svg')
    expect(labelOf({ src: 'data:image/png;base64,AA', type: 'svg' } as Item)).toBe('<svg>')
    expect(labelOf({ src: '', type: 'role-img' } as Item)).toBe('<role-img>')
  })

  it('slugOf makes a lower-case ASCII slug and never an empty one', () => {
    expect(slugOf('Mairie de Montréal — Été 2025')).toBe('mairie-de-montreal-ete-2025')
    expect(slugOf('  --Hello__World--  ')).toBe('hello-world')
    expect(slugOf('日本語')).toBe('audit')
    expect(slugOf('')).toBe('audit')
  })

  it('hostName drops www. and gives an empty string for a bad URL', () => {
    expect(hostName('https://www.example.org/page?x=1')).toBe('example.org')
    expect(hostName('http://127.0.0.1:4174/index.html')).toBe('127.0.0.1')
    expect(hostName('nope')).toBe('')
  })

  it('pad and kb', () => {
    expect(pad(3)).toBe('03')
    expect(pad(12)).toBe('12')
    expect(kb(0)).toBe('1 KB')
    expect(kb(1536)).toBe('2 KB')
    expect(kb(10 * 1024)).toBe('10 KB')
  })

  it('auditTitle falls back to the untitled name', () => {
    expect(auditTitle({ name: 'Mon audit' })).toBe('Mon audit')
    expect(auditTitle({ name: '' })).toBe('Untitled audit')
    setLang('fr')
    expect(auditTitle({ name: '' })).toBe('Audit sans titre')
  })

  it('auditFileName: site_audit-name_date.rgaa.json, without repeating the site', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-04T10:00:00Z'))
    const audit = (name: string, site: string): Audit => ({ ...emptyAudit(name), meta: { ...emptyAudit().meta, site } })
    expect(auditFileName(audit('Audit de printemps', 'Mairie Test'))).toBe('mairie-test_audit-de-printemps_2026-03-04.rgaa.json')
    expect(auditFileName(audit('Mairie Test 2026', 'Mairie Test'))).toBe('mairie-test_2026-03-04.rgaa.json')
    expect(auditFileName(audit('', ''))).toBe('2026-03-04.rgaa.json')
  })

  describe('tDyn: scan texts (stored in English) are translated when shown', () => {
    const cases: [string, string][] = [
      ['3 text element(s) · 2 colour pair(s)', '3 text element(s) · 2 colour pair(s)'],
      ['#111111 on #FFFFFF · 18.88:1 (needs 4.5:1)', '#111111 on #FFFFFF · 18.88:1 (needs 4.5:1)'],
      ['4.5:1 (normal text)', '4.5:1 (normal text)'],
      ['2 other element(s)', '2 other element(s)'],
      ['16px bold', '16 px bold'],
      ['16px', '16 px'],
      ['<iframe> without title', '<iframe> without title'],
      ['2 h1', '2 h1'],
      ['h3 (empty)', 'h3 (empty)'],
      ['h4 · jump from h2', 'h4 · jump from h2'],
      ['<input> without label', '<input> without label'],
      ['table 3×4', 'table 3×4'],
      ['3 rows × 4 columns · 1 header cell(s)', '3 rows × 4 columns · 1 header cell(s)'],
      ['<a> without name', '<a> without name'],
      ['rgb(1, 2, 3) — cannot be computed', 'rgb(1, 2, 3) — cannot be computed'],
      ['anything else', 'anything else'],
    ]
    for (const [input, english] of cases) it(`English: ${input}`, () => expect(tDyn(input)).toBe(english))

    it('French: the numbers and colours are kept inside the translated sentence', () => {
      setLang('fr')
      const out = tDyn('#111111 on #FFFFFF · 18.88:1 (needs 4.5:1)')
      expect(out).toContain('#111111')
      expect(out).toContain('18.88:1')
      expect(out).not.toBe('#111111 on #FFFFFF · 18.88:1 (needs 4.5:1)')
      expect(tDyn('2 h1')).toContain('2')
    })
  })

  describe('formatHtml: one tag or text per line, indented by depth', () => {
    it('indents children and keeps void tags flat', () => {
      expect(formatHtml('<div><p>Hello <b>you</b></p><img src="a.png"><br></div>')).toEqual([
        '<div>',
        '  <p>',
        '    Hello',
        '    <b>',
        '      you',
        '    </b>',
        '  </p>',
        '  <img src="a.png">',
        '  <br>',
        '</div>',
      ])
    })
    it('keeps comments, drops blank text and never indents below zero', () => {
      expect(formatHtml('</x><!-- note -->  \n  <i/>')).toEqual(['</x>', '<!-- note -->', '<i/>'])
    })
  })
})
