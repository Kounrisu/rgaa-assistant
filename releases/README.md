# Testing RGAA Assistant on another computer / Tester RGAA Assistant sur un autre ordinateur

`rgaa-assistant-<version>-<commit>.zip` is the built extension (the contents of `dist/`, `manifest.json` at the root) made from that commit.
It is **not signed**: it is for testing, not for distribution. Source and build: see the main `README.md` (`npm install`, `npm run build`).

## Current test build — 16 October 2026

[Download the built extension (v0.1.0-22d0e15)](https://github.com/Kounrisu/rgaa-assistant/releases/download/v0.1.0-22d0e15/rgaa-assistant-0.1.0-22d0e15.zip).
[Release notes](https://github.com/Kounrisu/rgaa-assistant/releases/tag/v0.1.0-22d0e15).
This build includes the merged audit fixes and reading/structure tools. The ZIP and its SHA-256 checksum are also in this folder.

## Firefox (the browser the project targets, 121 or later)

**Quick test (lasts until Firefox is closed)**
1. Open `about:debugging#/runtime/this-firefox`.
2. **Load Temporary Add-on…** and pick the `.zip` file (or the `manifest.json` of the unzipped folder).
3. Give it access to the sites: `about:addons` → RGAA Assistant → **Permissions** → allow *Access your data for all websites*.
4. Open a page, press **F5**, open the DevTools (**F12**): the **RGAA Assistant** tab is there.

**Kept after a restart**: Firefox Release and Beta refuse unsigned add-ons. Use Firefox Developer Edition or Nightly, set
`xpinstall.signatures.required` to `false` in `about:config`, then `about:addons` → gear → **Install Add-on From File…** → the `.zip`.
(Or have the add-on signed as *unlisted* on addons.mozilla.org.)

## Chrome, Edge, Brave (Chromium)
1. Unzip the file into a folder (Chrome does not load a `.zip`).
2. `chrome://extensions` → switch on **Developer mode** → **Load unpacked** → the folder.
3. Open a page, press **F5**, open the DevTools (**F12**): the **RGAA Assistant** tab is there (it can be behind the `»` menu).

## Good to know
- Audits are kept **in that browser** (extension storage). To move one between computers: **Enregistrer** (downloads a `.rgaa.json` file) on one,
  **Ouvrir** on the other; if the same audit is already there you are asked to replace it or import it as a copy, with both dates.
- After loading a new version, reload the extension **and** the inspected page.
- Update by loading the new zip over the old one (temporary add-on: remove, then load again).

## En français
`rgaa-assistant-<version>-<commit>.zip` est l’extension compilée (contenu de `dist/`, `manifest.json` à la racine). Elle n’est **pas signée** : test uniquement.

**Firefox, test rapide (jusqu’à la fermeture de Firefox)** : `about:debugging#/runtime/this-firefox` → **Charger un module complémentaire temporaire…** → le `.zip` →
`about:addons` → RGAA Assistant → **Permissions** → autoriser *Accéder à vos données pour tous les sites web* → ouvrir une page, **F5**, **F12** : onglet **RGAA Assistant**.
**Conservé après redémarrage** : Firefox Release/Beta refusent les modules non signés ; utiliser Developer Edition ou Nightly avec `xpinstall.signatures.required = false`
(`about:config`), puis `about:addons` → engrenage → **Installer un module depuis un fichier…**.
**Chrome / Edge** : décompresser le `.zip`, `chrome://extensions` → **Mode développeur** → **Charger l’extension non empaquetée** → le dossier.
Les audits restent dans le navigateur de cet ordinateur : **Enregistrer** puis **Ouvrir** pour les déplacer (le fichier `.rgaa.json`).
