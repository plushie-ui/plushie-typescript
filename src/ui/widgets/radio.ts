/**
 * Radio button -- one-of-many selection.
 *
 * @module
 */

import type { Handler, UINode } from "../../types.js";
import { autoId, extractHandlers, leafNodeWithMeta, putIf } from "../build.js";
import type { A11y, Font, Length, LineHeight, Shaping, StyleMap, Wrapping } from "../types.js";
import {
  encodeA11y,
  encodeFont,
  encodeLength,
  encodeLineHeight,
  encodeStyleMap,
} from "../types.js";

const RADIO_HANDLERS = { onSelect: "select" } as const;

/** Props for the Radio widget. */
export interface RadioProps {
  /** Unique widget identifier. */
  id?: string;
  /** The value this radio button represents when selected. */
  value: string;
  /** The currently selected value in the radio group. Renders as checked when equal to `value`. */
  selected?: string | null;
  /** Text label displayed next to the radio button. Defaults to `value`. */
  label?: string;
  /** Radio group name. Radios with the same group are mutually exclusive. */
  group?: string;
  /** Spacing between the radio circle and its label in pixels. */
  spacing?: number;
  /** Width of the radio widget (including label). */
  width?: Length;
  /** Size of the radio circle in pixels. */
  size?: number;
  /** Font size for the label text in pixels. */
  textSize?: number;
  /** Font family and weight for the label. */
  font?: Font;
  /** Line height for the label text. */
  lineHeight?: LineHeight;
  /** Text shaping mode ("basic" or "advanced"). */
  shaping?: Shaping;
  /** Text wrapping mode for the label. */
  wrapping?: Wrapping;
  /** Style preset name or StyleMap overrides. */
  style?: StyleMap;
  /** Accessibility properties. */
  a11y?: A11y;
  /** Maximum events per second for this widget's coalescable events. */
  eventRate?: number;
  /** Selection handler, called when this radio button is clicked. */
  onSelect?: Handler<unknown>;
  /** Label text. In JSX, this comes from children. */
  children?: string;
}

export function Radio(props: RadioProps): UINode {
  const id = props.id ?? autoId("radio");
  const label = props.children ?? props.label ?? props.value;
  const { clean, meta } = extractHandlers(id, props, RADIO_HANDLERS);
  const p: Record<string, unknown> = { value: clean.value, selected: clean.selected ?? null };
  putIf(p, label, "label");
  putIf(p, clean.group, "group");
  putIf(p, clean.spacing, "spacing");
  putIf(p, clean.width, "width", encodeLength);
  putIf(p, clean.size, "size");
  putIf(p, clean.textSize, "text_size");
  putIf(p, clean.font, "font", encodeFont);
  putIf(p, clean.lineHeight, "line_height", encodeLineHeight);
  putIf(p, clean.shaping, "shaping");
  putIf(p, clean.wrapping, "wrapping");
  putIf(p, clean.style, "style", encodeStyleMap);
  putIf(p, clean.a11y, "a11y", encodeA11y);
  putIf(p, clean.eventRate, "event_rate");
  return leafNodeWithMeta(id, "radio", p, meta);
}

export function radio(
  id: string,
  value: string,
  selected: string | null,
  opts?: Omit<RadioProps, "id" | "value" | "selected">,
): UINode {
  return Radio({ id, value, selected, ...opts });
}
