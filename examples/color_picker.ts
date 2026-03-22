// Color picker with RGB sliders.
// Demonstrates slider widgets, composed view helpers, and container styling.

import { app } from '../src/index.js'
import type { Handler, WidgetEvent } from '../src/index.js'
import { window, column, row, text, slider, container } from '../src/ui/index.js'
import type { UINode } from '../src/index.js'

interface Model {
  r: number
  g: number
  b: number
}

function toHex(n: number): string {
  return Math.round(n).toString(16).padStart(2, "0")
}

function hexColor(m: Model): string {
  return `#${toHex(m.r)}${toHex(m.g)}${toHex(m.b)}`
}

const setR: Handler<Model> = (s, e: WidgetEvent) => ({ ...s, r: Number(e.value) })
const setG: Handler<Model> = (s, e: WidgetEvent) => ({ ...s, g: Number(e.value) })
const setB: Handler<Model> = (s, e: WidgetEvent) => ({ ...s, b: Number(e.value) })

function channelRow(id: string, label: string, value: number, handler: Handler<Model>): UINode {
  return row({ spacing: 12, width: "fill" }, [
    text(`${id}_label`, `${label}:`, { size: 14 }),
    slider(id, value, [0, 255], { step: 1, width: "fill", onSlide: handler }),
    text(`${id}_value`, String(Math.round(value)), { size: 14 }),
  ])
}

export default app<Model>({
  init: { r: 100, g: 149, b: 237 },

  view: (s) =>
    window("main", { title: "Color Picker" }, [
      column({ padding: 20, spacing: 16, width: "fill" }, [
        text("header", "RGB Color Picker", { size: 20 }),
        container("swatch", { width: "fill", height: 64, background: hexColor(s) }),
        text("hex", hexColor(s), { size: 18 }),
        channelRow("r", "R", s.r, setR),
        channelRow("g", "G", s.g, setG),
        channelRow("b", "B", s.b, setB),
      ]),
    ]),
})
