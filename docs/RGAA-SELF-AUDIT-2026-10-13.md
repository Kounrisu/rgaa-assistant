# RGAA 4.1 self-audit of RGAA Assistant — 2026-10-13

Scope: the DevTools panel (`src/panel/panel.html` and its views) and the coverage page (`src/rgaa/rgaa.html`).
Method: the existing axe e2e test (`e2e/panel-a11y.spec.ts`, passes in light and dark) plus a static review of the HTML, CSS and
the code that builds the views. **Not done yet:** keyboard walk-through, 200 % / 400 % zoom, text spacing, screen reader, forced colors.
Nothing below is a final verdict: it is a list of what to fix or verify first.

## Likely failures (to fix)

| # | Criterion | Where | Problem | Fix |
|---|-----------|-------|---------|-----|
| 1 | 12.7 skip link | `panel.html`, `rgaa.html` | No skip link to `#main-content` (grep for `href="#` finds nothing in the panel; none in the coverage page). | Add a visible-on-focus skip link as the first focusable element. |
| 2 | 13.2 new window | `checklist-view.ts:98`, `findings-view.ts:101,294`, `checks-view.ts:87`, `apg-view.ts:15`, `rgaa.html` lead link | `target="_blank"` links announce the new tab only with a `↗` glyph (or not at all on the coverage page; the criterion-id links in `checks-view.ts` have no warning either). | Add visually-hidden text "(opens in a new tab)" / «(nouvel onglet)» to each link, translated, and remove reliance on the glyph. |

## To verify, then fix if confirmed

| # | Criterion | Where | Concern |
|---|-----------|-------|---------|
| 3 | 10.11 reflow, 10.12 text spacing, 10.4 text resize | `panel.css` (`html, body { overflow: hidden }`, fixed panes at line 48; breakpoints at 640/760/979 px) | Content may be clipped or need 2-D scrolling at 320 CSS px / 400 % zoom, or with the text-spacing bookmarklet. |
| 4 | 6.1 / 6.2 link names | `checks-view.ts:87` links read just "6.1", and "Official tests ↗" repeats on every criterion | Names rely on surrounding context; make them self-describing, e.g. "RGAA 6.1 — official tests". |
| 5 | 3.1 colour alone, forced-colors | `.meter`, `.badge`, level pills in `panel.css` | Meter is a colour-only bar (8 px). No `forced-colors` rules; focus ring uses `outline` (fine) but borders may vanish. |
| 6 | 10.5 / 13.8 motion | `.flash` animation 1.8 s (`panel.css:561`) | Under 5 s, so not a failure, but there is no `prefers-reduced-motion` guard. Add one. |
| 7 | 8.3 / 8.4 language | `rgaa.html` ships `<html lang="en">` | `i18n.ts:27` sets `lang` at runtime; the page is French by default, so the static value is wrong until JS runs. Set the default in the HTML. |
| 8 | 7.1, 7.3, 12.8, 12.9 | custom widgets (roving `tabindex`, tabs with `aria-selected`, disclosures with `aria-expanded`) | Needs a real keyboard + screen-reader pass. |

## Not applicable or out of scope

12.1–12.5 (site-wide navigation, sitemap, search) concern multi-page sites. The panel is a single tool surface inside DevTools
and the coverage page is one page; state this in the accessibility statement rather than claiming compliance.

## What this audit cannot claim

Automated results and a code read do not prove RGAA compliance. A compliance claim needs the full manual pass above, on the real
extension in DevTools (Chrome and Firefox), by a person.
