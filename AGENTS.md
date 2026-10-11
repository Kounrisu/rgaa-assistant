# Working on RGAA Assistant (for any coding agent: Claude Code, ChatGPT, others, and people)

A browser extension (Manifest V3, TypeScript, Vite) that adds an **RGAA Assistant** tab to the DevTools to audit pages
against RGAA 4.1. Read `README.md` for what it does and `docs/WORKLOG.md` for **where things stand right now**.

## Before you start

1. Read the top of `docs/WORKLOG.md`: current state, what is claimed in progress, open decisions, the last handoff entries.
2. Run `git status` and `git log --oneline -5`. If the working tree is not clean and the changes are not yours, find out
   whose they are (WORKLOG, or ask the owner) before touching those files. Do not discard them.
3. For anything bigger than a small fix, say so in the WORKLOG (“In progress”) with the files you will touch.

## Commands

```bash
npm install
npm run check          # typecheck + unit tests (Vitest, no network) + translations + build. Must pass before every commit
npm run test:e2e       # Playwright smoke + parity + workflow tests on the BUILT panel (npm run build first; npx playwright install chromium once)
npm run check:asqatasun   # ported Asqatasun rules against Asqatasun's own test pages (pinned revision, downloads them): must stay 322/328
npm run build          # dist/, load it as an unpacked extension (Firefox: about:debugging; reload the inspected page after reloading the extension)
```

Definition of done: `npm run check` passes; `npm run test:e2e` passes after any change to `src/panel/**`, `src/content/**`
or `src/background.ts`; WORKLOG updated; changes committed with a message that says what and why.

## Invariants (break one and something real breaks)

- **Automatic results are suggestions.** Only the auditor sets a verdict. A tool result is stored as a suggestion plus
  evidence (`src/lib/evidence.ts`), counted as “to review” until confirmed. Rates are labelled *provisional* while the
  audit is incomplete. Never claim full RGAA coverage from automated checks.
- **The content script is one self-contained classic script.** Modules in `src/content/**` may import each other and
  `import type` from `src/lib`, nothing shared with the panel. After a build: `grep -c "^import \|[^a-zA-Z]import(" dist/assets/inject.ts-*.js` prints `0`.
- **Panel layout**: shared state in `src/panel/state.ts`, DOM lookups in `dom.ts`, upward calls through `actions.ts`;
  no import cycles and `panel.ts` stays a thin bootstrap (a test checks it). See the README “Code layout”.
- **French/English**: the English text is the key. Add French in a file `src/lib/i18n-fr-<topic>.ts` (wired in
  `src/lib/i18n-fr.ts`). `npm run check:i18n` must show 0 missing. The Excel grid text is French on purpose.
- **Asqatasun-derived code is AGPL-3.0, isolated and marked** (`// --- Asqatasun-derived: begin/end ---`). Removal
  steps are in `NOTICE.md`. Do not copy more third-party code in without checking its licence; record every new
  dependency or adapted code in `THIRD-PARTY.md`.
- **No new network calls, nothing leaves the machine.** Audits stay in the browser (`chrome.storage.local`) and in
  files the user saves. Any AI feature must follow the principles in the WORKLOG (opt-in, visible payload, suggestions only).
- **Saved data**: audits are validated on load and import (`src/lib/audit-validate.ts`); writes go through the
  background queue (`src/lib/persistence.ts`). Change the data model only with a migration and a test.
- **The parity baseline** (`e2e/__snapshots__/parity.spec.ts/`) is a hash per screen. Update it only for an
  intended UI change, after reading what changed (`PARITY_DUMP=/tmp/x.txt npm run test:e2e` writes the full text).
- Tests in `npm test` use no network and no browser. Asqatasun fixtures are downloaded to the temp folder, never into the repo.

## Working with several agents or tools at once

- One topic per commit; commit often; never `git push --force`; never rewrite published history.
- `git add -A` can pick up things you did not mean to add: add paths explicitly when other work is in the folder.
- Big or risky work goes on its own branch (or a git worktree: never commit a symlinked `node_modules`), merged when
  `npm run check` and `npm run test:e2e` pass.
- If you find uncommitted changes you did not make: read them, run the checks, and either commit them separately
  with a message saying where they came from, or leave them and say so in the WORKLOG. Do not mix them into your commit.
- Never mark something done that you did not run. Say what you did **not** test (real Firefox, real DevTools).

## Handoff protocol

At the end of a session, add an entry at the **top** of the “Handoff log” in `docs/WORKLOG.md`
(newest first), and update “Current state”, “In progress”, “Next” and “Open decisions” if they changed:

```
### YYYY-MM-DD — who (tool/person) — short title
- Did: what changed (files or areas), commit hashes
- State: checks run and their result; what was NOT tested
- Next: what you would do next, and anything blocking
- For the other agent: warnings, decisions you made, questions
```
