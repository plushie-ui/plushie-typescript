/**
 * Markdown display -- renders parsed markdown content.
 *
 * @module
 */

import type { UINode } from "../../types.js"
import type { Length, Color, A11y } from "../types.js"
import { encodeLength, encodeColor, encodeA11y } from "../types.js"
import { leafNode, putIf, autoId } from "../build.js"

/** Props for the Markdown widget. */
export interface MarkdownProps {
  id?: string
  content: string
  textSize?: number
  h1Size?: number
  h2Size?: number
  h3Size?: number
  codeSize?: number
  spacing?: number
  width?: Length
  linkColor?: Color
  codeTheme?: string
  a11y?: A11y
}

export function Markdown(props: MarkdownProps): UINode {
  const id = props.id ?? autoId("markdown")
  const p: Record<string, unknown> = { content: props.content }
  putIf(p, props.textSize, "text_size")
  putIf(p, props.h1Size, "h1_size")
  putIf(p, props.h2Size, "h2_size")
  putIf(p, props.h3Size, "h3_size")
  putIf(p, props.codeSize, "code_size")
  putIf(p, props.spacing, "spacing")
  putIf(p, props.width, "width", encodeLength)
  putIf(p, props.linkColor, "link_color", encodeColor)
  putIf(p, props.codeTheme, "code_theme")
  putIf(p, props.a11y, "a11y", encodeA11y)
  return leafNode(id, "markdown", p)
}

export function markdown(content: string): UINode
export function markdown(content: string, opts: Omit<MarkdownProps, "content" | "id">): UINode
export function markdown(id: string, content: string, opts?: Omit<MarkdownProps, "content" | "id">): UINode
export function markdown(
  first: string,
  second?: string | Omit<MarkdownProps, "content" | "id">,
  third?: Omit<MarkdownProps, "content" | "id">,
): UINode {
  if (second === undefined) {
    return Markdown({ content: first })
  }
  if (typeof second === "string") {
    return Markdown({ id: first, content: second, ...third })
  }
  return Markdown({ content: first, ...second })
}
