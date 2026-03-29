// Canvas-based HSV color picker widget.
//
// A hue ring surrounds a saturation/value square. Drag the ring to
// select a hue; drag the square to adjust saturation and value.
// Keyboard accessible: Tab to focus cursors, arrow keys to adjust.
//
// Events:
// - "change" with { hue, saturation, value } on any interaction

import type { CanvasShape, PathCommand } from "../../src/canvas/index.js";
import {
  circle,
  close,
  group,
  linearGradient,
  lineTo,
  moveTo,
  path,
  rect,
  stroke,
} from "../../src/canvas/index.js";
import type { Event, EventAction, UINode, WidgetDef } from "../../src/index.js";
import { buildWidget } from "../../src/index.js";
import { Canvas } from "../../src/ui/widgets/canvas.js";

// -- Types --------------------------------------------------------------------

type ColorPickerProps = Record<string, never>;

type Drag = "none" | "ring" | "square";

interface ColorPickerState {
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

const FINE_STEP = 1;
const COARSE_STEP = 15;
const SV_FINE_STEP = 0.01;
const SV_COARSE_STEP = 0.1;

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

function applySv(state: ColorPickerState, x: number, y: number): ColorPickerState {
  const s = clamp((x - SQ_ORIGIN) / SQ_SIZE, 0.0, 1.0);
  const v = clamp(1.0 - (y - SQ_ORIGIN) / SQ_SIZE, 0.0, 1.0);
  return { ...state, saturation: s, value: v };
}

function hsvData(state: ColorPickerState): { hue: number; saturation: number; value: number } {
  return { hue: state.hue, saturation: state.saturation, value: state.value };
}

// -- Event handler ------------------------------------------------------------

function handleEvent(
  event: Event,
  state: ColorPickerState,
): readonly [EventAction, ColorPickerState] {
  // Canvas press/move/release for drag interaction
  if (event.kind === "canvas") {
    const x = event.x;
    const y = event.y;

    if (event.type === "press" && event.button === "left") {
      const dx = x - CX;
      const dy = y - CY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist >= INNER_R && dist <= OUTER_R) {
        const newState = { ...state, drag: "ring" as const, hue: hueFromPoint(dx, dy) };
        return [{ type: "emit", kind: "change", data: hsvData(newState) }, newState];
      }
      if (inSquare(x, y)) {
        const newState = applySv({ ...state, drag: "square" as const }, x, y);
        return [{ type: "emit", kind: "change", data: hsvData(newState) }, newState];
      }
      return [{ type: "consumed" }, state];
    }

    if (event.type === "move") {
      if (state.drag === "ring") {
        const newState = { ...state, hue: hueFromPoint(x - CX, y - CY) };
        return [{ type: "emit", kind: "change", data: hsvData(newState) }, newState];
      }
      if (state.drag === "square") {
        const newState = applySv(state, x, y);
        return [{ type: "emit", kind: "change", data: hsvData(newState) }, newState];
      }
      return [{ type: "consumed" }, state];
    }

    if (event.type === "release") {
      return [{ type: "update_state" }, { ...state, drag: "none" as const }];
    }
  }

  // Keyboard navigation for hue cursor
  if (event.kind === "widget" && event.type === "canvas_element_key_press") {
    const elementId = event.data?.["element_id"] as string | undefined;
    const key = event.data?.["key"] as string | undefined;
    const mods = (event.data?.["modifiers"] ?? {}) as Record<string, boolean>;

    if (elementId === "hue-cursor" && key) {
      return handleHueKey(key, mods, state);
    }
    if (elementId === "sv-cursor" && key) {
      return handleSvKey(key, mods, state);
    }
  }

  return [{ type: "consumed" }, state];
}

function handleHueKey(
  key: string,
  mods: Record<string, boolean>,
  state: ColorPickerState,
): readonly [EventAction, ColorPickerState] {
  const shift = mods["shift"] ?? false;
  const step = shift ? COARSE_STEP : FINE_STEP;

  let newHue = state.hue;
  if (key === "ArrowRight" || key === "ArrowUp") newHue = fmod(state.hue + step, 360.0);
  else if (key === "ArrowLeft" || key === "ArrowDown")
    newHue = fmod(state.hue - step + 360.0, 360.0);
  else if (key === "PageUp") newHue = fmod(state.hue + COARSE_STEP, 360.0);
  else if (key === "PageDown") newHue = fmod(state.hue - COARSE_STEP + 360.0, 360.0);
  else if (key === "Home") newHue = 0.0;
  else if (key === "End") newHue = 359.0;

  if (newHue !== state.hue) {
    const newState = { ...state, hue: newHue };
    return [{ type: "emit", kind: "change", data: hsvData(newState) }, newState];
  }
  return [{ type: "consumed" }, state];
}

function handleSvKey(
  key: string,
  mods: Record<string, boolean>,
  state: ColorPickerState,
): readonly [EventAction, ColorPickerState] {
  const shift = mods["shift"] ?? false;
  const step = shift ? SV_COARSE_STEP : SV_FINE_STEP;

  let newS = state.saturation;
  let newV = state.value;

  if (key === "ArrowRight") newS = clamp(state.saturation + step, 0.0, 1.0);
  else if (key === "ArrowLeft") newS = clamp(state.saturation - step, 0.0, 1.0);
  else if (key === "ArrowUp") newV = clamp(state.value + step, 0.0, 1.0);
  else if (key === "ArrowDown") newV = clamp(state.value - step, 0.0, 1.0);
  else if (key === "PageUp" && shift) newS = clamp(state.saturation + SV_COARSE_STEP, 0.0, 1.0);
  else if (key === "PageDown" && shift) newS = clamp(state.saturation - SV_COARSE_STEP, 0.0, 1.0);
  else if (key === "PageUp") newV = clamp(state.value + SV_COARSE_STEP, 0.0, 1.0);
  else if (key === "PageDown") newV = clamp(state.value - SV_COARSE_STEP, 0.0, 1.0);
  else if (key === "Home" && shift) newS = 0.0;
  else if (key === "End" && shift) newS = 1.0;
  else if (key === "Home") newV = 1.0;
  else if (key === "End") newV = 0.0;

  if (newS !== state.saturation || newV !== state.value) {
    const newState = { ...state, saturation: newS, value: newV };
    return [{ type: "emit", kind: "change", data: hsvData(newState) }, newState];
  }
  return [{ type: "consumed" }, state];
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

function cursorShapes(state: ColorPickerState): CanvasShape[] {
  const angle = ((state.hue - 90) * Math.PI) / 180;
  const ringX = CX + MID_R * Math.cos(angle);
  const ringY = CY + MID_R * Math.sin(angle);

  const svX = SQ_ORIGIN + state.saturation * SQ_SIZE;
  const svY = SQ_ORIGIN + (1.0 - state.value) * SQ_SIZE;

  const cursorStroke = stroke("#333333", 2);
  const focusStroke = { stroke: { color: "#3b82f6", width: 3 } };

  return [
    group("hue-cursor", [circle(0, 0, CURSOR_R, { fill: "#ffffff", stroke: cursorStroke })], {
      x: ringX,
      y: ringY,
      focusable: true,
      on_click: true,
      focus_style: focusStroke,
      show_focus_ring: false,
      a11y: {
        role: "slider",
        label: "Hue",
        value: `${Math.round(state.hue)} degrees`,
        orientation: "horizontal",
      },
    }),
    group("sv-cursor", [circle(0, 0, CURSOR_R, { fill: "#ffffff", stroke: cursorStroke })], {
      x: svX,
      y: svY,
      focusable: true,
      on_click: true,
      focus_style: focusStroke,
      show_focus_ring: false,
      a11y: {
        role: "slider",
        label: "Saturation and brightness",
        value: `${Math.round(state.saturation * 100)}% saturation, ${Math.round(state.value * 100)}% brightness`,
        orientation: "horizontal",
      },
    }),
  ];
}

// -- Render -------------------------------------------------------------------

function render(id: string, _props: ColorPickerProps, state: ColorPickerState): UINode {
  const allShapes: unknown[] = [
    ...ringShapes(),
    ...svHueShapes(state.hue),
    ...svDarkShapes(),
    ...cursorShapes(state),
  ];

  return Canvas({
    id,
    width: CANVAS_SIZE,
    height: CANVAS_SIZE,
    onPress: true,
    onRelease: true,
    onMove: true,
    arrowMode: "none",
    alt: "HSV color picker",
    description:
      "Drag the ring to select a hue, drag the square to adjust saturation and value. Tab to focus cursors, use arrow keys to adjust.",
    children: allShapes as UINode[],
  });
}

// -- Canvas widget definition -------------------------------------------------

const colorPickerDef: WidgetDef<ColorPickerState, ColorPickerProps> = {
  init: () => ({ hue: 0.0, saturation: 1.0, value: 1.0, drag: "none" }),
  render,
  handleEvent,
};

/** Build a color picker canvas widget. */
export function colorPickerWidget(id: string): UINode {
  return buildWidget(colorPickerDef, id, {});
}
