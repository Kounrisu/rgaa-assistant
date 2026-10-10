import { h } from './dom'
import { formatHtml } from './helpers'
import { t } from '../lib/i18n'

export const A11Y_ATTR = /^(alt|role|title|aria-[\w-]+|longdesc|tabindex|figcaption)$/i

export function highlightLine(line: string): HTMLElement {
  const indent = /^\s*/.exec(line)![0]
  const body = line.slice(indent.length)
  const isTarget = body.includes('data-rgaa-target')
  const row = h('span', { class: `line${isTarget ? ' target' : ''}` }, indent)

  if (body.startsWith('<!--')) {
    row.append(h('span', { class: 'comment' }, body))
  } else if (body.startsWith('<')) {
    const match = /^<(\/?)([\w-]*)([\s\S]*?)(\/?)>?$/.exec(body)
    if (!match) {
      row.append(h('span', { class: 'text' }, body))
    } else {
      const [, close, name, attrs, selfClose] = match
      row.append(h('span', { class: 'tag' }, `<${close}${name}`))
      for (const attr of attrs.matchAll(/\s+([^\s=>"']+)(?:=("[^"]*"|'[^']*'|[^\s>]+))?/g)) {
        if (attr[1] === 'data-rgaa-target') continue
        row.append(' ', h('span', { class: `attr${A11Y_ATTR.test(attr[1]) ? ' a11y' : ''}` }, attr[1]))
        if (attr[2] !== undefined) {
          const value = attr[2].length > 90 ? `${attr[2].slice(0, 87)}…"` : attr[2]
          row.append('=', h('span', { class: 'val' }, value))
        }
      }
      row.append(h('span', { class: 'tag' }, `${selfClose}>`))
    }
  } else {
    row.append(h('span', { class: 'text' }, body))
  }
  return row
}

export function codeBlock(title: string, source: string, hint?: string): HTMLElement {
  const lines = formatHtml(source)
  const pre = h('pre', { class: 'code', tabIndex: 0, 'aria-label': title })
  pre.append(...lines.map(highlightLine))
  const copy = h(
    'button',
    {
      type: 'button',
      class: 'small-btn',
      onclick: async (event: Event) => {
        const btn = event.currentTarget as HTMLButtonElement
        await navigator.clipboard.writeText(source.replace(/\s*data-rgaa-target=""/g, ''))
        btn.textContent = t('Copied ✓')
        setTimeout(() => (btn.textContent = t('Copy')), 1500)
      },
    },
    t('Copy'),
  )
  return h(
    'div',
    { class: 'card' },
    h('div', { class: 'code-head' }, h('h3', {}, title), copy),
    pre,
    hint ? h('p', { class: 'hint-line' }, hint) : null,
  )
}
