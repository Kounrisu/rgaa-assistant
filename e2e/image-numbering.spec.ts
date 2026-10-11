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


test('hidden images do not share internal IDs after an audit renumbers the visible boxes', async ({ context }) => {
  const { site, problems } = await openRig(context)
  await site.evaluate(() => {
    document.body.innerHTML = '<img id="first" src="/pixel.png" alt="First" width="80" height="80"><img id="second" src="/pixel.png" alt="Second" width="80" height="80">'
  })
  const send = (message: unknown) => site.evaluate(m => (window as any).__rgaaDispatch(m), message)
  const initial = await send({ type: 'RGAA_HIGHLIGHT_IMAGES' })
  expect(initial.elements.map((el: any) => el.id)).toEqual([1, 2])
  await site.locator('#first').evaluate(el => (el as HTMLElement).style.display = 'none')
  const hidden = await send({ type: 'RGAA_HIGHLIGHT_IMAGES' })
  expect(hidden.elements).toHaveLength(1)
  // Another audit numbers the only visible image #1. The hidden node still exists.
  await send({ type: 'RGAA_RELABEL', map: [{ from: hidden.elements[0].id, to: 1 }] })
  await site.locator('#first').evaluate(el => (el as HTMLElement).style.display = '')
  const reopened = await send({ type: 'RGAA_HIGHLIGHT_IMAGES' })
  expect(new Set(reopened.elements.map((el: any) => el.id)).size).toBe(2)
  await send({ type: 'RGAA_RELABEL', map: reopened.elements.map((el: any) => ({ from: el.id, to: el.alt === 'First' ? 7 : 3 })) })
  // Verify that each displayed number locates its own physical image, not just a label with that number.
  for (const [id, selector] of [[7, '#first'], [3, '#second']] as const) {
    const located = await send({ type: 'RGAA_LOCATE', theme: 1, id })
    const expected = await site.locator(selector).boundingBox()
    expect(located.rect.x).toBeCloseTo(expected!.x)
    expect(located.rect.y).toBeCloseTo(expected!.y)
    const box = await site.locator(`#rgaa-assistant-overlay [data-id="${id}"]`).boundingBox()
    expect(box!.x).toBeCloseTo(expected!.x)
    expect(box!.y).toBeCloseTo(expected!.y)
  }
  expect(problems).toEqual([])
})
