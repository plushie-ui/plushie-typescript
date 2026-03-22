/**
 * Text editor -- multi-line editable text area.
 *
 * Always requires an explicit ID (stateful widget).
 *
 * @module
 */

import type { UINode, Handler } from "../../types.js"
import type {
  Length, Font, Wrapping, LineHeight, Color, StyleMap, A11y,
} from "../types.js"
import {
  encodeLength, encodeFont, encodeLineHeight, encodeColor,
  encodeStyleMap, encodeA11y,
} from "../types.js"
import { leafNode, putIf, extractHandlers } from "../build.js"

const TEXT_EDITOR_HANDLERS = {
  onInput: "input",
  onKeyBinding: "key_binding",
} as const

/** Props for the TextEditor widget. */
export interface TextEditorProps {
  id: string
  content?: string
  placeholder?: string
  width?: Length
  height?: Length
  minHeight?: number
  maxHeight?: number
  size?: number
  font?: Font
  lineHeight?: LineHeight
  padding?: number
  wrapping?: Wrapping
  keyBindings?: Record<string, unknown>[]
  style?: StyleMap
  highlightSyntax?: string
  highlightTheme?: string
  placeholderColor?: Color
  selectionColor?: Color
  imePurpose?: "normal" | "secure" | "terminal"
  a11y?: A11y
  eventRate?: number
  onInput?: Handler<unknown>
  onKeyBinding?: Handler<unknown>
}

export function TextEditor(props: TextEditorProps): UINode {
  const { id } = props
  const clean = extractHandlers(id, props, TEXT_EDITOR_HANDLERS)
  const p: Record<string, unknown> = {}
  putIf(p, clean.content, "content")
  putIf(p, clean.placeholder, "placeholder")
  putIf(p, clean.width, "width", encodeLength)
  putIf(p, clean.height, "height", encodeLength)
  putIf(p, clean.minHeight, "min_height")
  putIf(p, clean.maxHeight, "max_height")
  putIf(p, clean.size, "size")
  putIf(p, clean.font, "font", encodeFont)
  putIf(p, clean.lineHeight, "line_height", encodeLineHeight)
  putIf(p, clean.padding, "padding")
  putIf(p, clean.wrapping, "wrapping")
  putIf(p, clean.keyBindings, "key_bindings")
  putIf(p, clean.style, "style", encodeStyleMap)
  putIf(p, clean.highlightSyntax, "highlight_syntax")
  putIf(p, clean.highlightTheme, "highlight_theme")
  putIf(p, clean.placeholderColor, "placeholder_color", encodeColor)
  putIf(p, clean.selectionColor, "selection_color", encodeColor)
  putIf(p, clean.imePurpose, "ime_purpose")
  putIf(p, clean.a11y, "a11y", encodeA11y)
  putIf(p, clean.eventRate, "event_rate")
  return leafNode(id, "text_editor", p)
}

export function textEditor(
  id: string,
  opts?: Omit<TextEditorProps, "id">,
): UINode {
  return TextEditor({ id, ...opts })
}
