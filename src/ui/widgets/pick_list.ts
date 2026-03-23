/**
 * Pick list -- dropdown selection.
 *
 * @module
 */

import type { Handler, UINode } from "../../types.js";
import { autoId, extractHandlers, leafNode, putIf } from "../build.js";
import type { A11y, Font, Length, LineHeight, Padding, Shaping, StyleMap } from "../types.js";
import {
  encodeA11y,
  encodeFont,
  encodeLength,
  encodeLineHeight,
  encodePadding,
  encodeStyleMap,
} from "../types.js";

const _PICK_LIST_HANDLERS = {
  onSelect: "select",
  onOpen: "open",
  onClose: "close",
} as const;

/** Props for the PickList widget. */
export interface PickListProps {
  /** Unique widget identifier. */
  id?: string;
  /** List of selectable option strings. */
  options: string[];
  /** Currently selected option, or null if none is selected. */
  selected?: string | null;
  /** Text shown when no option is selected. */
  placeholder?: string;
  /** Width of the pick list. */
  width?: Length;
  /** Inner padding. */
  padding?: Padding;
  /** Font size for the displayed text in pixels. */
  textSize?: number;
  /** Font family and weight. */
  font?: Font;
  /** Line height multiplier or fixed height. */
  lineHeight?: LineHeight;
  /** Maximum height of the dropdown menu in pixels before scrolling. */
  menuHeight?: number;
  /** Text shaping mode ("basic" or "advanced"). */
  shaping?: Shaping;
  /** Custom dropdown handle icon configuration. */
  handle?: Record<string, unknown>;
  /** Text overflow mode for the selected value ("none", "start", "middle", "end"). */
  ellipsis?: string;
  /** StyleMap overrides applied to the dropdown menu. */
  menuStyle?: Record<string, unknown>;
  /** Style preset name or StyleMap overrides for the pick list itself. */
  style?: StyleMap;
  /** Accessibility properties. */
  a11y?: A11y;
  /** Maximum events per second for this widget's coalescable events. */
  eventRate?: number;
  /** Selection handler, called when the user picks an option. */
  onSelect?: Handler<unknown>;
  /** Handler or boolean to enable events when the dropdown opens. */
  onOpen?: Handler<unknown> | boolean;
  /** Handler or boolean to enable events when the dropdown closes. */
  onClose?: Handler<unknown> | boolean;
}

export function PickList(props: PickListProps): UINode {
  const id = props.id ?? autoId("pick_list");
  const handlerProps: Record<string, string> = {};
  if (typeof props.onSelect === "function") handlerProps["onSelect"] = "select";
  if (typeof props.onOpen === "function") handlerProps["onOpen"] = "open";
  if (typeof props.onClose === "function") handlerProps["onClose"] = "close";
  const clean = extractHandlers(id, props, handlerProps);

  const p: Record<string, unknown> = { options: clean.options };
  putIf(p, clean.selected, "selected");
  putIf(p, clean.placeholder, "placeholder");
  putIf(p, clean.width, "width", encodeLength);
  putIf(p, clean.padding, "padding", encodePadding);
  putIf(p, clean.textSize, "text_size");
  putIf(p, clean.font, "font", encodeFont);
  putIf(p, clean.lineHeight, "line_height", encodeLineHeight);
  putIf(p, clean.menuHeight, "menu_height");
  putIf(p, clean.shaping, "shaping");
  putIf(p, clean.handle, "handle");
  putIf(p, clean.ellipsis, "ellipsis");
  putIf(p, clean.menuStyle, "menu_style");
  putIf(p, clean.style, "style", encodeStyleMap);
  putIf(p, clean.a11y, "a11y", encodeA11y);
  putIf(p, clean.eventRate, "event_rate");
  if (typeof props.onOpen === "boolean") putIf(p, props.onOpen, "on_open");
  else if (typeof props.onOpen === "function") p["on_open"] = true;
  if (typeof props.onClose === "boolean") putIf(p, props.onClose, "on_close");
  else if (typeof props.onClose === "function") p["on_close"] = true;
  return leafNode(id, "pick_list", p);
}

export function pickList(
  id: string,
  options: string[],
  opts?: Omit<PickListProps, "id" | "options">,
): UINode {
  return PickList({ id, options, ...opts });
}
