import { expect, test, type Page } from '@playwright/test'
import { openRig } from './harness'

async function storedPage(panel: Page) {
  return panel.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith('e2e-chrome-storage:rgaa-audit:'))
    return key ? JSON.parse(localStorage.getItem(key)!).pages[0] : null
  })
}

async function runChecks(panel: Page) {
  await panel.locator('#auto-btn').click()
  await expect(panel.locator('#status')).toContainText('Contrôles automatiques de P01', { timeout: 40_000 })
  await expect(panel.locator('#auto-btn')).toBeEnabled()
  await expect(panel.locator('#save-state')).toContainText('Enregistré')
}

for (const width of [480, 768, 1280]) {
  test(`review decisions remain reachable at ${width}px`, async ({ context }, testInfo) => {
    const { panel, problems } = await openRig(context)
    await panel.setViewportSize({ width, height: 800 })
    await panel.locator('#empty-add-btn').click()
    await panel.locator('#scan-btn').click()
    const choice = panel.locator('label[for="kind-1-informative"]')
    await expect(choice).toBeVisible()
    await panel.evaluate(() => window.scrollTo(0, 0))
    const box = await choice.boundingBox()
    expect(box!.y + box!.height, 'the first decision fits in the initial viewport').toBeLessThan(800)
    expect(await panel.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await expect(panel.locator('#reset-page-btn')).not.toBeVisible()
    // The list remains available on narrow screens, including its review filters.
    if (width <= 979) {
      await expect(panel.locator('.compact-preview')).toBeVisible()
      await panel.locator('#image-list-disclosure > summary').click()
      await expect(panel.locator('#element-list .item')).toHaveCount(3)
      await panel.locator('#image-list-disclosure > summary').click()
    }
    await panel.screenshot({ path: testInfo.outputPath(`initial-${width}.png`) })
    await choice.click()
    await panel.locator('label[for="crit-1-1.1-c"]').click()
    await expect.poll(async () => Object.values<any>((await storedPage(panel))?.reviews ?? {}).some((r) => r.answers['1.1'] === 'c')).toBe(true)
    await panel.screenshot({ path: testInfo.outputPath(`review-${width}.png`), fullPage: false })
    expect(problems).toEqual([])
  })
}

test('real automatic evidence leads to keyboard review, survives reruns, and works without images', async ({ context }, testInfo) => {
  const rig = await openRig(context)
  const { panel, site } = rig
  // Deliberate defects: no document title, and the fixture already has one unlabelled form field.
  await site.evaluate(() => { document.title = ''; document.querySelectorAll('img').forEach((img) => img.remove()) })
  await panel.locator('#empty-add-btn').click()
  await runChecks(panel)
  await expect(panel.locator('#results-btn')).toBeEnabled()
  await expect(panel.locator('#run-history')).not.toHaveAttribute('open', '')
  await expect(panel.locator('.checks-body')).toBeVisible()
  const rec = await storedPage(panel)
  expect(rec.items).toHaveLength(0)
  expect(rec.checklist['8.5'].verdict).toBeUndefined()
  expect(rec.checklist['8.5'].suggested).toBe('nc')
  expect(rec.checklist['8.5'].autoResults.axe.result).toBe('fail')
  const fields = rec.findings.filter((f: any) => f.theme === 11)
  expect(fields.length).toBeGreaterThan(0)
  const missingLabel = fields.find((f: any) => f.facts.name === 'nom')
  const labelled = fields.find((f: any) => f.facts.name === 'mail')
  expect(missingLabel).toBeDefined()
  expect(labelled).toBeDefined()
  expect(rec.findingReviews[missingLabel.key]?.answers['11.1']).toBe('nc')
  expect(rec.findingReviews[labelled.key]?.answers['11.1']).not.toBe('nc')
  await panel.screenshot({ path: testInfo.outputPath('automatic-review.png') })
  await panel.locator('.queue-suggestions > summary').click()
  await panel.locator('[data-review-criterion="8.5"]').click()
  const card = panel.locator('[id="crit-card-8.5"]')
  const compliant = card.locator('input[value="c"]')
  const noncompliant = card.locator('input[value="nc"]')
  await expect(compliant).toBeFocused()
  await compliant.press('Space')
  await expect(card.locator('.evidence-conflicts')).toContainText('→ c')
  await expect(card.locator('.source-note')).toHaveCount(0)
  await compliant.press('ArrowRight')
  await expect(noncompliant).toBeChecked()
  await expect(noncompliant).toBeFocused()
  await expect(card.locator('.evidence-conflicts')).not.toContainText('→ c')
  // A genuine disagreement between tools still remains (empty title vs. presence of a title tag).
  await expect(card.locator('.evidence-conflicts')).toContainText('≠')
  await card.locator('textarea').fill('Human review: title missing.')
  await expect.poll(async () => (await storedPage(panel))?.checklist['8.5'].verdict).toBe('nc')

  // The site is fixed: the real axe engine must now pass; it must not overwrite the human verdict or note.
  await site.evaluate(() => { document.title = 'Contact — Example company' })
  await runChecks(panel)
  const after = (await storedPage(panel)).checklist['8.5']
  expect(after.autoResults.axe.result).toBe('pass')
  expect(after.verdict).toBe('nc')
  expect(after.note).toContain('Human review: title missing.')
  expect(after.suggested).toBeUndefined()
  await panel.locator('#results-btn').click()
  await expect(panel.locator('#results')).toBeVisible()
  await panel.locator('#results-btn').click()
  await expect(panel.locator('#results')).toBeVisible()
  await panel.locator('#review-btn').click()
  await expect(panel.locator('#theme-view')).toBeVisible()
  await rig.reloadPanel()
  expect((await storedPage(panel)).checklist['8.5'].verdict).toBe('nc')
  expect(rig.problems).toEqual([])
})
