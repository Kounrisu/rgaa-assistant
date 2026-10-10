import { t } from './i18n'
import type { FindingItem, Verdict } from './types'
import type { Hint } from './rgaa'

export interface FindingCriterion {
  id: string
  level: 'A' | 'AA'
  question: string
  checks: string[]
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
    case '6.1': {
      if (f.type === 'link-empty') return { tone: 'warn', text: t('No name: 6.2 fails first.') }
      if (f.type === 'link-generic') return { tone: 'warn', text: t('“{text}” says nothing about the destination alone: check that its context (sentence, heading, aria-describedby) makes it explicit.', { text: f.facts.Text ?? '' }) }
      return { tone: 'info', text: t('Read the link text with its context: does it say where it goes or what it does?') }
    }
    case '6.2':
      if (f.type === 'link-empty') return { tone: 'warn', text: t('This link has no accessible name: no text, alt, aria-label, aria-labelledby or title.') }
      return { tone: 'ok', text: t('Name found: “{name}”.', { name: f.facts['Accessible name'] ?? '' }) }
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
  if (f.type === 'link-empty') return { '6.2': 'nc' }
  if (f.type === 'link-generic') return { '6.2': 'c' }
  if (f.type === 'link') return { '6.1': 'c', '6.2': 'c' }
  if (f.type === 'contrast-ok') return { '3.2': 'c' }
  if (f.type === 'contrast-fail') return { '3.2': 'nc' }
  return {}
}

export const findingIcon = (f: FindingItem): string => (f.type === 'iframe' || f.type === 'frame' ? f.type : f.type.replace('contrast-', '').replace('link-', ''))
