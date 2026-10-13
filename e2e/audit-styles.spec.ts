import { expect, test as base } from '@playwright/test'
import { openRig, scanElements, type Rig } from './harness'

/** The audit styles (the Stylus sheets): applied from the panel, or only named when the auditor uses Stylus. */
const test = base.extend<{ rig: Rig }>({ rig: async ({ context }, use) => use(await openRig(context)) })

test('a sheet is applied to the page from the menu, switched off with it, and before a scan', async ({ rig }) => {
  test.setTimeout(120_000)
  const { panel, site } = rig
  await panel.locator('#empty-add-btn').click()
  const menu = panel.locator('.styles-menu')
  await menu.locator('.styles-toggle').click()
  // the sheet of the theme being reviewed (Images) comes first
  await expect(menu.locator('fieldset[data-theme]').nth(0)).toHaveAttribute('data-theme', '1')

  const linkOutline = () => site.evaluate(() => { const a = document.querySelector('a[href]')!; const cs = getComputedStyle(a); return `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}` })
  expect(await linkOutline()).not.toContain('5px')

  const liens = menu.locator('input[data-sheet="audit-06-liens"]')
  await liens.check()
  await expect.poll(linkOutline).toBe('solid 5px rgb(0, 0, 255)')
  await expect(menu.locator('.styles-toggle')).toContainText('1 actifs')
  await liens.uncheck()
  await expect.poll(linkOutline).not.toContain('5px')

  // switched on again, then a scan: the page is scanned as it is, the sheet is off first
  await liens.check()
  await expect.poll(linkOutline).toBe('solid 5px rgb(0, 0, 255)')
  await scanElements(panel)
  await expect(panel.locator('#status')).toContainText('1 style(s) d’audit désactivé(s) d’abord')
  await expect.poll(linkOutline).not.toContain('5px')
  await expect(panel.locator('.styles-menu input[data-sheet="audit-06-liens"]')).not.toBeChecked()
})

test('with Stylus as the way of working, the panel only names the sheets of the theme, and remembers the choice', async ({ rig }) => {
  test.setTimeout(120_000)
  const { panel, site } = rig
  await panel.locator('#empty-add-btn').click()
  await panel.locator('.themebar .themes-menu summary').click()
  await panel.locator('.themebar .menu-actions button').first().click()
  await panel.locator('.styles-menu .styles-toggle').click()
  await panel.locator('.styles-menu input[name="styles-mode"][value="stylus"]').check()

  // no switches any more: names only, and a reminder next to the menu for the theme being shown
  await expect(panel.locator('.styles-menu input[type="checkbox"]')).toHaveCount(0)
  await expect(panel.locator('.styles-menu .styles-toggle')).toContainText('(Stylus)')
  await panel.locator('.theme-tab', { hasText: 'Liens' }).click()
  await expect(panel.locator('.styles-hint')).toHaveText('Stylus : 06.Liens')
  await panel.locator('.theme-tab', { hasText: 'Structure' }).click()
  await expect(panel.locator('.styles-hint')).toHaveText('Stylus : 09.01.Titres, 09.02.Structure, 09.03.Listes')
  await panel.locator('.theme-tab', { hasText: 'Couleurs' }).click()
  await expect(panel.locator('.styles-hint')).toHaveCount(0) // no sheet for this theme

  // nothing was put on the page by the panel
  expect(await site.evaluate(() => document.querySelectorAll('style[data-e2e-style]').length)).toBe(0)

  // remembered after a reload
  await rig.reloadPanel()
  await panel.locator('.theme-tab', { hasText: 'Liens' }).click().catch(() => undefined)
  await expect(panel.locator('.styles-menu .styles-toggle')).toContainText('(Stylus)')
})
