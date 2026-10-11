# Review of the audit bars and page actions — 2026-10-11

Reviewed application commit: `f7d2c5a` on `master`, including Claude's recent compact page bar, criteria-per-image
progress and faster preview capture. This is an analysis and proposed layout, not an implemented redesign.

## Findings from the current code and browser layout

1. **The page summary mixes scopes.** `src/panel/chrome.ts:299` obtains the progress denominator from
   `countsOf(pageInput(...))`, which counts all 106 criteria (`src/lib/audit-sheet.ts:74`). In contrast,
   `renderSummaries` at `src/panel/chrome.ts:58` filters page status pills to selected themes. The browser fixture
   with Images selected shows `1/106` above status counters covering nine criteria. A visible heading helps,
   but the differing scopes also need to be resolved.
2. **“Actions de la page” mixes unrelated destinations.** `src/panel/panel.html:51` contains next-review navigation,
   page reset/removal, theme reset and a coverage reference link. Its name cannot explain all five actions.
   Claude already moved the scan button onto the page bar (`panel.html:49`); preserve that improvement.
3. **Display tools appear before their context.** The Display tools disclosure is before theme navigation
   (`panel.html:67`), although `src/panel/page-tools-ui.ts:47` chooses controls for the active theme and retains
   active tools. Highlight controls are in another disclosure farther down. This splits related controls and
   makes the display-tools row appear to have a broader scope than it does.
4. **Repeated counters lack clear visible scope.** Page and theme status bars look alike; the page has only an
   accessible label and the theme says “Progression” even though its pills are criterion statuses. Image counts
   and pre-filled-image counts are also appended to the theme's criterion counters (`chrome.ts:96`), mixing units.
5. **Default expanded layout needs its own usability check.** At 480×800 the initial viewport is entirely occupied
   by navigation, summaries and tools. Existing responsive tests deliberately collapse sections before asserting
   that the first answer fits. They verify the compacted state, not the usability of the default expanded state.
   The owner's preference remains: information starts visible. Reduce repeated rows and group controls instead
   of hiding information again.

## Recommended labels and order

Use short visible labels inside existing groups, associated with their accessible names. Do not insert a new
full-height title bar above every existing row.

| Order | Visible label | Content / scope |
| --- | --- | --- |
| 1 | **Audit** | Audit name, Échantillon et suivi, Évaluer la page, Synthèse et exports; file/save controls at the end. Keep the direct return to evaluation. |
| 2 | **Page auditée** | Page selector, Évaluation / Contrôles manuels / Résultats de la page, browser URL and page actions. Let controls wrap in the same group. |
| 3 | **Bilan de la page — P01** | Progress out of all 106 criteria, page-wide criterion statuses and direct next-review action. |
| 4 | **Thématiques RGAA** | Theme navigation with existing compact current/total counts; theme-selection control. |
| 5 | **Bilan de la thématique — Images** | Active theme title and its criterion counts, scoped to this page. Put image/element inventory counts beside the element list instead. |
| 6 | **Outils d’affichage** | A visible contextual area below theme navigation and the active-theme heading, before the elements. Page display aids and element highlighting belong together here. |
| 7 | **Éléments à évaluer** | Existing element list and selected element's evaluation. Use concrete names such as “Images de cette page” where helpful. |

The owner specifically proposed placing Outils d’affichage after theme navigation and removing its collapse
button. This fits the existing code: make the outer label plain text, remove its `<details>/<summary>`, and keep
contextual controls visible. Merge the separate highlight disclosure into this area, with ordinary labels if
needed. Preserve `aria-pressed` states and visibility of tools currently enabled across theme changes. The existing
“Autres outils” expansion is a separate control for tools outside the current theme; its behavior should not be
silently changed when removing the outer collapse control.

## Remove the page-actions dropdown by putting actions in their context

| Current action | Recommended destination |
| --- | --- |
| Analyser / Réanalyser P01 | Visible secondary action in Page auditée. Rename to **Repérer les éléments** initially / **Actualiser les éléments** subsequently, clarifying the difference from automatic checks. |
| Contrôler automatiquement la page ouverte | Visible primary action in Page auditée. It already scans before running the engines (`auto-checks.ts:137`); no separate scan is required first. Keep the browser-page constraint explicit. |
| Suivant à évaluer | Visible beside Bilan de la page; preserve the explicit continuation buttons beside answers. It can cross selected themes. |
| Réinitialiser la page / Retirer la page | Existing row actions in Échantillon et suivi (`sample-view.ts:105`). Remove the duplicated header controls; keep the confirmations and page-specific scope. |
| Réinitialiser la thématique | Secondary text button beside the active theme's heading; show the theme name in its accessible name and confirmation. |
| Couverture RGAA | Reference/help link at the end of the evaluation workspace, outside the page action group. |

Flattening all reset/delete/reference buttons into the main action bar would make it harder to scan. Moving each
one to its relevant area removes the menu without turning the header into a longer button list.

## Counter meaning: use “Bilan”, not “overall findings”

The pills count RGAA criteria, not DOM elements, rule failures, or the whole audit. The page bar should use all 106
criteria consistently with its existing progress meter; the theme bar keeps its smaller local scope. Unselected
themes remain untested, not automatically non-applicable. Clicking a page-wide untested count must be able to
reach the corresponding results row even when its theme is outside the selected review themes: today
`goToSummary` filters to selected themes, so changing the counter filter alone would leave an incorrect destination.

Keep the existing verdict and provisional-rate rules. “À confirmer” and “Couverture partielle” are additional
qualifications that can overlap the status categories: visually separate them with a small **À vérifier** label,
not as extra buckets to add to the total. Preserve the owner's current treatment of pre-filled answers; no automatic
result should newly become a human-confirmed verdict as part of this layout change.

## Useful implementation and regression scope

Use `panel.html`/CSS for hierarchy, `chrome.ts` for scope labels/counts/destinations, shared lookups in `dom.ts`,
handlers in `events.ts`, and English keys with French topic translations. Remove obsolete `pageOptions.open`
accesses when deleting the menu. Keep state/actions/bootstrap architecture and saved audit data unchanged.

Tests should check user outcomes:

- P01/P02 with different answers: changing pages updates the correct labelled summary; theme navigation changes
  only the local summary. With only Images selected, the page summary still accounts for all 106 criteria.
- Status links land on a matching criterion and move keyboard focus, including unselected/unassessed themes;
  zero counts remain disabled. Extra coverage/confirmation badges are not asserted as disjoint totals.
- Automatic checks work without an initial manual scan, preserve human answers, and identify URL mismatches.
- Visible next-review works across themes; answering alone still does not advance.
- Page removal/reset remain available in the sample; cancelling preserves data; resetting a theme leaves others intact.
- At narrow and wide widths, tools appear after the theme navigation, their toggles still work, all actions are
  keyboard reachable and labels wrap without overflow. Inspect the default expanded view, not just a state that
  the test has first compacted. Preserve the owner's expanded defaults.

Keep existing persistence, evidence, keyboard and navigation tests; change menu-position assertions when the menu
is deliberately removed. Review the full DOM parity diff before updating any baseline. This review does not update it.

## Verification for this analysis

- `npm run check`: passed, 189 unit tests, typecheck, 710 used texts / 1229 French entries / 0 missing, build.
- Eight targeted existing browser tests passed: audit navigation; review at 480/768/1280px; three status-navigation
  scenarios; Claude's compact-bar/criteria-progress/manual-help test.
- Inspected current wide and narrow screenshots from those tests in `/tmp/rgaa-bars-review/`.
- Logs: `/tmp/rgaa-bars-review-check.log`, `/tmp/rgaa-bars-review-e2e.log`.
- Full browser suite and parity were not rerun for this documentation-only review. Real Firefox and real DevTools
  were not tested. The assertions passing do not establish that the present hierarchy is easy to understand.
