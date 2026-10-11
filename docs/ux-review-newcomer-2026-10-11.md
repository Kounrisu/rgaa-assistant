# UX review: a first audit by an inexperienced RGAA auditor (2026-10-11, Claude Code)

**Goal of the product, as stated by the owner:** audit a site against RGAA 4.1 and end with the Excel grid and a
*taux d'accessibilité*, by combining automatic tests where possible with a guided human review of the audited
elements. More AI (or an MCP service) may come later, as a second step.

**Method.** I played a newcomer who has read the RGAA once and never audited: open the panel, do what the screen
says, try to reach the Excel. Built panel `e600848`, Chromium 1280×900 and a DevTools-like 1280×520, fixture site
(3 images, 1 table, 4 links, 1 form, 1 faint text), French interface. Every step was screenshotted; the Excel and
the HTML report were opened. **Not done:** real Firefox, real DevTools, a real site, a screen reader, a real
auditor. This is one person reading screens, not user research.

## 1. What went well

- **The first screen tells me what to do** ("Commencez par enregistrer les pages de votre échantillon", one big
  button, three numbered steps). I never had to guess the first click.
- **The automatic run is one button** and lands me on a screen that says what it found, in plain words
  ("5 règles en échec, 33 verdicts pré-remplis… Confirmez-les dans les thématiques"), with a *next* button.
- **An element review screen is a lesson.** Image n° 2: a red card explains *why* the missing alt is a problem,
  which criterion fails depending on the nature of the image, and offers the two possible verdicts. The RGAA
  criterion text, the official test, the markup and the parent context are on the same screen. For a newcomer this
  is the strongest part of the product.
- **Honesty is visible everywhere**: "provisoire" on every rate, the yellow note explaining why, "Suggestion : …
  non comptée tant que vous ne l'avez pas confirmée", "Cela ne prouve pas que le critère est respecté".
- **The Excel is the official grid**: one sheet per page in the DINUM layout, plus the sample, the per-criterion
  table, the dashboard with the A / AA rates, and detail sheets. The HTML report has a draft accessibility
  statement with "à compléter" placeholders. That is exactly the deliverable the owner asked for.

## 2. Defects found and fixed during this review

| # | What a newcomer saw | Cause | Fix (commit) |
|---|---|---|---|
| F1 | The report listed a **12.6 non-compliance "#rgaa-assistant-overlay"**: the tool reported *its own* boxes as a failure of the page, counted in the rate. | axe ran on the whole document, our overlay included. | axe excludes every `rgaa-assistant-*` element and drops any remaining node that points at one; unit test + smoke assertion (`e600848`). |
| F2 | Right after "Ajouter comme P01", the yellow banner still said **"Cette URL n'est pas encore dans l'échantillon"**. | The banner was only re-evaluated at the next tab event. | Re-evaluated after the page is added (`e600848`). |
| F3 | Excel detail sheets mixed English into the French grid ("NC – Non-compliant", "Rows: 2", "Text with sufficient contrast"). | Raw labels written without the French dictionary. | Labels and facts go through `tFr` (`e600848`). |
| F4 | An image left the "À relire" queue after one NC answer although other criteria were unanswered; pre-filled images were not in the queue. (Reported by Codex.) | `needsReview` only looked at the status. | Queue rule shared with the box colours; regression test (`0d33d15`). |

## 3. What confused me, in the order I met it (not fixed: proposals)

**U1 — Too much chrome before the content, especially at DevTools height.** At 1280×520 (a normal DevTools dock)
the audit bar, the view tabs, the status line, the page bar, the progress line, the seven status pills and the
"Outils d'affichage" row take **all** the height: the element list and the criterion cards start below the fold.
Codex made the same observation. Proposal: one compact header row for the audit (name · save pill · file), one for
the page (page select · browser URL · *one* primary action), and collapse the progress + pills into a single line
that expands on click. Target: content visible from ~180 px down.

**U2 — Three different "next".** "Prochain à relire" (page bar), "Prochaine à relire ⇥" (image header),
"Relire le prochain élément en attente" (checks screen), plus "Suiv. →". They do slightly different things
(page-wide first unresolved vs. next image after this one). A newcomer wants one verb, one place, one behaviour:
*next thing I have to decide*, criterion by criterion, element by element, theme by theme, with an end-of-queue
state ("Rien ne reste à relire sur P01 — passer à P02 ?").

**U3 — I did not know the review had seven more criteria per image.** After answering 1.1 for the logo, the badge
said "En cours" but nothing said *what* remained (1.3, 1.6…); the criterion cards are below the fold. Proposal:
a small "3 / 7 critères répondus — suivant : 1.3" line under the image title, and auto-scroll to the first
unanswered card.

**U4 — Two vocabularies for the same thing.** "Analyser" (scan) vs "Contrôles automatiques" (run everything); the
tabs say "Contrôles", the pills say "à confirmer" and "échec(s) à confirmer", the cards say "pré-rempli",
"suggestion", "verdict". A newcomer cannot tell *pré-rempli* from *suggestion*. Proposal: one word for tool output
(**suggestion**), one for the human decision (**verdict**), and fold "Analyser" into the automatic run (the run
already scans). Keep "Réanalyser" only as a secondary action for popins/tabs.

**U5 — The rate is the first number on the results screens, while 90 criteria are untested.** "30 %" in 32 px, then
"provisoire" in a small pill. A newcomer reads 30 %. Proposal on the page results and audit overview: lead with the
*work remaining* ("88 critères à relire, 24 suggestions à confirmer"), show the rate second and greyed while
provisional, and make it the headline only once nothing is pending. Codex proposed the same for the sample screen.

**U6 — Images theme counts a pre-filled "C" as compliant in the rate.** Image n° 3 (alt="") is pre-filled
*décorative → 1.2 C*; the page shows 1.2 = C (green) with the note "Repose sur un pré-remplissage automatique non
confirmé", the Excel grid writes **C**, and "3 conforme(s)" includes it. The checklist suggestions behave
differently (a suggested C stays **NT** until confirmed). The `AGENTS.md` invariant says tool results count as
"to review" until confirmed. **Decision for the owner:** either (a) count unconfirmed per-element C/NA as NT
(consistent, rates go down until the auditor clicks), or (b) keep today's behaviour and write "C (pré-rempli)"
in the grid so a reader of the Excel sees it. I recommend (a): the Excel is what gets forwarded.

**U7 — "Relire" is the default view but the first audit starts in "Contrôles".** After the automatic run I was
dropped in the Checks view (manual-check list first, then run history); the pre-filled verdicts to confirm are in
the themes, one view away. Proposal: after a run, land on the first theme with something to confirm, and keep the
run history as a collapsible card at the top of that theme.

**U8 — The manual checks are a flat list of 18 sentences with three buttons each**, far from the criteria they
feed, and nothing says how to actually do them (which keys, what to look for, what "OK" means). Proposal: group
them by theme tab (they are already tagged with criteria), add one line of *how* per check, and show the page tool
that helps ("Afficher l'ordre de tabulation") next to the check that needs it.

**U9 — Small things.** "Images 0/9" on the theme bubble vs "1 / 3" images in the header vs "0/106 critères"
(three counters of different natures side by side); the "Thématiques (13)" menu shows "analyse + relecture" for
some themes and "13 critères" for others without explaining the difference; the DevTools-height screen hides the
save pill's meaning (what is "Enregistré 11:16" vs "Pas de fichier"?); the sample screen asks for "Auditeur" and
"Contexte" but nothing uses them visibly before the export.

## 4. Does the app check the WAI-ARIA Authoring Practices patterns? (owner's question)

Short answer: **only the markup validity part, not the patterns themselves.**

- What exists today for RGAA theme 7 (scripts) and the ARIA components:
  - axe rules mapped to **7.1**: `aria-allowed-attr`, `aria-required-attr`, `aria-valid-attr`,
    `aria-valid-attr-value`, `aria-roles`, `aria-required-children`, `aria-required-parent`, `aria-hidden-focus`,
    `button-name`. These say whether the ARIA *vocabulary* is used correctly (a `tab` inside a `tablist`, a valid
    `aria-expanded` value), nothing about behaviour.
  - Two manual checks feed 7.1 and 7.5 (keyboard reach, status messages).
  - No own rule, no Asqatasun rule for 7.x (Asqatasun has none either).
- What the APG asks for, per pattern (tabs, dialog, menu, combobox, accordion, disclosure, slider, switch, tree,
  grid…): the expected **roles, states and properties** *and* the expected **keyboard interaction** (Arrow keys
  between tabs, Escape closes a dialog, Home/End…) *and* focus management. RGAA 4.1 test **7.1.3** refers to the
  APG explicitly for components. None of that is checked today, and the keyboard part cannot be checked by a
  script in general.
- What I propose (not started, owner's call): a **"Composants" element review**, built like Images and Links:
  1. The scan finds the widgets by role or by shape: `tablist`, `dialog`/`alertdialog`, `menu`/`menubar`,
     `combobox`, `listbox`, `tree`, `slider`, `switch`, `button[aria-expanded]` (disclosure/accordion),
     `[role=tooltip]`, custom `[role=checkbox|radio]`, plus native `<details>`/`<dialog>`.
  2. For each, the panel shows the APG checklist of that pattern: the structural items checked by the script
     (tabs have `aria-selected`, the panel is labelled by its tab, the dialog has `aria-modal` and a name, the menu
     items have the right roles…), and the keyboard items as manual checks with the exact keys to press, each
     mapped to 7.1 / 7.3 / 12.8 / 12.9.
  3. Verdicts per component feed 7.1 like images feed 1.1. The APG pages are linked from each card the way the
     official RGAA tests are.
  The APG is W3C material (W3C Document Licence): we would link to it and write our own checklist wording,
  not copy the pages.

## 5. Where I would start (priority order)

1. **U6** (decide how unconfirmed per-element C counts) — it changes the number the owner forwards.
2. **U1 + U5** (height budget, work-remaining first) — the two things a newcomer hits on every screen.
3. **U2 + U3** (one "next", visible remaining criteria per element) — the heart of the guided review.
4. **Components / APG review** (section 4) — new coverage, a few days of work, needs the owner's go.
5. U4, U7, U8, U9.

## 6. Evidence

Screenshots and the exported files of this walkthrough were kept in a temporary folder (not in the repository);
the walkthrough script was a throwaway Playwright spec (deleted). The fixed defects have tests:
`tests/axe-run.test.ts`, `tests/panel-review-state.test.ts`, the smoke assertion in `e2e/smoke.spec.ts`.
