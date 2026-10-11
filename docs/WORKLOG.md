# Worklog: where the project stands, and the handoff between agents

Read this first, update it last. Rules for agents are in `../AGENTS.md`.

## Current state (2026-10-11)

- Branch `master`. Latest application change reviewed: `347f289` (Claude Code security fixes); latest implemented UX change: `02e485c`. Version 0.1.0. Licence AGPL-3.0-only (because of the Asqatasun-derived rules).
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
  remaining; redesign proposed, not implemented, the owner decides. The queue defect it reproduced (an image left the review
  queue after one NC answer despite unanswered criteria; pre-filled images were not in the queue either) is **fixed** in
  `src/panel/review-state.ts` with a regression test. Current `npm run check`: 171 unit tests, 656 texts / 1000 French entries /
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

Nothing claimed. Add a line here before starting anything bigger than a small fix:
`- <who>: <what>, files: <...>, since <date>`

## Next (suggested order; the owner decides)

UX recommendation from the owner's latest request: first fix review-queue completeness (NC is not the same as fully reviewed),
then separate audit/page navigation and extend the sample into a page-progress dashboard. Add multi-page automatic checks
after the single-page workflow and run-status tracking are reliable. These are proposals, not implemented changes.

1. **Real Firefox test pass** by the owner: reload the extension, F5 on a real page, “Contrôles automatiques”; report crashes (which step, which page), the save pill, the unsaved-work dialog, the layout. In narrow DevTools, check that page progress stays visible and each nonzero status count opens the expected item, including keyboard activation and focus; check French and English.
2. **Per-test results** (as Asqatasun stores them: pass / fail / need more info / not applicable per test, with the elements). Needs a data-model addition + migration; also lets the auditor confirm the Images tests the tool cannot assess (image maps, CAPTCHAs), which today leave criteria “partly covered”.
3. **Port more Asqatasun tests** (26 left: marker-based image and table tests, contrast, stylesheet test 10.4.1 — the background page could fetch stylesheets across origins).
4. **Scan inside same-origin iframes and open shadow roots** (today only reported in the coverage card; overlay, positions, snapshot and screenshots assume one document).
5. **Audit several pages in one go** (open each page of the sample, run everything), then rates per test/criterion and a comparison of two audits.
6. Smaller: keyboard shortcuts to confirm/reject a suggestion; consistency of navigation/titles across the sample (RGAA 12.x); `npm audit` reports 5 issues in dev tooling only (vitest, vite's esbuild, tinypool): fix by upgrading Vite/Vitest when convenient.

## Open decisions (owner)

- **UX workflow proposal**: audit-level “Échantillon et suivi” / “Synthèse et exports”; page-level “Évaluation” /
  “Vérifications manuelles” / “Résultats”; one clearly named page automatic-check action. Prefer explicit “Suivant à évaluer”
  beside answers, with automatic advancement optional and off by default. Multi-page runs proposed as a later, explicit
  selection of URLs using the browser session, with pause/resume and per-page failures. Not yet accepted or implemented.
- **AI**: access (copy-paste / cloud API with own key / local model / company endpoint), first tasks, what may be sent — all undecided. Principles agreed for any design: suggestions only (never a verdict), opt-in, payload shown before any call, minimal data (no cookies, no full pages, nothing from logged-in sessions), traceable (model, prompt version, date), provider-neutral, measured against the owner's own past audits before being trusted. Safe order if approved: provider interface + copy-paste mode + payload preview + stored AI suggestions; relevance judgements from text; explain-and-fix and report drafting; optional API/local; images last with consent.
- **Access42 JSON file / Stylus**: the owner will provide the file later; do not start before seeing it.
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
- Next: see “Next”. Waiting on the owner for the real-Firefox report and the AI / Access42 decisions.
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
