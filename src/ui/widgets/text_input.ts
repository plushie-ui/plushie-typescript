/**
 * TextInput widget -- single-line text input field.
 *
 * Always requires an explicit ID (stateful widget -- auto-IDs would
 * break cursor position on re-render).
 *
 * @module
 */

import type { UINode, Handler } from "../../types.js"
import type {
  Length, Padding, Font, Alignment, Color, LineHeight,
  StyleMap, A11y,
} from "../types.js"
import {
  encodeLength, encodePadding, encodeFont, encodeAlignment,
  encodeColor, encodeLineHeight, encodeStyleMap, encodeA11y,
} from "../types.js"
import { leafNode, putIf, extractHandlers } from "../build.js"

/** Handler prop names -> wire event types for TextInput. */
const TEXT_INPUT_HANDLERS = {
  onInput: "input",
  onSubmit: "submit",
  onPaste: "paste",
} as const

/** Icon specification for text input. */
export interface TextInputIcon {
  codePoint: number
  size?: number
  spacing?: number
  side?: "left" | "right"
  font?: Font
}

/** Props for the TextInput widget. */
export interface TextInputProps {
  id: string
  value: string
  placeholder?: string
  padding?: Padding
  width?: Length
  size?: number
  font?: Font
  lineHeight?: LineHeight
  alignX?: Alignment
  icon?: TextInputIcon
  onSubmit?: Handler<unknown> | boolean
  onPaste?: Handler<unknown> | boolean
  secure?: boolean
  imePurpose?: "normal" | "secure" | "terminal"
  style?: StyleMap
  placeholderColor?: Color
  selectionColor?: Color
  disabled?: boolean
  a11y?: A11y
  eventRate?: number
  /** Input change handler. Pure function: (state, event) => newState. */
  onInput?: Handler<unknown>
}

function encodeIcon(icon: TextInputIcon): Record<string, unknown> {
  const result: Record<string, unknown> = { code_point: icon.codePoint }
  if (icon.size !== undefined) result["size"] = icon.size
  if (icon.spacing !== undefined) result["spacing"] = icon.spacing
  if (icon.side !== undefined) result["side"] = icon.side
  if (icon.font !== undefined) result["font"] = encodeFont(icon.font)
  return result
}

/**
 * TextInput JSX component.
 *
 * ```tsx
 * <TextInput id="email" value={state.email} placeholder="Email"
 *   onInput={handleEmail} onSubmit={handleSubmit} />
 * ```
 */
export function TextInput(props: TextInputProps): UINode {
  const { id } = props
  // Extract handler functions, but keep boolean onSubmit/onPaste as wire props
  const handlerProps: Record<string, string> = {}
  if (typeof props.onInput === "function") handlerProps["onInput"] = "input"
  if (typeof props.onSubmit === "function") handlerProps["onSubmit"] = "submit"
  if (typeof props.onPaste === "function") handlerProps["onPaste"] = "paste"
  const clean = extractHandlers(id, props, handlerProps)

  const p: Record<string, unknown> = { value: clean.value }
  putIf(p, clean.placeholder, "placeholder")
  putIf(p, clean.padding, "padding", encodePadding)
  putIf(p, clean.width, "width", encodeLength)
  putIf(p, clean.size, "size")
  putIf(p, clean.font, "font", encodeFont)
  putIf(p, clean.lineHeight, "line_height", encodeLineHeight)
  putIf(p, clean.alignX, "align_x", encodeAlignment)
  putIf(p, clean.icon, "icon", encodeIcon)
  // onSubmit/onPaste can be boolean flags (enable the event) or handler functions
  if (typeof props.onSubmit === "boolean") putIf(p, props.onSubmit, "on_submit")
  else if (typeof props.onSubmit === "function") p["on_submit"] = true
  if (typeof props.onPaste === "boolean") putIf(p, props.onPaste, "on_paste")
  else if (typeof props.onPaste === "function") p["on_paste"] = true
  putIf(p, clean.secure, "secure")
  putIf(p, clean.imePurpose, "ime_purpose")
  putIf(p, clean.style, "style", encodeStyleMap)
  putIf(p, clean.placeholderColor, "placeholder_color", encodeColor)
  putIf(p, clean.selectionColor, "selection_color", encodeColor)
  putIf(p, clean.disabled, "disabled")
  putIf(p, clean.a11y, "a11y", encodeA11y)
  putIf(p, clean.eventRate, "event_rate")
  return leafNode(id, "text_input", p)
}

/**
 * TextInput function API. Always requires explicit ID.
 *
 * ```ts
 * textInput("email", state.email, { placeholder: "Email", onInput: handleEmail })
 * ```
 */
export function textInput(
  id: string,
  value: string,
  opts?: Omit<TextInputProps, "id" | "value">,
): UINode {
  return TextInput({ id, value, ...opts })
}
