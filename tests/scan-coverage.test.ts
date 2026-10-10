// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { computeCoverage, countOpenShadowRoots, noteCut, resetCuts } from '../src/content/scan-coverage'
import { setLang } from '../src/lib/i18n'
import { coverageLines, mergeCoverage } from '../src/lib/scan-coverage'

beforeEach(() => {
  setLang('en')
  resetCuts()
  document.body.innerHTML = ''
})

describe('scan coverage', () => {
  it('counts same-origin and cross-origin iframes', () => {
    document.body.innerHTML = '<iframe srcdoc="<p>a</p>"></iframe><iframe></iframe><iframe src="https://other.example/x"></iframe><iframe src="https://third.example/"></iframe>'
    const c = computeCoverage(document)
    expect(c.frames).toEqual({ total: 4, sameOrigin: 2, crossOrigin: 2 })
    expect(c.closedShadowRoots).toBe('unknown')
    expect(coverageLines(c).join(' | ')).toContain('4 iframe(s) (2 from another origin)')
  })
  it('treats a sandboxed srcdoc frame as inaccessible', () => {
    document.body.innerHTML = '<iframe srcdoc="x" sandbox></iframe><iframe srcdoc="x" sandbox="allow-same-origin"></iframe>'
    expect(computeCoverage(document).frames.crossOrigin).toBe(1)
  })
  it('counts open shadow roots, nested ones included, and ignores closed ones', () => {
    document.body.innerHTML = '<div id="a"></div><div id="b"></div>'
    const a = document.getElementById('a')!.attachShadow({ mode: 'open' })
    a.innerHTML = '<span id="in"></span>'
    a.getElementById('in')!.attachShadow({ mode: 'open' })
    document.getElementById('b')!.attachShadow({ mode: 'closed' })
    expect(countOpenShadowRoots(document)).toBe(2)
    expect(computeCoverage(document).openShadowRoots).toBe(2)
  })
  it('records truncation only beyond the limit', () => {
    noteCut('links', 400, 400)
    noteCut('fields', 300, 301)
    noteCut('text nodes (contrast)', 9000, null)
    const c = computeCoverage(document)
    expect(c.truncated).toEqual([
      { what: 'fields', shown: 300, total: 301 },
      { what: 'text nodes (contrast)', shown: 9000, total: null },
    ])
    expect(coverageLines(c).join('|')).toContain('Only 300 of 301')
  })
  it('merges truncations per kind across scans', () => {
    noteCut('links', 400, 900)
    const first = computeCoverage(document)
    resetCuts()
    noteCut('tables', 200, 250)
    const merged = mergeCoverage(first, computeCoverage(document))!
    expect(merged.truncated.map((x) => x.what).sort()).toEqual(['links', 'tables'])
  })
})
