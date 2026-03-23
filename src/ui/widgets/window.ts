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

import type { UINode } from "../../types.js"
import type { A11y, Theme } from "../types.js"
import { encodeA11y } from "../types.js"
import { containerNode, putIf } from "../build.js"

/** Props for the Window widget. */
export interface WindowProps {
  id?: string
  title?: string
  size?: [number, number]
  width?: number
  height?: number
  position?: [number, number]
  minSize?: [number, number]
  maxSize?: [number, number]
  maximized?: boolean
  fullscreen?: boolean
  visible?: boolean
  resizable?: boolean
  closeable?: boolean
  minimizable?: boolean
  decorations?: boolean
  transparent?: boolean
  blur?: boolean
  level?: "normal" | "always_on_top" | "always_on_bottom"
  exitOnCloseRequest?: boolean
  scaleFactor?: number
  padding?: number
  theme?: Theme
  a11y?: A11y
  children?: UINode[]
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
  const id = props.id ?? "main"
  const children = props.children ?? []
  const p: Record<string, unknown> = {}
  putIf(p, props.title, "title")
  putIf(p, props.size, "size")
  putIf(p, props.width, "width")
  putIf(p, props.height, "height")
  putIf(p, props.position, "position")
  putIf(p, props.minSize, "min_size")
  putIf(p, props.maxSize, "max_size")
  putIf(p, props.maximized, "maximized")
  putIf(p, props.fullscreen, "fullscreen")
  putIf(p, props.visible, "visible")
  putIf(p, props.resizable, "resizable")
  putIf(p, props.closeable, "closeable")
  putIf(p, props.minimizable, "minimizable")
  putIf(p, props.decorations, "decorations")
  putIf(p, props.transparent, "transparent")
  putIf(p, props.blur, "blur")
  putIf(p, props.level, "level")
  putIf(p, props.exitOnCloseRequest, "exit_on_close_request")
  putIf(p, props.scaleFactor, "scale_factor")
  putIf(p, props.padding, "padding")
  putIf(p, props.theme, "theme")
  putIf(p, props.a11y, "a11y", encodeA11y)
  return containerNode(id, "window", p, Array.isArray(children) ? children : [children])
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
  return Window({ id, ...opts, children })
}
