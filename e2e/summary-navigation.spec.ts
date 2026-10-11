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
  for (const [status, criterion] of [['partial', '1.1'], ['unassessed', '1.4']]) {
    await panel.locator(`#page-summary .sum-${status}`).click()
    await expect(panel.locator('#results')).toBeVisible()
    await expect(panel.locator(`tr[data-crit="${criterion}"]`).first()).toBeFocused()
  }
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
  await panel.locator('#theme-view .theme-summary .sum-na').click()
  await expect(panel.locator(`[id="fnd-${findings[0].id}-11.13-na"]`)).toBeFocused()
  expect(rig.problems).toEqual([])
})
