import { FR } from './i18n-fr'

export type Lang = 'fr' | 'en'
const KEY = 'rgaa-lang'

function initial(): Lang {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'fr' || saved === 'en') return saved
  } catch {
    /* optional */
  }
  return 'fr'
}

let lang: Lang = initial()

export const getLang = (): Lang => lang

export function setLang(next: Lang): void {
  lang = next
  try {
    localStorage.setItem(KEY, next)
  } catch {
    /* optional */
  }
  document.documentElement.lang = next
}

/**
 * The English text is the key. French comes from the dictionary; a text with no French yet stays English.
 * `{name}` marks a value filled from `params`.
 */
export function t(en: string, params?: Record<string, string | number>): string {
  const text = lang === 'fr' ? (FR[en] ?? en) : en
  return params ? text.replace(/\{(\w+)\}/g, (_, k: string) => (k in params ? String(params[k]) : `{${k}}`)) : text
}

/** The French text whatever the language chosen: the Excel grid is always in French. */
export const tFr = (en: string): string => FR[en] ?? en

/** Plural by count: `plural(n, 'image', 'images')` is language-independent in form, `n` is added by the caller. */
export const plural = (n: number, one: string, many: string): string => t(n === 1 ? one : many)

const ATTRS = ['title', 'aria-label', 'placeholder'] as const

/**
 * Translates the fixed text of the page. An element marked `data-i18n` has its text translated; one marked
 * `data-i18n-attrs="title,aria-label"` has those attributes translated. The English original is kept in the element.
 */
export function translateStatic(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    el.dataset.en ??= el.textContent ?? ''
    el.textContent = t(el.dataset.en)
  })
  root.querySelectorAll<HTMLElement>('[data-i18n-attrs]').forEach((el) => {
    for (const attr of (el.dataset.i18nAttrs ?? '').split(',').map((a) => a.trim()).filter((a): a is (typeof ATTRS)[number] => (ATTRS as readonly string[]).includes(a))) {
      const store = `en${attr.replace(/(^|-)(\w)/g, (_, __, c: string) => c.toUpperCase())}`
      el.dataset[store] ??= el.getAttribute(attr) ?? ''
      el.setAttribute(attr, t(el.dataset[store]!))
    }
  })
}
