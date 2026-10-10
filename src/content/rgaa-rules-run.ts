/**
 * Our own RGAA checks (what a script can see; the wording is in lib/rgaa-rules.ts), the skip-link check, and the
 * Asqatasun tests. Imported by the content script only (inlined in its bundle).
 */
import { OVERLAY_ID, skipTarget, visible } from './dom-utils'
// --- Asqatasun-derived: begin ---
// Imported by this script only (no other file imports the table), so it stays inside this bundle.
import { type AsqFinding, evaluateAsqRules } from '../lib/asqatasun-rules'
// --- Asqatasun-derived: end ---
import { tabOrder } from './page-tools'

/** Checks of our own that do not belong to the RGAA/Asqatasun tables: skip links. */
export function runUxRules(): { key: string; count: number; detail?: string; samples?: string[] }[] {
  const out: { key: string; count: number; detail?: string; samples?: string[] }[] = []
  const early = new Set(tabOrder().slice(0, 8))
  const skips = Array.from(early).filter((a) => a.tagName === 'A' && skipTarget(a, early).skip)
  if (!skips.length) out.push({ key: 'skip-link-missing', count: 1 })
  const broken = skips.filter((a) => !skipTarget(a, early).found)
  if (broken.length) out.push({ key: 'skip-link-broken', count: broken.length, samples: broken.map((a) => a.getAttribute('href') ?? '').slice(0, 3) })
  return out
}

/* ------------------------------------------------------------------ */
/* Our own RGAA checks (what a script can see; the wording is in lib/rgaa-rules.ts) */
/* ------------------------------------------------------------------ */

function shortSelector(el: Element): string {
  const id = el.id ? `#${CSS.escape(el.id)}` : ''
  const cls = !id && typeof el.className === 'string' && el.className.trim() ? `.${CSS.escape(el.className.trim().split(/\s+/)[0])}` : ''
  return `${el.tagName.toLowerCase()}${id}${cls}`
}

export function runRgaaRules(): { url: string; findings: { key: string; count: number; detail?: string; samples?: string[] }[] } {
  const out: { key: string; count: number; detail?: string; samples?: string[] }[] = []
  const mine = (el: Element) => !el.closest(`[id^="${OVERLAY_ID}"]`)
  const all = (selector: string): Element[] => Array.from(document.querySelectorAll(selector)).filter(mine)
  const samples = (els: Element[], n = 3) => els.slice(0, n).map(shortSelector)
  const push = (key: string, els: Element[], detail?: string) => {
    if (els.length) out.push({ key, count: els.length, detail, samples: samples(els) })
  }

  // 8.1 (document type), 8.10 (reading direction) and 10.1 (presentation tags and attributes) are Asqatasun's tests, see runAsqatasunRules()

  // 13.2 — links that open a new window without saying so
  const INFORMS = /(nouvelle\s+(fen[eê]tre|onglet)|nouvel\s+onglet|new\s+(window|tab)|external)/i
  push(
    'target-blank',
    all('a[target="_blank"]').filter((a) => {
      const hints = [a.textContent, a.getAttribute('title'), a.getAttribute('aria-label'), ...Array.from(a.querySelectorAll('img[alt], svg title')).map((n) => n.getAttribute('alt') ?? n.textContent)]
      return visible(a) && !hints.some((h) => INFORMS.test(h ?? ''))
    }),
  )

  // 11.13 — fields about the user without autocomplete
  const PERSONAL = /(e-?mail|mail|t[eé]l|phone|pr[eé]nom|firstname|first-name|lastname|last-name|nom\b|name|adresse|address|postal|zip|ville|city|naissance|birth|username|login|identifiant|password|mot de passe)/i
  const fields = all('input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([type=image]):not([type=checkbox]):not([type=radio]):not([type=file]):not([type=range]):not([type=color]):not([type=search])').filter(visible)
  push(
    'autocomplete',
    fields.filter((f) => {
      const type = (f.getAttribute('type') ?? 'text').toLowerCase()
      const personal = ['email', 'tel', 'password'].includes(type) || PERSONAL.test([f.getAttribute('name'), f.id, f.getAttribute('aria-label'), f.getAttribute('placeholder')].join(' '))
      const ac = (f.getAttribute('autocomplete') ?? '').trim().toLowerCase()
      return personal && (!ac || ac === 'off')
    }),
  )

  // 13.3 / 13.4 (office documents) are Asqatasun's tests, see runAsqatasunRules()

  // 4 — multimedia: the tests 4.1 to 4.13 are Asqatasun's (one per test), this only says that there is no sound at all (4.10)
  if (!all('video, audio, object, embed, bgsound, iframe[src*="youtube"], iframe[src*="youtu.be"], iframe[src*="vimeo"], iframe[src*="dailymotion"]').length) out.push({ key: 'no-media', count: 0 })

  // 5 — tables
  const tables = all('table, [role="table"], [role="grid"], [role="treegrid"]')
  if (!tables.length) out.push({ key: 'no-table', count: 0 })
  else {
    const noHeaders = tables.filter((t) => t.tagName === 'TABLE' && !/^(presentation|none)$/.test(t.getAttribute('role') ?? '') && t.querySelectorAll('tr').length > 1 && !t.querySelector('th, [role="columnheader"], [role="rowheader"]'))
    push('table-no-th', noHeaders)
  }

  // 11 — forms, buttons
  const anyField = all('input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([type=image]), select, textarea, [role="textbox"], [role="combobox"], [role="listbox"], [role="checkbox"], [role="radio"], [role="switch"], [role="slider"], [role="spinbutton"], [role="searchbox"]')
  if (!anyField.length) out.push({ key: 'no-form', count: 0 })
  if (!all('button, input[type=submit], input[type=button], input[type=reset], input[type=image], [role="button"]').length) out.push({ key: 'no-button', count: 0 })

  // 6 — links
  if (!all('a[href], [role="link"]').length) out.push({ key: 'no-link', count: 0 })

  // 8.6 — a title that says nothing
  const title = document.title.trim()
  if (!title || /^(sans titre|untitled( document)?|document|home|accueil|index|new page|nouvelle page)$/i.test(title) || title === location.href) out.push({ key: 'generic-title', count: 1, detail: title || 'empty' })

  // --- Asqatasun-derived: begin ---
  out.push(...runAsqatasunRules())
  // --- Asqatasun-derived: end ---

  return { url: location.href, findings: out }
}

// --- Asqatasun-derived: begin ---
/**
 * The RGAA tests ported from Asqatasun (AGPL-3.0, see NOTICE.md): the rules and their evaluation are in
 * lib/asqatasun-rules.ts (the same code runs in jsdom, see scripts/check-asqatasun.mjs); this only hides our own
 * overlay from them. Findings are keyed `asq:<rule key>`; a criterion whose every test found nothing to check comes
 * back as `asq:na:<criterion>`. Each finding carries what the panel needs (criterion, verdict, wording).
 */
function runAsqatasunRules(): AsqFinding[] {
  return evaluateAsqRules(document, (el) => Boolean(el.closest(`[id^="${OVERLAY_ID}"]`))).findings
}
// --- Asqatasun-derived: end ---
