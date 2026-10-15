import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { openRig, scanElements } from './harness'

test('confirming one link answer leaves its other prefilled answer pending, including after reload', async ({ context }) => {
  const rig = await openRig(context)
  const { panel } = rig
  await panel.locator('#empty-add-btn').click()
  await scanElements(panel)
  await panel.locator('.theme-tab', { hasText: 'Liens' }).click()
  await panel.locator('.finding-pane .item.finding').first().click()
  const notes = panel.locator('.finding-detail .prefill-note')
  await expect(notes).toHaveCount(2)
  const first = panel.locator('.finding-detail .criterion').first()
  const other = panel.locator('.finding-detail .criterion').nth(1)
  await first.locator('input[value="c"] + label').click()
  await expect(first.locator('.prefill-note')).toHaveCount(0)
  await expect(other.locator('.prefill-note')).toHaveCount(1)
  await expect(panel.locator('#save-state')).toContainText('Enregistré')
  await rig.reloadPanel()
  await panel.locator('.theme-tab', { hasText: 'Liens' }).click()
  await panel.locator('.finding-pane .item.finding').first().click()
  await expect(notes).toHaveCount(1)
  expect(rig.problems).toEqual([])
})

test('partial audit dashboard, page results and report contain no compliance rate or statement', async ({ context }) => {
  const { panel, problems } = await openRig(context)
  await panel.locator('#empty-add-btn').click()
  for (const level of ['rapide', 'complementaire']) {
    await panel.locator('#sample-btn').click()
    await panel.locator(`label[for="audit-level-${level}"]`).click()
    await panel.locator('#evaluate-page-btn').click()
    await expect(panel.locator('#page-select')).not.toContainText('%')
    await panel.locator('#results-btn').click()
    await expect(panel.locator('#results .results-summary .rate')).toHaveCount(0)
    await panel.locator('#audit-btn').click()
    await expect(panel.locator('#audit .level-note')).toBeVisible()
    await expect(panel.locator('#audit .donut')).toHaveCount(0)
    await expect(panel.locator('#audit')).toContainText('Diagnostic partiel')
    const [download] = await Promise.all([
      panel.waitForEvent('download'),
      panel.getByRole('button', { name: 'Télécharger le rapport (HTML)' }).click(),
    ])
    const html = readFileSync((await download.path())!, 'utf8')
    expect(html).toContain('Résultats de diagnostic uniquement')
    expect(html).not.toContain('class="statement"')
    expect(html).not.toContain('totalement conforme')
  }
  expect(problems).toEqual([])
})

test('a conflicting save preserves local work and offers a separate copy', async ({ context }) => {
  const { panel, problems } = await openRig(context)
  await panel.locator('#empty-add-btn').click()
  await expect(panel.locator('#save-state')).toContainText('Enregistré')
  const originalId = await panel.evaluate(async () => {
    const key = Object.keys(localStorage).find(k => k.startsWith('e2e-chrome-storage:rgaa-audit:'))!
    const audit = JSON.parse(localStorage.getItem(key)!)
    audit.name = 'Saved in another panel'
    const result = await (window as any).chrome.runtime.sendMessage({ type: 'RGAA_SAVE', audit, revision: 1 })
    if (!result.ok) throw new Error(result.error)
    return audit.id as string
  })
  await panel.locator('.theme-tab', { hasText: 'Éléments obligatoires' }).click()
  await panel.locator('label[for="chk-8.1-nc"]').click()
  await expect(panel.locator('#save-state')).toContainText(/non enregistré|Échec|Erreur/i)
  await panel.locator('#save-retry-btn').click()
  await expect(panel.locator('#choice-dialog')).toBeVisible()
  await panel.getByRole('button', { name: 'Enregistrer mes modifications dans une copie' }).click()
  await expect(panel.locator('#save-state')).toContainText('Enregistré')
  const audits = await panel.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('e2e-chrome-storage:rgaa-audit:')).map(k => JSON.parse(localStorage.getItem(k)!)))
  expect(audits).toHaveLength(2)
  expect(audits.find(a => a.id === originalId).name).toBe('Saved in another panel')
  expect(audits.find(a => a.id !== originalId).pages[0].checklist['8.1'].verdict).toBe('nc')
  expect(problems).toEqual([])
})

test('known omitted shadow content requires a manual decision again after rescan', async ({ context }) => {
  const { panel, site, problems } = await openRig(context)
  await site.evaluate(() => {
    const host = document.createElement('div')
    host.attachShadow({ mode: 'open' }).innerHTML = '<a href="#inside">A link outside the scanner</a>'
    document.body.append(host)
  })
  await panel.locator('#empty-add-btn').click()
  await scanElements(panel)
  await panel.locator('.theme-tab', { hasText: 'Liens' }).click()
  const card = panel.locator('[id="crit-card-6.1"]')
  await expect(card).toContainText('Vérification manuelle du périmètre')
  await card.locator('input[value="c"] + label').click()
  await expect(card.locator('input[value="c"]')).toBeChecked()
  await scanElements(panel)
  await panel.locator('.theme-tab', { hasText: 'Liens' }).click()
  await expect(card.locator('input:checked')).toHaveCount(0)
  expect(problems).toEqual([])
})
