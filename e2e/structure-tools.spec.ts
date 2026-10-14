import { expect, test as base } from '@playwright/test'
import { openRig, scanElements, type Rig } from './harness'

/** Theme 9 (Structure): headings badges, loose text boxes and the rebuilt structure preview. */
const test = base.extend<{ rig: Rig }>({ rig: async ({ context }, use) => use(await openRig(context)) })

test('structure tools: headings map, loose text and structure preview', async ({ rig }) => {
  test.setTimeout(120_000)
  const { panel, site } = rig
  await panel.locator('#empty-add-btn').click()
  await scanElements(panel)
  await panel.locator('.themebar .themes-menu summary').click()
  await panel.locator('.themebar .menu-actions button').first().click()
  await panel.locator('.theme-tab', { hasText: 'Structure' }).click()

  // a loose text on the audited page (no paragraph around it)
  await site.evaluate(() => {
    const div = document.createElement('div')
    div.id = 'loose-test'
    div.textContent = 'Texte isolé dans une div'
    document.body.prepend(div)
  })

  const bar = panel.locator('#page-tools')
  await bar.getByRole('button', { name: 'Carte des titres' }).click()
  await expect.poll(() => site.evaluate(() => document.querySelectorAll('[data-tool="headings"] > div').length)).toBeGreaterThanOrEqual(3)
  await bar.getByRole('button', { name: 'Texte isolé' }).click()
  await expect.poll(() => site.evaluate(() => document.querySelectorAll('[data-tool="loosetext"] > div').length)).toBeGreaterThanOrEqual(1)

  await bar.getByRole('button', { name: 'Aperçu de la structure' }).click()
  const dialog = panel.locator('#structure-dialog')
  await expect(dialog).toBeVisible()
  const frame = panel.frameLocator('#structure-frame')
  await expect(frame.locator('h1')).toContainText('Bienvenue')
  await expect(frame.locator('.loose', { hasText: 'Texte isolé dans une div' })).toHaveCount(1)
  await expect(frame.locator('script')).toHaveCount(0)
  await panel.locator('#structure-close').click()
  await expect(dialog).toBeHidden()
})
