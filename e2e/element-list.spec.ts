import { expect, test as base } from '@playwright/test'
import { openRig, scanElements, type Rig } from './harness'

/** The list of images: where you are is unmistakable, the keyboard moves through it, and the pre-filled answers can be confirmed together. */
const test = base.extend<{ rig: Rig }>({ rig: async ({ context }, use) => use(await openRig(context)) })

test('arrows move through the list, Tab leaves it, the current image and the focus ring are visible, pre-filled answers confirm together', async ({ rig }) => {
  test.setTimeout(120_000)
  const { panel, site } = rig
  await site.evaluate(() => document.body.insertAdjacentHTML('afterbegin', Array.from({ length: 6 }, (_, i) => `<svg aria-hidden="true" width="20" height="20"><circle cx="10" cy="10" r="${4 + i}"/></svg>`).join('')))
  await panel.locator('#empty-add-btn').click()
  await scanElements(panel)
  const items = panel.locator('#element-list .item')
  await expect(items).toHaveCount(9)

  // numbers follow the page: the six icons added at the top are #1 to #6, the fixture images follow
  await expect(items.nth(0)).toHaveAttribute('data-id', '1')
  await expect(items.nth(6)).toContainText('Logo de la société')

  // one stop for Tab: the selected image; the others are reached with the arrows
  await items.nth(0).click()
  await expect(panel.locator('#element-list .item[tabindex="0"]')).toHaveCount(1)
  await expect(items.nth(0)).toHaveAttribute('tabindex', '0')

  const focusedId = () => panel.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset?.id ?? null)
  const currentId = () => items.evaluateAll((els) => els.find((e) => e.getAttribute('aria-current') === 'true')?.getAttribute('data-id') ?? null)
  await panel.keyboard.press('ArrowDown')
  await expect.poll(focusedId).toBe('2')
  expect(await currentId()).toBe('2')
  await panel.keyboard.press('PageDown')
  await expect.poll(focusedId).toBe('7')
  await panel.keyboard.press('End')
  await expect.poll(focusedId).toBe('9')
  await panel.keyboard.press('Home')
  await expect.poll(focusedId).toBe('1')
  await panel.keyboard.press('ArrowUp') // before the first: stays on the first
  await expect.poll(focusedId).toBe('1')

  // the page follows: the box of the current image holds the focus outline
  await panel.keyboard.press('ArrowDown')
  await expect.poll(() => site.evaluate(() => document.querySelector('[id="rgaa-assistant-overlay"] [data-focused="true"]')?.getAttribute('data-id'))).toBe('2')

  // the keyboard focus is a thick dark ring; the current image has a thick frame and a marker before its number
  const style = await items.nth(1).evaluate((el) => {
    const cs = getComputedStyle(el)
    return { outlineWidth: cs.outlineWidth, outlineStyle: cs.outlineStyle, marker: getComputedStyle(el.querySelector('.num')!, '::before').content }
  })
  expect(style.outlineStyle).toBe('solid')
  expect(parseFloat(style.outlineWidth)).toBeGreaterThanOrEqual(3)
  expect(style.marker).toContain('▶')

  // Tab leaves the list instead of walking through every image
  await panel.keyboard.press('Tab')
  expect(await panel.evaluate(() => Boolean(document.activeElement?.closest('#element-list')))).toBe(false)

  // pre-filled answers (the icons are hidden from assistive technologies; the logo has a name; one image has none) confirm together
  const confirmAll = panel.getByRole('button', { name: /Confirmer les \d+ images pré-remplies/ })
  await expect(confirmAll).toBeVisible()
  const n = Number(/(\d+)/.exec((await confirmAll.textContent()) ?? '')![1])
  expect(n).toBe(9)
  await confirmAll.click()
  await expect(panel.locator('#confirm-dialog')).toBeVisible()
  await panel.locator('#confirm-ok').click()
  await expect(panel.locator('#element-list .auto-tag:visible')).toHaveCount(0)
  await expect(confirmAll).toHaveCount(0)
})
