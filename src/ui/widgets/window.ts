/**
 * Window widget -- top-level native window node.
 *
 * Window nodes are detected by the runtime for window lifecycle
 * management (open/close/update). They must appear at the root
 * level or as direct children of the root.
 *
 * Window nodes do NOT create scoped ID boundaries.
 *
 * @module
 */

import type { UINode } from "../../types.js";
import { containerNode, putIf } from "../build.js";
import type { A11y, Theme } from "../types.js";
import { encodeA11y } from "../types.js";

/** Props for the Window widget. */
export interface WindowProps {
  /** Unique window identifier. Required. */
  id: string;
  /** Window title bar text. */
  title?: string;
  /** Window dimensions as [width, height] in logical pixels. */
  size?: [number, number];
  /** Window width in logical pixels. Alternative to `size`. */
  width?: number;
  /** Window height in logical pixels. Alternative to `size`. */
  height?: number;
  /** Window position as [x, y] in logical pixels from the top-left corner. */
  position?: [number, number];
  /** Minimum window dimensions as [width, height]. */
  minSize?: [number, number];
  /** Maximum window dimensions as [width, height]. */
  maxSize?: [number, number];
  /** Whether the window starts maximized. */
  maximized?: boolean;
  /** Whether the window starts in fullscreen mode. */
  fullscreen?: boolean;
  /** Whether the window is visible. Set to false to create a hidden window. */
  visible?: boolean;
  /** Whether the user can resize the window by dragging its edges. */
  resizable?: boolean;
  /** Whether the window has a close button. */
  closeable?: boolean;
  /** Whether the window has a minimize button. */
  minimizable?: boolean;
  /** Whether the window has OS decorations (title bar, borders). */
  decorations?: boolean;
  /** Whether the window background is transparent. */
  transparent?: boolean;
  /** Whether to apply a blur effect to the window background. */
  blur?: boolean;
  /** Window stacking level relative to other windows. */
  level?: "normal" | "always_on_top" | "always_on_bottom";
  /** When true, the app exits when this window's close button is pressed. */
  exitOnCloseRequest?: boolean;
  /** DPI scale factor override for this window. */
  scaleFactor?: number;
  /** Uniform padding inside the window in pixels. */
  padding?: number;
  /** Theme applied to this window and its children. */
  theme?: Theme;
  /** Accessibility properties for the window. */
  a11y?: A11y;
  /** Child widgets rendered inside the window. */
  children?: UINode[];
}

/**
 * Window JSX component.
 *
 * ```tsx
 * <Window id="main" title="My App" width={800} height={600}>
 *   <Column padding={16}>
 *     <Text>Hello</Text>
 *   </Column>
 * </Window>
 * ```
 */
export function Window(props: WindowProps): UINode {
  const id = props.id;
  const children = props.children ?? [];
  const p: Record<string, unknown> = {};
  putIf(p, props.title, "title");
  putIf(p, props.size, "size");
  putIf(p, props.width, "width");
  putIf(p, props.height, "height");
  putIf(p, props.position, "position");
  putIf(p, props.minSize, "min_size");
  putIf(p, props.maxSize, "max_size");
  putIf(p, props.maximized, "maximized");
  putIf(p, props.fullscreen, "fullscreen");
  putIf(p, props.visible, "visible");
  putIf(p, props.resizable, "resizable");
  putIf(p, props.closeable, "closeable");
  putIf(p, props.minimizable, "minimizable");
  putIf(p, props.decorations, "decorations");
  putIf(p, props.transparent, "transparent");
  putIf(p, props.blur, "blur");
  putIf(p, props.level, "level");
  putIf(p, props.exitOnCloseRequest, "exit_on_close_request");
  putIf(p, props.scaleFactor, "scale_factor");
  putIf(p, props.padding, "padding");
  putIf(p, props.theme, "theme");
  putIf(p, props.a11y, "a11y", encodeA11y);
  return containerNode(id, "window", p, Array.isArray(children) ? children : [children]);
}

/**
 * Window function API.
 *
 * ```ts
 * window("main", { title: "My App" }, [column([text("Hello")])])
 * ```
 */
export function window(
  id: string,
  opts: Omit<WindowProps, "children" | "id">,
  children: UINode[],
): UINode {
  return Window({ id, ...opts, children });
}
