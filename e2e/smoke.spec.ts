import { expect, test as base, type Download, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { openRig, SITE_URL, type Rig } from './harness'

/** The rig, plus a failure report: the panel status line, the progress and every console error of both pages. */
const test = base.extend<{ rig: Rig }>({
  rig: async ({ context }, use, testInfo) => {
    const rig = await openRig(context)
    await use(rig)
    if (testInfo.status !== testInfo.expectedStatus) {
      const text = async (sel: string) => rig.panel.locator(sel).innerText({ timeout: 1000 }).catch(() => '(unavailable)')
      const report = [`status: ${await text('#status')}`, `save: ${await text('#save-state')}`, `progress: ${await text('#progress')}`, ...rig.problems].join('\n')
      console.log(`--- panel state at failure ---\n${report}`)
      await testInfo.attach('panel-state', { body: report, contentType: 'text/plain' })
    }
  },
})

const AUDIT_NAME = 'Audit smoke e2e'

const status = (panel: Page) => panel.locator('#status')

/** The audit as the background page wrote it (chrome.storage.local stub, backed by the panel origin's localStorage). */
async function storedAudit(panel: Page): Promise<any> {
  return panel.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith('e2e-chrome-storage:rgaa-audit:'))
    return key ? JSON.parse(localStorage.getItem(key)!) : null
  })
}

/** How many image reviews carry the auditor's own "compliant" for criterion 1.1 (the reviews are keyed by element key). */
function answeredReviews(audit: any): number {
  return Object.values<any>(audit?.pages?.[0]?.reviews ?? {}).filter((r) => r.kind === 'informative' && r.answers?.['1.1'] === 'c' && !r.auto).length
}

async function savedFile(download: Download): Promise<string> {
  const path = await download.path()
  if (!path) throw new Error('the download has no file')
  return path
}

test('scan, review, save, reload, export, save to file and reopen', async ({ rig }) => {
  const { panel } = rig
  const pillSaved = panel.locator('#save-state')

  await test.step('add the inspected page to the sample and scan it', async () => {
    await expect(panel.locator('#live-url')).toContainText('127.0.0.1:4174')
    await panel.locator('#empty-add-btn').click()
    await expect(status(panel)).toContainText('P01 enregistrée')
    await panel.locator('#scan-btn').click()
    await expect(status(panel)).toContainText('P01 analysée : 3 image(s)')
    // three <img> in the fixture: with alt, without alt, decorative (empty alt)
    await expect(panel.locator('#element-list .item')).toHaveCount(3)
    await expect(panel.locator('#images-summary')).toContainText('3 image(s)')
    await expect(panel.locator('#element-list .item[data-detected="named"]')).toHaveCount(1)
    await expect(panel.locator('#element-list .item[data-detected="unnamed"]')).toHaveCount(1)
    await expect(panel.locator('#element-list .item[data-detected="ignored"]')).toHaveCount(1)
    // the page identity comes from the site, not from a fake
    expect(await panel.locator('#page-select').inputValue()).toBe('P01')
  })

  await test.step('rename the audit', async () => {
    await panel.locator('#audit-name-btn').click()
    await panel.locator('#text-input').fill(AUDIT_NAME)
    await panel.locator('#text-ok').click()
    await expect(panel.locator('#audit-name-btn')).toHaveText(AUDIT_NAME)
  })

  await test.step('review the first image: answer a criterion', async () => {
    const first = panel.locator('#element-list .item').first()
    await expect(first).toHaveAttribute('data-status', 'todo')
    await panel.locator('label[for="kind-1-informative"]').click()
    await panel.locator('label[for="crit-1-1.1-c"]').click()
    await expect(panel.locator('#crit-1-1\\.1-c')).toBeChecked()
    // one criterion answered out of several: the image is "in progress", not compliant
    await expect(first).toHaveAttribute('data-status', 'progress')
    await expect(panel.locator('#result-badge')).toHaveText('En cours')
    await expect(pillSaved).toContainText('Enregistré')
    await expect.poll(async () => answeredReviews(await storedAudit(panel))).toBe(1)
  })

  await test.step('automatic checks (axe, RGAA, Asqatasun, HTML)', async () => {
    await panel.locator('#auto-btn').click()
    await expect(status(panel)).toContainText('Contrôles automatiques de P01', { timeout: 40_000 })
    await expect(panel.locator('#auto-btn')).toBeEnabled()
    // the run opens the Checks view by itself, with one report card per tool
    await expect(panel.locator('#checks')).toBeVisible()
    await panel.locator('#run-history > summary').click()
    await expect(panel.getByRole('heading', { name: /Contrôles automatiques \(axe\)/ })).toBeVisible()
    await expect(panel.getByRole('heading', { name: /Contrôles automatiques \(RGAA\)/ })).toBeVisible()
    // the fixture has an image without alt and an unnamed link: axe must have failed something
    await expect(status(panel)).toContainText(/\d+ règle\(s\) en échec/)
    // suggestions are kept apart from verdicts: some criterion is "suggested", and the auditor's answer is untouched
    await expect.poll(async () => {
      const page = (await storedAudit(panel))?.pages?.[0]
      const answers = Object.values<any>(page?.checklist ?? {})
      return answers.some((a) => a.suggested && a.verdict === undefined && a.source)
    }).toBe(true)
    const page = (await storedAudit(panel)).pages[0]
    expect(answeredReviews({ pages: [page] })).toBe(1)
    await panel.getByRole('button', { name: '← Retour à la relecture' }).click()
    await expect(panel.locator('#page-summary')).toContainText('à relire')
    await expect(pillSaved).toContainText('Enregistré')
  })

  await test.step('reload the panel: everything comes back', async () => {
    await rig.reloadPanel()
    await expect(panel.locator('#audit-name-btn')).toHaveText(AUDIT_NAME)
    await expect(panel.locator('#page-select')).toHaveValue('P01')
    await expect(panel.locator('#page-select option')).toHaveCount(1)
    await expect(panel.locator('#element-list .item')).toHaveCount(3)
    await expect(panel.locator('#element-list .item').first()).toHaveAttribute('data-status', 'progress')
    await panel.locator('#element-list .item').first().click()
    await expect(panel.locator('#crit-1-1\\.1-c')).toBeChecked()
    await expect(panel.locator('#kind-1-informative')).toBeChecked()
    await expect(status(panel)).toContainText(`Audit « ${AUDIT_NAME} » ouvert : 1 page(s)`)
  })

  await test.step('export the Excel grid', async () => {
    await panel.locator('#audit-btn').click()
    const [download] = await Promise.all([panel.waitForEvent('download'), panel.getByRole('button', { name: 'Exporter en Excel (toutes les pages)' }).click()])
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/)
    const bytes = readFileSync(await savedFile(download))
    expect(bytes.subarray(0, 2).toString('latin1')).toBe('PK') // an .xlsx is a zip
    expect(bytes.length).toBeGreaterThan(2000)
    expect(bytes.includes(Buffer.from('xl/workbook.xml'))).toBe(true)
  })

  await test.step('download the HTML report: provisional while the audit is incomplete', async () => {
    const [download] = await Promise.all([panel.waitForEvent('download'), panel.getByRole('button', { name: 'Télécharger le rapport (HTML)' }).click()])
    expect(download.suggestedFilename()).toMatch(/_rapport_.*\.html$/)
    const html = readFileSync(await savedFile(download), 'utf8')
    expect(html).toContain(AUDIT_NAME)
    expect(html.toLowerCase()).toMatch(/provisoire/)
    // the assistant's own boxes and tool layers are never reported as findings of the page
    expect(html).not.toContain('rgaa-assistant-overlay')
  })

  let rgaaFile = ''
  await test.step('save the audit to a .rgaa.json file', async () => {
    const [download] = await Promise.all([panel.waitForEvent('download'), panel.locator('#save-file-btn').click()])
    expect(download.suggestedFilename()).toMatch(/\.rgaa\.json$/)
    rgaaFile = await savedFile(download)
    const parsed = JSON.parse(readFileSync(rgaaFile, 'utf8'))
    expect(parsed.format).toBe('rgaa-assistant-audit')
    expect(parsed.audit.name).toBe(AUDIT_NAME)
    expect(parsed.audit.pages).toHaveLength(1)
    expect(parsed.audit.pages[0].url).toBe(SITE_URL)
    await expect(status(panel)).toContainText('Audit enregistré sous')
  })

  await test.step('a damaged file is refused and the open audit is left alone', async () => {
    await panel.locator('#import-file').setInputFiles({ name: 'broken.rgaa.json', mimeType: 'application/json', buffer: Buffer.from('{"format": "rgaa-assistant-audit", "audit": ') })
    await expect(status(panel)).not.toContainText('rouvert')
    await expect(status(panel)).toContainText(/fichier|format|invalide/i)
    await expect(panel.locator('#audit-name-btn')).toHaveText(AUDIT_NAME)
  })

  await test.step('open the file again: the audit is reopened, validated by the app', async () => {
    // change the open audit, so that reopening the file visibly brings the saved state back
    await panel.locator('#audit-name-btn').click()
    await panel.locator('#text-input').fill('Nom modifié après coup')
    await panel.locator('#text-ok').click()
    await expect(panel.locator('#audit-name-btn')).toHaveText('Nom modifié après coup')
    await expect(pillSaved).toContainText('Enregistré')
    const [chooser] = await Promise.all([panel.waitForEvent('filechooser'), panel.locator('#open-file-btn').click()])
    await chooser.setFiles(rgaaFile)
    // the same audit is already in the browser: the app asks before replacing it
    await expect(panel.locator('#confirm-dialog')).toBeVisible()
    await panel.locator('#confirm-ok').click()
    await expect(status(panel)).toContainText(`Audit « ${AUDIT_NAME} » rouvert depuis le fichier : 1 page(s)`)
    await expect(panel.locator('#audit-name-btn')).toHaveText(AUDIT_NAME)
    await expect(panel.locator('#element-list .item')).toHaveCount(3)
    await expect(pillSaved).toContainText('Enregistré')
  })

  expect(rig.problems, 'no console error, no uncaught exception, no external request').toEqual([])
})
