/**
 * RGAA tests detected by the page script, adapted from Asqatasun.
 *
 * Derived from Asqatasun (https://github.com/Asqatasun/Asqatasun, formerly Tanaguru), licensed under the
 * GNU Affero General Public License v3 (AGPL-3.0): the rules of rules/rules-rgaa4.0 and the selectors of
 * rules/rules-commons (CssLikeQueryStore) were converted from Jsoup selectors to standard CSS selectors that
 * `document.querySelectorAll` understands. Copyright (C) 2008-2020 Asqatasun.org and contributors.
 * See NOTICE.md at the root of the project.
 *
 * REMOVE THIS FILE + the blocks marked `Asqatasun-derived` (inject.ts, panel.ts, i18n-fr-lib.ts) to drop the
 * dependency: the exact steps are in NOTICE.md.
 *
 * How a rule is read (same meaning as the Asqatasun solutions):
 *   - `selector` finds the elements; `exclude`, `ownText`, `attrRe`, `followedBySameTag`, `captcha`, `minCount`
 *     narrow them down (what Jsoup did with :matchesOwn, :not(), regular-expression attributes…).
 *   - something found: `nc` = FAILED (the criterion fails, to confirm), `review` = NEED_MORE_INFO (a note asking for
 *     a manual check, no verdict).
 *   - nothing found: `na` = NOT_APPLICABLE (the criterion is marked not applicable when every test ported for it is),
 *     `pass` = PASSED (nothing is recorded: a pass never marks a criterion compliant), missing = nothing to say.
 *   - `scope` (default: `selector`) is what makes the test applicable: with `na`, nothing found but `scope` found is
 *     a pass, not a "not applicable".
 */

export type AsqWhenFound = 'nc' | 'review'
export type AsqWhenNone = 'na' | 'pass'

export interface AsqRule {
  /** RGAA test id, e.g. '8.5.1'. */
  test: string
  /** RGAA criterion, e.g. '8.5'. */
  criterion: string
  /** When several rules belong to the same test: a distinct key (default: the test id). */
  key?: string
  /** Standard CSS selector. */
  selector: string
  /** What makes the test applicable (default: `selector`). */
  scope?: string
  /** Keep only the elements whose own text (text nodes that are direct children, trimmed) matches this regular expression. */
  ownText?: string
  /** Drop the elements matching this selector. */
  exclude?: string
  /** Keep only the elements whose attribute `[0]` matches the case-insensitive regular expression `[1]`. */
  attrRe?: [string, string]
  /** Keep only the elements directly followed (ignoring blanks) by an element with the same tag name. */
  followedBySameTag?: boolean
  /** Keep only the elements that mention "captcha" in their own attributes or text, or in those of a sibling or an ancestor. */
  captcha?: boolean
  /** Report only when at least this many elements are found. */
  minCount?: number
  /** Only for pages in HTML5 (doctype html). */
  html5?: boolean
  whenFound: AsqWhenFound
  whenNone?: AsqWhenNone
  /** English wording (key of the French dictionary); {n} and {samples} are filled in. */
  text: string
}

/** Wording of a criterion found not applicable (the panel fills in {criterion}). */
export const ASQ_NA_TEXT = 'RGAA {criterion}: no element to check on this page, not applicable.'

/** What the page script adds to a finding so that the panel needs no copy of this table. */
export interface AsqExtra {
  criterion: string
  status: 'nc' | 'review' | 'na'
  text: string
}

/** Every test of the criteria that have at least one rule below (a criterion is "not applicable" when all its tests are). */
export const ASQ_CRITERION_TESTS: Record<string, string[]> = {
  '1.1': ['1.1.1', '1.1.2', '1.1.3', '1.1.4', '1.1.5', '1.1.6', '1.1.7', '1.1.8'],
  '1.5': ['1.5.1', '1.5.2'],
  '2.1': ['2.1.1'],
  '3.1': ['3.1.1', '3.1.2', '3.1.3', '3.1.4', '3.1.5', '3.1.6'],
  '7.4': ['7.4.1'],
  '8.3': ['8.3.1'],
  '8.5': ['8.5.1'],
  '8.9': ['8.9.1'],
  '8.10': ['8.10.1', '8.10.2'],
  '9.2': ['9.2.1'],
  '10.1': ['10.1.1', '10.1.2', '10.1.3'],
  '10.9': ['10.9.1', '10.9.2', '10.9.3', '10.9.4'],
  '10.10': ['10.10.1', '10.10.2', '10.10.3', '10.10.4'],
  '11.2': ['11.2.1', '11.2.2', '11.2.3', '11.2.4', '11.2.5', '11.2.6'],
  '11.10': ['11.10.1', '11.10.2', '11.10.3', '11.10.4', '11.10.5', '11.10.6', '11.10.7'],
  '11.11': ['11.11.1', '11.11.2'],
  '11.12': ['11.12.1', '11.12.2'],
  '11.13': ['11.13.1'],
  '13.1': ['13.1.1', '13.1.2', '13.1.3', '13.1.4'],
  '13.7': ['13.7.1', '13.7.2', '13.7.3'],
}

/* ------------------------------------------------------------------ */
/* Selectors shared by several rules (CssLikeQueryStore, converted)    */
/* ------------------------------------------------------------------ */

const AUDIO_EXT = ['wav', 'cda', 'mid', 'mp2', 'mp3', 'mp3pro', 'mod', 'rm', 'ram', 'wma', 'ogg', 'oga', 'aif', 'aiff', 'aa', 'aac', 'm4a', 'vqf', 'au', 'm3u', 'riff', 'bwf', 'caf', 'pcm', 'raw', 'flac', 'alac', 'ac3', 'acc']
const VIDEO_EXT = ['mp4', 'avi', 'wmv', 'mov', 'xvid', 'mkv', 'mka', 'mks', 'flv', 'rmvb', 'mpa', 'wma', 'mp2', 'm2p', 'dif', 'dv', 'vob', 'vro', 'vivo', 'bik', 'asf', 'ifo', 'mts', 'mxf', 'nds', 'rv', 'web', 'wlmp', 'wmp', 'ogv']
/** Asqatasun matches the extension anywhere in the href; here it must end the path (or be followed by ? or #), to avoid ".au" in "example.au/page". */
const linksTo = (exts: string[]): string =>
  [...new Set(exts)].map((e) => `a[href$=".${e}" i], a[href*=".${e}?" i], a[href*=".${e}#" i]`).join(', ')
/** Our own addition: players in an iframe are time-based media too (otherwise a page with only a YouTube player would look "without media"). */
const MEDIA_IFRAMES = 'iframe[src*="youtube"], iframe[src*="youtu.be"], iframe[src*="vimeo"], iframe[src*="dailymotion"]'
const NON_TIME_BASED_MEDIA = 'svg, canvas, object[data], embed[src]'
const TIME_BASED_MEDIA = `audio[src], audio:has(source[src]), bgsound, video[src], video:has(source[src]), ${NON_TIME_BASED_MEDIA}, ${linksTo([...AUDIO_EXT, ...VIDEO_EXT])}, ${MEDIA_IFRAMES}`

const FIELD_TAGS = ['datalist', 'meter', 'optgroup', 'option', 'output', 'progress', 'select', 'textarea']
const FIELD_TYPES = ['checkbox', 'color', 'date', 'datetime-local', 'file', 'email', 'month', 'number', 'password', 'radio', 'range', 'search', 'tel', 'text', 'time', 'url', 'week']
const FIELD_ROLES = ['checkbox', 'combobox', 'listbox', 'progressbar', 'option', 'radio', 'searchbox', 'slider', 'spinbutton', 'switch', 'textbox']
/** FORM_ELEMENT_CSS_LIKE_QUERY_RGAA4, optionally with an attribute added to each part. */
const formFields = (attr = ''): string =>
  [...FIELD_TAGS.map((t) => t + attr), `input:not([type])${attr}`, ...FIELD_TYPES.map((t) => `input[type=${t}]${attr}`), ...FIELD_ROLES.map((r) => `[role=${r}]${attr}`)].join(', ')
/**
 * Asqatasun looks for the <form> tag only. A page with fields outside any <form> (very common in web applications) would
 * then be "not applicable", so the fields are looked for as well.
 */
const FORM_OR_FIELD = 'form, input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([type=image]), select, textarea'

const rule = (test: string, whenFound: AsqWhenFound, selector: string, text: string, more: Partial<AsqRule> = {}): AsqRule => ({
  test,
  criterion: test.split('.').slice(0, 2).join('.'),
  selector,
  whenFound,
  text,
  ...more,
})

export const ASQ_RULES: AsqRule[] = [
  /* ---- 1 Images ---- */
  rule('1.1.4', 'review', 'img[ismap], input[type=image][ismap]', 'RGAA 1.1.4: {n} server-side image map(s) (ismap): check that every clickable zone has an equivalent usable with any pointing device. Examples: {samples}', { whenNone: 'na' }),
  rule('1.5.2', 'review', 'input[type=image]', 'RGAA 1.5.2: {n} image button(s) used as a CAPTCHA: check that an alternative way to access the content exists. Examples: {samples}', { captcha: true, whenNone: 'na' }),

  /* ---- 2 Frames ---- */
  rule('2.1.1', 'nc', 'iframe:not([title]), frame:not([title])', 'RGAA 2.1.1: {n} frame(s) without a title attribute. Examples: {samples}', { scope: 'iframe, frame', whenNone: 'na' }),

  /* ---- 3 Colours ---- */
  rule('3.1.5', 'review', TIME_BASED_MEDIA, 'RGAA 3.1.5: {n} time-based media found: check that no information is given by colour alone. Examples: {samples}', { whenNone: 'na' }),
  rule('3.1.6', 'review', NON_TIME_BASED_MEDIA, 'RGAA 3.1.6: {n} non time-based media found (svg, canvas, object, embed): check that no information is given by colour alone. Examples: {samples}', { whenNone: 'na' }),

  /* ---- 7 Scripts ---- */
  // Asqatasun answers "to check" whether or not the pattern is found, so nothing is reported when it is not.
  rule(
    '7.4.1',
    'review',
    'select[onchange], form:has(select):not(:has(button)):not(:has(input[type=submit])):not(:has(input[type=button])):not(:has(input[type=reset]))',
    'RGAA 7.4.1: {n} script(s) that may change the context (select with onchange, or form with a select and no button): check that the user is warned or has an explicit button. Examples: {samples}',
  ),

  /* ---- 8 Mandatory elements ---- */
  // Simplification: Asqatasun also accepts a page whose text elements all carry a lang attribute.
  rule('8.3.1', 'nc', 'html:not([lang]):not([xml\\:lang])', 'RGAA 8.3.1: the default language of the page is not declared (no lang attribute on <html>).', { whenNone: 'pass' }),
  rule('8.5.1', 'nc', 'html:not(:has(head title))', 'RGAA 8.5.1: the page has no <title> element in its <head>.', { whenNone: 'pass' }),
  rule('8.9.1', 'nc', 'a:not([href]):not([name]):not([id]):not([role=button])', 'RGAA 8.9.1: {n} link(s) without destination (no href, name or id), probably used for presentation. Examples: {samples}'),
  rule('8.9.1', 'nc', 'p:not([hidden]):not(:has(*)), li:not([hidden]):not(:has(*))', 'RGAA 8.9.1: {n} empty <p> or <li> element(s), probably used for layout. Examples: {samples}', { key: '8.9.1-empty', ownText: '^$' }),
  rule('8.9.1', 'nc', 'br', 'RGAA 8.9.1: {n} <br> element(s) in a row, probably used to space content. Examples: {samples}', { key: '8.9.1-br', followedBySameTag: true }),
  // Our own check already fails a dir value other than ltr or rtl (like Asqatasun does); this one asks for the relevance of the valid ones.
  rule('8.10.2', 'review', '[dir=ltr], [dir=rtl]', 'RGAA 8.10.2: {n} element(s) with a dir attribute (ltr or rtl): check that each change of reading direction is relevant. Examples: {samples}', { scope: '[dir]', whenNone: 'na' }),

  /* ---- 9 Structure (HTML5 pages only) ---- */
  rule('9.2.1', 'nc', 'html:not(:has(main:not([hidden])))', 'RGAA 9.2.1: the page has no visible <main> element.', { key: '9.2.1-main', html5: true }),
  rule('9.2.1', 'nc', 'main:not([hidden])', 'RGAA 9.2.1: {n} visible <main> elements, there should be only one. Examples: {samples}', { key: '9.2.1-main-unique', html5: true, minCount: 2 }),
  rule('9.2.1', 'nc', 'html:not(:has(:not(article):not(section) > header))', 'RGAA 9.2.1: the page has no <header> element outside <article> and <section>.', { key: '9.2.1-header', html5: true }),
  rule('9.2.1', 'nc', 'html:not(:has(:not(article):not(section) > footer))', 'RGAA 9.2.1: the page has no <footer> element outside <article> and <section>.', { key: '9.2.1-footer', html5: true }),
  rule('9.2.1', 'nc', 'html:not(:has(nav))', 'RGAA 9.2.1: the page has no <nav> element.', { key: '9.2.1-nav', html5: true }),

  /* ---- 10 Presentation ---- */
  // The deprecated tags (10.1.1) and most attributes (10.1.2) are already covered by our own checks; Asqatasun also
  // reports width and height on elements that are not images or embedded objects. The elements for which HTML5 keeps
  // these attributes (iframe, video, input, source) are left out here, Asqatasun does not.
  rule(
    '10.1.2',
    'nc',
    ':not(img):not(svg):not(object):not(embed):not(canvas)[width], :not(img):not(svg):not(object):not(embed):not(canvas)[height]',
    'RGAA 10.1.2: {n} element(s) with a width or height attribute used for presentation. Examples: {samples}',
    { key: '10.1.2-size', exclude: 'svg *, iframe, video, input, source' },
  ),
  rule('10.9.2', 'review', 'img', 'RGAA 10.9.2: {n} image(s) found: check that no information is given by shape, size or position alone. Examples: {samples}', { whenNone: 'na' }),
  rule('10.9.3', 'review', TIME_BASED_MEDIA, 'RGAA 10.9.3: {n} time-based media found: check that no information is given by shape, size or position alone. Examples: {samples}', { whenNone: 'na' }),
  rule('10.9.4', 'review', NON_TIME_BASED_MEDIA, 'RGAA 10.9.4: {n} non time-based media found (svg, canvas, object, embed): check that no information is given by shape, size or position alone. Examples: {samples}', { whenNone: 'na' }),
  rule('10.10.2', 'review', 'img', 'RGAA 10.10.2: {n} image(s) found: check that the way shape, size or position convey information is relevant. Examples: {samples}', { whenNone: 'na' }),
  rule('10.10.3', 'review', TIME_BASED_MEDIA, 'RGAA 10.10.3: {n} time-based media found: check that the way shape, size or position convey information is relevant. Examples: {samples}', { whenNone: 'na' }),
  rule('10.10.4', 'review', NON_TIME_BASED_MEDIA, 'RGAA 10.10.4: {n} non time-based media found (svg, canvas, object, embed): check that the way shape, size or position convey information is relevant. Examples: {samples}', { whenNone: 'na' }),

  /* ---- 11 Forms ---- */
  // Scopes: a label, a title… outside a <form> still makes the test applicable.
  rule('11.2.1', 'review', `form:has(${formFields()}) label`, 'RGAA 11.2.1: {n} label(s) in forms: check that each one tells the exact purpose of its field. Examples: {samples}', { scope: 'label', whenNone: 'na' }),
  rule('11.2.2', 'review', formFields('[title]'), 'RGAA 11.2.2: {n} field(s) with a title attribute: check that each one tells the exact purpose of the field. Examples: {samples}', { scope: formFields(), whenNone: 'na' }),
  rule('11.2.3', 'review', formFields('[aria-label]'), 'RGAA 11.2.3: {n} field(s) with an aria-label: check that each one tells the exact purpose of the field. Examples: {samples}', { scope: formFields(), whenNone: 'na' }),
  rule('11.2.4', 'review', formFields('[aria-labelledby]'), 'RGAA 11.2.4: {n} field(s) with an aria-labelledby: check that the text it points to tells the exact purpose of the field. Examples: {samples}', { scope: formFields(), whenNone: 'na' }),
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
  // An immediate redirection ("0;url=…") is accepted, a delay is not.
  rule('13.1.2', 'nc', 'meta[http-equiv=refresh i][content*=url i]', 'RGAA 13.1.2: {n} <meta> redirection(s) that are not immediate. Examples: {samples}', { scope: 'meta[http-equiv=refresh i]', attrRe: ['content', '^\\s*0*[1-9]\\d*\\s*[;,]\\s*url'], whenNone: 'na' }),
  rule('13.7.1', 'review', 'img, svg, canvas, object, embed', 'RGAA 13.7.1: {n} image(s) or media element(s) found: check that none flashes or changes brightness abruptly. Examples: {samples}', { whenNone: 'na' }),
]

/* ------------------------------------------------------------------ */
/* NOT PORTED — implemented in Asqatasun (RGAA 4.0) but not as a selector */
/* ------------------------------------------------------------------ */
/*
 * 99 tests are implemented in Asqatasun; 33 are ported above. The 66 others, with the reason:
 *
 * (Also: Asqatasun's 8.10.2 fails a dir value other than ltr or rtl, as the official test says; our own "dir-invalid" check was
 * changed to refuse "auto" too, and the rule above only adds the review of the valid values.)
 *
 * Images, informative or decorative (the verdict depends on "markers" the Asqatasun user sets, or on the accessible
 * name; without markers Asqatasun itself only answers "check the nature of the image", which is what the image-by-image
 * review of theme 1 and axe already do):
 *   1.1.1 1.1.2 1.1.3 1.1.5 1.1.6 1.1.7 1.1.8   presence of a text alternative (accessible name computation)
 *   1.2.1 1.2.2 1.2.3 1.2.4 1.2.5 1.2.6         decorative images with an empty alternative (markers)
 *   1.3.1 1.3.2 1.3.4 1.3.6 1.3.7 1.3.8         relevance of the alternative (text relevance, file-name nomenclature)
 *   1.4.1 1.4.2 1.4.3 1.4.5                     CAPTCHA images with an accessible name (accessible name computation)
 *
 * Text relevance (blacklists of words, lengths):
 *   2.2.1 (frame title)   9.1.2 (heading content)   8.6.1 (page title: our own "generic-title" check does the same)
 *   6.1.1 6.1.2 6.1.4   link text and accessible name of text, image and SVG links
 *
 * Contrast (computed colours, font sizes, backgrounds): 3.2.1 3.2.2 3.2.3 3.2.4. The extension has its own contrast
 * checker and axe's color-contrast rule.
 *
 * Tables (depend on markers set by the user: complex, layout or data table): 5.1.1 5.3.1
 *
 * CSS parsing (needs the style sheets): 10.4.1 (relative units in media queries)
 *
 * Language code against a list of ISO codes: 8.4.1
 *
 * Duplicates of our own checks (kept: ours detect the same things):
 *   8.1.1 8.1.2    doctype ("doctype" check; ours also tests quirks mode)
 *   10.1.1         presentation tags (same nomenclature as ours; 10.1.2 attributes: ours cover the same list, the width and
 *                  height part is added above)
 *   13.3.1 13.4.1  office documents ("downloads" check; Asqatasun's list of extensions is longer: csv, docm, xlsm…)
 *   4.1.1 4.1.2 4.1.3 4.2.1 4.2.2 4.2.3 4.3.1 4.3.2 4.4.1 4.5.1 4.5.2 4.6.1 4.6.2 4.7.1 4.8.1 4.8.2 4.9.1
 *   4.11.1 4.11.2 4.11.3 4.12.1 4.12.2 4.13.1 4.13.2
 *                  theme 4 (media): Asqatasun only detects media (video, audio, object, embed, svg, canvas, links to
 *                  media files) and asks for a manual check, with no verdict; our "media-found" / "no-media" checks do
 *                  that for the whole theme, and also see the YouTube, Vimeo and Dailymotion players in iframes.
 */
