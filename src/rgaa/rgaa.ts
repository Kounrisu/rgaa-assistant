import data from './rgaa-tests.json'
import { CRITERIA } from '../lib/rgaa'
import { AUDIT_LEVELS, LEVEL_COUNT, LEVEL_HELP, LEVEL_LABEL, inLevel, type AuditLevel } from '../lib/audit-levels'
import { getLang, setLang, t, translateStatic, type Lang } from '../lib/i18n'

type Level = 'auto' | 'semi' | 'manual'
interface TestRow { id: string; text: string; conditions: string[]; automation: Level; note: string; script: string | null; human: string | null }
interface CriterionRow { id: string; title: string; wcag: string[]; automation: Level; note: string; tests: TestRow[] }
interface ThemeRow { number: number; name: string; criteria: CriterionRow[] }

const topics = data.topics as ThemeRow[]
const labelOf = (l: Level): string => t(l === 'auto' ? 'Automatic' : l === 'semi' ? 'Semi-automatic' : 'Manual')
const LEVELS: Level[] = ['auto', 'semi', 'manual']
const implemented = new Set(CRITERIA.map((c) => c.id))
const OFFICIAL = 'https://accessibilite.numerique.gouv.fr/methode/criteres-et-tests/'

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
let level: Level | 'all' = 'all'
/** Which audit type the page speaks about: complete (106), quick (25) or complementary (50). Chosen in the page, or passed by the panel (?level=). */
let scope: AuditLevel = ((): AuditLevel => {
  const asked = new URLSearchParams(location.search).get('level')
  return AUDIT_LEVELS.find((l) => l === asked) ?? 'complet'
})()
const scoped = (): ThemeRow[] =>
  topics.map((th) => ({ ...th, criteria: th.criteria.filter((c) => inLevel(scope, c.id)) })).filter((th) => th.criteria.length)
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
  b.setAttribute('aria-label', t('{auto} automatic, {semi} semi-automatic, {manual} manual', { auto: c.auto, semi: c.semi, manual: c.manual }))
  for (const l of LEVELS) {
    const seg = el('i', l)
    seg.style.width = `${(c[l] / total) * 100}%`
    b.append(seg)
  }
  return b
}

function renderSummary(): void {
  const themes = scoped()
  const all = themes.flatMap((t) => t.criteria.flatMap((c) => c.tests))
  const c = count(all)
  const host = $('summary')
  host.replaceChildren()
  host.append(el('div', 'stat', el('div', 'n', String(all.length)), el('div', 'l', t('tests in {criteria} criteria, {themes} themes', { criteria: themes.reduce((n, th) => n + th.criteria.length, 0), themes: themes.length }))))
  for (const l of LEVELS) {
    host.append(el('div', `stat ${l}`, el('div', 'n', `${c[l]}`), el('div', 'l', `${labelOf(l)} · ${Math.round((c[l] / all.length) * 100)}%`)))
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
  for (const theme of scoped()) {
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
        el('span', '', `${theme.number}. ${theme.name} `, el('span', 'meta', t('· {criteria} criteria · {tests} tests', { criteria: criteria.length, tests: themeTests.length }))),
        el('span', 'meta', LEVELS.filter((l) => counts[l]).map((l) => `${counts[l]} ${labelOf(l).toLowerCase()}`).join(' · ')),
        bar(counts),
      ),
    )
    const list = el('div', 'criteria')
    for (const { c, tests } of criteria) {
      const cEl = el('details', 'criterion')
      cEl.open = Boolean(query) || level !== 'all' ? allOpen || Boolean(query) : allOpen
      const here = implemented.has(c.id) ? el('span', 'here', t('in this extension')) : null
      cEl.append(
        el('summary', '', el('span', '', el('span', 'cid', c.id), ...rich(c.title), ...(here ? [here] : [])), el('span', `badge ${c.automation}`, labelOf(c.automation))),
      )
      if (c.wcag.length) cEl.append(el('p', 'wcag', t('WCAG: {list}', { list: c.wcag.join(' · ') })))
      const ul = el('ul', 'tests')
      for (const tt of tests) {
        const li = el('li', 'test')
        const body = el('div', '', el('p', '', ...rich(tt.text)))
        if (tt.conditions.length) body.append(el('ul', '', ...tt.conditions.map((x) => el('li', '', ...rich(x)))))
        const why = el('div', 'why')
        if (tt.script) why.append(el('p', '', el('strong', '', t('Script: ')), tt.script))
        if (tt.human) why.append(el('p', '', el('strong', '', t('Human: ')), tt.human))
        body.append(why)
        li.append(el('span', 'tid', tt.id), el('span', `badge ${tt.automation}`, labelOf(tt.automation)), body)
        ul.append(li)
      }
      cEl.append(ul)
      list.append(cEl)
    }
    themeEl.append(list)
    host.append(themeEl)
  }
  $('count').textContent = shown ? t('{n} test(s) shown. Official wording: {url}', { n: shown, url: OFFICIAL }) : t('No test matches this filter.')
}

function renderScope(): void {
  const host = $('scope')
  host.replaceChildren()
  for (const value of AUDIT_LEVELS) {
    const b = el('button', 'chip', `${t(LEVEL_LABEL[value])} (${LEVEL_COUNT[value]})`)
    b.type = 'button'
    b.setAttribute('aria-pressed', String(scope === value))
    b.addEventListener('click', () => {
      scope = value
      const url = new URL(location.href)
      if (value === 'complet') url.searchParams.delete('level')
      else url.searchParams.set('level', value)
      history.replaceState(null, '', url)
      renderAll()
    })
    host.append(b)
  }
  $('scope-help').textContent = t(LEVEL_HELP[scope])
}

function renderFilters(): void {
  const host = $('filters')
  host.replaceChildren()
  const chips: [Level | 'all', string][] = [['all', t('All')], ['auto', t('Automatic')], ['semi', t('Semi-automatic')], ['manual', t('Manual')]]
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
  $('toggle').textContent = allOpen ? t('Collapse all') : t('Expand all')
  render()
})

function renderAll(): void {
  translateStatic()
  $('toggle').textContent = allOpen ? t('Collapse all') : t('Expand all')
  renderScope()
  renderSummary()
  renderFilters()
  render()
  document.querySelectorAll<HTMLButtonElement>('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === getLang())))
}

document.querySelectorAll<HTMLButtonElement>('[data-lang]').forEach((b) =>
  b.addEventListener('click', () => {
    setLang(b.dataset.lang as Lang)
    renderAll()
  }),
)

setLang(getLang())
renderAll()
