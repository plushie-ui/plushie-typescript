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

import {
  getStandardProps,
  isPlaceholder,
  type Registry,
  type RegistryEntry,
  renderPlaceholder,
} from "../canvas-widget.js";
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
/**
 * Context passed through normalization to support canvas widget expansion.
 * When a registry is provided, canvas widget placeholders are expanded
 * inline during normalization.
 */
export interface NormalizeContext {
  /** Existing canvas widget registry for state continuity. */
  readonly registry?: Registry | undefined;
  /** Accumulator for new registry entries discovered during expansion. */
  readonly newEntries?: Map<string, RegistryEntry> | undefined;
}

export function normalize(
  tree: UINode | readonly UINode[] | null,
  ctx?: NormalizeContext,
): WireNode {
  if (tree === null) {
    return { id: "auto:root", type: "container", props: {}, children: [] };
  }

  if (Array.isArray(tree)) {
    if (tree.length === 0) {
      return { id: "auto:root", type: "container", props: {}, children: [] };
    }
    if (tree.length === 1) {
      return normalizeNode(tree[0]!, "", undefined, ctx);
    }
    // Wrap multiple nodes in a synthetic root. Synthetic root doesn't
    // create scope (it uses an auto-ID).
    return {
      id: "auto:root",
      type: "container",
      props: {},
      children: tree.map((child) => normalizeNode(child, "", undefined, ctx)),
    };
  }

  return normalizeNode(tree as UINode, "", undefined, ctx);
}

/**
 * Normalize a single node and its children recursively.
 *
 * @param node - The UINode to normalize.
 * @param scope - The current scope prefix (empty string for root).
 * @returns Normalized WireNode.
 */
function normalizeNode(
  node: UINode,
  scope: string,
  windowId: string | undefined,
  ctx?: NormalizeContext,
): WireNode {
  const id = node.id;
  const type = node.type;
  const currentWindowId = type === "window" ? id : windowId;

  // Validate: user IDs must not contain "/"
  if (!isAutoId(id) && id.includes("/")) {
    throw new Error(
      `Widget ID "${id}" contains "/" which is reserved for scoped IDs. ` +
        `Use a different character or let the framework handle scoping.`,
    );
  }

  // Apply scope prefix to this node's ID
  const scopedId = scope !== "" && !isAutoId(id) ? `${scope}/${id}` : id;

  // Canvas widget placeholder expansion: if this node is a canvas widget
  // placeholder and we have a registry context, render the placeholder
  // and normalize the rendered output in place.
  if (ctx?.registry && isPlaceholder(node)) {
    const standardProps = getStandardProps(node);
    const result = renderPlaceholder(node, currentWindowId, scopedId, id, ctx.registry);
    if (result) {
      // Record the new entry for registry derivation
      if (ctx.newEntries) {
        ctx.newEntries.set(result.key, result.entry);
      }
      // Normalize the rendered output (which may itself contain children)
      // The rendered node's ID is already set to scopedId by renderPlaceholder,
      // so we normalize it as a root (no additional scoping).
      return normalizeRenderedWidget(
        result.node,
        scopedId,
        scope,
        currentWindowId,
        ctx,
        standardProps,
      );
    }
  }

  // Determine the scope for children:
  // Named (non-auto) non-window nodes propagate their scoped ID as the child scope.
  // Auto-ID nodes and window nodes don't create scope boundaries.
  const childScope = isAutoId(id) || type === "window" ? scope : scopedId;

  // Normalize children recursively
  const children = node.children.map((child) =>
    normalizeNode(child, childScope, currentWindowId, ctx),
  );

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
  const props = resolveA11yRefs(node.props, scope);

  return {
    id: scopedId,
    type,
    props,
    children,
  };
}

/**
 * Normalize a rendered canvas widget node. The node's ID is already
 * the scoped ID. Children are normalized with the scoped ID as their
 * scope prefix.
 */
function normalizeRenderedWidget(
  node: UINode,
  scopedId: string,
  parentScope: string,
  windowId: string | undefined,
  ctx?: NormalizeContext,
  standardProps?: Readonly<Record<string, unknown>> | null,
): WireNode {
  // Windows reset scope; otherwise children are scoped under this node.
  const childScope = node.type === "window" ? "" : scopedId;

  const children = node.children.map((child) => normalizeNode(child, childScope, windowId, ctx));

  // Auto-apply standard widget options (a11y, event_rate) from the
  // original widget placeholder to the top-level rendered node. Widget
  // authors do not need to manually forward these.
  let props = resolveA11yRefs(node.props, parentScope);
  if (standardProps && Object.keys(standardProps).length > 0) {
    props = { ...props, ...standardProps };
  }

  return {
    id: scopedId,
    type: node.type,
    props,
    children,
  };
}

/** Resolve a11y ID references (labelled_by, described_by, error_message) relative to scope. */
function resolveA11yRefs(props: Record<string, unknown>, scope: string): Record<string, unknown> {
  if (!props["a11y"] || scope === "") return props;

  const a11y = { ...(props["a11y"] as Record<string, unknown>) };
  let changed = false;
  for (const refField of ["labelled_by", "described_by", "error_message"]) {
    const val = a11y[refField];
    if (typeof val === "string" && !val.includes("/")) {
      a11y[refField] = `${scope}/${val}`;
      changed = true;
    }
  }
  return changed ? { ...props, a11y } : props;
}
