/**
 * QR Code -- renders a QR code from a data string.
 *
 * @module
 */

import type { UINode } from "../../types.js"
import type { Color, A11y } from "../types.js"
import { encodeColor, encodeA11y } from "../types.js"
import { leafNode, putIf, autoId } from "../build.js"

/** Props for the QrCode widget. */
export interface QrCodeProps {
  id?: string
  data: string
  cellSize?: number
  errorCorrection?: "low" | "medium" | "quartile" | "high"
  cellColor?: Color
  backgroundColor?: Color
  alt?: string
  description?: string
  a11y?: A11y
}

export function QrCode(props: QrCodeProps): UINode {
  const id = props.id ?? autoId("qr_code")
  const p: Record<string, unknown> = { data: props.data }
  putIf(p, props.cellSize, "cell_size")
  putIf(p, props.errorCorrection, "error_correction")
  putIf(p, props.cellColor, "cell_color", encodeColor)
  putIf(p, props.backgroundColor, "background_color", encodeColor)
  putIf(p, props.alt, "alt")
  putIf(p, props.description, "description")
  putIf(p, props.a11y, "a11y", encodeA11y)
  return leafNode(id, "qr_code", p)
}

export function qrCode(data: string): UINode
export function qrCode(id: string, data: string, opts?: Omit<QrCodeProps, "id" | "data">): UINode
export function qrCode(
  first: string,
  second?: string | Omit<QrCodeProps, "id" | "data">,
  third?: Omit<QrCodeProps, "id" | "data">,
): UINode {
  if (second === undefined) {
    return QrCode({ data: first })
  }
  if (typeof second === "string") {
    return QrCode({ id: first, data: second, ...third })
  }
  return QrCode({ data: first, ...second })
}
