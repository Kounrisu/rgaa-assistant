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

  const [view] = await Promise.all([panel.waitForEvent('popup'), bar.getByRole('button', { name: 'Aperçu de la structure' }).click()])
  const frame = view.frameLocator('#frame')
  await expect(frame.locator('h1')).toContainText('Bienvenue')
  await expect(frame.locator('.loose', { hasText: 'Texte isolé dans une div' })).toHaveCount(1)
  await expect(frame.locator('script')).toHaveCount(0)
  await view.close()
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
  const [tables] = await Promise.all([panel.waitForEvent('popup'), panel.locator('#page-tools').getByRole('button', { name: 'Lecture des tableaux' }).click()])
  const dialog = tables.locator('body')
  await expect(dialog.locator('li', { hasText: 'Offre: Basique' })).toHaveCount(1)
  await expect(dialog.locator('li', { hasText: 'Prix: 5 €' })).toHaveCount(1)
  await expect(dialog.locator('li.warn', { hasText: 'No header cell' })).toHaveCount(2) // the test page's own table and the bad one
  await tables.close()

  await panel.locator('.theme-tab', { hasText: 'Structure' }).click()
  const [reading] = await Promise.all([panel.waitForEvent('popup'), panel.locator('#page-tools').getByRole('button', { name: 'Lecture de la page' }).click()])
  await expect(reading.locator('li', { hasText: 'Heading level 1: Bienvenue' })).toHaveCount(1)
  await reading.close()
})

test('table tool: a visually hidden caption is shown, and put back when the tool is off', async ({ rig }) => {
  test.setTimeout(120_000)
  const { panel, site } = rig
  await panel.locator('#empty-add-btn').click()
  await scanElements(panel)
  await panel.locator('.themebar .themes-menu summary').click()
  await panel.locator('.themebar .menu-actions button').first().click()
  await site.evaluate(() => {
    const wrap = document.createElement('div')
    wrap.innerHTML = '<table id="t-hid"><caption id="cap-hid" style="position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden">Titre caché</caption><tr><th scope="col">A</th></tr><tr><td>1</td></tr></table>'
    document.body.prepend(wrap)
  })
  await panel.locator('.theme-tab', { hasText: 'Tableaux' }).click()
  const tool = panel.locator('#page-tools').getByRole('button', { name: 'Titre et scope' })
  await tool.click()
  await expect.poll(() => site.evaluate(() => Math.round(document.getElementById('cap-hid')!.getBoundingClientRect().width))).toBeGreaterThan(20)
  await tool.click()
  await expect.poll(() => site.evaluate(() => Math.round(document.getElementById('cap-hid')!.getBoundingClientRect().width))).toBeLessThanOrEqual(2)
})
