# Third-party code and data: what is in this project, and what can go

This file is the inventory to read when deciding later what to keep. Each entry says where it comes from, its licence,
where it is used, what it obliges us to do, and how to remove it.

Licences below were read from the packages or repositories on 2026-10-10. Nothing here is legal advice.

## In the shipped extension

| Component | Licence | Where | What we use | Obligation in short | Remove by |
|---|---|---|---|---|---|
| **axe-core** 4.14 (Deque) — https://github.com/dequelabs/axe-core | MPL-2.0 | `dist/axe.min.js` (copied from `node_modules` at build by `vite.config.ts`, injected into the page by `src/background.ts` only on click); French rule texts `axe-core/locales/fr.json` imported in `src/panel/panel.ts` | The engine, run as a library, **with a small patch** applied at build time by `scripts/patch-axe.mjs` (it removes every `Function()`/`eval` call so axe runs on pages with a strict Content-Security-Policy, which Firefox applies to content scripts) | Keep the licence text (`dist/axe.LICENSE`). MPL-2.0 is file-level: the patched axe file is a modified MPL file, so its modifications must stay available: they are the replacements listed in `scripts/patch-axe.mjs`, public in this repository. Our own code stays under our licence | `npm uninstall axe-core esbuild`; delete `scripts/patch-axe.mjs`; delete the `RGAA_AXE` handler in `src/background.ts`, `src/content/axe-run.ts` and its message case in `src/content/inject.ts`, `src/lib/axe-import.ts` mapping of axe rules (`AXE_TO_RGAA`) and the axe call in `runAutoChecks` (`src/panel/panel.ts`); remove the `patchedAxe` import and the two lines writing `dist/axe.min.js` and `dist/axe.LICENSE` in `vite.config.ts` |
| **html-validate** — https://github.com/html-validate/html-validate | MIT | `src/lib/html-check.ts` (loaded on demand by the panel) | Validates the captured HTML locally (RGAA 8.2); nothing is sent anywhere | Keep the MIT notice | `npm uninstall html-validate`; delete `src/lib/html-check.ts`, the HTML card and `captureAndCheckHtml` / `validateSnapshot` in `src/panel/panel.ts` |
| **fflate** — https://github.com/101arrowz/fflate | MIT | `src/lib/xlsx.ts` (zip for the .xlsx export) | Zip compression | Keep the MIT notice | Replace the zip step in `xlsx.ts` |
| **Asqatasun** (formerly Tanaguru) — https://github.com/Asqatasun/Asqatasun | AGPL-3.0 | `src/lib/asqatasun-rules.ts` (73 of its 99 implemented RGAA 4 tests: 53 selector rows and 20 tests with their own logic) and `src/lib/asqatasun-nomenclatures.ts` (its word lists), `scripts/check-asqatasun.mjs`, plus the blocks marked `Asqatasun-derived` in `src/content/rgaa-rules-run.ts` and `src/panel/panel.ts`, and their French texts in `src/lib/i18n-fr-lib.ts`. Details, the own checks it replaced, and exact removal steps: `NOTICE.md` | Tests, selectors, checkers and word lists adapted from its RGAA 4 tests and its `rules-commons` library; its HTML fixtures are used (downloaded on demand into a temporary folder, not stored here) to check the port | The whole project is then distributed under **AGPL-3.0**: whoever gets the extension must be able to get its source. No obligation for private use | See "How to remove it" in `NOTICE.md`. Removing the code does not by itself change the licence the project was published under; that is a separate decision |

## Build and development only (not shipped)

| Component | Licence | Use |
|---|---|---|
| Vite | MIT | Bundler |
| esbuild | MIT | Minifies the patched axe at build time |
| @crxjs/vite-plugin | MIT | Builds the browser extension |
| TypeScript | Apache-2.0 | Type checking |
| jsdom | MIT | Runs the ported Asqatasun tests on Asqatasun's own fixtures (`scripts/check-asqatasun.mjs`); not used by the extension |
| @types/chrome | MIT | Types for the extension API |

## Data and references

| Item | Source | Licence | Where | Note |
|---|---|---|---|---|
| RGAA 4.1 criteria and tests (official French wording) | https://github.com/DISIC/accessibilite.numerique.gouv.fr (`RGAA/4.1/criteres.json`) | **Not confirmed**: the repository does not declare one in its metadata. It is public French government material; check the terms on the DINUM site before redistributing | `src/rgaa/rgaa-tests.json`, `src/lib/rgaa-theme1.json`, `scripts/classify-rgaa.py` | The automation classification (auto / semi / manual) and the notes in that file are ours |
| RGAA official links | https://accessibilite.numerique.gouv.fr/methode/criteres-et-tests/ | n/a | Links only | Nothing copied |

## Written by us (no third-party code)

- The mapping from axe rules to RGAA criteria (`AXE_TO_RGAA` in `src/lib/axe-import.ts`).
- Our own RGAA checks in `src/content/rgaa-rules-run.ts` (`runRgaaRules`) and their wording in `src/lib/rgaa-rules.ts`, written from the official test wording.
- Manual checks (`src/lib/manual-checks.ts`), the contrast checker and picker, the audit store and file format, the Excel export layout, and the French and English texts.
- The Excel grid follows the structure of the official audit grid by design; no file from it is included.

## Things to review later

1. **Licence of the project.** AGPL-3.0 (`LICENSE`, `package.json`) because of the Asqatasun port; decide whether to keep it. Removing the Asqatasun code is the precondition for relicensing.
2. **RGAA data licence**: confirm the terms of the official data (see above).
3. **Rules from Asqatasun worth keeping**: keep the ones that find real problems on your sites; drop the rest. Each rule is one line (or one function) in `src/lib/asqatasun-rules.ts`. Asqatasun's versions replaced our own checks for the doctype, the presentation tags and attributes, the reading direction, the office documents and the media (list in `NOTICE.md`).
4. **axe-core updates**: pin or upgrade deliberately (`npm update axe-core`), then re-check the rule mapping.
5. **Other accessibility tools** (ARC Toolkit, WAVE, Accessibility Insights…): none of their code is in this project. If one is added later, add a row here first.
