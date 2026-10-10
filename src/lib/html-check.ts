/**
 * Checks the generated HTML of a page against the HTML specification (RGAA criterion 8.2: valid source code),
 * locally with html-validate (MIT): the page is never sent anywhere. Style-only rules and the rules axe already covers
 * (alt text, labels…) are turned off: what is left is about the structure and the attributes of the markup.
 */
export interface HtmlIssue {
  rule: string
  message: string
  line: number
  column: number
  selector: string | null
}
export interface HtmlRuleGroup {
  rule: string
  count: number
  message: string
  examples: HtmlIssue[]
}
export interface HtmlCheck {
  at: number
  errors: number
  groups: HtmlRuleGroup[]
}

const OFF = [
  'doctype-style', 'void-style', 'no-trailing-whitespace', 'attr-quotes', 'attr-case', 'attr-pattern', 'element-case', 'no-inline-style',
  'no-implicit-close', 'prefer-native-element', 'no-redundant-role', 'tel-non-breaking', 'long-title', 'no-conditional-comment',
  'attribute-boolean-style', 'attribute-empty-style', 'input-missing-label', 'text-content', 'no-raw-characters', 'prefer-tbody',
  'empty-heading', 'heading-level', 'no-multiple-main', 'unique-landmark', 'require-sri', 'no-utf8-bom', 'script-type', 'no-self-closing',
  'wcag/h30', 'wcag/h32', 'wcag/h36', 'wcag/h37', 'wcag/h63', 'wcag/h67', 'wcag/h71', 'area-alt', 'hidden-focusable', 'meta-refresh',
  'no-abstract-role', 'no-autoplay', 'no-redundant-for', 'prefer-button', 'allowed-links', 'valid-autocomplete', 'multiple-labeled-controls',
  'aria-hidden-body', 'aria-label-misuse', 'form-dup-name', 'no-missing-references', 'fieldset-name',
]

export async function checkHtml(html: string): Promise<HtmlCheck> {
  const [{ HtmlValidate, StaticConfigLoader }, html5] = await Promise.all([import('html-validate/browser'), import('html-validate/elements/html5')])
  const rules: Record<string, 'off'> = Object.fromEntries(OFF.map((r) => [r, 'off' as const]))
  const loader = new StaticConfigLoader({ extends: ['html-validate:recommended'], elements: [html5.default as never], rules })
  const report = await new HtmlValidate(loader).validateString(html)
  const messages = report.results.flatMap((r) => r.messages).filter((m) => m.severity === 2)
  const byRule = new Map<string, HtmlRuleGroup>()
  for (const m of messages) {
    const rule = m.ruleId ?? 'parse'
    const g = byRule.get(rule) ?? { rule, count: 0, message: m.message, examples: [] }
    g.count++
    if (g.examples.length < 8) g.examples.push({ rule, message: m.message, line: m.line, column: m.column, selector: m.selector ?? null })
    byRule.set(rule, g)
  }
  return { at: Date.now(), errors: messages.length, groups: [...byRule.values()].sort((a, b) => b.count - a.count) }
}
