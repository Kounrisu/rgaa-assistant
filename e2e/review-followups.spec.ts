import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { openRig, scanElements, SITE_URL } from './harness'

const saved = (panel: Page) => panel.evaluate(() => {
  const key = Object.keys(localStorage).find(k => k.startsWith('e2e-chrome-storage:rgaa-audit:'))!
  return JSON.parse(localStorage.getItem(key)!)
})

test('audit-type arrows retain focus and manual questions name their answer groups', async ({ context }) => {
  const { panel, problems } = await openRig(context)
  await panel.locator('#empty-add-btn').click()
  await panel.locator('#sample-btn').click()
  await panel.locator('#audit-level-complet').focus()
  await panel.keyboard.press('ArrowRight')
  await expect(panel.locator('#audit-level-rapide')).toBeFocused()
  await panel.keyboard.press('ArrowRight')
  await expect(panel.locator('#audit-level-complementaire')).toBeFocused()
  await panel.locator('label[for="audit-level-complet"]').click()
  await panel.locator('#evaluate-page-btn').click()
  await panel.locator('.themebar .themes-menu summary').click()
  const themeToggle = panel.locator('[data-focus-key="theme-review-P01-2"]')
  await themeToggle.uncheck()
  await expect(themeToggle).toBeFocused()
  await themeToggle.check()
  await expect(themeToggle).toBeFocused()
  await panel.locator('.themebar .themes-menu summary').click()
  await panel.locator('#checks-btn').click()
  const question = panel.getByRole('group', { name: /Pas de piège au clavier/ })
  await expect(question).toBeVisible()
  await question.locator('label[for="mc-kb-trap-issue"]').click()
  await expect(panel.locator('#mc-kb-trap-issue')).toBeFocused()
  await expect(question).toContainText('Problème manuel non résolu')
  await question.locator('#mc-link-kb-trap').selectOption('12.9')
  await question.getByRole('button', { name: 'Évaluer RGAA 12.9' }).click()
  await panel.locator('label[for="chk-12.9-nc"]').click()
  await panel.locator('#checks-btn').click()
  await expect(question).toContainText('reliée à un critère non conforme confirmé')
  await panel.locator('#audit-btn').click()
  await expect(panel.locator('.manual-final-review')).toHaveCount(0)
  expect(problems).toEqual([])
})

test('a tab navigation during previews discards the interrupted scan instead of saving mixed evidence', async ({ context }) => {
  const { panel, site, problems } = await openRig(context)
  await panel.locator('#empty-add-btn').click()
  await expect(panel.locator('#save-state')).toContainText('Enregistré')
  await panel.evaluate(() => {
    const win = window as any
    const send = win.chrome.runtime.sendMessage
    win.chrome.runtime.sendMessage = async (message: any) => {
      if (message.type === 'RGAA_CAPTURE') {
        await new Promise<void>(resolve => { win.__finishInterruptedCapture = resolve })
        return { error: 'changed', code: 'changed' }
      }
      return send(message)
    }
  })
  await panel.locator('#scan-btn').click()
  await expect.poll(() => panel.evaluate(() => Boolean((window as any).__finishInterruptedCapture))).toBe(true)
  await site.evaluate(() => history.replaceState(null, '', '?different-page'))
  await panel.evaluate(url => (window as any).__rgaaNavigated(url), `${SITE_URL}?different-page`)
  await expect(panel.locator('#page-select')).toBeDisabled()
  await panel.evaluate(() => (window as any).__finishInterruptedCapture())
  await expect(panel.locator('#status')).toContainText('Repérage arrêté')
  await expect(panel.locator('#scan-btn')).toBeEnabled()
  const [download] = await Promise.all([panel.waitForEvent('download'), panel.locator('#save-file-btn').click()])
  const exported = JSON.parse(readFileSync((await download.path())!, 'utf8')).audit
  expect(exported.pages[0].items).toEqual([])
  expect(exported.pages[0].scanCount).toBe(0)
  expect((await saved(panel)).pages[0].items).toEqual([])
  expect((await saved(panel)).pages[0].url).toBe(SITE_URL)
  expect((await saved(panel)).pages[0].scanCount).toBe(0)
  expect(problems).toEqual([])
})

test('URL editing rejects invalid and duplicate values and preserves evidence when creating a replacement', async ({ context }) => {
  const { panel, problems } = await openRig(context)
  await panel.locator('#empty-add-btn').click()
  await scanElements(panel)
  await expect(panel.locator('#save-state')).toContainText('Enregistré')
  const original = (await saved(panel)).pages[0]
  await panel.locator('#sample-btn').click()
  const url = panel.locator('#page-url-P01')
  await url.fill('not-a-url'); await url.press('Tab')
  await expect(url).toHaveAttribute('aria-invalid', 'true')
  expect((await saved(panel)).pages[0].url).toBe(SITE_URL)
  await url.fill(`${SITE_URL}?replacement`); await url.press('Tab')
  await panel.getByRole('button', { name: 'Créer une nouvelle page', exact: true }).click()
  await expect(panel.locator('#save-state')).toContainText('Enregistré')
  const audit = await saved(panel)
  expect(audit.pages).toHaveLength(2)
  expect(audit.pages[0].items).toEqual(original.items)
  expect(audit.pages[0].url).toBe(SITE_URL)
  expect(audit.pages[1].items).toEqual([])
  const second = panel.locator('tr').filter({ has: panel.locator('#page-url-P02') })
  await second.getByRole('button', { name: 'Utiliser l’URL actuelle' }).click()
  await expect(panel.locator('#page-url-P02')).toHaveAttribute('aria-invalid', 'true')
  expect((await saved(panel)).pages[1].url).toBe(`${SITE_URL}?replacement`)
  const replacement = panel.locator('#page-url-P02')
  await replacement.fill(`${SITE_URL}?corrected`); await replacement.press('Tab')
  await panel.getByRole('button', { name: 'Corriger l’adresse de la même page', exact: true }).click()
  await expect(panel.locator('#save-state')).toContainText('Enregistré')
  expect((await saved(panel)).pages[1].urlHistory[0].url).toBe(`${SITE_URL}?replacement`)
  await panel.locator('#page-up-P02').click()
  await expect(panel.locator('#page-down-P02')).toBeFocused()
  expect(problems).toEqual([])
})

test('plain letters on unrelated controls do not navigate and current decision is reachable at 320px', async ({ context }, testInfo) => {
  const { panel, problems } = await openRig(context)
  await panel.setViewportSize({ width: 320, height: 720 })
  await panel.locator('#empty-add-btn').click()
  await scanElements(panel)
  const before = await panel.locator('#detail h2').innerText()
  await panel.locator('#audit-name-btn').focus()
  await panel.keyboard.press('j'); await panel.keyboard.press('n')
  expect(await panel.locator('#detail h2').innerText()).toBe(before)
  await panel.locator('#current-decision-btn').click()
  expect(await panel.evaluate(() => Boolean(document.activeElement?.closest('#detail')))).toBe(true)
  expect(await panel.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await expect(panel.locator('#theme-view')).not.toContainText('Needs a human')
  await panel.screenshot({ path: testInfo.outputPath('current-decision-320.png') })
  expect(problems).toEqual([])
})

for (const view of ['sample', 'audit']) test(`delayed preview capture preserves navigation to ${view} and locks page identity`, async ({ context }) => {
  const { panel, problems } = await openRig(context)
  await panel.locator('#empty-add-btn').click()
  await panel.evaluate(() => {
    const win = window as any
    const send = win.chrome.runtime.sendMessage
    let delayed = false
    win.chrome.runtime.sendMessage = async (message: any) => {
      if (message.type === 'RGAA_CAPTURE' && !delayed) {
        delayed = true
        await new Promise<void>(resolve => { win.__finishCapture = resolve })
      }
      return send(message)
    }
  })
  await panel.locator('#scan-btn').click()
  await expect.poll(() => panel.evaluate(() => Boolean((window as any).__finishCapture))).toBe(true)
  await expect(panel.locator('#page-select')).toBeDisabled()
  await expect(panel.locator('#audits-btn')).toBeDisabled()
  await panel.locator(`#${view}-btn`).click()
  await expect(panel.locator(`#${view}`)).toBeVisible()
  await panel.evaluate(() => (window as any).__finishCapture())
  await expect(panel.locator('#status')).toContainText(/P\d+ analysée|P\d+ scanned:/, { timeout: 30000 })
  await expect(panel.locator(`#${view}`)).toBeVisible()
  await expect(panel.locator('#audits-btn')).toBeEnabled()
  await expect(panel.locator('#save-state')).toContainText('Enregistré')
  expect((await saved(panel)).pages[0].scanCount).toBe(1)
  expect(problems).toEqual([])
})
