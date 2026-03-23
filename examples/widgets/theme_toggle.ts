// Animated theme toggle with a face on the thumb.
//
// A toggle switch where the thumb has a drawn face. Light mode shows a
// smiley; dark mode shows the face rotated upside down. The face rotates
// during the transition.
//
// Events: canvas_shape_click with shape_id "switch".
// Drive progress from 0.0 (light) to 1.0 (dark) with a timer.

import type { UINode } from '../../src/index.js'
import { Canvas } from '../../src/ui/widgets/canvas.js'
import {
  rect, circle, path, group, moveTo, lineTo, stroke as makeStroke, interactive,
} from '../../src/canvas/index.js'
import type { CanvasShape, PathCommand } from '../../src/canvas/index.js'

// -- Constants ----------------------------------------------------------------

const TRACK_W = 64
const TRACK_H = 32
const THUMB_R = 13

// -- Helpers ------------------------------------------------------------------

function smoothstep(t: number): number {
  if (t <= 0.0) return 0.0
  if (t >= 1.0) return 1.0
  return t * t * (3 - 2 * t)
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function hexByte(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0")
}

function lerpColor(
  r1: number, g1: number, b1: number,
  r2: number, g2: number, b2: number,
  t: number,
): string {
  const r = Math.round(lerp(r1, r2, t))
  const g = Math.round(lerp(g1, g2, t))
  const b = Math.round(lerp(b1, b2, t))
  return `#${hexByte(r)}${hexByte(g)}${hexByte(b)}`
}

function smilePath(): PathCommand[] {
  return [moveTo(-5, 1), lineTo(-3, 5), lineTo(3, 5), lineTo(5, 1)]
}

// -- Render -------------------------------------------------------------------

export function themeToggle(id: string, progress: number): UINode {
  const eased = smoothstep(progress)
  const thumbX = lerp(TRACK_H / 2, TRACK_W - TRACK_H / 2, eased)
  const trackColor = lerpColor(253, 230, 138, 91, 33, 182, eased)
  const rotation = eased * Math.PI
  const faceColor = progress < 0.5 ? "#665500" : "#4c1d95"

  // Build shapes for the toggle
  const children: CanvasShape[] = [
    // Track
    rect(0, 0, TRACK_W, TRACK_H, { fill: trackColor, radius: TRACK_H / 2 }),
    // Thumb circle
    circle(thumbX, TRACK_H / 2, THUMB_R, { fill: "#ffffff" }),
    // Face elements -- ideally these would use transforms, but we approximate
    // by computing rotated positions for the eyes and mouth
    // Left eye
    circle(
      thumbX + (-3.5 * Math.cos(rotation) - (-3) * Math.sin(rotation)),
      TRACK_H / 2 + (-3.5 * Math.sin(rotation) + (-3) * Math.cos(rotation)),
      2,
      { fill: faceColor },
    ),
    // Right eye
    circle(
      thumbX + (3.5 * Math.cos(rotation) - (-3) * Math.sin(rotation)),
      TRACK_H / 2 + (3.5 * Math.sin(rotation) + (-3) * Math.cos(rotation)),
      2,
      { fill: faceColor },
    ),
    // Mouth (smile path, rotated)
    path(
      smilePath().map((cmd) => {
        if (cmd === "close") return cmd
        if (!Array.isArray(cmd)) return cmd
        const [op, ...args] = cmd as [string, ...number[]]
        if (op === "move_to" || op === "line_to") {
          const x = args[0]!
          const y = args[1]!
          const rx = x * Math.cos(rotation) - y * Math.sin(rotation) + thumbX
          const ry = x * Math.sin(rotation) + y * Math.cos(rotation) + TRACK_H / 2
          return op === "move_to" ? moveTo(rx, ry) : lineTo(rx, ry)
        }
        return cmd
      }),
      { stroke: makeStroke(faceColor, 2) },
    ),
  ]

  const interactiveGroup = interactive(
    group(children),
    {
      id: "switch",
      on_click: true,
      cursor: "pointer",
      hit_rect: { x: 0, y: 0, w: TRACK_W, h: TRACK_H },
      a11y: { role: "switch", label: "Dark humor" },
    },
  )

  return Canvas({
    id,
    width: TRACK_W,
    height: TRACK_H,
    children: [interactiveGroup] as unknown as UINode[],
  })
}
