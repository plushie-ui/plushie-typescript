/**
 * Markdown display -- renders parsed markdown content.
 *
 * @module
 */

import type { UINode } from "../../types.js";
import { autoId, leafNode, putIf } from "../build.js";
import type { A11y, Color, Length } from "../types.js";
import { encodeA11y, encodeColor, encodeLength } from "../types.js";

/** Props for the Markdown widget. */
export interface MarkdownProps {
  /** Unique widget identifier. */
  id?: string;
  /** Markdown source text to render. Max 1 MiB. */
  content: string;
  /** Base font size for body text in pixels. */
  textSize?: number;
  /** Font size for h1 headings in pixels. */
  h1Size?: number;
  /** Font size for h2 headings in pixels. */
  h2Size?: number;
  /** Font size for h3 headings in pixels. */
  h3Size?: number;
  /** Font size for code blocks and inline code in pixels. */
  codeSize?: number;
  /** Vertical spacing between block elements in pixels. */
  spacing?: number;
  /** Width of the markdown container. */
  width?: Length;
  /** Color of hyperlinks. */
  linkColor?: Color;
  /** Syntax highlighting theme name for fenced code blocks. */
  codeTheme?: string;
  /** Accessibility properties. */
  a11y?: A11y;
}

export function Markdown(props: MarkdownProps): UINode {
  const id = props.id ?? autoId("markdown");
  const p: Record<string, unknown> = { content: props.content };
  putIf(p, props.textSize, "text_size");
  putIf(p, props.h1Size, "h1_size");
  putIf(p, props.h2Size, "h2_size");
  putIf(p, props.h3Size, "h3_size");
  putIf(p, props.codeSize, "code_size");
  putIf(p, props.spacing, "spacing");
  putIf(p, props.width, "width", encodeLength);
  putIf(p, props.linkColor, "link_color", encodeColor);
  putIf(p, props.codeTheme, "code_theme");
  putIf(p, props.a11y, "a11y", encodeA11y);
  return leafNode(id, "markdown", p);
}

export function markdown(content: string): UINode;
export function markdown(content: string, opts: Omit<MarkdownProps, "content" | "id">): UINode;
export function markdown(
  id: string,
  content: string,
  opts?: Omit<MarkdownProps, "content" | "id">,
): UINode;
export function markdown(
  first: string,
  second?: string | Omit<MarkdownProps, "content" | "id">,
  third?: Omit<MarkdownProps, "content" | "id">,
): UINode {
  if (second === undefined) {
    return Markdown({ content: first });
  }
  if (typeof second === "string") {
    return Markdown({ id: first, content: second, ...third });
  }
  return Markdown({ content: first, ...second });
}
