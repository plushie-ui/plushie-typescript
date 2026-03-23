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
import type { InteractiveDescriptor } from "./interactive.js";
import type { PathCommand } from "./path.js";
import type { Stroke } from "./stroke.js";

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
  readonly interactive?: InteractiveDescriptor;
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
  readonly interactive?: InteractiveDescriptor;
}

export interface LineShape {
  readonly type: "line";
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly stroke?: Stroke;
  readonly opacity?: number;
  readonly interactive?: InteractiveDescriptor;
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
  readonly interactive?: InteractiveDescriptor;
}

export interface PathShape {
  readonly type: "path";
  readonly commands: readonly PathCommand[];
  readonly fill?: string | LinearGradient;
  readonly stroke?: Stroke;
  readonly opacity?: number;
  readonly fill_rule?: "non_zero" | "even_odd";
  readonly interactive?: InteractiveDescriptor;
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
  readonly interactive?: InteractiveDescriptor;
}

export interface CanvasSvgShape {
  readonly type: "svg";
  readonly source: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly interactive?: InteractiveDescriptor;
}

export interface GroupShape {
  readonly type: "group";
  readonly children: readonly CanvasShape[];
  readonly x?: number;
  readonly y?: number;
  readonly interactive?: InteractiveDescriptor;
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
  readonly interactive?: InteractiveDescriptor;
}

export interface CircleOpts {
  readonly fill?: string | LinearGradient;
  readonly stroke?: Stroke;
  readonly opacity?: number;
  readonly fill_rule?: "non_zero" | "even_odd";
  readonly interactive?: InteractiveDescriptor;
}

export interface LineOpts {
  readonly stroke?: Stroke;
  readonly opacity?: number;
  readonly interactive?: InteractiveDescriptor;
}

export interface CanvasTextOpts {
  readonly fill?: string | LinearGradient;
  readonly size?: number;
  readonly font?: string;
  readonly align_x?: "left" | "center" | "right";
  readonly align_y?: "top" | "center" | "bottom";
  readonly opacity?: number;
  readonly interactive?: InteractiveDescriptor;
}

export interface PathOpts {
  readonly fill?: string | LinearGradient;
  readonly stroke?: Stroke;
  readonly opacity?: number;
  readonly fill_rule?: "non_zero" | "even_odd";
  readonly interactive?: InteractiveDescriptor;
}

export interface CanvasImageOpts {
  readonly rotation?: number;
  readonly opacity?: number;
  readonly interactive?: InteractiveDescriptor;
}

export interface GroupOpts {
  readonly x?: number;
  readonly y?: number;
  readonly interactive?: InteractiveDescriptor;
}

// -- Builder functions --------------------------------------------------------

/** Build a rectangle shape. */
export function rect(x: number, y: number, w: number, h: number, opts?: RectOpts): RectShape {
  const shape: Record<string, unknown> = { type: "rect", x, y, w, h };
  if (opts) applyFillStrokeOpacity(shape, opts);
  if (opts?.radius !== undefined) shape["radius"] = opts.radius;
  if (opts?.fill_rule !== undefined) shape["fill_rule"] = opts.fill_rule;
  if (opts?.interactive !== undefined) shape["interactive"] = opts.interactive;
  return shape as unknown as RectShape;
}

/** Build a circle shape. */
export function circle(x: number, y: number, r: number, opts?: CircleOpts): CircleShape {
  const shape: Record<string, unknown> = { type: "circle", x, y, r };
  if (opts) applyFillStrokeOpacity(shape, opts);
  if (opts?.fill_rule !== undefined) shape["fill_rule"] = opts.fill_rule;
  if (opts?.interactive !== undefined) shape["interactive"] = opts.interactive;
  return shape as unknown as CircleShape;
}

/** Build a line shape. */
export function line(x1: number, y1: number, x2: number, y2: number, opts?: LineOpts): LineShape {
  const shape: Record<string, unknown> = { type: "line", x1, y1, x2, y2 };
  if (opts?.stroke !== undefined) shape["stroke"] = opts.stroke;
  if (opts?.opacity !== undefined) shape["opacity"] = opts.opacity;
  if (opts?.interactive !== undefined) shape["interactive"] = opts.interactive;
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
  if (opts?.interactive !== undefined) shape["interactive"] = opts.interactive;
  return shape as unknown as CanvasTextShape;
}

/** Build an arbitrary path shape. */
export function path(commands: readonly PathCommand[], opts?: PathOpts): PathShape {
  const shape: Record<string, unknown> = { type: "path", commands };
  if (opts) applyFillStrokeOpacity(shape, opts);
  if (opts?.fill_rule !== undefined) shape["fill_rule"] = opts.fill_rule;
  if (opts?.interactive !== undefined) shape["interactive"] = opts.interactive;
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
  if (opts?.interactive !== undefined) shape["interactive"] = opts.interactive;
  return shape as unknown as CanvasImageShape;
}

/** Draw an SVG on the canvas. */
export function canvasSvg(
  source: string,
  x: number,
  y: number,
  w: number,
  h: number,
  opts?: { readonly interactive?: InteractiveDescriptor },
): CanvasSvgShape {
  const shape: Record<string, unknown> = { type: "svg", source, x, y, w, h };
  if (opts?.interactive !== undefined) shape["interactive"] = opts.interactive;
  return shape as unknown as CanvasSvgShape;
}

/** Group child shapes with optional translation. */
export function group(children: readonly CanvasShape[], opts?: GroupOpts): GroupShape {
  const shape: Record<string, unknown> = { type: "group", children };
  if (opts?.x !== undefined) shape["x"] = opts.x;
  if (opts?.y !== undefined) shape["y"] = opts.y;
  if (opts?.interactive !== undefined) shape["interactive"] = opts.interactive;
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
