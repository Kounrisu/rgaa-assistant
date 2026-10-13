/**
 * The style sheets the owner uses with the Stylus browser extension to look at a page while auditing:
 * each one outlines and labels one kind of element (images, links, headings, tables, ARIA roles…) with CSS, and the fixed
 * counter box at the top left says how many there are. The panel can apply them itself (see audit-styles.ts), or the auditor can keep
 * using them in Stylus: the names below are the Stylus names.
 *
 * Provenance: supplied by the owner as a Stylus export (`.json`), bundled here by the owner's decision (2026-10-13);
 * kept as written apart from the formatting and one comment whose accents were damaged in the export. The site-specific styles of that
 * export (a billing tool, a project tracker, a test) and a duplicate of the "Text spacing" page tool are not included. Written with
 * `String.raw` so the CSS escapes (`\A` = a new line in a generated text) stay as they are.
 *
 * UPDATING THESE SHEETS LATER: this is a copy. A change made in Stylus does not reach it. For now, hand the changed sheet (or a new Stylus
 * export, `.json`) to whoever maintains the project and have it pasted here, keeping the Stylus name, the theme(s) and `String.raw`;
 * `tests/audit-styles.test.ts` lists the expected names and counts, update it with the sheet. If the sheets change often, add back an
 * "Import a Stylus file" button instead: read the export, apply the same strictness as before (no `@import`, no `url()` that is not a
 * `data:` image, skip site-specific sections), keep the result in `chrome.storage.local`.
 */
export interface BundledSheet {
  /** Stable id. */
  id: string
  /** The name in Stylus (the auditor looks for it there). */
  name: string
  /** RGAA themes the sheet helps with (0: it is for the whole page). */
  themes: number[]
  css: string
}

export const AUDIT_SHEETS: BundledSheet[] = [
  {
    id: 'audit-00-thematiques-na',
    name: '0.Thématiques NA',
    themes: [0],
    css: String.raw`[role="img"],
img,
svg,
area,
object[type="image"],
canvas,
embed[type="image"] {
	max-width:150px;
	max-height:150px;
}

img { counter-increment: thematique1-img; }
canvas { counter-increment: thematique1-canvas; }
embed { counter-increment: thematique1-embed; }
object { counter-increment: thematique1-object; }
svg { counter-increment: thematique1-svg; }
[role="img"] { counter-increment: thematique1-img; }
[longdesc] { counter-increment: thematique1-longdesc; }
figure { counter-increment: thematique1-figure; }
map { counter-increment: thematique1-map; }
area { counter-increment: thematique1-area; }

iframe { counter-increment: thematique2; }

audio,video { counter-increment: thematique4; }

table,
[role="table"] { counter-increment: thematique5; }

[lang]:not(html),
[xml:lang]:not(html){ counter-increment: lang; }


dir:not(html){ counter-increment: dir; }

input,
select,
textarea,
datalist,
optgroup,
option,
keygen,
output,
progress,
meter {	 counter-increment: thematique11-form; }

fieldset { counter-increment: thematique11-regroupement; }

[role="group"] { counter-increment: aria-group; }

hidden,[aria-hidden] { counter-increment: caches; }

html {
	padding-left:200px;
	counter-reset:
					thematique1-img
					thematique1-canvas
					thematique1-embed
					thematique1-object
					thematique1-svg
					thematique1-longdesc
					thematique1-figure
					thematique1-map
					thematique1-area
					thematique2
					thematique4
					thematique5
					lang
					dir
					thematique11-form
					thematique11-regroupement
					caches
					aria-group
}

body{padding-left:15px}

html:after {
	font-family:sans-serif!important;
	font-size:1.5rem!important;
	color:#000!important;
	position:fixed!important;
	top:0!important;
	bottom:0!important;
	left:0!important;
	white-space:pre!important;
	width:200px!important;
	padding:15px!important;
	padding-top:100px!important;
	background:#eee!important;
	z-index:100000!important;
  	content:
			"" counter(thematique1-img) " img ou role,\A"
			"" counter(thematique1-longdesc) " attribut longdesc,\A"
			"" counter(thematique1-svg) " svg,\A"
			"" counter(thematique1-embed) " embed,\A"
			"" counter(thematique1-object) " object,\A"
			"" counter(thematique1-canvas) " canvas,\A"
			"" counter(thematique1-figure) " figure,\A"
			"" counter(thematique1-map) " map,\A"
			"" counter(thematique1-map) " area,\A"
			"" counter(thematique2) " cadres\A"
			"" counter(thematique4) " balises video/audio\A"
			"" counter(thematique5) " tableau\A "
			"" counter(thematique11-form) " champs de formulaires\A "
			"" counter(thematique11-regroupement) " fieldset\A "
			"" counter(caches) " hidden ou aria-hidden\A "
			"" counter(lang) " indication de langue\A "
			"" counter(dir) " indication de direction\A "
			"" counter(aria-group) " role group\A "!important
}
`,
  },
  {
    id: 'audit-01-images',
    name: '01.Images',
    themes: [1],
    css: String.raw`* {
    box-sizing: border-box;
}

a {
    display: inline-block!important;
    padding: 5px!important;
    border: solid 10px blue!important;
    background:grey;
}

a:before {
    content: "lien";
}

[role="img"],
img,
svg,
area,
object[type="image"],
canvas,
embed[type="image"] {
    max-width: 150px;
    height: auto;
    margin-bottom:30px
}

img,
input[type="image"],
[role="img"] {
    outline: solid 10px red!important;
}

img[alt=""] {
    border-bottom: 10px solid red!important;
}

svg {
    outline: solid 10px green!important;
}

svg[aria-hidden="true"] {
    background: green!important;
}

area {
    outline: solid 10px orange!important;
}

object[type="image"],
canvas,
embed[type="image"] {
    outline: solid 10px green!important;
}

img {counter-increment: eltimg;}
[longdesc] {counter-increment: longdesc;}
[role="img"] {counter-increment: roleimg;}
svg {counter-increment: imgsvg;}
svg[role="img"]{counter-increment: imgsvg;}
embed {counter-increment: imgembed;}
object{counter-increment: imgobject;}

html {
    padding-left: 200px;
    counter-reset:
                    eltimg
                    longdesc
                    roleimg
                    imgsvg
                    imgembed
                    imgobject;
}

html:after {
    font-family: sans-serif!important;
    font-size: 1rem!important;
    font-weight:bold;
    color: #000!important;
    position: fixed!important;
    top: 0!important;
    left: 0!important;
    white-space: pre!important;
    width: 10em!important;
    padding: 15px!important;
    background: #eee!important;
    z-index: 100000!important;
    content:
			"" counter(eltimg) " img\A"
            "" counter(longdesc) " longdesc\A"
			"" counter(roleimg) " role='img'\A"
			"" counter(imgsvg) " svg\A"
			"" counter(imgembed) " embed\A"
			"" counter(imgobject) " object\A"
}

html {
    margin-top: 2em
}`,
  },
  {
    id: 'audit-01-reduction-images',
    name: 'Reduction images',
    themes: [1],
    css: String.raw`[role="img"],
img,
svg,
area,
object[type="image"],
canvas,
embed[type="image"] {
    max-width: 150px;
    height: auto;
    margin-bottom:60px
}`,
  },
  {
    id: 'audit-02-cadres',
    name: '02.Cadres',
    themes: [2],
    css: String.raw`* {
    box-sizing: border-box;
}

frame,
iframe {
    display: block!important;
    padding:0 0 20px 0;
    margin:20px;
}

frame {
    outline: solid 10px red!important;
    counter-increment: frame;
}


iframe {
    outline: solid 10px yellow!important;
    counter-increment: iframe;
}


html {
    padding-left: 200px;
    counter-reset:
                    frame
                    iframe;
}

html:after {
    font-family: sans-serif!important;
    font-size: 1rem!important;
    font-weight:bold;
    color: #000!important;
    position: fixed!important;
    top: 0!important;
    left: 0!important;
    white-space: pre!important;
    width: 10em!important;
    padding: 15px!important;
    background: #eee!important;
    z-index: 100000!important;
    content:
			"" counter(frame) " frame\A"
            "" counter(iframe) " iframe\A"
}`,
  },
  {
    id: 'audit-05-tableaux',
    name: '05.Tableaux',
    themes: [5],
    css: String.raw`* {
    box-sizing: border-box;
}


[role="table"]:before,
table:before {
	display:block;
    content: "TABLEAU";
    font-family: sans-serif!important;
    font-size: 2rem!important;
    font-weight: bold;
    color: #fff!important;
    background:green;
}


[role="table"],
table {
    display: block;
    outline: solid 10px green!important;
}

[role="table"],
table {
    counter-increment: thematique5;
}

html {
    padding-left: 200px;
    counter-reset: thematique5;
}

table[role]:after {
       content: '<table role="'attr(role)'">'!important;

}
html:after {
    font-family: sans-serif!important;
    font-size: 1rem!important;
    font-weight:bold;
    color: #000!important;
    position: fixed!important;
    top: 0!important;
    left: 0!important;
    white-space: pre!important;
    width: 10em!important;
    padding: 15px!important;
    background: #eee!important;
    z-index: 100000!important;
    content: "" counter(thematique5) " tableaux"
}

html {
    margin-top: 2em
}`,
  },
  {
    id: 'audit-06-liens',
    name: '06.Liens',
    themes: [6],
    css: String.raw`* {
    box-sizing: border-box;
}
*:before,
*:after {
    display: block!important;
    background: #f2f2f2!important;
    color: #000!important;
    font-weight: bold!important;
    font-size: 100%!important;
    font-size: 1rem!important;
}

a[href],
a[tabindex="0"],
[role="link"] {
    display: block!important;
    padding: 10px!important;
    outline: solid 5px blue!important;
}

a[tabindex="-1"]{
    outline: solid 5px orange!important;
}
a [role="img"],
a img,
a svg,
a area,
a object[type="image"],
a canvas,
a embed[type="image"],
[role="link"] [role="img"],
[role="link"] img,
[role="link"] svg,
[role="link"] area,
[role="link"] object[type="image"],
[role="link"] canvas,
[role="link"] embed[type="image"] {
    outline: solid 2px red!important;
}

[role="link"]:after {
    content: 'role="link"'!important;
}
a[aria-label]:before,
[role="link"][aria-label]:before {
    content: 'aria-label="'attr(aria-label)'"'!important;
}
a[aria-labelledby]:before,
[role="link"][aria-labelledby]:before {
    content: 'aria-labelledby="'attr(aria-labelledby)'"'!important;
}
a[aria-describedby]:before,
[role="link"][aria-describedby]:before {
    content: 'aria-describedby="'attr(aria-describedby)'"'!important;
}`,
  },
  {
    id: 'audit-07-aria',
    name: '07.ARIA role state properties',
    themes: [7],
    css: String.raw`* {
    box-sizing: border-box;
}

[role="main"],
[role="banner"],
[role="search"],
[role="navigation"],
[role="contentinfo"],
header,
nav,
footer,
main {
    display: block!important;
    padding: 0 0 20px 0;
    margin: 20px;
}

[role] {
    display: block!important;
    width: 100%!important;
    margin: 0.5em 0!important;
    padding: 0 0.5em!important;
    border: 2px solid red!important;
}

[aria-activedescendant],
[aria-atomic],
[aria-autocomplete],
[aria-busy],
[aria-checked],
[aria-colcount],
[aria-colindex],
[aria-colspan],
[aria-controls],
[aria-current],
[aria-describedby],
[aria-details],
[aria-disabled],
[aria-dropeffect],
[aria-errormessage],
[aria-expanded],
[aria-flowto],
[aria-grabbed],
[aria-haspopup],
[aria-hidden],
[aria-invalid],
[aria-keyshortcuts],
[aria-label],
[aria-labelledby],
[aria-level],
[aria-live],
[aria-modal],
[aria-multiline],
[aria-multiselectable],
[aria-orientation],
[aria-owns],
[aria-placeholder],
[aria-posinset],
[aria-pressed],
[aria-relevant],
[aria-readonly],
[aria-required],
[aria-roledescription],
[aria-rowcount],
[aria-rowindex],
[aria-rowspan],
[aria-selected],
[aria-setsize],
[aria-sort],
[aria-valuemax],
[aria-valuemin],
[aria-valuenow],
[aria-valuetext] {
    display: block!important;
    width: 100%!important;
    margin: 0.5em 0!important;
    padding: 0 0.5em!important;
    border: 2px solid green!important;
}

[aria-activedescendant]:before,
[aria-atomic]:before,
[aria-autocomplete]:before,
[aria-busy]:before,
[aria-checked]:before,
[aria-colcount]:before,
[aria-colindex]:before,
[aria-colspan]:before,
[aria-controls]:before,
[aria-current]:before,
[aria-describedby]:before,
[aria-details]:before,
[aria-disabled]:before,
[aria-dropeffect]:before,
[aria-errormessage]:before,
[aria-expanded]:before,
[aria-flowto]:before,
[aria-grabbed]:before,
[aria-haspopup]:before,
[aria-hidden]:before,
[aria-invalid]:before,
[aria-keyshortcuts]:before,
[aria-label]:before,
[aria-labelledby]:before,
[aria-level]:before,
[aria-live]:before,
[aria-modal]:before,
[aria-multiline]:before,
[aria-multiselectable]:before,
[aria-orientation]:before,
[aria-owns]:before,
[aria-placeholder]:before,
[aria-posinset]:before,
[aria-pressed]:before,
[aria-relevant]:before,
[aria-readonly]:before,
[aria-required]:before,
[aria-roledescription]:before,
[aria-rowcount]:before,
[aria-rowindex]:before,
[aria-rowspan]:before,
[aria-selected]:before,
[aria-setsize]:before,
[aria-sort]:before,
[aria-valuemax]:before,
[aria-valuemin]:before,
[aria-valuenow]:before,
[aria-valuetext]:before {
    content: "aria properties"!important;
}

[role]:before {
    content: 'role="'attr(role)'"'!important;
}

[aria-label]:before {
    content: 'aria-label="'attr(aria-label)'"'!important;
}
[role][aria-label]:before {
    content: 'role="'attr(role)'" aria-label="'attr(aria-label)'"'!important;
}
[aria-labelledby]:before {
    content: 'aria-labelledby="'attr(aria-labelledby)'"'!important;
}
[role][aria-labelledby]:before {
    content: 'role="'attr(role)'" aria-labelledby="'attr(aria-labelledby)'"'!important;
}
[aria-describedby]:before {
    content: 'aria-describedby="'attr(aria-describedby)'"'!important;
}
[role][aria-describedby]:before {
    content: 'role="'attr(role)'" aria-describedby="'attr(aria-describedby)'"'!important;
}`,
  },
  {
    id: 'audit-08-07-langue',
    name: '08.07.Langue',
    themes: [8],
    css: String.raw`* {
    box-sizing: border-box;
}

[lang]:before {
    display: block;
    content: "Indication de langue : "attr(lang)"";
    font-family: sans-serif!important;
    font-size: 1rem!important;
    font-weight: bold;
    color: #fff!important;
    background: green;
}

[lang] {
    display: inline-block;
    outline: solid 10px green!important;
}


[lang]:before {
    counter-increment: thematique8-lang;
}


html {
    padding-left: 200px;
    counter-reset: thematique8-lang;
}


html:after {
    font-family: sans-serif!important;
    font-size: 1rem!important;
    font-weight:bold;
    color: #000!important;
    position: fixed!important;
    top: 0!important;
    left: 0!important;
    white-space: pre!important;
    width: 10em!important;
    padding: 15px!important;
    background: #eee!important;
    z-index: 100000!important;
    content: "" counter(thematique8-lang) " indications\A de langue "

}`,
  },
  {
    id: 'audit-08-09-detournement',
    name: '08.09.Detournement de balises',
    themes: [8],
    css: String.raw`* {
    box-sizing: border-box;
}
*:before,
*:after {
    display: block!important;
    background: #f2f2f2!important;
    color: #000!important;
    font-weight: bold!important;
    font-size: 100%!important;
    font-size: 1rem!important;
}

blockquote,
q {
    border: 3px solid red!important;
}

blockquote:before {
    content: "<blockquote>"!important;
}

q:before {
    content: "<q>"!important;
}

p,
ul,
ol,
li,
h1,
h2,
h3,
h4,
h5,
h6,
[role="heading"],
[role="list"],
[role="listitem"] {
    border: 3px solid green!important;
}

/** on recherche les balises dont on a changé la sémantique**/
ul[role],
li[role],
ol[role],
p[role],
h1[role],
h2[role],
h3[role],
h4[role],
h5[role],
h6[role]{
    border: 3px solid red!important;
}

p:before {
    content: "<p>"!important;
}

p[role]:before {
    content: '<p role="'attr(role)'">'!important;
}

ul:before {
    content: "<ul>"!important;
}

[role="list"]:before {
    content: "role='list'"!important;
}

ul[role]:before {
    content: '<ul role="'attr(role)'">'!important;
}

li:before {
    content: "<li>"!important;
}

[role="listitem"]:before {
    content: "role='listitem'"!important;
}

li[role]:before {
    content: '<li role="'attr(role)'">'!important;
}

ol:before {
    content: "<ol>"!important;
}

ol[role]:before {
    content: '<ol role="'attr(role)'">'!important;
}

h1:before,
h2:before,
h3:before,
h4:before,
h5:before,
h6:before,
[role="heading"]:before {
    content: "hn"!important;
}

h1[role]:before,
h2[role]:before,
h3[role]:before,
h4[role]:before,
h5[role]:before,
h6[role]:before{
    content: '<hx avec role="'attr(role)'">'!important;
}`,
  },
  {
    id: 'audit-08-10-direction',
    name: '08.10.Direction',
    themes: [8],
    css: String.raw`* {
    box-sizing: border-box;
}

[dir]:before {
    display: block;
    content: "Indication de direction : "attr(dir)"";
    font-family: sans-serif!important;
    font-size: 1rem!important;
    font-weight: bold;
    color: #fff!important;
    background: green;
}

[dir] {
    display: inline-block;
    outline: solid 10px green!important;
}


[dir]:before {
    counter-increment: thematique8-dir;
}


html {
    padding-left: 200px;
    counter-reset: thematique8-dir;
}

html:after {
    font-family: sans-serif!important;
    font-size: 1rem!important;
    font-weight:bold;
    color: #000!important;
    position: fixed!important;
    top: 0!important;
    left: 0!important;
    white-space: pre!important;
    width: 10em!important;
    padding: 15px!important;
    background: #eee!important;
    z-index: 100000!important;
    content: "" counter(thematique8-dir) " indications\A de direction "

}
`,
  },
  {
    id: 'audit-09-01-titres',
    name: '09.01.Titres',
    themes: [9],
    css: String.raw`* {
    box-sizing: border-box;
}


[role="heading"],
h1,
h2,
h3,
h4,
h5,
h6 {
    display: block!important;
    padding: 0 0 20px 0;
    margin: 20px;
}


[role="heading"]:before,
h1:before,
h2:before,
h3:before,
h4:before,
h5:before,
h6:before {
    display: block;
    font-family: sans-serif!important;
    font-size: 1rem!important;
    font-weight: bold;
    color: #fff!important;
    background: green;
}

h1[role]:before,
h2[role]:before,
h3[role]:before,
h4[role]:before,
h5[role]:before,
h6[role]:before {
    background: red;
}

[role="heading"] {
    border: 5px solid orange;
    counter-increment: roleheading;
}

h1,
h2,
h3,
h4,
h5,
h6 {
    border: 5px solid green;
    counter-increment: heading;
}


h1:before {
    content: "<h1>";
}
h2:before {
    content: "<h2>";
}
h3:before {
    content: "<h3>";
}
h4:before {
    content: "<h4>";
}
h5:before {
    content: "<h5>";
}
h6:before {
    content: "<h6>";
}

[role="heading"]:before {
    content: "role='heading' aria-level='"attr( aria-level)"'";
}


h1[role]:before {
    content: "<h1 role='"attr( role)"'>";
}

h2[role]:before {
    content: "<h2 role='"attr( role)"'>";
}
h3[role]:before {
    content: "<h3 role='"attr( role)"'>";
}
h4[role]:before {
    content: "<h4 role='"attr( role)"'>";
}
h5[role]:before {
    content: "<h5 role='"attr( role)"'>";
}
h6[role]:before {
    content: "<h6 role='"attr( role)"'>";
}


html {
    padding-left: 200px;
    counter-reset: roleheading heading;
}

html:after {
    font-family: sans-serif!important;
    font-size: 1rem!important;
    font-weight: bold;
    color: #000!important;
    position: fixed!important;
    top: 0!important;
    left: 0!important;
    white-space: pre!important;
    width: 10em!important;
    padding: 15px!important;
    background: #eee!important;
    z-index: 100000!important;
    content: "" counter(roleheading) " role='heading'\A" "" counter(heading) " headings\A"
}`,
  },
  {
    id: 'audit-09-02-structure',
    name: '09.02.Structure',
    themes: [9],
    css: String.raw`* {
    box-sizing: border-box;
}


header,
nav,
main,
footer {
    display: block!important;
    padding:0 0 20px 0;
    margin:20px;
}

header:before,
nav:before,
main:before,
footer:before {
    display: block;
    font-family: sans-serif!important;
    font-size: 1rem!important;
    font-weight: bold;
    color: #fff!important;
    background: green;
}

header {
    outline: solid 10px red!important;
    counter-increment: header;
}

header:before {
    content: '<header role="'attr(role)'">'!important;
}

nav {
    outline: solid 10px yellow!important;
    counter-increment: nav;
}

nav:before {
    content: '<nav role="'attr(role)'">'!important;
}

main {
    outline: solid 10px blue!important;
    counter-increment: main;
}
main:before {
    content: '<main role="'attr(role)'">'!important;
}


footer {
    outline: solid 10px purple!important;
    counter-increment: footer;
}
footer:before {
    content: '<footer role="'attr(role)'">'!important;
}

html {
    padding-left: 200px;
    counter-reset:
                    nav
                    header
                    main
                    footer;
}

html:after {
    font-family: sans-serif!important;
    font-size: 1rem!important;
    font-weight:bold;
    color: #000!important;
    position: fixed!important;
    top: 0!important;
    left: 0!important;
    white-space: pre!important;
    width: 10em!important;
    padding: 15px!important;
    background: #eee!important;
    z-index: 100000!important;
    content:
			"" counter(nav) " nav\A"
            "" counter(header) " header\A"
			"" counter(main) " main\A"
			"" counter(footer) " footer\A"
}`,
  },
  {
    id: 'audit-09-03-listes',
    name: '09.03.Listes',
    themes: [9],
    css: String.raw`* {
    box-sizing: border-box;
}

*:before,
*:after {
    display: block!important;
    background: #f2f2f2!important;
    color: #000!important;
    font-weight: bold!important;
    font-size: 100%!important;
    font-size: 1rem!important;
}

ul,
ol,
li,
dl,
[role="list"],
[role="listitem"] {
    border: 3px solid green!important;
}

ul[role],
ol[role],
li[role],
dl[role] {
    border: 3px solid red!important;
}

ul:before {
    content: "<ul>"!important;
}

[role="list"]:before {
    content: "role='list'"!important;
}

ul[role]:before {
    content: '<ul role="'attr(role)'">'!important;
}
li:before {
    content: "<li>"!important;
}

[role="listitem"]:before {
    content: "role='listitem'"!important;
}

li[role]:before {
    content: '<li role="'attr(role)'">'!important;
}

ol:before {
    content: "<ol>"!important;
}

ol[role]:before {
    content: '<ol role="'attr(role)'">'!important;
}

dl:before {
    content: "<dl>"!important;
}


dl[role]:before {
    content: '<dl role="'attr(role)'">'!important;
}`,
  },
  {
    id: 'audit-10-01-mise-en-forme',
    name: '10.01.Attributs et balises de mise en forme',
    themes: [10],
    css: String.raw`/** disclaimer : si plusieurs attributs sur même élément : seul le dernier déclaré est révélé **/
* {
    box-sizing: border-box;
}


basefont,
blink,
center,
font,
marquee,
s,
strike,
tt,
u,
[size],
[align],
[alink],
[background],
[basefont],
[bgcolor],
[border],
[color],
[link],
[text],
[vlink],
[cellpadding],
[cellspacing],
[width]:not(img):not(svg),
[height]:not(img):not(svg){
    display: block!important;
    border: 10px solid red;
}

basefont:before {
    content: "<basefont>"!important;
}
blink:before {
    content: "<blink>"!important;
}
center:before {
    content: "<center>"!important;
}
font:before {
    content: "<font>"!important;
}
marquee:before {
    content: "<marquee>"!important;
}
s:before {
    content: "<s>"!important;
}
strike:before {
    content: "<strike>"!important;
}
tt:before {
    content: "<tt>"!important;
}
u:before {
    content: "<u>"!important;
}

[align]:before {
    content: "[attr:align]"!important;
}
[alink]:before {
    content: "[attr:alink]"!important;
}
[background]:before {
    content: "[attr:background]"!important;
}
[basefont]:before {
    content: "[attr:basefont]"!important;
}
[bgcolor]:before {
    content: "[attr:bgcolor]"!important;
}
[border]:before {
    content: "[attr:border]"!important;
}
[color]:before {
    content: "[attr:color]"!important;
}
[link]:before {
    content: "[attr:link]"!important;
}
[text]:before {
    content: "[attr:text]"!important;
}
[vlink]:before {
    content: "[attr:vlink]"!important;
}
[cellpadding]:before {
    content: "[attr:cellpadding]"!important;
}
[cellspacing]:before {
    content: "[attr:cellspacing]"!important;
}`,
  },
  {
    id: 'audit-10-07-focus',
    name: '10.07.Focus',
    themes: [10],
    css: String.raw`*:focus{outline:5px solid orange!important      }`,
  },
  {
    id: 'audit-10-08-textes-caches',
    name: '10.08.Textes cachés',
    themes: [10],
    css: String.raw`* {
    box-sizing: border-box;
}

[hidden],
[aria-hidden="true"] {
    display: block!important;
    border: 2px solid red!important;
    background: yellow!important;
}

[hidden]:before,
[aria-hidden="true"]:before {
    display: block!important;
    font-weight: bold!important;
    font-size: 100%!important;
    font-size: 1rem!important;
}

[hidden]:before {
    content: 'hidden';
}

[aria-hidden="true"]:before {
    content: 'aria-hidden="'attr(aria-hidden)'"'!important;
}`,
  },
  {
    id: 'audit-11-05-regroupements',
    name: '11.5.Regroupements',
    themes: [11],
    css: String.raw`* {
    box-sizing: border-box;
}

fieldset,
legend,
[role="group"] {
    display: block!important;
}

fieldset,
[role="group"] {
    border: 10px solid green
}

fieldset:before,
[role="group"]:before,
legend:before {
    display: block;
    font-family: sans-serif!important;
    font-size: 1rem!important;
    font-weight: bold;
    color: #fff!important;
    background: green;
}

legend {
    background: green;
    width: 100%;
    color: #fff;
}
legend:before {
    content: '<legend>'!important;
}

fieldset:before {
    content: '<fieldset>'!important;
}

fieldset[role] {
    border: 10px solid red
}
fieldset[role]:before {
    content: '<fieldset role="'attr(role)'">'!important;
    background: red;
    color: #fff
}


legend[role] {
    background: red;
}
legend[role]:before {
    content: '<legend role="'attr(role)'">'!important;
    background: red;
    color: #fff
}


[role="group"]:before {
    content: 'role="group"'!important;
    background: red
}

[role="group"][aria-label]:before {
    content: 'role="group" aria-label="'attr(aria-label)'"'!important;
    background: green
}

[role="group"][aria-labelledby]:before {
    content: 'role="group" aria-labelledby="'attr(aria-labelledby)'"'!important;
    background: green
}`,
  },
  {
    id: 'audit-12-06-landmarks',
    name: '12.06.Landmarks',
    themes: [12],
    css: String.raw`* {
    box-sizing: border-box;
}

[role="main"],
[role="banner"],
[role="search"],
[role="navigation"],
[role="contentinfo"],
header,
nav,
footer,
main {
    display: block!important;
    padding: 0 0 20px 0;
    margin: 20px;
}


[role="main"]:before,
[role="banner"]:before,
[role="search"]:before,
[role="navigation"]:before,
[role="contentinfo"]:before,
header:before,
nav:before,
footer:before,
main:before {
    display: block;
    font-family: sans-serif!important;
    font-size: 1rem!important;
    font-weight: bold;
    color: #fff!important;
    background: green;
}

/**banner**/
[role="banner"] {
    outline: solid 10px purple!important;
    counter-increment: banner;
}

[role="banner"]:before {
    content: 'role="'attr(role)'"'!important;
}

header:before {
    content: '<header ?!>'!important;
}

header[role="banner"]:before {
    content: '<header role="'attr(role)'">'!important;
}

/**search**/
[role="search"] {
    outline: solid 10px green!important;
    counter-increment: search;
}

[role="search"]:before {
    content: 'role="'attr(role)'"'!important;
}

/**navigation**/
[role="navigation"] {
    outline: solid 10px blue!important;
    counter-increment: navigation;
}

[role="navigation"]:before {
    content: 'role="'attr(role)'"'!important;
}

nav:before {
    content: '<nav ?!>'!important;
}

nav[role="navigation"]:before {
    content: '<nav role="'attr(role)'">'!important;
}

/**main**/
[role="main"] {
    outline: solid 10px purple!important;
    counter-increment: main;
}

[role="main"]:before {
    content: 'role="'attr(role)'"'!important;
}

main:before {
    content: '<main ?!>'!important;
}

main[role="main"]:before {
    content: '<main role="'attr(role)'">'!important;
}

/**contentinfo**/
[role="contentinfo"] {
    outline: solid 10px purple!important;
    counter-increment: contentinfo;
}

[role="contentinfo"]:before {
    content: 'role="'attr(role)'"'!important
}

footer:before {
    content: '<footer ?!>'!important
}

footer[role="contentinfo"]:before {
    content: '<footer role="'attr(role)'">'!important
}


html {
    padding-left: 220px;
    counter-reset: banner navigation search main contentinfo;
}

html:after {
    font-family: sans-serif!important;
    font-size: 1rem!important;
    font-weight: bold;
    color: #000!important;
    position: fixed!important;
    top: 0!important;
    left: 0!important;
    white-space: pre!important;
    width: 13em!important;
    padding: 15px!important;
    background: #eee!important;
    z-index: 100000!important;
    content: "" counter(banner) " role='banner'\A" "" counter(navigation) " role='navigation'\A" "" counter(search) " role='search'\A" "" counter(main) " role='main'\A" "" counter(contentinfo) " role='contentinfo'\A"
}`,
  },
  {
    id: 'audit-13-documents-bureautiques',
    name: '13.Documents bureautiques',
    themes: [13],
    css: String.raw`* {
    box-sizing: border-box;
}


a[href$=".doc"],
a[href$=".docx"],
a[href$=".xls"],
a[href$=".xlsx"],
a[href$=".ppt"],
a[href$=".pptx"],
a[href$=".odt"],
a[href$=".ods"],
a[href$=".pdf"] {
    display: block!important;
    margin-bottom: 3px!important;
    outline: 5px solid red!important;
}`,
  },
]
