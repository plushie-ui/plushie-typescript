/**
 * SVG display -- renders a vector image from a file path.
 *
 * @module
 */

import type { UINode } from "../../types.js";
import { autoId, leafNode, putIf } from "../build.js";
import type { A11y, Color, ContentFit, Length } from "../types.js";
import { encodeA11y, encodeColor, encodeLength } from "../types.js";

/** Props for the Svg widget. */
export interface SvgProps {
  /** Unique widget identifier. */
  id?: string;
  /** File path to the SVG image. */
  source: string;
  /** Width of the SVG. */
  width?: Length;
  /** Height of the SVG. */
  height?: Length;
  /** How the SVG fits within its bounds ("contain", "cover", "fill", "none", "scale_down"). */
  contentFit?: ContentFit;
  /** Rotation angle in radians. */
  rotation?: number;
  /** Opacity from 0.0 (transparent) to 1.0 (opaque). */
  opacity?: number;
  /** Tint color applied to the SVG. */
  color?: Color;
  /** Accessible label announced by screen readers. */
  alt?: string;
  /** Extended accessible description. */
  description?: string;
  /** When true, hides the SVG from assistive technology. Use for purely visual images. */
  decorative?: boolean;
  /** Accessibility properties. */
  a11y?: A11y;
}

export function Svg(props: SvgProps): UINode {
  const id = props.id ?? autoId("svg");
  const p: Record<string, unknown> = { source: props.source };
  putIf(p, props.width, "width", encodeLength);
  putIf(p, props.height, "height", encodeLength);
  putIf(p, props.contentFit, "content_fit");
  putIf(p, props.rotation, "rotation");
  putIf(p, props.opacity, "opacity");
  putIf(p, props.color, "color", encodeColor);
  putIf(p, props.alt, "alt");
  putIf(p, props.description, "description");
  putIf(p, props.decorative, "decorative");
  putIf(p, props.a11y, "a11y", encodeA11y);
  return leafNode(id, "svg", p);
}

export function svg(source: string): UINode;
export function svg(id: string, source: string, opts?: Omit<SvgProps, "id" | "source">): UINode;
export function svg(
  first: string,
  second?: string | Omit<SvgProps, "id" | "source">,
  third?: Omit<SvgProps, "id" | "source">,
): UINode {
  if (second === undefined) {
    return Svg({ source: first });
  }
  if (typeof second === "string") {
    return Svg({ id: first, source: second, ...third });
  }
  return Svg({ source: first, ...second });
}
