/**
 * Numbers follow the page: #1 is the first image (or heading, link…) in reading order, whatever the order the scans found them in.
 * A rescan that finds an image at the top of the page (a menu that was closed the first time) puts it first and renumbers the rest.
 * Answers belong to the element (its key), not to its number, so they follow it.
 */

/**
 * `existing` in page order: the items found by the latest scan, in that scan's order (`foundKeys`, document order), and every
 * item that was not found this time (a popin that is closed now, a slide that is not showing) kept right after the item that
 * used to precede it, so it stays next to its neighbours.
 */
export function pageOrder<T extends { key: string }>(existing: T[], foundKeys: string[]): T[] {
  const byKey = new Map(existing.map((item) => [item.key, item]))
  const found = new Set(foundKeys.filter((k) => byKey.has(k)))
  // each absent item hangs on the nearest previous item that was found (null: before everything)
  const after = new Map<string | null, T[]>()
  let anchor: string | null = null
  for (const item of existing) {
    if (found.has(item.key)) {
      anchor = item.key
      continue
    }
    after.set(anchor, [...(after.get(anchor) ?? []), item])
  }
  const result: T[] = [...(after.get(null) ?? [])]
  const placed = new Set<string>()
  for (const key of foundKeys) {
    const item = byKey.get(key)
    if (!item || placed.has(key)) continue
    placed.add(key)
    result.push(item, ...(after.get(key) ?? []))
  }
  return result
}
