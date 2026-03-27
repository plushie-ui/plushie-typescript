/**
 * Button widget -- clickable button with a text label.
 *
 * @module
 */

import type { Handler, UINode } from "../../types.js";
import { autoId, extractHandlers, leafNodeWithMeta, putIf } from "../build.js";
import type { A11y, Length, Padding, StyleMap } from "../types.js";
import { encodeA11y, encodeLength, encodePadding, encodeStyleMap } from "../types.js";

/** Handler prop names -> wire event types for Button. */
const BUTTON_HANDLERS = { onClick: "click" } as const;

/** Props for the Button widget. */
export interface ButtonProps {
  /** Unique widget identifier. */
  id?: string;
  /** Width of the button. */
  width?: Length;
  /** Height of the button. */
  height?: Length;
  /** Inner padding around the label. */
  padding?: Padding;
  /** When true, clips child content that overflows the button bounds. */
  clip?: boolean;
  /** Style preset name or StyleMap overrides. */
  style?: StyleMap;
  /** When true, the button is non-interactive. */
  disabled?: boolean;
  /** Accessibility properties. */
  a11y?: A11y;
  /** Maximum events per second for this widget's coalescable events. */
  eventRate?: number;
  /** Click handler. Pure function: (state, event) => newState. */
  onClick?: Handler<unknown>;
  /** Button label. In JSX, this comes from children. */
  children?: string;
}

/**
 * Button JSX component.
 *
 * ```tsx
 * <Button id="save" onClick={handleSave}>Save</Button>
 * <Button onClick={handleClick}>Auto-ID</Button>
 * ```
 */
export function Button(props: ButtonProps): UINode {
  const label = props.children ?? "";
  const id = props.id ?? autoId("button");
  const { clean, meta } = extractHandlers(id, props, BUTTON_HANDLERS);
  const p: Record<string, unknown> = { label };
  putIf(p, clean.width, "width", encodeLength);
  putIf(p, clean.height, "height", encodeLength);
  putIf(p, clean.padding, "padding", encodePadding);
  putIf(p, clean.clip, "clip");
  putIf(p, clean.style, "style", encodeStyleMap);
  putIf(p, clean.disabled, "disabled");
  putIf(p, clean.a11y, "a11y", encodeA11y);
  putIf(p, clean.eventRate, "event_rate");
  return leafNodeWithMeta(id, "button", p, meta);
}

/**
 * Button function API.
 *
 * ```ts
 * button("Click me")                                  // auto-id
 * button("save", "Save", { style: "primary" })        // explicit id
 * button("save", "Save", { onClick: handleSave })     // with handler
 * ```
 */
export function button(label: string): UINode;
export function button(label: string, opts: Omit<ButtonProps, "children" | "id">): UINode;
export function button(
  id: string,
  label: string,
  opts?: Omit<ButtonProps, "children" | "id">,
): UINode;
export function button(
  first: string,
  second?: string | Omit<ButtonProps, "children" | "id">,
  third?: Omit<ButtonProps, "children" | "id">,
): UINode {
  if (second === undefined) {
    return Button({ children: first });
  }
  if (typeof second === "string") {
    return Button({ id: first, children: second, ...third });
  }
  return Button({ children: first, ...second });
}
