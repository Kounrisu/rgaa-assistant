import { expect, test as base } from '@playwright/test'
import { openRig, scanElements, type Rig } from './harness'

/** An icon drawn by a font (a span or i with a private-use glyph, or a Material Icons ligature) is an image for the RGAA: it is listed and reviewed. */
const test = base.extend<{ rig: Rig }>({ rig: async ({ context }, use) => use(await openRig(context)) })

test('icon fonts are found with the images, typed as such, and reviewed with the role=img tests', async ({ rig }) => {
  test.setTimeout(120_000)
  const { panel, site } = rig
  await site.evaluate(() => {
    document.head.insertAdjacentHTML('beforeend', '<style>.ico::before{content:"\\f015";font-family:"FontAwesome";font-size:20px}.mi{font-family:"Material Icons";font-size:24px}</style>')
    document.body.insertAdjacentHTML(
      'afterbegin',
      `<p id="icons"><span class="ico" aria-hidden="true"></span> <span class="ico" aria-label="Accueil"></span> <i class="mi">home</i> <span class="glyph-raw"></span> <span class="not-an-icon">12 articles</span> <span class="ico-wrap">texte</span></p>`,
    )
  })
  await panel.locator('#empty-add-btn').click()
  await scanElements(panel)
  const items = panel.locator('#element-list .item')
  // 4 icon fonts (hidden, named, ligature, raw glyph) + the 3 images of the fixture; ordinary spans are not images
  await expect(items).toHaveCount(7)
  await expect(items.locator('.type', { hasText: 'icon-font (span)' })).toHaveCount(3)
  await expect(items.locator('.type', { hasText: 'icon-font (i)' })).toHaveCount(1)

  // the hidden one is ignored (decorative), the named one has its name, the others have none: the checks say so
  await expect(items.nth(0)).toHaveAttribute('data-detected', 'ignored')
  await expect(items.nth(1)).toHaveAttribute('data-detected', 'named')
  await expect(items.nth(2)).toHaveAttribute('data-detected', 'unnamed')

  // they get a picture of the element (no image address exists), and the role=img criteria apply
  await expect.poll(async () => (await items.nth(2).locator('img.thumb').getAttribute('src')) ?? '').toMatch(/^data:image\/png/)
  await items.nth(1).click()
  await expect(panel.locator('[id="crit-' + (await items.nth(1).getAttribute('data-id')) + '-1.1-c"]')).toBeChecked() // pre-filled: it has a name
})
