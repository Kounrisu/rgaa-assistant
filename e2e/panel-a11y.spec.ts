import { expect, test, type Page } from '@playwright/test'
import { join } from 'node:path'
import { openRig, scanElements } from './harness'

/** The panel is an accessibility tool: it must pass axe itself (WCAG 2.x A/AA and best practice) in every main view, in light and dark. */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']

async function violations(page: Page): Promise<string[]> {
  return page.evaluate(
    async (tags) => {
      const res = await (window as unknown as { axe: { run: (c: Document, o: unknown) => Promise<{ violations: { id: string; impact: string; nodes: { target: string[] }[] }[] }> } }).axe.run(document, { runOnly: { type: 'tag', values: tags } })
      return res.violations.map((v) => `${v.id} (${v.impact}) x${v.nodes.length} e.g. ${v.nodes[0].target.join(' ').slice(0, 100)}`)
    },
    TAGS,
  )
}

test('the panel and the coverage page pass axe in every main view, light and dark', async ({ context }) => {
  test.setTimeout(240_000)
  const rig = await openRig(context)
  const { panel } = rig
  await panel.locator('#empty-add-btn').click()
  await scanElements(panel)
  await panel.addScriptTag({ path: join(process.cwd(), 'dist', 'axe.min.js') })

  for (const scheme of ['light', 'dark'] as const) {
    await panel.emulateMedia({ colorScheme: scheme })
    const found: string[] = []
    const check = async (name: string) => found.push(...(await violations(panel)).map((v) => `[${scheme}] ${name}: ${v}`))
    await panel.locator('#review-btn').click()
    await panel.locator('.theme-tab', { hasText: 'Images' }).click()
    await check('Images')
    for (const [button, name] of [['#sample-btn', 'Sample'], ['#audit-btn', 'Audit overview'], ['#results-btn', 'Page results'], ['#checks-btn', 'Manual checks']] as const) {
      if (button === '#results-btn' || button === '#checks-btn') await panel.locator('#evaluate-page-btn').click() // the page navigation is in the page views
      await panel.locator(button).click()
      await check(name)
    }
    await panel.locator('#review-btn').click()
    for (const theme of ['Liens', 'Formulaires', 'Éléments obligatoires']) {
      await panel.locator('.theme-tab', { hasText: theme }).click()
      await check(theme)
    }
    expect(found).toEqual([])
  }

  const coverage = await context.newPage()
  await coverage.goto('http://127.0.0.1:4173/src/rgaa/rgaa.html?level=rapide')
  await coverage.addScriptTag({ path: join(process.cwd(), 'dist', 'axe.min.js') })
  expect(await violations(coverage)).toEqual([])
  expect(rig.problems).toEqual([])
})
