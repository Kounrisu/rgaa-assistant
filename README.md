# RGAA Assistant

A browser extension (Manifest V3, TypeScript, Vite + `@crxjs/vite-plugin`) that adds an **RGAA Assistant** tab to
the DevTools. It helps an auditor run an **RGAA 4.1** audit on a sample of pages, in French or English: it finds and
numbers the elements on the page, runs automatic checks, offers visual aids for the manual checks, keeps the audits,
and produces an Excel grid and a printable report.

**It is an aid, not an automatic certification.** Automatic checks cover only part of the RGAA. What they find is
shown as pre-filled answers to confirm; a check that finds nothing never proves that a criterion is met. The auditor
confirms or changes every verdict.

## What it does

| Theme | How it is audited |
|---|---|
| 1 Images | Every image is listed and boxed on the page; informative / decorative, one verdict per criterion |
| 2 Frames | Every `iframe` / `frame`, with its title |
| 3 Colours | Text contrast findings (computed ratio, picker with magnifier for the unknown ones); 3.1 and 3.3 by hand |
| 5 Tables | Every table (data / layout), header cells and titles; criteria 5.3 to 5.8 per table |
| 6 Links | Every link (identical ones grouped), name, generic text, skip links |
| 9 Structure | Outline of headings and landmarks, skipped levels, missing `h1` / `main` |
| 7 Scripts (components) | Every ARIA component (tabs, dialog, menu, disclosure / accordion, combobox, listbox, slider, switch, radio group, tree, tooltip, custom button, toolbar): the structure of its [APG pattern](https://www.w3.org/WAI/ARIA/apg/patterns/) checked by script, the keyboard interaction as a checklist; 7.1 and 7.3 per component |
| 11 Forms | Every field with its accessible name, placeholder-only fields, autocomplete on personal fields |
| 4, 8, 10, 12, 13 and the other criteria | Checklists with the official tests, pre-filled where a check can say something |

**Automatic checks** (button “Contrôler automatiquement la page ouverte”): scans every scannable theme, then runs
[axe-core](https://github.com/dequelabs/axe-core) (only the rules that map to an RGAA criterion), our own RGAA
checks, rules adapted from [Asqatasun](https://github.com/Asqatasun/Asqatasun) (73 of its 99 RGAA 4 tests; 322 of
328 of its own test pages agree, see `npm run check:asqatasun`) and a local HTML validation (html-validate) of the
generated page source (RGAA 8.2). Failures become pre-filled non-compliant answers; criteria where nothing was found
are pre-filled compliant **to confirm**; themes that clearly do not apply are pre-filled not applicable.

**Manual checks and page tools**: 18 checks (keyboard, zoom, screen reader, content) per page, and page tools that
change what the page shows: hidden content, table structure (caption, scope, headers), tab order, styles off, text
spacing, language changes. The tools shown follow the theme you are in.

**Audits**: several named audits, saved in the browser (`chrome.storage.local`) as you work, and as a
`.rgaa.json` file you can reopen later. The file contains everything, including a gzipped copy of the HTML of the
captured pages: treat it as an internal working document.

**Exports**: an **.xlsx** grid laid out like the official RGAA audit grid (sheet texts are in French), and a
printable **HTML report** (summary, rates per theme and page, non-conformities with screenshots and notes, draft
accessibility statement). Print it to PDF from the browser.

## Use

1. Open DevTools (F12), select **RGAA Assistant**, and register the pages in **Échantillon et suivi**
   beside the audit name in the top bar. The editable pages table appears first, followed by the add-page form;
   audit settings, automatic batch controls and per-page progress follow below.
2. Open a registered page in the inspected browser tab. Use **Poursuivre l’évaluation** on its sample card.
   The page header groups the page selector, **Évaluation**, **Contrôles manuels** and **Résultats de la page**. Click
   **Contrôler automatiquement la page ouverte**. It scans the elements and runs the automatic engines;
   **Actions de la page → Analyser / Réanalyser** only refreshes the detected elements (useful for popins).
3. In **Évaluation**, answer each criterion and use **Suivant à évaluer** beside the decision to save and continue.
   Answering never advances automatically. Page progress stays visible; theme bubbles keep `done/total` counts.
4. Complete **Contrôles manuels** and inspect **Résultats de la page**. The sample dashboard tracks each page's
   human decisions, remaining decisions in selected themes, suggestions, manual activities and automatic run status.
5. For several pages, select their checkboxes in **Échantillon et suivi**, then **Contrôler les pages sélectionnées**.
   This navigates the existing inspected tab through the URLs using the browser session. Keep DevTools open.
   Pause after the current page and resume the remaining pages; failed pages retain their own error and can be
   selected for a retry. Redirects to another URL require correcting/opening that page first. Closing DevTools
   abandons the remaining queue; saved results remain, and an unfinished run is shown as interrupted.
6. Use **Synthèse et exports** in the audit header for the overall results, Excel grid and report.
   Completing automatic runs is never completion of the RGAA audit: dynamic states and manual checks still require the auditor.

## Limits

- Scans read the main document of the page. Content inside iframes and shadow roots may be left out; the scan
  coverage is reported with the results where the extension can tell.
- Closed shadow roots and cross-origin frames cannot be read.
- Contrast depends on computed styles: backgrounds made of images or gradients are reported as “to check by eye”.
- 26 Asqatasun tests are not ported (they need user-configured markers, contrast calculations or stylesheet
  contents); see `src/lib/asqatasun-rules.ts`.
- Rates are `C / (C + NC)` over the criteria that have been assessed: while some are still pending, they are
  provisional.
- The extension is developed and tested mainly on Firefox; it also builds for Chrome (Manifest V3).

## Develop

```bash
npm install
npm run dev          # Vite dev build
npm run build        # type-check + production build into dist/
npm test             # unit tests (Vitest, no network)
npm run check        # types, tests, translations, build (what CI runs)
npm run check:i18n   # every text has a French version
npm run test:e2e     # browser smoke test (Playwright + Chromium): needs `npm run build` first
npm run check:asqatasun   # run the ported rules on Asqatasun's own test pages (downloads them, pinned revision)
```

The smoke test (`e2e/`) opens the **built** panel and the **built** content script in two Chromium pages, with a
fixture site and a thin stub of the extension API in between, and runs scan, review, save, reload and export. First
run: `npx playwright install chromium`. It does not touch the network (`e2e/parity.spec.ts` also walks through every screen and compares a hash of each with `e2e/__snapshots__`), and it does not replace a manual check in a real
DevTools panel or in Firefox. The behavioral tests in `e2e/review-workflow.spec.ts` also verify that
review decisions fit at 480, 768 and 1280 pixels, that results work on image-free pages, and that keyboard verdicts
persist. They run the real automatic engines against an empty title and then a corrected title: evidence must
change while the human verdict and note survive the rerun. Tool disagreements remain visible until resolved.

The Evaluation button returns to the current theme. Page progress stays visible; display tools and page reset actions are expandable;
on compact panels the image list is expandable too. After an automatic run, use the review queue to open a
suggested criterion directly. Manual checks come before the collapsed run history.

Load `dist/` as an unpacked extension (`chrome://extensions` with Developer mode, or `about:debugging` in
Firefox), then reload the page you inspect after reloading the extension.

## Code layout

`src/lib/` holds what has no DOM (audit model, rules, results, import of other tools, report, Excel, French texts).
`src/content/` is the script injected in the inspected page (scans, overlay, picker). `src/panel/` is the DevTools panel;
`panel.ts` only starts things up, the rest is split by what it draws or does:

| Module | What lives there |
| --- | --- |
| `panel.ts` | Entry point: fills the `actions` registry, wires the events, creates the audit session, loads the audit. |
| `state.ts` | The one `state` object every module shares (audit, page, theme, view, filters, selection...). Data only. |
| `dom.ts` | The elements of `panel.html` looked up once (`dom.scanBtn`...), and `h()`, `$()`, `say()`, `keepScroll()`, `download()`. |
| `actions.ts` | The registry of upward calls: a module calls `actions.renderAll()` instead of importing a module above it (which would make a cycle). `panel.ts` lists the functions in `registry`. |
| `types.ts`, `helpers.ts` | Shared types; pure helpers (fingerprints, file names, slugs, `tDyn`, `formatHtml`). |
| `dialogs.ts` | In-panel confirm, text and choice questions (the browser popups are not shown in a DevTools panel). |
| `review-state.ts` | Status of an image or finding, list filters, colour code of the boxes (`boxStates`). |
| `page-bridge.ts` | Everything that talks to the inspected tab: typed `sendToPage`, boxes on the page, URL and title, previews. |
| `model.ts` | Page label, `pageInput` (input of the results), `loadPage`, `persist`. |
| `scan-merge.ts` | How a scan joins the known images (`mergeScan`) and findings (`mergeFindings`). |
| `images-view.ts` | Theme 1: list, filters, detail, kind and criteria cards. |
| `findings-view.ts`, `contrast-checker.ts`, `code-view.ts` | Themes 2, 3, 5, 6, 9, 11: list, chips, detail, cards; the contrast maths and checker card; highlighted code blocks. |
| `checklist-view.ts` | The checklist themes: one card per criterion. |
| `checks-view.ts`, `auto-checks.ts` | The Checks view; the automatic run (axe, RGAA rules, the Asqatasun-derived rules, HTML check). |
| `review-navigation.ts`, `review-controls.ts`, `page-work.ts`, `batch-runner.ts`, `batch-view.ts` | Save-and-continue queue, page work dashboard, sequential selected-URL runs. |
| `results-view.ts`, `audit-overview.ts`, `sample-view.ts`, `audits-view.ts`, `exports.ts` | Page results and sheet tables; audit dashboard; the sample of pages; the list of audits; Excel and HTML report. |
| `chrome.ts` | Totals and their jumps, page bar, theme bar, address reminder, audit bar, empty screen. |
| `router.ts` | `setView`, `renderAll`, `switchTo`, `removePage` and the resets. |
| `scan-flow.ts`, `events.ts` | The scan of the inspected page; every listener and the language switch. |
| `audit-session.ts`, `page-tools-ui.ts` | Saving and the audit lifecycle; the page tools toolbar. |

The panel modules have no import cycle: a module never imports one that depends on it, and calls it through `actions` instead. `tests/panel-*.test.ts`
cover the pure parts, and `e2e/parity.spec.ts` snapshots every screen of a seeded audit so a refactoring can prove the
panel did not change.

## Working on it (people and coding agents)

`AGENTS.md` has the rules and invariants for anyone who edits the code (including AI coding tools), and `docs/WORKLOG.md`
is the living status, backlog, open decisions and handoff log: read it first, update it last.

## License

Distributed under the **GNU Affero General Public License v3.0** (AGPL-3.0-only), see [LICENSE](LICENSE).
This is because the project includes rules adapted from [Asqatasun](https://github.com/Asqatasun/Asqatasun) (AGPL-3.0);
see [NOTICE.md](NOTICE.md) for what was adapted and how to remove it, and
[THIRD-PARTY.md](THIRD-PARTY.md) for every third-party component and its licence.
