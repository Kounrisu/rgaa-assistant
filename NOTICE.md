# Notice

## Code adapted from Asqatasun

This project includes tests, selectors, checkers and word lists adapted from
[Asqatasun](https://github.com/Asqatasun/Asqatasun) (formerly Tanaguru), an automated web accessibility
assessment tool, licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0).
Copyright (C) 2008-2020 Asqatasun.org and contributors.

What was adapted: the RGAA 4 automated tests of `rules/rules-rgaa4.0`, the checkers and selectors they use in
`rules/rules-commons` (`CssLikeQueryStore`, the doctype, language, text-pertinence and downloadable-link checkers, the
media detection rules, the text builders) and the word lists of `engine/asqatasun-persistence` (deprecated tags and
attributes, valid doctypes, ISO language codes, office document extensions, unexplicit titles, link text blacklist).
They were converted from Java and Jsoup selectors to TypeScript and to standard CSS selectors that
`document.querySelectorAll` understands, and re-worded in English (with a French translation).

**73 of the 99 tests that Asqatasun implements are ported** (53 selector rows and 20 tests with their own logic); the 26
others, and the reason why, are listed at the bottom of `src/lib/asqatasun-rules.ts`: the images that depend on markers
set by the Asqatasun user (19), the colour contrast (4), the tables that depend on markers (2), the CSS files (1).
Ported by theme: images 6, frames 2, colours 2, multimedia 24, links 3, scripts 1, mandatory elements 8, structure 2,
presentation 8, forms 12, consultation 5.

Because of this, the project as a whole is distributed under the AGPL-3.0 (see `LICENSE`).

### How the port is checked

Asqatasun ships, for each test, HTML pages whose file name says the expected outcome (`…-1Passed-01.html`,
`-2Failed-`, `-3NMI-` = need more info, `-4NA-` = not applicable), and Java test classes that say which of them are
asserted. `scripts/check-asqatasun.mjs` runs the ported tests (the same code as in the extension, in jsdom) on every
asserted page and prints, per test, how many pages agree with the expected outcome:

```
node scripts/check-asqatasun.mjs              # downloads the pages (about 1000 small files) into the temporary folder, then checks
node scripts/check-asqatasun.mjs --list       # every test, not only the ones with a mismatch
node scripts/check-asqatasun.mjs --counts     # also the number of elements reported, against the number Asqatasun's test expects
node scripts/check-asqatasun.mjs --rule 080101 --dir /some/folder --refresh --strict
```

The pages are Asqatasun's (AGPL-3.0): they are downloaded on demand into the operating system's temporary folder, never into
this repository. `jsdom` (a development dependency, MIT) is only used by this script.
Last run: 322 of 328 pages agree (98.2%). The 6 that do not: 8.4.1 (the language of the text is not detected, see the
bottom of `asqatasun-rules.ts`) and 8.1.2 (the case of the doctype keywords is not kept by the DOM).

### Where the derived code is

The Asqatasun-derived code is kept in a few places only, each marked with
`Asqatasun-derived: begin` / `Asqatasun-derived: end` when it is part of a file that is not derived as a whole:

| File | What |
| --- | --- |
| `src/lib/asqatasun-rules.ts` | The whole file: the tests, their selectors and verdicts, their English wording, and the evaluation `evaluateAsqRules()`. |
| `src/lib/asqatasun-nomenclatures.ts` | The whole file: the word lists. |
| `scripts/check-asqatasun.mjs` | The whole file: the check against Asqatasun's fixtures. |
| `src/content/rgaa-rules-run.ts` | The import at the top, the call `out.push(...runAsqatasunRules())` in `runRgaaRules()`, and the function `runAsqatasunRules()` (which only calls `evaluateAsqRules`). |
| `src/panel/auto-checks.ts` | A type-only import, and one block at the end of `rulesToResults()` (notes, "not applicable", and the criteria where every ported test passed). |
| `tests/panel-auto-checks.test.ts` | The test between the two markers (it tests the block of `rulesToResults()` above). |
| `src/lib/i18n-fr-lib.ts` | The French entries between the two markers (all starting with `RGAA `). |
| `package.json`, `package-lock.json` | The `jsdom` development dependency and the `check:asqatasun` script. |

### Our own checks that Asqatasun's replaced

Where Asqatasun has the same test, its version replaced ours, because it has been tested upstream and agrees with its
fixtures. The checks removed from `runRgaaRules()` (`src/content/rgaa-rules-run.ts`) and `RULES` (`src/lib/rgaa-rules.ts`):

| Our former check | Replaced by | Difference |
| --- | --- | --- |
| `doctype` (8.1) | 8.1.1 and 8.1.2 | The doctype is compared with Asqatasun's list; we no longer test the quirks mode. |
| `presentation-tags` (10.1) | 10.1.1 | Same tags. |
| `presentation-attrs` (10.1) | 10.1.2 | Asqatasun's list of attributes (it has `char`, `charoff`, `size`; we had `face`, `noshade`, `nowrap`, `scrolling`) and `width` / `height` on elements other than img, svg, object, embed, canvas. |
| `dir-invalid` (8.10) | 8.10.2 | Same rule (ltr or rtl), plus the review of the valid values. |
| `downloads` (13.3, 13.4) | 13.3.1 and 13.4.1 | Longer list of extensions (csv, docm, xlsm…) and a note when links have no recognised file name. |
| `media-found` (theme 4) | 4.1.1 to 4.13.2 | One note per test instead of one for the theme. `no-media` now only covers 4.10, which Asqatasun does not test. |

The former versions are in the repository history (last commit before this port: `7b5b398`).
**Removing the Asqatasun code removes these checks too**: restore them from that commit (functions in `runRgaaRules()` and
rows in `RULES`) if they are still wanted.

## How to remove it

1. Delete `src/lib/asqatasun-rules.ts`, `src/lib/asqatasun-nomenclatures.ts` and `scripts/check-asqatasun.mjs`.
2. In `src/content/rgaa-rules-run.ts`, delete the three blocks between `// --- Asqatasun-derived: begin ---` and
   `// --- Asqatasun-derived: end ---` (the import near the top, the call in `runRgaaRules()`, the function
   `runAsqatasunRules()`).
3. In `src/panel/auto-checks.ts`, delete the blocks between the same markers (the `import type` line, the loop in
   `rulesToResults()`, the `const asq: ToolResults = …` line, and the `const asqReport = …` line in `runAutoChecks()`),
   then remove the `asq` property of the return type and value of `rulesToResults()`, the `split.asq` use, and the
   `asqReport.set` and `asqReport.noted` terms of the message in `runAutoChecks()`. Delete the test between the same
   markers in `tests/panel-auto-checks.test.ts`.
4. In `src/lib/i18n-fr-lib.ts`, delete the block between the same markers.
5. `npm uninstall jsdom` and delete the `check:asqatasun` script of `package.json`.
6. Restore the own checks listed above if they are wanted (see the commit above).
7. Run `npx tsc --noEmit` and `node scripts/check-i18n.mjs` (0 missing expected).
8. Delete this section of `NOTICE.md` (or the whole file), and change the licence in `LICENSE`, `package.json`
   (`"license"`) and `README.md` (License section).

Removing the code is a precondition to relicensing the project (for example to another licence than the AGPL-3.0);
whether to do it is the owner's decision. Search `Asqatasun` in the whole project (`grep -ri asqatasun src scripts`) to check
that nothing is left: only the notes of the marked blocks and this file should mention it.

- 10.1.2 (width/height): `iframe`, `video`, `input` and `source` are also left out, because HTML5 allows these attributes on them; Asqatasun reports them. The fixtures still agree (see `npm run check:asqatasun`).
