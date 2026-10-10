/**
 * RGAA tests detected by the page script, adapted from Asqatasun.
 *
 * Derived from Asqatasun (https://github.com/Asqatasun/Asqatasun, formerly Tanaguru), licensed under the
 * GNU Affero General Public License v3 (AGPL-3.0): the rules of rules/rules-rgaa4.0, the checkers and selectors of
 * rules/rules-commons (CssLikeQueryStore, DoctypeValidityChecker, LangChecker, TextPertinenceChecker,
 * AbstractDownloadableLinkRuleImplementation, the media detection rules…) were converted from Java and Jsoup selectors
 * to TypeScript and standard CSS selectors that `document.querySelectorAll` understands. Copyright (C) 2008-2020
 * Asqatasun.org and contributors. See NOTICE.md at the root of the project.
 *
 * REMOVE THIS FILE, `asqatasun-nomenclatures.ts`, `scripts/check-asqatasun.mjs` + the blocks marked
 * `Asqatasun-derived` (inject.ts, panel.ts, i18n-fr-lib.ts) to drop the dependency: the exact steps are in NOTICE.md.
 *
 * The same code runs in the page and in jsdom: `evaluateAsqRules(document)`. `scripts/check-asqatasun.mjs` runs it on
 * Asqatasun's own HTML fixtures and compares the outcome with the one written in the file name.
 *
 * Vocabulary (Asqatasun's): a test ends as FAILED, PASSED, NOT APPLICABLE or NEED MORE INFO ("nmi": a human must
 * decide). When several checks answer for one test the order of precedence is failed, nmi, passed, na.
 *
 * Simple tests are rows of `ASQ_RULES` (a selector and what to answer when something is found or not):
 *   - `selector` (or `find`) finds the elements; `captcha` and `named` narrow them down (Asqatasun's
 *     CaptchaElementSelector and ElementWithAccessibleNameSelector).
 *   - something found: `nc` = FAILED (the criterion fails, to confirm), `review` = NEED MORE INFO (a note asking for a
 *     manual check, no verdict).
 *   - nothing found: `na` = NOT APPLICABLE, `pass` = PASSED, `nmi` = NEED MORE INFO, missing = nothing to say.
 * Tests with real logic are functions in `ASQ_CHECKS`.
 */
import {
  DEPRECATED_ATTRIBUTES,
  DEPRECATED_TAGS,
  LINK_TEXT_BLACKLIST,
  OFFICE_DOCUMENT_EXTENSIONS,
  RECOMMENDED_DOCTYPES,
  UNEXPLICIT_PAGE_TITLES,
  VALID_LANGUAGE_CODES,
  XHTML_DOCTYPES,
} from './asqatasun-nomenclatures'

export type AsqWhenFound = 'nc' | 'review'
export type AsqWhenNone = 'na' | 'pass' | 'nmi'

/** What the tests may look at: the document and a few helpers built on it. */
export interface AsqCtx {
  doc: Document
  /** The document type as Asqatasun reads it, e.g. `<!DOCTYPE html>`; empty when there is none. */
  doctype: string
  /** Asqatasun's DoctypeHtml5Checker: no doctype, or `<!doctype html>`. */
  html5: boolean
  query: (selector: string) => Element[]
  /** Text nodes that are direct children, scripts and styles left out, blanks collapsed and trimmed. */
  ownText: (el: Element) => string
}

export interface AsqRule {
  /** RGAA test id, e.g. '8.5.1'. */
  test: string
  /** RGAA criterion, e.g. '8.5'. */
  criterion: string
  /** When several rules belong to the same test: a distinct key (default: the test id). */
  key?: string
  /** Standard CSS selector. */
  selector?: string
  /** Finds the elements with code when a selector is not enough. */
  find?: (c: AsqCtx) => Element[]
  /** Keep only the elements that mention "captcha" in their own attributes or text, or in those of a sibling or an ancestor. */
  captcha?: boolean
  /** Keep only the elements that have an accessible name in Asqatasun's sense (ElementWithAccessibleNameSelector). */
  named?: boolean
  whenFound: AsqWhenFound
  whenNone?: AsqWhenNone
  /** English wording (key of the French dictionary); {n}, {samples}, {detail}, {test} and {criterion} are filled in. */
  text: string
}

/** One thing a check reports: failed (`nc`) or to be checked by a human (`review`). */
export interface AsqNote {
  key: string
  status: 'nc' | 'review'
  text: string
  els?: Element[]
  count?: number
  detail?: string
}

export interface AsqCheckResult {
  outcome: AsqOutcome
  notes?: AsqNote[]
}

export interface AsqCheck {
  /** RGAA test id. */
  test: string
  run: (c: AsqCtx) => AsqCheckResult
}

/** Wording of a criterion found not applicable (the panel fills in {criterion}). */
export const ASQ_NA_TEXT = 'RGAA {criterion}: no element to check on this page, not applicable.'

/** What the page script adds to a finding so that the panel needs no copy of this table. */
export interface AsqExtra {
  criterion: string
  test: string
  status: 'nc' | 'review' | 'na' | 'pass'
  text: string
}

/** Result of one test, with Asqatasun's vocabulary: failed, pre-qualified (need more info), passed, not applicable. */
export type AsqOutcome = 'failed' | 'nmi' | 'passed' | 'na'

export interface AsqFinding {
  key: string
  count: number
  samples?: string[]
  detail?: string
  asq: AsqExtra
}

export interface AsqEvaluation {
  /** What the panel needs: one entry per failed / to-check / not-applicable / passed criterion. */
  findings: AsqFinding[]
  /** Outcome of every ported test that could be evaluated, by RGAA test id. */
  tests: Record<string, AsqOutcome>
}

/**
 * Every test of the criteria where at least one test is ported (RGAA 4.1 wording of the criterion): a criterion is
 * "not applicable" when all its tests are, which can only be said when all of them are ported.
 */
export const ASQ_CRITERION_TESTS: Record<string, string[]> = {
  '1.1': ['1.1.1',  '1.1.2',  '1.1.3',  '1.1.4',  '1.1.5',  '1.1.6',  '1.1.7',  '1.1.8'],
  '1.4': ['1.4.1',  '1.4.2',  '1.4.3',  '1.4.4',  '1.4.5',  '1.4.6',  '1.4.7'],
  '1.5': ['1.5.1',  '1.5.2'],
  '2.1': ['2.1.1'],
  '2.2': ['2.2.1'],
  '3.1': ['3.1.1',  '3.1.2',  '3.1.3',  '3.1.4',  '3.1.5',  '3.1.6'],
  '4.1': ['4.1.1',  '4.1.2',  '4.1.3'],
  '4.2': ['4.2.1',  '4.2.2',  '4.2.3'],
  '4.3': ['4.3.1',  '4.3.2'],
  '4.4': ['4.4.1'],
  '4.5': ['4.5.1',  '4.5.2'],
  '4.6': ['4.6.1',  '4.6.2'],
  '4.7': ['4.7.1'],
  '4.8': ['4.8.1',  '4.8.2'],
  '4.9': ['4.9.1'],
  '4.11': ['4.11.1',  '4.11.2',  '4.11.3'],
  '4.12': ['4.12.1',  '4.12.2'],
  '4.13': ['4.13.1',  '4.13.2'],
  '6.1': ['6.1.1',  '6.1.2',  '6.1.3',  '6.1.4',  '6.1.5'],
  '7.4': ['7.4.1'],
  '8.1': ['8.1.1',  '8.1.2',  '8.1.3'],
  '8.3': ['8.3.1'],
  '8.4': ['8.4.1'],
  '8.5': ['8.5.1'],
  '8.6': ['8.6.1'],
  '8.9': ['8.9.1'],
  '8.10': ['8.10.1',  '8.10.2'],
  '9.1': ['9.1.1',  '9.1.2',  '9.1.3'],
  '9.2': ['9.2.1'],
  '10.1': ['10.1.1',  '10.1.2',  '10.1.3'],
  '10.9': ['10.9.1',  '10.9.2',  '10.9.3',  '10.9.4'],
  '10.10': ['10.10.1',  '10.10.2',  '10.10.3',  '10.10.4'],
  '11.2': ['11.2.1',  '11.2.2',  '11.2.3',  '11.2.4',  '11.2.5',  '11.2.6'],
  '11.10': ['11.10.1',  '11.10.2',  '11.10.3',  '11.10.4',  '11.10.5',  '11.10.6',  '11.10.7'],
  '11.11': ['11.11.1',  '11.11.2'],
  '11.12': ['11.12.1',  '11.12.2'],
  '11.13': ['11.13.1'],
  '13.1': ['13.1.1',  '13.1.2',  '13.1.3',  '13.1.4'],
  '13.3': ['13.3.1'],
  '13.4': ['13.4.1'],
  '13.7': ['13.7.1',  '13.7.2',  '13.7.3'],
}

/* ------------------------------------------------------------------ */
/* Selectors and helpers shared by several tests (CssLikeQueryStore, converted) */
/* ------------------------------------------------------------------ */

const AUDIO_EXT = ['wav', 'cda', 'mid', 'mp2', 'mp3', 'mp3pro', 'mod', 'rm', 'ram', 'wma', 'ogg', 'oga', 'aif', 'aiff', 'aa', 'aac', 'm4a', 'vqf', 'au', 'm3u', 'riff', 'bwf', 'caf', 'pcm', 'raw', 'flac', 'alac', 'ac3', 'acc']
const VIDEO_EXT = ['mp4', 'avi', 'wmv', 'mov', 'xvid', 'mkv', 'mka', 'mks', 'flv', 'rmvb', 'mpa', 'wma', 'mp2', 'm2p', 'dif', 'dv', 'vob', 'vro', 'vivo', 'bik', 'asf', 'ifo', 'mts', 'mxf', 'nds', 'rv', 'web', 'wlmp', 'wmp', 'ogv']
/** Our own addition: players in an iframe are time-based media too (otherwise a page with only a YouTube player would look "without media"). */
const MEDIA_IFRAMES = 'iframe[src*="youtube"], iframe[src*="youtu.be"], iframe[src*="vimeo"], iframe[src*="dailymotion"]'

const nl = (s: string | null | undefined): string => (s ?? '').trim()

/** Elements of several lists, once each, in document order. */
function union(...lists: Element[][]): Element[] {
  const set = new Set<Element>()
  for (const list of lists) for (const el of list) set.add(el)
  return [...set].sort((a, b) => (a === b ? 0 : a.compareDocumentPosition(b) & 4 ? -1 : 1))
}

/**
 * Links to a media file. Asqatasun looks for the extension anywhere in the href (`a[href~=(?i)\.(mp4|…)]`); here it
 * must end the path (or be followed by ? or #), to avoid ".au" in "example.au/page".
 */
function linksTo(c: AsqCtx, exts: string[]): Element[] {
  const re = new RegExp(`\\.(?:${[...new Set(exts)].join('|')})(?:[?#]|$)`, 'i')
  return c.query('a[href]').filter((a) => re.test(a.getAttribute('href') ?? ''))
}

const withAudioExt = (c: AsqCtx): Element[] => {
  const re = new RegExp(`\\.(?:${AUDIO_EXT.join('|')})`, 'i')
  return c.query('video[src], video:has(source[src])').filter((v) => re.test(v.getAttribute('src') ?? '') || Array.from(v.querySelectorAll('source[src]')).some((s) => re.test(s.getAttribute('src') ?? '')))
}
const NON_TIME_BASED = 'svg, canvas, object[data], embed[src]'
const TIME_BASED_ONLY = 'audio[src], audio:has(source[src]), bgsound, video[src], video:has(source[src])'
/** MEDIA_AUDIO_CSS_LIKE_QUERY + LINK_MEDIA_AUDIO_CSS_LIKE_QUERY */
const audioMedia = (c: AsqCtx): Element[] => union(c.query('audio[src], audio:has(source[src]), bgsound, object[data], embed[src]'), withAudioExt(c), linksTo(c, AUDIO_EXT))
/** MEDIA_VIDEO_CSS_LIKE_QUERY + LINK_MEDIA_VIDEO_CSS_LIKE_QUERY */
const videoMedia = (c: AsqCtx): Element[] => union(c.query(`video[src], video:has(source[src]), ${NON_TIME_BASED}, ${MEDIA_IFRAMES}`), linksTo(c, VIDEO_EXT))
/** TIME_BASED_MEDIA_CSS_LIKE_QUERY + LINK_TIME_BASED_MEDIA_CSS_LIKE_QUERY */
const timeBasedMedia = (c: AsqCtx): Element[] => union(c.query(`${TIME_BASED_ONLY}, ${NON_TIME_BASED}, ${MEDIA_IFRAMES}`), linksTo(c, [...AUDIO_EXT, ...VIDEO_EXT]))
/** NO_TIME_BASED_MEDIA_CSS_LIKE_QUERY */
const nonTimeBasedMedia = (c: AsqCtx): Element[] => c.query(NON_TIME_BASED)
/** MEDIA_CSS_LIKE_QUERY: every kind. */
const anyMedia = (c: AsqCtx): Element[] => union(timeBasedMedia(c), nonTimeBasedMedia(c))

const FIELD_TAGS = ['datalist', 'meter', 'optgroup', 'option', 'output', 'progress', 'select', 'textarea']
const FIELD_TYPES = ['checkbox', 'color', 'date', 'datetime-local', 'file', 'email', 'month', 'number', 'password', 'radio', 'range', 'search', 'tel', 'text', 'time', 'url', 'week']
const FIELD_ROLES = ['checkbox', 'combobox', 'listbox', 'progressbar', 'option', 'radio', 'searchbox', 'slider', 'spinbutton', 'switch', 'textbox']
/** FORM_ELEMENT_CSS_LIKE_QUERY_RGAA4, optionally with an attribute added to each part. */
const formFields = (attr = ''): string =>
  [...FIELD_TAGS.map((t) => t + attr), `input:not([type])${attr}`, ...FIELD_TYPES.map((t) => `input[type=${t} i]${attr}`), ...FIELD_ROLES.map((r) => `[role=${r} i]${attr}`)].join(', ')
/**
 * Asqatasun looks for the <form> tag only (FORM_ELEMENT). A page with fields outside any <form> (very common in web
 * applications) would then be "not applicable" for every form test, so the fields are looked for as well.
 */
const FORM_OR_FIELD = 'form, input:not(form input):not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([type=image]), select:not(form select), textarea:not(form textarea)'

/** AreaElementSelector(true, false, true): the `area[alt]` of the maps that an image uses (usemap), when the area is not in a link. */
function areaWithAltNotInLink(c: AsqCtx): Element[] {
  const maps = c.query('map[name]:has(area)').filter((m) => nl(m.getAttribute('name')))
  const used = (name: string) => c.query('[usemap]').some((el) => [name, `#${name}`].some((v) => (el.getAttribute('usemap') ?? '').toLowerCase() === v.toLowerCase()))
  return union(...maps.filter((m) => used(m.getAttribute('name') as string)).map((m) => Array.from(m.querySelectorAll('area[alt]')).filter((a) => !a.closest('a'))))
}

/** ElementWithAccessibleNameSelector.isAccessibleNamePresent: does the element offer a name (label, alt, title, text…) to assistive technology? */
function hasAccessibleName(c: AsqCtx, el: Element): boolean {
  const tag = el.tagName.toLowerCase()
  const imageType = (el.getAttribute('type') ?? '').includes('image')
  if (tag === 'svg' && !(el.getAttribute('role') ?? '').includes('img')) return false
  const labelledby = nl(el.getAttribute('aria-labelledby'))
  if (labelledby && labelledby.split(' ').some((id) => id && c.doc.getElementById(id))) return true
  if (el.hasAttribute('aria-label')) return true
  if ((tag === 'img' || tag === 'area' || (tag === 'input' && imageType)) && el.hasAttribute('alt')) return true
  if ((tag === 'img' || ((tag === 'input' || tag === 'object' || tag === 'embed') && imageType)) && el.hasAttribute('title')) return true
  if (tag === 'canvas' && c.ownText(el) !== '') return true
  if (tag === 'svg' && Array.from(el.children).filter((x) => x.tagName.toLowerCase() === 'text').map((x) => c.ownText(x)).join(' ').trim() !== '') return true
  if (tag === 'canvas' || ((tag === 'object' || tag === 'embed') && imageType)) {
    const linkOrButton = (x: Element | null) =>
      Boolean(x && (/^(a|button)$/i.test(x.tagName) || (x.tagName.toLowerCase() === 'input' && (x.getAttribute('type') ?? '').includes('button')) || (x.getAttribute('role') ?? '').includes('button')))
    return linkOrButton(el.previousElementSibling) || linkOrButton(el.nextElementSibling)
  }
  return false
}

const rule = (test: string, whenFound: AsqWhenFound, selector: string, text: string, more: Partial<AsqRule> = {}): AsqRule => ({
  test,
  criterion: test.split('.').slice(0, 2).join('.'),
  selector,
  whenFound,
  text,
  ...more,
})
/** A detection test on elements found with code. */
const detect = (test: string, find: (c: AsqCtx) => Element[], text: string, more: Partial<AsqRule> = {}): AsqRule => ({
  test,
  criterion: test.split('.').slice(0, 2).join('.'),
  find,
  whenFound: 'review',
  whenNone: 'na',
  text,
  ...more,
})

const T_AUDIO = 'RGAA {test}: {n} element(s) that may be audio (audio, bgsound, object, embed, links to audio files): check them against this test. Examples: {samples}'
const T_VIDEO = 'RGAA {test}: {n} element(s) that may be video (video, svg, canvas, object, embed, links to video files, video players): check them against this test. Examples: {samples}'
const T_TIME_BASED = 'RGAA {test}: {n} time-based media found (audio, video, svg, canvas, object, embed, links to media files, video players): check them against this test. Examples: {samples}'
const T_NON_TIME_BASED = 'RGAA {test}: {n} non time-based media found (svg, canvas, object, embed): check them against this test. Examples: {samples}'
const T_MEDIA = 'RGAA {test}: {n} media found of any kind (time-based or not): check them against this test. Examples: {samples}'

export const ASQ_RULES: AsqRule[] = [
  /* ---- 1 Images ---- */
  rule('1.1.4', 'review', 'img[ismap], input[type=image i][ismap]', 'RGAA 1.1.4: {n} server-side image map(s) (ismap): check that every clickable zone has an equivalent usable with any pointing device. Examples: {samples}', { whenNone: 'na' }),
  // CAPTCHA images that have a text alternative: is it relevant? (BASIC_IMG, area, image button, embed; CaptchaElementSelector + ElementWithAccessibleNameSelector)
  rule(
    '1.4.1',
    'review',
    'img:not([usemap]):not(a img), [role=img i]:not(a [role=img]):not(svg):not(area):not(canvas):not(input[type=image i]):not(embed):not(object[type=image i])',
    'RGAA 1.4.1: {n} image(s) used as a CAPTCHA or test image, with a text alternative: check that the alternative is relevant. Examples: {samples}',
    { captcha: true, named: true, whenNone: 'na' },
  ),
  detect('1.4.2', areaWithAltNotInLink, 'RGAA 1.4.2: {n} zone(s) of an image map used as a CAPTCHA or test image, with a text alternative: check that the alternative is relevant. Examples: {samples}', { captcha: true, named: true }),
  rule('1.4.3', 'review', 'input[type=image i]:not(a input)', 'RGAA 1.4.3: {n} image button(s) used as a CAPTCHA or test image, with a text alternative: check that the alternative is relevant. Examples: {samples}', { captcha: true, named: true, whenNone: 'na' }),
  rule('1.4.5', 'review', 'embed[type^=image i]:not(a embed)', 'RGAA 1.4.5: {n} embedded image(s) (embed) used as a CAPTCHA or test image, with a text alternative: check that the alternative is relevant. Examples: {samples}', { captcha: true, named: true, whenNone: 'na' }),
  rule('1.5.2', 'review', 'input[type=image i]', 'RGAA 1.5.2: {n} image button(s) used as a CAPTCHA: check that an alternative way to access the content exists. Examples: {samples}', { captcha: true, whenNone: 'na' }),

  /* ---- 3 Colours ---- */
  detect('3.1.5', timeBasedMedia, 'RGAA 3.1.5: {n} time-based media found: check that no information is given by colour alone. Examples: {samples}'),
  detect('3.1.6', nonTimeBasedMedia, 'RGAA 3.1.6: {n} non time-based media found (svg, canvas, object, embed): check that no information is given by colour alone. Examples: {samples}'),

  /* ---- 4 Multimedia (detection of the media, then a human decides) ---- */
  detect('4.1.1', audioMedia, T_AUDIO),
  detect('4.1.2', videoMedia, T_VIDEO),
  detect('4.1.3', timeBasedMedia, T_TIME_BASED),
  detect('4.2.1', audioMedia, T_AUDIO),
  detect('4.2.2', videoMedia, T_VIDEO),
  detect('4.2.3', timeBasedMedia, T_TIME_BASED),
  detect('4.3.1', timeBasedMedia, T_TIME_BASED),
  detect('4.3.2', timeBasedMedia, T_TIME_BASED),
  detect('4.4.1', timeBasedMedia, T_TIME_BASED),
  detect('4.5.1', videoMedia, T_VIDEO),
  detect('4.5.2', timeBasedMedia, T_TIME_BASED),
  detect('4.6.1', videoMedia, T_VIDEO),
  detect('4.6.2', timeBasedMedia, T_TIME_BASED),
  detect('4.7.1', timeBasedMedia, T_TIME_BASED),
  detect('4.8.1', nonTimeBasedMedia, T_NON_TIME_BASED),
  detect('4.8.2', nonTimeBasedMedia, T_NON_TIME_BASED),
  detect('4.9.1', nonTimeBasedMedia, T_NON_TIME_BASED),
  detect('4.11.1', timeBasedMedia, T_TIME_BASED),
  detect('4.11.2', timeBasedMedia, T_TIME_BASED),
  detect('4.11.3', timeBasedMedia, T_TIME_BASED),
  detect('4.12.1', nonTimeBasedMedia, T_NON_TIME_BASED),
  detect('4.12.2', nonTimeBasedMedia, T_NON_TIME_BASED),
  detect('4.13.1', anyMedia, T_MEDIA),
  detect('4.13.2', anyMedia, T_MEDIA),

  /* ---- 7 Scripts ---- */
  // Asqatasun answers "to check" whether or not the pattern is found, so nothing is reported when it is not.
  rule(
    '7.4.1',
    'review',
    'select[onchange], form:has(select):not(:has(button)):not(:has(input[type=submit i])):not(:has(input[type=button i])):not(:has(input[type=reset i]))',
    'RGAA 7.4.1: {n} script(s) that may change the context (select with onchange, or form with a select and no button): check that the user is warned or has an explicit button. Examples: {samples}',
    { whenNone: 'nmi' },
  ),

  /* ---- 10 Presentation ---- */
  rule('10.9.2', 'review', 'img', 'RGAA 10.9.2: {n} image(s) found: check that no information is given by shape, size or position alone. Examples: {samples}', { whenNone: 'na' }),
  detect('10.9.3', timeBasedMedia, 'RGAA 10.9.3: {n} time-based media found: check that no information is given by shape, size or position alone. Examples: {samples}'),
  detect('10.9.4', nonTimeBasedMedia, 'RGAA 10.9.4: {n} non time-based media found (svg, canvas, object, embed): check that no information is given by shape, size or position alone. Examples: {samples}'),
  rule('10.10.2', 'review', 'img', 'RGAA 10.10.2: {n} image(s) found: check that the way shape, size or position convey information is relevant. Examples: {samples}', { whenNone: 'na' }),
  detect('10.10.3', timeBasedMedia, 'RGAA 10.10.3: {n} time-based media found: check that the way shape, size or position convey information is relevant. Examples: {samples}'),
  detect('10.10.4', nonTimeBasedMedia, 'RGAA 10.10.4: {n} non time-based media found (svg, canvas, object, embed): check that the way shape, size or position convey information is relevant. Examples: {samples}'),

  /* ---- 11 Forms ---- */
  detect('11.2.2', (c) => c.query(formFields('[title]')), 'RGAA 11.2.2: {n} field(s) with a title attribute: check that each one tells the exact purpose of the field. Examples: {samples}'),
  detect('11.2.3', (c) => c.query(formFields('[aria-label]')), 'RGAA 11.2.3: {n} field(s) with an aria-label: check that each one tells the exact purpose of the field. Examples: {samples}'),
  detect('11.2.4', (c) => c.query(formFields('[aria-labelledby]')), 'RGAA 11.2.4: {n} field(s) with an aria-labelledby: check that the text it points to tells the exact purpose of the field. Examples: {samples}'),
  // Asqatasun: LABEL_WITHIN_FORM_CSS_LIKE_QUERY_RGAA4 (a label in a form that has a field). Ours: also a label outside any form, when the page has fields.
  detect(
    '11.2.1',
    (c) => {
      const inForms = c.query(`form:has(${formFields()}) label`)
      return c.query(formFields()).length ? union(inForms, c.query('label:not(form label)')) : inForms
    },
    'RGAA 11.2.1: {n} label(s) in forms: check that each one tells the exact purpose of its field. Examples: {samples}',
  ),
  rule('11.10.5', 'review', FORM_OR_FIELD, 'RGAA 11.10.5: {n} form(s) or field(s): check that the instructions about the expected data type and format are visible and tied to the field. Examples: {samples}', { whenNone: 'na' }),
  rule('11.10.6', 'review', FORM_OR_FIELD, 'RGAA 11.10.6: {n} form(s) or field(s): check that error messages give the expected data type and format and name the field. Examples: {samples}', { whenNone: 'na' }),
  rule('11.10.7', 'review', FORM_OR_FIELD, 'RGAA 11.10.7: {n} form(s) or field(s): check that fields with aria-invalid="true" give the expected data type and format in their label or associated text. Examples: {samples}', { whenNone: 'na' }),
  rule('11.11.1', 'review', FORM_OR_FIELD, 'RGAA 11.11.1: {n} form(s) or field(s): check that, after an input error, the data types and formats are suggested where needed. Examples: {samples}', { whenNone: 'na' }),
  rule('11.11.2', 'review', FORM_OR_FIELD, 'RGAA 11.11.2: {n} form(s) or field(s): check that, after an input error, examples of expected values are suggested where needed. Examples: {samples}', { whenNone: 'na' }),
  rule('11.12.1', 'review', FORM_OR_FIELD, 'RGAA 11.12.1: {n} form(s) or field(s): for forms that change or delete data, check that the user can undo, review or confirm. Examples: {samples}', { whenNone: 'na' }),
  rule('11.12.2', 'review', FORM_OR_FIELD, 'RGAA 11.12.2: {n} form(s) or field(s): for forms that change or delete financial, legal or personal data, check that deleted data can be recovered or that an explicit confirmation is asked. Examples: {samples}', { whenNone: 'na' }),
  rule('11.13.1', 'review', FORM_OR_FIELD, 'RGAA 11.13.1: {n} form(s) or field(s): check that the purpose of each field about the user can be deduced (autocomplete attribute). Examples: {samples}', { whenNone: 'na' }),

  /* ---- 13 Consultation ---- */
  rule('13.1.1', 'review', 'svg, canvas, object, embed, meta[http-equiv=refresh i][content]:not([content*=url i])', 'RGAA 13.1.1: {n} element(s) that may refresh the page (svg, canvas, object, embed, meta refresh): check that the user controls the time limit. Examples: {samples}', { whenNone: 'na' }),
  rule('13.7.1', 'review', 'img, svg, canvas, object, embed', 'RGAA 13.7.1: {n} image(s) or media element(s) found: check that none flashes or changes brightness abruptly. Examples: {samples}', { whenNone: 'na' }),
]

/* ------------------------------------------------------------------ */
/* Tests with logic of their own                                       */
/* ------------------------------------------------------------------ */

const hasLetter = (s: string): boolean => /\p{L}/u.test(s)
/** Asqatasun's "attribute-absent" marker: the text builders answer it when an element has no usable text. */
const ABSENT = 'attribute-absent'

const check = (test: string, run: (c: AsqCtx) => AsqCheckResult): AsqCheck => ({ test, run })

/** DoctypeHtml5Checker / DoctypePresenceChecker read the doctype as text; this is the text of the DOM's doctype. */
function doctypeText(dt: DocumentType | null): string {
  if (!dt) return ''
  const pub = dt.publicId
  const sys = dt.systemId
  return `<!DOCTYPE ${dt.name}${pub ? ` PUBLIC "${pub}"` : sys ? ' SYSTEM' : ''}${sys ? ` "${sys}"` : ''}>`
}

/** Asqatasun's TextBelongsToBlackListChecker: the whole text is one of the listed words, with non-letters around it. */
function blacklistRegexes(list: string[]): RegExp[] {
  const out: RegExp[] = []
  for (const word of list) {
    try {
      out.push(new RegExp(`^[^\\p{L}]*(?:${word})[^\\p{L}]*$`, 'iu'))
    } catch {
      // an entry that is not a valid regular expression in this engine: skip it
    }
  }
  return out
}
const UNEXPLICIT_TITLE_RE = blacklistRegexes(UNEXPLICIT_PAGE_TITLES)
const LINK_BLACKLIST_RE = blacklistRegexes(LINK_TEXT_BLACKLIST)

const isScriptLike = (el: Element): boolean => /^(script|style)$/i.test(el.tagName)

/** DeepTextElementBuilder (with the alt attribute) and DeepTextWithoutAltElementBuilder. */
function deepText(el: Element, withAlt: boolean): string {
  if (isScriptLike(el)) return ''
  let out = ''
  if (withAlt && el.hasAttribute('alt')) out += ` ${nl(el.getAttribute('alt'))}`
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === 3) {
      const text = (child.textContent ?? '').replace(/\s+/g, ' ').trim()
      if (text) out += ` ${text}`
    } else if (child.nodeType === 1) out += ` ${deepText(child as Element, withAlt)}`
  }
  if (!withAlt && !out.trim() && nl(el.getAttribute('title'))) return el.getAttribute('title') as string
  return withAlt ? out.trim() : out
}

/** AccessibleNameElementBuilder: aria-labelledby, aria-label, then what the kind of element offers (a much simpler model than the W3C one). */
function accessibleName(c: AsqCtx, el: Element): string {
  const labelledby = nl(el.getAttribute('aria-labelledby'))
  if (labelledby) {
    let text = ''
    for (const id of labelledby.split(' ')) {
      const target = id ? c.doc.getElementById(id) : null
      if (target) text += deepText(target, true)
    }
    if (text.trim()) return text
  }
  if (nl(el.getAttribute('aria-label'))) return el.getAttribute('aria-label') as string
  const tag = el.tagName.toLowerCase()
  const imageType = el.getAttribute('type') === 'image'
  let text = ''
  if (tag === 'a' || tag === 'svg' || tag === 'canvas') text = deepText(el, false)
  else if (tag === 'img' || (tag === 'input' && imageType)) text = nl(el.hasAttribute('alt') ? el.getAttribute('alt') : el.hasAttribute('title') ? el.getAttribute('title') : '')
  else if (tag === 'area') text = nl(el.getAttribute('alt'))
  else if ((tag === 'object' || tag === 'embed') && imageType) text = nl(el.getAttribute('title'))
  else if (el.getAttribute('role') === 'link') text = deepText(el, false)
  return text.trim() ? text : ABSENT
}

/* ---- 2 Frames ---- */

const frameTitle = check('2.1.1', (c) => {
  const frames = c.query('iframe, frame')
  if (!frames.length) return { outcome: 'na' }
  const missing = frames.filter((f) => !f.hasAttribute('title'))
  if (!missing.length) return { outcome: 'passed' }
  return { outcome: 'failed', notes: [{ key: '2.1.1', status: 'nc', text: 'RGAA 2.1.1: {n} frame(s) without a title attribute. Examples: {samples}', els: missing }] }
})

// AttributePertinenceChecker: empty title, title without any letter, title found in the address of the frame -> failed.
const frameTitleRelevance = check('2.2.1', (c) => {
  const frames = c.query('iframe[title], frame[title]')
  if (!frames.length) return { outcome: 'na' }
  const bad = frames.filter((f) => {
    const title = nl(f.getAttribute('title'))
    if (!title || !hasLetter(title)) return true
    const src = f.getAttribute('src')
    return src !== null && src.includes(title)
  })
  const rest = frames.filter((f) => !bad.includes(f))
  const notes: AsqNote[] = []
  if (bad.length) notes.push({ key: '2.2.1-fail', status: 'nc', text: 'RGAA 2.2.1: {n} frame(s) whose title is empty, has no letter, or is found in its address. Examples: {samples}', els: bad })
  if (rest.length) notes.push({ key: '2.2.1', status: 'review', text: 'RGAA 2.2.1: {n} frame(s) with a title: check that each title is relevant. Examples: {samples}', els: rest })
  return { outcome: bad.length ? 'failed' : 'nmi', notes }
})

/* ---- 8 Mandatory elements ---- */

const doctypePresence = check('8.1.1', (c) =>
  c.doctype
    ? { outcome: 'passed' }
    : { outcome: 'failed', notes: [{ key: '8.1.1', status: 'nc', text: 'RGAA 8.1.1: the page has no document type declaration (doctype).', count: 1 }] },
)

const doctypeValidity = check('8.1.2', (c) => {
  if (!c.doctype) return { outcome: 'na' }
  const known = RECOMMENDED_DOCTYPES.some((d) => d.toLowerCase() === c.doctype.toLowerCase())
  if (known) return { outcome: 'passed' }
  return { outcome: 'failed', notes: [{ key: '8.1.2', status: 'nc', text: 'RGAA 8.1.2: the document type declaration is not one of the valid ones: {detail}', count: 1, detail: c.doctype }] }
})

const langAttrs = (el: Element): boolean => el.hasAttribute('lang') || el.hasAttribute('xml:lang')
/** The elements with a lang or xml:lang attribute (no attribute selector for "xml:lang": its colon is read as a namespace by some engines). */
const withLang = (c: AsqCtx, within = ''): Element[] => c.query(`${within}*`).filter(langAttrs)
const hasLangAncestor = (el: Element): boolean => {
  for (let p = el.parentElement; p; p = p.parentElement) if (langAttrs(p)) return true
  return false
}

const defaultLanguage = check('8.3.1', (c) => {
  if (withLang(c).some((el) => el === c.doc.documentElement)) return { outcome: 'passed' }
  const inside = withLang(c, 'html ')
  if (!inside.length) return { outcome: 'failed', notes: [{ key: '8.3.1', status: 'nc', text: 'RGAA 8.3.1: the default language of the page is not declared (no lang attribute on <html>, nor on any element).', count: 1 }] }
  // text elements (own text, alt or title) that have no lang and no parent with a lang
  const text = (a: string) => nl(a).length > 0
  const candidates = c
    .query('html *')
    .filter((el) => !langAttrs(el) && (c.ownText(el) !== '' || text(el.getAttribute('alt') ?? '') || text(el.getAttribute('title') ?? '')))
    .filter((el) => !hasLangAncestor(el))
  if (!candidates.length) return { outcome: 'passed' }
  return { outcome: 'failed', notes: [{ key: '8.3.1-parts', status: 'nc', text: 'RGAA 8.3.1: no lang attribute on <html>, and {n} text element(s) have none either, nor a parent that has one. Examples: {samples}', els: candidates }] }
})

// LangDeclarationValidityChecker(true, true): the validity half. Whether the language of the text is the declared one needs a
// language detector (Asqatasun embeds one); a valid declaration is therefore "to check", not "passed".
const languageCodeValidity = check('8.4.1', (c) => {
  const html = withLang(c).filter((el) => el === c.doc.documentElement)
  if (!html.length) return { outcome: 'na' }
  const notes: AsqNote[] = []
  let outcome: AsqOutcome = 'nmi'
  for (const el of html) {
    const lang = nl(el.getAttribute('lang'))
    const xml = nl(el.getAttribute('xml:lang'))
    // extractLangDefinitionFromElement: lang, unless only xml:lang is given, or both differ on an XHTML page
    let definition = lang
    if (!lang && xml) definition = xml
    else if (lang && xml && lang.toLowerCase() !== xml.toLowerCase() && XHTML_DOCTYPES.some((d) => d.toLowerCase() === c.doctype.toLowerCase())) definition = xml
    const effective = definition.includes('-') ? definition.slice(0, definition.indexOf('-')) : definition
    if (!/^\w{2,3}(-\w{2,})?$/.test(definition)) {
      outcome = 'failed'
      notes.push({ key: '8.4.1', status: 'nc', text: 'RGAA 8.4.1: the language code of the page is malformed: {detail}', count: 1, detail: definition })
    } else if (!VALID_LANGUAGE_CODES.includes(effective.toLowerCase())) {
      outcome = 'failed'
      notes.push({ key: '8.4.1', status: 'nc', text: 'RGAA 8.4.1: the language code of the page is not a known language: {detail}', count: 1, detail: definition })
    }
  }
  if (outcome === 'nmi') notes.push({ key: '8.4.1-relevance', status: 'review', text: 'RGAA 8.4.1: the language code is valid ({detail}): check that it is the language of the page.', count: 1, detail: nl(html[0].getAttribute('lang') ?? html[0].getAttribute('xml:lang')) })
  return { outcome, notes }
})

// ElementPresenceChecker with unicity: exactly one <title> in the <head>.
const pageTitlePresence = check('8.5.1', (c) => {
  const titles = c.query('head title')
  if (titles.length === 1) return { outcome: 'passed' }
  return {
    outcome: 'failed',
    notes: [
      titles.length
        ? { key: '8.5.1', status: 'nc', text: 'RGAA 8.5.1: {n} <title> elements in the <head>, there should be only one. Examples: {samples}', els: titles }
        : { key: '8.5.1', status: 'nc', text: 'RGAA 8.5.1: the page has no <title> element in its <head>.', count: 1 },
    ],
  }
})

// TextPertinenceChecker: empty title, listed as unexplicit (UnexplicitPageTitle), or with no letter -> failed; otherwise a human decides.
const pageTitleRelevance = check('8.6.1', (c) => {
  const titles = c.query('head title')
  if (!titles.length) return { outcome: 'na' }
  const bad = titles.filter((t) => {
    const text = nl(t.textContent).replace(/\s+/g, ' ')
    return !text || !hasLetter(text) || UNEXPLICIT_TITLE_RE.some((re) => re.test(text))
  })
  const rest = titles.filter((t) => !bad.includes(t))
  const notes: AsqNote[] = []
  if (bad.length) notes.push({ key: '8.6.1-fail', status: 'nc', text: 'RGAA 8.6.1: the page title is empty, has no letter, or is a generic one (for example "home", "untitled"). Examples: {samples}', els: bad })
  if (rest.length) notes.push({ key: '8.6.1', status: 'review', text: 'RGAA 8.6.1: check that the page title ({detail}) is relevant.', count: rest.length, detail: nl(rest[0].textContent).slice(0, 80) })
  return { outcome: bad.length ? 'failed' : 'nmi', notes }
})

// Three lists; found anything -> failed; found nothing -> "to check" (the pattern may simply be absent from the HTML), never passed.
const layoutMarkup = check('8.9.1', (c) => {
  const noTarget = c.query('a:not([href]):not([name]):not([id]):not([role=button i])')
  const empty = c.query('p:not([hidden]):not(:has(*)), li:not([hidden]):not(:has(*))').filter((el) => c.ownText(el) === '')
  const br = c.query('br').filter((el) => {
    let next = el.nextSibling
    while (next && (next.nodeType === 8 || (next.nodeType === 3 && !(next.textContent ?? '').trim()))) next = next.nextSibling
    return next?.nodeType === 1 && (next as Element).tagName === el.tagName
  })
  if (!noTarget.length && !empty.length && !br.length) return { outcome: 'nmi' }
  const notes: AsqNote[] = []
  if (noTarget.length) notes.push({ key: '8.9.1', status: 'nc', text: 'RGAA 8.9.1: {n} link(s) without destination (no href, name or id), probably used for presentation. Examples: {samples}', els: noTarget })
  if (empty.length) notes.push({ key: '8.9.1-empty', status: 'nc', text: 'RGAA 8.9.1: {n} empty <p> or <li> element(s), probably used for layout. Examples: {samples}', els: empty })
  if (br.length) notes.push({ key: '8.9.1-br', status: 'nc', text: 'RGAA 8.9.1: {n} <br> element(s) in a row, probably used to space content. Examples: {samples}', els: br })
  return { outcome: 'failed', notes }
})

const readingDirection = check('8.10.2', (c) => {
  const bad = c.query('[dir]:not([dir=ltr i]):not([dir=rtl i])')
  const good = c.query('[dir=ltr i], [dir=rtl i]')
  if (!bad.length && !good.length) return { outcome: 'na' }
  const notes: AsqNote[] = []
  if (bad.length) notes.push({ key: '8.10.2-invalid', status: 'nc', text: 'RGAA 8.10.2: {n} element(s) with a dir attribute that is neither ltr nor rtl. Examples: {samples}', els: bad })
  if (good.length) notes.push({ key: '8.10.2', status: 'review', text: 'RGAA 8.10.2: {n} element(s) with a dir attribute (ltr or rtl): check that each change of reading direction is relevant. Examples: {samples}', els: good })
  return { outcome: bad.length ? 'failed' : 'nmi', notes }
})

/* ---- 9 Structure ---- */

// TextPertinenceChecker on the text of the heading (alt text of images included): empty or without a letter -> failed.
const headingRelevance = check('9.1.2', (c) => {
  const headings = c.query('h1, h2, h3, h4, h5, h6, [role=heading i][aria-level]').filter((h) => !h.hasAttribute('aria-level') || /^[1-9][0-9]?$/.test(h.getAttribute('aria-level') ?? ''))
  if (!headings.length) return { outcome: 'na' }
  const bad = headings.filter((h) => {
    const text = deepText(h, true)
    return !text || text === ABSENT || !hasLetter(text)
  })
  const rest = headings.filter((h) => !bad.includes(h))
  const notes: AsqNote[] = []
  if (bad.length) notes.push({ key: '9.1.2-fail', status: 'nc', text: 'RGAA 9.1.2: {n} heading(s) that are empty or have no letter. Examples: {samples}', els: bad })
  if (rest.length) notes.push({ key: '9.1.2', status: 'review', text: 'RGAA 9.1.2: {n} heading(s): check that each one is relevant. Examples: {samples}', els: rest })
  return { outcome: bad.length ? 'failed' : 'nmi', notes }
})

// HTML5 pages only (no doctype counts as HTML5): one visible <main>, a <header> and a <footer> outside article/section, a <nav>.
// When all are there, a human still has to check the structure: never "passed".
const htmlStructure = check('9.2.1', (c) => {
  if (!c.html5) return { outcome: 'na' }
  const main = c.query('main:not([hidden])')
  const header = c.query(':not(article):not(section) > header')
  const footer = c.query(':not(article):not(section) > footer')
  const nav = c.query('nav')
  const notes: AsqNote[] = []
  if (main.length === 0) notes.push({ key: '9.2.1-main', status: 'nc', text: 'RGAA 9.2.1: the page has no visible <main> element.', count: 1 })
  else if (main.length > 1) notes.push({ key: '9.2.1-main-unique', status: 'nc', text: 'RGAA 9.2.1: {n} visible <main> elements, there should be only one. Examples: {samples}', els: main })
  if (!header.length) notes.push({ key: '9.2.1-header', status: 'nc', text: 'RGAA 9.2.1: the page has no <header> element outside <article> and <section>.', count: 1 })
  if (!footer.length) notes.push({ key: '9.2.1-footer', status: 'nc', text: 'RGAA 9.2.1: the page has no <footer> element outside <article> and <section>.', count: 1 })
  if (!nav.length) notes.push({ key: '9.2.1-nav', status: 'nc', text: 'RGAA 9.2.1: the page has no <nav> element.', count: 1 })
  if (notes.length) return { outcome: 'failed', notes }
  return { outcome: 'nmi', notes: [{ key: '9.2.1', status: 'review', text: 'RGAA 9.2.1: the main, header, footer and nav elements are there: check that the structure of the document is relevant.', count: 1 }] }
})

/* ---- 10 Presentation ---- */

const presentationTags = check('10.1.1', (c) => {
  const els = c.query(DEPRECATED_TAGS.join(', '))
  if (!els.length) return { outcome: 'passed' }
  const names = [...new Set(els.map((e) => e.tagName.toLowerCase()))].join(', ')
  return { outcome: 'failed', notes: [{ key: '10.1.1', status: 'nc', text: 'RGAA 10.1.1: {n} tag(s) used for presentation only: {detail}. Examples: {samples}', els, detail: names }] }
})

// Attributes of DeprecatedRepresentationAttributesV3 on any element that is not an <svg> or inside one, plus width and height
// on elements other than img, svg, object, embed and canvas.
const presentationAttributes = check('10.1.2', (c) => {
  const found = new Map<string, Element[]>()
  for (const attr of DEPRECATED_ATTRIBUTES) {
    const els = c.query(`:not(svg)[${attr}]:not(svg [${attr}])`)
    if (els.length) found.set(attr, els)
  }
  for (const attr of ['width', 'height']) {
    const els = c.query(`:not(img):not(svg):not(object):not(embed):not(canvas)[${attr}]:not(svg [${attr}])`)
    if (els.length) found.set(attr, els)
  }
  if (!found.size) return { outcome: 'passed' }
  const all = union(...found.values())
  return { outcome: 'failed', notes: [{ key: '10.1.2', status: 'nc', text: 'RGAA 10.1.2: {n} element(s) with attributes used for presentation ({detail}). Examples: {samples}', els: all, detail: [...found.keys()].join(', ') }] }
})

/* ---- 13 Consultation ---- */

// META_WITH_REFRESH_CSS_LIKE_QUERY: a refresh with an address. "N;url=…" with N > 0 is not an immediate redirection.
const metaRedirection = check('13.1.2', (c) => {
  const metas = c.query('meta[http-equiv=refresh i][content*=url i]')
  if (!metas.length) return { outcome: 'na' }
  const late = metas.filter((m) => {
    const parts = (m.getAttribute('content') ?? '').split(';')
    return parts.length === 2 && parseInt(parts[0].trim(), 10) > 0 && parts[1].trim().toLowerCase().startsWith('url')
  })
  if (!late.length) return { outcome: 'passed' }
  return { outcome: 'failed', notes: [{ key: '13.1.2', status: 'nc', text: 'RGAA 13.1.2: {n} <meta> redirection(s) that are not immediate. Examples: {samples}', els: late }] }
})

// AbstractDownloadableLinkRuleImplementation + TextEndsWithChecker(OfficeDocumentExtensions): for the links whose address has a
// file name with an extension, the extension is looked up; the others are "to check". Never "passed" or "failed".
function downloadableLinks(test: string, text: string): AsqCheck {
  return check(test, (c) => {
    let links = c.query('a[href]')
    const withExtension: Element[] = []
    const base = c.doc.baseURI && /^https?:|^file:/.test(c.doc.baseURI) ? c.doc.baseURI : 'http://localhost/'
    links = links.filter((a) => {
      let url: URL
      try {
        url = new URL(a.getAttribute('href') ?? '', base)
      } catch {
        return true // unreadable address: stays among the links to check
      }
      const path = url.pathname
      if (url.search.length > 1 || !path || path === '/') return true
      if (!path.slice(path.lastIndexOf('/')).includes('.')) return true
      if (url.hash.length > 1) return false // a link to a part of a page is not a download
      withExtension.push(a)
      return true
    })
    const office = withExtension.filter((a) => OFFICE_DOCUMENT_EXTENSIONS.some((e) => (a.getAttribute('href') ?? '').toLowerCase().endsWith(e)))
    if (office.length) {
      const names = [...new Set(office.map((a) => /(\.\w+)$/.exec(a.getAttribute('href') ?? '')?.[1]?.toLowerCase() ?? ''))].join(', ')
      return { outcome: 'nmi', notes: [{ key: test, status: 'review', text, els: office, detail: names }] }
    }
    if (links.length > withExtension.length) return { outcome: 'nmi', notes: [{ key: `${test}-noext`, status: 'review', text: 'RGAA {test}: {n} link(s) whose address has no recognised file name: check that none gives access to an office document. Examples: {samples}', els: links.filter((a) => !withExtension.includes(a)) }] }
    if (!links.length) return { outcome: 'na' }
    // every link has a file extension and none is an office document: a form may still offer a download
    return c.query('form').length ? { outcome: 'nmi', notes: [{ key: `${test}-form`, status: 'review', text: 'RGAA {test}: the page has a form: check that it does not give access to an office document.', count: 1 }] } : { outcome: 'na' }
  })
}

/* ---- 6 Links ---- */

const LINK_CONTEXT_PARENTS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'td'])
const HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])

/** LinkElementSelector.doesLinkHaveContext: the link can be understood from its surroundings (so it cannot be failed on its text alone). */
function linkHasContext(c: AsqCtx, a: Element, linkText: string): boolean {
  const title = a.getAttribute('title')
  if (title !== null && title.toLowerCase() !== linkText.toLowerCase()) return true
  // (considerTitleAsContext is true for these rules; the aria attributes only count when asked to, which they are not)
  if (a.parentElement && c.ownText(a.parentElement) !== '') return true
  const precededByHeading = (el: Element): boolean => {
    for (let prev = el.previousElementSibling; prev; prev = prev.previousElementSibling) if (HEADING_TAGS.has(prev.tagName.toLowerCase()) || prev.querySelector('h1, h2, h3, h4, h5, h6')) return true
    return false
  }
  if (precededByHeading(a)) return true
  for (let p = a.parentElement; p; p = p.parentElement) if (LINK_CONTEXT_PARENTS.has(p.tagName.toLowerCase()) || precededByHeading(p)) return true
  return false
}

const isImageLinkChild = (el: Element): boolean =>
  el.matches('img[alt], object[type^=image], object[data^="data:image"], object[data$=png], object[data$=jpeg], object[data$=jpg], object[data$=bmp], object[data$=gif], canvas')
function onlyChild(c: AsqCtx, a: Element, test: (child: Element) => boolean): boolean {
  return a.children.length === 1 && c.ownText(a) === '' && test(a.children[0])
}

// LinkPertinenceRgaa4Checker on links: a text that is only punctuation or one of the listed words ("click here"…) fails, unless
// the surroundings give a context (then a human decides). `kind` is the scope of the test.
function linkTexts(test: string, kind: 'text' | 'image' | 'svg'): AsqCheck {
  return check(test, (c) => {
    const pool = kind === 'text' ? c.query('[role=link i]:not(:has(img)):not(:has(svg)):not(:has(object)):not(:has(canvas)), a[href]:not(:has(img)):not(:has(svg)):not(:has(object)):not(:has(canvas))') : c.query('a[href]:has(*)')
    const inScope = pool.filter((a) => {
      const name = accessibleName(c, a)
      if (!name.trim() || name === ABSENT) return false
      if (kind === 'image') return onlyChild(c, a, isImageLinkChild)
      if (kind === 'svg') return onlyChild(c, a, (child) => child.tagName.toLowerCase() === 'svg')
      return true
    })
    if (!inScope.length) return { outcome: 'na' }
    const bad: Element[] = []
    const rest: Element[] = []
    for (const a of inScope) {
      const name = accessibleName(c, a)
      const failing = !hasLetter(name) || LINK_BLACKLIST_RE.some((re) => re.test(name))
      if (failing && !linkHasContext(c, a, name)) bad.push(a)
      else rest.push(a)
    }
    const notes: AsqNote[] = []
    if (bad.length) notes.push({ key: `${test}-fail`, status: 'nc', text: 'RGAA {test}: {n} link(s) whose text is not explicit by itself (only punctuation, or "click here", "more"…) and that have no context. Examples: {samples}', els: bad })
    if (rest.length) notes.push({ key: test, status: 'review', text: 'RGAA {test}: {n} link(s): check that the link text, alone or with its context, tells where the link goes. Examples: {samples}', els: rest })
    return { outcome: bad.length ? 'failed' : 'nmi', notes }
  })
}

export const ASQ_CHECKS: AsqCheck[] = [
  frameTitle,
  frameTitleRelevance,
  linkTexts('6.1.1', 'text'),
  linkTexts('6.1.2', 'image'),
  linkTexts('6.1.4', 'svg'),
  doctypePresence,
  doctypeValidity,
  defaultLanguage,
  languageCodeValidity,
  pageTitlePresence,
  pageTitleRelevance,
  layoutMarkup,
  readingDirection,
  headingRelevance,
  htmlStructure,
  presentationTags,
  presentationAttributes,
  metaRedirection,
  downloadableLinks('13.3.1', 'RGAA 13.3.1: {n} link(s) to office documents ({detail}): check that each one is accessible or has an accessible version. Examples: {samples}'),
  downloadableLinks('13.4.1', 'RGAA 13.4.1: {n} link(s) to office documents ({detail}): check that each one is accessible, or has an accessible version, in a format that can be consulted. Examples: {samples}'),
]

/* ------------------------------------------------------------------ */
/* Evaluation: the same code runs in the page and in jsdom (scripts/check-asqatasun.mjs) */
/* ------------------------------------------------------------------ */

const TEXT_NODE = 3
const ORDER: AsqOutcome[] = ['failed', 'nmi', 'passed', 'na']
/** Asqatasun's order when several checkers answer for one test: failed, then need more info, then passed, then not applicable. */
const worst = (a: AsqOutcome | undefined, b: AsqOutcome): AsqOutcome => (a === undefined || ORDER.indexOf(b) < ORDER.indexOf(a) ? b : a)

const cssEscape = (v: string): string => v.replace(/[^a-zA-Z0-9_ -￿-]/g, (c) => `\\${c}`)
export function asqShortSelector(el: Element): string {
  const id = el.id ? `#${cssEscape(el.id)}` : ''
  const cls = !id && typeof el.className === 'string' && el.className.trim() ? `.${cssEscape(el.className.trim().split(/\s+/)[0])}` : ''
  return `${el.tagName.toLowerCase()}${id}${cls}`
}

/** Criterion of a test id: '8.5.1' -> '8.5'. */
const criterionOf = (test: string): string => test.split('.').slice(0, 2).join('.')

/** The tests that are ported, by criterion (for "every ported test of the criterion passed"). */
function portedByCriterion(): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>()
  const add = (test: string) => out.set(criterionOf(test), (out.get(criterionOf(test)) ?? new Set()).add(test))
  ASQ_RULES.forEach((r) => add(r.test))
  ASQ_CHECKS.forEach((k) => add(k.test))
  return out
}

/**
 * Runs every ported test on `doc`. `skip` drops elements that are not the page's (for example our own overlay);
 * `onError` hears about a test that could not run (a selector the engine does not understand…): by default it says nothing.
 */
export function evaluateAsqRules(doc: Document, skip?: (el: Element) => boolean, onError?: (test: string, error: unknown) => void): AsqEvaluation {
  const query = (selector: string): Element[] => {
    const all = Array.from(doc.querySelectorAll(selector))
    return skip ? all.filter((el) => !skip(el)) : all
  }
  const ownText = (el: Element): string =>
    isScriptLike(el)
      ? ''
      : Array.from(el.childNodes)
          .filter((n) => n.nodeType === TEXT_NODE)
          .map((n) => n.textContent ?? '')
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim()
  const doctype = doctypeText(doc.doctype)
  const html5 = !doctype || doctype.toLowerCase() === '<!doctype html>'
  const c: AsqCtx = { doc, doctype, html5, query, ownText }

  const mentionsCaptcha = (el: Element): boolean =>
    el !== doc.documentElement && el !== doc.body && (/captcha/i.test(ownText(el)) || Array.from(el.attributes).some((a) => /captcha/i.test(a.value)))
  let pageMentionsCaptcha: boolean | undefined
  const ancestorsMention = (el: Element, test: (x: Element) => boolean): boolean => {
    for (let a = el.parentElement; a; a = a.parentElement) if (test(a)) return true
    return false
  }

  const select = (r: AsqRule): Element[] => {
    let els = r.find ? r.find(c) : query(r.selector as string)
    if (r.captcha && els.length) {
      pageMentionsCaptcha ??= /captcha/i.test(doc.documentElement.outerHTML)
      els = pageMentionsCaptcha
        ? els.filter((el) => {
            // a sibling or an ancestor counts when it is another kind of element (or a div)
            const other = (x: Element) => (x.tagName !== el.tagName || el.tagName === 'DIV') && mentionsCaptcha(x)
            return mentionsCaptcha(el) || Array.from(el.parentElement?.children ?? []).some((s) => s !== el && other(s)) || ancestorsMention(el, other)
          })
        : []
    }
    if (r.named) els = els.filter((el) => hasAccessibleName(c, el))
    return els
  }

  const findings: AsqFinding[] = []
  const tests: Record<string, AsqOutcome> = {}
  const record = (test: string, outcome: AsqOutcome) => {
    tests[test] = worst(tests[test], outcome)
  }
  const addFinding = (test: string, key: string, status: 'nc' | 'review', text: string, count: number, els?: Element[], detail?: string) =>
    findings.push({ key: `asq:${key}`, count, samples: els?.slice(0, 3).map(asqShortSelector), ...(detail ? { detail } : {}), asq: { criterion: criterionOf(test), test, status, text } })

  for (const r of ASQ_RULES) {
    try {
      const els = select(r)
      if (els.length) {
        record(r.test, r.whenFound === 'nc' ? 'failed' : 'nmi')
        addFinding(r.test, r.key ?? r.test, r.whenFound, r.text, els.length, els)
      } else if (r.whenNone === 'na') record(r.test, 'na')
      else if (r.whenNone === 'pass') record(r.test, 'passed')
      else if (r.whenNone === 'nmi') record(r.test, 'nmi')
    } catch (error) {
      onError?.(r.key ?? r.test, error) // a selector this browser does not understand: say nothing
    }
  }
  for (const k of ASQ_CHECKS) {
    try {
      const result = k.run(c)
      record(k.test, result.outcome)
      for (const note of result.notes ?? []) addFinding(k.test, note.key, note.status, note.text, note.count ?? note.els?.length ?? 0, note.els, note.detail)
    } catch (error) {
      onError?.(k.test, error)
    }
  }

  // a criterion is "not applicable" when every one of its tests is
  for (const [criterion, list] of Object.entries(ASQ_CRITERION_TESTS)) {
    if (list.every((t) => tests[t] === 'na')) findings.push({ key: `asq:na:${criterion}`, count: 0, asq: { criterion, test: list[0], status: 'na', text: ASQ_NA_TEXT } })
  }
  // a criterion "passes" when every test ported for it passed (not when only some did)
  for (const [criterion, ported] of portedByCriterion()) {
    if ([...ported].every((t) => tests[t] === 'passed')) {
      findings.push({ key: `asq:pass:${criterion}`, count: 0, ...(criterion === '8.1' && doctype ? { detail: doctype } : {}), asq: { criterion, test: [...ported][0], status: 'pass', text: '' } })
    }
  }
  return { findings, tests }
}

/* ------------------------------------------------------------------ */
/* NOT PORTED — implemented in Asqatasun (RGAA 4.0) but not as code that can run on a page */
/* ------------------------------------------------------------------ */
/*
 * Asqatasun implements 99 tests of RGAA 4 (the others are "NotTested" there); 73 are ported above, 26 are not. With the reason:
 *
 * Images, informative or decorative: 1.1.1 1.1.2 1.1.3 1.1.5 1.1.6 1.1.7 1.1.8, 1.2.1 1.2.2 1.2.3 1.2.4 1.2.5 1.2.6,
 * 1.3.1 1.3.2 1.3.4 1.3.6 1.3.7 1.3.8 (19 tests). Asqatasun splits the images into "informative" and "decorative" with
 * markers (classes, ids or roles) that the user of Asqatasun types in the audit settings, and fails or passes only the
 * marked images. This extension has no such setting: without markers every image ends as "check the nature of the image",
 * which is what the image-by-image review of theme 1 and axe already do, so a port would only repeat their notes. Their
 * fixtures also need the marker settings of the Java tests.
 *
 * Contrast: 3.2.1 3.2.2 3.2.3 3.2.4. Asqatasun reads the computed colours, font sizes and backgrounds from a browser; the
 * extension has its own contrast checker and axe's color-contrast rule, which see the real rendering.
 *
 * Tables: 5.1.1 5.3.1. Same markers (complex table, data table, presentation table): without them every table is "check
 * the nature of the table". Our own check lists the data tables that have no header cells.
 *
 * CSS: 10.4.1 (absolute units in the style sheets of the media screen, all…). It parses the CSS files of the page; from a
 * page, document.styleSheets cannot be read for style sheets of another origin (the common case), and the fixtures need
 * the CSS files next to the pages. Not reproducible faithfully here.
 *
 * Partly ported, with the part that cannot be reproduced:
 *   8.4.1  the validity of the language code is tested (format and ISO list); whether the text really is in that language
 *          needs the language detector that Asqatasun embeds, so a valid code is "to check", not "passed".
 *   8.1.2  Asqatasun compares the doctype as written in the source (the case of "PUBLIC" counts for XHTML); the DOM only
 *          keeps the name and the identifiers, so the case cannot be checked.
 *
 * Differences with Asqatasun, on purpose (the fixtures still agree):
 *   - form tests (11.10.5… 11.13.1) also apply to fields outside any <form>, and 11.2.1 to labels outside any <form>
 *     (Asqatasun looks for <form> only, so a web application without <form> would be "not applicable");
 *   - the media tests also see the YouTube, Vimeo and Dailymotion players in an iframe, and look for the extension of a
 *     media file at the end of the link address (Asqatasun looks for it anywhere: ".au" in "example.au/page");
 *   - 13.1.2 accepts blanks around "url" in "5; url=…".
 */
