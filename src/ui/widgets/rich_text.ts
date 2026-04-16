/**
 * Rich text: display text with individually styled spans.
 *
 * @module
 */

import type { UINode } from "../../types.js";
import { applyA11yDefaults, autoId, leafNode, putIf } from "../build.js";
import type { A11y, Color, Font, Length, LineHeight, Wrapping } from "../types.js";
import { encodeA11y, encodeColor, encodeFont, encodeLength, encodeLineHeight } from "../types.js";

/** Props for the RichText widget. */
export interface RichTextProps {
  /** Unique widget identifier. */
  id?: string;
  /** Array of span objects, each with text content and individual styling. */
  spans?: Record<string, unknown>[];
  /** Default font size in pixels. */
  size?: number;
  /** Default font family and weight. */
  font?: Font;
  /** Default text color. */
  color?: Color;
  /** Width of the rich text container. */
  width?: Length;
  /** Height of the rich text container. */
  height?: Length;
  /** Line height multiplier or fixed height. */
  lineHeight?: LineHeight;
  /** Text wrapping mode. */
  wrapping?: Wrapping;
  /** Text overflow mode ("none", "start", "middle", "end"). */
  ellipsis?: string;
  /** Accessibility properties. */
  a11y?: A11y;
}

export function RichText(props: RichTextProps): UINode {
  const id = props.id ?? autoId("rich_text");
  const p: Record<string, unknown> = {};
  putIf(p, props.spans, "spans");
  putIf(p, props.size, "size");
  putIf(p, props.font, "font", encodeFont);
  putIf(p, props.color, "color", encodeColor);
  putIf(p, props.width, "width", encodeLength);
  putIf(p, props.height, "height", encodeLength);
  putIf(p, props.lineHeight, "line_height", encodeLineHeight);
  putIf(p, props.wrapping, "wrapping");
  putIf(p, props.ellipsis, "ellipsis");
  applyA11yDefaults(p, props.a11y, { role: "label" }, encodeA11y);
  return leafNode(id, "rich_text", p);
}

export function richText(
  id: string,
  spans: Record<string, unknown>[],
  opts?: Omit<RichTextProps, "id" | "spans">,
): UINode {
  return RichText({ id, spans, ...opts });
}
