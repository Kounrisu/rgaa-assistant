import { expect, test as base } from '@playwright/test'
import { openRig, scanElements, type Rig } from './harness'

/** Small UX corrections of the re-audit of 2026-10-11: compact page bar, criteria left per image, how-to lines of the manual checks. */
const test = base.extend<{ rig: Rig }>({ rig: async ({ context }, use) => use(await openRig(context)) })

test('the browser address shares the row of the page navigation; the image header says what is left; manual checks say how', async ({ rig }) => {
  const { panel } = rig
  await panel.setViewportSize({ width: 1280, height: 720 })
  await panel.locator('#empty-add-btn').click()
  await scanElements(panel)
  await expect(panel.locator('#element-list .item')).toHaveCount(3)

  // wide panel: the address is on the same row as the page selector and its navigation (one row saved)
  const top = async (selector: string) => Math.round((await panel.locator(selector).boundingBox())!.y)
  expect(Math.abs((await top('#live-url')) - (await top('.page-navigation')))).toBeLessThan(24)

  // what is left for the image, visible next to its title
  await panel.locator('#element-list .item').first().click()
  const progress = panel.locator('#criteria-progress')
  await expect(progress).toBeEmpty() // no type chosen yet: nothing to count
  await panel.locator('label[for="kind-1-informative"]').click()
  await expect(progress).toContainText('0/6 critères répondus · prochain : 1.1')
  await panel.locator('label[for="crit-1-1.1-c"]').click()
  await expect(progress).toContainText('1/6 critères répondus · prochain : 1.3')

  // every manual check says how to do it
  await panel.locator('#checks-btn').click()
  await expect(panel.locator('.check-row .how')).toHaveCount(18)
  await expect(panel.locator('.check-row .how').first()).toContainText('Comment faire :')
})
