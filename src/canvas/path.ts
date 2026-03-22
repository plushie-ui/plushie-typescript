/**
 * Path command builders for canvas shapes.
 *
 * Each function returns a wire-format array: `[commandName, ...args]`.
 * The `close` command is a bare string `"close"`.
 */

export type PathCommand = readonly (string | number)[] | "close"

/** Move the pen to (x, y). */
export function moveTo(x: number, y: number): PathCommand {
  return ["move_to", x, y] as const
}

/** Draw a line from the current position to (x, y). */
export function lineTo(x: number, y: number): PathCommand {
  return ["line_to", x, y] as const
}

/** Draw a cubic bezier curve. */
export function bezierTo(
  cp1x: number,
  cp1y: number,
  cp2x: number,
  cp2y: number,
  x: number,
  y: number,
): PathCommand {
  return ["bezier_to", cp1x, cp1y, cp2x, cp2y, x, y] as const
}

/** Draw a quadratic bezier curve. */
export function quadraticTo(
  cpx: number,
  cpy: number,
  x: number,
  y: number,
): PathCommand {
  return ["quadratic_to", cpx, cpy, x, y] as const
}

/** Draw an arc (center, radius, start/end angles in radians). */
export function arc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): PathCommand {
  return ["arc", cx, cy, r, startAngle, endAngle] as const
}

/** Draw a tangent arc through two points with a radius. */
export function arcTo(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  radius: number,
): PathCommand {
  return ["arc_to", x1, y1, x2, y2, radius] as const
}

/** Draw an ellipse. */
export function ellipse(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rotation: number,
  startAngle: number,
  endAngle: number,
): PathCommand {
  return ["ellipse", cx, cy, rx, ry, rotation, startAngle, endAngle] as const
}

/** Draw a rounded rectangle as a path command. */
export function roundedRect(
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): PathCommand {
  return ["rounded_rect", x, y, w, h, radius] as const
}

/** Close the current path. */
export function close(): PathCommand {
  return "close"
}
