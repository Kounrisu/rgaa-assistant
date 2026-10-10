# RGAA Assistant — note pour la revue informatique et juridique

*Version du 2026-10-10. Document d'information rédigé à partir du code du projet ; il ne constitue pas un avis juridique. Les points marqués « à vérifier » doivent être confirmés par vos équipes.*

## 1. À quoi sert l'outil
Extension de navigateur (Chrome, Firefox) qui aide un auditeur ou une auditrice à contrôler l'accessibilité d'une page selon le RGAA 4.1. Elle apparaît comme un onglet des outils de développement. Elle numérote et repère des éléments (images, cadres, contrastes), lance des contrôles automatiques (moteur axe-core et contrôles propres au RGAA), propose des contrôles manuels, et exporte la grille d'audit en Excel. **Les résultats sont une aide : la personne qui audite valide chaque verdict.**

## 2. Permissions demandées et pourquoi
| Permission | Pourquoi |
|---|---|
| Accès à tous les sites (`<all_urls>`) | Lire la page inspectée et y dessiner les repères. L'extension ne fait rien sur la page tant qu'une analyse n'est pas lancée depuis le panneau (à vérifier en recette). |
| `activeTab`, `scripting` | Injecter le moteur axe-core dans la page inspectée, **uniquement au clic** sur « Lancer les contrôles automatiques ». |
| `storage`, `unlimitedStorage` | Enregistrer les audits dans le navigateur (aperçus d'éléments inclus). |
| Page d'options | Page « Couverture RGAA » (liste des tests). |

## 3. Où vont les données
- **Rien n'est envoyé à un serveur de l'éditeur** : pas de télémétrie, pas de statistiques d'usage, pas de service distant. Le code ne contient aucune adresse de collecte.
- Les audits sont stockés **localement** dans le navigateur (`chrome.storage.local`). L'utilisateur peut les enregistrer dans un fichier `.rgaa.json` et les rouvrir ; ce fichier contient tout l'audit (URL, extraits de code HTML, **copie du HTML des pages capturées**, aperçus, notes). **Il doit être traité comme un document de travail interne.**
- Une requête réseau existe dans le code : à l'export Excel, l'extension télécharge les images des pages auditées (leurs propres URL) pour les placer en aperçu dans le fichier. Aucun autre domaine n'est contacté.
- Les liens « Tests officiels » ouvrent le site officiel du RGAA (accessibilite.numerique.gouv.fr) dans un nouvel onglet, à l'initiative de l'utilisateur.
- Aucun code distant n'est chargé : le moteur axe-core est une copie locale incluse dans l'extension.

## 4. Licences des composants
- **axe-core** (Deque) : MPL-2.0, avec un correctif minimal appliqué à la compilation (suppression des appels `Function()`/`eval`, pour fonctionner sur les sites à politique CSP stricte) ; le correctif est public dans le dépôt (`scripts/patch-axe.mjs`).
- **fflate** : MIT (compression de l'export Excel et des copies du HTML).
- **html-validate** : MIT, validation du HTML capturé, entièrement locale.
- **Asqatasun / Tanaguru** : AGPL-3.0. Des sélecteurs et définitions de règles RGAA en sont adaptés, **isolés dans un fichier de données et des blocs balisés** pour pouvoir être retirés (le retrait supprime aussi nos contrôles remplacés par ceux d’Asqatasun : voir `NOTICE.md`). Tant qu'ils sont présents, le projet est diffusé sous **AGPL-3.0** : qui reçoit l'extension peut obtenir son code source. Pour un usage interne sans diffusion à des tiers, les obligations sont limitées (à valider par le juridique).
- Données RGAA officielles : DINUM (conditions de réutilisation à vérifier).
- Inventaire détaillé et marche à suivre pour retirer un composant : `THIRD-PARTY.md` et `NOTICE.md` à la racine du dépôt.

## 5. Propriété et mise à disposition
- À clarifier : à qui appartient l'outil (contrat de travail, cadre de développement) et sous quelle licence il est mis à disposition de l'établissement.
- Le dépôt est public : https://github.com/Kounrisu/rgaa-assistant

## 6. Déploiement possible
Chargement depuis un paquet interne ou une boutique d'entreprise (à voir avec le service informatique), plutôt que depuis les boutiques publiques. Les versions sont reproductibles : `npm install` puis `npm run build`.

## 7. Limites
Les contrôles automatiques ne couvrent qu'une partie du RGAA. Un contrôle sans résultat n'établit pas la conformité : l'outil ne marque jamais un critère « conforme » à partir d'un contrôle automatique. L'analyse humaine, le lecteur d'écran et la navigation clavier restent nécessaires.
