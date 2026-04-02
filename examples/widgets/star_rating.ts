// Canvas-based star rating widget.
//
// Renders 5 stars as a radio group. Interactive by default (click to
// rate, hover to preview, Tab/arrow to navigate, Enter/Space to select).
// Pass readonly: true for a display-only version.
//
// Events:
// - "select" with { value: n } when the user clicks a star

import type { CanvasShape, PathCommand } from "../../src/canvas/index.js";
import { close, group, lineTo, moveTo, path } from "../../src/canvas/index.js";
import type { Event, EventAction, UINode, WidgetDef } from "../../src/index.js";
import { buildWidget } from "../../src/index.js";
import { Canvas } from "../../src/ui/widgets/canvas.js";

// -- Types --------------------------------------------------------------------

export interface StarRatingProps {
  rating: number;
  readonly?: boolean;
  scale?: number;
  themeProgress?: number;
}

interface StarState {
  hover: number | null;
}

// -- Helpers ------------------------------------------------------------------

function hexByte(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n)))
    .toString(16)
    .padStart(2, "0");
}

function starColor(filled: boolean, preview: boolean, progress: number): string {
  if (preview) return fade(255, 200, 50, 200, 160, 80, progress);
  if (filled) return fade(255, 180, 0, 255, 200, 50, progress);
  return fade(224, 224, 224, 60, 60, 80, progress);
}

function fade(
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number,
  t: number,
): string {
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `#${hexByte(r)}${hexByte(g)}${hexByte(b)}`;
}

function starCommands(outerR: number, innerR: number): PathCommand[] {
  const points: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const angle = Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? outerR : innerR;
    points.push([r * Math.cos(angle), -r * Math.sin(angle)]);
  }
  const [first, ...rest] = points;
  return [moveTo(first![0], first![1]), ...rest.map(([x, y]) => lineTo(x, y)), close()];
}

// -- Event handler ------------------------------------------------------------

function handleEvent(event: Event, state: StarState): readonly [EventAction, StarState] {
  if (event.kind === "widget") {
    // Click on a star -> emit :select with the 1-based star number.
    if (event.type === "canvas_element_click" && event.data?.["element_id"]) {
      const match = String(event.data["element_id"]).match(/^star-(\d+)$/);
      if (match) {
        const n = Number(match[1]) + 1;
        return [{ type: "emit", kind: "select", value: n }, state];
      }
    }

    // Hover enter on a star -> update internal hover state for preview highlight.
    if (event.type === "canvas_element_enter" && event.data?.["element_id"]) {
      const match = String(event.data["element_id"]).match(/^star-(\d+)$/);
      if (match) {
        return [{ type: "update_state" }, { ...state, hover: Number(match[1]) + 1 }];
      }
    }

    // Hover leave -> clear preview highlight.
    if (event.type === "canvas_element_leave") {
      return [{ type: "update_state" }, { ...state, hover: null }];
    }
  }

  // All other events consumed -- StarRating only surfaces "select".
  return [{ type: "consumed" }, state];
}

// -- View ---------------------------------------------------------------------

function view(id: string, props: StarRatingProps, state: StarState): UINode {
  const rating = props.rating ?? 0;
  const isReadonly = props.readonly ?? false;
  const scale = props.scale ?? 1.0;
  const themeProgress = props.themeProgress ?? 0.0;

  const outerR = 13 * scale;
  const innerR = 5 * scale;
  const size = Math.round(30 * scale);
  const gap = Math.round(2 * scale);
  const hover = state.hover;
  const display = hover ?? rating;
  const width = 5 * size + 4 * gap;

  const commands = starCommands(outerR, innerR);
  const shapes: CanvasShape[] = [];

  for (let i = 0; i < 5; i++) {
    const cx = i * (size + gap) + size / 2;
    const cy = size / 2;
    const filled = i < display;
    const preview = !isReadonly && hover !== null && i < hover && i >= rating;

    if (isReadonly) {
      shapes.push(
        group([path(commands, { fill: starColor(filled, false, themeProgress) })], {
          x: cx,
          y: cy,
        }),
      );
    } else {
      shapes.push(
        group(`star-${i}`, [path(commands, { fill: starColor(filled, preview, themeProgress) })], {
          x: cx,
          y: cy,
          on_click: true,
          on_hover: true,
          cursor: "pointer",
          focus_style: { stroke: { color: "#3b82f6", width: 2 * scale } },
          show_focus_ring: false,
          a11y: {
            role: "radio",
            label: `${i + 1} star${i === 0 ? "" : "s"}`,
            selected: rating >= i + 1,
            position_in_set: i + 1,
            size_of_set: 5,
          },
        }),
      );
    }
  }

  if (isReadonly) {
    return Canvas({
      id,
      width,
      height: size,
      alt: `${rating} out of 5 stars`,
      children: shapes as unknown as UINode[],
    });
  }

  return Canvas({
    id,
    width,
    height: size,
    alt: "Star rating",
    role: "radiogroup",
    children: shapes as unknown as UINode[],
  });
}

// -- Widget definition -------------------------------------------------

const starRatingDef: WidgetDef<StarState, StarRatingProps> = {
  init: () => ({ hover: null }),
  view,
  handleEvent,
};

/** Build a star rating widget. */
export function starRating(id: string, props: StarRatingProps): UINode {
  return buildWidget(starRatingDef, id, props);
}
