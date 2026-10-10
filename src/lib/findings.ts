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
  if (f.type === 'contrast-ok') return { '3.2': 'c' }
  if (f.type === 'contrast-fail') return { '3.2': 'nc' }
  return {}
}

export const findingIcon = (f: FindingItem): string => (f.type === 'iframe' || f.type === 'frame' ? f.type : f.type.replace('contrast-', ''))
