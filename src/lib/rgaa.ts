import type { Detected, ImageElementInfo, ImageKind } from './types'

export interface Criterion {
  id: string
  level: 'A' | 'AA'
  /** Official RGAA 4.1 wording. */
  title: string
  /** Plain-language question shown on the card. */
  question: string
  /** Paraphrased key checks — see the official page for the exact tests. */
  checks: string[]
  appliesTo: ImageKind[]
}

export const RGAA_BASE_URL = 'https://accessibilite.numerique.gouv.fr/methode/criteres-et-tests/'
export const criterionUrl = (id: string): string => `${RGAA_BASE_URL}#${id}`

export const CRITERIA: Criterion[] = [
  {
    id: '1.1',
    level: 'A',
    title: "Chaque image porteuse d'information a-t-elle une alternative textuelle ?",
    question: 'Does this informative image have a text alternative?',
    checks: [
      '<img> has an alt attribute with text, or an aria-label / aria-labelledby / title that gives it a name.',
      'Same rule for role="img", <input type="image">, <area>, <svg role="img">, <canvas>, <object>, <embed>.',
    ],
    appliesTo: ['informative'],
  },
  {
    id: '1.2',
    level: 'A',
    title: 'Chaque image de décoration est-elle correctement ignorée par les technologies d’assistance ?',
    question: 'Is this decorative image properly ignored by assistive technologies?',
    checks: [
      '<img> has alt="" (empty) and no title, aria-label or aria-labelledby…',
      '…or it is hidden with role="presentation" / role="none" or aria-hidden="true" (role="presentation" is preferred for support).',
      'A decorative image with a caption is out of scope here: it falls under 1.9.',
    ],
    appliesTo: ['decorative'],
  },
  {
    id: '1.3',
    level: 'A',
    title:
      "Pour chaque image porteuse d'information ayant une alternative textuelle, cette alternative est-elle pertinente (hors cas particuliers) ?",
    question: 'Is the text alternative relevant — does it convey the same information or function as the image?',
    checks: [
      'The alternative gives the same information as the image (not a file name, not just “image” or “photo”).',
      'If the image is inside a link or button, the alternative describes the destination or the action.',
      'If the image contains text, the alternative includes that text.',
      'The alternative is short and concise (test 1.3.9). CAPTCHAs and image tests are handled by 1.4, not here.',
    ],
    appliesTo: ['informative'],
  },
  {
    id: '1.6',
    level: 'A',
    title: "Chaque image porteuse d'information a-t-elle, si nécessaire, une description détaillée ?",
    question: 'Is the image complex enough (chart, map, diagram…) to need a detailed description — and does it have one?',
    checks: [
      'A short alternative is enough for most images → answer Not applicable.',
      'For complex images, a detailed description exists: adjacent text, an adjacent link or button, or aria-label / aria-labelledby.',
      'longdesc is obsolete (HTML5) and aria-describedby is not recommended on <img>, <object>, <embed>, <canvas>.',
    ],
    appliesTo: ['informative'],
  },
  {
    id: '1.7',
    level: 'A',
    title:
      "Pour chaque image porteuse d'information ayant une description détaillée, cette description est-elle pertinente ?",
    question: 'If there is a detailed description, is it relevant and as informative as the image?',
    checks: [
      'The description conveys the same information as the image.',
      'It is reachable by assistive technologies (adjacent text/link/button, or aria-label / aria-labelledby).',
    ],
    appliesTo: ['informative'],
  },
  {
    id: '1.8',
    level: 'AA',
    title:
      'Chaque image texte porteuse d’information, en l’absence d’un mécanisme de remplacement, doit être remplacée par du texte stylé. Cette règle est-elle respectée (hors cas particuliers) ?',
    question: 'If the image is text rendered as a picture, could it be real styled text instead?',
    checks: [
      'Images of text should be replaced by styled HTML/CSS text when technically possible.',
      'Not applicable: logos, trade names, CAPTCHAs, image tests, or images where graphic exactness is essential.',
      'Also fine: a substitute mechanism, or text that relies on a graphic effect CSS cannot reproduce.',
      'Not an image of text → Not applicable.',
    ],
    appliesTo: ['informative'],
  },
  {
    id: '1.9',
    level: 'A',
    title: 'Chaque légende d’image est-elle, si nécessaire, correctement associée à l’image correspondante ?',
    question: 'If the image has a visible caption, is it programmatically associated with it?',
    checks: [
      'The image and its caption sit in a <figure> (with role="figure" or role="group").',
      'The <figure> has an aria-label matching the caption text, and the caption is in a <figcaption>.',
      'A captioned image must also pass 1.1 and 1.3.',
      'No caption → Not applicable.',
    ],
    appliesTo: ['informative'],
  },
]

export function criteriaFor(kind: ImageKind | undefined): Criterion[] {
  return kind ? CRITERIA.filter((c) => c.appliesTo.includes(kind)) : []
}

export type HintTone = 'ok' | 'warn' | 'info'
export interface Hint {
  tone: HintTone
  text: string
}

export function detectedOf(el: ImageElementInfo): Detected {
  if (el.ignoredBy) return 'ignored'
  return el.accessibleName ? 'named' : 'unnamed'
}

export const DETECTED_LABEL: Record<Detected, string> = {
  ignored: 'Ignored by assistive tech',
  named: 'Has a text alternative',
  unnamed: 'No text alternative',
}

export function suggestedKind(el: ImageElementInfo): ImageKind | null {
  const d = detectedOf(el)
  return d === 'ignored' ? 'decorative' : d === 'named' ? 'informative' : null
}

/** Deterministic, non-binding observations shown on each criterion card. */
export function hintFor(criterionId: string, el: ImageElementInfo): Hint | null {
  const name = el.accessibleName
  const extra = [el.ariaLabel && 'aria-label', el.labelledByText && 'aria-labelledby', el.title && 'title', el.svgTitle && '<title>'].filter(Boolean)
  switch (criterionId) {
    case '1.1':
      if (el.ignoredBy) return { tone: 'warn', text: `Ignored by assistive tech (${el.ignoredBy}) — is it really decorative?` }
      if (!name) return { tone: 'warn', text: `No accessible name found on this ${el.type}.` }
      return { tone: 'ok', text: `Accessible name found: “${name}”` }
    case '1.2': {
      const hiddenOutright = el.ignoredBy?.startsWith('aria-hidden') || el.ignoredBy?.startsWith('role=')
      if (hiddenOutright) {
        return {
          tone: 'ok',
          text: `Hidden from assistive tech (${el.ignoredBy}).${extra.length ? ` It also has ${extra.join(', ')}, which assistive tech will not read — remove it if it is not needed.` : ''}`,
        }
      }
      if (el.ignoredBy && !extra.length) return { tone: 'ok', text: `Ignored by assistive tech (${el.ignoredBy}) and has no accessible name.` }
      if (el.ignoredBy) return { tone: 'warn', text: `Ignored (${el.ignoredBy}) but also has ${extra.join(', ')} — remove it.` }
      if (extra.length) return { tone: 'warn', text: `Has ${extra.join(', ')} — a decorative image must not have an accessible name.` }
      if (el.alt === null) return { tone: 'warn', text: `Not hidden from assistive tech: add aria-hidden="true"${el.tag === 'img' ? ' or alt=""' : ''}.` }
      return { tone: 'warn', text: `Not ignored: alt is “${el.alt}” — a decorative image should have alt="".` }
    }
    case '1.3':
      if (el.deterministic.altMatchesFilenamePattern) return { tone: 'warn', text: 'The alternative looks like a file name.' }
      if (name && name.length > 150) return { tone: 'warn', text: `The alternative is ${name.length} characters long — it should be short and concise (1.3.9).` }
      if (el.isInsideLink && name) return { tone: 'info', text: 'Image is inside a link: the alternative should describe where the link goes.' }
      return null
    case '1.6':
      return { tone: 'info', text: 'Only charts, maps, diagrams and infographics usually need a detailed description.' }
    case '1.9':
      return el.figcaption
        ? { tone: 'ok', text: `<figcaption> found: “${el.figcaption.slice(0, 120)}”` }
        : { tone: 'info', text: 'No <figcaption> found around this image.' }
    default:
      return null
  }
}
