/**
 * Text editor -- multi-line editable text area.
 *
 * Always requires an explicit ID (stateful widget).
 *
 * @module
 */

import type { Handler, UINode } from "../../types.js";
import { extractHandlers, leafNode, putIf } from "../build.js";
import type { A11y, Color, Font, Length, LineHeight, StyleMap, Wrapping } from "../types.js";
import {
  encodeA11y,
  encodeColor,
  encodeFont,
  encodeLength,
  encodeLineHeight,
  encodeStyleMap,
} from "../types.js";

const TEXT_EDITOR_HANDLERS = {
  onInput: "input",
  onKeyBinding: "key_binding",
} as const;

/** Props for the TextEditor widget. */
export interface TextEditorProps {
  /** Unique widget identifier. Required (stateful widget). */
  id: string;
  /** Initial text content of the editor. Max 10 MiB. */
  content?: string;
  /** Placeholder text shown when the editor is empty. */
  placeholder?: string;
  /** Width of the editor area. */
  width?: Length;
  /** Height of the editor area. */
  height?: Length;
  /** Minimum height in pixels. The editor won't shrink below this. */
  minHeight?: number;
  /** Maximum height in pixels. The editor won't grow beyond this. */
  maxHeight?: number;
  /** Font size in pixels. */
  size?: number;
  /** Font family and weight. */
  font?: Font;
  /** Line height multiplier or fixed height. */
  lineHeight?: LineHeight;
  /** Inner padding in pixels. */
  padding?: number;
  /** Text wrapping mode (e.g., "word", "glyph", "none"). */
  wrapping?: Wrapping;
  /** Custom key binding rules. Matched bindings emit key_binding events. */
  keyBindings?: Record<string, unknown>[];
  /** Style preset name or StyleMap overrides. */
  style?: StyleMap;
  /** Language identifier for syntax highlighting (e.g., "rust", "javascript"). */
  highlightSyntax?: string;
  /** Syntax highlighting color theme name. */
  highlightTheme?: string;
  /** Color of the placeholder text. */
  placeholderColor?: Color;
  /** Color of the text selection highlight. */
  selectionColor?: Color;
  /** Hint to the input method editor about the expected content type. */
  imePurpose?: "normal" | "secure" | "terminal";
  /** Accessibility properties. */
  a11y?: A11y;
  /** Maximum events per second for this widget's coalescable events. */
  eventRate?: number;
  /** Input change handler, called when editor content changes. */
  onInput?: Handler<unknown>;
  /** Key binding handler, called when a custom key binding rule matches. */
  onKeyBinding?: Handler<unknown>;
}

export function TextEditor(props: TextEditorProps): UINode {
  const { id } = props;
  const clean = extractHandlers(id, props, TEXT_EDITOR_HANDLERS);
  const p: Record<string, unknown> = {};
  putIf(p, clean.content, "content");
  putIf(p, clean.placeholder, "placeholder");
  putIf(p, clean.width, "width", encodeLength);
  putIf(p, clean.height, "height", encodeLength);
  putIf(p, clean.minHeight, "min_height");
  putIf(p, clean.maxHeight, "max_height");
  putIf(p, clean.size, "size");
  putIf(p, clean.font, "font", encodeFont);
  putIf(p, clean.lineHeight, "line_height", encodeLineHeight);
  putIf(p, clean.padding, "padding");
  putIf(p, clean.wrapping, "wrapping");
  putIf(p, clean.keyBindings, "key_bindings");
  putIf(p, clean.style, "style", encodeStyleMap);
  putIf(p, clean.highlightSyntax, "highlight_syntax");
  putIf(p, clean.highlightTheme, "highlight_theme");
  putIf(p, clean.placeholderColor, "placeholder_color", encodeColor);
  putIf(p, clean.selectionColor, "selection_color", encodeColor);
  putIf(p, clean.imePurpose, "ime_purpose");
  putIf(p, clean.a11y, "a11y", encodeA11y);
  putIf(p, clean.eventRate, "event_rate");
  return leafNode(id, "text_editor", p);
}

export function textEditor(id: string, opts?: Omit<TextEditorProps, "id">): UINode {
  return TextEditor({ id, ...opts });
}
