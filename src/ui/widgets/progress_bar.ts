/**
 * Progress bar -- displays progress within a range.
 *
 * @module
 */

import type { UINode } from "../../types.js"
import type { Length, StyleMap, A11y } from "../types.js"
import { encodeLength, encodeStyleMap, encodeA11y } from "../types.js"
import { leafNode, putIf, autoId } from "../build.js"

/** Props for the ProgressBar widget. */
export interface ProgressBarProps {
  id?: string
  value: number
  range: [number, number]
  width?: Length
  height?: Length
  style?: StyleMap
  vertical?: boolean
  label?: string
  a11y?: A11y
}

export function ProgressBar(props: ProgressBarProps): UINode {
  const id = props.id ?? autoId("progress_bar")
  const p: Record<string, unknown> = {
    value: props.value,
    range: props.range,
  }
  putIf(p, props.width, "width", encodeLength)
  putIf(p, props.height, "height", encodeLength)
  putIf(p, props.style, "style", encodeStyleMap)
  putIf(p, props.vertical, "vertical")
  putIf(p, props.label, "label")
  putIf(p, props.a11y, "a11y", encodeA11y)
  return leafNode(id, "progress_bar", p)
}

export function progressBar(
  id: string,
  value: number,
  range: [number, number],
  opts?: Omit<ProgressBarProps, "id" | "value" | "range">,
): UINode {
  return ProgressBar({ id, value, range, ...opts })
}
