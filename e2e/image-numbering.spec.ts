import { expect, test } from '@playwright/test'
import { openRig, scanElements } from './harness'

test('unchanged images keep numbers and answers when nearby content changes during rescans', async ({ context }) => {
  const { panel, site, reloadPanel, problems } = await openRig(context)
  await site.evaluate(() => {
    document.body.innerHTML = '<img id="original" src="/pixel.png" alt="Original" width="80" height="80"><p>Before</p>'
  })
  await panel.locator('#empty-add-btn').click()
  await scanElements(panel)
  await expect(panel.locator('#status')).toContainText('P01')
  await expect(panel.locator('#save-state')).toContainText('Enregistré')
  await panel.locator('label[for="kind-1-informative"]').click()
  await panel.locator('label[for="crit-1-1.1-c"]').click()
  await expect(panel.locator('#save-state')).toContainText('Enregistré')
  const saved = () => panel.evaluate(() => {
    const key = Object.keys(localStorage).find(k => k.startsWith('e2e-chrome-storage:rgaa-audit:'))!
    return JSON.parse(localStorage.getItem(key)!).pages[0]
  })
  const originalKey = (await saved()).items[0].key
  await scanElements(panel)
  await expect(panel.locator('#status')).toContainText('P01')
  await expect(panel.locator('#save-state')).toContainText('Enregistré')
  expect((await saved()).items).toHaveLength(1)
  await site.evaluate(() => {
    document.querySelector('p')!.textContent = 'After'
    document.querySelector('#original')!.insertAdjacentHTML('beforebegin', '<img id="new" src="/pixel.png" alt="New" width="80" height="80">')
  })
  await scanElements(panel)
  await expect(panel.locator('#status')).toContainText('P01')
  await expect(panel.locator('#save-state')).toContainText('Enregistré')
  await reloadPanel()
  await scanElements(panel)
  await expect(panel.locator('#status')).toContainText('P01')
  await expect(panel.locator('#save-state')).toContainText('Enregistré')
  const rec = await saved()
  expect(rec.items.map((item: any) => [item.id, item.alt, item.present])).toEqual([[1, 'Original', true], [2, 'New', true]])
  expect(rec.items[0].key).toBe(originalKey)
  expect(rec.reviews[originalKey].answers['1.1']).toBe('c')
  // Panel numbering and the actual page boxes must agree, despite reversed DOM order.
  await panel.locator('#element-list .item').first().click()
  await expect.poll(() => site.evaluate(() => document.querySelector('[id="rgaa-assistant-overlay"] [data-focused="true"]')?.getAttribute('data-id'))).toBe('1')
  expect(problems).toEqual([])
})
