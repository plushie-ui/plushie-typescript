/**
 * Rich text: display text with individually styled spans.
 *
 * @module
 */

import type { UINode } from "../../types.js";
import { applyA11yDefaults, autoId, leafNode, putIf } from "../build.js";
import type { A11y, Border, Color, Font, Length, LineHeight, Padding, Wrapping } from "../types.js";
import {
  encodeA11y,
  encodeBorder,
  encodeColor,
  encodeFont,
  encodeLength,
  encodeLineHeight,
  encodePadding,
} from "../types.js";

/** Highlight backdrop drawn behind a {@link Span}'s text. */
export interface SpanHighlight {
  /** Solid background color painted behind the text. */
  background?: Color;
  /** Border drawn around the highlighted region. */
  border?: Border;
}

/**
 * A typed span for the rich_text widget. Each span carries one
 * segment of text with its own optional styling. Unset fields fall
 * back to the rich_text widget's defaults.
 */
export interface Span {
  /** Required text content. */
  text: string;
  /** Font size in pixels. */
  size?: number;
  /** Font family and weight. */
  font?: Font;
  /** Text color. */
  color?: Color;
  /** Line height for this span. */
  lineHeight?: LineHeight;
  /** Hyperlink URL; clicks emit a `link_click` event with this value. */
  link?: string;
  /** Underline decoration. */
  underline?: boolean;
  /** Strikethrough decoration. */
  strikethrough?: boolean;
  /** Padding around the span's text. */
  padding?: Padding;
  /** Highlight backdrop. */
  highlight?: SpanHighlight;
}

function encodeSpanHighlight(value: SpanHighlight): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (value.background !== undefined) result["background"] = encodeColor(value.background);
  if (value.border !== undefined) result["border"] = encodeBorder(value.border);
  return result;
}

/** Encode a {@link Span} to its wire-format dict. */
export function encodeSpan(span: Span): Record<string, unknown> {
  const result: Record<string, unknown> = { text: span.text };
  if (span.size !== undefined) result["size"] = span.size;
  if (span.font !== undefined) result["font"] = encodeFont(span.font);
  if (span.color !== undefined) result["color"] = encodeColor(span.color);
  if (span.lineHeight !== undefined) result["line_height"] = encodeLineHeight(span.lineHeight);
  if (span.link !== undefined) result["link"] = span.link;
  if (span.underline !== undefined) result["underline"] = span.underline;
  if (span.strikethrough !== undefined) result["strikethrough"] = span.strikethrough;
  if (span.padding !== undefined) result["padding"] = encodePadding(span.padding);
  if (span.highlight !== undefined) result["highlight"] = encodeSpanHighlight(span.highlight);
  return result;
}

/** Props for the RichText widget. */
export interface RichTextProps {
  /** Unique widget identifier. */
  id?: string;
  /** Array of styled spans. */
  spans?: Span[];
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
  if (props.spans !== undefined) {
    p["spans"] = props.spans.map(encodeSpan);
  }
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
  spans: Span[],
  opts?: Omit<RichTextProps, "id" | "spans">,
): UINode {
  return RichText({ id, spans, ...opts });
}
