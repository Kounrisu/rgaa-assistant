import { expect, test as base } from '@playwright/test'
import { openRig, scanElements, type Rig } from './harness'

/** Every theme by default, boxes for tables, "how do I finish this theme?" (what is left, partial coverage, nothing here), confirmed failures. */
const test = base.extend<{ rig: Rig }>({ rig: async ({ context }, use) => use(await openRig(context)) })

test('a page has the 13 themes by default and the Tables boxes are on the page', async ({ rig }) => {
  test.setTimeout(120_000)
  const { panel, site } = rig
  await panel.locator('#empty-add-btn').click()
  await expect(panel.locator('.theme-tab')).toHaveCount(13)
  await scanElements(panel)
  await panel.locator('.theme-tab', { hasText: 'Tableaux' }).click()
  await expect
    .poll(() => site.evaluate(() => { const c = document.getElementById('rgaa-assistant-overlay-t5'); return c ? [getComputedStyle(c).display, c.querySelectorAll('[data-id]').length] : null }))
    .toEqual(['block', 1])
})

test('what is left in a theme, partial coverage you can resolve, a theme with nothing to check, a confirmed failure', async ({ rig }) => {
  test.setTimeout(180_000)
  const { panel } = rig
  await panel.locator('#empty-add-btn').click()
  await scanElements(panel)
  /** The number in front of a pill (0 when the pill is not there). */
  const count = async (selector: string) => {
    const pill = panel.locator(selector).first()
    return (await pill.count()) ? Number(/\d+/.exec((await pill.textContent()) ?? '')?.[0] ?? 0) : 0
  }

  // Images: the questions no image answers (1.4, 1.5) are open criteria with a button that goes to them
  const todo = panel.locator('#theme-todo')
  await expect(todo).toContainText('Reste à faire dans cette thématique')
  await expect(todo.locator('.todo-chip[data-crit="1.4"]')).toBeVisible()
  await todo.locator('.todo-chip[data-crit="1.4"]').click()
  await expect(panel.locator('input[name="chk-1.4"]').first()).toBeFocused()
  await panel.locator('label[for="chk-1.4-na"]').click()
  await panel.locator('label[for="chk-1.5-na"]').click()
  await expect(todo.locator('.todo-chip[data-crit="1.4"]')).toHaveCount(0)

  // partial coverage: the pill leads to a card (not the grid), and ticking "checked by hand" lifts it
  const partialBefore = await count('#theme-summary .sum-partial')
  expect(partialBefore).toBeGreaterThan(0)
  await panel.locator('#theme-summary .sum-partial').click()
  const card = panel.locator('[id="partial-card-1.1"]') // a stable locator: the cards are redrawn after each tick
  await expect(card).toBeFocused()
  await expect(card).toContainText('ne sont pas évalués par cet outil')
  await card.locator('input[type="checkbox"]').check()
  await expect.poll(() => count('#theme-summary .sum-partial')).toBe(partialBefore - 1)

  // a theme with nothing to check on the page (no multimedia): one button records the open criteria as not applicable
  await panel.locator('.theme-tab', { hasText: 'Multimédia' }).click()
  const na = panel.locator('#theme-todo .todo-na-btn')
  await expect(na).toBeVisible()
  await expect(na).toContainText('13')
  await na.click()
  await expect(panel.locator('#confirm-dialog')).toBeVisible()
  await panel.locator('#confirm-ok').click()
  await expect(panel.locator('#theme-todo .todo-done')).toContainText('Thématique terminée')
  await expect(panel.locator('#theme-summary .sum-na strong').first()).toHaveText('13')
  await expect(panel.locator('.theme-tab', { hasText: 'Multimédia' })).toContainText('13/13')

  // a failure the scan found: confirming the failed image makes the failure confirmed, and the count goes down at once
  await panel.locator('.theme-tab', { hasText: 'Images' }).click()
  const failures = panel.locator('#theme-summary button', { hasText: 'échec(s) à confirmer' })
  await expect(failures).toBeVisible()
  const failBefore = await count('#theme-summary button:has-text("échec(s) à confirmer")')
  await failures.click()
  const focused = await panel.evaluate(() => (document.activeElement as HTMLInputElement | null)?.name ?? '')
  expect(focused).toMatch(/^crit-\d+-1\.1$/)
  await panel.locator(`input[name="${focused}"][value="nc"] + label`).click()
  await expect.poll(() => count('#theme-summary button:has-text("échec(s) à confirmer")')).toBeLessThan(failBefore)
})

test('a theme with nothing on the page shows its criteria as not applicable, and the "not applicable" suggestions of the checks confirm together', async ({ rig }) => {
  test.setTimeout(180_000)
  const { panel } = rig
  await panel.locator('#empty-add-btn').click()
  await panel.locator('#auto-btn').click()
  await expect(panel.locator('#status')).toContainText('Contrôles automatiques de P01', { timeout: 90_000 })
  await panel.locator('#review-btn').click()

  // Frames: the fixture has no iframe, the scan found nothing: 2.1 and 2.2 are shown answered "not applicable"
  await panel.locator('.theme-tab', { hasText: 'Cadres' }).click()
  const rows = panel.locator('.na-list .na-row')
  await expect(rows).toHaveCount(2)
  await expect(rows.first()).toContainText('RGAA 2.1')
  await expect(rows.first()).toContainText('Non applicable')

  // Multimedia: no media on the page, the checks suggest "not applicable" criterion by criterion: one button confirms them
  await panel.locator('.theme-tab', { hasText: 'Multimédia' }).click()
  const confirm = panel.locator('#theme-todo .todo-na-confirm')
  await expect(confirm).toBeVisible()
  const n = Number(/\d+/.exec((await confirm.textContent()) ?? '')![0])
  expect(n).toBeGreaterThan(0)
  const naBefore = Number(/\d+/.exec((await panel.locator('#theme-summary .sum-na').textContent()) ?? '')![0])
  await confirm.click()
  await expect(panel.locator('#confirm-dialog')).toBeVisible()
  await panel.locator('#confirm-ok').click()
  await expect(panel.locator('#theme-todo .todo-na-confirm')).toHaveCount(0)
  await expect.poll(async () => Number(/\d+/.exec((await panel.locator('#theme-summary .sum-na').textContent()) ?? '')![0])).toBe(naBefore + n)
})

test('links: pre-filled answers keep the theme at 0 until you confirm them, and one button does it', async ({ rig }) => {
  test.setTimeout(120_000)
  const { panel } = rig
  await panel.locator('#empty-add-btn').click()
  await scanElements(panel)
  await panel.locator('.theme-tab', { hasText: 'Liens' }).click()
  const btn = panel.locator('#theme-todo .todo-prefilled-confirm')
  await expect(btn).toBeVisible()
  await expect(panel.locator('#theme-todo .todo-na').first()).toContainText('pré-remplie')
  await btn.click()
  await panel.locator('#confirm-ok').click()
  await expect(btn).toHaveCount(0)
  await expect(panel.locator('#theme-summary-title')).not.toContainText(' 0/2')
  expect(rig.problems).toEqual([])
})

test('clicking the answer an image was pre-filled with confirms it (the radio is already checked)', async ({ rig }) => {
  test.setTimeout(120_000)
  const { panel } = rig
  await panel.locator('#empty-add-btn').click()
  await scanElements(panel)
  const all = panel.locator('.confirm-all')
  await expect(all).toBeVisible()
  const before = Number(/\d+/.exec((await all.textContent()) ?? '')?.[0])
  // the image is selected; its kind radio is already checked because the scan pre-filled it
  const checked = panel.locator('input[id^="kind-"]:checked').first()
  await panel.locator(`label[for="${await checked.getAttribute('id')}"]`).click()
  const after = (await all.count()) ? Number(/\d+/.exec((await all.textContent()) ?? '')?.[0]) : 0
  expect(after).toBe(before - 1)
  expect(rig.problems).toEqual([])
})
