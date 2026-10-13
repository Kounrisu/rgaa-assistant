import { expect, test } from '@playwright/test'
import { scanElements, openRig, type Rig } from './harness'
import type { PageRecord } from '../src/lib/types'

// Reopen a saved audit with known verdicts; clicks and destinations use the real built panel.
async function restorePage(rig: Rig, patch: Partial<PageRecord>) {
  await expect.poll(() => rig.panel.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith('e2e-chrome-storage:rgaa-audit:'))
    return key ? JSON.parse(localStorage.getItem(key)!).pages.length : 0
  })).toBe(1)
  await expect(rig.panel.locator('#save-state')).toContainText('Enregistré')
  await rig.panel.evaluate((patch) => {
    const key = Object.keys(localStorage).find((k) => k.startsWith('e2e-chrome-storage:rgaa-audit:'))!
    const audit = JSON.parse(localStorage.getItem(key)!)
    Object.assign(audit.pages[0], patch)
    localStorage.setItem(key, JSON.stringify(audit))
  }, patch)
  await rig.reloadPanel()
  await expect(rig.panel.locator('#page-progress')).toBeVisible()
}

test('each page status opens its matching checklist criterion with keyboard focus', async ({ context }) => {
  const rig = await openRig(context)
  const { panel } = rig
  await panel.locator('#empty-add-btn').click()
  await restorePage(rig, {
    themes: [8],
    checklist: {
      '8.1': { verdict: 'c', note: '' },
      '8.2': { verdict: 'nc', note: '' },
      '8.3': { verdict: 'na', note: '' },
      '8.5': { suggested: 'c', source: 'axe', note: '' },
      '8.6': { suggested: 'nc', source: 'axe', note: '' },
    },
  })
  for (const [status, criterion, answer] of [
    ['c', '8.1', 'c'], ['nc', '8.2', 'nc'], ['na', '8.3', 'na'],
    ['pending', '8.4', 'c'], ['suggested', '8.5', 'c'], ['unconfirmed', '8.6', 'c'],
  ]) {
    await panel.locator('#results-btn').click()
    const shortcut = panel.locator(`#page-summary .sum-${status}`)
    await expect(shortcut).toBeVisible()
    await shortcut.focus()
    await shortcut.press('Enter')
    await expect(panel.locator('#theme-view')).toBeVisible()
    await expect(panel.locator(`[id="chk-${criterion}-${answer}"]`)).toBeFocused()
  }
  await restorePage(rig, { checklist: {} })
  await expect(panel.locator('#page-summary .sum-c')).toBeDisabled()
  await expect(panel.locator('#page-summary .sum-nc')).toBeDisabled()
  await expect(panel.locator('#page-summary .sum-na')).toBeDisabled()
  expect(rig.problems).toEqual([])
})

test('image status shortcuts select the relevant image or focus the test breakdown', async ({ context }) => {
  const rig = await openRig(context)
  const { panel } = rig
  await panel.locator('#empty-add-btn').click()
  await scanElements(panel)
  await expect(panel.locator('#save-state')).toContainText('Enregistré')
  const items = await panel.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith('e2e-chrome-storage:rgaa-audit:'))!
    return JSON.parse(localStorage.getItem(key)!).pages[0].items as PageRecord['items']
  })
  await restorePage(rig, {
    reviews: {
      [items[0].key]: { kind: 'decorative', answers: { '1.2': 'c' }, note: '' },
      [items[1].key]: { kind: 'informative', answers: { '1.1': 'nc' }, auto: true, note: '' },
    },
  })
  for (const status of ['nc', 'unconfirmed']) {
    await panel.locator(`#page-summary .sum-${status}`).click()
    await expect(panel.locator(`[id="crit-${items[1].id}-1.1-nc"]`)).toBeFocused()
  }
  // 1.1 already fails; the first pending criterion is 1.2, whose first undecided image is #3.
  await panel.locator('#page-summary .sum-pending').click()
  await expect(panel.locator(`[id="kind-${items[2].id}-informative"]`)).toBeFocused()
  // partial coverage: not the grid, but the card that says which tests the tool does not assess and what to check by hand
  await panel.locator('#page-summary .sum-partial').click()
  await expect(panel.locator('#results')).toBeHidden()
  const card = panel.locator('[id="partial-card-1.1"]')
  await expect(card).toBeFocused()
  await expect(card).toContainText('1.1.4')
  // the criteria no image answers (1.4) are checklist cards at the end of the Images page
  await panel.locator('#theme-todo .todo-chip[data-crit="1.4"]').click()
  await expect(panel.locator('input[name="chk-1.4"]').first()).toBeFocused()
  expect(rig.problems).toEqual([])
})

test('finding totals jump to the failed criterion, not another failure on the first element', async ({ context }) => {
  const rig = await openRig(context)
  const { panel } = rig
  await panel.locator('#empty-add-btn').click()
  await restorePage(rig, { themes: [11] })
  await scanElements(panel)
  await expect.poll(() => panel.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith('e2e-chrome-storage:rgaa-audit:'))!
    return JSON.parse(localStorage.getItem(key)!).pages[0].findings.length
  })).toBe(2)
  const findings = await panel.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith('e2e-chrome-storage:rgaa-audit:'))!
    return JSON.parse(localStorage.getItem(key)!).pages[0].findings as PageRecord['findings']
  })
  await restorePage(rig, {
    findingReviews: {
      [findings[0].key]: { answers: { '11.1': 'c', '11.2': 'nc', '11.13': 'na' }, note: '' },
      [findings[1].key]: { answers: { '11.1': 'nc', '11.2': 'c', '11.13': 'na' }, note: '' },
    },
  })
  await panel.locator('#page-summary .sum-nc').click()
  await expect(panel.locator(`[id="fnd-${findings[1].id}-11.1-nc"]`)).toBeFocused()
  // Theme-level totals offer the same navigation and preserve the relevant criterion.
  await panel.locator('#theme-summary .sum-na').click()
  await expect(panel.locator(`[id="fnd-${findings[0].id}-11.13-na"]`)).toBeFocused()
  expect(rig.problems).toEqual([])
})

test('page and theme summaries have explicit scopes; unselected criteria remain reachable', async ({ context }) => {
  const rig = await openRig(context)
  const { panel } = rig
  await panel.locator('#empty-add-btn').click()
  await restorePage(rig, { themes: [8], checklist: { '8.1': { verdict: 'c', note: '' } } })
  await expect(panel.locator('#page-summary-title')).toHaveText('Bilan de la page — P01')
  await expect(panel.locator('#theme-summary-title')).toHaveText('Bilan de la thématique — Éléments obligatoires · 1/10 critères RGAA confirmés')
  const countStatuses = (selector: string) => panel.locator(`${selector} > button > strong`).evaluateAll((nodes) => nodes.reduce((sum, node) => sum + Number(node.textContent), 0))
  expect(await countStatuses('#page-summary')).toBe(106)
  expect(await countStatuses('#theme-summary')).toBe(10)
  await expect(panel.locator('#page-summary .sum-unassessed')).toContainText('96')
  await panel.locator('#page-summary .sum-unassessed').focus()
  await panel.keyboard.press('Enter')
  await expect(panel.locator('tr[data-crit="1.1"]').first()).toBeFocused()
  await panel.locator('#review-btn').click()
  await expect(panel.locator('.theme-tab')).toHaveCount(1)
  await expect(panel.locator('#theme-summary-title')).toContainText('Éléments obligatoires')

  // A second page starts independently: the visible summary and saved answer follow the selection.
  await panel.locator('#sample-btn').click()
  await panel.getByLabel('URL de la nouvelle page', { exact: true }).fill('http://127.0.0.1:4174/index.html?second')
  await panel.locator('.add-page button.primary').click()
  await panel.locator('#evaluate-page-btn').click()
  await expect(panel.locator('#page-summary-title')).toHaveText('Bilan de la page — P02')
  await expect(panel.locator('#page-summary .sum-c')).toBeDisabled()
  expect(await countStatuses('#page-summary')).toBe(106)
  await panel.locator('#page-select').selectOption({ index: 0 })
  await expect(panel.locator('#page-summary-title')).toHaveText('Bilan de la page — P01')
  await expect(panel.locator('#page-summary .sum-c')).toContainText('1')
  await panel.locator('#lang-en').click()
  await expect(panel.locator('#page-summary-title')).toHaveText('Page summary — P01')
  await expect(panel.locator('#display-tools-title')).toHaveText('Display tools')
  expect(rig.problems).toEqual([])
})

test('relocated reset actions retain confirmation and affect only their stated scope', async ({ context }) => {
  const rig = await openRig(context)
  const { panel } = rig
  await panel.locator('#empty-add-btn').click()
  await restorePage(rig, { themes: [8, 9], checklist: { '8.1': { verdict: 'c', note: '' }, '9.1': { verdict: 'nc', note: 'Keep this answer' } } })
  await panel.locator('.theme-tab').filter({ hasText: 'Éléments obligatoires' }).click()
  await panel.locator('#reset-theme-btn').click()
  await expect(panel.locator('#confirm-title')).toContainText('Éléments obligatoires')
  await panel.locator('#confirm-cancel').click()
  await expect(panel.locator('[id="chk-8.1-c"]')).toBeChecked()
  await panel.locator('#reset-theme-btn').click()
  await panel.locator('#confirm-ok').click()
  await expect(panel.locator('[id="chk-8.1-c"]')).not.toBeChecked()
  await expect.poll(() => panel.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith('e2e-chrome-storage:rgaa-audit:'))!
    return JSON.parse(localStorage.getItem(key)!).pages[0].checklist['9.1'].note
  })).toBe('Keep this answer')
  await panel.locator('#sample-btn').click()
  const row = panel.locator('.sample-table tbody tr').first()
  await row.getByRole('button', { name: 'Réinitialiser', exact: true }).click()
  await panel.locator('#confirm-cancel').click()
  await expect(row).toBeVisible()
  await row.getByRole('button', { name: 'Retirer', exact: true }).click()
  await panel.locator('#confirm-cancel').click()
  await expect(panel.locator('.sample-table tbody tr')).toHaveCount(1)
  expect(rig.problems).toEqual([])
})
