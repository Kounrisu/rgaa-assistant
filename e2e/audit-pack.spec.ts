import { expect, test } from '@playwright/test'
import { unzipSync, strFromU8 } from 'fflate'
import { readFileSync } from 'node:fs'
import { openRig, scanElements } from './harness'

test('the audit can be exported as a pack for a language model, with or without pictures', async ({ context }, testInfo) => {
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

  for (const pictures of [true, false]) {
    await button.click()
    await expect(panel.locator('.pack-preview')).toContainText('l’import des réponses n’est pas disponible')
    await panel.getByLabel('Inclure les images', { exact: true }).setChecked(pictures)
    await panel.locator('#pack-preview-file').selectOption('pages/P01/elements.jsonl')
    if (!pictures) {
      await panel.locator('[data-pack-exclude=html]').check()
      await expect(panel.getByLabel('Contenu exact du fichier')).toHaveValue(/"html":null/)
    }
    const preview = await panel.getByLabel('Contenu exact du fichier').inputValue()
    await panel.screenshot({ path: testInfo.outputPath(`pack-preview-${pictures}.png`) })
    expect(preview).toContain('accessible_name')
    const [download] = await Promise.all([panel.waitForEvent('download'), panel.getByRole('button', { name: 'Enregistrer le dossier examiné' }).click()])
    expect(download.suggestedFilename()).toMatch(/^audit-pack-.*\.zip$/)
    const files = unzipSync(new Uint8Array(readFileSync((await download.path())!)))
    expect(strFromU8(files['pages/P01/elements.jsonl'])).toBe(preview)
    const names = Object.keys(files)
    expect(names).toEqual(expect.arrayContaining(['README.md', 'answers-template.jsonl', 'pages/P01/elements.jsonl']))
    expect(names.some((n) => n.includes('/pictures/'))).toBe(pictures)
    const template = strFromU8(files['answers-template.jsonl']).trim().split('\n').map((l) => JSON.parse(l))
    expect(template.length).toBeGreaterThan(0)
  }
  expect(rig.problems).toEqual([])
})
