/** French for the texts of src/lib/*.ts and the coverage page (src/rgaa). Key = the English text. */
export const FR_LIB: Record<string, string> = {
  /* ---- rgaa.ts: criteria 1.x (question, checks) ---- */
  'Does this informative image have a text alternative?': 'Cette image porteuse d’information a-t-elle une alternative textuelle ?',
  '<img> has an alt attribute with text, or an aria-label / aria-labelledby / title that gives it a name.':
    '<img> a un attribut alt renseigné, ou un aria-label / aria-labelledby / title qui lui donne un nom.',
  'Same rule for role="img", <input type="image">, <area>, <svg role="img">, <canvas>, <object>, <embed>.':
    'Même règle pour role="img", <input type="image">, <area>, <svg role="img">, <canvas>, <object>, <embed>.',
  'Is this decorative image properly ignored by assistive technologies?': 'Cette image de décoration est-elle correctement ignorée par les technologies d’assistance ?',
  '<img> has alt="" (empty) and no title, aria-label or aria-labelledby…': '<img> a un alt="" (vide) et ni title, ni aria-label, ni aria-labelledby…',
  '…or it is hidden with role="presentation" / role="none" or aria-hidden="true" (role="presentation" is preferred for support).':
    '…ou elle est masquée avec role="presentation" / role="none" ou aria-hidden="true" (role="presentation" est préférable pour la compatibilité).',
  'A decorative image with a caption is out of scope here: it falls under 1.9.': 'Une image de décoration avec légende n’est pas concernée ici : elle relève du critère 1.9.',
  'Is the text alternative relevant — does it convey the same information or function as the image?':
    'L’alternative textuelle est-elle pertinente : transmet-elle la même information ou la même fonction que l’image ?',
  'The alternative gives the same information as the image (not a file name, not just “image” or “photo”).':
    'L’alternative donne la même information que l’image (pas un nom de fichier, pas seulement « image » ou « photo »).',
  'If the image is inside a link or button, the alternative describes the destination or the action.':
    'Si l’image est dans un lien ou un bouton, l’alternative décrit la destination ou l’action.',
  'If the image contains text, the alternative includes that text.': 'Si l’image contient du texte, l’alternative reprend ce texte.',
  'The alternative is short and concise (test 1.3.9). CAPTCHAs and image tests are handled by 1.4, not here.':
    'L’alternative est courte et concise (test 1.3.9). Les CAPTCHA et les images-test relèvent du critère 1.4, pas d’ici.',
  'Is the image complex enough (chart, map, diagram…) to need a detailed description — and does it have one?':
    'L’image est-elle assez complexe (graphique, carte, schéma…) pour nécessiter une description détaillée, et en a-t-elle une ?',
  'A short alternative is enough for most images → answer Not applicable.': 'Une alternative courte suffit pour la plupart des images → répondre Non applicable.',
  'For complex images, a detailed description exists: adjacent text, an adjacent link or button, or aria-label / aria-labelledby.':
    'Pour les images complexes, une description détaillée existe : texte adjacent, lien ou bouton adjacent, ou aria-label / aria-labelledby.',
  'longdesc is obsolete (HTML5) and aria-describedby is not recommended on <img>, <object>, <embed>, <canvas>.':
    'longdesc est obsolète (HTML5) et aria-describedby n’est pas recommandé sur <img>, <object>, <embed>, <canvas>.',
  'If there is a detailed description, is it relevant and as informative as the image?': 'S’il y a une description détaillée, est-elle pertinente et aussi informative que l’image ?',
  'The description conveys the same information as the image.': 'La description transmet la même information que l’image.',
  'It is reachable by assistive technologies (adjacent text/link/button, or aria-label / aria-labelledby).':
    'Elle est accessible aux technologies d’assistance (texte/lien/bouton adjacent, ou aria-label / aria-labelledby).',
  'If the image is text rendered as a picture, could it be real styled text instead?': 'Si l’image est du texte rendu sous forme d’image, pourrait-elle être remplacée par du texte stylé ?',
  'Images of text should be replaced by styled HTML/CSS text when technically possible.': 'Les images texte doivent être remplacées par du texte HTML/CSS stylé lorsque c’est techniquement possible.',
  'Not applicable: logos, trade names, CAPTCHAs, image tests, or images where graphic exactness is essential.':
    'Non applicable : logos, noms commerciaux, CAPTCHA, images-test, ou images dont la précision graphique est essentielle.',
  'Also fine: a substitute mechanism, or text that relies on a graphic effect CSS cannot reproduce.':
    'Également acceptable : un mécanisme de remplacement, ou un texte reposant sur un effet graphique que le CSS ne sait pas reproduire.',
  'Not an image of text → Not applicable.': 'Ce n’est pas une image texte → Non applicable.',
  'If the image has a visible caption, is it programmatically associated with it?': 'Si l’image a une légende visible, lui est-elle associée par programmation ?',
  'The image and its caption sit in a <figure> (with role="figure" or role="group").': 'L’image et sa légende sont dans un <figure> (avec role="figure" ou role="group").',
  'The <figure> has an aria-label matching the caption text, and the caption is in a <figcaption>.':
    'Le <figure> a un aria-label identique au texte de la légende, et la légende est dans un <figcaption>.',
  'A captioned image must also pass 1.1 and 1.3.': 'Une image légendée doit aussi satisfaire les critères 1.1 et 1.3.',
  'No caption → Not applicable.': 'Pas de légende → Non applicable.',

  /* ---- rgaa.ts: DETECTED_LABEL ---- */
  'Ignored by assistive tech': 'Ignorée par les technologies d’assistance',
  'Has a text alternative': 'A une alternative textuelle',
  'No text alternative': 'Pas d’alternative textuelle',

  /* ---- rgaa.ts: hints ---- */
  'Ignored by assistive tech ({by}) — is it really decorative?': 'Ignorée par les technologies d’assistance ({by}) : est-elle vraiment décorative ?',
  'No accessible name found on this {type}.': 'Aucun nom accessible trouvé sur cet élément ({type}).',
  'Accessible name found: “{name}”': 'Nom accessible trouvé : « {name} »',
  'Hidden from assistive tech ({by}).': 'Masquée aux technologies d’assistance ({by}).',
  'Hidden from assistive tech ({by}). It also has {extra}, which assistive tech will not read — remove it if it is not needed.':
    'Masquée aux technologies d’assistance ({by}). Elle a aussi {extra}, que les technologies d’assistance ne liront pas : à supprimer si inutile.',
  'Ignored by assistive tech ({by}) and has no accessible name.': 'Ignorée par les technologies d’assistance ({by}) et sans nom accessible.',
  'Ignored ({by}) but also has {extra} — remove it.': 'Ignorée ({by}) mais elle a aussi {extra} : à supprimer.',
  'Has {extra} — a decorative image must not have an accessible name.': 'A {extra} : une image de décoration ne doit pas avoir de nom accessible.',
  'Not hidden from assistive tech: add aria-hidden="true" or alt="".': 'Non masquée aux technologies d’assistance : ajouter aria-hidden="true" ou alt="".',
  'Not hidden from assistive tech: add aria-hidden="true".': 'Non masquée aux technologies d’assistance : ajouter aria-hidden="true".',
  'Not ignored: alt is “{alt}” — a decorative image should have alt="".': 'Non ignorée : alt vaut « {alt} » ; une image de décoration doit avoir alt="".',
  'The alternative looks like a file name.': 'L’alternative ressemble à un nom de fichier.',
  'The alternative is {n} characters long — it should be short and concise (1.3.9).': 'L’alternative fait {n} caractères : elle doit être courte et concise (1.3.9).',
  'Image is inside a link: the alternative should describe where the link goes.': 'L’image est dans un lien : l’alternative doit décrire la destination du lien.',
  'Only charts, maps, diagrams and infographics usually need a detailed description.': 'Seuls les graphiques, cartes, schémas et infographies nécessitent en général une description détaillée.',
  '<figcaption> found: “{caption}”': '<figcaption> trouvé : « {caption} »',
  'No <figcaption> found around this image.': 'Aucun <figcaption> trouvé autour de cette image.',

  /* ---- findings.ts ---- */
  'Does this frame have a title (title attribute)?': 'Ce cadre a-t-il un titre (attribut title) ?',
  'Every <iframe> / <frame> has a non-empty title attribute (test 2.1.1).': 'Chaque <iframe> / <frame> a un attribut title non vide (test 2.1.1).',
  'aria-label alone does not satisfy this criterion.': 'aria-label seul ne satisfait pas ce critère.',
  'Is the frame title relevant?': 'Le titre du cadre est-il pertinent ?',
  'The title says what the frame contains or what it is for (test 2.2.1).': 'Le titre dit ce que contient le cadre ou à quoi il sert (test 2.2.1).',
  'Not “iframe”, a file name or a URL.': 'Pas « iframe », ni un nom de fichier, ni une URL.',
  'Is the contrast between this text and its background high enough?': 'Le contraste entre ce texte et son arrière-plan est-il suffisant ?',
  'Text under 24 px (or bold under 18.5 px): ratio of at least 4.5:1.': 'Texte de moins de 24 px (ou en gras de moins de 18,5 px) : rapport d’au moins 4,5:1.',
  'Text of 24 px or more (or bold from 18.5 px): ratio of at least 3:1.': 'Texte de 24 px ou plus (ou en gras à partir de 18,5 px) : rapport d’au moins 3:1.',
  'Exceptions: disabled controls, purely decorative text, logos, text that is part of a picture with no information role.':
    'Exceptions : contrôles désactivés, texte purement décoratif, logos, texte faisant partie d’une image sans rôle informatif.',
  'No title attribute on this frame.': 'Aucun attribut title sur ce cadre.',
  'The title attribute is empty.': 'L’attribut title est vide.',
  'title found: “{title}”': 'title trouvé : « {title} »',
  'No title to judge: 2.1 fails first.': 'Pas de titre à évaluer : le 2.1 échoue d’abord.',
  '“{title}” is generic: it does not say what the frame contains.': '« {title} » est générique : il ne dit pas ce que contient le cadre.',
  'The title looks like a URL or a file name.': 'Le titre ressemble à une URL ou à un nom de fichier.',
  'Read the title and the frame content: does it describe them?': 'Lisez le titre et le contenu du cadre : le décrit-il ?',
  '{pass} text element(s) pass their threshold (checked {total}).': '{pass} élément(s) de texte atteignent leur seuil ({total} vérifié(s)).',
  'The background is an image, a gradient, a translucent layer or something placed over the text: a script cannot compute the ratio. Check it by eye or with a colour picker.':
    'L’arrière-plan est une image, un dégradé, une couche translucide ou un élément placé par-dessus le texte : un script ne peut pas calculer le rapport. Vérifiez à l’œil ou avec une pipette de couleur.',
  'Ratio {ratio} is below the required {required}. Check the exceptions (disabled, decorative, logo) before confirming.':
    'Le rapport {ratio} est inférieur au rapport requis {required}. Vérifiez les exceptions (désactivé, décoratif, logo) avant de confirmer.',

  /* ---- themes.ts: THEME_LABEL ---- */
  Images: 'Images',
  Frames: 'Cadres',
  Colours: 'Couleurs',
  Multimedia: 'Multimédia',
  Tables: 'Tableaux',
  Links: 'Liens',
  Scripts: 'Scripts',
  'Mandatory elements': 'Éléments obligatoires',
  Structure: 'Structure',
  Presentation: 'Présentation',
  Forms: 'Formulaires',
  Navigation: 'Navigation',
  Consultation: 'Consultation',

  /* ---- results.ts ---- */
  Compliant: 'Conforme',
  'Non-compliant': 'Non conforme',
  'Not applicable': 'Non applicable',
  'To review': 'À relire',
  'Not assessed': 'Non testé',
  'CAPTCHAs and test images are not covered by this extension yet.': 'Les CAPTCHA et les images-test ne sont pas encore couverts par cette extension.',
  'Server-side image maps (ismap) are not detected.': 'Les images cartes côté serveur (ismap) ne sont pas détectées.',
  'Canvas fallback content is not assessed separately.': 'Le contenu de remplacement d’un canvas n’est pas évalué séparément.',
  'Conciseness is part of your 1.3 verdict on each image.': 'La concision fait partie de votre verdict 1.3 sur chaque image.',
  'The reference to a detailed description is not assessed separately.': 'Le renvoi vers une description détaillée n’est pas évalué séparément.',
  'No such element on the page.': 'Aucun élément de ce type dans la page.',
  '{n} non-compliant image(s).': '{n} image(s) non conforme(s).',
  '{n} image(s) still to review.': '{n} image(s) encore à relire.',
  '{n} image(s) checked.': '{n} image(s) vérifiée(s).',
  'No image of this kind concerned by the test.': 'Aucune image de ce type n’est concernée par le test.',

  /* ---- coverage page (src/rgaa) ---- */
  'RGAA 4.1 — what can be automated?': 'RGAA 4.1 : que peut-on automatiser ?',
  'RGAA 4.1 — Test automation coverage': 'RGAA 4.1 : couverture de l’automatisation des tests',
  'Every test of the 13 themes, classified as': 'Chaque test des 13 thématiques, classé comme',
  automatic: 'automatique',
  'semi-automatic': 'semi-automatique',
  or: 'ou',
  manual: 'manuel',
  'Official data from': 'Données officielles issues de',
  "The classification is this project's own estimate, not an official one.": 'La classification est une estimation propre à ce projet, pas une classification officielle.',
  Legend: 'Légende',
  Filters: 'Filtres',
  Automatic: 'Automatique',
  'Semi-automatic': 'Semi-automatique',
  Manual: 'Manuel',
  'A script can reach a pass / fail verdict from the page (DOM, CSS, source) with no human judgement.':
    'Un script peut conclure conforme / non conforme à partir de la page (DOM, CSS, source) sans jugement humain.',
  'A script finds the elements and checks the technical part; a human confirms scope or relevance.':
    'Un script repère les éléments et vérifie la partie technique ; un humain confirme le périmètre ou la pertinence.',
  'Needs a human: reading, listening, keyboard or assistive-technology testing, or several pages.':
    'Nécessite un humain : lecture, écoute, test au clavier ou avec une technologie d’assistance, ou plusieurs pages.',
  'Search criteria and tests': 'Rechercher des critères et des tests',
  'Search a criterion, a tag, a word… (e.g. alt, contraste, 11.1)': 'Rechercher un critère, une balise, un mot… (ex. alt, contraste, 11.1)',
  'Filter by automation level': 'Filtrer par niveau d’automatisation',
  Language: 'Langue',
  'Expand all': 'Tout déplier',
  'Collapse all': 'Tout replier',
  All: 'Tous',
  '{auto} automatic, {semi} semi-automatic, {manual} manual': '{auto} automatique(s), {semi} semi-automatique(s), {manual} manuel(s)',
  'tests in {criteria} criteria, {themes} themes': 'tests dans {criteria} critères, {themes} thématiques',
  '· {criteria} criteria · {tests} tests': '· {criteria} critères · {tests} tests',
  'in this extension': 'dans cette extension',
  'Script: ': 'Script : ',
  'Human: ': 'Humain : ',
  'WCAG: {list}': 'WCAG : {list}',
  '{n} test(s) shown. Official wording: {url}': '{n} test(s) affiché(s). Libellé officiel : {url}',
  'No test matches this filter.': 'Aucun test ne correspond à ce filtre.',
  'Keyboard': 'Clavier',
  'Zoom and display': 'Zoom et affichage',
  'Screen reader': 'Lecteur d’écran',
  'Content': 'Contenu',
  'With the Tab key only, every link, button and field can be reached and used.': 'Avec la seule touche Tab, chaque lien, bouton et champ peut être atteint et utilisé.',
  'The focus is always visible and the tab order follows the reading order.': 'Le focus est toujours visible et l’ordre de tabulation suit l’ordre de lecture.',
  'No keyboard trap: you can always leave a menu, a popin or a player with the keyboard.': 'Pas de piège au clavier : on peut toujours quitter un menu, une popin ou un lecteur avec le clavier.',
  'The skip link works and takes you to the main content.': 'Le lien d’évitement fonctionne et mène au contenu principal.',
  'Zoom the text to 200 %: nothing is cut off or overlapping, all content and functions remain.': 'Agrandir le texte à 200 % : rien n’est coupé ni superposé, tous les contenus et fonctions restent disponibles.',
  'Narrow the window to 320 px (zoom 400 %): no horizontal scrolling for the text content.': 'Réduire la fenêtre à 320 px (zoom 400 %) : pas de défilement horizontal pour le contenu textuel.',
  'Increase the text spacing (line 1.5, paragraph 2, letter 0.12, word 0.16 em): no loss of content.': 'Augmenter l’espacement du texte (ligne 1,5, paragraphe 2, lettre 0,12, mot 0,16 em) : aucune perte de contenu.',
  'With the style sheets turned off, the information stays understandable and in a logical order.': 'Feuilles de styles désactivées, l’information reste compréhensible et dans un ordre logique.',
  'With a screen reader (NVDA, VoiceOver…), the page title, headings and landmarks give a clear structure.': 'Avec un lecteur d’écran (NVDA, VoiceOver…), le titre de page, les titres et les repères donnent une structure claire.',
  'Images, icons and buttons are announced with a relevant name.': 'Les images, icônes et boutons sont annoncés avec un nom pertinent.',
  'Each form field is announced with its label, its instructions and its errors.': 'Chaque champ de formulaire est annoncé avec son étiquette, ses consignes et ses erreurs.',
  'Status messages (success, error, loading) are announced without moving the focus.': 'Les messages de statut (succès, erreur, chargement) sont annoncés sans déplacer le focus.',
  'The page has a relevant title and its language is set.': 'La page a un titre pertinent et sa langue est indiquée.',
  'The heading levels form a logical outline (one h1, no jump).': 'Les niveaux de titres forment un plan logique (un h1, pas de saut).',
  'Each link has an explicit purpose, and a new window is announced.': 'Chaque lien a un objectif explicite, et l’ouverture d’une nouvelle fenêtre est annoncée.',
  'Information is never given by colour alone.': 'L’information n’est jamais donnée par la couleur seule.',
  'Videos and audio have captions, a transcript or an audio description where needed.': 'Les vidéos et sons ont des sous-titres, une transcription ou une audiodescription si nécessaire.',
  'Moving, blinking or auto-updating content can be paused or stopped.': 'Les contenus en mouvement, clignotants ou mis à jour automatiquement peuvent être mis en pause ou arrêtés.',
}
