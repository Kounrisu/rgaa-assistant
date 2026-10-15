import { buildPack, type Pack, type PackOptions } from '../lib/audit-pack'
import type { Audit } from '../lib/types'
import { t } from '../lib/i18n'
import { h } from './dom'

/** Exact local files, including images. Nothing is uploaded or downloaded until the explicit Save action. */
export function previewPack(audit: Audit): Promise<Pack | null> {
  const snapshot = structuredClone(audit)
  const options: PackOptions = { pictures: false, openOnly: false, now: Date.now(), exclude: [] }
  let pack = buildPack(snapshot, options)
  return new Promise(resolve => {
    const previousFocus = document.activeElement as HTMLElement | null
    const dialog = h('dialog', { class: 'confirm pack-preview', 'aria-labelledby': 'pack-preview-title' })
    const files = h('select', { id: 'pack-preview-file' })
    const contents = h('div', { class: 'pack-preview-content' })
    const summary = h('p', { role: 'status' })
    let imageUrl: string | undefined
    const show = () => {
      if (imageUrl) { URL.revokeObjectURL(imageUrl); imageUrl = undefined }
      const bytes = pack.files[files.value]
      contents.replaceChildren()
      if (!bytes) return
      if (/\.(png|jpg|gif|webp)$/.test(files.value)) {
        imageUrl = URL.createObjectURL(new Blob([bytes as BlobPart]))
        contents.append(h('img', { src: imageUrl, alt: files.value }))
      } else contents.append(h('textarea', { readonly: true, 'aria-label': t('Exact file contents'), value: new TextDecoder().decode(bytes), spellcheck: false }))
    }
    const refresh = () => {
      const selected = files.value
      pack = buildPack(snapshot, options)
      files.replaceChildren(...Object.keys(pack.files).map(path => h('option', { value: path }, path)))
      if (pack.files[selected]) files.value = selected
      summary.textContent = t('{files} files, {pictures} pictures, {size} MB. Inspect each file before sharing.', { files: Object.keys(pack.files).length, pictures: pack.summary.pictures, size: (pack.zip.length / 1048576).toFixed(1) })
      show()
    }
    files.addEventListener('change', show)
    const finish = (result: Pack | null) => {
      if (imageUrl) URL.revokeObjectURL(imageUrl)
      dialog.close(); dialog.remove(); previousFocus?.focus(); resolve(result)
    }
    dialog.addEventListener('cancel', event => { event.preventDefault(); finish(null) })
    dialog.append(
      h('h2', { id: 'pack-preview-title' }, t('Preview analysis export')),
      h('p', {}, t('Export only: answers import is not available. Review assistant suggestions and enter your decisions manually.')),
      h('p', { class: 'hint warn' }, t('HTML, nearby text, names, URLs, notes and pictures can contain personal or confidential data. Exclusions do not guarantee anonymity. Nothing is uploaded.')),
      h('label', {}, h('input', { type: 'checkbox', onchange: (event: Event) => { options.pictures = (event.target as HTMLInputElement).checked; refresh() } }), t('Include pictures')),
      h('fieldset', {}, h('legend', {}, t('Exclude fields from the files')),
        ...(['html', 'text', 'notes', 'urls'] as const).map(key => h('label', {}, h('input', { type: 'checkbox', 'data-pack-exclude': key, onchange: (event: Event) => {
          options.exclude = (event.target as HTMLInputElement).checked ? [...options.exclude!, key] : options.exclude!.filter(x => x !== key)
          refresh()
        } }), t(({ html: 'HTML and context markup', text: 'Names, nearby text and tool details', notes: 'Auditor and coverage notes', urls: 'Page and element URLs' })[key])))),
      summary,
      h('label', { for: 'pack-preview-file' }, t('File to inspect')), files, contents,
      h('div', { class: 'nav' }, h('button', { type: 'button', class: 'primary', onclick: () => finish(pack) }, t('Save inspected pack')), h('button', { type: 'button', onclick: () => finish(null) }, t('Cancel'))),
    )
    document.body.append(dialog); refresh(); dialog.showModal()
  })
}
