/**
 * “Reading view”: the transcript of what a screen reader would say about the page or its tables, in a dialog.
 * Lines that show a problem are marked, so the auditor can judge by ear what the markup conveys.
 */
import { $, h } from './dom'
import { t } from '../lib/i18n'
import type { TranscriptResult } from '../content/transcript'

export function showReading(title: string, data: TranscriptResult): Promise<void> {
  return new Promise((resolve) => {
    const dialog = $<HTMLDialogElement>('reading-dialog')
    const close = $('reading-close')
    const problems = data.blocks.reduce((n, b) => n + b.lines.filter((l) => l.warn).length, 0)
    $('reading-title').textContent = title
    $('reading-summary').textContent = [problems ? t('{n} line(s) marked ⚠: a problem to look at', { n: problems }) : t('No problem marked'), data.engine === 'axe' ? t('names computed by the axe engine') : t('names computed in a simplified way (axe not available)'), data.truncated ? t('very long page: the end is cut') : ''].filter(Boolean).join(' · ')
    const body = $('reading-body')
    body.replaceChildren(
      ...data.blocks.flatMap((block) => [
        h('h3', {}, block.title),
        h('ol', {}, ...block.lines.map((line) => h('li', { class: line.warn ? 'warn' : '' }, line.text))),
      ]),
    )
    const finish = () => {
      close.removeEventListener('click', finish)
      dialog.removeEventListener('close', finish)
      if (dialog.open) dialog.close()
      body.replaceChildren()
      resolve()
    }
    close.addEventListener('click', finish)
    dialog.addEventListener('close', finish)
    dialog.showModal()
  })
}
