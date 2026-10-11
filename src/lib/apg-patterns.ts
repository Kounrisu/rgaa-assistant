/**
 * The WAI-ARIA Authoring Practices (APG) design patterns the Components review knows about.
 *
 * RGAA 4.1 test 7.1.3 refers to the APG for interface components. For each pattern this file holds the wording of the
 * structural checks a script runs in the page (`src/content/scan-components.ts` emits their ids and results) and the
 * keyboard interaction a human has to try. The APG is W3C material: we link to it and write our own checklist wording.
 * English texts are the keys: French in `i18n-fr-apg.ts`.
 */
export interface ApgPattern {
  /** The pattern id, also the suffix of the finding type (`widget-<id>`). */
  id: string
  name: string
  url: string
  /** Structural checks a script can do, by check id (what the finding's `data.checks` refers to). */
  structure: Record<string, string>
  /** What the auditor tries at the keyboard; each line is one expectation. */
  keyboard: string[]
}

const APG = 'https://www.w3.org/WAI/ARIA/apg/patterns/'

export const APG_PATTERNS: Record<string, ApgPattern> = {
  tabs: {
    id: 'tabs',
    name: 'Tabs',
    url: `${APG}tabs/`,
    structure: {
      'tab-roles': 'Every tab has role="tab" and sits inside the tablist.',
      'tab-selected': 'Exactly one tab has aria-selected="true".',
      'tab-controls': 'Each tab points to its panel with aria-controls, and that panel exists with role="tabpanel".',
      'panel-labelled': 'Each tabpanel is labelled by its tab (aria-labelledby).',
      'tab-roving': 'Only the selected tab is in the Tab sequence (the others have tabindex="-1").',
      'tablist-name': 'When the page has several tablists, each one has an accessible name.',
    },
    keyboard: [
      'Tab moves to the selected tab, then (Tab again) into the panel, not through every tab.',
      'Left / Right arrows (Up / Down for a vertical tablist) move between the tabs; Home and End go to the first and last tab.',
      'Either moving the focus selects the tab (automatic activation), or Enter / Space does (manual activation).',
      'The panel that is shown always matches the selected tab.',
    ],
  },
  dialog: {
    id: 'dialog',
    name: 'Dialog (modal)',
    url: `${APG}dialog-modal/`,
    structure: {
      'dialog-name': 'The dialog has an accessible name (aria-labelledby on its title, or aria-label).',
      'dialog-modal': 'aria-modal="true" (or a native <dialog> opened with showModal()).',
      'dialog-focusable': 'The dialog contains at least one focusable element (a close button at least).',
    },
    keyboard: [
      'When it opens, the focus moves inside the dialog (first field or close button).',
      'Tab and Shift+Tab stay inside the dialog: nothing behind it can be reached.',
      'Escape closes it.',
      'When it closes, the focus returns to the element that opened it.',
    ],
  },
  menu: {
    id: 'menu',
    name: 'Menu / menu button',
    url: `${APG}menu-button/`,
    structure: {
      'menu-items': 'The menu contains only menuitem, menuitemcheckbox or menuitemradio items (grouped or not).',
      'menu-trigger': 'A menu (not a menubar) is opened by a button with aria-haspopup and aria-expanded.',
      'menu-roving': 'At most one item is in the Tab sequence (the others have tabindex="-1").',
    },
    keyboard: [
      'Enter, Space or Down arrow on the button opens the menu and focuses the first item.',
      'Up / Down arrows move between the items (Left / Right in a menubar or into submenus); Home and End go to the first and last.',
      'Escape closes the menu and puts the focus back on the button.',
      'Typing a letter moves to the next item starting with it.',
    ],
  },
  disclosure: {
    id: 'disclosure',
    name: 'Disclosure (show / hide)',
    url: `${APG}disclosure/`,
    structure: {
      'disclosure-button': 'The control is a button (<button> or role="button").',
      'disclosure-expanded': 'aria-expanded is "true" or "false".',
      'disclosure-controls': 'When aria-controls is used, it points to an element that exists.',
      'disclosure-state': 'The content is hidden when aria-expanded="false" and shown when "true".',
    },
    keyboard: ['Enter and Space toggle the content.', 'The focus stays on the button after toggling.'],
  },
  accordion: {
    id: 'accordion',
    name: 'Accordion',
    url: `${APG}accordion/`,
    structure: {
      'accordion-heading': 'Each accordion button is inside a heading (h2–h6 or role="heading").',
      'disclosure-button': 'Each header control is a button (<button> or role="button").',
      'disclosure-expanded': 'Each button has aria-expanded "true" or "false".',
      'disclosure-controls': 'Each button points to its panel with aria-controls, and the panel exists.',
    },
    keyboard: [
      'Enter and Space open or close the panel of the focused header.',
      'Tab moves to the next focusable element (including the next header); Shift+Tab backwards.',
      'Optional: Up / Down arrows move between headers, Home / End to the first and last.',
    ],
  },
  details: {
    id: 'details',
    name: 'Disclosure (<details>)',
    url: `${APG}disclosure/`,
    structure: { 'details-summary': 'The <details> element starts with a <summary> that has a text.' },
    keyboard: ['Enter and Space on the summary toggle the content.'],
  },
  combobox: {
    id: 'combobox',
    name: 'Combobox',
    url: `${APG}combobox/`,
    structure: {
      'combobox-name': 'The combobox has an accessible name (label, aria-label or aria-labelledby).',
      'combobox-expanded': 'aria-expanded is "true" or "false".',
      'combobox-popup': 'When expanded, aria-controls points to the popup (listbox, tree, grid or dialog).',
      'combobox-autocomplete': 'When present, aria-autocomplete is none, inline, list or both.',
    },
    keyboard: [
      'Down arrow opens the popup and moves to the first suggestion (Alt+Down opens without moving).',
      'Up / Down move between suggestions; Enter accepts one; Escape closes the popup (and clears, if typed text was there).',
      'Typing filters or completes; Home / End move in the text.',
    ],
  },
  listbox: {
    id: 'listbox',
    name: 'Listbox',
    url: `${APG}listbox/`,
    structure: {
      'listbox-name': 'The listbox has an accessible name.',
      'listbox-options': 'The listbox contains only option items (grouped or not).',
      'listbox-selected': 'The options carry aria-selected (at least the selected one).',
    },
    keyboard: [
      'Tab moves to the listbox (on the selected option, or the first one).',
      'Up / Down move the focus (and the selection, in a single-select list); Home / End go to the first and last.',
      'Multi-select: Space toggles, Shift+arrows extend; typing a letter jumps to a matching option.',
    ],
  },
  slider: {
    id: 'slider',
    name: 'Slider',
    url: `${APG}slider/`,
    structure: {
      'slider-values': 'aria-valuenow, aria-valuemin and aria-valuemax are numbers, with now between min and max.',
      'slider-name': 'The slider has an accessible name.',
      'slider-focusable': 'The slider is in the Tab sequence (tabindex="0").',
    },
    keyboard: [
      'Right / Up arrows increase the value, Left / Down decrease it.',
      'Home and End go to the minimum and maximum.',
      'Optional: Page Up / Page Down change by a larger step.',
      'The value read by a screen reader changes with the handle (aria-valuenow, or aria-valuetext).',
    ],
  },
  spinbutton: {
    id: 'spinbutton',
    name: 'Spinbutton',
    url: `${APG}spinbutton/`,
    structure: {
      'spin-values': 'aria-valuenow is a number (and within aria-valuemin / aria-valuemax when they are given).',
      'spin-name': 'The spinbutton has an accessible name.',
      'spin-focusable': 'The spinbutton is in the Tab sequence.',
    },
    keyboard: ['Up / Down arrows change the value by one step.', 'Home / End go to the minimum and maximum; Page Up / Page Down by a larger step.'],
  },
  switch: {
    id: 'switch',
    name: 'Switch',
    url: `${APG}switch/`,
    structure: {
      'toggle-checked': 'aria-checked is "true" or "false".',
      'toggle-name': 'The switch has an accessible name.',
      'toggle-focusable': 'The switch is in the Tab sequence.',
    },
    keyboard: ['Space (and Enter, for a button) toggles the state.', 'The state read by a screen reader changes (on / off).'],
  },
  checkbox: {
    id: 'checkbox',
    name: 'Checkbox (custom)',
    url: `${APG}checkbox/`,
    structure: {
      'toggle-checked': 'aria-checked is "true", "false" or "mixed".',
      'toggle-name': 'The checkbox has an accessible name.',
      'toggle-focusable': 'The checkbox is in the Tab sequence.',
    },
    keyboard: ['Space toggles the state.', 'A mixed (tri-state) checkbox cycles through its states with Space.'],
  },
  radiogroup: {
    id: 'radiogroup',
    name: 'Radio group (custom)',
    url: `${APG}radio/`,
    structure: {
      'radio-group': 'The radios are inside an element with role="radiogroup" that has an accessible name.',
      'toggle-checked': 'Each radio has aria-checked "true" or "false", and at most one is checked.',
      'toggle-name': 'Each radio has an accessible name.',
      'radio-roving': 'Only one radio is in the Tab sequence (the checked one, or the first).',
    },
    keyboard: ['Tab moves to the checked radio (or the first).', 'Up / Down / Left / Right arrows move the focus and check the radio; Space checks the focused one.'],
  },
  tree: {
    id: 'tree',
    name: 'Tree view',
    url: `${APG}treeview/`,
    structure: {
      'tree-name': 'The tree has an accessible name.',
      'tree-items': 'The tree contains treeitem nodes (child lists have role="group").',
      'tree-expanded': 'Every node that has children carries aria-expanded.',
      'tree-roving': 'Only one node is in the Tab sequence.',
    },
    keyboard: [
      'Up / Down move between visible nodes; Right expands or moves into a node, Left collapses or moves to the parent.',
      'Home / End go to the first and last visible node; Enter activates; * expands all siblings.',
      'Typing a letter moves to the next node starting with it.',
    ],
  },
  tooltip: {
    id: 'tooltip',
    name: 'Tooltip',
    url: `${APG}tooltip/`,
    structure: { 'tooltip-referenced': 'Some element refers to the tooltip with aria-describedby (or aria-labelledby).' },
    keyboard: ['The tooltip appears when its element takes the keyboard focus, not only on hover.', 'Escape dismisses it.', 'It stays visible while the pointer is over it.'],
  },
  button: {
    id: 'button',
    name: 'Button (custom)',
    url: `${APG}button/`,
    structure: {
      'button-name': 'The button has an accessible name.',
      'button-focusable': 'The button is in the Tab sequence (tabindex="0", or a focusable element).',
      'button-pressed': 'When aria-pressed is used, it is "true" or "false".',
    },
    keyboard: ['Enter and Space activate it.', 'A toggle button announces its pressed state.'],
  },
  toolbar: {
    id: 'toolbar',
    name: 'Toolbar',
    url: `${APG}toolbar/`,
    structure: {
      'toolbar-controls': 'The toolbar contains at least two controls.',
      'toolbar-roving': 'Only one control is in the Tab sequence (the others have tabindex="-1").',
      'toolbar-name': 'When the page has several toolbars, each one has an accessible name.',
    },
    keyboard: ['Tab enters the toolbar once (on one control) and leaves it with the next Tab.', 'Left / Right arrows (Up / Down for a vertical toolbar) move between the controls; Home / End to the first and last.'],
  },
}

export const apgPattern = (findingType: string): ApgPattern | undefined => APG_PATTERNS[findingType.replace(/^widget-/, '')]

/** One structural check as the scanner reports it (JSON in `data.checks`). */
export interface ApgCheckResult {
  id: string
  ok: boolean
  /** What was found, for the auditor (ids, values, counts). */
  detail?: string
}

export function parseChecks(raw: unknown): ApgCheckResult[] {
  if (typeof raw !== 'string') return []
  try {
    const list = JSON.parse(raw)
    return Array.isArray(list) ? list.filter((c) => c && typeof c.id === 'string' && typeof c.ok === 'boolean') : []
  } catch {
    return []
  }
}
