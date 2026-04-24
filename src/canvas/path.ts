/**
 * Path command builders for canvas shapes.
 *
 * Each function returns a wire-format array: `[commandName, ...args]`.
 * The `close` command is a bare string `"close"`.
 */

import { angle, coordinate, extent } from "./geometry.js";

export type PathCommand = readonly (string | number)[] | "close";

/** Move the pen to (x, y). */
export function moveTo(x: number, y: number): PathCommand {
  return ["move_to", coordinate(x), coordinate(y)] as const;
}

/** Draw a line from the current position to (x, y). */
export function lineTo(x: number, y: number): PathCommand {
  return ["line_to", coordinate(x), coordinate(y)] as const;
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
  return [
    "bezier_to",
    coordinate(cp1x),
    coordinate(cp1y),
    coordinate(cp2x),
    coordinate(cp2y),
    coordinate(x),
    coordinate(y),
  ] as const;
}

/** Draw a quadratic bezier curve. */
export function quadraticTo(cpx: number, cpy: number, x: number, y: number): PathCommand {
  return ["quadratic_to", coordinate(cpx), coordinate(cpy), coordinate(x), coordinate(y)] as const;
}

/** Draw an arc (center, radius, start/end angles in radians). */
export function arc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): PathCommand {
  return [
    "arc",
    coordinate(cx),
    coordinate(cy),
    extent(r),
    angle(startAngle),
    angle(endAngle),
  ] as const;
}

/** Draw a tangent arc through two points with a radius. */
export function arcTo(x1: number, y1: number, x2: number, y2: number, radius: number): PathCommand {
  return [
    "arc_to",
    coordinate(x1),
    coordinate(y1),
    coordinate(x2),
    coordinate(y2),
    extent(radius),
  ] as const;
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
  return [
    "ellipse",
    coordinate(cx),
    coordinate(cy),
    extent(rx),
    extent(ry),
    angle(rotation),
    angle(startAngle),
    angle(endAngle),
  ] as const;
}

/** Draw a rounded rectangle as a path command. */
export function roundedRect(
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): PathCommand {
  return [
    "rounded_rect",
    coordinate(x),
    coordinate(y),
    extent(w),
    extent(h),
    extent(radius),
  ] as const;
}

/** Close the current path. */
export function close(): PathCommand {
  return "close";
}

export function normalizePathCommand(command: PathCommand): PathCommand {
  if (command === "close") return command;

  switch (command[0]) {
    case "move_to":
      return moveTo(numberAt(command, 1), numberAt(command, 2));
    case "line_to":
      return lineTo(numberAt(command, 1), numberAt(command, 2));
    case "bezier_to":
      return bezierTo(
        numberAt(command, 1),
        numberAt(command, 2),
        numberAt(command, 3),
        numberAt(command, 4),
        numberAt(command, 5),
        numberAt(command, 6),
      );
    case "quadratic_to":
      return quadraticTo(
        numberAt(command, 1),
        numberAt(command, 2),
        numberAt(command, 3),
        numberAt(command, 4),
      );
    case "arc":
      return arc(
        numberAt(command, 1),
        numberAt(command, 2),
        numberAt(command, 3),
        numberAt(command, 4),
        numberAt(command, 5),
      );
    case "arc_to":
      return arcTo(
        numberAt(command, 1),
        numberAt(command, 2),
        numberAt(command, 3),
        numberAt(command, 4),
        numberAt(command, 5),
      );
    case "ellipse":
      return ellipse(
        numberAt(command, 1),
        numberAt(command, 2),
        numberAt(command, 3),
        numberAt(command, 4),
        numberAt(command, 5),
        numberAt(command, 6),
        numberAt(command, 7),
      );
    case "rounded_rect":
      return roundedRect(
        numberAt(command, 1),
        numberAt(command, 2),
        numberAt(command, 3),
        numberAt(command, 4),
        numberAt(command, 5),
      );
    default:
      return command.map((value, index) => (index === 0 ? value : normalizeNumber(value)));
  }
}

function numberAt(command: readonly (string | number)[], index: number): number {
  return normalizeNumber(command[index]);
}

function normalizeNumber(value: string | number | undefined): number {
  return typeof value === "number" ? coordinate(value) : 0;
}
