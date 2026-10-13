# Worklog: where the project stands, and the handoff between agents

Read this first, update it last. Rules for agents are in `../AGENTS.md`.

## Current state (2026-10-11)

- Branch `codex/toolbar-clarity`, based on `master` at `86767a5` (Claude's latest application work: `f7d2c5a`).
  Version 0.1.0; saved audit format **v4**, licence AGPL-3.0-only. No saved-data changes in the toolbar work.
- **Approved toolbar hierarchy implemented (`25afd1e`):** visible Audit / Page auditée / Bilan de la page / Thématiques RGAA /
  Bilan de la thématique / Outils d’affichage labels. Display and highlight controls share a non-collapsible area
  below the theme navigation and summary. One shared theme header replaces repeated headers inside each view.
- **Actions in their context:** the Actions de la page dropdown is removed. Repérer / Actualiser les éléments and
  automatic checks are direct page actions; Suivant à évaluer sits beside the page summary. Page reset/removal stay
  in the sample table, theme reset beside its heading, and the local coverage reference in the top audit bar (available in every view).
  Évaluer la page stays in the audit header as a direct return; page modes stay beside the selected-page control.
- **Consistent counter scope:** page summary covers all 106 criteria like its meter; theme summary covers that theme.
  Unselected themes count as untested, with direct results-row navigation that preserves selected themes. Partial
  positive/NA results remain to review in these shortcuts, rather than disappearing from the five-status breakdown;
  saved verdicts/rates are unchanged. Coverage/confirmation qualifications sit separately under À vérifier.
  Image inventory and pre-filled-image counts live beside the image list, separate from criterion counters.
- **Information remains visible initially:** image list, audit settings, batch controls, suggestions, automatic run
  history and coverage start expanded; user collapse choices survive rerenders during the session. Display tools,
  highlighting and theme summary are now always visible during evaluation. Theme-selection menus retain their behavior.
- **Page-work dashboard:** progress, pending decisions in selected themes, suggested criteria, manual activity counts,
  last activity and latest automatic run outcome per page, with direct evaluation/manual/results/open actions.
  The original editable pages table now appears first in Échantillon et suivi, followed by the add-page form;
  metadata settings, batch controls and progress cards follow below. The duplicate automatic-run button is removed.
  Element-only scanning is a direct secondary action; the primary automatic action targets the open registered page.
- **Continue reviewing:** a common explicit save-and-next queue beside image, finding and checklist decisions, with
  keyboard focus, continuation across themes and wraparound. Answering alone never advances. Empty queues explicitly
  remind the auditor about unscanned themes/manual work. Existing verdict/rate/export rules are preserved.
- **Selected-URL runs:** selected pages run sequentially in the inspected tab and browser session; pause after the current
  page, resume remaining pages, per-page failures and retry by selection. An already open URL keeps its dynamic state.
  Status/date/error persist; older audits do not invent complete run status. Closing DevTools loses the remaining queue;
  any saved running status is displayed as interrupted. A changed URL requires another run.
- **Image numbers on rescan (`7bd2e60`):** exclude assistant overlays from captured image context; retain the number and
  review key of a unique unchanged image when surrounding HTML changes. Newly found images receive new numbers.
  Ambiguous matches/changed markup are not guessed; historical duplicate records are not merged or deleted.
- **Overlay numbering follow-up (`5f1b1be`):** internal DOM IDs no longer change when audit numbers are assigned.
  A hidden image returning after relabeling cannot collide with another image’s internal ID. Owner reports numbering
  still off after the previous fix; this second defect is reproduced, but the exact real-site symptom is unconfirmed.
- Latest `npm run check`: **192 tests**, typecheck, **710 texts / 1245 French entries / 0 missing**, build pass.
  Latest full `npm run test:e2e`: **23 passed**, including the reviewed **80-screen** parity baseline, 480/768/1280 layouts,
  sequential runs/pause/resume, engine failure/retry, source-URL isolation and keyboard continuation. Built content script:
  **0 module imports**. Real Firefox/DevTools still untested.
- **Components review (theme 7, APG patterns)** shipped: every ARIA component (tabs, dialog, menu, disclosure / accordion,
  details, combobox, listbox, slider, spinbutton, switch, checkbox, radio group, tree, tooltip, custom button, toolbar) is a
  finding with the structural checks of its WAI-ARIA Authoring Practices pattern run by the script (7.1, pre-filled NC when
  one fails) and the keyboard interaction as a checklist for the auditor (7.3). `src/content/scan-components.ts`,
  `src/lib/apg-patterns.ts`, `src/panel/apg-view.ts`, `src/lib/i18n-fr-apg.ts`. 7.2, 7.4, 7.5 stay in the checklist.
- **Owner decision (U6 of the newcomer review):** a pre-filled *décorative → 1.2 C* keeps counting as **C** in the rate and
  the Excel (alt="" is a strong signal); checklist suggestions keep counting as NT until confirmed. No change made.
- **Newcomer UX review** (Claude Code, `docs/ux-review-newcomer-2026-10-11.md`): three defects fixed in `e600848`
  (axe reported our own overlay as a 12.6 failure of the page; stale "URL not in the sample" banner after adding
  P01; English labels in the French Excel detail sheets), nine UX proposals, one decision for the owner (how an
  unconfirmed pre-filled C counts in the rate), and an answer to "does the app check the WAI-ARIA APG patterns?"
  (markup validity only, through axe; a "Composants" element review is proposed).
- UX audit of `347f289` (Codex, below): audit/page scope is mixed and the overview prioritizes compliance charts over work
  remaining; redesign proposed there and now implemented on `codex/audit-workflow`. The queue defect it reproduced (an image left the review
  queue after one NC answer despite unanswered criteria; pre-filled images were not in the queue either) is **fixed** in
  `src/panel/review-state.ts` with a regression test. Checks at that time: `npm run check`: 171 unit tests, 656 texts / 1000 French entries /
  0 missing, typecheck and build pass; `npm run test:e2e` 9 passed (parity baseline updated for the Images screens, see handoff).
- Checks for `02e485c`: `npm run check` passes (typecheck, 165 unit tests, translations 655 texts / 999 French entries / 0 missing,
  build); `npm run test:e2e` passes (9 browser tests: smoke, parity of 77 screens, review workflow at 480/768/1280 px,
  automatic evidence and persistence, three status-navigation regressions). Built content script has 0 module imports.
- Last recorded `npm run check:asqatasun`: 322 of 328 of Asqatasun's own test pages agree (73 of its 99 implemented tests ported); not rerun for this UI-only change.
- Page progress and status counts stay visible below the page controls. Nonzero status counts open a matching element,
  criterion or detailed results row and move keyboard focus; zero counts are disabled. Theme bubbles retain compact `done/total` counts.
- **Not yet verified in a real Firefox or in a real DevTools panel.** Everything above runs on stand-ins for the extension APIs.
  The first GitHub Actions run of `.github/workflows/ci.yml` has not been looked at.

## What exists

- **Review by element** (boxes on the page, one verdict per criterion): Images (1), Frames (2), Colours (3.2, with a
  magnifier colour picker), Tables (5), Links (6), Structure (9: headings and landmarks), Forms (11). Other themes: checklists.
- **Automatic checks** (one button): scan of all scannable themes, then axe-core (mapped rules only), own RGAA checks,
  Asqatasun-derived rules, local HTML validation (html-validate). Results are **suggestions** to confirm, with conflicts
  between tools shown. **Manual checks** (18) and **page tools** (hidden content, table structure, tab order, styles off,
  text spacing, languages), contextual to the theme.
- **Audits**: several named audits in the browser, save to / open from a `.rgaa.json` file (validated, size-bounded),
  saves through a background queue with retry. **Exports**: Excel grid (French), printable HTML report with a draft
  accessibility statement. French and English interface (French default).
- **Honesty about coverage**: rates are *provisional* while incomplete; a scan-coverage card says what was not scanned
  (iframes, shadow roots, truncation limits).
- **Quality net**: Vitest unit tests (no network), Playwright browser tests on the built panel and content script,
  golden parity tests for the content script (jsdom), parity hashes per panel screen, pinned Asqatasun fixtures, CI.
- Third parties and how to remove them: `THIRD-PARTY.md`, `NOTICE.md`. IT/legal notes: `docs/it-legal-review.en.md`, `docs/revue-it-juridique.fr.md` (they say “no data leaves the machine”: keep that true or update them).

## In progress (claimed)

- None. Second numbering defect fixed in `5f1b1be`; owner’s exact visible symptom still needs confirmation.

## Next (suggested order; the owner decides)

The corrected audit/page navigation, dashboard, explicit next-review controls and selected-page runs are implemented.
Next verify the actual extension in Firefox/DevTools and collect feedback on a real audit, especially the top-header
return from Échantillon et suivi and the initially expanded sections (collapse them, answer, navigate away and back).
Keep page progress visible and preserve the owner's decorative-image counting decision.
Toolbar follow-up: check the new labels, full-page status links and visible display tools in real Firefox/DevTools;
preserve Claude’s scan, preview and manual-help changes. Also confirm image numbers/answers survive rescans on the owner’s real site.

1. **Real Firefox test pass** by the owner: reload the extension, F5 on a real page, “Contrôler automatiquement la page ouverte”; report crashes (which step, which page), the save pill, the unsaved-work dialog, the layout. In narrow DevTools, check that page progress stays visible and each nonzero status count opens the expected item, including keyboard activation and focus; check French and English.
2. **Per-test results** (as Asqatasun stores them: pass / fail / need more info / not applicable per test, with the elements). Needs a data-model addition + migration; also lets the auditor confirm the Images tests the tool cannot assess (image maps, CAPTCHAs), which today leave criteria “partly covered”.
3. **Port more Asqatasun tests** (26 left: marker-based image and table tests, contrast, stylesheet test 10.4.1 — the background page could fetch stylesheets across origins).
4. **Scan inside same-origin iframes and open shadow roots** (today only reported in the coverage card; overlay, positions, snapshot and screenshots assume one document).
5. **Batch follow-up**, if wanted: persist/resume the remaining queue across DevTools closures; test real redirects, login pages and extension permissions. Then rates per test/criterion and comparison of two audits.
6. Smaller: keyboard shortcuts to confirm/reject a suggestion; consistency of navigation/titles across the sample (RGAA 12.x); `npm audit` reports 5 issues in dev tooling only (vitest, vite's esbuild, tinypool): fix by upgrading Vite/Vitest when convenient.

## Open decisions (owner)

- **AI**: access (copy-paste / cloud API with own key / local model / company endpoint), first tasks, what may be sent — all undecided. Principles agreed for any design: suggestions only (never a verdict), opt-in, payload shown before any call, minimal data (no cookies, no full pages, nothing from logged-in sessions), traceable (model, prompt version, date), provider-neutral, measured against the owner's own past audits before being trusted. Safe order if approved: provider interface + copy-paste mode + payload preview + stored AI suggestions; relevance judgements from text; explain-and-fix and report drafting; optional API/local; images last with consent.
- **Stylus sheets**: provided by the owner and integrated (see the 2026-10-13 handoff): applied from the panel or only named for Stylus users.
  Updating them: the app's copy (`src/lib/audit-styles-data.ts`) does not follow Stylus; send the changed sheet or a new Stylus export to be pasted there (instructions in the file header). If it happens often, add an "Importer un fichier Stylus" button.
- **Project licence**: AGPL-3.0 now; removing the Asqatasun-derived code is the precondition for relicensing (`NOTICE.md`).
- **RGAA data licence** (DINUM): terms to confirm before redistributing. **Ownership/employment** of the tool if used at Banque de France: for the owner to check.

## Known limits and small issues

- Scans read the main document; content in iframes / shadow roots can be missed (reported, not scanned). Closed shadow roots and cross-origin frames cannot be read.
- `RGAA_AXE_RUN` without a `rules` list would run every axe rule (the panel always sends the list).
- Theme 3 draws a box for every contrast finding (at most 200 are listed, so bounded).
- `areas` of an image map share the box of their `<img>`.
- Two similar “personal field” regexes (`scan-elements` vs `rgaa-rules-run`) can disagree on `nom`.
- Real-Firefox behaviour is only known from the owner's tests so far (Firefox applies the page CSP to content scripts: axe is shipped patched, see `scripts/patch-axe.mjs`).

## Handoff log (newest first)

### 2026-10-13 — Claude Code — audit styles (the Stylus sheets), integrated
- Owner's decision (reverses the earlier "Stylus stays separate" entry): the 19 sheets are **bundled** (no re-import of the JSON) and the auditor
  chooses how to work: apply them from the panel, theme by theme, or keep using Stylus and have the panel only name the sheets of the theme.
- Did: `src/lib/audit-styles-data.ts` (the sheets, verbatim from the owner's Stylus export, `String.raw` so `\A` survives; site-specific styles and the
  duplicate of the text-spacing tool left out), `src/lib/audit-styles.ts` (by theme), `src/panel/audit-styles-ui.ts` (the "Styles d'audit" menu in the page
  tools bar: a choice between "Appliquer ici" and "J'utilise Stylus", the sheets of the current theme first, a "Stylus : 06.Liens" hint in Stylus mode,
  mode kept in `localStorage`), a `RGAA_STYLE` message handled in `src/background.ts` (`scripting.insertCSS` / `removeCSS`, origin USER, so the page's CSP
  cannot block it and its !important wins), `scan()` switches every sheet off first (a sheet changes what the scan sees) and says so, reset when the page
  reloads. THIRD-PARTY.md row (supplied by the owner; licence to be confirmed by the owner) and README.
- Tests: `tests/audit-styles.test.ts` (19 sheets, names, themes, `\A` kept, no network, by theme), `e2e/audit-styles.spec.ts` (the rig stands in for the
  background with a `<style>` element: apply, remove, switched off before a scan, Stylus mode, remembered). `npm run check` 205 unit tests, 737 texts / 1272 French / 0 missing; `npm run test:e2e` 26 passed (parity baseline updated: the menu adds the sheet list to every screen's tools bar). The menu is a button + panel, not `<details>`, because Codex's review-workflow test requires the display tools area to have no collapsible `summary`.
- NOT tested: `scripting.insertCSS` with `origin: 'USER'` in a real Firefox/Chrome (only the stand-in ran), nor the look of every sheet on a real site.
  The sheets add a fixed counter box and shift the page by 200 px: the boxes of the scan are not meant to be used at the same time.

### 2026-10-13 — Claude Code — Stylus: decision recorded, nothing built
- The owner shared the Stylus export (19 audit sheets, `.json`) and asked for an independent use of Stylus. Decision (owner): **option 1,
  Stylus stays a separate tool; the app does not apply or bundle those sheets.** A partial implementation (an "Audit styles" menu, a
  background `insertCSS` message, a Stylus-export importer with a CSS sanitizer, the 19 sheets bundled) was started before the owner
  answered; it was never committed and has been discarded. Nothing in the application changed.
- Things to know if this comes back: (1) the sheets change how the page looks (`display:block !important`, hidden elements revealed), so with a sheet
  on, the scan sees a different page (visibility, boxes, previews): switch Stylus sheets off before "Analyser" / the automatic run;
  (2) the sheets are the owner's: do not copy them into the repository without the owner's decision on ownership and licence (decided later: bundled);
  (3) if an importer is ever built: read the file at runtime, apply through the background (`scripting.insertCSS`, origin USER, CSP-proof), strip `@import`,
  `url()` that is not a `data:` image, and `image-set()`/`src()`; skip site-specific sections.
- State: no code change; working tree clean. Not tested in a real Firefox.

### 2026-10-11 — Claude Code — Colours: "introuvable" texts were never dropped
- Why: the owner saw many Colours findings marked "Introuvable" (not found at the last scan). `mergeFindings` drops a gone finding that no
  human worked on, but `worked()` counted ANY note, and the contrast checker writes its own note (`autoNote`) on every failing text, so none of
  them was ever dropped. Fix (`src/panel/scan-merge.ts`): the checker's own note no longer counts as human work (a note the auditor wrote, or
  an answer they gave, still keeps the finding, flagged as gone, with its "Retirer de l'audit" button). Test in `tests/panel-scan-merge.test.ts`.
  The stale ones already in an audit disappear at the next scan of the Colours theme.
- State: `npm run check` 198 unit tests, translations complete; `npm run test:e2e` 24 passed. Not tested in a real Firefox.
- Note: images that are no longer found are still never dropped (they stay marked "absente de la page"); a "Retirer les images absentes"
  action was offered to the owner, not asked for yet.

### 2026-10-11 — Claude Code — numbers follow the page, pre-filled criteria, a list you can see and use with the keyboard
- Context: the owner said the image numbering "is not right at all", did not understand the "1/9", asked for the analysis to pre-complete
  more, said the list of elements looked dim and asked for a visible focus and keyboard use. Codex was working on image numbering on this
  branch at the same time (`7bd2e60`, `5f1b1be`: stable numbers on rescans, internal ids kept apart): I read both entries first. Their
  identity fixes (keys, collisions) are untouched; I changed one DECISION of theirs, see "For the other agent".
- Did (numbering): `src/panel/page-order.ts` (`pageOrder`). After each scan the images, and the findings of the scanned theme, are numbered in
  the reading order of that scan (#1 = first on the page); an element that is not on the page now stays next to the neighbour it had. Answers
  follow the element through its key, not its number. The status says "N renumérotée(s)". The real audit showed why: numbers were in
  discovery order (a logo #2, another logo #24, then menu icons #25 to #30 found later at the top of the page).
- Did ("x/9"): the 9 on the theme tab is the number of RGAA criteria of the theme (1.1 to 1.9), nothing to do with images. The theme
  heading now says it: "Bilan de la thématique — Images · 0/9 critères RGAA confirmés · 2 à confirmer". The image header said "1 / 3" next to the
  criteria count: it now reads "image 3 sur 9" and "1/6 critères de cette image renseignés · prochain : 1.3 · pré-rempli, à confirmer".
- Did (pre-completed): `prefill` (`src/panel/scan-merge.ts`) now also answers from the markup, flagged `auto` (counts as to confirm): ignored =
  decorative 1.2 C (unchanged); has an accessible name = informative 1.1 C; no name and not ignored = informative 1.1 NC (decorative would
  fail 1.2 anyway). 1.3 (relevance) and the others stay the auditor's. New button "Confirmer les N images pré-remplies" (with a dialog that
  says what is confirmed) for pages with dozens of icons; `themeProgress` also returns `suggested`.
- Did (list): the list no longer fades done and ignored rows (opacity rules removed); the current image has a thick frame and a ▶ marker;
  keyboard focus is a thick dark ring; the lists of images and of findings are one Tab stop with Arrow / Page / Home / End moving the selection
  (and the box on the page), Tab leaves the list.
- Tests: `e2e/element-list.spec.ts` (numbering of icons added at the top, roving tabindex, arrows, ring, marker, Tab leaves, confirm-all),
  `tests/panel-scan-merge.test.ts` (page order, answers follow, absent images keep their place, findings, pre-fill rules);
  `e2e/image-numbering.spec.ts`, `e2e/smoke.spec.ts`, `e2e/summary-navigation.spec.ts`, `e2e/ux-reaudit.spec.ts` updated to the new rules;
  parity baseline updated (read: tabindex on items, the review-actions and pre-filled notes, the theme heading text, the confirm button).
  `npm run check` 197 unit tests, 721 texts / 1256 French / 0 missing; `npm run test:e2e` all passed. Not tested in a real Firefox.
- For the other agent (Codex): `7bd2e60` / its test required that a NEW image inserted before an existing one gets the next number and the
  old one keeps #1. That is now reversed on purpose (numbers = reading order); its test asserts the new order and that the old image keeps its
  record, key and answers. If the owner prefers stable numbers, revert `pageOrder` in `mergeScan` / `mergeFindings` only.
  Notes the auditor typed with "#12" in them do not follow a renumbering.

### 2026-10-11 — Codex — separate internal image IDs from displayed audit numbers
- Did: `5f1b1be` removes the write of audit numbers back into the DOM WeakMap and its counter during relabeling.
  These are independent identities: otherwise a hidden node can retain an internal ID later assigned as another
  node’s audit number, and both return with the same ID on rescan, corrupting box lookup/relabeling.
- Reproduction: new built-content-script browser test scans two images, hides one, relabels the visible image #1
  (as another audit can do), then reveals the hidden image and rescans. Before fix: one distinct ID for two nodes.
  After fix: distinct IDs; custom displayed numbers #7 and #3 locate and overlay their correct physical image bounds.
  The earlier numbering/answer-preservation test also passes.
- State: `npm run check` passes (192 unit tests, typecheck, 710 texts / 1245 French entries / 0 missing, build).
  Full `npm run test:e2e`: **23 passed**, unchanged 80-screen panel parity and content parity fixtures. Built classic
  content script has **0 imports**. Logs: `/tmp/rgaa-number-collision-before.log`, `/tmp/rgaa-number-collision-check.log`,
  `/tmp/rgaa-number-collision-e2e.log`.
- Not tested: real Firefox/DevTools, downloaded Asqatasun fixtures. No saved-data, dependency or network changes.
- Next: owner must reload the extension AND inspected webpage before rescanning. Ask for an example/screenshot showing
  both list and page box if mismatch persists; symptom clarification was requested but not yet received.
- For other tools: do not claim this proves the owner’s exact case is resolved. Existing historical duplicates and
  ambiguous image matching remain unchanged. Internal IDs must never be overwritten with per-audit display numbers.

### 2026-10-11 — Codex — stable image numbering on rescans
- Did: `7bd2e60` excludes assistant overlay markup from image context. Before the fix, answering a body-level image
  changed its overlay state, changed its fingerprint and made the next scan duplicate/renumber the same image.
  `mergeScan` also falls back to a unique unchanged image (type/source/own markup/link destination) when surrounding
  content changes, preserving its existing key, number and human answers. Exact matches reserve their records first.
- Regression: the built-app test failed before the fix even on an unchanged-page rescan after answering (one image
  became two records). It now checks answer preservation, unchanged rescans, insertion before the original image,
  changed nearby text, panel reopening and overlay/list numbering. Three unit tests cover persisted-record matching,
  ambiguous duplicates and changed markup/link destinations.
- State: `npm run check` passes: **192 unit tests**, typecheck, **710 texts / 1245 French entries / 0 missing**, build.
  Full `npm run test:e2e`: **22 passed**, including unchanged 80-screen panel parity. Built content script: **0 imports**.
  Reviewed two content parity fixture diffs before accepting: only the assistant overlay removed from contextHtml.
  Logs: `/tmp/rgaa-numbering-before-awaited.log`, `/tmp/rgaa-numbering-check-final.log`, `/tmp/rgaa-numbering-e2e.log`.
- Not tested: real Firefox/DevTools, downloaded Asqatasun fixtures. No new network calls/dependencies or saved-data model changes.
- Next: owner should answer an image and rescan on the real page, checking its number in both the list and overlay.
- For other tools: existing ambiguous duplicate records are intentionally not merged/deleted; preserve human answers.
  This is conservative matching, not a guarantee of identity when image markup itself changes or duplicate images
  cannot be distinguished. The attachment showed only the header; the defect above was independently reproduced.

### 2026-10-11 — Codex — coverage reference in the top audit bar
- Did: `4381d1e` moves Couverture RGAA beside Synthèse et exports in the audit header, available from every view.
  Removed the footer and its review-only visibility wiring; updated README. Existing local destination and FR/EN labels preserved.
- State: `npm run check` passes (189 unit tests, typecheck, 710 texts / 1245 French entries / 0 missing, build).
  Full `npm run test:e2e`: **21 passed**, including 80-screen parity and 480/768/1280px responsive checks.
  Read all distinct DOM changes against `/tmp/rgaa-bars-release.txt` before updating parity: only the relocated link/footer.
  Inspected the 480px screenshot. Logs: `/tmp/rgaa-coverage-check.log`, `/tmp/rgaa-coverage-e2e-final.log`.
- Not tested: real Firefox, real DevTools, Asqatasun downloaded fixtures (unchanged engines/content script).
- Next: reload the extension and check the top-bar reference from evaluation, sample and summary in real DevTools.
- For other tools: owner explicitly prefers coverage in the top bar; this supersedes the prior footer placement.
  No dependencies, network calls, saved-data or verdict changes.

### 2026-10-11 — Codex — implement approved toolbar and counter corrections
- Did: `25afd1e` on `codex/toolbar-clarity` implements the owner-approved review (`4c09ebf`). Visible labels identify
  Audit, Page auditée, Bilan de la page, Thématiques RGAA, Bilan de la thématique and Outils d’affichage. The theme
  header/summary is shared across image, finding and checklist views. Display and highlight controls follow theme
  navigation/summary in one visible area with no outer collapse button. The context-specific Autres outils control
  and theme-selection menu retain their existing behavior.
- Actions: removed Actions de la page. Repérer / Actualiser les éléments and automatic checks stay directly on the
  page bar; Suivant à évaluer is next to the page summary. Page reset/removal remain in the sample table; theme
  reset is beside the theme heading with a scoped accessible name; coverage help is below the workspace. Updated
  onboarding/scan instructions and README. Busy-state protection includes the relocated next button and tools.
- Counts: page summary now covers all 106 criteria; local summary covers the active theme. Unselected themes are
  untested and their status link opens the right result row without changing review selection. Partly covered C/NA
  criteria remain in the shortcut’s to-review bucket, completing its five-status partition without presenting full
  compliance. Saved verdicts/rates are unchanged. Additional confirmation/coverage badges are grouped under À vérifier;
  image inventory/pre-filled-image counts move beside the image list.
- Tests: new scope test covers all 106 versus ten theme-8 criteria, navigation to unselected criteria, P01/P02
  independence and English labels. Reset test covers cancellation and preservation of another theme’s answer.
  Responsive tests use the expanded default UI, check tool position/toggles and overflow at 480/768/1280px, then
  scroll to actual decisions. Existing review, persistence, exports, screenshots and automatic-run scenarios pass.
- Separate test fix: `86a96a7` waits for the existing smooth-scroll effect before asserting positive scrollY. An
  intermediate run exposed an immediate assertion racing the animation; no content-script behavior was changed.
- Parity: captured the passing pre-change 80-screen dump at `/tmp/rgaa-bars-before.txt`; read all distinct changes
  in `/tmp/rgaa-bars-first.diff` and the subsequent wording-only `/tmp/rgaa-bars-copy.diff` before accepting the
  baseline from `/tmp/rgaa-bars-reviewed.txt`. Intended hierarchy, labels, counters and copy changes only. Inspected
  wide and narrow screenshots, including final `/tmp/rgaa-bars-release/` expanded views.
- Checks: final sequential `npm run check` passed (189 unit tests, typecheck, 710 texts / 1245 French entries /
  0 missing, build); full `npm run test:e2e`: **21 passed**, including all 80 parity screens. Built content script:
  0 module imports. Logs: `/tmp/rgaa-bars-release-check.log`, `/tmp/rgaa-bars-release-e2e.log`.
- NOT tested: real Firefox, real DevTools, or downloaded Asqatasun fixtures (rules/content unchanged).
- Next: reload the built extension and panel; verify page versus theme labels/counts, direct next-review, display
  tools after theme navigation, and reset/remove access through the sample on a real multi-page audit.
- For Claude/other tools: preserve the shared theme header and static display-tools area; do not append tools into
  per-theme view headers again. `pageOptions`, deleted header reset/remove lookups and `images-summary` are gone;
  shared `theme-summary` and `image-inventory` replace the latter. No new dependencies, network calls, audit-data
  migrations or automatic-verdict policy changes. This supersedes the “proposal only” state in the previous entry.

### 2026-10-11 — Codex — toolbar UX analysis after Claude’s updates
- Did: `4c09ebf`, documentation-only review in `docs/ux-bars-review-2026-10-11.md`, based on `f7d2c5a`.
  Traced navigation, scans, summary counts and destinations, reset/remove actions, and contextual display tools.
- Findings: page meter covers all 106 criteria while page pills filter to selected themes; the menu mixes review,
  destructive actions and reference help; display tools precede the theme context that controls them. Expanded
  narrow layout consumes the viewport; existing reachability tests first collapse sections, masking that default UX.
- Recommendations: label scopes visibly in existing rows; Bilan de la page / Bilan de la thématique; align page
  counts and destinations with the full-page scope; remove Actions de la page by moving its actions to their proper
  contexts. Place Outils d’affichage after theme navigation, remove its outer collapse control, and group highlighting
  there. Keep the direct top-header evaluation return and original sample table.
- Checks: `npm run check` passed (189 unit tests, typecheck, 710 texts / 1229 French entries / 0 missing, build).
  Eight targeted browser scenarios passed (audit navigation, 480/768/1280 review, three summary-navigation cases,
  Claude’s compact-row/criteria-progress/manual-help case). Inspected wide/narrow screenshots.
  Logs: `/tmp/rgaa-bars-review-check.log`, `/tmp/rgaa-bars-review-e2e.log`.
- NOT tested: full browser suite/parity this turn, real Firefox or real DevTools. No baseline or application changes.
- Next: implementation of the documented proposal when requested; regression priorities are in the report.
- For Claude/other tools: do not treat recommendations as shipped. Preserve your visible scan button and recent
  preview/manual-help changes. Changing the page-counter filter also requires fixing destinations for unselected
  themes; no saved-data or verdict-policy change is proposed. User prefers visible information and tools.

### 2026-10-11 — Claude Code — "Analyser P01" is long: previews share screenshots
- Why: the owner finds the scan long. It does: (1) the element scans of every chosen theme (fast: DOM reads), then (2) the previews:
  one scroll + one tab screenshot + a 180 ms pause PER element (up to 40 images needing a picture and 50 findings), which on a real page
  (Firefox, large screen) is tens of seconds. That second part was mine (the image pictures) added to the findings previews.
- Did: `captureCrops` (`src/panel/page-bridge.ts`) now takes ONE screenshot for every pending element that is fully in view and not
  covered (new message `RGAA_RECTS` → `viewportRects` in `src/content/overlay.ts`: rect + `elementFromPoint` hit test, so an element
  under a sticky header is not photographed through it): scroll the first pending element to the middle, ask where the others are, photograph once,
  crop them all, repeat. Images and findings are captured together (`capturePreviews`), the pause is 120 ms. Dead helpers removed.
- Tests: `e2e/image-pictures.spec.ts` (12 icons + the page's findings: at most 4 screenshots, all 12 pictures present). The parity baseline
  moved by 1 KB in "stored as … KB": the e2e rig injects the content script as a `<script>` into the page DOM, which the HTML snapshot
  includes, so a bigger content script is a bigger snapshot (not a real page effect). `npm run check` 189 unit tests, 710 texts / 1229 French /
  0 missing; `npm run test:e2e` all passed after the baseline update. NOT measured in a real Firefox: the gain depends on how many elements
  share a screen; a real page should drop from one screenshot per element to a handful.
- Next: if it is still slow on a real site, make the previews optional or lazy (a "Prendre les aperçus" button), and time each step
  in the status line.

### 2026-10-11 — Claude Code — re-audit of the UX proposals, corrections that were still valid
- Did: re-checked U1–U9 of `docs/ux-review-newcomer-2026-10-11.md` on the built panel (new section 7 with a verdict each).
  Implemented: U1 (the browser address sits on the row of the page selector and navigation, `src/panel/panel.html` + `.page-location`
  in `panel.css`; the display-tools label that repeated its heading is hidden), U3 (`criteriaProgressText` in
  `src/panel/images-view.ts`: "1/6 critères répondus · prochain : 1.3" in the image header, refreshed in `refreshAll`),
  U5 (`.rate.provisional`: label first, number muted), U8 (`how` on each manual check in `src/lib/manual-checks.ts`, French in the new
  `src/lib/i18n-fr-manual.ts`, rendered in `checks-view.ts`). U2 and U7 were already resolved by Codex's rework; U4 declined for now
  (a rename across ~15 texts); U6 is the owner's decision (keep C); U9 left.
- Tests: `e2e/ux-reaudit.spec.ts`; parity baseline updated (diff read: the address row moved, the how lines, the criteria progress,
  the rate markup, nothing else). `npm run check` 189 unit tests, 710 texts / 1229 French / 0 missing; `npm run test:e2e` 18 passed.
  Not tested in a real Firefox.
- Next: the owner's call on U4 and U9; try the extension on a real site (Firefox) and report what is still in the way at DevTools height.

### 2026-10-11 — Claude Code — a real picture of the element for icons that cannot be redrawn
- Why: the owner saw no icon even on the pink preview background. Reproduced: an inline SVG that draws from a sprite
  (`<use href="#id">`) or from the page's CSS was redrawn alone from its markup (empty / wrong colours), and an icon set as a CSS
  background had no preview at all. The Excel thumbnail (white background) and the stored audit (`compact()` drops big inline
  thumbs) had the same blind spot.
- Did: `ImageElementInfo.shot` (a PNG cropped from a screenshot of the tab, kept across rescans like finding shots).
  The scan photographs every present image that `needsPicture` (inline `svg`, or no thumbnail): `captureImagePictures` in
  `src/panel/page-bridge.ts` (the old findings capture is now the generic `captureCrops`, which also hides the boxes of every
  theme, not only 1 to 3, and enlarges small icons up to 4x with less padding). The content script locates image boxes
  (`locateTheme(1, id)`). `previewOf(el)` (`src/lib/url-safety.ts`) = the picture when it is a base64 image, else the thumbnail; used by the
  list, the preview, the compact preview, the Excel grid and the HTML report. Opening a file drops any `shot` (images and
  findings) that is not a base64 image. Plain `<img>` keep their address, and the background choice from the previous entry
  still helps with transparent PNG/SVG files.
- Tests: `e2e/image-pictures.spec.ts` (sprite icon and CSS-background icon get a PNG picture, stored in the audit, kept after reload
  and rescan), `tests/security.test.ts` (previewOf, hostile `shot` dropped). `npm run check` 189 unit tests, 708 texts / 1209
  French / 0 missing; `npm run test:e2e` 17 passed. Not tested in a real Firefox: the capture uses the same tab screenshot as
  the findings previews; if the extension may not access the site, the scan says so and keeps the redrawn thumbnail.
- Note: ignored images (aria-hidden, alt="") are shown at 55 % opacity in the list on purpose.

### 2026-10-11 — Claude Code — opening a file over the same audit (work on two computers)
- Did: the owner works on several computers: save to file on one, open it on the other and replace the original. That already
  worked (same audit id → "replace or import as a copy"), but the prompt only showed the browser's date. `importAuditFile`
  (`src/panel/audit-session.ts`) now shows both dates ("Dans le navigateur : modifié le… Dans le fichier : modifié le…"),
  says whether the file is more recent, older (warning: replacing loses the changes made since) or the same date, and
  says that replacing overwrites the whole audit (no merge). Bug found by the new assertion in `e2e/smoke.spec.ts`: renaming an
  audit did not bump `updatedAt`, so a rename left "last change" and "changed since the file" unchanged; renaming (open or
  stored audit) now sets it. French in `i18n-fr-panel.ts`.
- State: `npm run check` 187 unit tests, 707 texts / 1208 French / 0 missing; `npm run test:e2e` all passed. Not tested in a real Firefox
  or between two real machines.
- Next / for the owner: there is no merge of two copies edited on both computers (the newer file replaces the browser
  audit, or the file is imported as a copy). Always save the file before moving, and do not edit the same audit on both
  machines at once. A merge by page (take the newest page of each) is possible later if that is a real need.

### 2026-10-11 — Claude Code — background choice for the image previews (transparent icons)
- Did: `src/panel/preview-bg.ts`: a "Fond de l'aperçu" select (checkerboard by default, white, light pink, light grey, dark,
  custom colour with a colour picker) in the big preview card of Images. It sets `--preview-bg` on the document, read by the
  list thumbnails, the big preview and the compact preview (narrow screens). A per-browser view option kept in `localStorage`
  (`rgaa-preview-bg`, `rgaa-preview-bg-color`), never in the audit. `e2e/preview-bg.spec.ts`; French in `i18n-fr-ux.ts`;
  parity baseline updated (the new control in the Images detail).
- Also answered the owner's questions on saving (no code change): audits live in `chrome.storage.local` (extension storage
  of the browser profile), written as you work; "Enregistrer" downloads a copy `.rgaa.json` to the Downloads folder and only
  records the time of the export (`exportedAt`), not a path (a browser extension cannot know where a download went).
  "Mes audits" shows "Fichier: jamais / modifié depuis… / à jour" from that time; the open audit has no Open button
  (it is already open). Possible follow-ups, owner's call: show the last saved file name in "Mes audits", an "Ouvert" marker
  instead of an empty action cell, an optional automatic backup reminder.
- State: `npm run check` 187 unit tests, 702 texts / 1203 French / 0 missing; `npm run test:e2e` 16 passed.
  Checked on screen with a white SVG icon: invisible on the checkerboard, visible on light pink, in the big preview and the list.
  Not tested in a real Firefox.
- Next: unchanged.

### 2026-10-11 — Claude Code — page scan button back beside the automatic checks
- Did: `#scan-btn` ("Analyser P01" / "Réanalyser P01") moved out of the "Actions de la page" dropdown to sit right
  before "Contrôler automatiquement la page ouverte" in `src/panel/panel.html`, with its own style (`.scan-btn`, outlined, so the
  primary action stays the automatic run). Scan lists the elements to review (and adds what a popin or tab shows); the
  automatic run does everything; they are two actions. Parity baseline updated: the only diff is the button's place and class.
- State: `npm run check` 187 unit tests, 0 missing translations; `npm run test:e2e` 14 of 15 passed before the baseline update
  (only the parity screen), all after. Checked on screen at 1280 and 480 px. Not tested in a real Firefox.
- Next: unchanged.

### 2026-10-11 — Claude Code — "Repérer sur la page" in every element criterion card
- Did: new `reviewActions(key, locate)` in `src/panel/review-controls.ts`: under every element-level criterion card (image
  kind card, image criteria, finding criteria in Frames, Colours, Tables, Links, Components, Structure, Forms) the buttons are now
  "Repérer sur la page" then "Suivant à évaluer". The locate button calls the same functions as a click on the element in
  the list (`focusOnPage` / `focusFinding`): its box takes the yellow focus outline and the page scrolls to it. Page-level
  checklist cards have no element, so no locate button. New `e2e/locate.spec.ts` (Images and Links: same outline and
  animation as a click, order of the two buttons, short page window so the scroll matters). `e2e/audit-workflow.spec.ts` used
  the button's parent as the card: it now looks for the `.criterion` ancestor. Parity baseline updated: the only diff is
  the new `div.review-actions` + button on 92 card renders.
- State: `npm run check` 187 unit tests, 700 texts / 1195 French / 0 missing, build, content script 0 imports;
  `npm run test:e2e` all passed after the baseline update. Checked on screen at 1280 and 480 px. Not tested in a real Firefox:
  in Chromium the outline and the scroll were identical between the header button, the card button and a list click;
  if Firefox shows a difference (smooth scroll while the DevTools panel has the focus), report the page.
- Next: unchanged (see the list above).

### 2026-10-11 — Codex — visible information and a direct return to evaluation
- Did: `bf247db` adds **Évaluer la page** in the audit header, available from Échantillon et suivi, summary and
  audit list. It returns to the selected page/theme without losing answers and puts keyboard focus on Évaluation.
  It is disabled before a page exists; the three page modes remain beside the selected-page control.
- Information disclosures now start open: tools, theme progress, highlight options, image list, audit settings,
  batch controls, suggestions, run history (including individual reports), coverage and page HTML. User choices
  survive view rebuilds and navigation during the panel session. Resizing no longer forces the image list closed
  or open. Action/theme popup menus remain closed initially. Narrow image-heading spacing keeps the first answer
  within an 800px viewport after the auditor compacts the view. README updated.
- Regression coverage: top-header keyboard returns at wide/narrow widths, selected page and verdict retained,
  no-page disabled state, initial expanded sections, manual collapse across answers/navigation/reruns, and image
  list state retained across responsive breakpoints. Existing batch/review/persistence/export scenarios still pass.
- Parity: read every distinct change in the full `/tmp/rgaa-expanded-reviewed.diff` before accepting the 80-screen
  baseline: the new translated button and information `open` attributes only. An initial run also captured the
  known transient Links highlight fragment; the next dump excluded it and only intended changes were accepted.
  Reviewed wide and narrow screenshots, including the expanded and user-compacted evaluation views.
- Checks: `npm run check` passed (187 unit tests, typecheck, 700 texts / 1195 French entries / 0 missing, build).
  Final full `npm run test:e2e`: **14 passed**, including all 80 parity screens. Built content script: 0 module imports.
  Logs: `/tmp/rgaa-expanded-release-check.log`, `/tmp/rgaa-expanded-final-e2e.log`.
- NOT tested: real Firefox, real DevTools or the Asqatasun fixture download suite (engine rules unchanged).
- Next: reload the extension and panel; open Échantillon et suivi and return through Évaluer la page. Collapse a
  section, answer a question, navigate away/back and resize DevTools to verify the chosen state remains comfortable.
- For Claude/other tools: preserve the editable table first, the visible header return, and open-first disclosures.
  Disclosure preferences are panel-session state, deliberately outside saved audit data; reopening the panel starts
  expanded again. No migration, dependencies, network calls or automatic-verdict changes. The known intermittent
  highlight fragment in parity remains a test-stability follow-up; do not accept it as an intended UI change.

### 2026-10-11 — Codex — restore the pages table at the start of the sample
- Did: `d8e1d53` restores the original editable pages table directly below the Échantillon et suivi heading,
  followed by the add-page form. It is no longer collapsed below the dashboard. Existing title/URL/theme editing,
  open/reorder/reset/remove actions are preserved; metadata settings, batch controls and progress cards follow below.
- Narrow panels: the table scrolls inside a named keyboard-focusable region; title/URL inputs retain a readable
  minimum width instead of shrinking to a single character. Audit/page navigation remains as implemented in `96b1ebb`.
- Tests: extended existing browser scenarios to check the table is immediately visible and precedes add/progress,
  two registered pages appear in order, keyboard access reaches the title field and its width remains usable at 480px.
  Reviewed wide/narrow screenshots. Read the full `/tmp/rgaa-table.diff` before updating the parity baseline;
  only the sample screen changes among the 80 screens (table disclosure removed and blocks reordered).
- Verification note: one intermediate full run had a transient Links-screen parity difference. Trace reconstruction
  (`/tmp/rgaa-table-unexpected.diff`) showed extra page-highlight overlay markup in the displayed HTML excerpt.
  The focused parity rerun passed without changing that baseline; only the intended sample-screen baseline is updated.
- Checks: `npm run check` passed (187 unit tests, typecheck, 699 texts / 1194 French entries / 0 missing, build).
  Final full `npm run test:e2e`: 14 passed, including the reviewed 80-screen baseline. Logs:
  `/tmp/rgaa-table-release-check.log`, `/tmp/rgaa-table-final-e2e.log`.
- NOT tested: real Firefox or real DevTools; Asqatasun fixture download suite (content/engine rules unchanged).
- Next: owner reloads the extension/panel, opens Échantillon et suivi, and checks the restored table with several
  real pages, including editing/reordering and horizontal keyboard scrolling in narrow DevTools.
- For Claude/other tools: keep the editable table first and expanded; keep the new progress/batch features below it.
  No data migration, dependencies, network calls or automatic-verdict changes.

### 2026-10-11 — Codex — implement the corrected audit/page hierarchy
- Did: `96b1ebb` moves Échantillon et suivi / Synthèse et exports beside the audit name in the top bar.
  Évaluation / Contrôles manuels / Résultats de la page now share the selected-page header. The automatic-run button
  is a distinct page action, with browser URL/match state below. Global views hide page controls/progress and retain
  dashboard entry points and existing return links. Both header groups wrap within their own scope.
- Continue reviewing: the inline decision controls are unchanged; the duplicate global next shortcut is secondary
  in Page actions. Its handler closes the menu before advancing. Menu lookup is shared in dom.ts, including scan/reset.
- Regression coverage: audit controls beside the audit name, page modes beside the selector, page controls hidden on
  global views, keyboard entry from the dashboard and between page views, selected page and answer retained after
  summary/audit-list round trips. Responsive tests assert selector → Évaluation tab order, menu bounds, no overflow
  and first-decision reachability at 480/768/1280px. The same 14 browser scenarios cover the broader workflows.
- Parity: read all distinct changes in `/tmp/rgaa-scope.diff` comparing `/tmp/rgaa-topbar-after.txt` with
  `/tmp/rgaa-scope-after.txt` before accepting the 80-screen baseline. Intended changes only: navigation relocation,
  page selection/action/location wrappers and the next shortcut in its menu. Reviewed wide page/sample and narrow
  page/sample screenshots. French/English labels and saved data are unchanged; README describes the corrected route.
- Verification note: an intermediate rerun overlapped a rebuild and failed the retry test because dist/axe.min.js
  was briefly absent (ENOENT confirmed in the trace). Final checks/build and browser suite run sequentially.
- Checks: final sequential `npm run check` passed (187 unit tests; typecheck; 700 texts / 1194 French entries /
  0 missing; build), followed by full `npm run test:e2e`: 14 passed, including the reviewed 80-screen parity baseline.
  Built content script: 0 module imports. Logs: `/tmp/rgaa-scope-release-check.log`, `/tmp/rgaa-scope-release-e2e.log`.
- NOT tested: real Firefox, real DevTools or the Asqatasun fixture download suite (engine rules unchanged).
- Next: owner reloads the extension and panel, checks the top audit navigation, opens a page from the sample,
  switches between its three page views, and returns from the summary at both wide and narrow DevTools widths.
- For Claude/other tools: this implements the clarified hierarchy in `2f1cdab` and supersedes the mistaken placement
  in `0f1dec8`. Keep audit-wide navigation in the audit header and page modes beside the selected page.

### 2026-10-11 — Codex — corrected navigation analysis after owner clarification
- Finding: the preceding `0f1dec8` placement reversed the owner's intended hierarchy. Its tests verified that mistaken
  placement, so their passing result does not validate the UX. This entry supersedes the previous instruction to keep
  page modes beside Audits. This session is analysis/documentation only; no application changes.
- Recommended audit header: brand/audit name, Échantillon et suivi, Synthèse et exports; save status and utilities
  (Audits, file open/save, language) at the right. Remove the standalone audit-navigation row.
- Recommended page header: selected page (Pxx + title), then Évaluation / Contrôles manuels / Résultats de la page.
  Keep its registered URL and inspected-page match status visible nearby. On wide layouts the selector and views
  share a row; narrow layouts wrap within the same page area and preserve the same reading/tab order.
- Page actions: one explicit Contrôler automatiquement la page ouverte action, beside the page context with latest
  run state. This starts a run; Contrôles manuels opens human activities. Keep Page actions secondary, followed by
  visible page progress, then themes and evaluation content. Do not force all page actions onto one crowded line.
- Global views: hide page work controls on Échantillon et suivi / Synthèse et exports / Audits. Enter a specific page
  through its existing dashboard Continue evaluation/manual/results actions. Preserve the existing Back to review
  links in summary/audits; make the selected-page destination explicit when refining their labels.
- Tests needed for implementation: assert sample/summary belong to the audit header and page modes belong beside
  the page selector; preserve selected page and answers when navigating; verify return from global views, keyboard
  focus, no overflow and reachable decisions at 480/768/1280px. Read parity DOM changes before updating its baseline.
- Checks: repository and current navigation code inspected; working tree initially clean at `0233685`.
  `npm run check` passed (187 unit tests, typecheck, 700 texts / 1194 French entries / 0 missing, build).
  No browser or real Firefox/DevTools test in this analysis session; the last 14 browser tests cover the previous
  implementation. No saved-model or automatic-verdict changes proposed.
- Next: implement this corrected hierarchy. For Claude/other tools: follow this clarification, not the preceding
  top-bar page-mode recommendation; do not restore a generic duplicate Évaluer une page button in the audit header.

### 2026-10-11 — Codex — put page modes beside Audits
- Did: `0f1dec8` moves Évaluation / Contrôles manuels / Résultats de la page into the top audit bar immediately
  before Audits. They remain accessible from the sample, summary and audits list; the redundant Évaluer une page
  button and its wiring are removed. Narrow headers wrap. README updated; saved data and automatic checks unchanged.
- Checks: `npm run check` passed (187 tests; typecheck; 700 texts / 1194 French entries / 0 missing; build).
  Full `npm run test:e2e` passed (14). The browser workflow now checks same-line placement beside Audits at 1800px,
  direct navigation from all three audit-wide views, pressed states and page progress. Existing 480/768/1280 decision
  reachability checks pass. Reviewed wide and 480px screenshots, with no horizontal overflow.
- Parity: compared `/tmp/rgaa-workflow-approved.txt` with `/tmp/rgaa-topbar-after.txt`, read every distinct changed
  line in `/tmp/rgaa-topbar.diff` before accepting the 80-screen baseline. Only intended changes: moved page navigation,
  its visibility in global views and removed redundant button. The first run had 13 passes and expected parity failure;
  the full verification run against the reviewed baseline passed normally.
- NOT tested: real Firefox or real DevTools; Asqatasun fixture suite (engine rules unchanged).
- Next: owner reloads the extension and reopens the RGAA Assistant panel, then checks the three header buttons from
  Échantillon et suivi and Synthèse et exports in the actual DevTools width.
- For other tools: preserve this explicit placement requested from the owner's screenshot; do not hide page navigation
  on audit-wide views or restore a separate Page workspace button. No dependencies, network calls or schema changes.

### 2026-10-11 — Codex — implement the approved audit workflow
- Did: `29eb344` separates global audit navigation from page work, adds per-page progress/activity/run tracking,
  removes the duplicate automatic run action, moves scan-only into Page actions, adds explicit save-and-next beside
  image/finding/checklist decisions and selected-URL runs with pause/resume. README documents the workflow.
- Data: audit schema v4, explicit v3 migration and validator; old tool history stays unknown rather than being labelled
  a completed run. Latest run records running/complete/partial/failed, URL, dates and error. Reopening a saved running
  status shows interrupted. Automatic checks remain suggestions; human answers and notes survive reruns.
- Checks: `npm run check` passed (187 tests; typecheck; 701 texts / 1194 French entries / 0 missing; build).
  Full `npm run test:e2e` passed (14); content script has 0 module imports. Five new browser scenarios cover audit/page
  scope, visible progress and saved explicit continuation; two-page pause/resume and independent outcomes;
  engine failure/retry preserving a human answer; finding/checklist keyboard continuation; wrong-source-URL refusal.
  Pure tests cover NC/unanswered queue behavior, auto-prefill confirmation, theme transition/wrap/end and v4 migration.
- Parity: captured `/tmp/rgaa-workflow-before.txt` before source edits; read all distinct changes in the full DOM diff,
  then the final sample/settings delta and timestamp-only normalization diff before accepting the 80-screen baseline.
  Intended differences: split navigation, hidden page controls on global screens, scan action relocation, run state,
  per-page dashboard/settings, inline next buttons and the next-item cursor advancing instead of returning to the first.
  English dates/AM-PM are now normalized to avoid time-dependent failures. Reviewed wide/narrow dashboard screenshots.
- Fixed during verification: 480px first decision initially fell below the viewport; reducing duplicate controls and
  moving scan-only into Page actions restored the existing reachability test. New tests use visible labels for styled
  radio controls and wait for asynchronous persistence before inspecting saved state.
- NOT tested: real Firefox, real DevTools, authenticated/redirecting sites or real extension permission failures;
  Asqatasun fixture download suite not rerun (engine/content rules unchanged). Batch queue is session-only; keep DevTools
  open and retry failed pages explicitly. Navigation replaces the inspected tab's page, as explained in the UI.
- Next: owner reloads the rebuilt extension, refreshes a real page and tries Échantillon et suivi → select two pages →
  run/pause/resume, then C/NC/NA → Suivant à évaluer and manual activity tracking; check French/English and narrow layout.
- For Claude/other tools: work is on `codex/audit-workflow`, not master. Rebuild before testing: **older v3-only builds
  reject newly saved v4 audits**. Preserve Claude's APG components/security work and the owner's prefilled decorative C
  rate/export decision. No dependencies or external service calls added; batch uses explicit browser navigation only.

### 2026-10-11 — Codex — verify Claude changes against the owner's UX concerns
- Reviewed `51c1b1e` and changes since `d116a3d`. Repository was clean before review. Application code unchanged;
  this entry and the current-state/backlog corrections are the only edits.
- Verified fixed: `0d33d15` keeps image #1 in “À relire” after choosing informative and answering 1.1 NC while five
  criteria remain unanswered. Claude also shipped separate overlay/banner/export fixes (`e600848`) and component checks
  (`51c1b1e`); those do not implement the requested workflow reorganization.
- Verified missing in the rebuilt UI: “Échantillon de pages” / “Synthèse de l’audit” still share the same navigation row
  with “Relire” / “Contrôles” / “Résultats de la page”. Page scan controls/progress remain on the sample screen; its title
  starts at y≈441 in a 480×800 viewport. The sample columns remain Page/Title/URL/Themes/Images/Scans/Actions, with no
  per-page review/manual-work/run-status dashboard. Synthesis remains ordered around compliance tables/charts.
- Verified missing: “Contrôles” still opens a mixed manual/automatic screen; both “Contrôles automatiques” in the page bar
  and “Lancer les contrôles automatiques” in that screen are visible and run the same operation. The generic labels are
  unchanged. Runners still target the inspected tab; no selected-URL batch runner exists.
- Verified partial next flow: the queue predicate is fixed, but from image #2 the page-level “Prochain à relire” returns
  to unresolved image #1. The separate image next button has a different ordering. Form finding details and checklist
  criteria have zero inline next buttons; no common answer-and-continue flow was added.
- Documentation discrepancy: section 3 of `docs/ux-review-newcomer-2026-10-11.md` explicitly labels U1–U9 as proposals,
  not fixes. U1 proposes collapsing progress/pills, contrary to the owner's earlier instruction to show progress without
  a dropdown. Preserve that preference when reducing header height. Respect the separately recorded owner decision about
  prefilled decorative-image C counting; this recheck does not reopen it.
- State: `npm run check` passed (183 unit tests, typecheck, 0 missing translations, build). Local Chromium walkthrough
  exercised image verdict/filter/next, sample, overview, duplicate run controls, a real fixture automatic run, form and
  checklist views; no console errors. Evidence JSON and screenshot: `/tmp/rgaa-ux-recheck-51c1b1e` (temporary).
  Full E2E and Asqatasun suites not rerun; real Firefox/DevTools and screen-reader interaction not tested. Server stopped.
- Next / for other tools: address the outstanding workflow requests directly; passing existing tests and adding APG
  coverage do not demonstrate that navigation/progress/next UX requirements were implemented. No push performed.

### 2026-10-11 — Claude Code — Components review: WAI-ARIA APG patterns checked per component (theme 7)
- Did: theme 7 is now a scanned, finding-based theme (`SCANNED_THEMES` / `FINDING_THEMES` include 7). New
  `src/content/scan-components.ts` (content script only: detects 17 pattern kinds by role or shape, runs structural checks,
  emits `widget-<pattern>` findings with `data.checks` as JSON and `data.fails`; dialogs and tooltips are listed even when
  hidden; the assistant's own layers are skipped). New `src/lib/apg-patterns.ts` (catalogue: pattern name, APG URL, wording
  of each structural check id, keyboard checklist) and `src/panel/apg-view.ts` (the 7.1 card lists the checks ✓/✗ with
  details, the 7.3 card lists the keys to try). `findings.ts`: criteria 7.1 and 7.3 per component, hints, suggestion
  7.1 = NC when a structural check fails (no suggestion otherwise: the keyboard is untested). Filters: "Structure problem".
  French in `i18n-fr-apg.ts`; README and THIRD-PARTY rows (APG is W3C material: linked, wording is ours).
- Tests: `tests/scan-components.test.ts` (fixture `tests/fixtures/pages/components.html`, 24 components, every emitted check
  id is in the catalogue and every catalogue text has French); content-parity replays theme 7 on every fixture (snapshots
  updated: a new `scan theme 7` step, empty on the old fixtures); e2e fixture `e2e/site/index.html` gained a tablist and a
  disclosure whose aria-controls target is missing; parity baseline updated (theme 7 screens, counts, menu label
  "analyse + relecture" for 7, the new fixture markup in context blocks, axe `aria-required-attr` now applicable).
- State: `npm run check` 183 unit tests, 670 texts / 1152 French / 0 missing, build, content script 0 imports;
  `npm run test:e2e` 10 passed (after the baseline update). Screens checked in Chromium through the harness.
  Not tested in real Firefox, not tested on a real site with real widgets (false positives possible on exotic markup:
  menus without aria-haspopup trigger, accordions wrapped in extra divs).
- Next: try it on a real site and tune the detectors; consider a "Composants" label instead of "Scripts" on the tab
  (`THEME_LABEL` is official RGAA wording, left as is); the newcomer-review proposals U1–U5 remain.
- For the other agent: `data.checks` is a JSON string by design (RawFinding.data only allows scalars). Do not translate the
  check details (attribute values); the wording comes from the catalogue. Adding a pattern = scanner function + catalogue
  entry + French; the unit test fails if a check id or a text is missing.

### 2026-10-11 — Claude Code — newcomer UX walkthrough, three fixes, APG answer
- Did: walked the built panel as a first-time auditor (Chromium, 1280×900 and 1280×520, fixture site, French UI),
  opened the Excel and the HTML report. Wrote `docs/ux-review-newcomer-2026-10-11.md`. Fixed what was unambiguous:
  `src/content/axe-run.ts` (axe context excludes `[id^="rgaa-assistant-"]`, nodes pointing at our layers dropped),
  `src/panel/sample-view.ts` (banner re-evaluated after `addPage`), `src/lib/audit-sheet.ts` (`tFr` on per-test
  outcome labels and per-element facts). Tests: `tests/axe-run.test.ts`, smoke asserts the report never mentions
  `rgaa-assistant-overlay`. Commit `e600848`; parity baseline updated (one failing rule fewer everywhere, French labels).
- State: `npm run check` 173 unit tests, 0 missing translations, build; `npm run test:e2e` 10 passed. Not tested in real Firefox.
- Next: owner's decisions on U6 (decided later the same day: keep C), then U1/U5 (height budget,
  work-remaining first), U2/U3 (one "next"), and whether to build the "Composants" (APG) element review.
- For the other agent: the APG question is answered in section 4 of the review; do not start the components
  review without the owner's go. The parity baseline moved twice today (`0d33d15`, `e600848`): read the handoffs before updating it again.

### 2026-10-11 — Claude Code — review-queue completeness (fix of the defect found by Codex's UX audit)
- Did: `needsReview()` in `src/panel/review-state.ts` now keeps an image in the queue while any applicable criterion is
  unanswered, even when another one is already NC, and while its answers are still pre-filled (`auto`) and unconfirmed;
  `boxStates()` uses the same predicate, so the box colours and the "À relire" filter now agree (they already did for the
  other themes through `findingNeedsReview`). `statusOf()` is unchanged: the list and the box still say NC as soon as one
  criterion fails. Regression test in `tests/panel-review-state.test.ts` (NC with gaps, pre-filled, next-to-review, boxes).
- Parity baseline updated on purpose. Diff read: the "À relire" count rises on the Images screens; "Prochaine à relire" is
  enabled; the page-level "Suivant à relire" now lands on the second image (still incomplete) instead of a Colours finding,
  so every later screen keeps Images as the current theme (its toolbar shows "Contenu masqué" / "Autres outils"). No other change.
- State: `npm run check` (171 unit tests, 0 missing translations, build), `npm run test:e2e` 9 passed. Not tested in a real Firefox.
- Next: owner's decisions on Codex's navigation proposal (audit vs page screens) and on explicit "Suivant à évaluer" beside
  the answers. The verified Codex findings that remain open: mixed audit/page scope, overview ordered by compliance rather
  than remaining work, no inline "next" for findings and checklists.
- For the other agent: the fix is behavioural, not cosmetic: counts of "to review" go up on audits in progress. Nothing to migrate.

### 2026-10-11 — Codex — UX audit of the end-to-end audit workflow (analysis only)
- Reviewed application commit `347f289`; only this WORKLOG is changed. No application behavior, schema or parity baseline changed.
  Read the navigation, sample, overview, checks, automatic-run and review-queue implementations; walked the built panel
  in local Chromium at 1280×900 and 480×800 with the existing fixture/extension-API harness.
- Findings: audit-wide sample/overview navigation is mixed with page review/checks/results. Page controls, page totals and
  an old scan message remain on audit-wide screens; at 480 px they consume over half the initial screen before sample content.
  “Contrôles” opens a mixed manual/automatic screen; “Contrôles automatiques” and the run button inside that screen both
  call `runEverything()`. Scan is a separate, narrower action. The sample table shows image/scan counts rather than remaining
  audit work; the overview is mainly a compliance/reporting dashboard. These are different needs, presently mixed together.
- Reproduced queue defect: select informative image #1, answer 1.1 NC, leave five criteria unanswered, then activate the
  review filter. Image #1 disappears from the list. `statusOf()` returns NC before checking missing answers and
  `needsReview()` checks only todo/progress (`src/panel/review-state.ts`). Automatically prefilled images are also excluded
  by that predicate unless otherwise incomplete. The page “next” action goes to the first unresolved item, whereas image
  “next to review” advances after the current image; findings/checklists lack the same inline flow. Needs regression coverage.
- Proposed hierarchy: audit header with audit identity, “Échantillon et suivi”, “Synthèse et exports”, saved-state/file actions;
  page workspace with page identity/URL, “Évaluation”, “Vérifications manuelles”, “Résultats” and one automatic-run action.
  Hide page controls on audit-wide screens. Keep compact theme done/total counters and visible progress within the page workspace.
  “Évaluation” includes first-time human assessment as well as confirmation of suggestions. Link manual activities to their
  affected RGAA criteria; marking an activity done must not silently create a criterion verdict.
- Proposed overall tracking: extend the sample screen rather than adding another overlapping dashboard. Each page needs
  automatic-run status/date (never run, running, completed, partial/error), human criteria answered/total, suggestions awaiting
  confirmation, manual activities done/total, latest activity and a contextual “Ouvrir / Lancer / Reprendre” action.
  Show aggregate work remaining above the table; keep compliance rates and exports in the synthesis. Do not equate an
  automatic run finishing, a failure being found, or a provisional compliance rate with completion of a human audit.
- Automatic scope: current runners address the inspected tab; listing a URL does not run anything there. Recommended copy:
  “Lancer les contrôles automatiques sur P02” with inspected URL and last-run status. A wrong tab should lead to opening the
  intended page, with clear target ownership. Later “Lancer sur N pages” should use a sequential browser queue, verify loaded
  URLs, allow pause/cancel/retry, isolate page errors and preserve human answers. Authentication, popins and interactive states
  require explicit handling; bulk initial-load checks cannot cover every state. No remote crawler/service proposed.
  Persistent run records and batch state will require schema design, migration and tests; imports currently record engine reports.
- Recommended answer flow: save each human choice, retain focus, show “Suivant à évaluer” next to the decision and
  optionally “Passer pour l’instant”. Track unresolved criterion/element pairs independently of C/NC outcomes; continue
  within the element before the next element, then the next theme. Keep incomplete/auto-unconfirmed items in the queue.
  Default to explicit advancement; an optional auto-advance must wait until the relevant review is complete and never
  interrupt notes or an in-flight save. Provide a clear end-of-queue state rather than reopening the same item.
- Tests to add with implementation: incomplete NC stays queued; prefilled answers need confirmation; next skips resolved
  items and handles end-of-queue/focus/saving; page vs audit navigation exposes the right controls; per-page progress survives
  reload; batch redirects, failed pages, interrupted runs and reruns never mix pages or overwrite human decisions.
- State: `npm run check` passed (170 unit tests, typecheck, translations 0 missing, production build). Targeted browser
  walkthrough completed without console errors; screenshots in `/tmp/rgaa-ux-audit-2026-10-11` are temporary diagnostic artifacts.
  Did not rerun the full E2E suite or Asqatasun fixture suite for this documentation-only audit. Real Firefox/DevTools,
  screen-reader use, multi-page execution and moderated user testing were not tested. Local test server stopped; no push.
- Next / for other tools: implement only after the owner chooses the proposed scope. Preserve `347f289` URL/image safety checks.
  Fix queue completeness before adding automatic advancement or batch runs; the current passing tests do not cover that defect.

### 2026-10-11 — Claude Code — security pass over audit-file handling
- Did: re-checked the whole folder after Codex's commits (`02e485c`, `4e3d24d`: all checks green) and reviewed where an audit file
  (anyone can edit one) reaches the page. Found and fixed two real problems, each with a test that fails on the old code:
  (1) the HTML report put `shot` / `thumb` values into `src="…"` unescaped, so a tampered file could inject script into the
  report page (now only base64 image data URLs, escaped: `src/lib/url-safety.ts`, `src/lib/report.ts`);
  (2) a page address such as `javascript:…` was sent to the inspected tab by `goTo` (now only http, https, file, both when
  loading an audit — `src/lib/audit-store.ts` — and in `src/panel/page-bridge.ts`). Also: opening a file drops preview
  addresses that are not on the page's own host (a tampered file could otherwise make the panel request any server).
  Reviewed and found fine: no `innerHTML` writes, no `eval`/`Function` in our code, Excel cells are inline strings (no formulas), links use `noreferrer`.
- State: `npm run check` (170 unit tests, 0 missing translations, build) and `npm run test:e2e` (9) pass; not tried in real Firefox.
- Next: unchanged (see “Next”). One thing to decide: previews of page images are stored as addresses, so they point to the
  audited site by design; the panel loads them when you open an audit.
- For the other tool: new tests in `tests/security.test.ts`; keep `isNavigableUrl` / `dataImage` for anything that turns
  audit data into a navigation or an image source. New French text is in `i18n-fr-persist.ts`.

### 2026-10-11 — Codex — visible progress and consistent status navigation
- Did: `02e485c` moves page progress and counts out of “Progression et activité” into an always-visible section below the
  page controls. Moves the coverage link into Page actions. Adds explicit arrows and navigation for suggestions,
  unconfirmed failures and partial coverage; fixes destinations to match the counted criterion and moves keyboard focus.
  Prefilled-image navigation selects the first matching image. Compact theme counters remain as committed in `197aa7b`.
- Tests: added `e2e/summary-navigation.spec.ts` for all checklist statuses, disabled zero counts, relevant image selection,
  unsupported/partial criteria opening the grid, and form fields whose failures belong to different criteria.
  Responsive tests also assert that progress and the review count are visible without expanding a disclosure.
- State: full `npm run check` passed (165 unit tests, typecheck, 0 missing translations, production build).
  Full `npm run test:e2e` passed (9 tests). Built content script checked: 0 module imports. `git diff --check` passed.
- Parity review: reran committed `cfb6ff3` in an isolated temporary copy, captured before/after DOM dumps and reviewed
  all 77 screens. Expected differences: relocated progress/coverage link, status buttons/arrows, the corrected “to review”
  destination, and keyboard focus on the next grid row. The updated baseline passes without `--update-snapshots`.
- Not tested: real Firefox, real DevTools, screen-reader interaction, GitHub Actions. Asqatasun fixture checks were not
  rerun; their prior 322/328 result is historical. No network-dependent fixture download or push performed.
- Next: owner to test the visible progress section and status jumps in real DevTools (mouse and keyboard, FR/EN).
- For other tools: this closes the previously uncommitted Codex UX work. No saved-model, dependency, automation-verdict,
  content-script or network behavior changes. Keep the navigation regressions and visible progress; open decisions are unchanged.

### 2026-10-11 — Claude Code — worklog and agent rules
- Did: added `AGENTS.md` (rules for any agent), `CLAUDE.md` (points to it) and this file. Before this, verified the folder: a panel
  workflow redesign and a theme-tab accessibility tweak had been made by the owner's other tool (ChatGPT pair coding); both were
  checked (`npm run check`, `npm run test:e2e`) and committed as `9a3abb8` and `197aa7b`.
- State: all checks above pass on `197aa7b`; not tried in a real Firefox.
- Next: see “Next”. Waiting on the owner for the real-Firefox report and the AI decision.
- For the other agent: add your entry above this one. If you edit `src/panel/**` run `npm run test:e2e` and read any parity diff before updating the baseline.

### 2026-10-10 — Claude Code (with sub-agents on isolated branches) — big build day
- Did (commits `961d251` … `e789528`): axe-core run in the page (patched to avoid `Function()` under CSP), own RGAA checks, Asqatasun port
  (73/99 tests, verified against its fixtures), page HTML capture + local validation, themes Links / Structure / Tables / Forms,
  boxes for every element, hidden-content and other page tools, report + accessibility statement draft, audit progress.
  Code review fixes: automatic evidence kept apart from confirmed verdicts, coverage-aware provisional rates, validated imports,
  serialized saves in the background, wrong-tab screenshot guard, scan-context bug, scan-coverage evidence. Refactors:
  `inject.ts` 1,621 → 109 lines (modules + typed messages), `panel.ts` 3,389 → 97 lines (modules). Tests/CI: Vitest, Playwright, pinned fixtures.
- State: everything merged on `master`, checks green; real-Firefox use found and fixed: the “undefined” URL bug, axe blocked by CSP,
  banner and scroll issues; one tab crash reported by the owner (mitigations: axe limited to mapped rules, no deep copy for the HTML snapshot, pauses between steps) — not reproduced.
- Next / For the other agent: see “Next” and “Open decisions”.
