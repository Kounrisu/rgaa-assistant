/**
 * The “Audit styles” menu of the page tools: the style sheets that outline and label one kind of element on the page (the owner's
 * sheets, see lib/audit-styles.ts). Two ways of working, chosen in the menu and kept in this browser:
 * - here: the panel applies a sheet (switch per sheet, the sheets of the theme being reviewed first);
 * - Stylus: the auditor keeps using the Stylus extension, the panel only names the sheets that go with the theme (same names as in Stylus).
 * The CSS is applied by the background page (it works on pages whose Content-Security-Policy forbids injected styles) and goes away by
 * itself when the page is reloaded. A sheet changes how the page looks, so every sheet is switched off before a scan.
 */
import { t } from '../lib/i18n'
import { THEME_LABEL } from '../lib/themes'
import { auditSheets, sheetsForTheme, themesWithSheets, type StyleSheetDef, type StylesMode } from '../lib/audit-styles'

export interface StyleDeps {
  /** Asks the background page to apply (on) or remove (off) a sheet on the inspected tab. */
  apply: (message: { id: string; css: string; on: boolean }) => Promise<{ ok?: boolean; error?: string } | undefined>
  say: (message: string) => void
  /** Redraws the tools bar (the menu lives in it). */
  refresh: () => void
}

const MODE_KEY = 'rgaa-styles-mode'

let deps: StyleDeps | null = null
const active = new Set<string>()
let open = false
let currentTheme = 1
let mode: StylesMode = (() => {
  try {
    return localStorage.getItem(MODE_KEY) === 'stylus' ? 'stylus' : 'app'
  } catch {
    return 'app'
  }
})()

export function initAuditStyles(dependencies: StyleDeps): void {
  deps = dependencies
}

export const setAuditStylesTheme = (theme: number): void => {
  currentTheme = theme
}

/** The page was reloaded or changed: the browser dropped the injected CSS, every sheet is off again. */
export function resetAuditStyles(): void {
  active.clear()
}

/** How many sheets are on in the page now. */
export const activeAuditStyles = (): number => active.size

/** Takes every sheet off the page (before a scan: a sheet changes what the scan sees). Returns how many were on. */
export async function switchAuditStylesOff(): Promise<number> {
  const ids = [...active]
  for (const id of ids) {
    const sheet = auditSheets().find((s) => s.id === id)
    if (sheet && deps) await deps.apply({ id, css: sheet.css, on: false }).catch(() => undefined)
    active.delete(id)
  }
  if (ids.length) deps?.refresh()
  return ids.length
}

async function toggle(sheet: StyleSheetDef): Promise<void> {
  const next = !active.has(sheet.id)
  try {
    const response = await deps!.apply({ id: sheet.id, css: sheet.css, on: next })
    if (!response?.ok) throw new Error(response?.error ?? 'no answer')
    if (next) active.add(sheet.id)
    else active.delete(sheet.id)
    if (next) deps!.say(t('“{name}” is on. It changes how the page looks: it is switched off before the next scan.', { name: sheet.name }))
  } catch {
    deps!.say(t('Could not apply the style sheet. Reload the tab and try again.'))
  }
  deps!.refresh()
}

async function setMode(next: StylesMode): Promise<void> {
  if (next === mode) return
  if ((await switchAuditStylesOff()) > 0) deps!.say(t('Audit styles switched off.'))
  mode = next
  try {
    localStorage.setItem(MODE_KEY, mode)
  } catch {
    /* optional */
  }
  deps!.refresh()
}

const themeTitle = (theme: number): string => (theme === 0 ? t('Whole page') : `${theme}. ${t(THEME_LABEL[theme] ?? '')}`)

/** “Stylus: 06.Liens”: the sheets of the theme being reviewed, in the Stylus way of working. Empty when the theme has none. */
export function stylusHint(): HTMLElement | null {
  if (mode !== 'stylus') return null
  const names = sheetsForTheme(currentTheme).map((s) => s.name)
  if (!names.length) return null
  const span = document.createElement('span')
  span.className = 'styles-hint'
  span.textContent = `${t('Stylus')} : ${names.join(', ')}`
  span.title = t('The Stylus sheets that go with this theme. Switch Stylus off before scanning: a sheet changes what the scan sees.')
  return span
}

/** The menu, appended to the page tools bar. */
export function auditStylesMenu(): HTMLElement {
  // a button and a panel (not <details>: the display tools area has no collapsible part)
  const details = document.createElement('div')
  details.className = 'styles-menu'
  const summary = document.createElement('button')
  summary.type = 'button'
  summary.className = 'styles-toggle'
  summary.textContent = mode === 'stylus' ? t('Audit styles (Stylus)') : active.size ? t('Audit styles ({n} on)', { n: active.size }) : t('Audit styles')
  summary.setAttribute('aria-expanded', String(open))
  summary.setAttribute('aria-controls', 'styles-content')
  summary.addEventListener('click', () => {
    open = !open
    summary.setAttribute('aria-expanded', String(open))
    menu.hidden = !open
  })
  details.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && open) {
      open = false
      summary.setAttribute('aria-expanded', 'false')
      menu.hidden = true
      summary.focus()
    }
  })
  details.append(summary)

  const menu = document.createElement('div')
  menu.className = 'styles-content'
  menu.id = 'styles-content'
  menu.hidden = !open

  // the two ways of working
  const choice = document.createElement('fieldset')
  choice.className = 'styles-mode'
  const legend = document.createElement('legend')
  legend.textContent = t('How do you work?')
  choice.append(legend)
  for (const [value, label] of [['app', t('Apply the style sheets here')], ['stylus', t('I use Stylus: just name the sheets for each theme')]] as const) {
    const row = document.createElement('label')
    row.className = 'style-row'
    const radio = document.createElement('input')
    radio.type = 'radio'
    radio.name = 'styles-mode'
    radio.value = value
    radio.checked = mode === value
    radio.addEventListener('change', () => void setMode(value))
    row.append(radio, ' ', label)
    choice.append(row)
  }
  menu.append(choice)

  const hint = document.createElement('p')
  hint.className = 'hint-line'
  hint.textContent =
    mode === 'app'
      ? t('Outline and label one kind of element on the page (the sheets you know from Stylus, with the same names). They change how the page looks: they are switched off before each scan.')
      : t('Switch these sheets on in Stylus (same names). They change how the page looks: switch Stylus off before scanning.')
  menu.append(hint)

  // the sheets of the theme being shown first, then the others by theme
  for (const theme of themesWithSheets(currentTheme)) {
    const group = document.createElement('fieldset')
    group.dataset.theme = String(theme)
    const title = document.createElement('legend')
    title.textContent = themeTitle(theme)
    group.append(title)
    for (const sheet of sheetsForTheme(theme)) {
      const row = document.createElement('label')
      row.className = 'style-row'
      if (mode === 'app') {
        const box = document.createElement('input')
        box.type = 'checkbox'
        box.checked = active.has(sheet.id)
        box.dataset.sheet = sheet.id
        box.addEventListener('change', () => void toggle(sheet))
        row.append(box, ' ', sheet.name)
      } else {
        row.append(sheet.name)
      }
      group.append(row)
    }
    menu.append(group)
  }

  if (mode === 'app') {
    const actions = document.createElement('div')
    actions.className = 'menu-actions'
    const off = document.createElement('button')
    off.type = 'button'
    off.textContent = t('Switch all off')
    off.disabled = active.size === 0
    off.addEventListener('click', () => void switchAuditStylesOff())
    actions.append(off)
    menu.append(actions)
  }
  details.append(menu)
  return details
}
