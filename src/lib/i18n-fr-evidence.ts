/** French for the texts added with the evidence work. Key = the English text. */
export const FR_EVIDENCE: Record<string, string> = {
  'provisional': 'provisoire',
  '{n} to confirm': '{n} à confirmer',
  '{n} partly covered': '{n} à couverture partielle',
  '{n} failure(s) to confirm': '{n} échec(s) à confirmer',
  'Detected automatically, not confirmed by the auditor.': 'Détecté automatiquement, non confirmé par l’auditeur.',
  'Partial coverage: {n} test(s) not assessed by RGAA Assistant.': 'Couverture partielle : {n} test(s) non évalué(s) par RGAA Assistant.',
  'Conflicting evidence: {x}.': 'Résultats contradictoires : {x}.',
  'Provisional result.': 'Résultat provisoire.',
  'The audit is incomplete: criteria remain to be tested, some are only partly covered by the tool, or rest on automatic pre-filled answers the auditor has not confirmed. A criterion compliant on only part of its tests counts as not tested. Do not publish this rate as the final conformity level.':
    'L’audit est incomplet : des critères restent à tester, certains ne sont couverts que partiellement par l’outil, ou reposent sur des réponses pré-remplies automatiquement que l’auditeur n’a pas confirmées. Un critère conforme sur une partie seulement de ses tests compte comme non testé. Ne publiez pas ce taux comme niveau de conformité définitif.',
  '{toConfirm} criteria await confirmation of an automatic suggestion; {partial} have partial coverage.':
    '{toConfirm} critère(s) attendent la confirmation d’une suggestion automatique ; {partial} ont une couverture partielle.',
  'Provisional: the audit is incomplete.': 'Provisoire : l’audit est incomplet.',
  'The audit follows the RGAA 4.1 on a sample of pages. Pages were checked in a browser with RGAA Assistant: element-by-element review (images, frames, colours, links, structure, tables, forms), automatic checks (axe-core, RGAA checks, rules derived from Asqatasun, HTML validation) and manual checks (keyboard, zoom, screen reader). Automatic results are evidence and suggestions: they only count once the auditor has confirmed them, and they cover only part of the RGAA.':
    'L’audit suit le RGAA 4.1 sur un échantillon de pages. Les pages ont été contrôlées dans un navigateur avec RGAA Assistant : relecture élément par élément (images, cadres, couleurs, liens, structure, tableaux, formulaires), contrôles automatiques (axe-core, contrôles RGAA, règles dérivées d’Asqatasun, validation du HTML) et contrôles manuels (clavier, zoom, lecteur d’écran). Les résultats automatiques sont des indices et des suggestions : ils ne comptent qu’une fois confirmés par l’auditeur, et ne couvrent qu’une partie du RGAA.',
  'A tool suggests an answer for these criteria. Confirm or change each one: until then they count as to review.':
    'Un outil suggère une réponse pour ces critères. Confirmez ou modifiez chacune : d’ici là, ils comptent comme à relire.',
  'Failures found by a tool and not yet confirmed. They are counted as non-compliant, so the rate is provisional.':
    'Échecs trouvés par un outil et non encore confirmés. Ils sont comptés comme non conformes : le taux est donc provisoire.',
  'Some tests of these criteria are not supported by this tool. A compliant result on the other tests is counted as not tested; a failure is kept.':
    'Certains tests de ces critères ne sont pas pris en charge par cet outil. Un résultat conforme sur les autres tests compte comme non testé ; un échec est conservé.',
  'Suggested: {verdict} (from {tool}).': 'Suggestion : {verdict} (d’après {tool}).',
  'Not counted as confirmed until you confirm it.': 'Non compté comme confirmé tant que vous ne l’avez pas confirmé.',
  'Change': 'Modifier',
  'Provisional rate: some criteria are still to test, are only partly covered by this tool, or rest on an automatic answer you have not confirmed. A compliant result on only part of a criterion counts as not tested; a suggested compliance counts as to review until you confirm it; a failure is always kept.':
    'Taux provisoire : des critères restent à tester, ne sont couverts que partiellement par cet outil, ou reposent sur une réponse automatique non confirmée. Un résultat conforme sur une partie seulement d’un critère compte comme non testé ; une conformité suggérée compte comme à relire tant que vous ne l’avez pas confirmée ; un échec est toujours conservé.',
  'Rates marked provisional (or with an asterisk) come from an incomplete audit. A criterion compliant on only part of its tests counts as not tested, a suggestion from a tool counts as to review until you confirm it, and a known failure is always kept.':
    'Les taux marqués provisoires (ou d’un astérisque) viennent d’un audit incomplet. Un critère conforme sur une partie seulement de ses tests compte comme non testé, une suggestion d’un outil compte comme à relire tant que vous ne l’avez pas confirmée, et un échec connu est toujours conservé.',
}
