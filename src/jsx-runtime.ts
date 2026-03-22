import type { UINode } from "./types.js"

// Placeholder JSX runtime. The full implementation will map JSX
// elements to widget builder functions and collect children.
//
// Usage in tsconfig.json:
//   "jsx": "react-jsx",
//   "jsxImportSource": "plushie"

export function jsx(
  _type: string | ((props: Record<string, unknown>) => UINode),
  _props: Record<string, unknown>,
  _key?: string,
): UINode {
  // TODO: implement JSX element creation
  throw new Error("JSX runtime not yet implemented")
}

export function jsxs(
  type: string | ((props: Record<string, unknown>) => UINode),
  props: Record<string, unknown>,
  key?: string,
): UINode {
  return jsx(type, props, key)
}

export const Fragment = Symbol.for("plushie.fragment")
