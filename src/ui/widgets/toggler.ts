/**
 * Toggler widget -- on/off switch.
 *
 * @module
 */

import type { Handler, UINode } from "../../types.js";
import { autoId, extractHandlers, leafNodeWithMeta, putIf } from "../build.js";
import type {
  A11y,
  Alignment,
  Font,
  Length,
  LineHeight,
  Shaping,
  StyleMap,
  Wrapping,
} from "../types.js";
import {
  encodeA11y,
  encodeAlignment,
  encodeFont,
  encodeLength,
  encodeLineHeight,
  encodeStyleMap,
} from "../types.js";

const TOGGLER_HANDLERS = { onToggle: "toggle" } as const;

/** Props for the Toggler widget. */
export interface TogglerProps {
  /** Unique widget identifier. */
  id?: string;
  /** Whether the toggler is currently on. */
  value: boolean;
  /** Text label displayed next to the toggle switch. */
  label?: string;
  /** Spacing between the toggle switch and its label in pixels. */
  spacing?: number;
  /** Width of the toggler widget (including label). */
  width?: Length;
  /** Size of the toggle switch in pixels. */
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
  /** Horizontal alignment of the label text. */
  textAlignment?: Alignment;
  /** Style preset name or StyleMap overrides. */
  style?: StyleMap;
  /** When true, the toggler is non-interactive. */
  disabled?: boolean;
  /** Accessibility properties. */
  a11y?: A11y;
  /** Maximum events per second for this widget's coalescable events. */
  eventRate?: number;
  /** Toggle handler, called when the switch is flipped. */
  onToggle?: Handler<unknown>;
  /** Label text. In JSX, this comes from children. */
  children?: string;
}

export function Toggler(props: TogglerProps): UINode {
  const id = props.id ?? autoId("toggler");
  const label = props.children ?? props.label;
  const { clean, meta } = extractHandlers(id, props, TOGGLER_HANDLERS);
  const p: Record<string, unknown> = { is_toggled: clean.value };
  putIf(p, label, "label");
  putIf(p, clean.spacing, "spacing");
  putIf(p, clean.width, "width", encodeLength);
  putIf(p, clean.size, "size");
  putIf(p, clean.textSize, "text_size");
  putIf(p, clean.font, "font", encodeFont);
  putIf(p, clean.lineHeight, "line_height", encodeLineHeight);
  putIf(p, clean.shaping, "shaping");
  putIf(p, clean.wrapping, "wrapping");
  putIf(p, clean.textAlignment, "text_alignment", encodeAlignment);
  putIf(p, clean.style, "style", encodeStyleMap);
  putIf(p, clean.disabled, "disabled");
  putIf(p, clean.a11y, "a11y", encodeA11y);
  putIf(p, clean.eventRate, "event_rate");
  return leafNodeWithMeta(id, "toggler", p, meta);
}

export function toggler(
  id: string,
  value: boolean,
  opts?: Omit<TogglerProps, "id" | "value">,
): UINode {
  return Toggler({ id, value, ...opts });
}
