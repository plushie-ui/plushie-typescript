/**
 * JSX automatic runtime for plushie.
 *
 * Enables JSX syntax in TypeScript files via:
 * ```json
 * { "jsx": "react-jsx", "jsxImportSource": "plushie" }
 * ```
 *
 * PascalCase component functions (Window, Column, Button, etc.) are
 * called directly with their props. Children are collected from
 * `props.children` and normalized (nulls filtered, arrays flattened,
 * strings converted to text content).
 *
 * @module
 */

import type { UINode } from "./types.js";

/**
 * JSX element creation (production runtime).
 *
 * Called by the TypeScript compiler for JSX expressions.
 * `type` is always a component function (PascalCase).
 */
export function jsx(
  type: (props: Record<string, unknown>) => UINode,
  props: Record<string, unknown>,
  _key?: string,
): UINode {
  // Normalize children
  if ("children" in props) {
    props = { ...props, children: normalizeChildren(props["children"]) };
  }
  return type(props);
}

/**
 * JSX element creation with static children (production runtime).
 * Same as jsx -- the distinction is for React optimizations we don't need.
 */
export function jsxs(
  type: (props: Record<string, unknown>) => UINode,
  props: Record<string, unknown>,
  _key?: string,
): UINode {
  return jsx(type, props, _key);
}

/** Fragment support. Returns children as-is (array of UINodes). */
export const Fragment = Symbol.for("plushie.fragment");

/**
 * Normalize JSX children: filter out null/undefined/boolean,
 * flatten nested arrays. String children pass through (widget
 * components handle them in their props).
 */
function normalizeChildren(children: unknown): unknown {
  if (children === null || children === undefined || typeof children === "boolean") {
    return undefined;
  }
  if (Array.isArray(children)) {
    const flat: unknown[] = [];
    for (const child of children) {
      if (child === null || child === undefined || typeof child === "boolean") continue;
      if (Array.isArray(child)) {
        for (const nested of child) {
          if (nested !== null && nested !== undefined && typeof nested !== "boolean") {
            flat.push(nested);
          }
        }
      } else {
        flat.push(child);
      }
    }
    return flat;
  }
  return children;
}
