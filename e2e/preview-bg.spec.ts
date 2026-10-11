import { expect, test as base } from '@playwright/test'
import { openRig, scanElements, type Rig } from './harness'

/** The background behind the image previews can be changed (transparent icons are invisible on a checkerboard). */
const test = base.extend<{ rig: Rig }>({ rig: async ({ context }, use) => use(await openRig(context)) })

test('the preview background can be changed, applies to the thumbnails and the big preview, and is remembered', async ({ rig }) => {
  const { panel } = rig
  await panel.locator('#empty-add-btn').click()
  await scanElements(panel)
  await expect(panel.locator('#element-list .item')).toHaveCount(3)
  await panel.locator('#element-list .item').first().click()

  const bg = (selector: string) => panel.locator(selector).first().evaluate((el) => getComputedStyle(el).backgroundColor)
  const select = panel.locator('#preview-bg')
  await expect(select).toHaveValue('checker')
  expect(await panel.locator('.preview-img').first().evaluate((el) => getComputedStyle(el).backgroundImage)).toContain('conic-gradient')

  await select.selectOption('pink')
  expect(await bg('.preview-img')).toBe('rgb(253, 226, 232)')
  expect(await bg('#element-list .item .thumb')).toBe('rgb(253, 226, 232)')

  await select.selectOption('dark')
  expect(await bg('.preview-img')).toBe('rgb(31, 41, 55)')

  // any colour: the picker switches the choice to "custom"
  await panel.locator('.preview-bg-control input[type="color"]').fill('#00ff00')
  await expect(select).toHaveValue('custom')
  expect(await bg('.preview-img')).toBe('rgb(0, 255, 0)')

  // remembered after a reload; the checkerboard comes back on request
  await rig.reloadPanel()
  await panel.locator('#element-list .item').first().click()
  await expect(panel.locator('#preview-bg')).toHaveValue('custom')
  expect(await bg('.preview-img')).toBe('rgb(0, 255, 0)')
  await panel.locator('#preview-bg').selectOption('checker')
  expect(await panel.locator('.preview-img').first().evaluate((el) => getComputedStyle(el).backgroundImage)).toContain('conic-gradient')
})
