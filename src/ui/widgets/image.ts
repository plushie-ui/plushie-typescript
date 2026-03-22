/**
 * Image display -- renders a raster image from a file path or handle.
 *
 * @module
 */

import type { UINode } from "../../types.js"
import type { Length, ContentFit, FilterMethod, A11y } from "../types.js"
import { encodeLength, encodeA11y } from "../types.js"
import { leafNode, putIf, autoId } from "../build.js"

/** Props for the Image widget. */
export interface ImageProps {
  id?: string
  source: string | { handle: string }
  width?: Length
  height?: Length
  contentFit?: ContentFit
  filterMethod?: FilterMethod
  rotation?: number
  opacity?: number
  borderRadius?: number
  expand?: boolean
  scale?: number
  crop?: { x: number; y: number; width: number; height: number }
  alt?: string
  description?: string
  decorative?: boolean
  a11y?: A11y
}

export function Image(props: ImageProps): UINode {
  const id = props.id ?? autoId("image")
  const p: Record<string, unknown> = { source: props.source }
  putIf(p, props.width, "width", encodeLength)
  putIf(p, props.height, "height", encodeLength)
  putIf(p, props.contentFit, "content_fit")
  putIf(p, props.filterMethod, "filter_method")
  putIf(p, props.rotation, "rotation")
  putIf(p, props.opacity, "opacity")
  putIf(p, props.borderRadius, "border_radius")
  putIf(p, props.expand, "expand")
  putIf(p, props.scale, "scale")
  putIf(p, props.crop, "crop")
  putIf(p, props.alt, "alt")
  putIf(p, props.description, "description")
  putIf(p, props.decorative, "decorative")
  putIf(p, props.a11y, "a11y", encodeA11y)
  return leafNode(id, "image", p)
}

export function image(source: string | { handle: string }): UINode
export function image(id: string, source: string | { handle: string }, opts?: Omit<ImageProps, "id" | "source">): UINode
export function image(
  first: string | { handle: string },
  second?: string | { handle: string } | Omit<ImageProps, "id" | "source">,
  third?: Omit<ImageProps, "id" | "source">,
): UINode {
  if (second === undefined) {
    return Image({ source: first })
  }
  if (typeof second === "string" || (typeof second === "object" && "handle" in second)) {
    return Image({ id: first as string, source: second, ...third })
  }
  return Image({ source: first, ...second })
}
