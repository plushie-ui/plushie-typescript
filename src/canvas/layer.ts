/**
 * Canvas Layer: named container that groups shapes for independent caching.
 *
 * Each layer maps to an iced Cache on the Rust side; only changed layers
 * are re-tessellated. The `name` prop identifies the layer for cache
 * invalidation.
 *
 * On the wire this encodes as `type: "__layer__"`.
 *
 * @module
 */

import type { UINode } from "../types.js";
import type { CanvasShape } from "./shapes.js";

export interface LayerNode {
  readonly type: "__layer__";
  readonly name: string;
  readonly children: readonly CanvasShape[];
}

/**
 * Create a canvas Layer that groups shapes by name.
 *
 * @param name - Layer name used for cache invalidation.
 * @param shapes - Shape descriptors in this layer.
 *
 * @example
 * ```ts
 * layer("bg", [
 *   rect(0, 0, 800, 600, { fill: "#f0f0f0" }),
 * ])
 * ```
 */
export function layer(name: string, shapes: readonly CanvasShape[]): LayerNode {
  return Object.freeze({ type: "__layer__", name, children: shapes });
}

/**
 * Check if a value is a LayerNode.
 */
export function isLayer(value: unknown): value is LayerNode {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Record<string, unknown>)["type"] === "__layer__"
  );
}

/**
 * Convert a canvas shape to a wire-format UINode.
 *
 * Shapes are flat objects ({type, x, y, ...}). The wire format
 * requires proper UINode structure ({id, type, props, children}).
 * This function decomposes shapes into wire nodes, separating
 * `type`, `id`, and `children` from the remaining properties
 * which become `props`.
 */
export function shapeToWireNode(shape: CanvasShape, parentId: string, index: number): UINode {
  const raw = shape as unknown as Record<string, unknown>;
  const shapeType = (raw["type"] as string) ?? "unknown";
  const explicitId = raw["id"];
  const shapeId =
    typeof explicitId === "string" && explicitId !== ""
      ? explicitId
      : `auto:shape:${parentId}:${index}`;

  const { children: rawChildren, type: _, id: __, ...rest } = raw;
  const props: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rest)) {
    if (v !== undefined) props[k] = v;
  }

  const children: UINode[] = Array.isArray(rawChildren)
    ? (rawChildren as CanvasShape[]).map((child, i) => shapeToWireNode(child, shapeId, i))
    : [];

  return Object.freeze({
    id: shapeId,
    type: shapeType,
    props: Object.freeze(props),
    children: Object.freeze(children),
  });
}

/**
 * Convert a LayerNode (or raw shapes) to a wire-format UINode tree.
 *
 * Produces a `__layer__` container node with shape children converted
 * to proper wire nodes.
 */
export function layerToWireNode(layerNode: LayerNode, _index: number): UINode {
  const layerId = `auto:layer:${layerNode.name}`;
  const shapeChildren = layerNode.children.map((shape, i) =>
    shapeToWireNode(shape, layerNode.name, i),
  );
  return Object.freeze({
    id: layerId,
    type: "__layer__",
    props: Object.freeze({ name: layerNode.name }),
    children: Object.freeze(shapeChildren),
  });
}
