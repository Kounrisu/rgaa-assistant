import { VIEW_KEY, type ViewData } from '../panel/open-view'
import { structureDocument } from '../panel/structure-preview'
import { setLang, t, translateStatic, type Lang } from '../lib/i18n'
import { hostName } from '../panel/helpers'

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T

async function main(): Promise<void> {
  const stored = (await chrome.storage.local.get(VIEW_KEY))[VIEW_KEY] as ViewData | undefined
  if (stored?.lang === 'en' || stored?.lang === 'fr') setLang(stored.lang as Lang)
  translateStatic()
  if (!stored) return void ($('empty').hidden = false)
  document.title = `${stored.title} — RGAA Assistant`
  $('title').textContent = stored.title
  $('source').textContent = [stored.url ? `${hostName(stored.url) || ''} ${stored.url}`.trim() : '', new Date(stored.at).toLocaleString()].filter(Boolean).join(' · ')

  if (stored.kind === 'structure') {
    const data = stored.result
    $('summary').textContent = [
      t('{n} heading(s)', { n: data.headings }),
      data.loose ? t('{n} loose text(s) in orange: no paragraph, heading, list item, link or button around them', { n: data.loose }) : t('no loose text'),
      data.truncated ? t('very long page: the end is cut') : '',
    ].filter(Boolean).join(' · ')
    const frame = $<HTMLIFrameElement>('frame')
    frame.hidden = false
    frame.srcdoc = structureDocument(data)
    return
  }

  const data = stored.result
  const problems = data.blocks.reduce((n, b) => n + b.lines.filter((l) => l.warn).length, 0)
  $('summary').textContent = [
    problems ? t('{n} line(s) marked ⚠: a problem to look at', { n: problems }) : t('No problem marked'),
    data.engine === 'axe' ? t('names computed by the axe engine') : t('names computed in a simplified way (axe not available)'),
    data.truncated ? t('very long page: the end is cut') : '',
  ].filter(Boolean).join(' · ')
  const body = $('body')
  for (const block of data.blocks) {
    const section = document.createElement('section')
    section.className = 'block'
    const h2 = document.createElement('h2')
    h2.textContent = block.title
    const list = document.createElement('ol')
    for (const line of block.lines) {
      const li = document.createElement('li')
      if (line.warn) li.className = 'warn'
      li.textContent = line.text
      list.append(li)
    }
    section.append(h2, list)
    body.append(section)
  }
  if (problems) {
    $('only-wrap').hidden = false
    $<HTMLInputElement>('only').addEventListener('change', (e) => body.classList.toggle('only-warn', (e.target as HTMLInputElement).checked))
  }
}

void main()
