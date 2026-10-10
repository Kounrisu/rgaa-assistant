/**
 * Context HTML of a finding: a copy of a subtree with the target element marked.
 * Imported by the content script only (inlined in its bundle).
 */

/** Path of child indexes (element children only) from `root` down to `el`; null when `el` is not inside `root`. */
export function pathFrom(root: Element, el: Element): number[] | null {
  const path: number[] = []
  let node: Element | null = el
  while (node && node !== root) {
    const parent: Element | null = node.parentElement
    if (!parent) return null
    path.unshift(Array.prototype.indexOf.call(parent.children, node))
    node = parent
  }
  return node === root ? path : null
}

export function followPath(root: Element, path: number[]): Element | null {
  let node: Element | null = root
  for (const i of path) node = node?.children[i] ?? null
  return node
}

/**
 * Clones `context`, marks the copy of `target` with data-rgaa-target, THEN removes the nodes matching `strip` from the copy.
 * The target is located before any removal: removing preceding nodes cannot shift it onto another element.
 * A target that is itself removed (or not inside the context) simply leaves no mark.
 */
export function cloneWithTarget(context: Element, target: Element, strip: string): Element {
  const clone = context.cloneNode(true) as Element
  const path = context === target ? [] : pathFrom(context, target)
  const marked = path ? followPath(clone, path) : null
  marked?.setAttribute('data-rgaa-target', '')
  clone.querySelectorAll(strip).forEach((n) => n.remove())
  return clone
}
