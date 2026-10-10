/**
 * Questions asked inside the panel (confirm, text, choice). The browser's own popups are not shown in a DevTools panel.
 */
import { $, dom, h } from './dom'
import { t } from '../lib/i18n'
import type { Choice } from './audit-session'

/**
 * Asks a question inside the panel. The browser's own confirm() popup is not shown in a DevTools panel
 * (it returns "no" at once), so a reset would silently do nothing.
 */
export function askConfirm(title: string, text: string, okLabel?: string): Promise<boolean> {
  return new Promise((resolve) => {
    const ok = $('confirm-ok')
    const cancel = $('confirm-cancel')
    $('confirm-title').textContent = title
    $('confirm-text').textContent = text
    ok.textContent = okLabel ?? t('Confirm')
    const finish = (answer: boolean) => {
      ok.removeEventListener('click', onOk)
      cancel.removeEventListener('click', onNo)
      dom.confirmDialog.removeEventListener('cancel', onNo)
      if (dom.confirmDialog.open) dom.confirmDialog.close()
      resolve(answer)
    }
    const onOk = () => finish(true)
    const onNo = (event: Event) => {
      event.preventDefault() // Escape would otherwise close the dialog without answering
      finish(false)
    }
    ok.addEventListener('click', onOk)
    cancel.addEventListener('click', onNo)
    dom.confirmDialog.addEventListener('cancel', onNo)
    dom.confirmDialog.showModal()
  })
}

/** A text question inside the panel (the browser's prompt() is not shown in a DevTools panel). */
export function askText(title: string, label: string, initial = '', okLabel = t('OK')): Promise<string | null> {
  return new Promise((resolve) => {
    const input = $<HTMLInputElement>('text-input')
    $('text-title').textContent = title
    $('text-label').textContent = label
    $('text-ok').textContent = okLabel
    $('text-cancel').textContent = t('Cancel')
    input.value = initial
    let done = false
    const finish = (value: string | null) => {
      if (done) return
      done = true
      dom.textDialog.removeEventListener('cancel', onCancel)
      form.removeEventListener('submit', onSubmit)
      cancel.removeEventListener('click', onCancelClick)
      dom.textDialog.close()
      resolve(value)
    }
    const form = $<HTMLFormElement>('text-form')
    const cancel = $('text-cancel')
    const onSubmit = (e: Event) => {
      e.preventDefault()
      const value = input.value.trim()
      if (value) finish(value)
      else input.focus()
    }
    const onCancel = (e: Event) => {
      e.preventDefault()
      finish(null)
    }
    const onCancelClick = () => finish(null)
    form.addEventListener('submit', onSubmit)
    cancel.addEventListener('click', onCancelClick)
    dom.textDialog.addEventListener('cancel', onCancel)
    dom.textDialog.showModal()
    input.select()
  })
}

/** A question with several answers (buttons); null when it is dismissed. */
export function askChoice(title: string, text: string, choices: Choice[]): Promise<string | null> {
  return new Promise((resolve) => {
    $('choice-title').textContent = title
    $('choice-text').textContent = text
    const box = $('choice-actions')
    box.replaceChildren()
    const finish = (id: string | null) => {
      dom.choiceDialog.removeEventListener('cancel', onCancel)
      if (dom.choiceDialog.open) dom.choiceDialog.close()
      resolve(id)
    }
    const onCancel = (event: Event) => {
      event.preventDefault() // Escape would otherwise close the dialog without answering
      finish(null)
    }
    for (const c of choices) box.append(h('button', { type: 'button', class: c.primary ? 'primary' : '', onclick: () => finish(c.id) }, c.label))
    dom.choiceDialog.addEventListener('cancel', onCancel)
    dom.choiceDialog.showModal()
  })
}
