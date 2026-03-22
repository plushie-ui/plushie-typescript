/**
 * SVG display -- renders a vector image from a file path.
 *
 * @module
 */

import type { UINode } from "../../types.js"
import type { Length, ContentFit, Color, A11y } from "../types.js"
import { encodeLength, encodeColor, encodeA11y } from "../types.js"
import { leafNode, putIf, autoId } from "../build.js"

/** Props for the Svg widget. */
export interface SvgProps {
  id?: string
  source: string
  width?: Length
  height?: Length
  contentFit?: ContentFit
  rotation?: number
  opacity?: number
  color?: Color
  alt?: string
  description?: string
  decorative?: boolean
  a11y?: A11y
}

export function Svg(props: SvgProps): UINode {
  const id = props.id ?? autoId("svg")
  const p: Record<string, unknown> = { source: props.source }
  putIf(p, props.width, "width", encodeLength)
  putIf(p, props.height, "height", encodeLength)
  putIf(p, props.contentFit, "content_fit")
  putIf(p, props.rotation, "rotation")
  putIf(p, props.opacity, "opacity")
  putIf(p, props.color, "color", encodeColor)
  putIf(p, props.alt, "alt")
  putIf(p, props.description, "description")
  putIf(p, props.decorative, "decorative")
  putIf(p, props.a11y, "a11y", encodeA11y)
  return leafNode(id, "svg", p)
}

export function svg(source: string): UINode
export function svg(id: string, source: string, opts?: Omit<SvgProps, "id" | "source">): UINode
export function svg(
  first: string,
  second?: string | Omit<SvgProps, "id" | "source">,
  third?: Omit<SvgProps, "id" | "source">,
): UINode {
  if (second === undefined) {
    return Svg({ source: first })
  }
  if (typeof second === "string") {
    return Svg({ id: first, source: second, ...third })
  }
  return Svg({ source: first, ...second })
}
