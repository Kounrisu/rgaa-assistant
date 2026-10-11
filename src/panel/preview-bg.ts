/**
 * The background behind the image previews (list thumbnails, the big preview, the compact one on narrow screens).
 * A transparent SVG icon is invisible on the default checkerboard when it is light, so the auditor can pick a plain colour.
 * The choice is a per-browser view option (localStorage), like the box toggles; it never enters the audit.
 */
import { h } from './dom'
import { t } from '../lib/i18n'

const KEY = 'rgaa-preview-bg'
const KEY_COLOR = 'rgaa-preview-bg-color'

/** English labels (translated where shown). `color` is absent for the checkerboard and the custom colour. */
export const PREVIEW_BACKGROUNDS: { id: string; label: string; color?: string }[] = [
  { id: 'checker', label: 'Checkerboard' },
  { id: 'white', label: 'White', color: '#ffffff' },
  { id: 'pink', label: 'Light pink', color: '#fde2e8' },
  { id: 'grey', label: 'Light grey', color: '#d9dde5' },
  { id: 'dark', label: 'Dark', color: '#1f2937' },
  { id: 'custom', label: 'Custom colour' },
]

const read = (key: string): string | null => {
  try { return localStorage.getItem(key) } catch { return null }
}
const write = (key: string, value: string): void => {
  try { localStorage.setItem(key, value) } catch { /* optional */ }
}

const HEX = /^#[0-9a-f]{6}$/i
let mode = PREVIEW_BACKGROUNDS.some((b) => b.id === read(KEY)) ? (read(KEY) as string) : 'checker'
let custom = HEX.test(read(KEY_COLOR) ?? '') ? (read(KEY_COLOR) as string) : '#fde2e8'

/** Sets the colour on the document: every preview reads `--preview-bg` (the checkerboard when it is unset). */
export function applyPreviewBackground(): void {
  const color = mode === 'custom' ? custom : PREVIEW_BACKGROUNDS.find((b) => b.id === mode)?.color
  const root = document.documentElement
  if (color) root.style.setProperty('--preview-bg', color)
  else root.style.removeProperty('--preview-bg')
}

/** The control shown with the big preview: a choice of backgrounds and a colour picker for any other. */
export function previewBackgroundControl(): HTMLElement {
  applyPreviewBackground()
  const picker = h('input', {
    type: 'color',
    value: custom,
    'aria-label': t('Custom preview background colour'),
    oninput: (e: Event) => {
      custom = (e.target as HTMLInputElement).value
      mode = 'custom'
      write(KEY, mode)
      write(KEY_COLOR, custom)
      select.value = mode
      applyPreviewBackground()
    },
  })
  const select = h(
    'select',
    {
      id: 'preview-bg',
      onchange: (e: Event) => {
        mode = (e.target as HTMLSelectElement).value
        write(KEY, mode)
        applyPreviewBackground()
      },
    },
    ...PREVIEW_BACKGROUNDS.map((b) => h('option', { value: b.id, selected: b.id === mode }, t(b.label))),
  )
  return h(
    'div',
    { class: 'preview-bg-control' },
    h('label', { for: 'preview-bg' }, t('Preview background')),
    select,
    picker,
  )
}

applyPreviewBackground()
