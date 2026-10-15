# Plan: an "audit pack" for an LLM, and a way to bring its answers back

Written 2026-10-13 by Claude Code, from the owner's request: *export all the data available (code, photos of the elements) so that an LLM
can check everything, then complete the saved file and import it back into the app.* The original proposal follows. Current implementation status (15 October 2026): ZIP export and the answers parser exist; the panel now previews the exact local files, offers field exclusions and defaults pictures off. Importing/applying model answers in the panel remains unimplemented. Read `AGENTS.md` first.

## 0. What already exists (checked on a real saved audit, `banque-france-fr_banque-de-france_2026-10-13.rgaa.json`, 4.7 MB)

Per image: `html`, `contextHtml`, `accessibleName`, `alt`, `ariaLabel`, `role`, `ariaHidden`, `ignoredBy`, `nearbyText`, `linkHref`, `linkText`, `figcaption`,
size, `thumb` and `shot` (picture of the element, 30 of 64 here). Per finding (links, forms, tables, scripts…): `html`, `contextHtml`, `facts`, `summary`.
Per page: `snapshot` (page structure), `imports` (axe and other tool results, 300 KB), `checklist`, `reviews`, `findingReviews`, `manualChecks`.
So the **.rgaa.json already holds the evidence**, but it is built for the app, not for a model: one 4.7 MB blob, base64 pictures inline, internal keys,
no instructions, no statement of what is asked.

## 1. Principles (from the WORKLOG AI principles, unchanged)

- **Opt-in and visible.** Nothing is sent anywhere by the app. The pack is a file the owner chooses to give to a model. A preview shows what it contains
  (counts, size, whether pictures are included) before it is written.
- **Suggestions only.** What comes back from the model is a *suggestion* with its reasoning, never a verdict. It lands in the same place as tool
  suggestions (`ChecklistAnswer.suggested`, `ImageReview.auto`, `source`), counted "to confirm" until the auditor confirms.
- **Minimal and safe data.** No cookies, no storage, no logged-in content beyond what the auditor scanned; strip `<script>` bodies and long inline `data:` URLs from
  HTML; warn that an audited page may contain personal data (names, forms) and let the owner exclude a page or a theme.
- **Traceable.** Every imported suggestion records the model name (typed by the owner), the pack id, the date and the prompt version.
- **No new network call from the extension.**

## 2. The pack (export)

A folder-in-a-zip, `audit-pack-<site>-<date>.zip`, openable by a person and readable by a model:

```
README.md              what this is, how to answer (the contract in section 3), rules (suggestions only, evidence-based, say "unsure")
manifest.json          pack id, audit id, rgaa version, audit level (rapide/complémentaire/complet), page list, file list, counts, schema version
criteria.json          the criteria in scope with the official title, the tests, the conditions (from rgaa-tests.json)
pages/P01/page.json    url, title, the themes scanned, a compact outline (headings, landmarks, language, title)
pages/P01/elements.jsonl   ONE ELEMENT PER LINE: id, theme, type, accessible name data, the tool's suggestion + evidence, the human answer if any,
                           html (cleaned), context_html (trimmed), picture file name
pages/P01/pictures/<id>.png   the photo of each element (the `shot`, else the `thumb`), real PNG files, not base64
pages/P01/checklist.json   the criteria answered at page level, with notes and sources
pages/P01/tool-results.json   the axe / own rules / Asqatasun-derived results mapped to criteria
answers-template.jsonl one line per (page, criterion) or (page, element, criterion) still open, **empty verdict fields to fill**
```

Choices to make explicit in the preview:
- **Include pictures** (default on; they are what lets a model judge alt-text relevance, 1.3, and contrast) with a size note and a maximum
  dimension (resize to 512 px on the longest side to keep the pack small).
- **Scope:** all open items, or only those marked "à vérifier"; one page, or the whole sample; chosen themes.
- **Page snapshot:** include the compact outline, not the whole DOM, unless asked.

Sizes: today's real audit is 4.7 MB with inline pictures; as files it will be similar; a pack above ~30 MB should warn and offer to split by page.

Implementation notes: new `src/lib/audit-pack.ts` (pure: audit → list of `{path, content}`), reuse `src/lib/xlsx.ts`'s zip writer or add a small zip writer
(check the dependency rule in `THIRD-PARTY.md`; prefer our own stored-only zip like the xlsx one). Panel: a button « Exporter pour analyse (LLM) »
in *Synthèse et exports*, with the preview dialog. Unit tests for the pack content (no `<script>` text, no secrets, stable ids, pictures referenced exist).

## 3. The answer contract (what the model, or a colleague, fills in)

`answers.jsonl`, one JSON object per line, matching `answers-template.jsonl`:

```json
{"pack":"<pack id>","page":"P01","scope":"element","element":"img-12","criterion":"1.3","verdict":"nc","confidence":"medium",
 "reason":"The alt says 'image' but the picture shows a bar chart of ...","evidence":["alt","picture"],"model":"<free text>","prompt_version":"1"}
```

- `verdict`: `c` | `nc` | `na` | `unsure` (anything else is rejected).
- `scope`: `element` (images, links, forms…), `page` (checklist criteria), `sample` (cross-page criteria such as 12.x).
- `reason` is required for `nc` and `unsure`. `confidence`: `low|medium|high`.
- Unknown pack id, page, element or criterion → reported, never guessed.
- The same schema serves **a spreadsheet**: the pack also writes `answers-template.xlsx` (one row per open item, columns documented in a sheet)
  so a colleague can fill it in Excel; the importer reads `.jsonl` and `.xlsx`.

## 4. The import (merge, never overwrite)

New « Importer des réponses » in *Synthèse et exports*:
1. Pick the file. Validate against the schema (`src/lib/audit-validate.ts` style: strict, size caps, no prototype keys).
2. **Preview, nothing written yet:** « 41 suggestions will be added · 6 differ from your confirmed answer (kept) · 3 notes added · 2 rows unknown (listed) ».
   Per row: element picture, the model's verdict and reason, your current answer, a checkbox to take it.
3. **Rules:** a confirmed human answer is never replaced; a model verdict becomes a suggestion (`source: 'llm'`, with model, date, pack id, reason as note);
   `unsure` becomes a note only. Conflicts with the tool's own suggestion are shown as *conflicting evidence* (existing `evidenceConflicts`).
4. After import the normal flow applies: the auditor confirms or changes each suggestion; the rate stays provisional until then.
5. The merge is one undoable step (keep the pre-import state in memory, offer « Annuler l'import » until the next edit).

Data model: add `'llm'` to the evidence `source` union (`src/lib/evidence.ts`, `types.ts`), a `provenance` object on suggestions
(`{model, packId, at, promptVersion}`), migration to audit format v5 only if a required field is added (optional fields need no migration;
add the validator and a test either way). Excel/report: a suggestion from an LLM is labelled « suggestion IA, non confirmée » and never counted.

## 5. The report from the updated data

Already generated from the audit (grid, rates, draft statement). Add: a section « Analyse assistée » listing how many answers came from tools, from an
LLM (with model names) and from the auditor, so the report is honest about its sources. No change to how rates are computed.

## 6. Work packages (suggested order)

| # | Package | Size | Notes |
| --- | --- | --- | --- |
| L1 | `audit-pack.ts` + zip writer + unit tests (content, cleaning, pictures as files) | M | no UI yet |
| L2 | Export dialog with preview and options (pictures, scope, level) | M | after L1 |
| L3 | `answers` schema, validator, `answers-template.jsonl` + `.xlsx` | M | can run with L1 |
| L4 | Import with preview and merge rules, `source: 'llm'`, provenance, undo | L | after L3; e2e on the fixture |
| L5 | Report section « Analyse assistée » + labels in Excel | S | after L4 |
| L6 | A prompt file for the model (`docs/llm-prompt.md`), checked against 20 elements the owner already audited | S | measure agreement before trusting it |

Do L1 → L3 first (the owner can already use a model by hand with the pack and fill the template), then L4.

## 7. Questions for the owner

1. Which model/route will be used first: copy-paste into a chat (needs a size-limited pack, maybe a text-only mode), an upload of the zip, or a local model?
2. Should the pictures be included by default, or opt-in per pack? (They may show personal data.)
3. Is a spreadsheet template enough for colleagues, or do they need the JSON too?
4. Should an LLM verdict ever pre-fill the answer fields (as `auto` pre-fills do) or only appear as a separate « suggestion IA » to accept one by one? (Proposal: separate, accept one by one, with a bulk accept per criterion only after a look.)
5. Do you want the audit level (rapide / complémentaire / complet) to limit the pack to the criteria of the level? (Proposal: yes, by default.)
