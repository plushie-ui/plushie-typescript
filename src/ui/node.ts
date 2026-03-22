import type { UINode, Handler } from "../types.js"

/**
 * Internal: create a UINode. Handlers are stored separately from
 * wire props -- they never leave the TypeScript side.
 */
export function createNode(
  id: string,
  type: string,
  props: Record<string, unknown>,
  children: UINode[],
): UINode {
  return Object.freeze({
    id,
    type,
    props: Object.freeze(props),
    children: Object.freeze(children),
  })
}

/** Auto-generate an ID from a content string and type. */
let autoIdCounter = 0
export function autoId(type: string): string {
  return `auto:${type}:${++autoIdCounter}`
}

/** Reset the auto-ID counter (for testing). */
export function resetAutoId(): void {
  autoIdCounter = 0
}
