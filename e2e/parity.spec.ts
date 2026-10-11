import { expect, test as base, type Page } from '@playwright/test'
import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { openRig, type Rig } from './harness'

/**
 * Panel parity check: walks through every screen of the panel on a seeded audit (the fixture site, scanned in all
 * the themes, automatic checks run) and snapshots the visible DOM of each screen, normalised (dates, thumbnails).
 * It guards the refactoring of src/panel/panel.ts: the text file must not change when the code is only moved.
 * The snapshot keeps one hash per screen (the full text is 3 MB): to see what changed, run with PARITY_DUMP=/some/file.txt
 * on both versions and diff the two files. Update the snapshot on purpose with `npx playwright test parity --update-snapshots`.
 */
const test = base.extend<{ rig: Rig }>({
  rig: async ({ context }, use) => {
    await use(await openRig(context))
  },
})

/** The visible part of the panel as indented text, without what changes from one run to the next. */
async function serialize(panel: Page): Promise<string> {
  const html = await panel.evaluate(() => {
    const parts: string[] = []
    for (const child of Array.from(document.body.children)) {
      if (getComputedStyle(child).display === 'none' || child.hasAttribute('hidden') || ['SCRIPT', 'DIALOG', 'INPUT'].includes(child.tagName)) continue
      const clone = child.cloneNode(true) as HTMLElement
      // form state is a property, not an attribute: write it down
      const src = [child, ...Array.from(child.querySelectorAll('input, textarea, select'))] as HTMLInputElement[]
      const dst = [clone, ...Array.from(clone.querySelectorAll('input, textarea, select'))] as HTMLInputElement[]
      src.forEach((el, i) => {
        if (!('value' in el)) return
        if (el.type === 'radio' || el.type === 'checkbox') dst[i].setAttribute('data-snap-checked', String(el.checked))
        else dst[i].setAttribute('data-snap-value', el.value)
      })
      // the page's own boxes, shown in the code of the context: their colour code follows a debounced push
      for (const line of Array.from(clone.querySelectorAll('.code .line'))) {
        if (/data-color|position:/.test(line.textContent ?? '')) line.textContent = '(overlay of the page)'
      }
      parts.push(clone.outerHTML)
    }
    return `<title>${document.title}</title>\n${parts.join('\n')}`
  })
  return html
    .replace(/(src|href)="(data|blob):[^"]*"/g, '$1="$2:…"')
    .replace(/ style="(min-height: ?\d+px;?)?"/g, '')
    .replace(/<span class="line">(\s*)\? /g, '<span class="line">$1')
    .replace(/<span class="text">\? /g, '<span class="text">')
    .replace(/\d{1,2} [\p{L}.]+,? \d{1,2}:\d{2}/gu, 'DATE HH:MM')
    .replace(/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2},? \d{1,2}:\d{2}(?:\s?[AP]M)?/g, 'DATE HH:MM')
    .replace(/\d{1,2}:\d{2}(?:\s?[AP]M)?/g, 'HH:MM')
    .replace(/\d{4}-\d{2}-\d{2}/g, 'YYYY-MM-DD')
    .replace(/></g, '>\n<')
}

test('every screen of the panel matches the reviewed baseline', async ({ rig }) => {
  test.setTimeout(180_000)
  const { panel } = rig
  const out: string[] = []
  const shot = async (name: string) => {
    await panel.waitForTimeout(250) // the debounced box colours and the async renders settle
    await expect(panel.locator('#save-state')).not.toContainText(/Enregistrement|Saving/)
    out.push(`===== ${name} =====\n${await serialize(panel)}`)
  }
  const status = panel.locator('#status')

  await shot('00 empty')
  await panel.locator('#empty-add-btn').click()
  await expect(status).toContainText('P01 enregistrée')
  await shot('01 registered, not scanned')

  // every theme of the page
  await panel.locator('.themebar .themes-menu summary').click()
  await panel.locator('.themebar .menu-actions button').first().click()
  await expect(panel.locator('.theme-tab')).toHaveCount(13)

  await panel.locator('#auto-btn').click()
  await expect(status).toContainText('Contrôles automatiques de P01', { timeout: 60_000 })
  await expect(panel.locator('#auto-btn')).toBeEnabled()
  await expect(panel.locator('#checks')).toBeVisible()
  await shot('02 checks after the automatic run')
  // a manual check
  await panel.locator('#checks .check-row').first().locator('label').nth(2).click()
  await shot('03 checks, one problem noted')

  await panel.getByRole('button', { name: '← Retour à la relecture' }).click()
  await shot('04 images')

  // Images
  const items = panel.locator('#element-list .item')
  await items.nth(1).click()
  await shot('05 images, unnamed one selected (problem banner)')
  await panel.locator('.problem-actions button').first().click()
  await shot('06 images, applied from the problem banner')
  await items.nth(0).click()
  await panel.locator('label[for="kind-1-decorative"]').click()
  await shot('07 images, kind chosen')
  await panel.locator('label[for="crit-1-1.2-nc"]').click()
  await shot('08 images, criterion answered')
  await items.nth(2).click()
  await panel.locator('#detail textarea').fill('Une note')
  await shot('09 images, note typed')
  await panel.locator('#filters .chip').nth(1).click()
  await shot('10 images, filter to review')
  await panel.locator('#filters .chip').nth(0).click()
  await panel.keyboard.press('j')
  await shot('11 images, next with the keyboard')

  // every theme tab
  const tabs = panel.locator('.theme-tab')
  const count = await tabs.count()
  for (let i = 1; i < count; i++) {
    await tabs.nth(i).click()
    const label = (await tabs.nth(i).innerText()).replace(/\s+/g, ' ').trim()
    await shot(`theme ${label}`)
    if (await panel.locator('.finding-pane').count()) {
      const findings = panel.locator('.finding-pane .item.finding')
      if ((await findings.count()) > 1) {
        await findings.nth(1).click()
        await shot(`theme ${label}, second finding`)
      }
      const hex = panel.locator('.contrast-checker input.hex').first()
      if (await hex.count()) {
        await hex.fill('#000000')
        await shot(`theme ${label}, contrast checker with black text`)
        await panel.locator('.contrast-checker input.hex').first().fill('#cccccc')
        await shot(`theme ${label}, contrast checker with light text`)
      }
      const verdict = panel.locator('.finding-detail .verdicts label').first()
      if (await verdict.count()) {
        await verdict.click()
        await shot(`theme ${label}, finding verdict clicked`)
      }
      const chips = panel.locator('.finding-pane .chip')
      if ((await chips.count()) > 1) {
        await chips.nth(1).click()
        await shot(`theme ${label}, filter to review`)
        await chips.nth(0).click()
      }
    }
    const checklistVerdict = panel.locator('#theme-view .checklist .verdicts label').first()
    if (await checklistVerdict.count()) {
      await checklistVerdict.click()
      await shot(`theme ${label}, checklist verdict clicked`)
    }
    const confirm = panel.locator('#theme-view .source-note button').first()
    if (await confirm.count()) {
      await confirm.click()
      await shot(`theme ${label}, suggestion confirmed`)
    }
  }

  // page totals: a total jumps to its first element
  await panel.locator('#page-summary .pill').nth(2).click()
  await shot('totals: to review')
  await panel.locator('#next-btn').click()
  await shot('next to review')

  // views
  await panel.locator('#results-btn').click()
  await shot('page results')
  const sheetTabs = panel.locator('#results .sheet-tabs button')
  for (let i = 1; i < (await sheetTabs.count()); i++) {
    await sheetTabs.nth(i).click()
    await shot(`page results, sheet ${i}`)
  }
  await panel.locator('#audit-btn').click()
  await shot('audit overview')
  const auditTabs = panel.locator('#audit .sheet-tabs button')
  for (let i = 1; i < (await auditTabs.count()); i++) {
    await auditTabs.nth(i).click()
    await shot(`audit overview, sheet ${i}`)
  }
  await panel.locator('#sample-btn').click()
  await shot('sample')
  await panel.locator('#audits-btn').click()
  await expect(panel.locator('#audits table')).toBeVisible()
  await shot('audits list')
  await panel.locator('#audits').getByRole('button', { name: '← Retour à la relecture' }).click()
  await panel.locator('#checks-btn').click()
  await shot('checks')

  // English
  await panel.locator('#lang-en').click()
  await shot('checks, English')
  await panel.getByRole('button', { name: '← Back to review' }).click()
  await shot('review, English')
  await panel.locator('.theme-tab').nth(2).click()
  await shot('theme 3, English')
  await panel.locator('#lang-fr').click()

  const full = out.join('\n')
  if (process.env.PARITY_DUMP) writeFileSync(process.env.PARITY_DUMP, full)
  const digest = out.map((section) => {
    const [title, ...body] = section.split('\n')
    return `${title.replace(/^=+ | =+$/g, '').padEnd(70)} ${createHash('sha1').update(body.join('\n')).digest('hex').slice(0, 10)} ${body.join('\n').length}`
  })
  expect(digest.join('\n') + '\n').toMatchSnapshot('panel-parity.txt')
})
