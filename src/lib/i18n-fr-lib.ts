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
  // --- Asqatasun-derived: begin ---
  /* ---- asqatasun-rules.ts ---- */
  'RGAA {criterion}: no element to check on this page, not applicable.':
    'RGAA {criterion} : aucun élément à contrôler sur cette page, non applicable.',
  'RGAA 1.1.4: {n} server-side image map(s) (ismap): check that every clickable zone has an equivalent usable with any pointing device. Examples: {samples}':
    'RGAA 1.1.4 : {n} image(s) réactive(s) côté serveur (ismap) : vérifier que chaque zone cliquable est doublée d’un mécanisme utilisable quel que soit le dispositif de pointage. Exemples : {samples}',
  'RGAA 1.5.2: {n} image button(s) used as a CAPTCHA: check that an alternative way to access the content exists. Examples: {samples}':
    'RGAA 1.5.2 : {n} bouton(s) image utilisé(s) comme CAPTCHA : vérifier qu’une solution d’accès alternatif au contenu existe. Exemples : {samples}',
  'RGAA 2.1.1: {n} frame(s) without a title attribute. Examples: {samples}':
    'RGAA 2.1.1 : {n} cadre(s) sans attribut title. Exemples : {samples}',
  'RGAA 3.1.5: {n} time-based media found: check that no information is given by colour alone. Examples: {samples}':
    'RGAA 3.1.5 : {n} média(s) temporel(s) détecté(s) : vérifier qu’aucune information n’est donnée uniquement par la couleur. Exemples : {samples}',
  'RGAA 3.1.6: {n} non time-based media found (svg, canvas, object, embed): check that no information is given by colour alone. Examples: {samples}':
    'RGAA 3.1.6 : {n} média(s) non temporel(s) détecté(s) (svg, canvas, object, embed) : vérifier qu’aucune information n’est donnée uniquement par la couleur. Exemples : {samples}',
  'RGAA 7.4.1: {n} script(s) that may change the context (select with onchange, or form with a select and no button): check that the user is warned or has an explicit button. Examples: {samples}':
    'RGAA 7.4.1 : {n} script(s) susceptible(s) de changer le contexte (select avec onchange, ou formulaire avec un select et sans bouton) : vérifier que l’utilisateur est averti ou dispose d’un bouton explicite. Exemples : {samples}',
  'RGAA 8.3.1: the default language of the page is not declared (no lang attribute on <html>).':
    'RGAA 8.3.1 : la langue par défaut de la page n’est pas indiquée (pas d’attribut lang sur <html>).',
  'RGAA 8.5.1: the page has no <title> element in its <head>.':
    'RGAA 8.5.1 : la page n’a pas de balise <title> dans son <head>.',
  'RGAA 8.9.1: {n} link(s) without destination (no href, name or id), probably used for presentation. Examples: {samples}':
    'RGAA 8.9.1 : {n} lien(s) sans destination (ni href, ni name, ni id), probablement utilisé(s) à des fins de présentation. Exemples : {samples}',
  'RGAA 8.9.1: {n} empty <p> or <li> element(s), probably used for layout. Examples: {samples}':
    'RGAA 8.9.1 : {n} balise(s) <p> ou <li> vide(s), probablement utilisée(s) à des fins de mise en forme. Exemples : {samples}',
  'RGAA 8.9.1: {n} <br> element(s) in a row, probably used to space content. Examples: {samples}':
    'RGAA 8.9.1 : {n} balise(s) <br> consécutive(s), probablement utilisée(s) pour espacer le contenu. Exemples : {samples}',
  'RGAA 8.10.2: {n} element(s) with a dir attribute (ltr or rtl): check that each change of reading direction is relevant. Examples: {samples}':
    'RGAA 8.10.2 : {n} élément(s) avec un attribut dir (ltr ou rtl) : vérifier que chaque changement du sens de lecture est pertinent. Exemples : {samples}',
  'RGAA 9.2.1: the page has no visible <main> element.':
    'RGAA 9.2.1 : la page n’a pas de balise <main> visible.',
  'RGAA 9.2.1: {n} visible <main> elements, there should be only one. Examples: {samples}':
    'RGAA 9.2.1 : {n} balises <main> visibles, il ne doit y en avoir qu’une. Exemples : {samples}',
  'RGAA 9.2.1: the page has no <header> element outside <article> and <section>.':
    'RGAA 9.2.1 : la page n’a pas de balise <header> en dehors de <article> et <section>.',
  'RGAA 9.2.1: the page has no <footer> element outside <article> and <section>.':
    'RGAA 9.2.1 : la page n’a pas de balise <footer> en dehors de <article> et <section>.',
  'RGAA 9.2.1: the page has no <nav> element.':
    'RGAA 9.2.1 : la page n’a pas de balise <nav>.',
  'RGAA 10.1.2: {n} element(s) with a width or height attribute used for presentation. Examples: {samples}':
    'RGAA 10.1.2 : {n} élément(s) avec un attribut width ou height servant à la présentation. Exemples : {samples}',
  'RGAA 10.9.2: {n} image(s) found: check that no information is given by shape, size or position alone. Examples: {samples}':
    'RGAA 10.9.2 : {n} image(s) détectée(s) : vérifier qu’aucune information n’est donnée uniquement par la forme, la taille ou la position. Exemples : {samples}',
  'RGAA 10.9.3: {n} time-based media found: check that no information is given by shape, size or position alone. Examples: {samples}':
    'RGAA 10.9.3 : {n} média(s) temporel(s) détecté(s) : vérifier qu’aucune information n’est donnée uniquement par la forme, la taille ou la position. Exemples : {samples}',
  'RGAA 10.9.4: {n} non time-based media found (svg, canvas, object, embed): check that no information is given by shape, size or position alone. Examples: {samples}':
    'RGAA 10.9.4 : {n} média(s) non temporel(s) détecté(s) (svg, canvas, object, embed) : vérifier qu’aucune information n’est donnée uniquement par la forme, la taille ou la position. Exemples : {samples}',
  'RGAA 10.10.2: {n} image(s) found: check that the way shape, size or position convey information is relevant. Examples: {samples}':
    'RGAA 10.10.2 : {n} image(s) détectée(s) : vérifier que la manière dont la forme, la taille ou la position véhiculent l’information est pertinente. Exemples : {samples}',
  'RGAA 10.10.3: {n} time-based media found: check that the way shape, size or position convey information is relevant. Examples: {samples}':
    'RGAA 10.10.3 : {n} média(s) temporel(s) détecté(s) : vérifier que la manière dont la forme, la taille ou la position véhiculent l’information est pertinente. Exemples : {samples}',
  'RGAA 10.10.4: {n} non time-based media found (svg, canvas, object, embed): check that the way shape, size or position convey information is relevant. Examples: {samples}':
    'RGAA 10.10.4 : {n} média(s) non temporel(s) détecté(s) (svg, canvas, object, embed) : vérifier que la manière dont la forme, la taille ou la position véhiculent l’information est pertinente. Exemples : {samples}',
  'RGAA 11.2.1: {n} label(s) in forms: check that each one tells the exact purpose of its field. Examples: {samples}':
    'RGAA 11.2.1 : {n} étiquette(s) <label> dans des formulaires : vérifier que chacune permet de connaître la fonction exacte de son champ. Exemples : {samples}',
  'RGAA 11.2.2: {n} field(s) with a title attribute: check that each one tells the exact purpose of the field. Examples: {samples}':
    'RGAA 11.2.2 : {n} champ(s) avec un attribut title : vérifier que chacun permet de connaître la fonction exacte du champ. Exemples : {samples}',
  'RGAA 11.2.3: {n} field(s) with an aria-label: check that each one tells the exact purpose of the field. Examples: {samples}':
    'RGAA 11.2.3 : {n} champ(s) avec un aria-label : vérifier que chacun permet de connaître la fonction exacte du champ. Exemples : {samples}',
  'RGAA 11.2.4: {n} field(s) with an aria-labelledby: check that the text it points to tells the exact purpose of the field. Examples: {samples}':
    'RGAA 11.2.4 : {n} champ(s) avec un aria-labelledby : vérifier que le texte référencé permet de connaître la fonction exacte du champ. Exemples : {samples}',
  'RGAA 11.10.5: {n} form(s) or field(s): check that the instructions about the expected data type and format are visible and tied to the field. Examples: {samples}':
    'RGAA 11.10.5 : {n} formulaire(s) ou champ(s) : vérifier que les instructions sur le type de données et le format attendus sont visibles et associées au champ. Exemples : {samples}',
  'RGAA 11.10.6: {n} form(s) or field(s): check that error messages give the expected data type and format and name the field. Examples: {samples}':
    'RGAA 11.10.6 : {n} formulaire(s) ou champ(s) : vérifier que les messages d’erreur indiquent le type de données et le format attendus et identifient le champ. Exemples : {samples}',
  'RGAA 11.10.7: {n} form(s) or field(s): check that fields with aria-invalid="true" give the expected data type and format in their label or associated text. Examples: {samples}':
    'RGAA 11.10.7 : {n} formulaire(s) ou champ(s) : vérifier que les champs ayant aria-invalid="true" indiquent le type de données et le format attendus dans leur étiquette ou leur passage de texte associé. Exemples : {samples}',
  'RGAA 11.11.1: {n} form(s) or field(s): check that, after an input error, the data types and formats are suggested where needed. Examples: {samples}':
    'RGAA 11.11.1 : {n} formulaire(s) ou champ(s) : vérifier que, après une erreur de saisie, les types et formats de données sont suggérés si nécessaire. Exemples : {samples}',
  'RGAA 11.11.2: {n} form(s) or field(s): check that, after an input error, examples of expected values are suggested where needed. Examples: {samples}':
    'RGAA 11.11.2 : {n} formulaire(s) ou champ(s) : vérifier que, après une erreur de saisie, des exemples de valeurs attendues sont suggérés si nécessaire. Exemples : {samples}',
  'RGAA 11.12.1: {n} form(s) or field(s): for forms that change or delete data, check that the user can undo, review or confirm. Examples: {samples}':
    'RGAA 11.12.1 : {n} formulaire(s) ou champ(s) : pour les formulaires qui modifient ou suppriment des données, vérifier que l’utilisateur peut annuler, vérifier ou confirmer. Exemples : {samples}',
  'RGAA 11.12.2: {n} form(s) or field(s): for forms that change or delete financial, legal or personal data, check that deleted data can be recovered or that an explicit confirmation is asked. Examples: {samples}':
    'RGAA 11.12.2 : {n} formulaire(s) ou champ(s) : pour les formulaires qui modifient ou suppriment des données financières, juridiques ou personnelles, vérifier que les données supprimées peuvent être récupérées ou qu’une confirmation explicite est demandée. Exemples : {samples}',
  'RGAA 11.13.1: {n} form(s) or field(s): check that the purpose of each field about the user can be deduced (autocomplete attribute). Examples: {samples}':
    'RGAA 11.13.1 : {n} formulaire(s) ou champ(s) : vérifier que la finalité de chaque champ concernant l’utilisateur peut être déduite (attribut autocomplete). Exemples : {samples}',
  'RGAA 13.1.1: {n} element(s) that may refresh the page (svg, canvas, object, embed, meta refresh): check that the user controls the time limit. Examples: {samples}':
    'RGAA 13.1.1 : {n} élément(s) pouvant rafraîchir la page (svg, canvas, object, embed, meta refresh) : vérifier que l’utilisateur a le contrôle de la limite de temps. Exemples : {samples}',
  'RGAA 13.1.2: {n} <meta> redirection(s) that are not immediate. Examples: {samples}':
    'RGAA 13.1.2 : {n} redirection(s) via <meta> qui ne sont pas immédiates. Exemples : {samples}',
  'RGAA 13.7.1: {n} image(s) or media element(s) found: check that none flashes or changes brightness abruptly. Examples: {samples}':
    'RGAA 13.7.1 : {n} image(s) ou élément(s) multimédia détecté(s) : vérifier qu’aucun ne provoque de flash ou de changement brusque de luminosité. Exemples : {samples}',
  // --- Asqatasun-derived: end ---
  'Is this link explicit: does its text (or its context) say where it goes or what it does?': 'Ce lien est-il explicite : son texte (ou son contexte) dit-il où il mène ou ce qu’il fait ?',
  'The link text, read alone or with its sentence, list item, cell or heading, tells the destination or the action (test 6.1.1).': 'L’intitulé du lien, lu seul ou avec sa phrase, son élément de liste, sa cellule ou son titre, indique la destination ou l’action (test 6.1.1).',
  'Not “click here”, “read more”, “more” or a bare URL, unless the context makes it clear.': 'Pas « cliquez ici », « en savoir plus », « plus » ni une simple URL, sauf si le contexte le rend clair.',
  'Does this link have a name (an accessible label)?': 'Ce lien a-t-il un intitulé (un nom accessible) ?',
  'The link has text, or an image with an alt, or an aria-label / aria-labelledby, or a title that gives it a name (test 6.2.1).': 'Le lien a un texte, ou une image avec un alt, ou un aria-label / aria-labelledby, ou un title qui lui donne un nom (test 6.2.1).',
  'An empty link, or an icon without a name, is non-compliant.': 'Un lien vide, ou une icône sans nom, n’est pas conforme.',
  'No name: 6.2 fails first.': 'Pas d’intitulé : le 6.2 échoue d’abord.',
  '“{text}” says nothing about the destination alone: check that its context (sentence, heading, aria-describedby) makes it explicit.': '« {text} » ne dit rien de la destination seul : vérifiez que son contexte (phrase, titre, aria-describedby) le rend explicite.',
  'Read the link text with its context: does it say where it goes or what it does?': 'Lisez l’intitulé du lien avec son contexte : dit-il où il mène ou ce qu’il fait ?',
  'This link has no accessible name: no text, alt, aria-label, aria-labelledby or title.': 'Ce lien n’a pas de nom accessible : ni texte, ni alt, ni aria-label, aria-labelledby ou title.',
  'Name found: “{name}”.': 'Nom trouvé : « {name} ».',
  'Text': 'Texte',
  'Accessible name': 'Nom accessible',
  'Occurrences': 'Occurrences',
  '<{tag}> without name': '<{tag}> sans nom',
  'Is this heading relevant, and is its level consistent with the structure of the page?': 'Ce titre est-il pertinent, et son niveau est-il cohérent avec la structure de la page ?',
  'The heading describes the content that follows it (test 9.1.2), and it has a text.': 'Le titre décrit le contenu qui le suit (test 9.1.2), et il a un texte.',
  'Heading levels follow a logical outline: no level skipped going down, a single clear page title (h1) (test 9.1.1).': 'Les niveaux de titres suivent un plan logique : aucun niveau sauté en descendant, un titre de page (h1) clair et unique (test 9.1.1).',
  'Is this part of the document structure correct (header, navigation, main content, footer)?': 'Cette partie de la structure du document est-elle correcte (en-tête, navigation, contenu principal, pied de page) ?',
  'The page has its main areas marked up: header, navigation, one main, footer (test 9.2.1).': 'La page a ses zones principales balisées : en-tête, navigation, un seul main, pied de page (test 9.2.1).',
  'A landmark that appears more than once has its own name.': 'Un repère présent plusieurs fois a son propre nom.',
  'This heading is empty: it has no text for assistive technologies.': 'Ce titre est vide : il n’a pas de texte pour les technologies d’assistance.',
  'The level jumps from {from} to {to}: a level is skipped in the outline.': 'Le niveau passe de {from} à {to} : un niveau est sauté dans le plan.',
  'The page has no level 1 heading (h1).': 'La page n’a pas de titre de niveau 1 (h1).',
  'The page has {n} level 1 headings: check that this is intended.': 'La page a {n} titres de niveau 1 : vérifiez que c’est voulu.',
  'Read the heading with the content below it: does it describe it, at the right level?': 'Lisez le titre avec le contenu qui le suit : le décrit-il, au bon niveau ?',
  'No main content area (main) found on the page.': 'Aucune zone de contenu principal (main) trouvée sur la page.',
  'Check that this area is the right kind of landmark, and named if several of the same kind exist.': 'Vérifiez que cette zone est le bon type de repère, et nommée s’il en existe plusieurs du même type.',
  'Level': 'Niveau',
  'Previous level': 'Niveau précédent',
  'Role': 'Rôle',
  'Name': 'Nom',
  'Count': 'Nombre',
  'Does this data table have a title, and is it associated with the table?': 'Ce tableau de données a-t-il un titre, et est-il associé au tableau ?',
  'The title is a caption, or an aria-label / aria-labelledby / title on the table (test 5.4.1).': 'Le titre est un caption, ou un aria-label / aria-labelledby / title sur le tableau (test 5.4.1).',
  'A table with no title at all makes this criterion not applicable.': 'Un tableau sans aucun titre rend ce critère non applicable.',
  'Is the title of this data table relevant?': 'Le titre de ce tableau de données est-il pertinent ?',
  'The title says what the table contains (test 5.5.1).': 'Le titre dit ce que contient le tableau (test 5.5.1).',
  'Are the column and row headers of this data table declared?': 'Les en-têtes de colonnes et de lignes de ce tableau de données sont-ils déclarés ?',
  'Each header cell is a th (or has role columnheader / rowheader) (test 5.6.1).': 'Chaque cellule d’en-tête est un th (ou a le rôle columnheader / rowheader) (test 5.6.1).',
  'A data table with no header cell fails.': 'Un tableau de données sans cellule d’en-tête échoue.',
  'Is each data cell correctly associated with its headers?': 'Chaque cellule de données est-elle correctement associée à ses en-têtes ?',
  'Simple tables: th with scope, or headers / id for complex ones (tests 5.7.1 to 5.7.5).': 'Tableaux simples : th avec scope, ou headers / id pour les tableaux complexes (tests 5.7.1 à 5.7.5).',
  'Is this layout table still understandable when linearized (read cell by cell)?': 'Ce tableau de mise en forme reste-t-il compréhensible une fois linéarisé (lu cellule par cellule) ?',
  'The reading order of the cells keeps the meaning (test 5.3.1).': 'L’ordre de lecture des cellules garde le sens (test 5.3.1).',
  'Does this layout table avoid the markup of data tables?': 'Ce tableau de mise en forme évite-t-il le balisage des tableaux de données ?',
  'No th, caption, thead, tfoot, summary, headers or scope in a layout table (test 5.8.1).': 'Pas de th, caption, thead, tfoot, summary, headers ni scope dans un tableau de mise en forme (test 5.8.1).',
  'Does this form field have a label?': 'Ce champ de formulaire a-t-il une étiquette ?',
  'The field has a label (for / id or wrapping), an aria-label / aria-labelledby, or a title (tests 11.1.1 to 11.1.3).': 'Le champ a une étiquette (for / id ou englobante), un aria-label / aria-labelledby, ou un title (tests 11.1.1 à 11.1.3).',
  'A placeholder alone is not a label.': 'Un placeholder seul n’est pas une étiquette.',
  'Does the label tell the exact function of the field?': 'L’étiquette dit-elle la fonction exacte du champ ?',
  'Reading the label alone, the user knows what to enter (test 11.2.1).': 'En lisant l’étiquette seule, l’utilisateur sait quoi saisir (test 11.2.1).',
  'Not “field”, “input” or a label that belongs to another field.': 'Pas « champ », « input » ni une étiquette qui appartient à un autre champ.',
  'If this field is about the user (name, e-mail, phone, address…), can the browser fill it in (autocomplete)?': 'Si ce champ concerne l’utilisateur (nom, e-mail, téléphone, adresse…), le navigateur peut-il le remplir (autocomplete) ?',
  'The autocomplete attribute is present with a valid value for fields about the user (test 11.13.1).': 'L’attribut autocomplete est présent avec une valeur valide pour les champs concernant l’utilisateur (test 11.13.1).',
  'Not applicable when the field is not about the user.': 'Non applicable quand le champ ne concerne pas l’utilisateur.',
  'Title found: “{title}”.': 'Titre trouvé : « {title} ».',
  'No title found: if the table really has none, this criterion is not applicable.': 'Aucun titre trouvé : si le tableau n’en a vraiment pas, ce critère est non applicable.',
  'Read the title: does it say what the table contains?': 'Lisez le titre : dit-il ce que contient le tableau ?',
  'No title to judge.': 'Pas de titre à juger.',
  'No header cell (th) in this table: if it is a data table, the headers are not declared.': 'Aucune cellule d’en-tête (th) dans ce tableau : si c’est un tableau de données, les en-têtes ne sont pas déclarés.',
  '{n} header cell(s) found.': '{n} cellule(s) d’en-tête trouvée(s).',
  'Check the association of cells and headers (scope, headers/id) by reading the table.': 'Vérifiez l’association des cellules et des en-têtes (scope, headers/id) en lisant le tableau.',
  'Read the cells in source order: does the content keep its meaning?': 'Lisez les cellules dans l’ordre du code : le contenu garde-t-il son sens ?',
  'This layout table carries data table markup (th, caption, headers, scope or summary).': 'Ce tableau de mise en forme porte du balisage de tableau de données (th, caption, headers, scope ou summary).',
  'No data table markup found in this layout table.': 'Aucun balisage de tableau de données dans ce tableau de mise en forme.',
  'No label, aria-label, aria-labelledby or title: this field has no accessible name.': 'Pas d’étiquette, d’aria-label, d’aria-labelledby ni de title : ce champ n’a pas de nom accessible.',
  'The only name comes from the placeholder, which is not a label.': 'Le seul nom vient du placeholder, qui n’est pas une étiquette.',
  'Name found: “{name}” (from {source}).': 'Nom trouvé : « {name} » (depuis {source}).',
  'Read the label: does it give the exact function of the field?': 'Lisez l’étiquette : donne-t-elle la fonction exacte du champ ?',
  'No usable label to judge: 11.1 fails first.': 'Pas d’étiquette exploitable à juger : le 11.1 échoue d’abord.',
  'This field does not look like it is about the user: probably not applicable.': 'Ce champ ne semble pas concerner l’utilisateur : probablement non applicable.',
  'autocomplete found: “{value}”.': 'autocomplete trouvé : « {value} ».',
  'This field looks like it is about the user but has no autocomplete attribute.': 'Ce champ semble concerner l’utilisateur mais n’a pas d’attribut autocomplete.',
  'Rows': 'Lignes',
  'Columns': 'Colonnes',
  'Header cells (th)': 'Cellules d’en-tête (th)',
  'Title': 'Titre',
  'Summary': 'Résumé',
  'Type': 'Type',
  'Name comes from': 'Le nom vient de',
  'Autocomplete': 'Autocomplete',
  'Required': 'Obligatoire',
}
