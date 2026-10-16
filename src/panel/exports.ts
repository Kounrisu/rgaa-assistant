/**
 * Getting data out of the panel: the Excel grid and the HTML report.
 */
import { type PageInput, thumbKey, buildWorkbook } from '../lib/audit-sheet'
import type { Sheet } from '../lib/xlsx'
import { say, download } from './dom'
import { t } from '../lib/i18n'
import { makeThumbs } from '../lib/thumbs'
import { previewOf } from '../lib/url-safety'
import { allPageInputs } from './model'
import { buildReportHtml } from '../lib/report'
import { state } from './state'
import { slugOf } from './helpers'
import { askChoice } from './dialogs'
import { buildPack } from '../lib/audit-pack'

export const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export async function exportWorkbook(pages: PageInput[], sheets: Sheet[], fileName: string): Promise<void> {
  try {
    say(t('Building the Excel file with image previews…'))
    const sources = pages.flatMap((p, pi) => [
      ...p.images.map((el) => ({ id: thumbKey(pi, el.id), source: previewOf(el) })),
      ...p.findings.map((f) => ({ id: thumbKey(pi, 50000 + f.theme * 1000 + f.id), source: f.shot ?? null })),
    ])
    const thumbs = await makeThumbs(sources)
    download(buildWorkbook(sheets, thumbs) as BlobPart, XLSX_TYPE, fileName)
    say(t('Excel grid exported ({pages} page(s), {n}/{total} image previews).', { pages: pages.length, n: thumbs.size, total: sources.length }))
  } catch (err) {
    say(t('Could not build the Excel file.'))
    console.error(err)
  }
}

/** The audit report: one printable HTML page (summary, non-conformities per page, draft accessibility statement). */
export function openReport(asDownload: boolean): void {
  const inputs = allPageInputs()
  if (!inputs.length) return void say(t('Add a page to the audit first.'))
  const html = buildReportHtml(state.audit, inputs, state.audit.pages)
  const date = new Date().toISOString().slice(0, 10)
  if (asDownload) {
    download(html, 'text/html', `${slugOf(state.audit.meta.site || state.audit.name)}_rapport_${date}.html`)
    say(t('Report downloaded. Open it in a browser and print it to PDF if you need one.'))
  } else {
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
    window.open(url, '_blank', 'noopener')
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  }
}

/** The audit as a pack of files for a language model (code, pictures, evidence, an answers file to complete). Nothing is sent anywhere. */
export async function exportAuditPack(): Promise<void> {
  if (!state.audit.pages.length) return void say(t('Add a page to the audit first.'))
  try {
    const withPictures = buildPack(state.audit, { pictures: true, openOnly: false })
    const mb = (bytes: number) => (bytes / 1_048_576).toFixed(1)
    const choice = await askChoice(
      t('Export for analysis by a language model'),
      t('{pages} page(s), {elements} element(s) with their code, {pictures} picture(s), {open} question(s) to answer, {size} MB. The file stays on your machine: you give it to the assistant yourself. Pictures can show personal data: leave them out if the pages contain some.', { pages: withPictures.summary.pages, elements: withPictures.summary.elements, pictures: withPictures.summary.pictures, open: withPictures.summary.openAnswers, size: mb(withPictures.summary.bytes) }),
      [
        { id: 'with', label: t('Export with the pictures'), primary: true },
        { id: 'without', label: t('Export without the pictures') },
        { id: 'cancel', label: t('Cancel') },
      ],
    )
    if (!choice || choice === 'cancel') return
    const pack = choice === 'with' ? withPictures : buildPack(state.audit, { pictures: false, openOnly: false })
    download(pack.zip as BlobPart, 'application/zip', `audit-pack-${slugOf(state.audit.meta.site || state.audit.name)}-${pack.id}.zip`)
    say(t('Audit pack exported ({elements} element(s), {open} question(s) to answer). Give it to your assistant, then bring its answers file back.', { elements: pack.summary.elements, open: pack.summary.openAnswers }))
  } catch (err) {
    say(t('Could not build the audit pack.'))
    console.error(err)
  }
}
