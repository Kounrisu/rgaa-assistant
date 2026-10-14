import { t } from '../lib/i18n'
import { showReading } from './reading-view'
import type { TranscriptResult } from '../content/transcript'
import { showStructure, type StructureData } from './structure-preview'
import { auditStylesMenu, resetAuditStyles, setAuditStylesTheme, stylusHint } from './audit-styles-ui'

/**
 * The "page tools" bar: switches that change what the page shows so manual checks are easier
 * (hidden content, table structure, tab order, styles off, text spacing, languages).
 */
type Tool = 'reveal' | 'tables' | 'taborder' | 'nocss' | 'spacing' | 'lang' | 'headings' | 'loosetext'

/** The RGAA themes where each tool belongs: it is the one to reach for while checking those criteria. */
const TOOL_THEMES: Record<Tool, number[]> = {
  reveal: [1, 2, 5, 6, 9, 11, 12],
  tables: [5],
  taborder: [6, 7, 11, 12],
  nocss: [5, 9, 10],
  spacing: [10],
  lang: [8],
  headings: [9],
  loosetext: [9, 10],
}

const TOOLS: { id: Tool; label: string; title: string }[] = [
  { id: 'reveal', label: 'Hidden content', title: 'Show what is visually hidden but read by screen readers (hidden tables, skip links…), outlined in magenta. Switch off to put it back.' },
  { id: 'tables', label: 'Tables', title: 'On every table: its caption (or the lack of one), and on every header cell its scope, id and the headers attributes of the cells (RGAA 5.4 to 5.7).' },
  { id: 'taborder', label: 'Tab order', title: 'Number the focusable elements in the order the Tab key visits them, with a line between them. Red: positive tabindex; magenta: visually hidden (RGAA 12.8).' },
  { id: 'nocss', label: 'Styles off', title: 'Turn the style sheets off to check that the information stays understandable and in a logical order (RGAA 10.3).' },
  { id: 'spacing', label: 'Text spacing', title: 'Apply the text spacing of the test: line 1.5, letters 0.12 em, words 0.16 em, paragraphs 2 em, to check nothing is lost (RGAA 10.12).' },
  { id: 'headings', label: 'Headings map', title: 'Badge every heading on the page with its level (H1 to H6), like a headings map. Red: a skipped level or an empty heading (RGAA 9.1).' },
  { id: 'loosetext', label: 'Loose text', title: 'Box the texts that sit in a plain div or span with no paragraph, heading, list item, link, button or label around them (RGAA 9.3).' },
  { id: 'lang', label: 'Languages', title: 'Show the lang attribute of the page and of every element that changes the language (RGAA 8.3, 8.7).' },
]

interface Deps {
  send: (payload: unknown) => Promise<{ count?: number } | undefined>
  /** Asks the page for its structure (the rebuilt copy shown in the preview). */
  structure: () => Promise<StructureData | undefined>
  /** Asks the page for the transcript of the page or of its tables. */
  transcript: (scope: 'page' | 'tables') => Promise<TranscriptResult | undefined>
  say: (message: string) => void
}

let host: HTMLElement | null = null
let deps: Deps | null = null
const on = new Set<Tool>()
let currentTheme = 1
let showAll = false

export function renderPageTools(): void {
  if (!host) return
  host.replaceChildren()
  const label = document.createElement('span')
  label.className = 'toolsbar-label'
  label.textContent = t('Page tools')
  host.append(label)
  // the tools of this theme, those switched on (so they can be switched off), then the rest on demand
  const relevant = TOOLS.filter((x) => TOOL_THEMES[x.id].includes(currentTheme) || on.has(x.id))
  const others = TOOLS.filter((x) => !relevant.includes(x))
  const add = (tool: (typeof TOOLS)[number]) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = t(tool.label)
    button.title = t(tool.title)
    button.setAttribute('aria-pressed', String(on.has(tool.id)))
    button.addEventListener('click', () => void toggle(tool.id))
    host!.append(button)
  }
  relevant.forEach(add)
  if (currentTheme === 5 || currentTheme === 9) {
    const reading = document.createElement('button')
    reading.type = 'button'
    reading.textContent = currentTheme === 5 ? t('Table reading') : t('Page reading')
    reading.title = currentTheme === 5
      ? t('What a screen reader would say about each table: every cell with the header cells that name it. Cells with no header, wrong headers attributes and missing titles are marked.')
      : t('What a screen reader would say about the page, in reading order: landmarks, headings, lists, links, buttons, fields and images. Missing names and skipped heading levels are marked.')
    reading.addEventListener('click', () => void openReading(currentTheme === 5 ? 'tables' : 'page'))
    host.append(reading)
  }
  if (currentTheme === 9) {
    const preview = document.createElement('button')
    preview.type = 'button'
    preview.textContent = t('Structure preview')
    preview.title = t('The page rebuilt from its HTML structure only (headings, paragraphs, lists, tables, landmarks), to see whether it makes sense without the design.')
    preview.addEventListener('click', () => void openPreview())
    host.append(preview)
  }
  setAuditStylesTheme(currentTheme)
  if (others.length) {
    const more = document.createElement('button')
    more.type = 'button'
    more.className = 'ghost-btn'
    more.textContent = showAll ? t('Fewer tools') : relevant.length ? t('Other tools') : t('Show the tools')
    more.setAttribute('aria-expanded', String(showAll))
    more.addEventListener('click', () => {
      showAll = !showAll
      renderPageTools()
    })
    host.append(more)
    if (showAll) others.forEach(add)
  }
  host.append(auditStylesMenu())
  const hint = stylusHint()
  if (hint) host.append(hint)
}

/** Redraws the bar (the audit styles menu changed). */
export const refreshPageTools = (): void => renderPageTools()

/** The theme being shown: the bar leads with the tools that belong to it. */
export function setPageToolsTheme(theme: number): void {
  if (theme === currentTheme) return
  currentTheme = theme
  renderPageTools()
}

async function toggle(tool: Tool): Promise<void> {
  const next = !on.has(tool)
  try {
    const result = await deps!.send({ type: 'RGAA_TOOL', tool, on: next })
    if (next) on.add(tool)
    else on.delete(tool)
    renderPageTools()
    if (next && typeof result?.count === 'number') deps!.say(t('{n} element(s) affected by “{tool}”.', { n: result.count, tool: t(TOOLS.find((x) => x.id === tool)!.label) }))
  } catch {
    deps!.say(t('Could not reach the page. Reload the tab and try again.'))
  }
}

async function openReading(scope: 'page' | 'tables'): Promise<void> {
  try {
    const data = await deps!.transcript(scope)
    if (!data) throw new Error('no answer')
    await showReading(scope === 'tables' ? t('Table reading') : t('Page reading'), data)
  } catch {
    deps!.say(t('Could not reach the page. Reload the tab and try again.'))
  }
}

async function openPreview(): Promise<void> {
  try {
    const data = await deps!.structure()
    if (!data) throw new Error('no answer')
    await showStructure(data)
  } catch {
    deps!.say(t('Could not reach the page. Reload the tab and try again.'))
  }
}

/** The page was reloaded or changed: every tool is off again. */
export function resetPageTools(): void {
  on.clear()
  resetAuditStyles()
  renderPageTools()
}

export function initPageTools(element: HTMLElement, dependencies: Deps): void {
  host = element
  deps = dependencies
  renderPageTools()
}
