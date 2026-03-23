// Canvas-based star rating widget.
//
// Renders 5 stars as a radio group. Interactive by default (click to
// rate, hover to preview, Tab/arrow to navigate, Enter/Space to select).
// Pass readonly: true for a display-only version.
//
// Events:
// - canvas_element_click with element_id "star-0" through "star-4"
// - canvas_element_enter/canvas_element_leave for hover
// - canvas_element_focused with element_id for keyboard focus

import type { CanvasShape, PathCommand } from "../../src/canvas/index.js";
import { close, group, lineTo, moveTo, path } from "../../src/canvas/index.js";
import type { UINode } from "../../src/index.js";
import { Canvas } from "../../src/ui/widgets/canvas.js";

// -- Types --------------------------------------------------------------------

export interface StarRatingOpts {
  hover?: number | null;
  themeProgress?: number;
  readonly?: boolean;
  scale?: number;
}

// -- Helpers ------------------------------------------------------------------

function hexByte(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n)))
    .toString(16)
    .padStart(2, "0");
}

function starColor(filled: boolean, preview: boolean, progress: number): string {
  if (filled && !preview) return "#f59e0b";
  if (preview) return "#fcd34d";
  const r = Math.round(209 + (74 - 209) * progress);
  const g = Math.round(213 + (74 - 213) * progress);
  const b = Math.round(219 + (94 - 219) * progress);
  return `#${hexByte(r)}${hexByte(g)}${hexByte(b)}`;
}

function starCommands(outerR: number, innerR: number): PathCommand[] {
  const points: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const angle = (i * Math.PI) / 5 - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    points.push([r * Math.cos(angle), r * Math.sin(angle)]);
  }
  const [first, ...rest] = points;
  return [moveTo(first![0], first![1]), ...rest.map(([x, y]) => lineTo(x, y)), close()];
}

// -- Render -------------------------------------------------------------------

export function starRating(id: string, rating: number, opts: StarRatingOpts = {}): UINode {
  const hover = opts.hover ?? null;
  const themeProgress = opts.themeProgress ?? 0.0;
  const isReadonly = opts.readonly ?? false;
  const scale = opts.scale ?? 1.0;

  const outerR = 13 * scale;
  const innerR = 5 * scale;
  const size = Math.round(30 * scale);
  const gap = Math.round(2 * scale);
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
      // Structural group (no id, no interaction)
      shapes.push(
        group([path(commands, { fill: starColor(filled, false, themeProgress) })], {
          x: cx,
          y: cy,
        }),
      );
    } else {
      // Interactive group with id -- renderer handles focus_style
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
