# RGAA Assistant

A browser extension (Manifest V3, TypeScript, Vite + `@crxjs/vite-plugin`) that adds an
**RGAA Assistant** tab to the DevTools and helps you run an RGAA 4.1 audit like the official
Excel grid: a sample of pages (P01, P02…), the criteria of the 13 themes, and an overall
accessibility rate.

- **Images (1), Frames (2), Colours (3)** are scanned: the extension finds the elements, draws
  numbered boxes on the page, shows their code and default verdicts, and you confirm each one.
- **The other themes** are criteria checklists with the official tests.
- Results feed an **Audit pages overview** dashboard and an **.xlsx** export laid out like the
  official grid.

## Develop

```bash
npm install
npm run dev
```

Then load the `dist/` folder as an unpacked extension at
`chrome://extensions` (enable Developer mode first).

## Use

1. Open DevTools (F12) on a page and select the **RGAA Assistant** tab.
2. Click **Scan as P01**. Each URL (ignoring `#fragment`) is a *page of the sample*: P01, P02…
   Use the **Page** selector at the top to switch between saved pages; each has its own images and answers.
3. Choose the RGAA themes to audit on each page (**Themes** menu, or the Sample table). Images (1) is scanned and reviewed image by image; the other 12 themes are criteria checklists (C / NC / NA + note) with the official tests.
4. Open a popin or a tab and click **Rescan P01**: its images are added to the same page.
4. Pick an image (or press `j` / `k`): it is highlighted on the page. Read its code, choose
   informative or decorative, answer each criterion. Ignored images (`alt=""`, `aria-hidden`,
   `role="presentation"`) are pre-filled as decorative and compliant, to confirm.
5. **Page results** shows the official grid for this page, per-test results and per-image detail.
   **Audit overview** shows the dashboard (accessibility rate), the sample form, the criteria
   matrix and one grid per page. Both export the same sheets to **.xlsx**, laid out like the
   official RGAA audit grid (Thématique | Critère | Recommandation | Statut | …).

Everything is saved in `chrome.storage.local`. The accessibility rate is C / (C + NC) per page;
the audit rate is the average of the page rates, as in the RGAA grid.

## Scope

This repo intentionally covers Theme 1 (Images) only, as a standalone
proof of concept for the AI-assisted audit workflow, separate from the
rule-based engine in the `25-rgaa-extension` project.

## License

Distributed under the **GNU Affero General Public License v3.0** (AGPL-3.0-only), see [LICENSE](LICENSE).
This is because the project includes rules adapted from [Asqatasun](https://github.com/Asqatasun/Asqatasun) (AGPL-3.0);
see [NOTICE.md](NOTICE.md) for what was adapted and how to remove it.

## Third-party

- [axe-core](https://github.com/dequelabs/axe-core) (MPL-2.0) runs the automatic checks. It is copied to `dist/axe.min.js` at build time and injected into the inspected page only when you click “Lancer les contrôles automatiques”.
