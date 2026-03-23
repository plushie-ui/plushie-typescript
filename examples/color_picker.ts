// HSV color picker using a custom canvas widget.
//
// A hue ring surrounds a saturation/value square. Drag the ring to select
// a hue; drag the square to adjust saturation and value. The selected color
// is displayed as a swatch and hex string below the canvas.
//
// Demonstrates:
// - Canvas widget with geometric shapes (paths, rects, circles)
// - Canvas press/move/release events for drag interaction
// - Linear gradients for the SV square
// - View helper extraction (ring, SV layers, cursors)
// - HSV-to-hex color conversion

import type { CanvasShape, PathCommand } from "../src/canvas/index.js";
import {
  circle,
  close,
  linearGradient,
  lineTo,
  moveTo,
  path,
  rect,
  stroke,
} from "../src/canvas/index.js";
import type { Event, UINode } from "../src/index.js";
import { app, isCanvas } from "../src/index.js";
import { column, container, row, text, window } from "../src/ui/index.js";
import { Canvas } from "../src/ui/widgets/canvas.js";

// -- Types --------------------------------------------------------------------

type Drag = "none" | "ring" | "square";

interface Model {
  hue: number;
  saturation: number;
  value: number;
  drag: Drag;
}

// -- Geometry constants -------------------------------------------------------

const CANVAS_SIZE = 400;
const CX = CANVAS_SIZE / 2;
const CY = CANVAS_SIZE / 2;
const OUTER_R = 190;
const INNER_R = 150;
const MID_R = (INNER_R + OUTER_R) / 2;
const SQ_ORIGIN = 100;
const SQ_SIZE = 200;
const SEGMENTS = 72;
const CURSOR_R = 7;

// -- Color conversion ---------------------------------------------------------

function fmod(a: number, b: number): number {
  return a - b * Math.floor(a / b);
}

function hsvToHex(h: number, s: number, v: number): string {
  let hue = fmod(h, 360.0);
  if (hue < 0) hue += 360.0;

  const c = v * s;
  const hSector = hue / 60.0;
  const x = c * (1.0 - Math.abs(fmod(hSector, 2.0) - 1.0));
  const m = v - c;

  let r1: number, g1: number, b1: number;
  if (hSector < 1) {
    r1 = c;
    g1 = x;
    b1 = 0;
  } else if (hSector < 2) {
    r1 = x;
    g1 = c;
    b1 = 0;
  } else if (hSector < 3) {
    r1 = 0;
    g1 = c;
    b1 = x;
  } else if (hSector < 4) {
    r1 = 0;
    g1 = x;
    b1 = c;
  } else if (hSector < 5) {
    r1 = x;
    g1 = 0;
    b1 = c;
  } else {
    r1 = c;
    g1 = 0;
    b1 = x;
  }

  const r = Math.round((r1 + m) * 255);
  const g = Math.round((g1 + m) * 255);
  const b = Math.round((b1 + m) * 255);

  return `#${hexByte(r)}${hexByte(g)}${hexByte(b)}`;
}

function hexByte(n: number): string {
  return Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0");
}

// -- Canvas shapes ------------------------------------------------------------

function ringShapes(): CanvasShape[] {
  const degPerSegment = 360 / SEGMENTS;
  const shapes: CanvasShape[] = [];

  for (let i = 0; i < SEGMENTS; i++) {
    const hueDeg = i * degPerSegment;
    const a1 = ((hueDeg - 90) * Math.PI) / 180;
    const a2 = ((hueDeg + degPerSegment - 90) * Math.PI) / 180;

    const commands: PathCommand[] = [
      moveTo(CX + INNER_R * Math.cos(a1), CY + INNER_R * Math.sin(a1)),
      lineTo(CX + OUTER_R * Math.cos(a1), CY + OUTER_R * Math.sin(a1)),
      lineTo(CX + OUTER_R * Math.cos(a2), CY + OUTER_R * Math.sin(a2)),
      lineTo(CX + INNER_R * Math.cos(a2), CY + INNER_R * Math.sin(a2)),
      close(),
    ];
    shapes.push(path(commands, { fill: hsvToHex(hueDeg, 1.0, 1.0) }));
  }
  return shapes;
}

function svHueShapes(hue: number): CanvasShape[] {
  const hueColor = hsvToHex(hue, 1.0, 1.0);
  return [
    rect(SQ_ORIGIN, SQ_ORIGIN, SQ_SIZE, SQ_SIZE, {
      fill: linearGradient(
        [SQ_ORIGIN, SQ_ORIGIN],
        [SQ_ORIGIN + SQ_SIZE, SQ_ORIGIN],
        [
          { offset: 0.0, color: "#ffffff" },
          { offset: 1.0, color: hueColor },
        ],
      ),
    }),
  ];
}

function svDarkShapes(): CanvasShape[] {
  return [
    rect(SQ_ORIGIN, SQ_ORIGIN, SQ_SIZE, SQ_SIZE, {
      fill: linearGradient(
        [SQ_ORIGIN, SQ_ORIGIN],
        [SQ_ORIGIN, SQ_ORIGIN + SQ_SIZE],
        [
          { offset: 0.0, color: "#00000000" },
          { offset: 1.0, color: "#000000ff" },
        ],
      ),
    }),
  ];
}

function cursorShapes(hue: number, saturation: number, value: number): CanvasShape[] {
  const angle = ((hue - 90) * Math.PI) / 180;
  const ringX = CX + MID_R * Math.cos(angle);
  const ringY = CY + MID_R * Math.sin(angle);

  const svX = SQ_ORIGIN + saturation * SQ_SIZE;
  const svY = SQ_ORIGIN + (1.0 - value) * SQ_SIZE;

  const cursorStroke = stroke("#333333", 2);

  return [
    circle(ringX, ringY, CURSOR_R, { fill: "#ffffff", stroke: cursorStroke }),
    circle(svX, svY, CURSOR_R, { fill: "#ffffff", stroke: cursorStroke }),
  ];
}

// -- Hit testing --------------------------------------------------------------

function inSquare(x: number, y: number): boolean {
  return x >= SQ_ORIGIN && x <= SQ_ORIGIN + SQ_SIZE && y >= SQ_ORIGIN && y <= SQ_ORIGIN + SQ_SIZE;
}

function hueFromPoint(dx: number, dy: number): number {
  const angle = Math.atan2(dy, dx);
  let hue = angle + Math.PI / 2;
  if (hue < 0) hue += 2 * Math.PI;
  return (hue * 180.0) / Math.PI;
}

function clamp(val: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, val));
}

function applySv(model: Model, x: number, y: number): Model {
  const s = clamp((x - SQ_ORIGIN) / SQ_SIZE, 0.0, 1.0);
  const v = clamp(1.0 - (y - SQ_ORIGIN) / SQ_SIZE, 0.0, 1.0);
  return { ...model, saturation: s, value: v };
}

// -- Display helpers ----------------------------------------------------------

function hsvLabel(model: Model): string {
  const h = Math.round(model.hue);
  const s = Math.round(model.saturation * 100);
  const v = Math.round(model.value * 100);
  return `H: ${h}  S: ${s}%  V: ${v}%`;
}

// -- View helper: picker canvas -----------------------------------------------

function pickerCanvas(model: Model): UINode {
  const allShapes: unknown[] = [
    ...ringShapes(),
    ...svHueShapes(model.hue),
    ...svDarkShapes(),
    ...cursorShapes(model.hue, model.saturation, model.value),
  ];

  return Canvas({
    id: "picker",
    width: CANVAS_SIZE,
    height: CANVAS_SIZE,
    onPress: true,
    onRelease: true,
    onMove: true,
    children: allShapes as UINode[],
  });
}

// -- App ----------------------------------------------------------------------

export default app<Model>({
  // -- Init -------------------------------------------------------------------

  init: { hue: 0.0, saturation: 1.0, value: 1.0, drag: "none" },

  // -- Update -----------------------------------------------------------------

  update(state, event: Event) {
    if (isCanvas(event) && event.id === "picker") {
      const x = (event as unknown as { x: number }).x;
      const y = (event as unknown as { y: number }).y;

      if (event.type === "press") {
        const dx = x - CX;
        const dy = y - CY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist >= INNER_R && dist <= OUTER_R) {
          return { ...state, drag: "ring" as const, hue: hueFromPoint(dx, dy) };
        }
        if (inSquare(x, y)) {
          return applySv({ ...state, drag: "square" as const }, x, y);
        }
        return state;
      }

      if (event.type === "move") {
        if (state.drag === "ring") {
          return { ...state, hue: hueFromPoint(x - CX, y - CY) };
        }
        if (state.drag === "square") {
          return applySv(state, x, y);
        }
        return state;
      }

      if (event.type === "release") {
        return { ...state, drag: "none" as const };
      }
    }
    return state;
  },

  // -- View -------------------------------------------------------------------

  view: (s) => {
    const hex = hsvToHex(s.hue, s.saturation, s.value);

    return window("color_picker", { title: "Color Picker" }, [
      column({ padding: 20, spacing: 16, alignX: "center" }, [
        pickerCanvas(s),

        row({ spacing: 16, alignY: "center" }, [
          container(
            "swatch",
            {
              width: 48,
              height: 48,
              background: hex,
              border: { width: 1, color: "#cccccc", radius: 4 },
            },
            [],
          ),

          column({ spacing: 4 }, [
            text("hex_display", hex, { size: 18 }),
            text("hsv_display", hsvLabel(s)),
          ]),
        ]),
      ]),
    ]);
  },
});
