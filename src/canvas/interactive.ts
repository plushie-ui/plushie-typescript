/**
 * Interactive shape wrapper for canvas hit testing and events.
 *
 * Attaches an `interactive` field to any shape object, enabling
 * click/hover/drag behavior, tooltips, and accessibility annotations.
 */

export interface DragBounds {
  readonly min_x?: number
  readonly max_x?: number
  readonly min_y?: number
  readonly max_y?: number
}

export interface HitRect {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

export interface InteractiveOpts {
  readonly id: string
  readonly on_click?: boolean
  readonly on_hover?: boolean
  readonly draggable?: boolean
  readonly drag_axis?: "x" | "y" | "both"
  readonly drag_bounds?: DragBounds
  readonly cursor?: string
  readonly hover_style?: Readonly<Record<string, unknown>>
  readonly pressed_style?: Readonly<Record<string, unknown>>
  readonly tooltip?: string
  readonly a11y?: Readonly<Record<string, unknown>>
  readonly hit_rect?: HitRect
}

export interface InteractiveDescriptor {
  readonly id: string
  readonly on_click?: boolean
  readonly on_hover?: boolean
  readonly draggable?: boolean
  readonly drag_axis?: "x" | "y" | "both"
  readonly drag_bounds?: DragBounds
  readonly cursor?: string
  readonly hover_style?: Readonly<Record<string, unknown>>
  readonly pressed_style?: Readonly<Record<string, unknown>>
  readonly tooltip?: string
  readonly a11y?: Readonly<Record<string, unknown>>
  readonly hit_rect?: HitRect
}

function buildInteractive(opts: InteractiveOpts): InteractiveDescriptor {
  const result: Record<string, unknown> = { id: opts.id }
  if (opts.on_click !== undefined) result["on_click"] = opts.on_click
  if (opts.on_hover !== undefined) result["on_hover"] = opts.on_hover
  if (opts.draggable !== undefined) result["draggable"] = opts.draggable
  if (opts.drag_axis !== undefined) result["drag_axis"] = opts.drag_axis
  if (opts.drag_bounds !== undefined) result["drag_bounds"] = opts.drag_bounds
  if (opts.cursor !== undefined) result["cursor"] = opts.cursor
  if (opts.hover_style !== undefined) result["hover_style"] = opts.hover_style
  if (opts.pressed_style !== undefined) result["pressed_style"] = opts.pressed_style
  if (opts.tooltip !== undefined) result["tooltip"] = opts.tooltip
  if (opts.a11y !== undefined) result["a11y"] = opts.a11y
  if (opts.hit_rect !== undefined) result["hit_rect"] = opts.hit_rect
  return result as unknown as InteractiveDescriptor
}

/**
 * Marks a shape as interactive by attaching an `interactive` field.
 *
 * Returns a new shape object with the `interactive` descriptor added.
 */
export function interactive<T extends Record<string, unknown>>(
  shape: T,
  opts: InteractiveOpts,
): T & { readonly interactive: InteractiveDescriptor } {
  return { ...shape, interactive: buildInteractive(opts) }
}
