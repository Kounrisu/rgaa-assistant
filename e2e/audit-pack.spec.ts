import { expect, test } from '@playwright/test'
import { unzipSync, strFromU8 } from 'fflate'
import { readFileSync } from 'node:fs'
import { openRig, scanElements } from './harness'

test('the audit can be exported as a pack for a language model, with or without pictures', async ({ context }) => {
  test.setTimeout(120_000)
  const rig = await openRig(context)
  const { panel } = rig
  await panel.locator('#empty-add-btn').click()
  await scanElements(panel)
  // the pictures of the elements arrive after the scan: wait until the audit holds some
  await expect.poll(() => panel.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith('e2e-chrome-storage:rgaa-audit:'))
    const items = key ? JSON.parse(localStorage.getItem(key)!).pages[0]?.items ?? [] : []
    return items.some((i: { shot?: string; thumb?: string }) => i.shot || i.thumb)
  }), { timeout: 30_000 }).toBe(true)
  await expect(panel.locator('#save-state')).toContainText('Enregistré')
  await panel.locator('#audit-btn').click()
  await expect(panel.locator('#audit')).toBeVisible()
  const button = panel.getByRole('button', { name: 'Exporter pour analyse (LLM)' })
  await expect(button).toBeVisible()

  for (const [label, pictures] of [['Exporter avec les images', true], ['Exporter sans les images', false]] as const) {
    await button.click()
    await expect(panel.locator('#choice-text')).toContainText('question(s) à traiter')
    const [download] = await Promise.all([panel.waitForEvent('download'), panel.getByRole('button', { name: label }).click()])
    expect(download.suggestedFilename()).toMatch(/^audit-pack-.*\.zip$/)
    const files = unzipSync(new Uint8Array(readFileSync((await download.path())!)))
    const names = Object.keys(files)
    expect(names).toEqual(expect.arrayContaining(['README.md', 'answers-template.jsonl', 'pages/P01/elements.jsonl']))
    expect(names.some((n) => n.includes('/pictures/'))).toBe(pictures)
    const template = strFromU8(files['answers-template.jsonl']).trim().split('\n').map((l) => JSON.parse(l))
    expect(template.length).toBeGreaterThan(0)
  }
  expect(rig.problems).toEqual([])
})
