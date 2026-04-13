/**
 * Container widget: generic box with styling, background, border, shadow.
 *
 * @module
 */

import type { UINode } from "../../types.js";
import { autoId, containerNode, putIf } from "../build.js";
import type {
  A11y,
  Alignment,
  Border,
  Color,
  Gradient,
  Length,
  Padding,
  Shadow,
  StyleMap,
} from "../types.js";
import {
  encodeA11y,
  encodeAlignment,
  encodeBackground,
  encodeBorder,
  encodeColor,
  encodeLength,
  encodePadding,
  encodeShadow,
  encodeStyleMap,
} from "../types.js";

/** Props for the Container widget. */
export interface ContainerProps {
  /** Unique widget identifier. */
  id?: string;
  /** Inner padding. */
  padding?: Padding;
  /** Width of the container. */
  width?: Length;
  /** Height of the container. */
  height?: Length;
  /** Maximum width in pixels. */
  maxWidth?: number;
  /** Maximum height in pixels. */
  maxHeight?: number;
  /** When true, centers the child widget both horizontally and vertically. */
  center?: boolean;
  /** When true, clips child content that overflows the container bounds. */
  clip?: boolean;
  /** Horizontal alignment of children. */
  alignX?: Alignment;
  /** Vertical alignment of children. */
  alignY?: Alignment;
  /** Background color or gradient. */
  background?: Color | Gradient;
  /** Text color applied to child text widgets. */
  color?: Color;
  /** Border style (width, color, radius). */
  border?: Border;
  /** Drop shadow configuration. */
  shadow?: Shadow;
  /** Style preset name or StyleMap overrides. */
  style?: StyleMap;
  /** Accessibility properties. */
  a11y?: A11y;
  /** Maximum events per second for this widget's coalescable events. */
  eventRate?: number;
  /** Child widgets rendered inside the container. */
  children?: UINode[];
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
  const id = props.id ?? autoId("container");
  const children = props.children ?? [];
  const p: Record<string, unknown> = {};
  putIf(p, props.padding, "padding", encodePadding);
  putIf(p, props.width, "width", encodeLength);
  putIf(p, props.height, "height", encodeLength);
  putIf(p, props.maxWidth, "max_width");
  putIf(p, props.maxHeight, "max_height");
  putIf(p, props.center, "center");
  putIf(p, props.clip, "clip");
  putIf(p, props.alignX, "align_x", encodeAlignment);
  putIf(p, props.alignY, "align_y", encodeAlignment);
  putIf(p, props.background, "background", encodeBackground);
  putIf(p, props.color, "color", encodeColor);
  putIf(p, props.border, "border", encodeBorder);
  putIf(p, props.shadow, "shadow", encodeShadow);
  putIf(p, props.style, "style", encodeStyleMap);
  putIf(p, props.a11y, "a11y", encodeA11y);
  putIf(p, props.eventRate, "event_rate");
  return containerNode(id, "container", p, Array.isArray(children) ? children : [children]);
}

/**
 * Container function API.
 *
 * ```ts
 * container("card", { padding: 16 }, [text("Content")])
 * container({ id: "card", padding: 16 }, [text("Content")])
 * ```
 */
export function container(children: UINode[]): UINode;
export function container(opts: Omit<ContainerProps, "children">, children: UINode[]): UINode;
export function container(
  id: string,
  opts: Omit<ContainerProps, "children" | "id">,
  children: UINode[],
): UINode;
export function container(
  first: UINode[] | Omit<ContainerProps, "children"> | string,
  second?: UINode[] | Omit<ContainerProps, "children" | "id">,
  third?: UINode[],
): UINode {
  if (Array.isArray(first)) {
    return Container({ children: first });
  }
  if (typeof first === "string") {
    const opts = (second ?? {}) as Omit<ContainerProps, "children" | "id">;
    return Container({ id: first, ...opts, children: third ?? [] });
  }
  return Container({ ...first, children: (second as UINode[] | undefined) ?? [] });
}
