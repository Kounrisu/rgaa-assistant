import data from './rgaa-tests.json'
import { CRITERIA } from '../lib/rgaa'

type Level = 'auto' | 'semi' | 'manual'
interface TestRow { id: string; text: string; conditions: string[]; automation: Level; note: string; script: string | null; human: string | null }
interface CriterionRow { id: string; title: string; wcag: string[]; automation: Level; note: string; tests: TestRow[] }
interface ThemeRow { number: number; name: string; criteria: CriterionRow[] }

const topics = data.topics as ThemeRow[]
const LABEL: Record<Level, string> = { auto: 'Automatic', semi: 'Semi-automatic', manual: 'Manual' }
const LEVELS: Level[] = ['auto', 'semi', 'manual']
const implemented = new Set(CRITERIA.map((c) => c.id))
const OFFICIAL = 'https://accessibilite.numerique.gouv.fr/methode/criteres-et-tests/'

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
let level: Level | 'all' = 'all'
let query = ''
let allOpen = false

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, ...kids: (Node | string)[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (cls) node.className = cls
  node.append(...kids)
  return node
}

/** Text with `inline code` segments. */
function rich(text: string): Node[] {
  return text.split(/(`[^`]+`)/g).filter(Boolean).map((part) => (part.startsWith('`') ? el('code', '', part.slice(1, -1)) : document.createTextNode(part)))
}

function count(tests: TestRow[]): Record<Level, number> {
  const c: Record<Level, number> = { auto: 0, semi: 0, manual: 0 }
  for (const t of tests) c[t.automation]++
  return c
}

function bar(c: Record<Level, number>): HTMLElement {
  const total = c.auto + c.semi + c.manual || 1
  const b = el('div', 'bar')
  b.setAttribute('role', 'img')
  b.setAttribute('aria-label', `${c.auto} automatic, ${c.semi} semi-automatic, ${c.manual} manual`)
  for (const l of LEVELS) {
    const seg = el('i', l)
    seg.style.width = `${(c[l] / total) * 100}%`
    b.append(seg)
  }
  return b
}

function renderSummary(): void {
  const all = topics.flatMap((t) => t.criteria.flatMap((c) => c.tests))
  const c = count(all)
  const host = $('summary')
  host.replaceChildren()
  host.append(el('div', 'stat', el('div', 'n', String(all.length)), el('div', 'l', `tests in ${topics.reduce((n, t) => n + t.criteria.length, 0)} criteria, ${topics.length} themes`)))
  for (const l of LEVELS) {
    host.append(el('div', `stat ${l}`, el('div', 'n', `${c[l]}`), el('div', 'l', `${LABEL[l]} · ${Math.round((c[l] / all.length) * 100)}%`)))
  }
  host.append(bar(c))
}

function matches(t: TestRow, c: CriterionRow, theme: ThemeRow): boolean {
  if (level !== 'all' && t.automation !== level) return false
  if (!query) return true
  const hay = `${t.id} ${t.text} ${t.conditions.join(' ')} ${t.script ?? ''} ${t.human ?? ''} ${c.id} ${c.title} ${theme.name}`.toLowerCase()
  return query.split(/\s+/).every((word) => hay.includes(word))
}

function render(): void {
  const host = $('themes')
  host.replaceChildren()
  let shown = 0
  for (const theme of topics) {
    const criteria = theme.criteria
      .map((c) => ({ c, tests: c.tests.filter((t) => matches(t, c, theme)) }))
      .filter((x) => x.tests.length)
    if (!criteria.length) continue
    const themeTests = criteria.flatMap((x) => x.tests)
    shown += themeTests.length

    const themeEl = el('details', 'theme')
    themeEl.open = allOpen || Boolean(query)
    const counts = count(themeTests)
    themeEl.append(
      el(
        'summary',
        '',
        el('span', '', `${theme.number}. ${theme.name} `, el('span', 'meta', `· ${criteria.length} criteria · ${themeTests.length} tests`)),
        el('span', 'meta', LEVELS.filter((l) => counts[l]).map((l) => `${counts[l]} ${LABEL[l].toLowerCase()}`).join(' · ')),
        bar(counts),
      ),
    )
    const list = el('div', 'criteria')
    for (const { c, tests } of criteria) {
      const cEl = el('details', 'criterion')
      cEl.open = Boolean(query) || level !== 'all' ? allOpen || Boolean(query) : allOpen
      const here = implemented.has(c.id) ? el('span', 'here', 'in this extension') : null
      cEl.append(
        el('summary', '', el('span', '', el('span', 'cid', c.id), ...rich(c.title), ...(here ? [here] : [])), el('span', `badge ${c.automation}`, LABEL[c.automation])),
      )
      if (c.wcag.length) cEl.append(el('p', 'wcag', `WCAG: ${c.wcag.join(' · ')}`))
      const ul = el('ul', 'tests')
      for (const t of tests) {
        const li = el('li', 'test')
        const body = el('div', '', el('p', '', ...rich(t.text)))
        if (t.conditions.length) body.append(el('ul', '', ...t.conditions.map((x) => el('li', '', ...rich(x)))))
        const why = el('div', 'why')
        if (t.script) why.append(el('p', '', el('strong', '', 'Script: '), t.script))
        if (t.human) why.append(el('p', '', el('strong', '', 'Human: '), t.human))
        body.append(why)
        li.append(el('span', 'tid', t.id), el('span', `badge ${t.automation}`, LABEL[t.automation]), body)
        ul.append(li)
      }
      cEl.append(ul)
      list.append(cEl)
    }
    themeEl.append(list)
    host.append(themeEl)
  }
  $('count').textContent = shown
    ? `${shown} test(s) shown. Official wording: ${OFFICIAL}`
    : 'No test matches this filter.'
}

function renderFilters(): void {
  const host = $('filters')
  host.replaceChildren()
  const chips: [Level | 'all', string][] = [['all', 'All'], ['auto', 'Automatic'], ['semi', 'Semi-automatic'], ['manual', 'Manual']]
  for (const [value, label] of chips) {
    const b = el('button', 'chip', label)
    b.type = 'button'
    b.setAttribute('aria-pressed', String(level === value))
    b.addEventListener('click', () => {
      level = value
      renderFilters()
      render()
    })
    host.append(b)
  }
}

$('search').addEventListener('input', (event) => {
  query = (event.target as HTMLInputElement).value.trim().toLowerCase()
  render()
})
$('toggle').addEventListener('click', () => {
  allOpen = !allOpen
  $('toggle').textContent = allOpen ? 'Collapse all' : 'Expand all'
  render()
})

renderSummary()
renderFilters()
render()
