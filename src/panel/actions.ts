import type { Registry } from './panel'

/**
 * The calls that go "upwards" between panel modules.
 *
 * A module imports the modules below it directly. When it must call something that lives above it (render the whole
 * panel, change the view, switch page...), importing it would make a cycle. It calls `actions.renderAll()` instead.
 * panel.ts fills this object once, at start-up, with the real functions (see `registry` there), before any event can
 * fire. The type comes from that registry, so a call is checked like a normal import.
 */
export const actions = {} as Registry

export function registerActions(registry: Registry): void {
  Object.assign(actions, registry)
}
