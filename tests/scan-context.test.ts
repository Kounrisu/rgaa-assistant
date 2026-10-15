// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { cloneWithTarget } from '../src/content/scan-context'
import { boundedContext } from '../src/content/dom-utils'

function marked(html: string, targetSel: string, contextSel: string, strip: string): Element[] {
  document.body.innerHTML = html
  const clone = cloneWithTarget(document.querySelector(contextSel)!, document.querySelector(targetSel)!, strip)
  return Array.from(clone.querySelectorAll('[data-rgaa-target]')).concat(clone.hasAttribute('data-rgaa-target') ? [clone] : [])
}

describe('context element targeting', () => {
  it('removes assistant overlays before truncating evidence without changing the page', () => {
    document.body.innerHTML = `<div id="rgaa-assistant-overlay-6">${'overlay '.repeat(400)}</div><main id="target">Page evidence</main><footer>End of page</footer>`
    const target = document.querySelector('#target')!
    const context = boundedContext(target)
    expect(context).not.toContain('overlay')
    expect(context).toContain('<main id="target" data-rgaa-target="">Page evidence</main>')
    expect(context).toContain('<footer>End of page</footer>')
    expect(document.querySelector('#rgaa-assistant-overlay-6')).not.toBeNull()
    expect(target.hasAttribute('data-rgaa-target')).toBe(false)
  })
  it('marks the target even when script/style/noscript nodes precede it', () => {
    const m = marked('<div id="c"><script>1</script><style>a{}</style><noscript><p>x</p></noscript><span>a</span><img id="t" alt=""><span>b</span></div>', '#t', '#c', 'script, style, noscript')
    expect(m).toHaveLength(1)
    expect(m[0].id).toBe('t')
  })
  it('does not mark a neighbour when preceding nodes are stripped (svg too)', () => {
    const m = marked('<div id="c"><svg><g></g></svg><b>1</b><i id="t">2</i><u>3</u></div>', '#t', '#c', 'script, style, noscript, svg')
    expect(m.map((e) => e.tagName)).toEqual(['I'])
  })
  it('marks the clone root when the target is the context', () => {
    const m = marked('<p id="c">x</p>', '#c', '#c', 'script')
    expect(m.map((e) => e.id)).toEqual(['c'])
  })
  it('marks nothing when the target itself is stripped', () => {
    expect(marked('<div id="c"><script id="t"></script></div>', '#t', '#c', 'script')).toHaveLength(0)
  })
})
