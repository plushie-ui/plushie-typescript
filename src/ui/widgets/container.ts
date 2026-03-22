/**
 * Container widget -- generic box with styling, background, border, shadow.
 *
 * @module
 */

import type { UINode } from "../../types.js"
import type {
  Length, Padding, Alignment, Color, Gradient, Border, Shadow, StyleMap, A11y,
} from "../types.js"
import {
  encodeLength, encodePadding, encodeAlignment, encodeColor, encodeBackground,
  encodeBorder, encodeShadow, encodeStyleMap, encodeA11y,
} from "../types.js"
import { containerNode, putIf, autoId } from "../build.js"

/** Props for the Container widget. */
export interface ContainerProps {
  id?: string
  padding?: Padding
  width?: Length
  height?: Length
  maxWidth?: number
  maxHeight?: number
  center?: boolean
  clip?: boolean
  alignX?: Alignment
  alignY?: Alignment
  background?: Color | Gradient
  color?: Color
  border?: Border
  shadow?: Shadow
  style?: StyleMap
  a11y?: A11y
  eventRate?: number
  children?: UINode[]
}

/**
 * Container JSX component.
 *
 * ```tsx
 * <Container id="card" padding={16} border={{ width: 1, color: "#ccc" }}>
 *   <Text>Content</Text>
 * </Container>
 * ```
 */
export function Container(props: ContainerProps): UINode {
  const id = props.id ?? autoId("container")
  const children = props.children ?? []
  const p: Record<string, unknown> = {}
  putIf(p, props.padding, "padding", encodePadding)
  putIf(p, props.width, "width", encodeLength)
  putIf(p, props.height, "height", encodeLength)
  putIf(p, props.maxWidth, "max_width")
  putIf(p, props.maxHeight, "max_height")
  putIf(p, props.center, "center")
  putIf(p, props.clip, "clip")
  putIf(p, props.alignX, "align_x", encodeAlignment)
  putIf(p, props.alignY, "align_y", encodeAlignment)
  putIf(p, props.background, "background", encodeBackground)
  putIf(p, props.color, "color", encodeColor)
  putIf(p, props.border, "border", encodeBorder)
  putIf(p, props.shadow, "shadow", encodeShadow)
  putIf(p, props.style, "style", encodeStyleMap)
  putIf(p, props.a11y, "a11y", encodeA11y)
  putIf(p, props.eventRate, "event_rate")
  return containerNode(id, "container", p, Array.isArray(children) ? children : [children])
}

/**
 * Container function API.
 *
 * ```ts
 * container("card", { padding: 16 }, [text("Content")])
 * container({ id: "card", padding: 16 }, [text("Content")])
 * ```
 */
export function container(children: UINode[]): UINode
export function container(opts: Omit<ContainerProps, "children">, children: UINode[]): UINode
export function container(id: string, opts: Omit<ContainerProps, "children" | "id">, children: UINode[]): UINode
export function container(
  first: UINode[] | Omit<ContainerProps, "children"> | string,
  second?: UINode[] | Omit<ContainerProps, "children" | "id">,
  third?: UINode[],
): UINode {
  if (Array.isArray(first)) {
    return Container({ children: first })
  }
  if (typeof first === "string") {
    const opts = (second ?? {}) as Omit<ContainerProps, "children" | "id">
    return Container({ id: first, ...opts, children: third ?? [] })
  }
  return Container({ ...first, children: (second as UINode[] | undefined) ?? [] })
}
