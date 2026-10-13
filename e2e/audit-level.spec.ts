import { expect, test } from '@playwright/test'
import { openRig, scanElements } from './harness'

/** The audit type (complet / rapide / complémentaire) is chosen in Échantillon et suivi and shown next to the audit name. */
test('the audit type is chosen in the sample, shown in the header, and limits the criteria that count', async ({ context }) => {
  const rig = await openRig(context)
  const { panel } = rig
  await panel.locator('#empty-add-btn').click()
  const total = () => panel.locator('#page-summary > button > strong').evaluateAll((nodes) => nodes.reduce((sum, node) => sum + Number(node.textContent), 0))
  await expect(panel.locator('#audit-level')).toContainText('Audit complet')
  expect(await total()).toBe(106)

  await panel.locator('#sample-btn').click()
  await panel.locator('label[for="audit-level-rapide"]').click()
  await expect(panel.locator('#audit-level')).toContainText('Audit rapide · 25 critères')
  await panel.locator('label[for="audit-level-complementaire"]').click()
  await expect(panel.locator('#audit-level')).toContainText('Audit complémentaire · 50 critères')
  await panel.locator('label[for="audit-level-rapide"]').click()

  await panel.locator('#evaluate-page-btn').click()
  await expect.poll(total).toBe(25)
  await panel.locator('#results-btn').click()
  await expect(panel.locator('.level-note')).toContainText('pas un taux de conformité')

  // the choice is saved with the audit
  await expect.poll(() => panel.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith('e2e-chrome-storage:rgaa-audit:'))
    return key ? JSON.parse(localStorage.getItem(key)!).meta.level : null
  })).toBe('rapide')
  await panel.locator('#sample-btn').click()
  await panel.locator('label[for="audit-level-complet"]').click()
  await expect(panel.locator('#audit-level')).toContainText('Audit complet · 106 critères')
  expect(rig.problems).toEqual([])
})

test('a quick or complementary audit asks exactly its criteria, in every kind of theme', async ({ context }) => {
  test.setTimeout(120_000)
  const rig = await openRig(context)
  const { panel } = rig
  await panel.locator('#empty-add-btn').click()
  await scanElements(panel)
  const cardIds = () => panel.locator('#theme-view [id^="chk-card-"], #theme-view [id^="crit-card-"]').evaluateAll((nodes) => nodes.map((n) => n.id.replace(/^(chk|crit)-card-/, '')))
  const choose = async (level: string) => {
    await panel.locator('#sample-btn').click()
    await panel.locator(`label[for="audit-level-${level}"]`).click()
    await panel.locator('#evaluate-page-btn').click()
  }

  await choose('rapide')
  // a checklist theme: Éléments obligatoires keeps only 8.3, 8.4, 8.5
  await panel.locator('.theme-tab', { hasText: 'Éléments obligatoires' }).click()
  expect(await cardIds()).toEqual(['8.3', '8.4', '8.5'])
  // a theme with no criterion in this audit type says so, and its tab is marked
  await panel.locator('.theme-tab', { hasText: 'Cadres' }).click()
  await expect(panel.locator('.out-of-level-note')).toContainText('Aucun critère de cette thématique')
  // links: 6.1 and 6.2 only (the images theme: only 1.1 is asked of an informative image)
  await panel.locator('.theme-tab', { hasText: 'Images' }).click()
  await expect(panel.locator('#theme-todo .todo-chip[data-crit="1.4"]')).toHaveCount(0)
  await expect(panel.locator('#theme-todo .todo-chip[data-crit="1.2"]')).toHaveCount(0)

  await choose('complementaire')
  await panel.locator('.theme-tab', { hasText: 'Éléments obligatoires' }).click()
  expect(await cardIds()).toEqual(['8.2', '8.3', '8.4', '8.5', '8.6', '8.10'])
  await panel.locator('.theme-tab', { hasText: 'Images' }).click()
  await expect(panel.locator('#theme-todo .todo-chip[data-crit="1.5"]')).toBeVisible()
  await expect(panel.locator('#theme-todo .todo-chip[data-crit="1.4"]')).toHaveCount(0)

  await choose('complet')
  await panel.locator('.theme-tab', { hasText: 'Éléments obligatoires' }).click()
  expect((await cardIds()).length).toBe(10)
  expect(rig.problems).toEqual([])
})

test('the RGAA coverage page speaks about the chosen audit type, and the panel link carries it', async ({ context }) => {
  const rig = await openRig(context)
  const { panel } = rig
  await panel.locator('#empty-add-btn').click()
  await expect(panel.locator('#coverage-link')).toHaveAttribute('href', '../rgaa/rgaa.html')
  await panel.locator('#sample-btn').click()
  await panel.locator('label[for="audit-level-rapide"]').click()
  await expect(panel.locator('#coverage-link')).toHaveAttribute('href', '../rgaa/rgaa.html?level=rapide')

  const page = await context.newPage()
  await page.goto('http://127.0.0.1:4173/src/rgaa/rgaa.html?level=rapide')
  await page.evaluate(() => localStorage.setItem('rgaa-lang', 'fr'))
  await page.reload()
  await expect(page.locator('#scope button[aria-pressed="true"]')).toContainText('Audit rapide (25)')
  await expect(page.locator('#summary .stat').first()).toContainText('25 critères')
  await page.locator('#scope button', { hasText: 'Audit complémentaire' }).click()
  await expect(page.locator('#summary .stat').first()).toContainText('50 critères')
  await expect(page).toHaveURL(/level=complementaire/)
  await page.locator('#scope button', { hasText: 'Audit complet' }).click()
  await expect(page.locator('#summary .stat').first()).toContainText('106 critères')
  expect(rig.problems).toEqual([])
})
