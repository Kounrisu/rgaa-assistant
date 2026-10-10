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
| 11 Forms | Every field with its accessible name, placeholder-only fields, autocomplete on personal fields |
| 4, 7, 8, 10, 12, 13 and the other criteria | Checklists with the official tests, pre-filled where a check can say something |

**Automatic checks** (button “Contrôles automatiques”): scans every scannable theme, then runs
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

1. Open DevTools (F12) on a page, select the **RGAA Assistant** tab, and add the page to the sample (P01, P02…).
2. Click **Contrôles automatiques**, or **Analyser** to scan only; then review each theme. Boxes on the page show
   the elements; pre-filled answers carry the tool that suggested them.
3. Do the manual checks, using the page tools of each theme.
4. Open **Synthèse de l’audit** for the dashboard, the Excel export and the report.

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
npm run check:asqatasun   # run the ported rules on Asqatasun's own test pages (downloads them, pinned revision)
```

Load `dist/` as an unpacked extension (`chrome://extensions` with Developer mode, or `about:debugging` in
Firefox), then reload the page you inspect after reloading the extension.

## License

Distributed under the **GNU Affero General Public License v3.0** (AGPL-3.0-only), see [LICENSE](LICENSE).
This is because the project includes rules adapted from [Asqatasun](https://github.com/Asqatasun/Asqatasun) (AGPL-3.0);
see [NOTICE.md](NOTICE.md) for what was adapted and how to remove it, and
[THIRD-PARTY.md](THIRD-PARTY.md) for every third-party component and its licence.
