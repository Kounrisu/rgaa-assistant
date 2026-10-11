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
