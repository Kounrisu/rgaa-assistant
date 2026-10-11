/**
 * Components scanner (RGAA theme 7, test 7.1.3): finds the interface components of the page that follow (or should
 * follow) a WAI-ARIA Authoring Practices pattern, runs the structural checks a script can do, and leaves the keyboard
 * behaviour to the auditor. Imported by the content script only (inlined in its bundle); the wording of the checks
 * lives in `src/lib/apg-patterns.ts` (same check ids), which this file must not import.
 */
import { OVERLAY_ID, boundedContext, labelledByTextFor, rendered, shortHtml, visibilityOf } from './dom-utils'
import type { RawFinding } from '../lib/types'

interface Check {
  id: string
  ok: boolean
  detail?: string
}

const ours = (el: Element) => Boolean(el.closest(`[id^="${OVERLAY_ID}"]`))
const role = (el: Element) => (el.getAttribute('role') ?? '').trim().toLowerCase().split(/\s+/)[0]
const attr = (el: Element, name: string) => el.getAttribute(name)?.trim() ?? null
const isBool = (v: string | null) => v === 'true' || v === 'false'
const byId = (id: string | null) => (id ? document.getElementById(id) : null)
const tabindex = (el: Element) => {
  const v = attr(el, 'tabindex')
  return v === null ? null : Number(v)
}
const NATIVE_FOCUSABLE = 'a[href], button, input, select, textarea, summary, [contenteditable="true"]'
const NAME_FROM_CONTENT = new Set(['button', 'tab', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'option', 'treeitem', 'checkbox', 'radio', 'switch', 'link', 'heading', 'tooltip', 'gridcell', 'cell', 'row'])
/** Can take the focus by script or keyboard (tabindex="-1" counts) — used for "contains a focusable element". */
const focusable = (el: Element) => !el.hasAttribute('disabled') && (tabindex(el) !== null || el.matches(NATIVE_FOCUSABLE))
/** Reached with the Tab key. */
const inTabSequence = (el: Element) => !el.hasAttribute('disabled') && (tabindex(el) !== null ? tabindex(el)! >= 0 : el.matches(NATIVE_FOCUSABLE))

function nameOf(el: Element): string {
  const labelled = labelledByTextFor(el)
  if (labelled) return labelled
  const aria = attr(el, 'aria-label')
  if (aria) return aria
  const id = el.getAttribute('id')
  if (id) {
    const label = Array.from(document.querySelectorAll('label[for]')).find((l) => l.getAttribute('for') === id)
    const text = label?.textContent?.replace(/\s+/g, ' ').trim()
    if (text) return text
  }
  const tag = el.tagName.toLowerCase()
  // name from content: only the roles ARIA allows it for (a dialog, a list or a tree is not named by its text)
  if (NAME_FROM_CONTENT.has(role(el)) || ['button', 'summary', 'a', 'option', 'label'].includes(tag)) {
    const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim()
    if (text) return text.length > 80 ? `${text.slice(0, 79)}…` : text
    const img = el.querySelector('img[alt], svg title')
    const alt = img?.getAttribute('alt') ?? img?.textContent ?? ''
    if (alt.trim()) return alt.trim()
  }
  return attr(el, 'title') ?? attr(el, 'placeholder') ?? ''
}

/** One finding per component; `checks` are the structural results, `fails` their failures. */
function finding(pattern: string, el: Element, checks: Check[], extraFacts: Record<string, string | null> = {}): RawFinding {
  const name = nameOf(el)
  const fails = checks.filter((c) => !c.ok).length
  const vis = visibilityOf(el)
  const tag = el.tagName.toLowerCase()
  return {
    type: `widget-${pattern}`,
    id: 0,
    label: name ? `“${name.length > 56 ? `${name.slice(0, 55)}…` : name}”` : `<${tag}> without name`,
    summary: fails ? `${fails} structure problem(s)` : 'structure OK',
    facts: {
      Pattern: pattern,
      Role: role(el) || null,
      'Accessible name': name || null,
      'Structure checks': `${checks.length - fails}/${checks.length} OK`,
      ...extraFacts,
      Visibility: vis.Visibility,
      Element: `<${tag}>`,
    },
    html: shortHtml(el),
    contextHtml: boundedContext(el),
    count: 1,
    data: { pattern, fails, checks: JSON.stringify(checks), humanNeeded: fails > 0, hidden: vis.hidden, badge: pattern },
  }
}

const rovingCheck = (id: string, items: Element[]): Check => {
  const inSeq = items.filter(inTabSequence).length
  return { id, ok: inSeq <= 1, detail: `${inSeq} in the Tab sequence` }
}
const nameCheck = (id: string, el: Element): Check => {
  const n = nameOf(el)
  return { id, ok: Boolean(n), detail: n ? `“${n}”` : 'no name' }
}

function scanTablists(seen: Set<Element>): [RawFinding, Element[]][] {
  const out: [RawFinding, Element[]][] = []
  const lists = Array.from(document.querySelectorAll('[role="tablist"]')).filter((el) => !ours(el) && rendered(el))
  for (const list of lists) {
    const tabs = Array.from(list.querySelectorAll('[role="tab"]'))
    // a tab outside the tablist that controls one of its panels is a structure error
    const stray = Array.from(document.querySelectorAll('[role="tab"]')).filter((other) => !list.contains(other) && Boolean(attr(other, 'aria-controls')) && tabs.some((x) => attr(x, 'aria-controls') === attr(other, 'aria-controls')))
    const selected = tabs.filter((t) => attr(t, 'aria-selected') === 'true')
    const panels = tabs.map((t) => byId(attr(t, 'aria-controls')))
    const missingPanels = tabs.filter((_, i) => !panels[i] || role(panels[i]!) !== 'tabpanel')
    const unlabelled = panels.filter((p, i) => p && role(p) === 'tabpanel' && !(attr(p, 'aria-labelledby') ?? '').split(/\s+/).includes(tabs[i].getAttribute('id') ?? '\u0000'))
    const checks: Check[] = [
      { id: 'tab-roles', ok: tabs.length > 0 && !stray.length, detail: `${tabs.length} tab(s)` },
      { id: 'tab-selected', ok: selected.length === 1, detail: `${selected.length} selected` },
      { id: 'tab-controls', ok: !missingPanels.length, detail: missingPanels.length ? `${missingPanels.length} tab(s) without panel` : `${tabs.length} panel(s) found` },
      { id: 'panel-labelled', ok: !unlabelled.length, detail: unlabelled.length ? `${unlabelled.length} panel(s) not labelled by their tab` : 'all panels labelled' },
      rovingCheck('tab-roving', tabs),
      { id: 'tablist-name', ok: lists.length < 2 || Boolean(nameOf(list)), detail: nameOf(list) ? `“${nameOf(list)}”` : lists.length < 2 ? 'single tablist' : 'no name' },
    ]
    tabs.forEach((t) => seen.add(t))
    out.push([finding('tabs', list, checks, { Tabs: String(tabs.length) }), [list]])
  }
  return out
}

function scanDialogs(): [RawFinding, Element[]][] {
  const out: [RawFinding, Element[]][] = []
  // dialogs are usually hidden until opened: list them anyway, the auditor opens them and rescans
  for (const d of Array.from(document.querySelectorAll('[role="dialog"], [role="alertdialog"], dialog'))) {
    if (ours(d)) continue
    const native = d.tagName.toLowerCase() === 'dialog'
    const checks: Check[] = [
      nameCheck('dialog-name', d),
      { id: 'dialog-modal', ok: attr(d, 'aria-modal') === 'true' || native, detail: attr(d, 'aria-modal') ? `aria-modal="${attr(d, 'aria-modal')}"` : native ? 'native <dialog> (modal if opened with showModal())' : 'no aria-modal' },
      { id: 'dialog-focusable', ok: Array.from(d.querySelectorAll(`${NATIVE_FOCUSABLE}, [tabindex]`)).some(focusable), detail: `${Array.from(d.querySelectorAll(`${NATIVE_FOCUSABLE}, [tabindex]`)).filter(focusable).length} focusable element(s)` },
    ]
    out.push([finding('dialog', d, checks, { Open: rendered(d) ? 'yes' : 'no (open it, then rescan)' }), [d]])
  }
  return out
}

function scanMenus(seen: Set<Element>): [RawFinding, Element[]][] {
  const out: [RawFinding, Element[]][] = []
  for (const m of Array.from(document.querySelectorAll('[role="menu"], [role="menubar"]'))) {
    if (ours(m) || m.closest('[role="menu"] [role="menu"], [role="menubar"] [role="menu"]') === m) continue // submenus belong to their parent
    const items = Array.from(m.querySelectorAll('[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]')).filter((i) => i.closest('[role="menu"], [role="menubar"]') === m || i.closest('[role="menu"]')?.closest('[role="menu"], [role="menubar"]') === m)
    const others = Array.from(m.children).filter((c) => !['menuitem', 'menuitemcheckbox', 'menuitemradio', 'group', 'presentation', 'none', 'separator', 'menu'].includes(role(c)) && c.tagName.toLowerCase() !== 'hr')
    const isBar = role(m) === 'menubar'
    const id = m.getAttribute('id')
    const trigger = isBar ? null : Array.from(document.querySelectorAll('[aria-haspopup]')).find((b) => (id && attr(b, 'aria-controls') === id) || b.nextElementSibling === m || b.parentElement === m.parentElement)
    const checks: Check[] = [
      { id: 'menu-items', ok: items.length > 0 && !others.length, detail: `${items.length} item(s)${others.length ? `, ${others.length} other child(ren)` : ''}` },
      { id: 'menu-trigger', ok: isBar || Boolean(trigger && isBool(attr(trigger, 'aria-expanded'))), detail: isBar ? 'menubar' : trigger ? `button “${nameOf(trigger)}”, aria-expanded="${attr(trigger, 'aria-expanded') ?? 'missing'}"` : 'no button with aria-haspopup found' },
      rovingCheck('menu-roving', items),
    ]
    items.forEach((i) => seen.add(i))
    if (trigger) seen.add(trigger)
    out.push([finding('menu', m, checks, { Items: String(items.length) }), [trigger ?? m]])
  }
  return out
}

function scanDisclosures(seen: Set<Element>): [RawFinding, Element[]][] {
  const out: [RawFinding, Element[]][] = []
  const buttons = Array.from(document.querySelectorAll('[aria-expanded]')).filter(
    (b) => !ours(b) && !seen.has(b) && rendered(b) && !attr(b, 'aria-haspopup') && !['tab', 'combobox', 'treeitem', 'menuitem', 'row', 'gridcell', 'link'].includes(role(b)) && !b.closest('[role="tablist"], [role="tree"], [role="menu"], [role="menubar"]'),
  )
  const headed = (b: Element) => Boolean(b.closest('h1, h2, h3, h4, h5, h6, [role="heading"]'))
  // an accordion is a run of headings holding buttons under one container (directly, or each in its own section)
  const groups = new Map<Element, Element[]>()
  const headingParent = (b: Element) => b.closest('h1, h2, h3, h4, h5, h6, [role="heading"]')!.parentElement
  for (const b of buttons) {
    if (!headed(b)) continue
    const container = headingParent(b)
    if (container) groups.set(container, [...(groups.get(container) ?? []), b])
  }
  for (const [container, bs] of Array.from(groups.entries())) {
    if (bs.length > 1 || !container.parentElement) continue
    groups.delete(container)
    const up = container.parentElement
    groups.set(up, [...(groups.get(up) ?? []), ...bs])
  }
  for (const [container, bs] of Array.from(groups.entries())) if (bs.length < 2) groups.delete(container)
  const accordions = new Set(Array.from(groups.entries()).filter(([, bs]) => bs.length >= 2).flatMap(([, bs]) => bs))
  const baseChecks = (b: Element): Check[] => {
    const target = byId(attr(b, 'aria-controls'))
    const expanded = attr(b, 'aria-expanded')
    return [
      { id: 'disclosure-button', ok: b.tagName.toLowerCase() === 'button' || role(b) === 'button' || b.tagName.toLowerCase() === 'summary', detail: `<${b.tagName.toLowerCase()}>${role(b) ? ` role="${role(b)}"` : ''}` },
      { id: 'disclosure-expanded', ok: isBool(expanded), detail: `aria-expanded="${expanded}"` },
      { id: 'disclosure-controls', ok: !attr(b, 'aria-controls') || Boolean(target), detail: attr(b, 'aria-controls') ? (target ? `aria-controls → #${attr(b, 'aria-controls')}` : `aria-controls="${attr(b, 'aria-controls')}": no such element`) : 'no aria-controls (optional)' },
    ]
  }
  for (const [container, bs] of groups) {
    if (bs.length < 2) continue
    const checks: Check[] = [{ id: 'accordion-heading', ok: true, detail: `${bs.length} header(s) in headings` }]
    const merged = (id: string) => {
      const results = bs.map((b) => baseChecks(b).find((c) => c.id === id)!)
      const bad = results.filter((c) => !c.ok)
      return { id, ok: !bad.length, detail: bad.length ? `${bad.length} of ${bs.length}: ${bad[0].detail}` : `${bs.length} of ${bs.length}` }
    }
    checks.push(merged('disclosure-button'), merged('disclosure-expanded'), { ...merged('disclosure-controls'), ok: bs.every((b) => Boolean(byId(attr(b, 'aria-controls')))) })
    bs.forEach((b) => seen.add(b))
    const first = nameOf(bs[0])
    const acc = finding('accordion', container, checks, { Headers: String(bs.length), 'Accessible name': first ? `“${first}”…` : null })
    acc.label = first ? `“${first}”…` : `${bs.length} headers`
    out.push([acc, bs])
  }
  for (const b of buttons) {
    if (accordions.has(b)) continue
    const target = byId(attr(b, 'aria-controls'))
    const checks = baseChecks(b)
    if (target) checks.push({ id: 'disclosure-state', ok: attr(b, 'aria-expanded') === 'true' ? rendered(target) : !rendered(target), detail: `content ${rendered(target) ? 'shown' : 'hidden'}, aria-expanded="${attr(b, 'aria-expanded')}"` })
    seen.add(b)
    out.push([finding('disclosure', b, checks), [b]])
  }
  for (const d of Array.from(document.querySelectorAll('details'))) {
    if (ours(d) || !rendered(d)) continue
    const summary = d.firstElementChild?.tagName.toLowerCase() === 'summary' ? d.firstElementChild : null
    const text = summary?.textContent?.trim() ?? ''
    out.push([finding('details', summary ?? d, [{ id: 'details-summary', ok: Boolean(summary && text), detail: summary ? (text ? `“${text.slice(0, 60)}”` : 'empty summary') : 'no <summary>' }]), [summary ?? d]])
  }
  return out
}

function scanComboboxes(seen: Set<Element>): [RawFinding, Element[]][] {
  const out: [RawFinding, Element[]][] = []
  for (const c of Array.from(document.querySelectorAll('[role="combobox"]'))) {
    if (ours(c) || !rendered(c)) continue
    const expanded = attr(c, 'aria-expanded')
    const popupId = attr(c, 'aria-controls') ?? attr(c, 'aria-owns')
    const popup = byId(popupId)
    const ac = attr(c, 'aria-autocomplete')
    const checks: Check[] = [
      nameCheck('combobox-name', c),
      { id: 'combobox-expanded', ok: isBool(expanded), detail: `aria-expanded="${expanded}"` },
      { id: 'combobox-popup', ok: expanded !== 'true' ? !popupId || Boolean(popup) : Boolean(popup && ['listbox', 'tree', 'grid', 'dialog'].includes(role(popup))), detail: popup ? `#${popupId} role="${role(popup)}"` : popupId ? `"${popupId}": no such element` : 'no aria-controls (needed when expanded)' },
      { id: 'combobox-autocomplete', ok: !ac || ['none', 'inline', 'list', 'both'].includes(ac), detail: ac ? `aria-autocomplete="${ac}"` : 'no aria-autocomplete' },
    ]
    if (popup) seen.add(popup)
    seen.add(c)
    out.push([finding('combobox', c, checks), [c]])
  }
  return out
}

function scanListboxes(seen: Set<Element>): [RawFinding, Element[]][] {
  const out: [RawFinding, Element[]][] = []
  for (const l of Array.from(document.querySelectorAll('[role="listbox"]'))) {
    if (ours(l) || seen.has(l) || !rendered(l)) continue
    const options = Array.from(l.querySelectorAll('[role="option"]'))
    const others = Array.from(l.children).filter((c) => !['option', 'group', 'presentation', 'none'].includes(role(c)))
    const withSelected = options.filter((o) => isBool(attr(o, 'aria-selected')))
    const checks: Check[] = [
      nameCheck('listbox-name', l),
      { id: 'listbox-options', ok: options.length > 0 && !others.length, detail: `${options.length} option(s)${others.length ? `, ${others.length} other child(ren)` : ''}` },
      { id: 'listbox-selected', ok: withSelected.length > 0, detail: `${withSelected.length} option(s) with aria-selected` },
    ]
    options.forEach((o) => seen.add(o))
    out.push([finding('listbox', l, checks, { Options: String(options.length), Multiselectable: attr(l, 'aria-multiselectable') }), [l]])
  }
  return out
}

function valueChecks(prefix: string, el: Element, minMaxRequired: boolean): Check {
  const now = Number(attr(el, 'aria-valuenow'))
  const min = attr(el, 'aria-valuemin')
  const max = attr(el, 'aria-valuemax')
  const hasNow = attr(el, 'aria-valuenow') !== null && !Number.isNaN(now)
  const minOk = min === null ? !minMaxRequired : !Number.isNaN(Number(min))
  const maxOk = max === null ? !minMaxRequired : !Number.isNaN(Number(max))
  const inRange = (min === null || now >= Number(min)) && (max === null || now <= Number(max))
  return { id: `${prefix}-values`, ok: hasNow && minOk && maxOk && inRange, detail: `now=${attr(el, 'aria-valuenow') ?? '—'} min=${min ?? '—'} max=${max ?? '—'}${attr(el, 'aria-valuetext') ? ` text=“${attr(el, 'aria-valuetext')}”` : ''}` }
}

function scanRanges(): [RawFinding, Element[]][] {
  const out: [RawFinding, Element[]][] = []
  for (const el of Array.from(document.querySelectorAll('[role="slider"], [role="spinbutton"]'))) {
    if (ours(el) || !rendered(el) || el.tagName.toLowerCase() === 'input') continue
    const p = role(el) === 'slider' ? 'slider' : 'spinbutton'
    const prefix = p === 'slider' ? 'slider' : 'spin'
    const checks: Check[] = [valueChecks(prefix, el, p === 'slider'), nameCheck(`${prefix}-name`, el), { id: `${prefix}-focusable`, ok: inTabSequence(el), detail: `tabindex="${attr(el, 'tabindex') ?? 'none'}"` }]
    out.push([finding(p, el, checks), [el]])
  }
  return out
}

function scanToggles(seen: Set<Element>): [RawFinding, Element[]][] {
  const out: [RawFinding, Element[]][] = []
  const custom = (el: Element) => el.tagName.toLowerCase() !== 'input'
  for (const el of Array.from(document.querySelectorAll('[role="switch"], [role="checkbox"]'))) {
    if (ours(el) || !custom(el) || !rendered(el) || seen.has(el)) continue
    const checked = attr(el, 'aria-checked')
    const p = role(el)
    const checks: Check[] = [
      { id: 'toggle-checked', ok: isBool(checked) || (p === 'checkbox' && checked === 'mixed'), detail: `aria-checked="${checked}"` },
      nameCheck('toggle-name', el),
      { id: 'toggle-focusable', ok: inTabSequence(el), detail: `tabindex="${attr(el, 'tabindex') ?? 'none'}"` },
    ]
    out.push([finding(p, el, checks), [el]])
  }
  const radios = Array.from(document.querySelectorAll('[role="radio"]')).filter((r) => !ours(r) && custom(r) && rendered(r) && !seen.has(r))
  const groups = new Map<Element, Element[]>()
  for (const r of radios) {
    const g = r.closest('[role="radiogroup"]') ?? r.parentElement!
    groups.set(g, [...(groups.get(g) ?? []), r])
  }
  for (const [g, rs] of groups) {
    const checked = rs.filter((r) => attr(r, 'aria-checked') === 'true')
    const badState = rs.filter((r) => !isBool(attr(r, 'aria-checked')))
    const unnamed = rs.filter((r) => !nameOf(r))
    const checks: Check[] = [
      { id: 'radio-group', ok: role(g) === 'radiogroup' && Boolean(nameOf(g)), detail: role(g) === 'radiogroup' ? (nameOf(g) ? `radiogroup “${nameOf(g)}”` : 'radiogroup without name') : 'no role="radiogroup" around the radios' },
      { id: 'toggle-checked', ok: !badState.length && checked.length <= 1, detail: `${checked.length} checked, ${badState.length} without a valid aria-checked` },
      { id: 'toggle-name', ok: !unnamed.length, detail: unnamed.length ? `${unnamed.length} radio(s) without name` : `${rs.length} named` },
      rovingCheck('radio-roving', rs),
    ]
    out.push([finding('radiogroup', g, checks, { Radios: String(rs.length) }), rs])
  }
  return out
}

function scanTrees(seen: Set<Element>): [RawFinding, Element[]][] {
  const out: [RawFinding, Element[]][] = []
  for (const tree of Array.from(document.querySelectorAll('[role="tree"]'))) {
    if (ours(tree) || seen.has(tree) || !rendered(tree)) continue
    const items = Array.from(tree.querySelectorAll('[role="treeitem"]'))
    const parents = items.filter((i) => i.querySelector('[role="group"], [role="treeitem"]') || (attr(i, 'aria-owns') && byId(attr(i, 'aria-owns'))))
    const noExpanded = parents.filter((i) => !isBool(attr(i, 'aria-expanded')))
    const checks: Check[] = [
      nameCheck('tree-name', tree),
      { id: 'tree-items', ok: items.length > 0, detail: `${items.length} node(s)` },
      { id: 'tree-expanded', ok: !noExpanded.length, detail: `${parents.length} parent node(s), ${noExpanded.length} without aria-expanded` },
      rovingCheck('tree-roving', items),
    ]
    items.forEach((i) => seen.add(i))
    out.push([finding('tree', tree, checks, { Nodes: String(items.length) }), [tree]])
  }
  return out
}

function scanTooltips(): [RawFinding, Element[]][] {
  const out: [RawFinding, Element[]][] = []
  for (const tip of Array.from(document.querySelectorAll('[role="tooltip"]'))) {
    if (ours(tip)) continue
    const id = tip.getAttribute('id')
    const owner = id ? Array.from(document.querySelectorAll('[aria-describedby], [aria-labelledby]')).find((e) => `${attr(e, 'aria-describedby') ?? ''} ${attr(e, 'aria-labelledby') ?? ''}`.split(/\s+/).includes(id)) : undefined
    const checks: Check[] = [{ id: 'tooltip-referenced', ok: Boolean(owner), detail: owner ? `referenced by <${owner.tagName.toLowerCase()}> “${nameOf(owner)}”` : id ? `no element refers to #${id}` : 'the tooltip has no id' }]
    out.push([finding('tooltip', tip, checks, { Shown: rendered(tip) ? 'yes' : 'no (hidden until triggered)' }), [owner ?? tip]])
  }
  return out
}

function scanButtons(seen: Set<Element>): [RawFinding, Element[]][] {
  const out: [RawFinding, Element[]][] = []
  for (const b of Array.from(document.querySelectorAll('[role="button"]'))) {
    if (ours(b) || seen.has(b) || !rendered(b) || ['button', 'input', 'summary'].includes(b.tagName.toLowerCase())) continue
    const pressed = attr(b, 'aria-pressed')
    const checks: Check[] = [nameCheck('button-name', b), { id: 'button-focusable', ok: inTabSequence(b), detail: `<${b.tagName.toLowerCase()}> tabindex="${attr(b, 'tabindex') ?? 'none'}"` }, { id: 'button-pressed', ok: pressed === null || isBool(pressed) || pressed === 'mixed', detail: pressed === null ? 'not a toggle button' : `aria-pressed="${pressed}"` }]
    out.push([finding('button', b, checks), [b]])
  }
  return out
}

function scanToolbars(): [RawFinding, Element[]][] {
  const out: [RawFinding, Element[]][] = []
  const bars = Array.from(document.querySelectorAll('[role="toolbar"]')).filter((b) => !ours(b) && rendered(b))
  for (const bar of bars) {
    const controls = Array.from(bar.querySelectorAll(`${NATIVE_FOCUSABLE}, [tabindex], [role="button"], [role="checkbox"], [role="radio"], [role="switch"], [role="menuitem"]`)).filter((c) => !c.hasAttribute('disabled'))
    const checks: Check[] = [
      { id: 'toolbar-controls', ok: controls.length >= 2, detail: `${controls.length} control(s)` },
      rovingCheck('toolbar-roving', controls),
      { id: 'toolbar-name', ok: bars.length < 2 || Boolean(nameOf(bar)), detail: nameOf(bar) ? `“${nameOf(bar)}”` : bars.length < 2 ? 'single toolbar' : 'no name' },
    ]
    out.push([finding('toolbar', bar, checks, { Controls: String(controls.length) }), [bar]])
  }
  return out
}

/** Every interface component of the page, in document order, with its structural checks. */
export function scanComponents(): { findings: RawFinding[]; els: Element[][] } {
  const seen = new Set<Element>()
  const all = [...scanTablists(seen), ...scanMenus(seen), ...scanComboboxes(seen), ...scanListboxes(seen), ...scanTrees(seen), ...scanDialogs(), ...scanDisclosures(seen), ...scanRanges(), ...scanToggles(seen), ...scanTooltips(), ...scanButtons(seen), ...scanToolbars()]
  // document order of the boxed element, so the numbers follow the page
  const sorted = all
    .map(([f, els], i) => ({ f, els, i }))
    .sort((a, b) => (a.els[0] && b.els[0] && a.els[0] !== b.els[0] ? (a.els[0].compareDocumentPosition(b.els[0]) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1) : a.i - b.i))
    .slice(0, 300)
  return { findings: sorted.map(({ f }, i) => ({ ...f, id: i + 1 })), els: sorted.map(({ els }) => els) }
}
