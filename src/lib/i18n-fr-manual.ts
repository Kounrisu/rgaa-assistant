/** French texts of the “How to check” lines of the manual checks (`manual-checks.ts`). */
export const FR_MANUAL: Record<string, string> = {
  'How to check:': 'Comment faire :',
  'Click on the page, then press Tab again and again (Shift+Tab goes back). Enter or Space activates a link or button; arrow keys work inside menus, tabs and lists.':
    'Cliquez sur la page, puis appuyez sur Tab encore et encore (Maj+Tab revient en arrière). Entrée ou Espace active un lien ou un bouton ; les flèches fonctionnent dans les menus, les onglets et les listes.',
  'Keep pressing Tab: a visible outline must follow you and move in the reading order. The “Tab order” page tool numbers the sequence for you.':
    'Continuez d’appuyer sur Tab : un contour visible doit vous suivre et se déplacer dans l’ordre de lecture. L’outil de page « Ordre de tabulation » numérote la séquence pour vous.',
  'Open each menu, popin, carousel and video player, then try Tab, Shift+Tab and Escape: you must always be able to get out without the mouse.':
    'Ouvrez chaque menu, popin, carrousel et lecteur vidéo, puis essayez Tab, Maj+Tab et Échap : vous devez toujours pouvoir en sortir sans la souris.',
  'Reload the page and press Tab once: a skip link (“Aller au contenu”) should appear. Press Enter: the focus must land on the main content.':
    'Rechargez la page et appuyez une fois sur Tab : un lien d’évitement (« Aller au contenu ») doit apparaître. Appuyez sur Entrée : le focus doit arriver sur le contenu principal.',
  'Press Ctrl/Cmd and + up to 200 %. In Firefox choose View › Zoom › Zoom Text Only to enlarge only the text. Look for cut-off, overlapping or missing text and controls.':
    'Appuyez sur Ctrl/Cmd et + jusqu’à 200 %. Dans Firefox, choisissez Affichage › Zoom › Zoom texte seulement pour n’agrandir que le texte. Cherchez du texte ou des contrôles coupés, qui se chevauchent ou qui disparaissent.',
  'Make the window 320 px wide (or zoom to 400 % on a 1280 px window) and scroll: text content must not need horizontal scrolling (tables, maps and similar two-dimensional content are exceptions).':
    'Réduisez la fenêtre à 320 px de large (ou zoomez à 400 % sur une fenêtre de 1280 px) et faites défiler : le contenu textuel ne doit pas demander de défilement horizontal (les tableaux, cartes et autres contenus à deux dimensions sont des exceptions).',
  'Switch on the “Text spacing” page tool and look for text that is cut off, hidden or overlapping.':
    'Activez l’outil de page « Espacement du texte » et cherchez du texte coupé, masqué ou qui se chevauche.',
  'Switch on the “Styles off” page tool and read the page from top to bottom: is the order still logical and nothing lost?':
    'Activez l’outil de page « Sans styles » et lisez la page de haut en bas : l’ordre reste-t-il logique et rien n’est-il perdu ?',
  'Start NVDA (Windows) or VoiceOver (Cmd+F5 on a Mac) and list the headings and landmarks (NVDA: H and D keys; VoiceOver: the rotor). Do they describe the page?':
    'Lancez NVDA (Windows) ou VoiceOver (Cmd+F5 sur Mac) et listez les titres et les repères (NVDA : touches H et D ; VoiceOver : le rotor). Décrivent-ils bien la page ?',
  'With the screen reader on, Tab through the controls and listen: each icon, image and button must be announced with a meaningful name, not “button” or a file name.':
    'Lecteur d’écran actif, parcourez les contrôles avec Tab et écoutez : chaque icône, image et bouton doit être annoncé avec un nom pertinent, pas « bouton » ni un nom de fichier.',
  'Tab into each field and listen: label, required state and instructions are read. Submit with errors: the messages must be read and linked to their fields.':
    'Entrez dans chaque champ avec Tab et écoutez : l’étiquette, le caractère obligatoire et les consignes sont lus. Validez avec des erreurs : les messages doivent être lus et liés à leurs champs.',
  'Do an action that shows a message (send a form, add to a basket, load results) without moving: the screen reader must announce the message by itself.':
    'Faites une action qui affiche un message (envoyer un formulaire, ajouter au panier, charger des résultats) sans bouger : le lecteur d’écran doit annoncer le message de lui-même.',
  'Read the title in the browser tab (does it say which page this is?). The “Languages” page tool shows the page language and every change of language.':
    'Lisez le titre dans l’onglet du navigateur (dit-il de quelle page il s’agit ?). L’outil de page « Langues » montre la langue de la page et chaque changement de langue.',
  'Open the Structure theme of this tool: the outline lists the headings in order. One h1 and no skipped level?':
    'Ouvrez la thématique Structure de cet outil : le plan liste les titres dans l’ordre. Un seul h1 et aucun niveau sauté ?',
  'Open the Links theme: read each link name with its context. A link that opens a new window (target=\"_blank\") must say so in its text or title.':
    'Ouvrez la thématique Liens : lisez chaque intitulé avec son contexte. Un lien qui ouvre une nouvelle fenêtre (target="_blank") doit le dire dans son texte ou son titre.',
  'Look for errors, required fields, chart series and states shown only by a colour. Is there also a text, an icon or a pattern that says the same thing?':
    'Cherchez les erreurs, champs obligatoires, séries de graphiques et états indiqués uniquement par une couleur. Un texte, une icône ou un motif dit-il aussi la même chose ?',
  'Play each video and audio: are captions available, and is there a transcript or an audio description nearby when the images carry information?':
    'Lancez chaque vidéo et chaque audio : des sous-titres sont-ils disponibles, et y a-t-il une transcription ou une audiodescription à proximité quand les images portent de l’information ?',
  'Watch for carousels, tickers and animations that last more than 5 seconds: is there a visible control to pause or stop them?':
    'Repérez les carrousels, bandeaux défilants et animations de plus de 5 secondes : existe-t-il une commande visible pour les mettre en pause ou les arrêter ?',
}
