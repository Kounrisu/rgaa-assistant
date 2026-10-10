# RGAA Assistant — note for IT and legal review

*Version of 2026-10-10. Information written from the project's code; it is not legal advice. Points marked "to verify" must be confirmed by your teams.*

## 1. What it is for
A browser extension (Chrome, Firefox) that helps an auditor check a page against RGAA 4.1. It appears as a tab in the developer tools. It numbers and locates elements (images, frames, contrast), runs automatic checks (the axe-core engine and our own RGAA checks), offers manual checks, and exports the audit grid to Excel. **The results are an aid: the auditor confirms every verdict.**

## 2. Permissions and why
| Permission | Why |
|---|---|
| Access to all sites (`<all_urls>`) | Read the inspected page and draw the markers on it. The extension does nothing on the page until a scan is started from the panel (to verify during acceptance testing). |
| `activeTab`, `scripting` | Inject the axe-core engine into the inspected page, **only when** "Run the automatic checks" is clicked. |
| `storage`, `unlimitedStorage` | Keep audits in the browser (including element previews). |
| Options page | "RGAA coverage" page (list of tests). |

## 3. Where the data goes
- **Nothing is sent to a server run by the author**: no telemetry, no usage statistics, no remote service. The code contains no collection address.
- Audits are stored **locally** in the browser (`chrome.storage.local`). The user can save them to a `.rgaa.json` file and reopen it; that file holds the whole audit (URLs, HTML excerpts, **a copy of the captured pages' HTML**, previews, notes). **Treat it as an internal working document.**
- One network request exists in the code: when exporting to Excel, the extension downloads the images of the audited pages (from their own URLs) to place previews in the file. No other domain is contacted.
- The "Official tests" links open the official RGAA site (accessibilite.numerique.gouv.fr) in a new tab, when the user clicks.
- No remote code is loaded: the axe-core engine is a local copy shipped with the extension.

## 4. Component licences
- **axe-core** (Deque): MPL-2.0, with a minimal patch applied at build time (removes `Function()`/`eval` calls so it runs on sites with a strict CSP); the patch is public in the repository (`scripts/patch-axe.mjs`).
- **fflate**: MIT (compression for the Excel export and the HTML copies).
- **html-validate**: MIT, validates the captured HTML, entirely local.
- **Asqatasun / Tanaguru**: AGPL-3.0. Selectors and RGAA rule definitions are adapted from it, **isolated in one file** so they can be removed. While they are present the project is distributed under **AGPL-3.0**: anyone who receives the extension can obtain its source. For internal use without passing it to third parties, the obligations are limited (to confirm with legal).
- Official RGAA data: DINUM (reuse terms to verify).
- Detailed inventory and removal steps: `THIRD-PARTY.md` and `NOTICE.md` at the repository root.

## 5. Ownership and availability
- To clarify: who owns the tool (employment contract, development context) and under which licence it is made available to the institution.
- The repository is public: https://github.com/Kounrisu/rgaa-assistant

## 6. Possible deployment
Load from an internal package or a corporate store (to discuss with IT), rather than the public stores. Builds are reproducible: `npm install` then `npm run build`.

## 7. Limits
Automatic checks cover only part of the RGAA. A check with no result does not prove compliance: the tool never marks a criterion "compliant" from an automatic check. Human review, screen reader testing and keyboard navigation remain necessary.
