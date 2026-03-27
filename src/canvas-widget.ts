/**
 * Canvas widget extension system.
 *
 * Canvas widgets are pure TypeScript widgets that render via canvas shapes,
 * manage internal state (hover, focus, animation), and transform raw
 * canvas events into semantic widget events via `handleEvent`.
 *
 * ## Defining a canvas widget
 *
 * ```ts
 * import { type CanvasWidgetDef, buildCanvasWidget } from 'plushie'
 *
 * interface StarState { hover: string | null }
 * interface StarProps { rating: number; max: number }
 *
 * const starRating: CanvasWidgetDef<StarState, StarProps> = {
 *   init: () => ({ hover: null }),
 *   render: (id, props, state) => canvas(id, {}, []),
 *   handleEvent: (event, state) => [{ type: 'ignored' }, state],
 * }
 *
 * // In your view:
 * buildCanvasWidget(starRating, 'stars', { rating: 3, max: 5 })
 * ```
 *
 * ## How it works
 *
 * `buildCanvasWidget` creates a placeholder canvas node tagged with metadata.
 * During tree normalization, the runtime detects the tag, looks up the
 * widget's state from the registry, calls `render`, and recursively
 * normalizes the output. The normalized tree carries metadata for
 * registry derivation after each render cycle.
 *
 * Events flow through the scope chain before reaching `update`.
 * Each canvas widget in the chain gets a chance to handle the event:
 * `ignored` passes through, `consumed` stops the chain, and
 * `emit` replaces the event with a WidgetEvent and continues.
 * The runtime fills in `id`, `scope`, and `windowId` automatically from the
 * widget's position in the tree.
 *
 * @module
 */

import type { Event, Subscription, UINode, WidgetEvent } from "./types.js";

// -- Canvas widget definition ------------------------------------------------

/**
 * Result of a canvas widget's event handler.
 *
 * - `ignored` -- not handled, continue to next handler in scope chain
 * - `consumed` -- captured, suppress event
 * - `update_state` -- captured, internal state change only (triggers re-render)
 * - `emit` -- captured with semantic event; runtime fills in id/scope/windowId
 */
export type EventAction =
  | { readonly type: "ignored" }
  | { readonly type: "consumed" }
  | { readonly type: "update_state" }
  | { readonly type: "emit"; readonly kind: string; readonly data: unknown };

/**
 * Definition of a canvas widget's behaviour.
 *
 * `State` is the widget's internal state (managed by the runtime).
 * `Props` is the widget's input from the parent view function.
 */
export interface CanvasWidgetDef<State, Props> {
  /** Create the initial state for a new widget instance. */
  readonly init: () => State;

  /** Render the widget to a UINode tree. */
  readonly render: (id: string, props: Props, state: State) => UINode;

  /** Handle an event. Returns the action and (possibly updated) state. */
  readonly handleEvent: (event: Event, state: State) => readonly [EventAction, State];

  /** Subscriptions for this widget instance (optional). */
  readonly subscriptions?: ((props: Props, state: State) => Subscription[]) | undefined;
}

// -- Metadata keys -----------------------------------------------------------

/** Metadata key marking a node as a canvas widget placeholder. */
const META_KEY = "__canvas_widget__";

/** Metadata key carrying the widget's encoded props. */
const PROPS_KEY = "__canvas_widget_props__";

/** Metadata key carrying the widget's state (post-normalization). */
const STATE_KEY = "__canvas_widget_state__";

// -- Placeholder node --------------------------------------------------------

/**
 * Build a placeholder node for a canvas widget.
 *
 * The returned node has type "canvas" and carries metadata that
 * the runtime uses during normalization to render the real canvas
 * tree with the widget's current state.
 */
export function buildCanvasWidget<State, Props>(
  def: CanvasWidgetDef<State, Props>,
  id: string,
  props: Props,
): UINode {
  return Object.freeze({
    id,
    type: "canvas",
    props: Object.freeze({}),
    children: Object.freeze([]) as readonly UINode[],
    meta: Object.freeze({
      [META_KEY]: def,
      [PROPS_KEY]: props,
    }),
  });
}

// -- Registry ----------------------------------------------------------------

/**
 * A registry entry for a canvas widget instance. Stores type-erased
 * state and pre-bound closures so the registry can be heterogeneous.
 */
export interface RegistryEntry {
  /** Render the widget given its scoped ID. Returns a UINode tree. */
  readonly render: (id: string) => UINode;
  /** Handle an event. Returns the action and an updated entry. */
  readonly handleEvent: (event: Event) => readonly [EventAction, RegistryEntry];
  /** Collect subscriptions for this widget instance. */
  readonly subscriptions: () => Subscription[];
  /** The widget's current state (type-erased). */
  readonly state: unknown;
  /** The widget's current props (type-erased). */
  readonly props: unknown;
  /** The widget definition (type-erased). */
  readonly def: unknown;
}

/** The canvas widget registry: maps window-local widget keys to entries. */
export type Registry = ReadonlyMap<string, RegistryEntry>;

function widgetKey(windowId: string, widgetId: string): string {
  return `${windowId}\u0000${widgetId}`;
}

function splitWidgetKey(key: string): { readonly windowId: string; readonly widgetId: string } {
  const separator = key.indexOf("\u0000");
  if (separator === -1) {
    return { windowId: "", widgetId: key };
  }

  return {
    windowId: key.slice(0, separator),
    widgetId: key.slice(separator + 1),
  };
}

function requiredWindowId(event: Event, fallbackKey?: string): string {
  const windowId = extractWindowId(event, fallbackKey);
  if (windowId === null) {
    throw new Error("Canvas widget events must include windowId.");
  }
  return windowId;
}

/**
 * Create a registry entry from a typed def, props, and state.
 * The entry captures the concrete types in closures.
 */
export function makeEntry<State, Props>(
  def: CanvasWidgetDef<State, Props>,
  props: Props,
  state: State,
): RegistryEntry {
  return {
    render: (id: string) => def.render(id, props, state),
    handleEvent: (ev: Event) => {
      const [action, newState] = def.handleEvent(ev, state);
      return [action, makeEntry(def, props, newState)];
    },
    subscriptions: () => (def.subscriptions ? def.subscriptions(props, state) : []),
    state,
    props,
    def,
  };
}

// -- Normalization support ---------------------------------------------------

/**
 * Check if a node is a canvas widget placeholder (has canvas widget metadata).
 */
export function isPlaceholder(node: UINode): boolean {
  return node.meta !== undefined && META_KEY in node.meta;
}

/**
 * Render a canvas widget placeholder using the registry.
 *
 * Returns the rendered UINode and an updated registry entry,
 * or null if the node isn't a placeholder.
 */
export function renderPlaceholder(
  node: UINode,
  windowId: string | undefined,
  scopedId: string,
  localId: string,
  registry: Registry,
): { readonly key: string; readonly node: UINode; readonly entry: RegistryEntry } | null {
  if (!node.meta || !(META_KEY in node.meta) || !(PROPS_KEY in node.meta)) {
    return null;
  }

  if (!windowId) {
    throw new Error(`Canvas widget "${localId}" must be rendered inside a window node.`);
  }

  const def = node.meta[META_KEY] as CanvasWidgetDef<unknown, unknown>;
  const props = node.meta[PROPS_KEY] as unknown;
  const key = widgetKey(windowId, scopedId);

  // Look up existing state or create initial
  const existing = registry.get(key);
  let entry: RegistryEntry;

  if (existing) {
    // Update entry with fresh def and props, keep existing state
    entry = makeEntry(def, props, existing.state);
  } else {
    // New widget: create entry with initial state
    const state = def.init();
    entry = makeEntry(def, props, state);
  }

  // Render with the local (pre-scoped) ID
  const rendered = entry.render(localId);

  // Attach metadata to the rendered node for registry derivation
  const widgetMeta = Object.freeze({
    [META_KEY]: def,
    [PROPS_KEY]: props,
    [STATE_KEY]: entry.state,
  });

  const finalNode: UINode = Object.freeze({
    ...rendered,
    id: scopedId,
    meta: widgetMeta,
  });

  return { key, node: finalNode, entry };
}

// -- Registry derivation -----------------------------------------------------

/**
 * Derive the registry from a normalized tree.
 *
 * Walks the tree and extracts canvas widget metadata from nodes.
 * Returns a fresh registry with entries for all canvas widgets
 * found in the tree.
 */
export function deriveRegistry(tree: UINode | null): Map<string, RegistryEntry> {
  const registry = new Map<string, RegistryEntry>();
  if (tree === null) return registry;
  collectEntries(tree, registry, undefined);
  return registry;
}

function collectEntries(
  node: UINode,
  acc: Map<string, RegistryEntry>,
  windowId: string | undefined,
): void {
  const currentWindowId = node.type === "window" ? node.id : windowId;

  if (node.meta && META_KEY in node.meta && PROPS_KEY in node.meta && STATE_KEY in node.meta) {
    if (!currentWindowId) {
      throw new Error(`Canvas widget "${node.id}" must be rendered inside a window node.`);
    }

    const def = node.meta[META_KEY] as CanvasWidgetDef<unknown, unknown>;
    const props = node.meta[PROPS_KEY] as unknown;
    const state = node.meta[STATE_KEY] as unknown;
    acc.set(widgetKey(currentWindowId, node.id), makeEntry(def, props, state));
  }

  for (const child of node.children) {
    collectEntries(child, acc, currentWindowId);
  }
}

// -- Event dispatch ----------------------------------------------------------

/**
 * Extract the scope from an event. Returns empty array for events
 * without scope (system events, timer events, etc.).
 */
function extractScope(event: Event): readonly string[] {
  const ev = event as unknown as Record<string, unknown>;
  if ("scope" in event && Array.isArray(ev["scope"])) {
    return ev["scope"] as readonly string[];
  }
  return [];
}

/** Extract the local widget ID from an event. */
function extractId(event: Event): string {
  const ev = event as unknown as Record<string, unknown>;
  if ("id" in event && typeof ev["id"] === "string") {
    return ev["id"];
  }
  return "";
}

/**
 * Reconstruct a full scoped ID from a reversed scope list and a local ID.
 *
 * scopeToId(["form"], "submit") => "form/submit"
 * scopeToId([], "picker") => "picker"
 * scopeToId(["inner", "outer"], "btn") => "outer/inner/btn"
 */
function scopeToId(scope: readonly string[], id: string): string {
  if (scope.length === 0) return id;
  return [...scope].reverse().join("/") + "/" + id;
}

/**
 * Convert a reversed scope list to forward-order scoped IDs,
 * from innermost to outermost.
 *
 * scope = ["child", "parent"] produces ["parent/child", "parent"]
 */
function scopeToWidgetIds(scope: readonly string[]): string[] {
  const forward = [...scope].reverse();
  const ids: string[] = [];
  for (let n = forward.length; n >= 1; n--) {
    ids.push(forward.slice(0, n).join("/"));
  }
  return ids;
}

/**
 * Build the handler chain from scope (innermost to outermost).
 * Returns an array of scoped widget IDs present in the registry.
 */
function buildHandlerChain(
  registry: ReadonlyMap<string, RegistryEntry>,
  windowId: string | null,
  scope: readonly string[],
  eventId: string,
): string[] {
  if (!windowId) {
    return [];
  }

  let chain = scopeToWidgetIds(scope)
    .map((id) => widgetKey(windowId, id))
    .filter((key) => registry.has(key));

  if (chain.length === 0) {
    // No parent canvas_widgets in scope. Check if the event's target
    // itself is a canvas_widget.
    const targetId = widgetKey(windowId, scopeToId(scope, eventId));
    if (registry.has(targetId)) {
      chain = [targetId];
    }
  }

  return chain;
}

/**
 * Resolve the id and scope for an emitted event from the
 * interception context.
 *
 * For widget events with scope: the innermost scope element is the
 * canvas widget's local ID; remaining elements are the parent scope.
 * For non-widget events (timers): split the registered widget_id
 * on "/" to derive id/scope.
 */
function resolveEmitIdentity(
  event: Event,
  widgetKeyValue: string,
): { readonly id: string; readonly scope: readonly string[]; readonly windowId: string } {
  const scope = extractScope(event);
  if (scope.length > 0) {
    return {
      id: scope[0]!,
      scope: scope.slice(1),
      windowId: requiredWindowId(event, widgetKeyValue),
    };
  }

  const id = extractId(event);
  if (id !== "") {
    return { id, scope: [], windowId: requiredWindowId(event, widgetKeyValue) };
  }

  // Timer or other non-widget event -- split the registered widget ID.
  const { widgetId, windowId } = splitWidgetKey(widgetKeyValue);
  return { ...splitWidgetId(widgetId), windowId };
}

/**
 * Split a scoped widget ID ("form/stars") into local ID and
 * reversed scope: { id: "stars", scope: ["form"] }.
 */
function splitWidgetId(widgetId: string): {
  readonly id: string;
  readonly scope: readonly string[];
} {
  const parts = widgetId.split("/");
  if (parts.length <= 1) {
    return { id: widgetId, scope: [] };
  }
  const local = parts[parts.length - 1]!;
  const parentParts = parts.slice(0, -1).reverse();
  return { id: local, scope: parentParts };
}

/**
 * Normalize emitted data: maps pass through, bare values get wrapped
 * in { value: ... }.
 */
function normalizeEmitData(data: unknown): Readonly<Record<string, unknown>> {
  if (data !== null && typeof data === "object" && !Array.isArray(data)) {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
      result[String(k)] = v;
    }
    return Object.freeze(result);
  }
  return Object.freeze({ value: data });
}

/**
 * Route an event through canvas widget handlers in the scope chain.
 *
 * Returns `{ event, registry }` where event is null if consumed,
 * or the (possibly transformed) event if it should reach `update`.
 */
export function dispatchThroughWidgets(
  registry: Map<string, RegistryEntry>,
  event: Event,
): { readonly event: Event | null; readonly registry: Map<string, RegistryEntry> } {
  const scope = extractScope(event);
  const eventId = extractId(event);
  const windowId = extractWindowId(event);

  const chain = buildHandlerChain(registry, windowId, scope, eventId);

  if (chain.length === 0) {
    return { event, registry };
  }

  return walkChain(registry, event, chain);
}

/**
 * Walk the handler chain, dispatching the event to each widget.
 * Errors in handlers are caught, logged, and treated as ignored.
 */
function walkChain(
  registry: Map<string, RegistryEntry>,
  event: Event,
  chain: string[],
): { readonly event: Event | null; readonly registry: Map<string, RegistryEntry> } {
  let currentEvent: Event | null = event;

  for (const widgetId of chain) {
    if (currentEvent === null) break;

    const entry = registry.get(widgetId);
    if (!entry) continue;

    let action: EventAction;
    let newEntry: RegistryEntry;

    try {
      [action, newEntry] = entry.handleEvent(currentEvent);
    } catch (err) {
      console.warn(
        `[plushie] canvas_widget "${widgetId}" raised in handleEvent, treating as ignored:`,
        err,
      );
      continue;
    }

    registry.set(widgetId, newEntry);

    switch (action.type) {
      case "ignored":
        // Continue with the same event
        break;

      case "consumed":
      case "update_state":
        // Captured, no output
        currentEvent = null;
        break;

      case "emit": {
        // Captured with output -- replace event and continue
        const identity = resolveEmitIdentity(currentEvent, widgetId);
        const emitted: WidgetEvent = {
          kind: "widget",
          type: action.kind,
          id: identity.id,
          windowId: identity.windowId,
          scope: identity.scope,
          value: null,
          data: normalizeEmitData(action.data),
        };
        currentEvent = emitted;
        break;
      }
    }
  }

  return { event: currentEvent, registry };
}

// -- Widget-scoped subscriptions ---------------------------------------------

/** Namespace prefix for canvas widget subscription tags. */
const CW_TAG_PREFIX = "__cw:";

/**
 * Collect subscriptions from all canvas widgets in the registry.
 *
 * Each subscription's tag is namespaced with the window-local widget key
 * so the runtime can route timer events back to the correct widget.
 */
export function collectSubscriptions(registry: ReadonlyMap<string, RegistryEntry>): Subscription[] {
  const result: Subscription[] = [];
  for (const [widgetId, entry] of registry) {
    const subs = entry.subscriptions();
    for (const sub of subs) {
      result.push(namespaceTag(sub, widgetId));
    }
  }
  return result;
}

/** Namespace a subscription's tag for a canvas widget. */
function namespaceTag(sub: Subscription, widgetId: string): Subscription {
  const key = JSON.stringify({ key: widgetId, tag: sub.tag });
  return { ...sub, tag: CW_TAG_PREFIX + key };
}

/** Check if a subscription tag is namespaced for a canvas widget. */
export function isWidgetTag(tag: string): boolean {
  return tag.startsWith(CW_TAG_PREFIX);
}

/**
 * Parse a namespaced tag into { widgetId, innerTag }.
 * Returns null if the tag isn't namespaced.
 */
export function parseWidgetTag(
  tag: string,
): { readonly widgetId: string; readonly innerTag: string } | null {
  if (!tag.startsWith(CW_TAG_PREFIX)) return null;
  const rest = tag.slice(CW_TAG_PREFIX.length);
  let parsed: { key?: unknown; tag?: unknown };

  try {
    parsed = JSON.parse(rest) as { key?: unknown; tag?: unknown };
  } catch {
    return null;
  }

  if (typeof parsed.key !== "string" || typeof parsed.tag !== "string") {
    return null;
  }
  return {
    widgetId: parsed.key,
    innerTag: parsed.tag,
  };
}

/**
 * Route a timer event to the correct canvas widget.
 *
 * If the timer tag is namespaced, look up the widget, create a
 * TimerEvent with the inner tag, dispatch through the widget's
 * handler, and return the result. Emitted events are dispatched
 * through the scope chain so parent canvas widgets can intercept.
 *
 * Returns `{ event, registry }` where event is null if handled
 * internally, or the emitted event if it should reach `update`.
 * For non-widget timers, returns `null`.
 */
export function handleWidgetTimer(
  registry: Map<string, RegistryEntry>,
  tag: string,
  timestamp: number,
): { readonly event: Event | null; readonly registry: Map<string, RegistryEntry> } | null {
  const parsed = parseWidgetTag(tag);
  if (parsed === null) return null;

  const entry = registry.get(parsed.widgetId);
  if (!entry) return null;

  const timerEvent: Event = {
    kind: "timer",
    tag: parsed.innerTag,
    timestamp,
  };

  let action: EventAction;
  let newEntry: RegistryEntry;

  try {
    [action, newEntry] = entry.handleEvent(timerEvent);
  } catch (err) {
    console.warn(
      `[plushie] canvas_widget "${parsed.widgetId}" raised in timer handler, ignoring:`,
      err,
    );
    return { event: null, registry };
  }

  registry.set(parsed.widgetId, newEntry);

  switch (action.type) {
    case "ignored":
    case "consumed":
    case "update_state":
      return { event: null, registry };

    case "emit": {
      const identity = resolveEmitIdentity(timerEvent, parsed.widgetId);
      const emitted: WidgetEvent = {
        kind: "widget",
        type: action.kind,
        id: identity.id,
        windowId: identity.windowId,
        scope: identity.scope,
        value: null,
        data: normalizeEmitData(action.data),
      };
      // Dispatch through the scope chain so parent canvas widgets can intercept
      return dispatchThroughWidgets(registry, emitted);
    }
  }
}

function extractWindowId(event: Event, fallbackKey?: string): string | null {
  const ev = event as unknown as Record<string, unknown>;
  if (typeof ev["windowId"] === "string") {
    return ev["windowId"] as string;
  }

  if (fallbackKey) {
    return splitWidgetKey(fallbackKey).windowId;
  }

  return null;
}
