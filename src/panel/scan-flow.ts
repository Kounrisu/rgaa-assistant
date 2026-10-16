/**
 * Scanning the inspected page: the images and every other scanned theme, then the previews.
 */
import { state } from './state'
import { say, dom } from './dom'
import { t } from '../lib/i18n'
import { SCANNED_THEMES, FINDING_THEMES } from '../lib/themes'
import { inspectedUrl, inspectedTitle, sendToPage, inspectedTabId, capturePreviews, applyBoxes } from './page-bridge'
import { pageLabel, adoptSite, persist } from './model'
import { normalizeUrl, findPage } from '../lib/audit-store'
import { askConfirm } from './dialogs'
import { switchTo, setView, renderAll } from './router'
import { colorOf } from '../lib/theme-colors'
import { mergeCoverage } from '../lib/scan-coverage'
import { mergeScan, mergeFindings } from './scan-merge'
import { switchAuditStylesOff } from './audit-styles-ui'
import { listedFindings } from './review-state'

export async function scan(): Promise<void> {
  state.lastScanOk = false
  if (!state.page) return void say(t('Add a page to the audit pages sample first (button “Audit pages sample”).'))
  const scannable = state.page.themes.filter((n) => SCANNED_THEMES.has(n))
  if (!scannable.length) return void say(t('None of the selected themes can be scanned: they are checklists. Select Images, Frames or Colours to scan.'))
  say(t('Scanning…'))
  // an audit style changes how the page looks (revealed hidden content, forced layout): the scan must see the page as it is
  const stylesOff = await switchAuditStylesOff()
  try {
    const [url, title] = await Promise.all([inspectedUrl(), inspectedTitle()])
    state.liveUrl = url
    const rec = state.page
    const label = pageLabel(rec)
    if (url && !rec.url) {
      rec.url = normalizeUrl(url)
      adoptSite(rec.url)
    }
    else if (url && normalizeUrl(url) !== normalizeUrl(rec.url)) {
      if (state.runBusy) throw new Error('The inspected URL changed during automatic checks')
      const other = findPage(state.audit, url)
      const question = other
        ? `${t('The browser is on {other} ({url}), not on {label}.', { other: pageLabel(other), url, label })}\n\n${t('OK: scan into {other} instead.', { other: pageLabel(other) })}\n${t('Cancel: stop.')}`
        : `${t('The browser is on {url}, but {label} is registered for {registered}.', { url, label, registered: rec.url })}\n\n${t('OK: scan into {label} and update its URL.', { label })}\n${t('Cancel: stop.')}`
      if (!(await askConfirm(t('The browser is on another page'), question, t('Scan into {label}', { label: other ? pageLabel(other) : label })))) return void say(t('Scan cancelled.'))
      if (other) {
        switchTo(other.id)
        return void (await scan())
      }
      rec.url = normalizeUrl(url)
    }
    if (!rec.title && title) rec.title = title

    const parts: string[] = []
    if (stylesOff) parts.push(t('{n} audit style(s) switched off first', { n: stylesOff }))
    const first = state.scanCount === 0
    const selectedKey = state.elements.find((e) => e.id === state.selectedId)?.key
    if (rec.themes.includes(1)) {
      const response = await sendToPage(inspectedTabId(), { type: 'RGAA_HIGHLIGHT_IMAGES', color: colorOf(1) })
      if (state.runBusy && normalizeUrl(await inspectedUrl()) !== normalizeUrl(rec.url)) throw new Error('The inspected URL changed during automatic checks')
      rec.scanCoverage = mergeCoverage(rec.scanCoverage, response?.coverage)
      const { added, renumbered, map } = mergeScan(response?.elements ?? [])
      await sendToPage(inspectedTabId(), { type: 'RGAA_RELABEL', map })
      if (!rec.scannedThemes.includes(1)) rec.scannedThemes.push(1)
      state.selectedId = state.elements.find((e) => e.key === selectedKey)?.id ?? state.elements[0]?.id ?? null
      const gone = state.elements.filter((e) => !e.present).length
      parts.push([t('{n} image(s)', { n: state.elements.length }), ...(first ? [] : [t('{n} new', { n: added })]), ...(gone ? [t('{n} gone', { n: gone })] : []), ...(!first && renumbered ? [t('{n} renumbered (numbers follow the page order)', { n: renumbered })] : [])].join(', '))
    } else {
      state.scanCount++
    }
    for (const tn of rec.themes.filter((n) => FINDING_THEMES.has(n))) {
      const response = await sendToPage(inspectedTabId(), { type: 'RGAA_SCAN_THEME', theme: tn, color: colorOf(tn) })
      if (state.runBusy && normalizeUrl(await inspectedUrl()) !== normalizeUrl(rec.url)) throw new Error('The inspected URL changed during automatic checks')
      rec.scanCoverage = mergeCoverage(rec.scanCoverage, response?.coverage)
      const { map, added } = mergeFindings(tn, response?.findings ?? [])
      await sendToPage(inspectedTabId(), { type: 'RGAA_RELABEL', map, theme: tn })
      const n = rec.findings.filter((f) => f.theme === tn).length
      parts.push(tn === 2 ? t('{n} frame(s)', { n }) : tn === 6 ? t('{n} link(s)', { n }) : tn === 9 ? t('{n} heading(s) and landmark(s)', { n }) : tn === 5 ? t('{n} table(s)', { n }) : tn === 11 ? t('{n} field(s)', { n }) : tn === 7 ? t('{n} component(s)', { n }) : `${t('{n} contrast finding(s)', { n: listedFindings(tn).length })}${added ? ` (${t('{n} new', { n: added })})` : ''}`)
    }
    const missing = rec.findings.filter((f) => f.present && !f.shot && f.type !== 'contrast-ok' && rec.themes.includes(f.theme))
    const taken = await capturePreviews(state.elements, missing)
    if (taken.images) parts.push(t('{n} image picture(s)', { n: taken.images }))
    if (taken.findings) parts.push(t('{n} preview(s)', { n: taken.findings }))
    state.filter = 'all'
    state.findingFilter = 'all'
    await applyBoxes()
    state.scannedThisSession.add(rec.id)
    dom.newBanner.hidden = true
    dom.navBanner.hidden = true
    setView('review')
    renderAll()
    persist()
    state.lastScanOk = true
    say(
      first
        ? t('{label} scanned: {parts}.', { label, parts: parts.join(' · ') })
        : t('Rescan {n} of {label}: {parts}.', { n: state.scanCount, label, parts: parts.join(' · ') }),
    )
  } catch (err) {
    say(t('Could not reach the page. Reload the tab, check site access in about:addons, and try again.'))
    console.error(err)
  }
}
