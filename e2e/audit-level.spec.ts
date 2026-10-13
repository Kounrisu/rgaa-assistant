import { expect, test } from '@playwright/test'
import { openRig } from './harness'

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
