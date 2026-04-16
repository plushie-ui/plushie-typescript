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
 * and window nodes (type "window") never create scopes; children
 * inherit the parent's scope unchanged.
 *
 * @module
 */

import type { UINode } from "../types.js";
import {
  getStandardProps,
  isPlaceholder,
  makeEntry,
  type Registry,
  type RegistryEntry,
  renderPlaceholder,
  type WidgetDef,
} from "../widget-handler.js";

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
 * A cached memo subtree: the normalized tree and the registry entries
 * accumulated during that subtree's normalization.
 */
export interface MemoCacheEntry {
  readonly deps: unknown;
  readonly tree: WireNode;
  readonly entries: ReadonlyMap<string, RegistryEntry>;
}

/**
 * A cached widget view: the normalized tree, registry entries, and the
 * key returned by the widget's cacheKey function.
 */
export interface WidgetViewCacheEntry {
  readonly key: unknown;
  readonly tree: WireNode;
  readonly entries: ReadonlyMap<string, RegistryEntry>;
}

/** Memo cache: maps memo site keys to cached subtrees. */
export type MemoCache = ReadonlyMap<string, MemoCacheEntry>;

/** Widget view cache: maps widget keys to cached views. */
export type WidgetViewCache = ReadonlyMap<string, WidgetViewCacheEntry>;

/**
 * Check whether an ID is auto-generated (unstable, doesn't create scope).
 */
export function isAutoId(id: string): boolean {
  return id.startsWith("auto:");
}

const VALID_ID_RE = /^[\x21-\x7e]+$/;

function validateUserId(id: string): void {
  if (id === "") {
    throw new Error("widget ID must not be empty");
  }
  if (id.includes("/")) {
    throw new Error(
      `Widget ID "${id}" contains "/" which is reserved for scoped IDs. ` +
        `Use a different character or let the framework handle scoping.`,
    );
  }
  if (id.includes("#")) {
    throw new Error(`Widget ID "${id}" contains "#" which is reserved for window-qualified IDs.`);
  }
  const byteLength = new TextEncoder().encode(id).length;
  if (byteLength > 1024) {
    throw new Error(`Widget ID "${id}" exceeds maximum length of 1024 bytes`);
  }
  if (!VALID_ID_RE.test(id)) {
    throw new Error(
      `Widget ID "${id}" contains invalid characters. ` +
        `IDs must contain only printable ASCII (0x21-0x7E).`,
    );
  }
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
 * Context passed through normalization to support widget expansion.
 * When a registry is provided, widget placeholders are expanded
 * inline during normalization.
 */
export interface NormalizeContext {
  /** Existing widget registry for state continuity. */
  readonly registry?: Registry | undefined;
  /** Accumulator for new registry entries discovered during expansion. */
  readonly newEntries?: Map<string, RegistryEntry> | undefined;
  /** Previous render's memo cache for cache hit detection. */
  readonly memoPrev?: MemoCache | undefined;
  /** New memo cache being built during this normalization pass. */
  readonly memo?: Map<string, MemoCacheEntry> | undefined;
  /** Previous render's widget view cache for cache_key hit detection. */
  readonly widgetViewPrev?: WidgetViewCache | undefined;
  /** New widget view cache being built during this normalization pass. */
  readonly widgetView?: Map<string, WidgetViewCacheEntry> | undefined;
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
const MAX_TREE_DEPTH = 256;
const WARN_TREE_DEPTH = 200;

function normalizeNode(
  node: UINode,
  scope: string,
  windowId: string | undefined,
  ctx?: NormalizeContext,
  depth = 0,
): WireNode {
  if (depth >= MAX_TREE_DEPTH) {
    throw new Error(
      `Tree exceeds maximum depth of ${String(MAX_TREE_DEPTH)}. ` +
        `Check for circular widget compositions or deeply nested structures.`,
    );
  }
  if (depth === WARN_TREE_DEPTH) {
    console.warn(
      `[plushie] Tree depth reached ${String(WARN_TREE_DEPTH)}. ` +
        `Very deep nesting may indicate circular widget compositions.`,
    );
  }

  const id = node.id;
  const type = node.type;
  const currentWindowId = type === "window" ? id : windowId;

  // Memo cache: skip re-normalization when deps match
  if (type === "__memo__") {
    return normalizeMemoNode(node, scope, windowId, ctx, depth);
  }

  // Validate user-provided IDs
  if (!isAutoId(id)) {
    validateUserId(id);
  }

  // Apply scope prefix to this node's ID
  const scopedId = scope !== "" && !isAutoId(id) ? `${scope}/${id}` : id;

  // Widget placeholder expansion: if this node is a widget placeholder
  // and we have a registry context, render the placeholder and normalize
  // the rendered output in place.
  if (ctx?.registry && isPlaceholder(node)) {
    const standardProps = getStandardProps(node);

    const result = renderPlaceholder(node, currentWindowId, scopedId, id, ctx.registry);
    if (result) {
      // Record the new entry for registry derivation
      if (ctx.newEntries) {
        ctx.newEntries.set(result.key, result.entry);
      }

      // Check widget view cache before normalizing (after recording entry so
      // the widget's own entry is in the delta snapshot)
      const cached = tryWidgetViewCache(node, currentWindowId, scopedId, ctx);
      if (cached) {
        return cached;
      }

      // Snapshot entries after widget's own entry, before child normalization
      const entriesBefore = ctx.newEntries
        ? new Map(ctx.newEntries)
        : new Map<string, RegistryEntry>();

      const normalized = normalizeRenderedWidget(
        result.node,
        scopedId,
        scope,
        currentWindowId,
        ctx,
        standardProps,
        depth,
      );

      // Store in widget view cache if the def has a cacheKey
      storeWidgetViewCache(node, currentWindowId, scopedId, ctx, entriesBefore, normalized);

      return normalized;
    }
  }

  // Determine the scope for children:
  // Named (non-auto) non-window nodes propagate their scoped ID as the child scope.
  // Auto-ID nodes and window nodes don't create scope boundaries.
  const childScope = isAutoId(id) || type === "window" ? scope : scopedId;

  // Validate child count for widgets with strict child requirements
  validateChildCount(id, type, node.children.length);

  // Normalize children recursively
  const children = node.children.map((child) =>
    normalizeNode(child, childScope, currentWindowId, ctx, depth + 1),
  );

  // Reject duplicate sibling IDs; they cause undefined behavior in
  // widget caching, event routing, and tree diffing.
  if (children.length > 1) {
    const ids = new Set<string>();
    for (const child of children) {
      if (ids.has(child.id)) {
        const hint = child.id.startsWith("auto:")
          ? " Provide explicit IDs for items in dynamic lists."
          : " Each sibling must have a unique ID.";
        throw new Error(`Duplicate sibling ID "${child.id}" under parent "${scopedId}".${hint}`);
      }
      ids.add(child.id);
    }
  }

  // Infer position_in_set/size_of_set for radio widgets sharing a group
  inferRadioA11y(children);

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
 * Normalize a rendered widget node. The node's ID is already the
 * scoped ID. Children are normalized with the scoped ID as their
 * scope prefix.
 */
function normalizeRenderedWidget(
  node: UINode,
  scopedId: string,
  parentScope: string,
  windowId: string | undefined,
  ctx?: NormalizeContext,
  standardProps?: Readonly<Record<string, unknown>> | null,
  depth = 0,
): WireNode {
  // Windows reset scope; otherwise children are scoped under this node.
  const childScope = node.type === "window" ? "" : scopedId;

  const children = node.children.map((child) =>
    normalizeNode(child, childScope, windowId, ctx, depth + 1),
  );

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

// Widget types that accept at most one child.
const SINGLE_CHILD_TYPES = new Set([
  "container",
  "tooltip",
  "pointer_area",
  "scrollable",
  "themer",
  "floating",
  "responsive",
  "pin",
  "sensor",
  "window",
]);

/**
 * Validate child count for widgets with strict requirements.
 * Overlay requires exactly 2 children. Single-child wrappers
 * (container, tooltip, scrollable, etc.) accept at most 1.
 */
function validateChildCount(id: string, type: string, count: number): void {
  if (type === "overlay") {
    if (count !== 2) {
      throw new Error(`overlay "${id}" requires exactly 2 children, got ${count}`);
    }
  } else if (SINGLE_CHILD_TYPES.has(type) && count > 1) {
    throw new Error(`${type} "${id}" accepts at most 1 child, got ${count}`);
  }
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

// -- Memo cache handling -------------------------------------------------------

function normalizeMemoNode(
  node: UINode,
  scope: string,
  windowId: string | undefined,
  ctx: NormalizeContext | undefined,
  depth: number,
): WireNode {
  const meta = node.meta as Record<string, unknown>;
  const deps = meta["__memo_deps__"];
  const body = meta["__memo_fun__"] as () => UINode | readonly UINode[] | null;
  const nodeId = node.id;

  const cacheKey = `${nodeId}\0${scope}\0${windowId ?? ""}`;
  const prev = ctx?.memoPrev?.get(cacheKey);

  if (prev && depsEqual(prev.deps, deps)) {
    if (ctx?.memo && ctx?.newEntries) {
      for (const [key, entry] of prev.entries) {
        const current = ctx.registry?.get(key);
        const refreshed = current
          ? makeEntry(current.def as WidgetDef<unknown, unknown>, current.props, current.state)
          : entry;
        ctx.newEntries.set(key, refreshed);
      }
      ctx.memo.set(cacheKey, prev);
    }
    return prev.tree;
  }

  const entriesBefore = ctx?.newEntries
    ? new Map(ctx.newEntries)
    : new Map<string, RegistryEntry>();

  const result = body();
  const tree = normalizeMemoBody(result, nodeId, scope, windowId, ctx, depth);

  const deltaEntries = new Map<string, RegistryEntry>();
  if (ctx?.newEntries) {
    for (const [key, value] of ctx.newEntries) {
      if (!entriesBefore.has(key)) {
        deltaEntries.set(key, value);
      }
    }
  }

  const entry: MemoCacheEntry = { deps, tree, entries: deltaEntries };
  ctx?.memo?.set(cacheKey, entry);

  return tree;
}

function normalizeMemoBody(
  result: UINode | readonly UINode[] | null,
  memoNodeId: string,
  scope: string,
  windowId: string | undefined,
  ctx: NormalizeContext | undefined,
  depth: number,
): WireNode {
  if (result === null) {
    return { id: `${memoNodeId}_nil`, type: "container", props: {}, children: [] };
  }

  if (Array.isArray(result)) {
    const children = result
      .filter((child): child is UINode => child !== null && child !== undefined)
      .map((child) => normalizeNode(child, scope, windowId, ctx, depth + 1));

    if (children.length === 1) {
      return children[0]!;
    }
    return { id: `${memoNodeId}_wrap`, type: "container", props: {}, children };
  }

  return normalizeNode(result as UINode, scope, windowId, ctx, depth);
}

function depsEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!depsEqual(a[i], b[i])) return false;
    }
    return true;
  }

  if (typeof a === "object" && typeof b === "object") {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj);
    const bKeys = Object.keys(bObj);
    if (aKeys.length !== bKeys.length) return false;
    for (const key of aKeys) {
      if (!depsEqual(aObj[key], bObj[key])) return false;
    }
    return true;
  }

  return false;
}

// -- Widget view cache handling ------------------------------------------------

function widgetRegKey(windowId: string | undefined, scopedId: string): string {
  return `${windowId ?? ""}\0${scopedId}`;
}

function getDefFromPlaceholder(node: UINode): WidgetDef<unknown, unknown> | null {
  if (!node.meta || !("__widget_handler__" in node.meta)) return null;
  return node.meta["__widget_handler__"] as WidgetDef<unknown, unknown>;
}

function tryWidgetViewCache(
  node: UINode,
  windowId: string | undefined,
  scopedId: string,
  ctx: NormalizeContext,
): WireNode | null {
  const def = getDefFromPlaceholder(node);
  if (!def || !def.cacheKey) return null;

  const ck = widgetRegKey(windowId, scopedId);
  const prev = ctx.widgetViewPrev?.get(ck);
  if (!prev) return null;

  const current = ctx.registry?.get(ck);
  const currentProps = node.meta?.["__widget_handler_props__"];
  const newKey = def.cacheKey(currentProps, current?.state);
  if (!depsEqual(prev.key, newKey)) return null;

  if (ctx.newEntries && ctx.widgetView) {
    for (const [key, entry] of prev.entries) {
      const reg = ctx.registry?.get(key);
      const refreshed = reg
        ? makeEntry(reg.def as WidgetDef<unknown, unknown>, reg.props, reg.state)
        : entry;
      ctx.newEntries.set(key, refreshed);
    }
    ctx.widgetView.set(ck, prev);
  }

  return prev.tree;
}

function storeWidgetViewCache(
  node: UINode,
  windowId: string | undefined,
  scopedId: string,
  ctx: NormalizeContext,
  entriesBefore: Map<string, RegistryEntry>,
  normalized: WireNode,
): void {
  const def = getDefFromPlaceholder(node);
  if (!def || !def.cacheKey) return;

  const ck = widgetRegKey(windowId, scopedId);
  const current = ctx.newEntries?.get(ck);
  const currentProps = node.meta?.["__widget_handler_props__"];
  const key = def.cacheKey(currentProps, current?.state);

  const deltaEntries = new Map<string, RegistryEntry>();
  if (ctx.newEntries) {
    for (const [k, v] of ctx.newEntries) {
      if (!entriesBefore.has(k)) {
        deltaEntries.set(k, v);
      }
    }
  }

  ctx.widgetView?.set(ck, { key, tree: normalized, entries: deltaEntries });
}

/**
 * Scan normalized children for radio widgets sharing a `group` prop
 * and inject `position_in_set` / `size_of_set` into their a11y props.
 * Respects manual overrides: if `position_in_set` is already set, only
 * `size_of_set` is filled from the group total.
 */
function inferRadioA11y(children: WireNode[]): void {
  if (children.length < 2) return;

  const groups = new Map<string, Array<{ idx: number; node: WireNode }>>();
  for (let i = 0; i < children.length; i++) {
    const child = children[i]!;
    if (child.type !== "radio") continue;
    const group = child.props["group"];
    if (typeof group !== "string") continue;
    let members = groups.get(group);
    if (!members) {
      members = [];
      groups.set(group, members);
    }
    members.push({ idx: i, node: child });
  }

  for (const members of groups.values()) {
    const size = members.length;
    for (let pos = 0; pos < members.length; pos++) {
      const { idx, node } = members[pos]!;
      const a11y = (node.props["a11y"] ?? {}) as Record<string, unknown>;
      const hasPosition = a11y["position_in_set"] !== undefined;
      const hasSize = a11y["size_of_set"] !== undefined;
      if (hasPosition && hasSize) continue;

      const patched = { ...a11y };
      if (!hasPosition) patched["position_in_set"] = pos + 1;
      if (!hasSize) patched["size_of_set"] = size;
      (children[idx] as { props: Record<string, unknown> }).props = {
        ...node.props,
        a11y: patched,
      };
    }
  }
}
