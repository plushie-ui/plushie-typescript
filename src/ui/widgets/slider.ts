/**
 * Slider widget -- horizontal range input.
 *
 * @module
 */

import type { Handler, UINode } from "../../types.js";
import { autoId, extractHandlers, leafNodeWithMeta, putIf } from "../build.js";
import type { A11y, Color, Length, StyleMap } from "../types.js";
import { encodeA11y, encodeColor, encodeLength, encodeStyleMap } from "../types.js";

const SLIDER_HANDLERS = {
  onSlide: "slide",
  onSlideRelease: "slide_release",
} as const;

/** Props for the Slider widget. */
export interface SliderProps {
  /** Unique widget identifier. */
  id?: string;
  /** Current slider value. */
  value: number;
  /** Min and max values as [min, max]. */
  range: [number, number];
  /** Increment step when dragging. */
  step?: number;
  /** Larger step when holding Shift while dragging. */
  shiftStep?: number;
  /** Value to reset to on double-click. */
  default?: number;
  /** Width of the slider track. */
  width?: Length;
  /** Height of the slider in pixels. */
  height?: number;
  /** Whether the handle is circular (vs square). */
  circularHandle?: boolean;
  /** Custom handle radius in pixels. */
  handleRadius?: number;
  /** Color of the track rail. */
  railColor?: Color;
  /** Thickness of the track rail in pixels. */
  railWidth?: number;
  /** Style preset name or StyleMap overrides. */
  style?: StyleMap;
  /** Accessible label announced by screen readers (e.g., "Volume"). */
  label?: string;
  /** Accessibility properties. */
  a11y?: A11y;
  /** Maximum events per second for this widget's coalescable events. */
  eventRate?: number;
  /** Called continuously while sliding. */
  onSlide?: Handler<unknown>;
  /** Called when the slider is released. */
  onSlideRelease?: Handler<unknown>;
}

/**
 * Slider JSX component.
 *
 * ```tsx
 * <Slider id="volume" value={state.volume} range={[0, 100]}
 *   step={1} onSlide={handleVolume} label="Volume" />
 * ```
 */
export function Slider(props: SliderProps): UINode {
  const id = props.id ?? autoId("slider");
  const { clean, meta } = extractHandlers(id, props, SLIDER_HANDLERS);
  const p: Record<string, unknown> = {
    value: clean.value,
    range: clean.range,
  };
  putIf(p, clean.step, "step");
  putIf(p, clean.shiftStep, "shift_step");
  putIf(p, clean.default, "default");
  putIf(p, clean.width, "width", encodeLength);
  putIf(p, clean.height, "height");
  putIf(p, clean.circularHandle, "circular_handle");
  putIf(p, clean.handleRadius, "handle_radius");
  putIf(p, clean.railColor, "rail_color", encodeColor);
  putIf(p, clean.railWidth, "rail_width");
  putIf(p, clean.style, "style", encodeStyleMap);
  putIf(p, clean.label, "label");
  putIf(p, clean.a11y, "a11y", encodeA11y);
  putIf(p, clean.eventRate, "event_rate");
  return leafNodeWithMeta(id, "slider", p, meta);
}

/**
 * Slider function API.
 *
 * ```ts
 * slider("volume", 50, [0, 100], { step: 1, onSlide: handler })
 * ```
 */
export function slider(
  id: string,
  value: number,
  range: [number, number],
  opts?: Omit<SliderProps, "id" | "value" | "range">,
): UINode {
  return Slider({ id, value, range, ...opts });
}
