import { t } from '../lib/i18n'

/**
 * The "page tools" bar: switches that change what the page shows so manual checks are easier
 * (hidden content, table structure, tab order, styles off, text spacing, languages).
 */
type Tool = 'reveal' | 'tables' | 'taborder' | 'nocss' | 'spacing' | 'lang'

/** The RGAA themes where each tool belongs: it is the one to reach for while checking those criteria. */
const TOOL_THEMES: Record<Tool, number[]> = {
  reveal: [1, 2, 5, 6, 9, 11, 12],
  tables: [5],
  taborder: [6, 7, 11, 12],
  nocss: [5, 9, 10],
  spacing: [10],
  lang: [8],
}

const TOOLS: { id: Tool; label: string; title: string }[] = [
  { id: 'reveal', label: 'Hidden content', title: 'Show what is visually hidden but read by screen readers (hidden tables, skip links…), outlined in magenta. Switch off to put it back.' },
  { id: 'tables', label: 'Tables', title: 'On every table: its caption (or the lack of one), and on every header cell its scope, id and the headers attributes of the cells (RGAA 5.4 to 5.7).' },
  { id: 'taborder', label: 'Tab order', title: 'Number the focusable elements in the order the Tab key visits them, with a line between them. Red: positive tabindex; magenta: visually hidden (RGAA 12.8).' },
  { id: 'nocss', label: 'Styles off', title: 'Turn the style sheets off to check that the information stays understandable and in a logical order (RGAA 10.3).' },
  { id: 'spacing', label: 'Text spacing', title: 'Apply the text spacing of the test: line 1.5, letters 0.12 em, words 0.16 em, paragraphs 2 em, to check nothing is lost (RGAA 10.12).' },
  { id: 'lang', label: 'Languages', title: 'Show the lang attribute of the page and of every element that changes the language (RGAA 8.3, 8.7).' },
]

interface Deps {
  send: (payload: unknown) => Promise<{ count?: number } | undefined>
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
}

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

/** The page was reloaded or changed: every tool is off again. */
export function resetPageTools(): void {
  on.clear()
  renderPageTools()
}

export function initPageTools(element: HTMLElement, dependencies: Deps): void {
  host = element
  deps = dependencies
  renderPageTools()
}
