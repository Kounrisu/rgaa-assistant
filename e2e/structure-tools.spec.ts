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

test('reading view: tables and page transcripts mark what a screen reader cannot tie together', async ({ rig }) => {
  test.setTimeout(120_000)
  const { panel, site } = rig
  await panel.locator('#empty-add-btn').click()
  await scanElements(panel)
  await panel.locator('.themebar .themes-menu summary').click()
  await panel.locator('.themebar .menu-actions button').first().click()
  await site.evaluate(() => {
    const wrap = document.createElement('div')
    wrap.innerHTML = '<table id="t-good"><caption>Tarifs</caption><tr><th scope="col">Offre</th><th scope="col">Prix</th></tr><tr><td>Basique</td><td>5 €</td></tr></table><table id="t-bad"><tr><td>A</td><td headers="nope">B</td></tr></table>'
    document.body.prepend(wrap)
  })

  await panel.locator('.theme-tab', { hasText: 'Tableaux' }).click()
  await panel.locator('#page-tools').getByRole('button', { name: 'Lecture des tableaux' }).click()
  const dialog = panel.locator('#reading-dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('li', { hasText: 'Offre: Basique' })).toHaveCount(1)
  await expect(dialog.locator('li', { hasText: 'Prix: 5 €' })).toHaveCount(1)
  await expect(dialog.locator('li.warn', { hasText: 'No header cell' })).toHaveCount(2) // the test page's own table and the bad one
  await panel.locator('#reading-close').click()
  await expect(dialog).toBeHidden()

  await panel.locator('.theme-tab', { hasText: 'Structure' }).click()
  await panel.locator('#page-tools').getByRole('button', { name: 'Lecture de la page' }).click()
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('li', { hasText: 'Heading level 1: Bienvenue' })).toHaveCount(1)
  await panel.locator('#reading-close').click()
})
