/**
 * Subtree memoization for the view function.
 *
 * @module
 */

import type { UINode } from "./types.js";

let memoCounter = 0;

function resetMemoCounter(): void {
  memoCounter = 0;
}

export { resetMemoCounter };

/**
 * Cache a subtree based on a dependency value.
 *
 * When `deps` is deep-equal to the previous render's value for this
 * memo site, the cached normalized subtree is reused directly. The
 * tree differ short-circuits on reference equality, making diff for
 * unchanged subtrees O(1).
 *
 * The body function is only evaluated when `deps` changes. For dynamic
 * lists, include the item key in deps so each iteration gets a unique
 * cache entry:
 *
 * ```ts
 * for (const item of state.items) {
 *   memo({ id: item.id, v: item.version }, () => itemCard(item))
 * }
 * ```
 *
 * @param deps - A value compared by deep equality across renders.
 * @param body - A function returning the subtree to cache.
 */
export function memo(deps: unknown, body: () => UINode | readonly UINode[] | null): UINode {
  const id = `auto:memo:${++memoCounter}`;
  return Object.freeze({
    id,
    type: "__memo__",
    props: Object.freeze({}),
    children: Object.freeze([]) as readonly UINode[],
    meta: Object.freeze({
      __memo_deps__: deps,
      __memo_fun__: body,
    }),
  });
}
