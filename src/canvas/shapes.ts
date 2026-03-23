/**
 * Canvas shape builder functions.
 *
 * Each returns a plain object matching the wire format expected by
 * the plushie renderer. Shapes are used inside canvas layers.
 *
 * Optional fields are omitted from the output when not provided,
 * keeping wire payloads compact.
 */

import type { LinearGradient } from "./gradient.js";
import type { DragBounds, HitRect } from "./interactive.js";
import type { PathCommand } from "./path.js";
import type { Stroke } from "./stroke.js";
import type { ClipRect, TransformValue } from "./transform.js";

// -- Shape types --------------------------------------------------------------

export interface RectShape {
  readonly type: "rect";
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly fill?: string | LinearGradient;
  readonly stroke?: Stroke;
  readonly opacity?: number;
  readonly radius?: number;
  readonly fill_rule?: "non_zero" | "even_odd";
}

export interface CircleShape {
  readonly type: "circle";
  readonly x: number;
  readonly y: number;
  readonly r: number;
  readonly fill?: string | LinearGradient;
  readonly stroke?: Stroke;
  readonly opacity?: number;
  readonly fill_rule?: "non_zero" | "even_odd";
}

export interface LineShape {
  readonly type: "line";
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly stroke?: Stroke;
  readonly opacity?: number;
}

export interface CanvasTextShape {
  readonly type: "text";
  readonly x: number;
  readonly y: number;
  readonly content: string;
  readonly fill?: string | LinearGradient;
  readonly size?: number;
  readonly font?: string;
  readonly align_x?: "left" | "center" | "right";
  readonly align_y?: "top" | "center" | "bottom";
  readonly opacity?: number;
}

export interface PathShape {
  readonly type: "path";
  readonly commands: readonly PathCommand[];
  readonly fill?: string | LinearGradient;
  readonly stroke?: Stroke;
  readonly opacity?: number;
  readonly fill_rule?: "non_zero" | "even_odd";
}

export interface CanvasImageShape {
  readonly type: "image";
  readonly source: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly rotation?: number;
  readonly opacity?: number;
}

export interface CanvasSvgShape {
  readonly type: "svg";
  readonly source: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface GroupShape {
  readonly type: "group";
  readonly children: readonly CanvasShape[];
  readonly transforms?: readonly TransformValue[];
  readonly clip?: ClipRect;
  readonly id?: string;
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

/** Union of all canvas shape types. */
export type CanvasShape =
  | RectShape
  | CircleShape
  | LineShape
  | CanvasTextShape
  | PathShape
  | CanvasImageShape
  | CanvasSvgShape
  | GroupShape;

// -- Option types -------------------------------------------------------------

export interface RectOpts {
  readonly fill?: string | LinearGradient;
  readonly stroke?: Stroke;
  readonly opacity?: number;
  readonly radius?: number;
  readonly fill_rule?: "non_zero" | "even_odd";
}

export interface CircleOpts {
  readonly fill?: string | LinearGradient;
  readonly stroke?: Stroke;
  readonly opacity?: number;
  readonly fill_rule?: "non_zero" | "even_odd";
}

export interface LineOpts {
  readonly stroke?: Stroke;
  readonly opacity?: number;
}

export interface CanvasTextOpts {
  readonly fill?: string | LinearGradient;
  readonly size?: number;
  readonly font?: string;
  readonly align_x?: "left" | "center" | "right";
  readonly align_y?: "top" | "center" | "bottom";
  readonly opacity?: number;
}

export interface PathOpts {
  readonly fill?: string | LinearGradient;
  readonly stroke?: Stroke;
  readonly opacity?: number;
  readonly fill_rule?: "non_zero" | "even_odd";
}

export interface CanvasImageOpts {
  readonly rotation?: number;
  readonly opacity?: number;
}

export interface GroupOpts {
  readonly x?: number;
  readonly y?: number;
  readonly transforms?: readonly TransformValue[];
  readonly clip?: ClipRect;
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

// -- Builder functions --------------------------------------------------------

/** Build a rectangle shape. */
export function rect(x: number, y: number, w: number, h: number, opts?: RectOpts): RectShape {
  const shape: Record<string, unknown> = { type: "rect", x, y, w, h };
  if (opts) applyFillStrokeOpacity(shape, opts);
  if (opts?.radius !== undefined) shape["radius"] = opts.radius;
  if (opts?.fill_rule !== undefined) shape["fill_rule"] = opts.fill_rule;
  return shape as unknown as RectShape;
}

/** Build a circle shape. */
export function circle(x: number, y: number, r: number, opts?: CircleOpts): CircleShape {
  const shape: Record<string, unknown> = { type: "circle", x, y, r };
  if (opts) applyFillStrokeOpacity(shape, opts);
  if (opts?.fill_rule !== undefined) shape["fill_rule"] = opts.fill_rule;
  return shape as unknown as CircleShape;
}

/** Build a line shape. */
export function line(x1: number, y1: number, x2: number, y2: number, opts?: LineOpts): LineShape {
  const shape: Record<string, unknown> = { type: "line", x1, y1, x2, y2 };
  if (opts?.stroke !== undefined) shape["stroke"] = opts.stroke;
  if (opts?.opacity !== undefined) shape["opacity"] = opts.opacity;
  return shape as unknown as LineShape;
}

/** Build a canvas text shape. */
export function canvasText(
  x: number,
  y: number,
  content: string,
  opts?: CanvasTextOpts,
): CanvasTextShape {
  const shape: Record<string, unknown> = { type: "text", x, y, content };
  if (opts?.fill !== undefined) shape["fill"] = opts.fill;
  if (opts?.size !== undefined) shape["size"] = opts.size;
  if (opts?.font !== undefined) shape["font"] = opts.font;
  if (opts?.align_x !== undefined) shape["align_x"] = opts.align_x;
  if (opts?.align_y !== undefined) shape["align_y"] = opts.align_y;
  if (opts?.opacity !== undefined) shape["opacity"] = opts.opacity;
  return shape as unknown as CanvasTextShape;
}

/** Build an arbitrary path shape. */
export function path(commands: readonly PathCommand[], opts?: PathOpts): PathShape {
  const shape: Record<string, unknown> = { type: "path", commands };
  if (opts) applyFillStrokeOpacity(shape, opts);
  if (opts?.fill_rule !== undefined) shape["fill_rule"] = opts.fill_rule;
  return shape as unknown as PathShape;
}

/** Draw a raster image on the canvas. */
export function canvasImage(
  source: string,
  x: number,
  y: number,
  w: number,
  h: number,
  opts?: CanvasImageOpts,
): CanvasImageShape {
  const shape: Record<string, unknown> = { type: "image", source, x, y, w, h };
  if (opts?.rotation !== undefined) shape["rotation"] = opts.rotation;
  if (opts?.opacity !== undefined) shape["opacity"] = opts.opacity;
  return shape as unknown as CanvasImageShape;
}

/** Draw an SVG on the canvas. */
export function canvasSvg(
  source: string,
  x: number,
  y: number,
  w: number,
  h: number,
): CanvasSvgShape {
  return { type: "svg", source, x, y, w, h };
}

/** Group child shapes with optional transforms, clip, and interactive fields. */
export function group(
  idOrChildren: string | readonly CanvasShape[],
  childrenOrOpts?: readonly CanvasShape[] | GroupOpts,
  maybeOpts?: GroupOpts,
): GroupShape {
  let id: string | undefined;
  let children: readonly CanvasShape[];
  let opts: GroupOpts | undefined;

  if (typeof idOrChildren === "string") {
    id = idOrChildren;
    children = childrenOrOpts as readonly CanvasShape[];
    opts = maybeOpts;
  } else {
    children = idOrChildren;
    opts = childrenOrOpts as GroupOpts | undefined;
  }

  const shape: Record<string, unknown> = { type: "group", children };
  if (id !== undefined) shape["id"] = id;

  // Desugar x/y to leading translate
  const transforms: Record<string, unknown>[] = [];
  if (opts?.x !== undefined || opts?.y !== undefined) {
    transforms.push({ type: "translate", x: opts?.x ?? 0, y: opts?.y ?? 0 });
  }
  if (opts?.transforms) {
    transforms.push(...opts.transforms);
  }
  if (transforms.length > 0) shape["transforms"] = transforms;

  if (opts?.clip !== undefined) shape["clip"] = opts.clip;
  if (opts?.on_click !== undefined) shape["on_click"] = opts.on_click;
  if (opts?.on_hover !== undefined) shape["on_hover"] = opts.on_hover;
  if (opts?.draggable !== undefined) shape["draggable"] = opts.draggable;
  if (opts?.drag_axis !== undefined) shape["drag_axis"] = opts.drag_axis;
  if (opts?.drag_bounds !== undefined) shape["drag_bounds"] = opts.drag_bounds;
  if (opts?.cursor !== undefined) shape["cursor"] = opts.cursor;
  if (opts?.hit_rect !== undefined) shape["hit_rect"] = opts.hit_rect;
  if (opts?.tooltip !== undefined) shape["tooltip"] = opts.tooltip;
  if (opts?.hover_style !== undefined) shape["hover_style"] = opts.hover_style;
  if (opts?.pressed_style !== undefined) shape["pressed_style"] = opts.pressed_style;
  if (opts?.focus_style !== undefined) shape["focus_style"] = opts.focus_style;
  if (opts?.show_focus_ring !== undefined) shape["show_focus_ring"] = opts.show_focus_ring;
  if (opts?.focus_ring_radius !== undefined) shape["focus_ring_radius"] = opts.focus_ring_radius;
  if (opts?.a11y !== undefined) shape["a11y"] = opts.a11y;
  if (opts?.focusable !== undefined) shape["focusable"] = opts.focusable;

  return shape as unknown as GroupShape;
}

// -- Internal helpers ---------------------------------------------------------

function applyFillStrokeOpacity(
  shape: Record<string, unknown>,
  opts: { readonly fill?: unknown; readonly stroke?: unknown; readonly opacity?: number },
): void {
  if (opts.fill !== undefined) shape["fill"] = opts.fill;
  if (opts.stroke !== undefined) shape["stroke"] = opts.stroke;
  if (opts.opacity !== undefined) shape["opacity"] = opts.opacity;
}
