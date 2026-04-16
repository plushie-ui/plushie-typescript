/**
 * Image display: renders a raster image from a file path or handle.
 *
 * @module
 */

import type { UINode } from "../../types.js";
import { applyA11yDefaults, autoId, leafNode, putIf } from "../build.js";
import type { A11y, ContentFit, FilterMethod, Length } from "../types.js";
import { encodeA11y, encodeLength } from "../types.js";

/** Props for the Image widget. */
export interface ImageProps {
  /** Unique widget identifier. */
  id?: string;
  /** Image source: a file path string or an in-memory handle reference. */
  source: string | { handle: string };
  /** Width of the image. */
  width?: Length;
  /** Height of the image. */
  height?: Length;
  /** How the image fits within its bounds ("contain", "cover", "fill", "none", "scale_down"). */
  contentFit?: ContentFit;
  /** Pixel sampling method ("nearest" or "linear"). */
  filterMethod?: FilterMethod;
  /** Rotation angle in radians. */
  rotation?: number;
  /** Opacity from 0.0 (transparent) to 1.0 (opaque). */
  opacity?: number;
  /** Border radius in pixels for rounded corners. */
  borderRadius?: number;
  /** When true, expands the image to fill available space. */
  expand?: boolean;
  /** Scale factor applied to the image. */
  scale?: number;
  /** Crop rectangle defining a sub-region of the source image. */
  crop?: { x: number; y: number; width: number; height: number };
  /** Accessible label announced by screen readers. */
  alt?: string;
  /** Extended accessible description. */
  description?: string;
  /** When true, hides the image from assistive technology. Use for purely visual images. */
  decorative?: boolean;
  /** Accessibility properties. */
  a11y?: A11y;
}

export function Image(props: ImageProps): UINode {
  const id = props.id ?? autoId("image");
  const p: Record<string, unknown> = { source: props.source };
  putIf(p, props.width, "width", encodeLength);
  putIf(p, props.height, "height", encodeLength);
  putIf(p, props.contentFit, "content_fit");
  putIf(p, props.filterMethod, "filter_method");
  putIf(p, props.rotation, "rotation");
  putIf(p, props.opacity, "opacity");
  putIf(p, props.borderRadius, "border_radius");
  putIf(p, props.expand, "expand");
  putIf(p, props.scale, "scale");
  putIf(p, props.crop, "crop");
  putIf(p, props.alt, "alt");
  putIf(p, props.description, "description");
  putIf(p, props.decorative, "decorative");
  applyA11yDefaults(p, props.a11y, { role: "image" }, encodeA11y);
  return leafNode(id, "image", p);
}

export function image(source: string | { handle: string }): UINode;
export function image(
  id: string,
  source: string | { handle: string },
  opts?: Omit<ImageProps, "id" | "source">,
): UINode;
export function image(
  first: string | { handle: string },
  second?: string | { handle: string } | Omit<ImageProps, "id" | "source">,
  third?: Omit<ImageProps, "id" | "source">,
): UINode {
  if (second === undefined) {
    return Image({ source: first });
  }
  if (typeof second === "string" || (typeof second === "object" && "handle" in second)) {
    return Image({ id: first as string, source: second, ...third });
  }
  return Image({ source: first, ...second });
}
