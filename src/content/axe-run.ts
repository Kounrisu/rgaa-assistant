/**
 * Runs the axe engine in the page. Imported by the content script only (inlined in its bundle).
 */
import type { AxeRunResponse } from '../lib/messages'

/** Runs the axe engine (injected by the background page just before) and sends back a light copy of its findings. */
export async function runAxe(locale: unknown, rules: unknown): Promise<AxeRunResponse> {
  type AxeApi = { run: (ctx: Document, opts: object) => Promise<Record<string, unknown>>; configure: (c: object) => void }
  const axe = ((globalThis as unknown as { axe?: AxeApi }).axe ?? (window as unknown as { axe?: AxeApi }).axe) as AxeApi | undefined
  if (!axe) return { error: 'axe-not-loaded' }
  try {
    if (locale) axe.configure({ locale })
    // only the rules that map to an RGAA criterion, in this frame (waiting for other frames can hang a page for a minute)
    const only = Array.isArray(rules) && rules.length ? { runOnly: { type: 'rule', values: rules.map(String) } } : {}
    const r = (await axe.run(document, { resultTypes: ['violations', 'incomplete'], iframes: false, elementRef: false, ...only })) as {
      violations: { id: string; impact: string | null; help: string; nodes: { html: string; target: unknown[]; any?: { data?: unknown }[] }[] }[]
      incomplete: unknown[]
      passes: { id: string }[]
      inapplicable: { id: string }[]
    }
    return {
      url: location.href,
      violations: r.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        nodes: v.nodes.slice(0, 200).map((n) => ({ html: n.html.slice(0, 400), target: n.target.flat().map(String), any: n.any?.[0]?.data ? [{ data: n.any[0].data }] : [] })),
      })),
      incomplete: r.incomplete.length,
      passes: r.passes?.length ?? 0,
      passedRules: (r.passes ?? []).map((p) => p.id),
      inapplicableRules: (r.inapplicable ?? []).map((p) => p.id),
    }
  } catch (err) {
    return { error: String(err) }
  }
}
