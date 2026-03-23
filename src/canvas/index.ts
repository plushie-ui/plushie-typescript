/**
 * Canvas drawing primitives and utilities.
 *
 * Provides shape builders (rect, circle, line, path, text, image, svg,
 * group), path commands (moveTo, lineTo, bezierTo, arc, etc.), transform
 * values, clip rects, stroke configuration, interactive shape support,
 * and linear gradients.
 *
 * Canvas shapes are used as children of the Canvas widget. Each shape
 * builder returns a typed node that the runtime encodes for the wire
 * protocol.
 *
 * @module
 */

export type { GradientStop, LinearGradient } from "./gradient.js";
export { linearGradient } from "./gradient.js";
export type {
  DragBounds,
  HitRect,
  InteractiveOpts,
} from "./interactive.js";
export { interactive } from "./interactive.js";
export type { PathCommand } from "./path.js";
export {
  arc,
  arcTo,
  bezierTo,
  close,
  ellipse,
  lineTo,
  moveTo,
  quadraticTo,
  roundedRect,
} from "./path.js";
export type {
  CanvasImageOpts,
  CanvasImageShape,
  CanvasShape,
  CanvasSvgShape,
  CanvasTextOpts,
  CanvasTextShape,
  CircleOpts,
  CircleShape,
  GroupOpts,
  GroupShape,
  LineOpts,
  LineShape,
  PathOpts,
  PathShape,
  RectOpts,
  RectShape,
} from "./shapes.js";
export {
  canvasImage,
  canvasSvg,
  canvasText,
  circle,
  group,
  line,
  path,
  rect,
} from "./shapes.js";
export type { Dash, Stroke, StrokeOpts } from "./stroke.js";
export { stroke } from "./stroke.js";
export type { ClipRect, TransformValue } from "./transform.js";
export { clip, rotate, scale, scaleUniform, translate } from "./transform.js";
