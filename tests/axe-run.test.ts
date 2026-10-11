// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { runAxe } from '../src/content/axe-run'

type FakeAxe = { run: (ctx: unknown, opts: unknown) => Promise<unknown>; configure: (c: object) => void }
const install = (fake: FakeAxe) => ((globalThis as unknown as { axe?: FakeAxe }).axe = fake)
afterEach(() => delete (globalThis as unknown as { axe?: FakeAxe }).axe)

describe('runAxe never audits the assistant itself (UX walkthrough of 2026-10-11: our overlay was reported as a 12.6 failure)', () => {
  it('excludes our layers from the axe context and drops any node that still points at them', async () => {
    let seenContext: unknown
    install({
      configure: () => {},
      run: async (ctx) => {
        seenContext = ctx
        return {
          violations: [
            {
              id: 'region',
              impact: 'moderate',
              help: 'Content should be in a region',
              nodes: [
                { html: '<div id="rgaa-assistant-overlay-t1">', target: ['#rgaa-assistant-overlay-t1'] },
                { html: '<p class="faint">', target: ['.faint'] },
              ],
            },
            { id: 'image-alt', impact: 'critical', help: 'Images must have alternate text', nodes: [{ html: '<span>', target: ['#rgaa-assistant-overlay > span'] }] },
          ],
          incomplete: [],
          passes: [],
          inapplicable: [],
        }
      },
    })
    const r = await runAxe(null, ['region', 'image-alt'])
    expect('error' in r).toBe(false)
    expect(seenContext).toEqual({ exclude: [['[id^="rgaa-assistant-"]']] })
    const v = (r as { violations: { id: string; nodes: { target: string[] }[] }[] }).violations
    expect(v.map((x) => x.id)).toEqual(['region'])
    expect(v[0].nodes.map((n) => n.target)).toEqual([['.faint']])
  })

  it('reports a missing engine instead of throwing', async () => {
    expect(await runAxe(null, [])).toEqual({ error: 'axe-not-loaded' })
  })
})
