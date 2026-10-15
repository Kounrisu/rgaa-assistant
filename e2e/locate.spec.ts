import { expect, test as base } from '@playwright/test'
import { openRig, scanElements, type Rig } from './harness'

/**
 * “Repérer sur la page” sits in every element-level criterion card, just before “Suivant à évaluer”, and does what
 * clicking the element in the list does: its box takes the focus outline and the page scrolls to it.
 */
const test = base.extend<{ rig: Rig }>({ rig: async ({ context }, use) => use(await openRig(context)) })

test('locate on page from the criterion cards gives the same focus as a click on the element', async ({ rig }) => {
  test.setTimeout(120_000)
  const { panel, site } = rig
  await site.setViewportSize({ width: 600, height: 220 }) // short page window: scrolling matters
  await panel.locator('#empty-add-btn').click()
  await scanElements(panel)
  const items = panel.locator('#element-list .item')
  await expect(items).toHaveCount(3)

  /** The box of the page that holds the focus outline, with the scroll position. */
  const focusOnSite = () =>
    site.evaluate(() => {
      const box = document.querySelector<HTMLElement>('[id^="rgaa-assistant-overlay"] [data-focused="true"]')
      return { id: box?.dataset.id ?? null, border: box?.style.border ?? '', scrollY: Math.round(scrollY), animation: box?.style.animation ?? '' }
    })

  // reference: what a click on the element does
  await site.evaluate(() => scrollTo(0, 0))
  await items.nth(2).click()
  await expect.poll(async () => (await focusOnSite()).id).toBe('3')
  const clicked = await focusOnSite()
  expect(clicked.border).toContain('4px solid')
  // The focus outline is synchronous, but scrolling is deliberately smooth.
  await expect.poll(async () => (await focusOnSite()).scrollY).toBeGreaterThan(0)

  // the image card: “Repérer sur la page” comes right before “Suivant à évaluer”, in the card and in the header
  await items.nth(0).click()
  await panel.locator('label[for="kind-1-informative"]').click()
  const card = panel.locator('.criterion', { has: panel.locator('input[name="crit-1-1.1"]') })
  const buttons = card.locator('.review-actions button')
  await expect(buttons).toHaveText(['Repérer sur la page', /Suivant : .*RGAA [0-9]+\.[0-9]+/])

  // away from the element, then locate from the card
  await site.evaluate(() => scrollTo(0, 0))
  await card.getByRole('button', { name: 'Repérer sur la page' }).click()
  await expect.poll(async () => (await focusOnSite()).id).toBe('1')
  const located = await focusOnSite()
  expect(located.border).toBe(clicked.border)
  expect(located.animation).toBe(clicked.animation)
  await expect.poll(async () => (await focusOnSite()).scrollY).toBeGreaterThanOrEqual(0)

  // a finding theme (Links): same button, same effect (select every theme, rescan, open Links)
  await panel.locator('.themebar .themes-menu summary').click()
  await panel.locator('.themebar .menu-actions button').first().click()
  await scanElements(panel)
  await panel.locator('.theme-tab', { hasText: 'Liens' }).click()
  await expect(panel.locator('.finding-pane .item.finding').first()).toBeVisible({ timeout: 20_000 })
  const linkCard = panel.locator('.finding-detail .criterion').first()
  await expect(linkCard.locator('.review-actions button')).toHaveText(['Repérer sur la page', /Suivant : .*RGAA [0-9]+\.[0-9]+/])
  await site.evaluate(() => scrollTo(0, 0))
  await linkCard.getByRole('button', { name: 'Repérer sur la page' }).click()
  await expect.poll(async () => (await focusOnSite()).border).toContain('4px solid')
})
