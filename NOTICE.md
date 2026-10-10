# Notice

## Code adapted from Asqatasun

This project includes selectors and rule definitions adapted from
[Asqatasun](https://github.com/Asqatasun/Asqatasun) (formerly Tanaguru), an automated web accessibility
assessment tool, licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0).
Copyright (C) 2008-2020 Asqatasun.org and contributors.

What was adapted: the RGAA 4 automated tests of `rules/rules-rgaa4.0` and the CSS-like queries of
`rules/rules-commons` (`CssLikeQueryStore`), converted from Jsoup selectors to standard CSS selectors that
`document.querySelectorAll` understands, and re-worded in English (with a French translation). 33 of the 99 tests
that Asqatasun implements are ported; the others, with the reason, are listed at the bottom of
`src/lib/asqatasun-rules.ts`.

Because of this, the project as a whole is distributed under the AGPL-3.0 (see `LICENSE`).

The Asqatasun-derived code is kept in a few places only, each marked with
`Asqatasun-derived: begin` / `Asqatasun-derived: end`:

| File | What |
| --- | --- |
| `src/lib/asqatasun-rules.ts` | The whole file: the table of rules (selectors, verdicts, English wording). |
| `src/content/inject.ts` | The import at the top, the call `out.push(...runAsqatasunRules())` in `runRgaaRules()`, and the function `runAsqatasunRules()`. |
| `src/panel/panel.ts` | A type-only import, and one block at the end of `rulesToResults()`. |
| `src/lib/i18n-fr-lib.ts` | The French entries between the two markers (40 entries, all starting with `RGAA `). |

Not derived from Asqatasun, but made while porting: in `inject.ts`, our own `dir-invalid` check no longer accepts
`dir="auto"` (the official test 8.10.2 says `ltr` or `rtl`). It stays when the Asqatasun code is removed.

## How to remove it

1. Delete `src/lib/asqatasun-rules.ts`.
2. In `src/content/inject.ts`, delete the three blocks between `// --- Asqatasun-derived: begin ---` and
   `// --- Asqatasun-derived: end ---` (the import near the top, the call in `runRgaaRules()`, the function
   `runAsqatasunRules()`).
3. In `src/panel/panel.ts`, delete the two blocks between the same markers (the `import type` line and the loop at the end
   of `rulesToResults()`).
4. In `src/lib/i18n-fr-lib.ts`, delete the block between the same markers.
5. Run `npx tsc --noEmit` and `node scripts/check-i18n.mjs` (0 missing expected).
6. Delete this section of `NOTICE.md` (or the whole file), and change the licence in `LICENSE`, `package.json`
   (`"license"`) and `README.md` (License section).

Removing the code is a precondition to relicensing the project (for example to another licence than the AGPL-3.0);
whether to do it is the owner's decision. Search `Asqatasun` in the whole project (`grep -ri asqatasun src`) to check that
nothing is left: only the notes of the marked blocks and this file should mention it.
