/**
 * Widget builder utilities.
 *
 * Provides helpers for creating UINodes with typed props, optional
 * fields (nil-omission), and handler registration.
 *
 * @module
 */

import { ANIMATION_DESCRIPTOR } from "../animation/transition.js";
import { autoId } from "../tree/node.js";
import type { Handler, UINode } from "../types.js";
import { type HandlerMeta, registerHandler, withHandlersMeta } from "./handlers.js";
import type { A11y } from "./types.js";

/**
 * Animation descriptor type. Any value with the ANIMATION_DESCRIPTOR symbol.
 * This includes Transition, Spring, and Sequence descriptors.
 */
export type AnimationDescriptor = Readonly<Record<string, unknown>> & {
  readonly [ANIMATION_DESCRIPTOR]: true;
};

/**
 * Props for renderer-side animations. Any widget can extend this
 * interface to accept animation descriptors.
 *
 * @example
 * ```tsx
 * <Container id="panel"
 *   animate={{ max_width: transition({to: 300, duration: 200}) }}
 *   exit={{ opacity: transition({to: 0, duration: 150}) }}
 * />
 * ```
 */
export interface AnimationProps {
  /**
   * Animation descriptors keyed by the wire prop name they animate.
   * Values are Transition, Spring, or Sequence descriptors that the
   * renderer interpolates with zero wire traffic during animation.
   */
  readonly animate?: Readonly<Record<string, unknown>>;
  /**
   * Exit animation descriptors. Applied when the widget is removed
   * from the tree. Same format as `animate`.
   */
  readonly exit?: Readonly<Record<string, unknown>>;
}

/**
 * Check if a value is an animation descriptor.
 */
export function isAnimationDescriptor(value: unknown): value is AnimationDescriptor {
  return (
    typeof value === "object" &&
    value !== null &&
    ANIMATION_DESCRIPTOR in (value as Record<symbol, unknown>)
  );
}

/**
 * Merge animation props onto a wire props record.
 * Extracts `animate` and `exit` from the source object and merges
 * their contents onto the props. Returns the same props record
 * (mutated in place for efficiency, since it's pre-freeze).
 */
export function mergeAnimationProps(
  props: Record<string, unknown>,
  source: { animate?: Readonly<Record<string, unknown>>; exit?: Readonly<Record<string, unknown>> },
): Record<string, unknown> {
  if (source.animate) {
    for (const [key, value] of Object.entries(source.animate)) {
      props[key] = value;
    }
  }
  if (source.exit) {
    props["exit"] = source.exit;
  }
  return props;
}

/**
 * Add a prop to the accumulator only if the value is not undefined.
 * This mirrors the Elixir `put_if/3` pattern; undefined props are
 * omitted from the wire message entirely.
 */
export function putIf(
  props: Record<string, unknown>,
  value: unknown,
  key: string,
  encode?: (v: never) => unknown,
): Record<string, unknown> {
  if (value !== undefined) {
    props[key] = encode ? encode(value as never) : value;
  }
  return props;
}

/**
 * Apply default a11y values to the wire props record.
 * Merges defaults under the `a11y` key, preserving any
 * user-provided a11y fields. User-provided `role` overrides
 * the default.
 */
export function applyA11yDefaults(
  props: Record<string, unknown>,
  userA11y: A11y | undefined,
  defaults: Partial<A11y>,
  encode: (v: A11y) => unknown,
): void {
  const merged: A11y = { ...defaults, ...userA11y };
  props["a11y"] = encode(merged);
}

/**
 * Build a leaf UINode (no children).
 *
 * @param id - Widget ID.
 * @param type - Wire type string (e.g., "button", "text").
 * @param props - Wire-ready props (already encoded).
 * @returns Frozen UINode.
 */
export function leafNode(id: string, type: string, props: Record<string, unknown>): UINode {
  return leafNodeWithMeta(id, type, props);
}

export function leafNodeWithMeta(
  id: string,
  type: string,
  props: Record<string, unknown>,
  meta?: Readonly<Record<string, unknown>>,
): UINode {
  return Object.freeze({
    id,
    type,
    props: Object.freeze(props),
    children: Object.freeze([]) as readonly UINode[],
    ...(meta ? { meta } : {}),
  });
}

/**
 * Build a container UINode (has children).
 *
 * @param id - Widget ID.
 * @param type - Wire type string (e.g., "column", "row").
 * @param props - Wire-ready props (already encoded).
 * @param children - Child UINodes.
 * @returns Frozen UINode.
 */
export function containerNode(
  id: string,
  type: string,
  props: Record<string, unknown>,
  children: UINode[],
): UINode {
  return containerNodeWithMeta(id, type, props, children);
}

export function containerNodeWithMeta(
  id: string,
  type: string,
  props: Record<string, unknown>,
  children: UINode[],
  meta?: Readonly<Record<string, unknown>>,
): UINode {
  return Object.freeze({
    id,
    type,
    props: Object.freeze(props),
    children: Object.freeze(children),
    ...(meta ? { meta } : {}),
  });
}

/**
 * Register handlers from an options object for a widget.
 * Extracts `onXxx` props, registers them, and returns the
 * remaining non-handler props.
 *
 * @param widgetId - The widget's ID.
 * @param opts - Raw options that may include handler props.
 * @param handlerMap - Map of handler prop names to wire event types.
 * @returns Options with handler props removed.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractHandlers<T>(
  widgetId: string,
  opts: T,
  handlerMap: Record<string, string>,
): { clean: T; meta?: Readonly<Record<string, unknown>> } {
  const clean = { ...opts } as Record<string, unknown>;
  const handlers: Record<string, Handler<unknown>> = {};
  for (const [propName, eventType] of Object.entries(handlerMap)) {
    const handler = clean[propName];
    if (typeof handler === "function") {
      registerHandler(widgetId, eventType, handler as Handler<unknown>);
      handlers[eventType] = handler as Handler<unknown>;
    }
    delete clean[propName];
  }
  const meta = withHandlersMeta(
    undefined,
    Object.keys(handlers).length > 0 ? (handlers as HandlerMeta) : undefined,
  );
  return meta === undefined ? { clean: clean as T } : { clean: clean as T, meta };
}

/**
 * Apply animation descriptors to an already-built UINode.
 *
 * Merges animation prop values onto the node's props. The original
 * node is not mutated; a new frozen node is returned.
 *
 * @example
 * ```tsx
 * import { transition } from 'plushie'
 * import { Container, withAnimation } from 'plushie/ui'
 *
 * // Fade-in on mount
 * withAnimation(
 *   <Container id="panel">...</Container>,
 *   { opacity: transition({ to: 1, from: 0, duration: 200 }) },
 * )
 *
 * // With exit animation
 * withAnimation(
 *   <Container id="panel">...</Container>,
 *   { opacity: transition({ to: 1, from: 0, duration: 200 }) },
 *   { opacity: transition({ to: 0, duration: 150 }) },
 * )
 * ```
 */
export function withAnimation(
  node: UINode,
  animate: Readonly<Record<string, unknown>>,
  exit?: Readonly<Record<string, unknown>>,
): UINode {
  const merged = { ...node.props, ...animate };
  if (exit) merged["exit"] = exit;
  return Object.freeze({
    ...node,
    props: Object.freeze(merged),
  });
}

/**
 * Generate an auto-ID for display widgets that don't need explicit IDs.
 */
export { autoId };
