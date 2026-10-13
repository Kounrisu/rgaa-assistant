/**
 * The Components review (theme 7): what the criterion cards show for a component, from the APG pattern catalogue:
 * the structural checks the script ran (7.1) and the keyboard checklist to try by hand (7.3).
 */
import type { FindingItem } from '../lib/types'
import { apgPattern, parseChecks } from '../lib/apg-patterns'
import { h, newTabNote } from './dom'
import { t } from '../lib/i18n'
import { tDyn } from './helpers'

/** Extra blocks of a criterion card for a component finding; empty for anything else. */
export function apgBlocks(f: FindingItem, criterionId: string): HTMLElement[] {
  const pattern = f.type.startsWith('widget-') ? apgPattern(f.type) : undefined
  if (!pattern) return []
  const link = h('a', { class: 'crit-link', href: pattern.url, target: '_blank', rel: 'noreferrer' }, t('APG pattern “{name}” ↗', { name: t(pattern.name) }), newTabNote())
  if (criterionId === '7.1') {
    const checks = parseChecks(f.data.checks)
    return [
      h(
        'div',
        { class: 'apg-block' },
        h('p', { class: 'hint-line' }, t('Structure checked by the script, pattern {name}:', { name: t(pattern.name) }), ' ', link),
        h(
          'ul',
          { class: 'apg-checks' },
          ...checks.map((c) =>
            h(
              'li',
              { class: c.ok ? 'ok' : 'fail', 'data-check': c.id },
              h('span', { class: 'mark', 'aria-hidden': 'true' }, c.ok ? '✓' : '✗'),
              h('span', { class: 'sr-only' }, c.ok ? t('passes:') : t('fails:')),
              ' ',
              t(pattern.structure[c.id] ?? c.id),
              c.detail ? h('span', { class: 'detail' }, ` — ${tDyn(c.detail)}`) : null,
            ),
          ),
        ),
      ),
    ]
  }
  if (criterionId === '7.3') {
    return [
      h(
        'div',
        { class: 'apg-block' },
        h('p', { class: 'hint-line' }, t('Keyboard interaction expected by the pattern {name}:', { name: t(pattern.name) }), ' ', link),
        h('ul', { class: 'apg-keys' }, ...pattern.keyboard.map((k) => h('li', {}, t(k)))),
      ),
    ]
  }
  return []
}
