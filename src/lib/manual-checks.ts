/**
 * Checks a script cannot do and that every audit of a page should include: keyboard, zoom, screen reader…
 * Each points to the RGAA criteria it feeds. The English text is the key of the French dictionary.
 */
export interface ManualCheck {
  id: string
  group: string
  text: string
  /** How to do the check, for someone who has not done it before (English text is the key). */
  how: string
  criteria: string[]
}

export const MANUAL_GROUPS = ['Keyboard', 'Zoom and display', 'Screen reader', 'Content'] as const

export const MANUAL_CHECKS: ManualCheck[] = [
  { id: 'kb-reach', group: 'Keyboard', text: 'With the Tab key only, every link, button and field can be reached and used.', how: 'Click on the page, then press Tab again and again (Shift+Tab goes back). Enter or Space activates a link or button; arrow keys work inside menus, tabs and lists.', criteria: ['12.8', '7.1'] },
  { id: 'kb-focus', group: 'Keyboard', text: 'The focus is always visible and the tab order follows the reading order.', how: 'Keep pressing Tab: a visible outline must follow you and move in the reading order. The “Tab order” page tool numbers the sequence for you.', criteria: ['10.7', '12.8'] },
  { id: 'kb-trap', group: 'Keyboard', text: 'No keyboard trap: you can always leave a menu, a popin or a player with the keyboard.', how: 'Open each menu, popin, carousel and video player, then try Tab, Shift+Tab and Escape: you must always be able to get out without the mouse.', criteria: ['12.9'] },
  { id: 'kb-skip', group: 'Keyboard', text: 'The skip link works and takes you to the main content.', how: 'Reload the page and press Tab once: a skip link (“Aller au contenu”) should appear. Press Enter: the focus must land on the main content.', criteria: ['12.7'] },
  { id: 'zoom-200', group: 'Zoom and display', text: 'Zoom the text to 200 %: nothing is cut off or overlapping, all content and functions remain.', how: 'Press Ctrl/Cmd and + up to 200 %. In Firefox choose View › Zoom › Zoom Text Only to enlarge only the text. Look for cut-off, overlapping or missing text and controls.', criteria: ['10.4'] },
  { id: 'zoom-320', group: 'Zoom and display', text: 'Narrow the window to 320 px (zoom 400 %): no horizontal scrolling for the text content.', how: 'Make the window 320 px wide (or zoom to 400 % on a 1280 px window) and scroll: text content must not need horizontal scrolling (tables, maps and similar two-dimensional content are exceptions).', criteria: ['10.11'] },
  { id: 'zoom-spacing', group: 'Zoom and display', text: 'Increase the text spacing (line 1.5, paragraph 2, letter 0.12, word 0.16 em): no loss of content.', how: 'Switch on the “Text spacing” page tool and look for text that is cut off, hidden or overlapping.', criteria: ['10.12'] },
  { id: 'zoom-nocss', group: 'Zoom and display', text: 'With the style sheets turned off, the information stays understandable and in a logical order.', how: 'Switch on the “Styles off” page tool and read the page from top to bottom: is the order still logical and nothing lost?', criteria: ['10.3'] },
  { id: 'sr-structure', group: 'Screen reader', text: 'With a screen reader (NVDA, VoiceOver…), the page title, headings and landmarks give a clear structure.', how: 'Start NVDA (Windows) or VoiceOver (Cmd+F5 on a Mac) and list the headings and landmarks (NVDA: H and D keys; VoiceOver: the rotor). Do they describe the page?', criteria: ['8.5', '9.1', '9.2'] },
  { id: 'sr-names', group: 'Screen reader', text: 'Images, icons and buttons are announced with a relevant name.', how: 'With the screen reader on, Tab through the controls and listen: each icon, image and button must be announced with a meaningful name, not “button” or a file name.', criteria: ['1.1', '6.1', '11.9'] },
  { id: 'sr-forms', group: 'Screen reader', text: 'Each form field is announced with its label, its instructions and its errors.', how: 'Tab into each field and listen: label, required state and instructions are read. Submit with errors: the messages must be read and linked to their fields.', criteria: ['11.1', '11.10', '11.11'] },
  { id: 'sr-status', group: 'Screen reader', text: 'Status messages (success, error, loading) are announced without moving the focus.', how: 'Do an action that shows a message (send a form, add to a basket, load results) without moving: the screen reader must announce the message by itself.', criteria: ['7.5'] },
  { id: 'c-title-lang', group: 'Content', text: 'The page has a relevant title and its language is set.', how: 'Read the title in the browser tab (does it say which page this is?). The “Languages” page tool shows the page language and every change of language.', criteria: ['8.5', '8.3'] },
  { id: 'c-headings', group: 'Content', text: 'The heading levels form a logical outline (one h1, no jump).', how: 'Open the Structure theme of this tool: the outline lists the headings in order. One h1 and no skipped level?', criteria: ['9.1'] },
  { id: 'c-links', group: 'Content', text: 'Each link has an explicit purpose, and a new window is announced.', how: 'Open the Links theme: read each link name with its context. A link that opens a new window (target=\"_blank\") must say so in its text or title.', criteria: ['6.1', '13.2'] },
  { id: 'c-colour', group: 'Content', text: 'Information is never given by colour alone.', how: 'Look for errors, required fields, chart series and states shown only by a colour. Is there also a text, an icon or a pattern that says the same thing?', criteria: ['3.1'] },
  { id: 'c-media', group: 'Content', text: 'Videos and audio have captions, a transcript or an audio description where needed.', how: 'Play each video and audio: are captions available, and is there a transcript or an audio description nearby when the images carry information?', criteria: ['4.1'] },
  { id: 'c-motion', group: 'Content', text: 'Moving, blinking or auto-updating content can be paused or stopped.', how: 'Watch for carousels, tickers and animations that last more than 5 seconds: is there a visible control to pause or stop them?', criteria: ['13.8'] },
]
