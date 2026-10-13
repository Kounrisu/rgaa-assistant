# UX plan: a simpler, clearer, faster audit

Written 2026-10-13 by Claude Code, for the owner and for any agent that picks up a work package (Codex, Claude Code, others).
Read `AGENTS.md` first (invariants, commands, handoff). This file is a **plan, not an implementation**: nothing in it is built yet.

**Sources:** reading of `src/panel/panel.html`, `router.ts`, `chrome.ts`, `theme-todo.ts`, `findings-view.ts`; the earlier reviews
(`ux-review-newcomer-2026-10-11.md`, `ux-bars-review-2026-10-11.md`, WORKLOG handoffs); the owner's remarks in this project.
**Not done:** no new screenshots, no real Firefox/DevTools, no real auditor. Every "problem" below is a reading of the code and of the
earlier reviews. **First task of any agent: look at the built panel at 1280×520 and 480×800 before trusting a point.**

## 0. The goal in one sentence

An auditor opens the panel on a page and always knows **(1) where they are, (2) what the one next thing to do is, (3) how far
from the end they are**, and can do that next thing with one click or one key. Everything else is available but quiet.

## 1. Constraints (owner decisions already taken, do not reopen)

- Information starts **visible**: do not bring back collapsed-by-default sections. Reduce repetition and group instead of hiding.
- Page progress stays visible. Display tools stay visible (no collapse button).
- A pre-filled décorative → 1.2 C keeps counting as C (U6). Tool results stay suggestions (`AGENTS.md`).
- The Excel grid text stays French. English text is the i18n key; French goes in `src/lib/i18n-fr-<topic>.ts`.
- No new network call. No change of the saved format without migration + test.
- The parity baseline changes only after reading the diff (`PARITY_DUMP=/tmp/x.txt npm run test:e2e`).

## 2. What is in the way today (to verify with screenshots)

| # | Problem | Evidence |
| --- | --- | --- |
| P1 | **Too many bands before the content.** Audit bar, status line, page bar, page progress + 5 pills, theme bar, theme header + 5 pills + "Reste à faire" line, display tools, only then the element. At DevTools height (≈520 px) the first answer is below the fold. | `panel.html` order; newcomer review U1 (only partly fixed) |
| P2 | **The same progress is shown three times at three granularities** (page pills, theme pills, "Reste à faire" chips). The chips are the actionable one; the theme pills mostly repeat them. | `chrome.ts` `renderSummaries`, `theme-todo.ts` |
| P3 | **Four "next" buttons** with slightly different meanings: "À évaluer ensuite" (page), "Aller au suivant" (theme), "Continuer la relecture" (cards), "Critère à couverture partielle suivant". | `panel.html`, `theme-todo.ts`, `findings-view.ts` |
| P4 | **No path.** A newcomer sees 13 tabs and 106 criteria. The order "register pages → run automatic checks → confirm suggestions → manual checks → remaining → export" exists only in the first empty screen. | newcomer review §3 |
| P5 | **Vocabulary is not fixed (U4).** suggestion / pré-rempli / à confirmer / à relire / vérifier / en cours / couverture partielle are used for overlapping things. | newcomer review U4 (declined, still open) |
| P6 | **Answering is mouse-heavy.** 7 criteria per image, each with three radios; the only global shortcut is `n`. No "answer and go to the next" key. | `events.ts` (one keydown handler) |
| P7 | **No in-context help for the auditor's decision**: what C / NC / NA / NT mean, how to check a manual check, what a partial coverage is (explained only after clicking). | U8 fixed for manual checks only |
| P8 | **Status messages in one line at the top** (`#status`): easy to miss while scrolled down, replaced by the next message. | `panel.html` `#status` |
| P9 | **The tool is itself an accessibility tool** and must pass its own bar: focus order after re-render, 24×24 px targets, 200 % zoom, reduced motion, the DevTools dark theme. Only one `prefers-color-scheme` block exists; no explicit audit of the panel itself. | `panel.css` |
| P10 | **End of work is unclear**: a theme says "Thématique terminée", but the page and the audit have no equivalent ("Page terminée, passer à P02 / exporter ?"). | `theme-todo.ts` only |

## 3. Work packages

Each package is independent unless "after" says otherwise. Each one lists the files, the acceptance test and what to protect.
Do them **one per commit**, each with `npm run check` and, for the panel, `npm run test:e2e`.

### WP1 — One "next thing" (P3, P10)  · priority 1 · size M
**Idea:** one primary button, always the same place (next to the page progress), always the same verb: **« Suivant : <what> »**
with the target in the label (« Suivant : Images n° 3, critère 1.2 », « Suivant : Formulaires, 11.1 », « Suivant : contrôle manuel — clavier »).
The theme chips ("Reste à faire") remain the list view of the same queue. Remove the other "next" buttons or make them
secondary text links with the same wording.
**End states** (P10): when a theme is empty → « Thématique terminée — passer à <next theme with work> » ; when a page is empty →
« P01 terminée — passer à P02 » or « Tout est évalué — ouvrir le bilan et les exports ».
**Files:** `src/lib/review-queue.ts` (already the queue), `src/panel/chrome.ts`, `theme-todo.ts`, `findings-view.ts`, `panel.html`.
**Accept:** e2e: after the last open criterion of a theme the button names the next theme; after the last page it offers the export;
the label always names its target; keyboard shortcut `n` does the same thing. Update `summary-navigation` and `theme-completion` specs.
**Protect:** the queue rule (a failing image with unanswered criteria stays in the queue), focus lands on the target control.

### WP2 — A path, not a pile (P4)  · priority 1 · size M
**Idea:** a slim **stepper** under the audit bar, 6 steps, current one highlighted, each step clickable and showing its own state:
1 Échantillon (n pages) · 2 Contrôles automatiques (done / date / failed) · 3 Suggestions à confirmer (n) · 4 Contrôles manuels (n/18) ·
5 Critères restants (n) · 6 Bilan et exports (taux provisoire). The primary button of WP1 is simply "the current step's action".
It replaces nothing the owner asked to keep visible; it **replaces the long explanatory banners** and the first-screen steps list
(keep the first screen for an empty audit only). Steps are derived from existing state: no data-model change.
**Files:** new `src/panel/stepper.ts` (+ `dom.ts`, `panel.html`, `panel.css`, `i18n-fr-steps.ts`).
**Accept:** a new audit shows step 1 current; after adding a page, step 2; after the automatic run, step 3 with the count; at 0 left, step 6.
Works at 480 px (wraps to « Étape 3/6 — Suggestions à confirmer » only). Counted in the height budget of WP3.

### WP3 — A height budget (P1, P2)  · priority 1 · size L · after WP1, WP2
**Target:** at 1280×520 the first review control (a criterion radio, or the first chip) is visible **without scrolling**, with all
information still present. Method, without hiding what the owner wants to see:
1. **Merge the two summaries into one band**: page pills and theme pills side by side on wide panels, stacked only below ~640 px;
   page pills become a single line « P01 · 12/106 critères · 3 NC · 9 à relire · 70 non testés » (still clickable per number).
2. **Drop the theme pills' duplicates of the "Reste à faire" line**: keep the pills (owner wanted them) but put the todo line on the
   same row when there is room; show chips only for the first 6 and « + n autres » (opens the rest).
3. **Sticky condensed header on scroll** (P · Thématique · progress · Suivant) so a long image or grid never loses the bearings; the full
   bands scroll away. Nothing is hidden at load.
4. **Display tools on one row**; the « Autres outils » stays a menu.
**Files:** `panel.html`, `panel.css`, `chrome.ts`, `theme-todo.ts`, `router.ts`.
**Accept:** new e2e `height-budget.spec.ts` at 1280×520 and 480×800 asserts the first answer control's `boundingBox().y + height < viewport` for
the Images, a checklist theme (Éléments obligatoires) and Forms; screenshot attached to the PR; parity baseline updated after reading the diff.

### WP4 — Answer faster, with the keyboard (P6)  · priority 2 · size M
**Idea:** on any criterion with C / NC / NA radios, keys **c / n / a** set the verdict of the **focused** criterion card; **Enter** =
« Enregistrer et suivant » (the existing "continue reviewing" action); **Shift+Enter** = previous; **?** opens a short shortcut list.
Never advance on answering alone (existing rule). Add « Appliquer à toutes les images identiques » only if it is proven safe by a key
(same `src` + same alt) and always with a visible count and undo.
**Files:** `src/panel/events.ts`, `review-controls.ts`, `images-view.ts`, `findings-view.ts`, `checklist-view.ts`, `i18n-fr-keys.ts`.
**Accept:** e2e keyboard flow answering one theme without the mouse; shortcuts are announced (`aria-keyshortcuts`) and do not fire while
typing in a note, a select or a dialog. Document them on the « ? » panel and in README.
**Protect:** the panel is a DevTools panel: avoid keys the browser reserves; use no modifier-less shortcut inside text fields.

### WP5 — One vocabulary (P5, U4)  · priority 2 · size S–M
**Decision to make with the owner first** (proposal below). Then rename everywhere in one commit, with a lint test.

| Concept | Word to use (FR / EN) | Replaces |
| --- | --- | --- |
| What the tool proposes | **suggestion** / suggestion | pré-rempli, pré-remplissage, proposition |
| Auditor says yes to a suggestion | **confirmer** / confirm | valider, accepter |
| Needs the auditor to look at it | **à vérifier** / to check | à relire, à confirmer, à évaluer (the three mixed) |
| Nothing was looked at | **non testé** / not tested | NT, non évalué |
| Tool could check only some tests | **couverture partielle** (keep) + one line on hover | — |
Add `tests/vocabulary.test.ts`: forbidden words in `src/lib/i18n-fr*.ts` values (a short list), so the drift cannot return.
Also: the Excel text must not change (grid is French and official).

### WP6 — Help where the decision is made (P7)  · priority 2 · size M
- **C / NC / NA / NT legend** as an `aria-describedby` tooltip-free line under the first card of each theme (one sentence each), dismissible.
- **« Comment vérifier »** (one to three lines, the page tool that helps, the keys to press) on each **criterion card**, drawn from
  `src/lib/rgaa.ts` test texts plus a hand-written `how` field like `manual-checks.ts` already has; start with the 20 most frequent criteria
  (1.1, 1.2, 1.3, 3.2, 3.3, 6.1, 6.2, 8.2, 8.5, 9.1, 9.3, 10.4, 11.1, 11.2, 11.5, 11.10, 12.6, 12.8, 12.10, 13.1).
- **Partial coverage** card says first « L'outil a vérifié X des Y tests » then what to check by hand (today it says it after the click).
**Files:** `src/lib/rgaa-how.ts` (new data), `checklist-view.ts`, `findings-view.ts`, `images-view.ts`, `i18n-fr-how.ts`.
**Accept:** unit test that every id in `rgaa-how.ts` exists in `rgaa-tests.json`; e2e that the line is present on a criterion card and not announced twice.

### WP7 — Messages you cannot miss (P8)  · priority 2 · size S
Replace the single `#status` line by a **toast region at the bottom** (polite live region, 6 s, pause on hover/focus, never covering the
next-button), with a « Dernière action » history of 20 messages in the audit bar's menu. Errors persist until dismissed and offer the retry
(`scan-flow.ts` and `auto-checks.ts` already know the failure). Keep `say()` as the only call (`dom.ts`): no call site changes.
**Accept:** e2e that a scan failure shows a persistent, focusable error with « Réessayer ».

### WP8 — The panel passes its own audit (P9)  · priority 2 · size M
Run axe on the built panel (the e2e rig already has axe) in each view and fix, then add it as a test. Plus: visible focus in every state,
24×24 px minimum targets for pills and radios, reflow at 320 px, 200 % text zoom without loss, `prefers-reduced-motion`, forced-colors
mode, the DevTools **dark** theme (extend the existing `prefers-color-scheme` block to every component added since: boxes, todo chips,
partial cards, NA rows, audit styles menu), and a check that focus returns to a sensible element after every re-render (`renderAll`).
**Files:** `panel.css`, `e2e/panel-a11y.spec.ts` (new), small fixes across `src/panel/*`.
**Accept:** zero axe violations on the panel views in the e2e; contrast of every pill/chip pair ≥ 4.5:1 in light and dark.

### WP9 — Review a whole page in one pass (new, optional)  · priority 3 · size L
A **« Mode parcours »**: from the stepper (WP2) « Commencer la relecture » walks the queue across themes full-screen: criterion text and
test, evidence (markup/screenshot), verdict keys, note, « Suivant ». Exit returns to the normal view. It is WP1 + WP4 presented as a wizard,
useful for long audits and for new auditors. Build only after WP1–WP4 are in and used.

### WP10 — Small polish (collect, do in one commit)
- Counters of different kinds (images 6/9, criteria 12/106, elements 3) always carry their unit in the visible label (U9).
- The « Thématiques (13) » menu explains « analyse + relecture » vs « 13 critères » in one line (U9).
- The save pill says what it means: « Enregistré dans le navigateur · pas encore dans un fichier » (U9) with the date of the last file save.
- « Auditeur » and « Contexte » appear on the export preview so the fields are seen to be used (U9).
- After a scan, land on the first theme with something to confirm, not on the checks list (U7, verify it still holds).
- Image review header: « 3 / 7 critères répondus — suivant : 1.3 » (U3 done; keep it inside WP3's height budget).

## 4. Suggested order

1. Screenshots of today's panel at 1280×520 and 480×800 in each view (kept in `docs/ux-baseline/`): the "before".
2. WP5 vocabulary **decision** (owner), then WP1 → WP2 → WP3 (the structural trio; they share files, do them in order on one branch).
3. WP4, WP6, WP7 can run in parallel by different agents (disjoint files, except the shared i18n wiring: one file each).
4. WP8 last before a real-Firefox pass, because it checks everything built before it.
5. WP9 only if the owner wants a guided mode.

## 5. How to split between agents

- **One branch per package** (`ux/wp1-next`, …), merged to `master` when `npm run check` and `npm run test:e2e` pass; never two agents in
  `panel.html`/`panel.css` at the same time (WP1–3 touch both). Claim the package in the WORKLOG « In progress » with the files.
- Each package ends with: updated parity baseline (diff read), updated WORKLOG handoff, screenshots of before/after at 1280×520 and 480×800,
  and what was **not** tested (real Firefox).
- Do not change verdict/rate/export logic in any UX package. If a package seems to need it, stop and ask.

## 6. Decisions for the owner

1. **Vocabulary (WP5):** accept the table, or give your own words. (Biggest effect for the least code.)
2. **Stepper (WP2):** always visible, or only until the first automatic run is done?
3. **Keyboard shortcuts (WP4):** plain letters (c / n / a) acceptable in a DevTools panel, or a modifier (Alt+C…)?
4. **Mode parcours (WP9):** wanted or not.
5. **Order of the first three packages**, if you prefer to start with the visible clean-up (WP3) before the path (WP2).

## 7. Definition of done for the whole effort

On a real site in real Firefox, a newcomer reaches the Excel without asking what to click; at DevTools height the first answer is visible
on load; the same word means the same thing everywhere; the panel passes axe; an experienced auditor does a theme without the mouse.
Measure it: time to first answered criterion, number of clicks to finish the Images theme on the fixture, number of scrolls needed in
a 520 px panel. Record the numbers before and after in the WORKLOG.
