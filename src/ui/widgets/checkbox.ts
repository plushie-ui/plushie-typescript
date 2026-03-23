/**
 * Checkbox widget -- toggle with a label.
 *
 * @module
 */

import type { UINode, Handler } from "../../types.js"
import type {
  Length, Font, Wrapping, Shaping, LineHeight, StyleMap, A11y,
} from "../types.js"
import {
  encodeLength, encodeFont, encodeLineHeight, encodeStyleMap, encodeA11y,
} from "../types.js"

/**
 * Custom icon for the check mark.
 * `codePoint` is a Unicode code point (required), other fields are optional.
 */
export interface CheckboxIcon {
  codePoint: number
  size?: number
  lineHeight?: number
  font?: Font
  shaping?: Shaping
}
import { leafNode, putIf, autoId, extractHandlers } from "../build.js"

const CHECKBOX_HANDLERS = { onToggle: "toggle" } as const

/** Props for the Checkbox widget. */
export interface CheckboxProps {
  id?: string
  label?: string
  value: boolean
  spacing?: number
  width?: Length
  size?: number
  textSize?: number
  font?: Font
  lineHeight?: LineHeight
  shaping?: Shaping
  wrapping?: Wrapping
  style?: StyleMap
  /** Custom icon for the check mark. */
  icon?: CheckboxIcon
  disabled?: boolean
  a11y?: A11y
  eventRate?: number
  /** Toggle handler. Pure function: (state, event) => newState. */
  onToggle?: Handler<unknown>
  /** Label text. In JSX, this comes from children. */
  children?: string
}

/**
 * Checkbox JSX component.
 *
 * ```tsx
 * <Checkbox id="agree" value={state.agreed} onToggle={handleToggle}>
 *   I agree
 * </Checkbox>
 * ```
 */
export function Checkbox(props: CheckboxProps): UINode {
  const id = props.id ?? autoId("checkbox")
  const label = props.children ?? props.label ?? ""
  const clean = extractHandlers(id, props, CHECKBOX_HANDLERS)
  const p: Record<string, unknown> = { label, checked: props.value }
  putIf(p, clean.spacing, "spacing")
  putIf(p, clean.width, "width", encodeLength)
  putIf(p, clean.size, "size")
  putIf(p, clean.textSize, "text_size")
  putIf(p, clean.font, "font", encodeFont)
  putIf(p, clean.lineHeight, "line_height", encodeLineHeight)
  putIf(p, clean.shaping, "shaping")
  putIf(p, clean.wrapping, "wrapping")
  putIf(p, clean.style, "style", encodeStyleMap)
  if (clean.icon) {
    const icon: Record<string, unknown> = { code_point: clean.icon.codePoint }
    if (clean.icon.size !== undefined) icon["size"] = clean.icon.size
    if (clean.icon.lineHeight !== undefined) icon["line_height"] = clean.icon.lineHeight
    if (clean.icon.font !== undefined) icon["font"] = encodeFont(clean.icon.font)
    if (clean.icon.shaping !== undefined) icon["shaping"] = clean.icon.shaping
    p["icon"] = icon
  }
  putIf(p, clean.disabled, "disabled")
  putIf(p, clean.a11y, "a11y", encodeA11y)
  putIf(p, clean.eventRate, "event_rate")
  return leafNode(id, "checkbox", p)
}

/**
 * Checkbox function API.
 *
 * ```ts
 * checkbox("agree", true, { label: "I agree", onToggle: handler })
 * ```
 */
export function checkbox(
  id: string,
  value: boolean,
  opts?: Omit<CheckboxProps, "id" | "value">,
): UINode {
  return Checkbox({ id, value, ...opts })
}
