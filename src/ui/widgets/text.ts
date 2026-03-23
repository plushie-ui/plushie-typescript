/**
 * Text widget -- display static text content.
 *
 * @module
 */

import type { UINode } from "../../types.js"
import type {
  Length, Color, Font, Alignment, Wrapping, Shaping,
  LineHeight, StyleMap, A11y,
} from "../types.js"
import {
  encodeLength, encodeColor, encodeFont, encodeAlignment,
  encodeLineHeight, encodeStyleMap, encodeA11y,
} from "../types.js"
import { leafNode, putIf, autoId } from "../build.js"

/** Props for the Text widget. */
export interface TextProps {
  /** Unique widget identifier. */
  id?: string
  /** Font size in pixels. */
  size?: number
  /** Text color. */
  color?: Color
  /** Font family and weight. */
  font?: Font
  /** Width of the text container. */
  width?: Length
  /** Height of the text container. */
  height?: Length
  /** Line height multiplier or fixed height. */
  lineHeight?: LineHeight
  /** Horizontal text alignment. */
  alignX?: Alignment
  /** Vertical text alignment. */
  alignY?: Alignment
  /** Text wrapping mode (e.g., "word", "glyph", "none"). */
  wrapping?: Wrapping
  /** Text overflow mode ("none", "start", "middle", "end"). */
  ellipsis?: string
  /** Text shaping mode ("basic" or "advanced"). */
  shaping?: Shaping
  /** Style preset name or StyleMap overrides. */
  style?: StyleMap
  /** Accessibility properties. */
  a11y?: A11y
  /** Maximum events per second for this widget's coalescable events. */
  eventRate?: number
  /** Content text. In JSX, this comes from children. */
  children?: string
}

/**
 * Text JSX component.
 *
 * ```tsx
 * <Text id="greeting" size={18}>Hello</Text>
 * <Text>Auto-ID text</Text>
 * ```
 */
export function Text(props: TextProps): UINode {
  const content = props.children ?? ""
  const id = props.id ?? autoId("text")
  const p: Record<string, unknown> = { content }
  putIf(p, props.size, "size")
  putIf(p, props.color, "color", encodeColor)
  putIf(p, props.font, "font", encodeFont)
  putIf(p, props.width, "width", encodeLength)
  putIf(p, props.height, "height", encodeLength)
  putIf(p, props.lineHeight, "line_height", encodeLineHeight)
  putIf(p, props.alignX, "align_x", encodeAlignment)
  putIf(p, props.alignY, "align_y", encodeAlignment)
  putIf(p, props.wrapping, "wrapping")
  putIf(p, props.ellipsis, "ellipsis")
  putIf(p, props.shaping, "shaping")
  putIf(p, props.style, "style", encodeStyleMap)
  putIf(p, props.a11y, "a11y", encodeA11y)
  putIf(p, props.eventRate, "event_rate")
  return leafNode(id, "text", p)
}

/**
 * Text function API.
 *
 * ```ts
 * text("Hello")                           // auto-id
 * text("greeting", "Hello", { size: 18 }) // explicit id
 * ```
 */
export function text(content: string): UINode
export function text(content: string, opts: Omit<TextProps, "children" | "id">): UINode
export function text(id: string, content: string, opts?: Omit<TextProps, "children" | "id">): UINode
export function text(
  first: string,
  second?: string | Omit<TextProps, "children" | "id">,
  third?: Omit<TextProps, "children" | "id">,
): UINode {
  // Distinguish: text("content") vs text("id", "content")
  if (second === undefined) {
    return Text({ children: first })
  }
  if (typeof second === "string") {
    return Text({ id: first, children: second, ...third })
  }
  return Text({ children: first, ...second })
}
