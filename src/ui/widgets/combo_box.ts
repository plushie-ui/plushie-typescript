/**
 * Combo box -- searchable dropdown with free-form text input.
 *
 * @module
 */

import type { Handler, UINode } from "../../types.js";
import { extractHandlers, leafNodeWithMeta, putIf } from "../build.js";
import type { A11y, Font, Length, LineHeight, Padding, Shaping, StyleMap } from "../types.js";
import {
  encodeA11y,
  encodeFont,
  encodeLength,
  encodeLineHeight,
  encodePadding,
  encodeStyleMap,
} from "../types.js";

const _COMBO_BOX_HANDLERS = {
  onSelect: "select",
  onInput: "input",
  onOptionHovered: "option_hovered",
  onOpen: "open",
  onClose: "close",
} as const;

/** Props for the ComboBox widget. */
export interface ComboBoxProps {
  /** Unique widget identifier. Required (stateful widget). */
  id: string;
  /** List of selectable option strings displayed in the dropdown. */
  options: string[];
  /** Currently selected option, or null if none is selected. */
  selected?: string | null;
  /** Placeholder text shown when the input is empty. */
  placeholder?: string;
  /** Width of the combo box. */
  width?: Length;
  /** Inner padding. */
  padding?: Padding;
  /** Font size in pixels. */
  size?: number;
  /** Font family and weight. */
  font?: Font;
  /** Line height multiplier or fixed height. */
  lineHeight?: LineHeight;
  /** Maximum height of the dropdown menu in pixels before scrolling. */
  menuHeight?: number;
  /** Text shaping mode ("basic" or "advanced"). */
  shaping?: Shaping;
  /** Icon displayed inside the input field. */
  icon?: Record<string, unknown>;
  /** Text overflow mode for the selected value ("none", "start", "middle", "end"). */
  ellipsis?: string;
  /** StyleMap overrides applied to the dropdown menu. */
  menuStyle?: Record<string, unknown>;
  /** Style preset name or StyleMap overrides. */
  style?: StyleMap;
  /** Accessibility properties. */
  a11y?: A11y;
  /** Maximum events per second for this widget's coalescable events. */
  eventRate?: number;
  /** Selection handler, called when the user picks an option from the dropdown. */
  onSelect?: Handler<unknown>;
  /** Input handler, called when the user types in the text field. */
  onInput?: Handler<unknown>;
  /** Handler or boolean to enable events when a dropdown option is hovered. */
  onOptionHovered?: Handler<unknown> | boolean;
  /** Handler or boolean to enable events when the dropdown opens. */
  onOpen?: Handler<unknown> | boolean;
  /** Handler or boolean to enable events when the dropdown closes. */
  onClose?: Handler<unknown> | boolean;
}

export function ComboBox(props: ComboBoxProps): UINode {
  const { id } = props;
  const handlerProps: Record<string, string> = {};
  if (typeof props.onSelect === "function") handlerProps["onSelect"] = "select";
  if (typeof props.onInput === "function") handlerProps["onInput"] = "input";
  if (typeof props.onOptionHovered === "function")
    handlerProps["onOptionHovered"] = "option_hovered";
  if (typeof props.onOpen === "function") handlerProps["onOpen"] = "open";
  if (typeof props.onClose === "function") handlerProps["onClose"] = "close";
  const { clean, meta } = extractHandlers(id, props, handlerProps);

  const p: Record<string, unknown> = { options: clean.options };
  putIf(p, clean.selected, "selected");
  putIf(p, clean.placeholder, "placeholder");
  putIf(p, clean.width, "width", encodeLength);
  putIf(p, clean.padding, "padding", encodePadding);
  putIf(p, clean.size, "size");
  putIf(p, clean.font, "font", encodeFont);
  putIf(p, clean.lineHeight, "line_height", encodeLineHeight);
  putIf(p, clean.menuHeight, "menu_height");
  putIf(p, clean.shaping, "shaping");
  putIf(p, clean.icon, "icon");
  putIf(p, clean.ellipsis, "ellipsis");
  putIf(p, clean.menuStyle, "menu_style");
  putIf(p, clean.style, "style", encodeStyleMap);
  putIf(p, clean.a11y, "a11y", encodeA11y);
  putIf(p, clean.eventRate, "event_rate");
  if (typeof props.onOptionHovered === "boolean")
    putIf(p, props.onOptionHovered, "on_option_hovered");
  else if (typeof props.onOptionHovered === "function") p["on_option_hovered"] = true;
  if (typeof props.onOpen === "boolean") putIf(p, props.onOpen, "on_open");
  else if (typeof props.onOpen === "function") p["on_open"] = true;
  if (typeof props.onClose === "boolean") putIf(p, props.onClose, "on_close");
  else if (typeof props.onClose === "function") p["on_close"] = true;
  return leafNodeWithMeta(id, "combo_box", p, meta);
}

export function comboBox(
  id: string,
  options: string[],
  opts?: Omit<ComboBoxProps, "id" | "options">,
): UINode {
  return ComboBox({ id, options, ...opts });
}
