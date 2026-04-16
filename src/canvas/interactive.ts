/**
 * Interactive shape wrapper for canvas hit testing and events.
 *
 * Makes a shape interactive by merging interactive fields onto a group.
 * If the shape is already a group, fields are merged directly.
 * If the shape is a leaf, it is wrapped as the sole child of a new group.
 */

import type { CanvasShape, GroupShape } from "./shapes.js";

export interface DragBounds {
  readonly min_x?: number;
  readonly max_x?: number;
  readonly min_y?: number;
  readonly max_y?: number;
}

export interface HitRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/**
 * A group shape with interactive fields. Produced by `interactive()`.
 * Encodes as `type: "group"` on the wire, same as structural groups.
 */
export interface InteractiveShape extends GroupShape {
  readonly id: string;
  readonly on_click?: boolean;
  readonly on_hover?: boolean;
  readonly draggable?: boolean;
  readonly drag_axis?: "x" | "y" | "both";
  readonly drag_bounds?: DragBounds;
  readonly cursor?: string;
  readonly hit_rect?: HitRect;
  readonly tooltip?: string;
  readonly hover_style?: Readonly<Record<string, unknown>>;
  readonly pressed_style?: Readonly<Record<string, unknown>>;
  readonly focus_style?: Readonly<Record<string, unknown>>;
  readonly show_focus_ring?: boolean;
  readonly focus_ring_radius?: number;
  readonly a11y?: Readonly<Record<string, unknown>>;
  readonly focusable?: boolean;
}

/** Interactive element options. */
export interface InteractiveOpts {
  readonly on_click?: boolean;
  readonly on_hover?: boolean;
  readonly draggable?: boolean;
  readonly drag_axis?: "x" | "y" | "both";
  readonly drag_bounds?: DragBounds;
  readonly cursor?: string;
  readonly hover_style?: Readonly<Record<string, unknown>>;
  readonly pressed_style?: Readonly<Record<string, unknown>>;
  readonly focus_style?: Readonly<Record<string, unknown>>;
  readonly show_focus_ring?: boolean;
  readonly focus_ring_radius?: number;
  readonly tooltip?: string;
  readonly a11y?: Readonly<Record<string, unknown>>;
  readonly hit_rect?: HitRect;
  readonly focusable?: boolean;
}

const INTERACTIVE_KEYS: readonly (keyof InteractiveOpts)[] = [
  "on_click",
  "on_hover",
  "draggable",
  "drag_axis",
  "drag_bounds",
  "cursor",
  "hover_style",
  "pressed_style",
  "focus_style",
  "show_focus_ring",
  "focus_ring_radius",
  "tooltip",
  "a11y",
  "hit_rect",
  "focusable",
];

function inferA11yDefaults(
  target: Record<string, unknown>,
  opts: InteractiveOpts | undefined,
): void {
  if (!opts) return;
  const existing = opts.a11y as Record<string, unknown> | undefined;
  if (existing?.["role"]) return;

  let role: string | undefined;
  if (opts.on_click) role = "button";
  else if (opts.draggable) role = "slider";
  else if (opts.focusable) {
    role = "group";
  }

  if (role) {
    const a11y = { ...(existing ?? {}), role };
    target["a11y"] = a11y;
  }
}

function mergeInteractiveFields(
  target: Record<string, unknown>,
  opts: InteractiveOpts | undefined,
): void {
  if (!opts) return;
  for (const key of INTERACTIVE_KEYS) {
    if (key === "a11y") continue;
    if (opts[key] !== undefined) target[key] = opts[key];
  }
  inferA11yDefaults(target, opts);
}

/**
 * Make a canvas shape interactive (clickable, draggable, focusable).
 *
 * If the shape is a group, interactive fields are merged at top level.
 * If the shape is a leaf (rect, circle, etc.), it is wrapped as the
 * sole child of a new interactive group.
 *
 * @example
 * ```ts
 * const btn = interactive(rect({ width: 80, height: 30 }), "btn", {
 *   onClick: true,
 *   cursor: "pointer",
 * });
 * ```
 */
export function interactive(
  shape: CanvasShape,
  id: string,
  opts?: InteractiveOpts,
): InteractiveShape {
  if (shape["type"] === "group") {
    const result: Record<string, unknown> = { ...shape, id };
    mergeInteractiveFields(result, opts);
    return result as unknown as InteractiveShape;
  }

  const group: Record<string, unknown> = { type: "group", id, children: [shape] };
  mergeInteractiveFields(group, opts);
  return group as unknown as InteractiveShape;
}
