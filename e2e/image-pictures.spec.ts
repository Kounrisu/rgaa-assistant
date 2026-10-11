import { expect, test as base } from '@playwright/test'
import { openRig, scanElements, type Rig } from './harness'

/**
 * Graphics that cannot be redrawn from their markup (inline SVG drawing from a sprite, icon set as a CSS background) get
 * a real picture of the element, cropped from a screenshot, kept in the audit across reloads and rescans.
 */
const test = base.extend<{ rig: Rig }>({ rig: async ({ context }, use) => use(await openRig(context)) })

test('sprite and CSS-background icons get a picture of the element, kept after a reload and a rescan', async ({ rig }) => {
  test.setTimeout(120_000)
  const { panel, site } = rig
  await site.evaluate(() => {
    const bg = encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="12" fill="#fff"/></svg>')
    document.body.insertAdjacentHTML(
      'afterbegin',
      `<div style="background:#1f2937;padding:4px;display:inline-block">
         <svg style="display:none"><symbol id="star" viewBox="0 0 24 24"><path d="M12 2l3 7h7l-6 5 2 8-6-4-6 4 2-8-6-5h7z"/></symbol></svg>
         <svg role="img" aria-label="Favori" style="width:32px;height:32px;fill:#06c"><use href="#star"/></svg>
         <span role="img" aria-label="Fond" style="display:inline-block;width:32px;height:32px;background:url('data:image/svg+xml;utf8,${bg}')"></span>
       </div>`,
    )
  })
  await panel.locator('#empty-add-btn').click()
  await scanElements(panel)
  const items = panel.locator('#element-list .item')
  await expect(items).toHaveCount(5)

  const thumbs = () => items.evaluateAll((els) => els.map((e) => (e.querySelector('img.thumb') as HTMLImageElement | null)?.getAttribute('src') ?? null))
  // the sprite icon and the CSS background icon have a PNG picture (not an empty SVG redraw, not "no preview"); plain <img> keep their address
  await expect.poll(async () => (await thumbs()).slice(0, 2).every((s) => s?.startsWith('data:image/png;base64,'))).toBe(true)
  expect((await thumbs()).slice(2).every((s) => s?.startsWith('http://127.0.0.1'))).toBe(true)

  const stored = () => panel.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => /rgaa.*audit/i.test(k) && localStorage.getItem(k)!.includes('"items"'))
    return key ? (JSON.parse(localStorage.getItem(key)!).pages?.[0]?.items ?? []).map((i: { shot?: string | null }) => i.shot ?? null) : null
  })
  await expect.poll(async () => ((await stored()) ?? []).filter((s: string | null) => s?.startsWith('data:image/png')).length).toBe(2)

  // reload: the pictures come back; a rescan keeps them (no second capture needed)
  await rig.reloadPanel()
  await expect.poll(async () => (await thumbs()).slice(0, 2).every((s) => s?.startsWith('data:image/png;base64,'))).toBe(true)
  const before = (await thumbs()).slice(0, 2)
  await scanElements(panel)
  await expect(items).toHaveCount(5)
  expect((await thumbs()).slice(0, 2)).toEqual(before)
})

test('one screenshot serves every element in view (a scan of many icons is not one screenshot per icon)', async ({ rig }) => {
  test.setTimeout(120_000)
  const { panel, site } = rig
  await site.evaluate(() => {
    const row = Array.from({ length: 12 }, (_, i) => `<svg role="img" aria-label="Icône ${i}" style="width:24px;height:24px;margin:2px;fill:#06c"><circle cx="12" cy="12" r="${6 + (i % 5)}"/></svg>`).join('')
    document.body.insertAdjacentHTML('afterbegin', `<div style="background:#eef">${row}</div>`)
  })
  await panel.evaluate(() => {
    const w = window as unknown as { __captures: number }
    w.__captures = 0
    const send = chrome.runtime.sendMessage.bind(chrome.runtime)
    ;(chrome.runtime as unknown as { sendMessage: unknown }).sendMessage = (m: { type?: string }) => {
      if (m?.type === 'RGAA_CAPTURE') w.__captures++
      return send(m)
    }
  })
  await panel.locator('#empty-add-btn').click()
  await scanElements(panel)
  const items = panel.locator('#element-list .item')
  await expect(items).toHaveCount(15) // 12 icons + the 3 images of the fixture
  const pictures = () => items.evaluateAll((els) => els.slice(0, 12).filter((e) => e.querySelector('img.thumb')?.getAttribute('src')?.startsWith('data:image/png')).length)
  await expect.poll(pictures).toBe(12)
  // 12 icons + the findings previews of the fixture, all in the first screen of the page: a few screenshots at most, never one per element
  const captures = await panel.evaluate(() => (window as unknown as { __captures: number }).__captures)
  expect(captures).toBeGreaterThan(0)
  expect(captures).toBeLessThanOrEqual(4)
})
