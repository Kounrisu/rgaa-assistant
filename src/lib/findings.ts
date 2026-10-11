import { t } from './i18n'
import type { FindingItem, Verdict } from './types'
import type { Hint } from './rgaa'

export interface FindingCriterion {
  id: string
  level: 'A' | 'AA'
  question: string
  checks: string[]
  /** Finding types this criterion is answered for (all when absent): headings feed 9.1, landmarks 9.2. */
  types?: string[]
}

/** Criteria answered finding by finding. Colours also has page-level criteria (3.1, 3.3) in the checklist. */
export const FINDING_CRITERIA: Record<number, FindingCriterion[]> = {
  2: [
    {
      id: '2.1',
      level: 'A',
      question: 'Does this frame have a title (title attribute)?',
      checks: ['Every <iframe> / <frame> has a non-empty title attribute (test 2.1.1).', 'aria-label alone does not satisfy this criterion.'],
    },
    {
      id: '2.2',
      level: 'A',
      question: 'Is the frame title relevant?',
      checks: ['The title says what the frame contains or what it is for (test 2.2.1).', 'Not “iframe”, a file name or a URL.'],
    },
  ],
  5: [
    {
      id: '5.4',
      level: 'A',
      question: 'Does this data table have a title, and is it associated with the table?',
      checks: ['The title is a caption, or an aria-label / aria-labelledby / title on the table (test 5.4.1).', 'A table with no title at all makes this criterion not applicable.'],
      types: ['table-data', 'table-nohead'],
    },
    {
      id: '5.5',
      level: 'A',
      question: 'Is the title of this data table relevant?',
      checks: ['The title says what the table contains (test 5.5.1).'],
      types: ['table-data', 'table-nohead'],
    },
    {
      id: '5.6',
      level: 'A',
      question: 'Are the column and row headers of this data table declared?',
      checks: ['Each header cell is a th (or has role columnheader / rowheader) (test 5.6.1).', 'A data table with no header cell fails.'],
      types: ['table-data', 'table-nohead'],
    },
    {
      id: '5.7',
      level: 'A',
      question: 'Is each data cell correctly associated with its headers?',
      checks: ['Simple tables: th with scope, or headers / id for complex ones (tests 5.7.1 to 5.7.5).'],
      types: ['table-data', 'table-nohead'],
    },
    {
      id: '5.3',
      level: 'A',
      question: 'Is this layout table still understandable when linearized (read cell by cell)?',
      checks: ['The reading order of the cells keeps the meaning (test 5.3.1).'],
      types: ['table-layout', 'table-layout-semantic'],
    },
    {
      id: '5.8',
      level: 'A',
      question: 'Does this layout table avoid the markup of data tables?',
      checks: ['No th, caption, thead, tfoot, summary, headers or scope in a layout table (test 5.8.1).'],
      types: ['table-layout', 'table-layout-semantic'],
    },
  ],
  11: [
    {
      id: '11.1',
      level: 'A',
      question: 'Does this form field have a label?',
      checks: ['The field has a label (for / id or wrapping), an aria-label / aria-labelledby, or a title (tests 11.1.1 to 11.1.3).', 'A placeholder alone is not a label.'],
    },
    {
      id: '11.2',
      level: 'A',
      question: 'Does the label tell the exact function of the field?',
      checks: ['Reading the label alone, the user knows what to enter (test 11.2.1).', 'Not “field”, “input” or a label that belongs to another field.'],
    },
    {
      id: '11.13',
      level: 'AA',
      question: 'If this field is about the user (name, e-mail, phone, address…), can the browser fill it in (autocomplete)?',
      checks: ['The autocomplete attribute is present with a valid value for fields about the user (test 11.13.1).', 'Not applicable when the field is not about the user.'],
    },
  ],
  9: [
    {
      id: '9.1',
      level: 'A',
      question: 'Is this heading relevant, and is its level consistent with the structure of the page?',
      checks: ['The heading describes the content that follows it (test 9.1.2), and it has a text.', 'Heading levels follow a logical outline: no level skipped going down, a single clear page title (h1) (test 9.1.1).'],
      types: ['heading', 'heading-empty', 'heading-jump', 'page-no-h1', 'page-many-h1'],
    },
    {
      id: '9.2',
      level: 'A',
      question: 'Is this part of the document structure correct (header, navigation, main content, footer)?',
      checks: ['The page has its main areas marked up: header, navigation, one main, footer (test 9.2.1).', 'A landmark that appears more than once has its own name.'],
      types: ['landmark', 'page-no-main'],
    },
  ],
  6: [
    {
      id: '6.1',
      level: 'A',
      question: 'Is this link explicit: does its text (or its context) say where it goes or what it does?',
      checks: ['The link text, read alone or with its sentence, list item, cell or heading, tells the destination or the action (test 6.1.1).', 'Not “click here”, “read more”, “more” or a bare URL, unless the context makes it clear.'],
    },
    {
      id: '6.2',
      level: 'A',
      question: 'Does this link have a name (an accessible label)?',
      checks: ['The link has text, or an image with an alt, or an aria-label / aria-labelledby, or a title that gives it a name (test 6.2.1).', 'An empty link, or an icon without a name, is non-compliant.'],
    },
  ],
  7: [
    {
      id: '7.1',
      level: 'A',
      question: 'Is this component compatible with assistive technologies: right roles, names, states and properties, following its APG design pattern?',
      checks: [
        'The component exposes a role, a name and its state (expanded, selected, checked, value…) through the markup or ARIA (test 7.1.1).',
        'Its structure follows the WAI-ARIA Authoring Practices pattern listed below (test 7.1.3): the script checked what it could, read the result.',
        'A failing structural check is a non-compliance; a passing one proves nothing about the behaviour (see 7.3).',
      ],
    },
    {
      id: '7.3',
      level: 'A',
      question: 'Can this component be operated with the keyboard (and with any pointing device)?',
      checks: [
        'Reach it with Tab, then try every interaction of the pattern below with the keys listed (test 7.3.1).',
        'What the mouse can do, the keyboard can do too (test 7.3.2): no action is pointer-only.',
      ],
    },
  ],
  3: [
    {
      id: '3.2',
      level: 'AA',
      question: 'Is the contrast between this text and its background high enough?',
      checks: [
        'Text under 24 px (or bold under 18.5 px): ratio of at least 4.5:1.',
        'Text of 24 px or more (or bold from 18.5 px): ratio of at least 3:1.',
        'Exceptions: disabled controls, purely decorative text, logos, text that is part of a picture with no information role.',
      ],
    },
  ],
}

/** The criteria a given finding is answered for. */
export const findingCriteriaOf = (f: { theme: number; type: string }): FindingCriterion[] => (FINDING_CRITERIA[f.theme] ?? []).filter((c) => !c.types || c.types.includes(f.type))

/** Criteria of a finding-based theme that are answered per finding. */
export const findingCriterionIds = (theme: number): string[] => (FINDING_CRITERIA[theme] ?? []).map((c) => c.id)

const GENERIC_TITLE = /^(i?frame|cadre|untitled|title|titre|sans titre|iframe\s*\d*|advertisement|publicit[eé])$/i

export function hintForFinding(f: FindingItem, criterionId: string): Hint | null {
  const title = f.facts.title
  switch (criterionId) {
    case '2.1':
      if (title === null) return { tone: 'warn', text: t('No title attribute on this frame.') }
      if (!title.trim()) return { tone: 'warn', text: t('The title attribute is empty.') }
      return { tone: 'ok', text: t('title found: “{title}”', { title }) }
    case '2.2': {
      if (!title || !title.trim()) return { tone: 'warn', text: t('No title to judge: 2.1 fails first.') }
      if (GENERIC_TITLE.test(title.trim())) return { tone: 'warn', text: t('“{title}” is generic: it does not say what the frame contains.', { title }) }
      if (/^https?:\/\//i.test(title) || /\.(html?|php|aspx?)$/i.test(title)) return { tone: 'warn', text: t('The title looks like a URL or a file name.') }
      return { tone: 'info', text: t('Read the title and the frame content: does it describe them?') }
    }
    case '3.2': {
      if (f.type === 'contrast-ok') return { tone: 'ok', text: t('{pass} text element(s) pass their threshold (checked {total}).', { pass: (f.facts['Sufficient contrast'] ?? ''), total: (f.facts['Text elements checked'] ?? '') }) }
      if (f.type === 'contrast-unknown') return { tone: 'info', text: t('The background is an image, a gradient, a translucent layer or something placed over the text: a script cannot compute the ratio. Check it by eye or with a colour picker.') }
      return { tone: 'warn', text: t('Ratio {ratio} is below the required {required}. Check the exceptions (disabled, decorative, logo) before confirming.', { ratio: f.facts.Ratio ?? '', required: f.facts.Required ?? '' }) }
    }
    case '5.4':
      return f.facts.Title ? { tone: 'ok', text: t('Title found: “{title}”.', { title: f.facts.Title }) } : { tone: 'info', text: t('No title found: if the table really has none, this criterion is not applicable.') }
    case '5.5':
      return f.facts.Title ? { tone: 'info', text: t('Read the title: does it say what the table contains?') } : { tone: 'info', text: t('No title to judge.') }
    case '5.6':
      return f.type === 'table-nohead' ? { tone: 'warn', text: t('No header cell (th) in this table: if it is a data table, the headers are not declared.') } : { tone: 'ok', text: t('{n} header cell(s) found.', { n: f.facts['Header cells (th)'] ?? '' }) }
    case '5.7':
      return { tone: 'info', text: t('Check the association of cells and headers (scope, headers/id) by reading the table.') }
    case '5.3':
      return { tone: 'info', text: t('Read the cells in source order: does the content keep its meaning?') }
    case '5.8':
      return f.type === 'table-layout-semantic' ? { tone: 'warn', text: t('This layout table carries data table markup (th, caption, headers, scope or summary).') } : { tone: 'ok', text: t('No data table markup found in this layout table.') }
    case '11.1':
      if (f.type === 'field-nolabel') return { tone: 'warn', text: t('No label, aria-label, aria-labelledby or title: this field has no accessible name.') }
      if (f.type === 'field-placeholder') return { tone: 'warn', text: t('The only name comes from the placeholder, which is not a label.') }
      return { tone: 'ok', text: t('Name found: “{name}” (from {source}).', { name: f.facts['Accessible name'] ?? '', source: f.facts['Name comes from'] ?? '' }) }
    case '11.2':
      return f.type === 'field' ? { tone: 'info', text: t('Read the label: does it give the exact function of the field?') } : { tone: 'info', text: t('No usable label to judge: 11.1 fails first.') }
    case '11.13':
      if (!f.data.personal) return { tone: 'info', text: t('This field does not look like it is about the user: probably not applicable.') }
      return f.data.hasAutocomplete ? { tone: 'ok', text: t('autocomplete found: “{value}”.', { value: f.facts.Autocomplete ?? '' }) } : { tone: 'warn', text: t('This field looks like it is about the user but has no autocomplete attribute.') }
    case '9.1': {
      if (f.type === 'heading-empty') return { tone: 'warn', text: t('This heading is empty: it has no text for assistive technologies.') }
      if (f.type === 'heading-jump') return { tone: 'warn', text: t('The level jumps from {from} to {to}: a level is skipped in the outline.', { from: f.facts['Previous level'] ?? '', to: f.facts.Level ?? '' }) }
      if (f.type === 'page-no-h1') return { tone: 'warn', text: t('The page has no level 1 heading (h1).') }
      if (f.type === 'page-many-h1') return { tone: 'warn', text: t('The page has {n} level 1 headings: check that this is intended.', { n: f.facts.Count ?? '' }) }
      return { tone: 'info', text: t('Read the heading with the content below it: does it describe it, at the right level?') }
    }
    case '9.2':
      if (f.type === 'page-no-main') return { tone: 'warn', text: t('No main content area (main) found on the page.') }
      return { tone: 'info', text: t('Check that this area is the right kind of landmark, and named if several of the same kind exist.') }
    case '6.1': {
      if (f.type === 'link-empty') return { tone: 'warn', text: t('No name: 6.2 fails first.') }
      if (f.type === 'link-skip') return { tone: 'info', text: t('This is a skip link (RGAA 12.7): its target exists. Check that it becomes visible when it takes the focus, and that it really moves you to the content.') }
      if (f.type === 'link-skip-broken') return { tone: 'warn', text: t('This looks like a skip link (RGAA 12.7) but its target was not found on the page.') }
      if (f.type === 'link-generic') return { tone: 'warn', text: t('“{text}” says nothing about the destination alone: check that its context (sentence, heading, aria-describedby) makes it explicit.', { text: f.facts.Text ?? '' }) }
      return { tone: 'info', text: t('Read the link text with its context: does it say where it goes or what it does?') }
    }
    case '6.2':
      if (f.type === 'link-empty') return { tone: 'warn', text: t('This link has no accessible name: no text, alt, aria-label, aria-labelledby or title.') }
      return { tone: 'ok', text: t('Name found: “{name}”.', { name: f.facts['Accessible name'] ?? '' }) }
    case '7.1': {
      const fails = Number(f.data.fails ?? 0)
      return fails ? { tone: 'warn', text: t('{n} structural check(s) of the pattern fail in the markup (list below): the component is not exposed as the pattern expects.', { n: fails }) } : { tone: 'ok', text: t('The markup follows the structure of the pattern. This says nothing about the behaviour: try the keys in 7.3.') }
    }
    case '7.3':
      return { tone: 'info', text: t('Open the page, put the focus on the component with Tab and try every line of the keyboard checklist below. One missing interaction is a non-compliance.') }
    default:
      return null
  }
}

/** Default verdicts from the markup. They are pre-filled and flagged so a human can overrule them. */
export function suggestFinding(f: FindingItem): Record<string, Verdict> {
  if (f.type === 'iframe' || f.type === 'frame') {
    const ok = f.facts.title !== null && f.facts.title.trim() !== ''
    return { '2.1': ok ? 'c' : 'nc' }
  }
  if (f.type === 'table-nohead') return { '5.6': 'nc', ...(f.facts.Title ? { '5.4': 'c' } : { '5.4': 'na', '5.5': 'na' }) }
  if (f.type === 'table-data') return { '5.6': 'c', ...(f.facts.Title ? { '5.4': 'c' } : { '5.4': 'na', '5.5': 'na' }) }
  if (f.type === 'table-layout') return { '5.8': 'c' }
  if (f.type === 'table-layout-semantic') return { '5.8': 'nc' }
  if (f.type === 'field-nolabel' || f.type === 'field-placeholder') return { '11.1': 'nc', '11.13': f.data.personal ? (f.data.hasAutocomplete ? 'c' : 'nc') : 'na' }
  if (f.type === 'field') return { '11.1': 'c', '11.2': 'c', '11.13': f.data.personal ? (f.data.hasAutocomplete ? 'c' : 'nc') : 'na' }
  if (f.type === 'heading') return { '9.1': 'c' }
  if (f.type === 'heading-empty' || f.type === 'page-no-h1') return { '9.1': 'nc' }
  if (f.type === 'landmark') return { '9.2': 'c' }
  if (f.type === 'page-no-main') return { '9.2': 'nc' }
  if (f.type === 'link-empty') return { '6.2': 'nc' }
  if (f.type === 'link-skip') return { '6.1': 'c', '6.2': 'c' }
  if (f.type === 'link-skip-broken') return { '6.2': 'c' }
  if (f.type === 'link-generic') return { '6.2': 'c' }
  if (f.type === 'link') return { '6.1': 'c', '6.2': 'c' }
  if (f.type === 'contrast-ok') return { '3.2': 'c' }
  if (f.type === 'contrast-fail') return { '3.2': 'nc' }
  // a component whose markup breaks its pattern fails 7.1; a passing structure is not a verdict (the keyboard is untested)
  if (f.type.startsWith('widget-')) return Number(f.data.fails ?? 0) > 0 ? { '7.1': 'nc' } : {}
  return {}
}

export const findingIcon = (f: FindingItem): string => (f.type === 'iframe' || f.type === 'frame' ? f.type : f.type.replace('contrast-', '').replace('link-', ''))
