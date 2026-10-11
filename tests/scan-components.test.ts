// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import { scanComponents } from '../src/content/scan-components'
import { APG_PATTERNS, parseChecks } from '../src/lib/apg-patterns'
import { FR } from '../src/lib/i18n-fr'
import { FINDING_CRITERIA } from '../src/lib/findings'

// vitest runs from the project root; under jsdom `import.meta.url` is not a file: URL
const html = readFileSync('tests/fixtures/pages/components.html', 'utf8')

/** jsdom has no layout: an element is "rendered" unless display:none, which is what the scanner relies on. */
beforeAll(() => {
  document.documentElement.innerHTML = html.replace(/^<!doctype html>\s*<html[^>]*>/i, '').replace(/<\/html>\s*$/i, '')
})

const byPattern = () => {
  const { findings } = scanComponents()
  const map: Record<string, ReturnType<typeof scanComponents>['findings']> = {}
  for (const f of findings) (map[f.type] ??= []).push(f)
  return { findings, map }
}
const checksOf = (f: { data: Record<string, unknown> }) => Object.fromEntries(parseChecks(f.data.checks).map((c) => [c.id, c.ok]))

describe('scanComponents: every ARIA component of the page with its APG structural checks', () => {
  it('finds one finding per component, numbered in document order, each with a known pattern', () => {
    const { findings, map } = byPattern()
    expect(findings.map((f) => f.id)).toEqual(findings.map((_, i) => i + 1))
    for (const f of findings) expect(APG_PATTERNS[String(f.data.pattern)], f.type).toBeDefined()
    expect(Object.keys(map).sort()).toEqual(
      ['widget-accordion', 'widget-button', 'widget-checkbox', 'widget-combobox', 'widget-details', 'widget-dialog', 'widget-disclosure', 'widget-listbox', 'widget-menu', 'widget-radiogroup', 'widget-slider', 'widget-spinbutton', 'widget-switch', 'widget-tabs', 'widget-toolbar', 'widget-tooltip', 'widget-tree'].sort(),
    )
  })

  it('every emitted check id has a description in the catalogue, and every catalogue text has a French translation', () => {
    const { findings } = byPattern()
    for (const f of findings) {
      const pattern = APG_PATTERNS[String(f.data.pattern)]
      for (const c of parseChecks(f.data.checks)) expect(pattern.structure[c.id], `${f.type} ${c.id}`).toBeDefined()
    }
    for (const p of Object.values(APG_PATTERNS)) {
      expect(p.url).toMatch(/^https:\/\/www\.w3\.org\/WAI\/ARIA\/apg\/patterns\//)
      for (const text of [p.name, ...Object.values(p.structure), ...p.keyboard]) expect(FR[text], text).toBeDefined()
    }
    for (const c of FINDING_CRITERIA[7]) for (const text of [c.question, ...c.checks]) expect(FR[text], text).toBeDefined()
  })

  it('tabs: selected / controls / labelled checks read the markup', () => {
    const [tabs] = byPattern().map['widget-tabs']
    expect(checksOf(tabs)).toEqual({ 'tab-roles': true, 'tab-selected': true, 'tab-controls': false, 'panel-labelled': false, 'tab-roving': true, 'tablist-name': true })
    expect(tabs.data.fails).toBe(2)
    expect(tabs.facts.Tabs).toBe('3')
    expect(tabs.facts['Accessible name']).toBe('Rubriques')
  })

  it('menu: a stray child and a proper trigger', () => {
    const [menu] = byPattern().map['widget-menu']
    expect(checksOf(menu)).toEqual({ 'menu-items': false, 'menu-trigger': true, 'menu-roving': true })
  })

  it('dialogs are listed even when closed; the empty native one fails name and focusable', () => {
    const dialogs = byPattern().map['widget-dialog']
    expect(dialogs).toHaveLength(2)
    expect(checksOf(dialogs[0])).toEqual({ 'dialog-name': true, 'dialog-modal': true, 'dialog-focusable': true })
    expect(dialogs[0].facts.Open).toBe('no (open it, then rescan)')
    expect(checksOf(dialogs[1])).toEqual({ 'dialog-name': false, 'dialog-modal': true, 'dialog-focusable': false })
  })

  it('disclosures: a good button, a bad span, an accordion of two headings, a details', () => {
    const { map } = byPattern()
    const [good, bad] = map['widget-disclosure']
    expect(checksOf(good)).toEqual({ 'disclosure-button': true, 'disclosure-expanded': true, 'disclosure-controls': true, 'disclosure-state': true })
    expect(checksOf(bad)).toEqual({ 'disclosure-button': false, 'disclosure-expanded': false, 'disclosure-controls': false })
    expect(bad.data.humanNeeded).toBe(true)
    const [acc] = map['widget-accordion']
    expect(checksOf(acc)).toEqual({ 'accordion-heading': true, 'disclosure-button': true, 'disclosure-expanded': true, 'disclosure-controls': true })
    expect(acc.facts.Headers).toBe('2')
    expect(checksOf(map['widget-details'][0])).toEqual({ 'details-summary': true })
  })

  it('combobox owns its listbox (not listed twice); the standalone listbox is', () => {
    const { map } = byPattern()
    expect(checksOf(map['widget-combobox'][0])).toEqual({ 'combobox-name': true, 'combobox-expanded': true, 'combobox-popup': true, 'combobox-autocomplete': true })
    expect(map['widget-listbox']).toHaveLength(1)
    expect(map['widget-listbox'][0].facts['Accessible name']).toBe('Couleurs')
  })

  it('ranges, toggles, radios, tree, tooltips, buttons, toolbars', () => {
    const { map } = byPattern()
    expect(map['widget-slider'].map(checksOf)).toEqual([
      { 'slider-values': true, 'slider-name': true, 'slider-focusable': true },
      { 'slider-values': false, 'slider-name': false, 'slider-focusable': false },
    ])
    expect(checksOf(map['widget-spinbutton'][0])).toEqual({ 'spin-values': true, 'spin-name': true, 'spin-focusable': true })
    expect(checksOf(map['widget-switch'][0])).toEqual({ 'toggle-checked': true, 'toggle-name': true, 'toggle-focusable': true })
    expect(checksOf(map['widget-checkbox'][0])).toEqual({ 'toggle-checked': true, 'toggle-name': true, 'toggle-focusable': true })
    expect(map['widget-radiogroup'].map(checksOf)).toEqual([
      { 'radio-group': true, 'toggle-checked': true, 'toggle-name': true, 'radio-roving': true },
      { 'radio-group': false, 'toggle-checked': true, 'toggle-name': true, 'radio-roving': true },
    ])
    expect(checksOf(map['widget-tree'][0])).toEqual({ 'tree-name': true, 'tree-items': true, 'tree-expanded': false, 'tree-roving': true })
    expect(map['widget-tooltip'].map(checksOf)).toEqual([{ 'tooltip-referenced': true }, { 'tooltip-referenced': false }])
    expect(map['widget-button'].map(checksOf)).toEqual([
      { 'button-name': true, 'button-focusable': true, 'button-pressed': true },
      { 'button-name': false, 'button-focusable': false, 'button-pressed': true },
    ])
    expect(map['widget-toolbar'].map(checksOf)).toEqual([
      { 'toolbar-controls': true, 'toolbar-roving': true, 'toolbar-name': true },
      { 'toolbar-controls': false, 'toolbar-roving': true, 'toolbar-name': false },
    ])
  })

  it('never reports the assistant’s own layers', () => {
    const layer = document.createElement('div')
    layer.id = 'rgaa-assistant-overlay-t7'
    layer.innerHTML = '<div role="tablist"><button role="tab" aria-selected="true">x</button></div>'
    document.body.append(layer)
    const n = byPattern().map['widget-tabs'].length
    layer.remove()
    expect(n).toBe(1)
  })
})
