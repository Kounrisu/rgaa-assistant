import { h } from './dom'
import { state } from './state'
import type { Child } from './types'

/** Show information first, then retain the auditor's choice when a view is rebuilt. */
export function disclosure(key: string, props: Record<string, unknown>, ...children: Child[]): HTMLDetailsElement {
  const node = h('details', { ...props, open: state.disclosures.get(key) ?? true }, ...children)
  node.addEventListener('toggle', () => {
    // A replaced node can still have a queued toggle event.
    if (node.isConnected) state.disclosures.set(key, node.open)
  })
  return node
}
