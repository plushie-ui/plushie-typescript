// Animated theme toggle with a face on the thumb.
//
// A toggle switch where the thumb has a drawn face. Light mode shows a
// smiley; dark mode shows the face rotated upside down. The face rotates
// during the transition. Animation is managed internally.
//
// Events:
// - "toggle" with { value: boolean } when the user clicks the switch

import type { CanvasShape, PathCommand } from "../../src/canvas/index.js";
import {
  circle,
  group,
  lineTo,
  stroke as makeStroke,
  moveTo,
  path,
  rect,
  rotate,
  translate,
} from "../../src/canvas/index.js";
import type { Event, EventAction, Subscription, UINode, WidgetDef } from "../../src/index.js";
import { buildWidget, Subscription as Sub } from "../../src/index.js";
import { Canvas } from "../../src/ui/widgets/canvas.js";

// -- Constants ----------------------------------------------------------------

const TRACK_W = 64;
const TRACK_H = 32;
const THUMB_R = 13;
const RING_PAD = 4;

// -- Types --------------------------------------------------------------------

type ThemeToggleProps = Record<string, never>;

interface ThemeToggleState {
  progress: number;
  target: number;
}

// -- Helpers ------------------------------------------------------------------

function smoothstep(t: number): number {
  if (t <= 0.0) return 0.0;
  if (t >= 1.0) return 1.0;
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function hexByte(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n)))
    .toString(16)
    .padStart(2, "0");
}

function lerpColor(
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number,
  t: number,
): string {
  const r = Math.round(lerp(r1, r2, t));
  const g = Math.round(lerp(g1, g2, t));
  const b = Math.round(lerp(b1, b2, t));
  return `#${hexByte(r)}${hexByte(g)}${hexByte(b)}`;
}

function approach(current: number, target: number, step: number): number {
  if (current < target) return Math.min(current + step, target);
  if (current > target) return Math.max(current - step, target);
  return current;
}

function smilePath(): PathCommand[] {
  return [moveTo(-5, 1), lineTo(-3, 5), lineTo(3, 5), lineTo(5, 1)];
}

// -- Event handler ------------------------------------------------------------

function handleEvent(
  event: Event,
  state: ThemeToggleState,
): readonly [EventAction, ThemeToggleState] {
  // Click on the switch group -> emit :toggle with the new boolean state
  // and flip the animation target so the thumb starts moving.
  if (
    event.kind === "widget" &&
    event.type === "canvas_element_click" &&
    event.data?.["element_id"] === "switch"
  ) {
    const newTarget = state.target === 0.0 ? 1.0 : 0.0;
    return [
      { type: "emit", kind: "toggle", data: newTarget >= 0.5 },
      { ...state, target: newTarget },
    ];
  }

  // Animation tick -> step progress toward the target value.
  if (event.kind === "timer" && event.tag === "animate") {
    const newProgress = approach(state.progress, state.target, 0.06);
    return [{ type: "update_state" }, { ...state, progress: newProgress }];
  }

  // All other events consumed -- ThemeToggle only surfaces "toggle".
  return [{ type: "consumed" }, state];
}

// -- Subscriptions ------------------------------------------------------------

function subscriptions(_props: ThemeToggleProps, state: ThemeToggleState): Subscription[] {
  if (state.progress !== state.target) {
    return [Sub.every(16, "animate")];
  }
  return [];
}

// -- Render -------------------------------------------------------------------

function render(id: string, _props: ThemeToggleProps, state: ThemeToggleState): UINode {
  const progress = state.progress;
  const eased = smoothstep(progress);
  const thumbX = lerp(TRACK_H / 2, TRACK_W - TRACK_H / 2, eased);
  const trackColor = lerpColor(253, 230, 138, 91, 33, 182, eased);
  const rotation = eased * Math.PI;
  const faceColor = progress < 0.5 ? "#665500" : "#4c1d95";

  const shapes: CanvasShape[] = [
    group(
      "switch",
      [
        // Track
        rect(0, 0, TRACK_W, TRACK_H, { fill: trackColor, radius: TRACK_H / 2 }),

        // Thumb circle
        circle(thumbX, TRACK_H / 2, THUMB_R, { fill: "#ffffff" }),

        // Face -- uses a transform group for rotation
        group(
          [
            circle(-3.5, -3, 2, { fill: faceColor }),
            circle(3.5, -3, 2, { fill: faceColor }),
            path(smilePath(), { stroke: makeStroke(faceColor, 2) }),
          ],
          {
            transforms: [translate(thumbX, TRACK_H / 2), rotate(rotation)],
          },
        ),
      ],
      {
        x: RING_PAD,
        y: RING_PAD,
        on_click: true,
        cursor: "pointer",
        hit_rect: { x: 0, y: 0, w: TRACK_W, h: TRACK_H },
        focus_ring_radius: TRACK_H / 2 + RING_PAD,
        a11y: {
          role: "switch",
          label: "Dark humor",
          toggled: progress >= 0.5,
        },
      },
    ),
  ];

  return Canvas({
    id,
    width: TRACK_W + RING_PAD * 2,
    height: TRACK_H + RING_PAD * 2,
    alt: "Theme toggle",
    children: shapes as unknown as UINode[],
  });
}

// -- Canvas widget definition -------------------------------------------------

const themeToggleDef: WidgetDef<ThemeToggleState, ThemeToggleProps> = {
  init: () => ({ progress: 0.0, target: 0.0 }),
  render,
  handleEvent,
  subscriptions,
};

/** Build a theme toggle canvas widget. */
export function themeToggle(id: string): UINode {
  return buildWidget(themeToggleDef, id, {});
}
