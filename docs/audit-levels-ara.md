# Audit levels of the DINUM method (Ara): the criteria lists

Collected 2026-10-13 by Claude Code from the DINUM design-system pages
[Audit rapide](https://design.numerique.gouv.fr/outils/audit-rapide/) and
[Audit complémentaire](https://design.numerique.gouv.fr/outils/audit-complementaire/).
Both work on a reduced sample of 3 to 5 pages; they give **no compliance rate and no accessibility statement** (only the full audit does).
Cross-check done: all 50 ids exist in `src/rgaa/rgaa-tests.json` and the titles of the rapide list match the RGAA 4.1 text.
**Still to verify by a human against the two pages before the lists are coded** (they were read by a summarising tool; the complementary list was paraphrased).

## Audit rapide (25 criteria, WCAG level A)

1.1 · 3.1 · 4.1 · 4.10 · 5.3 · 5.7 · 6.1 · 6.2 · 7.1 · 7.3 · 8.3 · 8.4 · 8.5 · 9.1 · 10.3 · 10.6 · 10.7 · 11.1 · 11.2 · 11.5 · 11.6 · 11.9 · 11.10 · 12.8 · 12.9

## Audit complémentaire (the next 25, so 50 in total)

1.3 · 1.5 · 1.6 · 1.7 · 4.2 · 4.4 · 4.8 · 4.9 · 5.4 · 5.6 · 7.2 · 8.2 · 8.6 · 8.10 · 10.2 · 10.8 · 10.9 · 10.10 · 13.1 · 13.3 · 13.4 · 13.5 · 13.6 · 13.7 · 13.8

## Audit complet: all 106 criteria.

## Use in the app (proposal, not built)
An audit level per audit (rapide 25 / complémentaire 50 / complet 106): progress, "Reste à faire" and the rate cover the chosen level only,
other criteria stay visible as "hors palier", and the rate, Excel and report say which level they were computed at
(never a compliance rate for a partial level).
