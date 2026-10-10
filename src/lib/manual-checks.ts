/**
 * Checks a script cannot do and that every audit of a page should include: keyboard, zoom, screen reader…
 * Each points to the RGAA criteria it feeds. The English text is the key of the French dictionary.
 */
export interface ManualCheck {
  id: string
  group: string
  text: string
  criteria: string[]
}

export const MANUAL_GROUPS = ['Keyboard', 'Zoom and display', 'Screen reader', 'Content'] as const

export const MANUAL_CHECKS: ManualCheck[] = [
  { id: 'kb-reach', group: 'Keyboard', text: 'With the Tab key only, every link, button and field can be reached and used.', criteria: ['12.8', '7.1'] },
  { id: 'kb-focus', group: 'Keyboard', text: 'The focus is always visible and the tab order follows the reading order.', criteria: ['10.7', '12.8'] },
  { id: 'kb-trap', group: 'Keyboard', text: 'No keyboard trap: you can always leave a menu, a popin or a player with the keyboard.', criteria: ['12.9'] },
  { id: 'kb-skip', group: 'Keyboard', text: 'The skip link works and takes you to the main content.', criteria: ['12.7'] },
  { id: 'zoom-200', group: 'Zoom and display', text: 'Zoom the text to 200 %: nothing is cut off or overlapping, all content and functions remain.', criteria: ['10.4'] },
  { id: 'zoom-320', group: 'Zoom and display', text: 'Narrow the window to 320 px (zoom 400 %): no horizontal scrolling for the text content.', criteria: ['10.11'] },
  { id: 'zoom-spacing', group: 'Zoom and display', text: 'Increase the text spacing (line 1.5, paragraph 2, letter 0.12, word 0.16 em): no loss of content.', criteria: ['10.12'] },
  { id: 'zoom-nocss', group: 'Zoom and display', text: 'With the style sheets turned off, the information stays understandable and in a logical order.', criteria: ['10.3'] },
  { id: 'sr-structure', group: 'Screen reader', text: 'With a screen reader (NVDA, VoiceOver…), the page title, headings and landmarks give a clear structure.', criteria: ['8.5', '9.1', '9.2'] },
  { id: 'sr-names', group: 'Screen reader', text: 'Images, icons and buttons are announced with a relevant name.', criteria: ['1.1', '6.1', '11.9'] },
  { id: 'sr-forms', group: 'Screen reader', text: 'Each form field is announced with its label, its instructions and its errors.', criteria: ['11.1', '11.10', '11.11'] },
  { id: 'sr-status', group: 'Screen reader', text: 'Status messages (success, error, loading) are announced without moving the focus.', criteria: ['7.5'] },
  { id: 'c-title-lang', group: 'Content', text: 'The page has a relevant title and its language is set.', criteria: ['8.5', '8.3'] },
  { id: 'c-headings', group: 'Content', text: 'The heading levels form a logical outline (one h1, no jump).', criteria: ['9.1'] },
  { id: 'c-links', group: 'Content', text: 'Each link has an explicit purpose, and a new window is announced.', criteria: ['6.1', '13.2'] },
  { id: 'c-colour', group: 'Content', text: 'Information is never given by colour alone.', criteria: ['3.1'] },
  { id: 'c-media', group: 'Content', text: 'Videos and audio have captions, a transcript or an audio description where needed.', criteria: ['4.1'] },
  { id: 'c-motion', group: 'Content', text: 'Moving, blinking or auto-updating content can be paused or stopped.', criteria: ['13.8'] },
]
