/**
 * TextInput widget: single-line text input field.
 *
 * Always requires an explicit ID (stateful widget; auto-IDs would
 * break cursor position on re-render).
 *
 * @module
 */

import type { Handler, UINode } from "../../types.js";
import { applyA11yDefaults, extractHandlers, leafNodeWithMeta, putIf } from "../build.js";
import type {
  A11y,
  Alignment,
  Color,
  Font,
  Length,
  LineHeight,
  Padding,
  StyleMap,
  ValidationState,
} from "../types.js";
import {
  encodeA11y,
  encodeAlignment,
  encodeColor,
  encodeFont,
  encodeLength,
  encodeLineHeight,
  encodePadding,
  encodeStyleMap,
  encodeValidation,
} from "../types.js";

/** Handler prop names -> wire event types for TextInput. */
const _TEXT_INPUT_HANDLERS = {
  onInput: "input",
  onSubmit: "submit",
  onPaste: "paste",
} as const;

/** Icon specification for text input. */
export interface TextInputIcon {
  codePoint: number;
  size?: number;
  spacing?: number;
  side?: "left" | "right";
  font?: Font;
}

/** Props for the TextInput widget. */
export interface TextInputProps {
  /** Unique widget identifier. Required (stateful widget). */
  id: string;
  /** Current text content of the input. */
  value: string;
  /** Placeholder text shown when the input is empty. */
  placeholder?: string;
  /** Inner padding around the text content. */
  padding?: Padding;
  /** Width of the input field. */
  width?: Length;
  /** Font size in pixels. */
  size?: number;
  /** Font family and weight. */
  font?: Font;
  /** Line height multiplier or fixed height. */
  lineHeight?: LineHeight;
  /** Horizontal text alignment within the input. */
  alignX?: Alignment;
  /** Icon displayed inside the input field. */
  icon?: TextInputIcon;
  /** Submit handler or boolean to enable submit events on Enter. */
  onSubmit?: Handler<unknown> | boolean;
  /** Paste handler or boolean to enable paste events. */
  onPaste?: Handler<unknown> | boolean;
  /** When true, masks input like a password field. */
  secure?: boolean;
  /** Hint to the platform about the expected content type (keyboard layout, autocorrect). */
  inputPurpose?: "normal" | "secure" | "terminal";
  /** Style preset name or StyleMap overrides. */
  style?: StyleMap;
  /** Color of the placeholder text. */
  placeholderColor?: Color;
  /** Color of the text selection highlight. */
  selectionColor?: Color;
  /** When true, the input is non-interactive. */
  disabled?: boolean;
  /** Marks the field as required. Flows into `a11y.required` automatically. */
  required?: boolean;
  /**
   * Form validation state. `"valid"`, `"pending"`, or
   * `["invalid", message]`. Flows into `a11y.invalid` and
   * `a11y.error_message` automatically.
   */
  validation?: ValidationState;
  /** Accessibility properties. */
  a11y?: A11y;
  /** Maximum events per second for this widget's coalescable events. */
  eventRate?: number;
  /** Input change handler. Pure function: (state, event) => newState. */
  onInput?: Handler<unknown>;
}

function encodeIcon(icon: TextInputIcon): Record<string, unknown> {
  const result: Record<string, unknown> = { code_point: icon.codePoint };
  if (icon.size !== undefined) result["size"] = icon.size;
  if (icon.spacing !== undefined) result["spacing"] = icon.spacing;
  if (icon.side !== undefined) result["side"] = icon.side;
  if (icon.font !== undefined) result["font"] = encodeFont(icon.font);
  return result;
}

/**
 * TextInput JSX component.
 *
 * ```tsx
 * <TextInput id="email" value={state.email} placeholder="Email"
 *   onInput={handleEmail} onSubmit={handleSubmit} />
 * ```
 */
export function TextInput(props: TextInputProps): UINode {
  const { id } = props;
  // Extract handler functions, but keep boolean onSubmit/onPaste as wire props
  const handlerProps: Record<string, string> = {};
  if (typeof props.onInput === "function") handlerProps["onInput"] = "input";
  if (typeof props.onSubmit === "function") handlerProps["onSubmit"] = "submit";
  if (typeof props.onPaste === "function") handlerProps["onPaste"] = "paste";
  const { clean, meta } = extractHandlers(id, props, handlerProps);

  const p: Record<string, unknown> = { value: clean.value };
  putIf(p, clean.placeholder, "placeholder");
  putIf(p, clean.padding, "padding", encodePadding);
  putIf(p, clean.width, "width", encodeLength);
  putIf(p, clean.size, "size");
  putIf(p, clean.font, "font", encodeFont);
  putIf(p, clean.lineHeight, "line_height", encodeLineHeight);
  putIf(p, clean.alignX, "align_x", encodeAlignment);
  putIf(p, clean.icon, "icon", encodeIcon);
  // onSubmit/onPaste can be boolean flags (enable the event) or handler functions
  if (typeof props.onSubmit === "boolean") putIf(p, props.onSubmit, "on_submit");
  else if (typeof props.onSubmit === "function") p["on_submit"] = true;
  if (typeof props.onPaste === "boolean") putIf(p, props.onPaste, "on_paste");
  else if (typeof props.onPaste === "function") p["on_paste"] = true;
  putIf(p, clean.secure, "secure");
  putIf(p, clean.inputPurpose, "input_purpose");
  putIf(p, clean.style, "style", encodeStyleMap);
  putIf(p, clean.placeholderColor, "placeholder_color", encodeColor);
  putIf(p, clean.selectionColor, "selection_color", encodeColor);
  putIf(p, clean.disabled, "disabled");
  putIf(p, clean.required, "required");
  putIf(p, clean.validation, "validation", encodeValidation);
  applyA11yDefaults(p, clean.a11y, { role: "text_input" }, encodeA11y);
  putIf(p, clean.eventRate, "event_rate");
  return leafNodeWithMeta(id, "text_input", p, meta);
}

/**
 * TextInput function API. Always requires explicit ID.
 *
 * ```ts
 * textInput("email", state.email, { placeholder: "Email", onInput: handleEmail })
 * ```
 */
export function textInput(
  id: string,
  value: string,
  opts?: Omit<TextInputProps, "id" | "value">,
): UINode {
  return TextInput({ id, value, ...opts });
}
