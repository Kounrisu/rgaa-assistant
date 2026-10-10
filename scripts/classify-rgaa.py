# Regenerates src/rgaa/rgaa-tests.json from the official RGAA 4.1 data and the
# automation classification below (the classification is our own estimate).
#   curl -L -o criteres.json https://raw.githubusercontent.com/DISIC/accessibilite.numerique.gouv.fr/main/RGAA/4.1/criteres.json
#   python3 scripts/classify-rgaa.py   # run next to criteres.json, then move the output into src/rgaa/
import json, re
A,S,M='auto','semi','manual'
# criterion -> (default level, note). Per-test overrides below.
C = {
'1.1':(S,'A script lists every image and checks that it has an accessible name; a human decides whether it carries information.'),
'1.2':(S,'A script checks that the image is hidden from assistive tech (alt="", aria-hidden…); a human decides whether it is decorative.'),
'1.3':(M,'Relevance of the alternative text is a human judgement.'),
'1.4':(M,'Needs a human to read the CAPTCHA / test image and its alternative.'),
'1.5':(M,'Needs a human to try the alternative access to the CAPTCHA.'),
'1.6':(S,'A script can find description mechanisms (aria-describedby, adjacent link…); a human decides whether the image needs one.'),
'1.7':(M,'Relevance of the detailed description is a human judgement.'),
'1.8':(M,'A human must decide whether the text could be real styled text.'),
'1.9':(S,'A script checks figure/figcaption structure; a human decides whether the image has a caption.'),
'2.1':(A,'A script checks that every iframe has a title attribute.'),
'2.2':(M,'Relevance of the frame title is a human judgement.'),
'3.1':(M,'A human must judge whether information relies on colour alone.'),
'3.2':(S,'Contrast can be computed on plain backgrounds; text over images, gradients or effects needs a human.'),
'3.3':(M,'Needs UI states and graphical context judged by a human.'),
'4.1':(M,'A human must watch/listen to the media and judge the transcript or audio description.'),
'4.2':(M,'Relevance of transcripts or audio descriptions is a human judgement.'),
'4.3':(M,'A human must check that synchronised captions exist and are needed.'),
'4.4':(M,'Relevance of captions is a human judgement.'),
'4.5':(M,'A human must decide whether an audio description is needed and present.'),
'4.6':(M,'Relevance of the audio description is a human judgement.'),
'4.7':(M,'A human must judge whether surrounding text identifies the media.'),
'4.8':(M,'A human must decide whether a non-temporal media needs an alternative.'),
'4.9':(M,'Relevance of the alternative is a human judgement.'),
'4.10':(S,'A script detects autoplay; a human checks the sound and the control.'),
'4.11':(M,'Keyboard and pointer control of media must be tried by a human.'),
'4.12':(M,'Keyboard and pointer control of media must be tried by a human.'),
'4.13':(M,'Needs testing with assistive technologies.'),
'5.1':(S,'A script detects complex tables and a summary mechanism; a human decides which tables are complex.'),
'5.2':(M,'Relevance of the summary is a human judgement.'),
'5.3':(S,'A script finds layout tables and data-table markup in them; a human checks the linearised reading.'),
'5.4':(S,'A script checks caption / title association; a human decides whether a title exists.'),
'5.5':(M,'Relevance of the table title is a human judgement.'),
'5.6':(S,'A script checks th / scope / role markup; a human decides which headers apply to the whole row or column.'),
'5.7':(S,'A script checks scope, headers and id attributes; a human decides which technique is appropriate.'),
'5.8':(S,'A script finds layout tables with data-table elements; a human decides what is a layout table.'),
'6.1':(S,'A script computes the link name; a human judges whether it is explicit.'),
'6.2':(A,'A script checks that every link has a non-empty name.'),
'7.1':(M,'Needs testing the scripted component with assistive technologies.'),
'7.2':(M,'Relevance of a script alternative is a human judgement.'),
'7.3':(S,'A script finds elements with event handlers that are not focusable; a human checks real behaviour.'),
'7.4':(M,'A human must trigger the context change and see whether the user is warned.'),
'7.5':(S,'A script finds live regions and status roles; a human checks the actual messages.'),
'8.1':(A,'A script reads the doctype.'),
'8.2':(A,'A validator (e.g. W3C Nu) checks the generated source.'),
'8.3':(A,'A script checks the lang attribute on <html>.'),
'8.4':(S,'A script checks that the language code is valid; a human checks it matches the content.'),
'8.5':(A,'A script checks that a non-empty <title> exists.'),
'8.6':(M,'Relevance of the page title is a human judgement.'),
'8.7':(S,'Language detection can flag candidates; a human confirms each change of language.'),
'8.8':(S,'A script validates lang codes; a human checks they match the text.'),
'8.9':(M,'A human must judge whether tags are used only for presentation.'),
'8.10':(S,'A script reads dir attributes; a human checks the reading direction of the text.'),
'9.1':(S,'A script reads the heading outline; a human judges relevance and finds fake headings.'),
'9.2':(S,'A script checks landmarks and structure; a human judges coherence.'),
'9.3':(S,'A script checks list markup; a human spots visual lists built without it.'),
'9.4':(M,'A human must spot quotations and check their markup.'),
'10.1':(A,'A script scans the generated source for presentational tags and attributes.'),
'10.2':(S,'A script can disable stylesheets and compare the content; a human confirms nothing is lost.'),
'10.3':(M,'A human must judge whether the unstyled page is understandable.'),
'10.4':(S,'A script can zoom text to 200% and detect clipping or overlap; a human confirms.'),
'10.5':(S,'A script reads computed colours and declarations; a human judges the cases found.'),
'10.6':(S,'A script computes link-to-text contrast; a human decides whether the link nature is obvious.'),
'10.7':(M,'A human must tab through the page and see the focus.'),
'10.8':(S,'A script lists hidden content; a human judges its intent.'),
'10.9':(M,'A human must judge whether information relies on shape, size or position alone.'),
'10.10':(M,'A human must judge whether information relies on shape, size or position alone.'),
'10.11':(S,'A script can resize the window and detect scrollbars or clipping; a human confirms.'),
'10.12':(S,'A script can apply the text-spacing styles and detect clipping; a human confirms.'),
'10.13':(M,'A human must trigger and dismiss the additional content.'),
'10.14':(M,'A human must check keyboard and pointer access to the additional content.'),
'11.1':(A,'A script checks label / aria / title associations of fields.'),
'11.2':(M,'Relevance of the label is a human judgement.'),
'11.3':(M,'Needs comparison of labels across the page or site.'),
'11.4':(M,'Visual proximity of label and field is a human judgement.'),
'11.5':(M,'A human must decide which fields belong together.'),
'11.6':(S,'A script checks fieldset / legend; a human decides which groups need one.'),
'11.7':(M,'Relevance of the legend is a human judgement.'),
'11.8':(S,'A script checks optgroup markup; a human decides whether grouping is relevant.'),
'11.9':(S,'A script computes the button name; a human judges relevance.'),
'11.10':(S,'A script detects required / aria-invalid markup; a human checks the messages and indications.'),
'11.11':(M,'A human must provoke errors and read the suggestions.'),
'11.12':(M,'A human must submit the form and check the safeguards.'),
'11.13':(S,'A script validates autocomplete tokens; a human decides which fields need one.'),
'12.1':(M,'Needs a human to review several pages of the site.'),
'12.2':(M,'Needs a human to compare pages of the site.'),
'12.3':(M,'Needs a human to read the site map and follow its links.'),
'12.4':(M,'Needs a human to compare pages of the site.'),
'12.5':(M,'Needs a human to compare pages of the site.'),
'12.6':(S,'A script checks landmarks; a human compares them across pages.'),
'12.7':(S,'A script finds a skip link and checks its target; a human checks it works and is consistent.'),
'12.8':(M,'A human must tab through the page.'),
'12.9':(M,'A human must tab through the page to find keyboard traps.'),
'12.10':(M,'A human must test single-key shortcuts.'),
'12.11':(M,'A human must check how additional content is reached by keyboard.'),
'13.1':(S,'A script detects meta refresh and timers; a human checks the user control.'),
'13.2':(M,'A human must see whether a window opens without user action.'),
'13.3':(S,'A script lists links to office documents; a human checks accessible versions.'),
'13.4':(M,'A human must compare the accessible version with the original.'),
'13.5':(M,'A human must spot cryptic content (ASCII art, emoticons…).'),
'13.6':(M,'Relevance of the alternative is a human judgement.'),
'13.7':(M,'Flash analysis needs a dedicated tool plus human judgement.'),
'13.8':(M,'A human must watch the page for moving or blinking content.'),
'13.9':(S,'A script can detect orientation locks; a human checks in both orientations.'),
'13.10':(M,'A human must try the gesture and its alternative.'),
'13.11':(M,'A human must try cancelling pointer actions.'),
'13.12':(M,'A human must try motion-triggered features and their alternatives.'),
}
# per-test overrides: id -> (level, note or None)
T = {
'1.3.8':(M,None),
'1.3.9':(S,'A script flags long alternatives; a human judges whether it is short and concise.'),
'1.6.6':(S,'A script checks that the referenced description exists and is exposed.'),
'1.6.8':(S,'A script checks that the referenced description exists and is exposed.'),
'1.6.9':(S,'A script checks that the referenced description exists and is exposed.'),
'4.3.2':(S,'A script checks <track> kind / srclang; a human checks the captions.'),
'5.8.1':(A,'A script checks that layout tables contain no data-table elements (once layout tables are identified).'),
'6.1.5':(A,'A script compares the accessible name with the visible label (symbols and icons need a human).'),
'8.10.2':(A,'A script checks the dir attribute values.'),
'8.1.2':(A,None),'8.1.3':(A,None),
'11.2.5':(A,'A script checks that the accessible name contains the visible label.'),
'11.8.2':(A,'A script checks that every optgroup has a label.'),
'11.8.3':(M,'Relevance of the group label is a human judgement.'),
'11.1.3':(S,'A script finds hidden or unusual labels; a human checks they are acceptable.'),
'11.10.3':(M,None),'11.10.5':(M,None),'11.10.6':(M,None),
'13.1.2':(A,'A script reads the delay of <meta http-equiv="refresh">.'),
'13.1.3':(M,'A human must check scripted redirects.'),
'13.1.4':(M,'A human must check session time limits.'),
'13.1.1':(S,'A script detects meta refresh and timers; a human checks the user control.'),
'4.11.1':(S,'A script checks for native controls on video/audio; a human checks the rest.'),
'3.2.5':(M,None),
'3.3.1':(S,'Contrast of UI components can be computed per state; a human reviews the states.'),
'10.1.3':(S,'A script flags runs of spaces used for layout; a human decides.'),
}

# For every semi-automatic criterion: (what a script can check, what a human must decide).
SH = {
'1.1':("Finds every image of this type and tests that it has an accessible name (alt, aria-label, aria-labelledby, title, svg <title>…).","Decides whether the image carries information. If it is decorative, the test does not apply (see 1.2)."),
'1.2':("Tests that the element is hidden from assistive tech (alt=\"\", aria-hidden=\"true\", role=presentation) and has no other accessible name.","Decides whether the image really is decorative. A script cannot know the intent of an image."),
'1.6':("Looks for description mechanisms: adjacent link/button, aria-describedby / aria-labelledby targets, longdesc.","Decides whether the image is complex enough (chart, map, diagram) to need a detailed description at all."),
'1.9':("Checks the <figure> / <figcaption> structure, role=figure|group and the aria-label match.","Decides whether the image has a caption in the first place, and whether the caption belongs to it."),
'3.2':("Computes the contrast ratio of text over flat, readable backgrounds, and applies the size/weight thresholds.","Checks text over images, gradients, transparency or effects, and text rendered inside images."),
'4.10':("Detects media that autoplay (autoplay attribute, play() calls).","Listens to the sound, measures its length and checks that a control is reachable."),
'5.1':("Detects tables that look complex (merged cells, several header levels) and looks for a summary mechanism (caption, aria-describedby, details…).","Decides which tables are really complex and whether a summary is needed."),
'5.3':("Finds layout tables and checks they contain no data-table elements.","Reads the linearised content and judges whether it still makes sense."),
'5.4':("Checks whether a table has a caption / aria-labelledby / role association.","Decides whether a visible title exists and whether it belongs to the table."),
'5.6':("Checks th, scope, role=columnheader/rowheader markup.","Decides which headers apply to the whole row or column, and which cells are headers."),
'5.7':("Checks scope, headers/id and role attributes on cells.","Decides which association technique is appropriate for this table."),
'5.8':("Checks layout tables for th, caption, thead, scope, headers…","Decides which tables are layout tables rather than data tables."),
'6.1':("Computes the accessible name of each link (text, alt, aria-label, title, svg title) and flags empty or generic ones (“click here”, “read more”).","Judges whether the name is explicit in context (the link context, the surrounding sentence or list item)."),
'7.3':("Finds elements with JavaScript event handlers that are not focusable or lack a role.","Operates the component with the keyboard and with a pointer to see that it truly works."),
'7.5':("Finds live regions and status roles (role=status|alert|log, aria-live).","Triggers the messages and checks that they are announced and match what appears on screen."),
'8.4':("Validates the language code syntax (BCP 47).","Checks that the code matches the actual language of the content."),
'8.7':("Language detection can flag text blocks that seem to be in another language.","Confirms each real change of language and whether it needs a lang attribute (names, borrowed words…)."),
'8.8':("Validates the syntax of each lang attribute.","Checks that each code matches the text it covers."),
'8.10':("Reads dir attributes and the bidi-related markup.","Checks that the reading direction of the text matches the markup."),
'9.1':("Reads the heading outline and flags skipped levels, empty headings and the missing h1.","Judges whether the hierarchy is relevant and finds text that looks like a heading but is not marked up."),
'9.2':("Checks for landmarks / sectioning (header, nav, main, footer…) and unique main.","Judges whether the structure is coherent for the content."),
'9.3':("Checks that ul/ol/dl markup is valid and flags lists of lines starting with dashes or numbers.","Spots lists that are visual only and decides what counts as a list."),
'10.2':("Disables the stylesheets and compares the text and images that remain.","Confirms nothing informative disappeared."),
'10.4':("Zooms text to 200% and detects clipping, overlap and horizontal overflow.","Looks at the result and decides whether content or function is lost."),
'10.5':("Reads the computed colours and CSS declarations (color, background, images).","Judges the cases found, such as text over background images."),
'10.6':("Computes the colour contrast between a link and the surrounding text, and detects links with no underline.","Decides whether the nature of the link is obvious without colour."),
'10.8':("Lists hidden content (display:none, hidden, aria-hidden, off-screen).","Judges whether each hidden element is meant to be ignored by assistive tech."),
'10.11':("Resizes the window (320 px wide / 256 px high) and detects scrollbars and clipping.","Checks the result and the cases the rule excludes."),
'10.12':("Applies the user text-spacing styles and detects clipping or overlap.","Checks that content and function are preserved."),
'11.6':("Finds fieldset / legend and role=group|radiogroup markup.","Decides which fields belong together and therefore need a group."),
'11.8':("Checks optgroup markup in select lists.","Decides whether the options are of the same nature and need grouping."),
'11.9':("Computes the accessible name of each button and checks that it is not empty.","Judges whether the name describes the action."),
'11.10':("Detects required / aria-required / aria-invalid markup and error-message associations.","Reads the messages and indications and judges whether they are clear and complete."),
'11.13':("Validates autocomplete tokens on fields.","Decides which fields collect user data and therefore need an autocomplete value."),
'12.6':("Detects the landmarks / regions (header, nav, main, footer, search).","Compares them across the pages of the site."),
'12.7':("Finds the skip link, checks that its target exists and receives focus.","Checks that it is visible on focus, works, and is consistent across pages."),
'13.1':("Detects meta refresh, setTimeout / setInterval refreshes.","Checks that the user can stop, extend or control the delay."),
'13.3':("Lists links to office documents (pdf, docx, odt, xls…).","Opens the documents and checks that an accessible version exists."),
'13.9':("Detects CSS or JS orientation locks (@media orientation, screen.orientation.lock).","Checks the page in both orientations."),
}
# Overrides: test id -> (script, human); only where they differ from the criterion.
SHT = {
'1.1.4':("Detects <img ismap> and server-side image maps.","Checks that every clickable zone has an equivalent link usable with any pointing device."),
'1.3.9':("Flags alternatives that are long (e.g. over ~150 characters).","Judges whether the alternative is short and concise for what the image conveys."),
'1.6.6':("Checks that the referenced description (aria-describedby / aria-labelledby target) exists in the page.","Checks that the reference is announced correctly."),
'1.6.8':("Checks that the referenced description exists in the page.","Checks that the reference is announced correctly."),
'1.6.9':("Checks that the referenced description exists in the page.","Checks that the reference is announced correctly."),
'3.3.1':("Computes the contrast of UI component boundaries and states that are present in the page.","Reviews the interaction states (hover, focus, active, disabled) one by one."),
'4.3.2':("Checks <track> elements (kind, srclang) for the media.","Plays the media and checks the captions."),
'4.11.1':("Checks that native video/audio elements have controls.","Checks custom players and the other features."),
'10.1.3':("Flags runs of spaces, nbsp or empty tags used for layout.","Decides whether the spacing is used to format text."),
'11.1.3':("Finds hidden or unusual labels (aria-label, title, off-screen text).","Checks that they are acceptable for the field."),
}

def clean(x):
    x=re.sub(r'\[([^\]]*)\]\([^)]*\)',r'\1',x)
    return x.replace('\xa0',' ').strip()
d=json.load(open('criteres.json'))
out={'source':'https://github.com/DISIC/accessibilite.numerique.gouv.fr (RGAA/4.1/criteres.json)','topics':[]}
counts={A:0,S:0,M:0}
for t in d['topics']:
    ot={'number':t['number'],'name':t['topic'],'criteria':[]}
    for c in t['criteria']:
        c=c['criterium']; cid=f"{t['number']}.{c['number']}"
        lvl,note=C[cid]
        wcag=[w for r in c.get('references',[]) for w in r.get('wcag',[])]
        oc={'id':cid,'title':clean(c['title']),'wcag':wcag,'automation':lvl,'note':note,'tests':[]}
        for k,v in c['tests'].items():
            tid=f"{cid}.{k}"
            tl,tn=T.get(tid,(lvl,None))
            script=human=None
            if tl==S:
                script,human=SHT.get(tid, SH.get(cid, (None,None)))
            elif tl==A:
                script=tn or note
            else:
                human=tn or note
            oc['tests'].append({'id':tid,'text':clean(v[0]),'conditions':[clean(x) for x in v[1:]],'automation':tl,'note':tn or note,'script':script,'human':human})
            counts[tl]+=1
        # criterion level = most demanding across its tests
        levels={x['automation'] for x in oc['tests']}
        oc['automation']= M if M in levels and len(levels)==1 else (A if levels=={A} else (S if levels=={S} else (S if levels!={M} else M)))
        ot['criteria'].append(oc)
    out['topics'].append(ot)
print(counts, sum(counts.values()))
json.dump(out,open('rgaa-tests.json','w'),ensure_ascii=False,separators=(',',':'))
