/**
 * Tree normalization for wire transport.
 *
 * Converts UINode trees into wire-compatible form by applying scoped
 * IDs, encoding prop values, and validating the tree structure.
 *
 * ## Scoped ID rules
 *
 * Named containers (non-auto, non-window) scope their children's IDs
 * by prefixing with `parentId/`. Auto-ID nodes (id starts with "auto:")
 * and window nodes (type "window") never create scopes -- children
 * inherit the parent's scope unchanged.
 *
 * @module
 */

import type { UINode } from "../types.js";

/**
 * A wire-compatible tree node. All keys are strings, all values
 * are JSON/MessagePack-safe.
 */
export interface WireNode {
  readonly id: string;
  readonly type: string;
  readonly props: Readonly<Record<string, unknown>>;
  readonly children: readonly WireNode[];
}

/**
 * Check whether an ID is auto-generated (unstable, doesn't create scope).
 */
export function isAutoId(id: string): boolean {
  return id.startsWith("auto:");
}

/**
 * Normalize a UINode tree into wire-compatible form.
 *
 * Applies scoped IDs, validates structure, and prepares for wire
 * encoding. Returns a single root WireNode.
 *
 * @param tree - A UINode, array of UINodes, or null.
 * @returns Normalized wire-ready tree.
 *
 * @example
 * ```ts
 * // Single node
 * normalize({ id: "root", type: "column", props: {}, children: [] })
 *
 * // Array of nodes (wrapped in synthetic root container)
 * normalize([windowNode1, windowNode2])
 *
 * // Null (empty root container)
 * normalize(null)
 * ```
 */
export function normalize(tree: UINode | readonly UINode[] | null): WireNode {
  if (tree === null) {
    return { id: "auto:root", type: "container", props: {}, children: [] };
  }

  if (Array.isArray(tree)) {
    if (tree.length === 0) {
      return { id: "auto:root", type: "container", props: {}, children: [] };
    }
    if (tree.length === 1) {
      return normalizeNode(tree[0]!, "");
    }
    // Wrap multiple nodes in a synthetic root. Synthetic root doesn't
    // create scope (it uses an auto-ID).
    return {
      id: "auto:root",
      type: "container",
      props: {},
      children: tree.map((child) => normalizeNode(child, "")),
    };
  }

  return normalizeNode(tree as UINode, "");
}

/**
 * Normalize a single node and its children recursively.
 *
 * @param node - The UINode to normalize.
 * @param scope - The current scope prefix (empty string for root).
 * @returns Normalized WireNode.
 */
function normalizeNode(node: UINode, scope: string): WireNode {
  const id = node.id;
  const type = node.type;

  // Validate: user IDs must not contain "/"
  if (!isAutoId(id) && id.includes("/")) {
    throw new Error(
      `Widget ID "${id}" contains "/" which is reserved for scoped IDs. ` +
        `Use a different character or let the framework handle scoping.`,
    );
  }

  // Apply scope prefix to this node's ID
  const scopedId = scope !== "" && !isAutoId(id) ? `${scope}/${id}` : id;

  // Determine the scope for children:
  // Named (non-auto) non-window nodes propagate their scoped ID as the child scope.
  // Auto-ID nodes and window nodes don't create scope boundaries.
  const childScope = isAutoId(id) || type === "window" ? scope : scopedId;

  // Normalize children recursively
  const children = node.children.map((child) => normalizeNode(child, childScope));

  // Check for duplicate sibling IDs (warning, not error)
  if (children.length > 1) {
    const ids = new Set<string>();
    for (const child of children) {
      if (ids.has(child.id)) {
        console.warn(
          `Duplicate sibling ID "${child.id}" under parent "${scopedId}". ` +
            `This will cause undefined behavior in widget caching and event routing.`,
        );
      }
      ids.add(child.id);
    }
  }

  // Resolve a11y ID references relative to the current scope
  let props = node.props;
  if (props["a11y"] && scope !== "") {
    const a11y = { ...(props["a11y"] as Record<string, unknown>) };
    let changed = false;
    for (const refField of ["labelled_by", "described_by", "error_message"]) {
      const val = a11y[refField];
      if (typeof val === "string" && !val.includes("/")) {
        a11y[refField] = `${scope}/${val}`;
        changed = true;
      }
    }
    if (changed) {
      props = { ...props, a11y };
    }
  }

  return {
    id: scopedId,
    type,
    props,
    children,
  };
}
