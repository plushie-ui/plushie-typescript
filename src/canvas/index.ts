/**
 * Canvas drawing primitives and utilities.
 *
 * Provides shape builders (rect, circle, line, path, text, image, svg,
 * group), path commands (moveTo, lineTo, bezierTo, arc, etc.), transform
 * and clip operations, stroke configuration, interactive shape descriptors,
 * and linear gradients.
 *
 * Canvas shapes are used as children of the Canvas widget. Each shape
 * builder returns a typed node that the runtime encodes for the wire
 * protocol.
 *
 * @module
 */

export {
  rect,
  circle,
  line,
  canvasText,
  path,
  canvasImage,
  canvasSvg,
  group,
} from "./shapes.js"

export type {
  RectShape,
  CircleShape,
  LineShape,
  CanvasTextShape,
  PathShape,
  CanvasImageShape,
  CanvasSvgShape,
  GroupShape,
  CanvasShape,
  RectOpts,
  CircleOpts,
  LineOpts,
  CanvasTextOpts,
  PathOpts,
  CanvasImageOpts,
  GroupOpts,
} from "./shapes.js"

export {
  moveTo,
  lineTo,
  bezierTo,
  quadraticTo,
  arc,
  arcTo,
  ellipse,
  roundedRect,
  close,
} from "./path.js"

export type { PathCommand } from "./path.js"

export {
  pushTransform,
  popTransform,
  translate,
  rotate,
  scale,
  pushClip,
  popClip,
} from "./transform.js"

export type { TransformCommand } from "./transform.js"

export { stroke } from "./stroke.js"
export type { Stroke, Dash, StrokeOpts } from "./stroke.js"

export { interactive } from "./interactive.js"
export type {
  InteractiveOpts,
  InteractiveDescriptor,
  DragBounds,
  HitRect,
} from "./interactive.js"

export { linearGradient } from "./gradient.js"
export type { LinearGradient, GradientStop } from "./gradient.js"
