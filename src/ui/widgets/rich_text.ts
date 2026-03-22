/**
 * Rich text -- display text with individually styled spans.
 *
 * @module
 */

import type { UINode } from "../../types.js"
import type {
  Length, Font, Color, Wrapping, LineHeight, A11y,
} from "../types.js"
import {
  encodeLength, encodeFont, encodeColor, encodeLineHeight, encodeA11y,
} from "../types.js"
import { leafNode, putIf, autoId } from "../build.js"

/** Props for the RichText widget. */
export interface RichTextProps {
  id?: string
  spans?: Record<string, unknown>[]
  size?: number
  font?: Font
  color?: Color
  width?: Length
  height?: Length
  lineHeight?: LineHeight
  wrapping?: Wrapping
  ellipsis?: string
  a11y?: A11y
}

export function RichText(props: RichTextProps): UINode {
  const id = props.id ?? autoId("rich_text")
  const p: Record<string, unknown> = {}
  putIf(p, props.spans, "spans")
  putIf(p, props.size, "size")
  putIf(p, props.font, "font", encodeFont)
  putIf(p, props.color, "color", encodeColor)
  putIf(p, props.width, "width", encodeLength)
  putIf(p, props.height, "height", encodeLength)
  putIf(p, props.lineHeight, "line_height", encodeLineHeight)
  putIf(p, props.wrapping, "wrapping")
  putIf(p, props.ellipsis, "ellipsis")
  putIf(p, props.a11y, "a11y", encodeA11y)
  return leafNode(id, "rich_text", p)
}

export function richText(
  id: string,
  spans: Record<string, unknown>[],
  opts?: Omit<RichTextProps, "id" | "spans">,
): UINode {
  return RichText({ id, spans, ...opts })
}
