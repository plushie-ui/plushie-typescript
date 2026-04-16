/**
 * Canvas: drawing surface with shapes organized into layers.
 *
 * Canvas is a container widget. Its children are Layer elements,
 * each holding shape children. Bare shapes are auto-wrapped in a
 * default layer.
 *
 * @module
 */

import type { LayerNode } from "../../canvas/layer.js";
import { isLayer, layerToWireNode, shapeToWireNode } from "../../canvas/layer.js";
import type { CanvasShape } from "../../canvas/shapes.js";
import type { Handler, UINode } from "../../types.js";
import { autoId, containerNodeWithMeta, extractHandlers, putIf } from "../build.js";
import type { A11y, Color, Length } from "../types.js";
import { encodeA11y, encodeColor, encodeLength } from "../types.js";

// Handler event type (matches wire family) and wire prop suffix (matches renderer prop).
const CANVAS_EVENTS: Record<string, { readonly eventType: string; readonly wireProp: string }> = {
  onPress: { eventType: "press", wireProp: "press" },
  onRelease: { eventType: "release", wireProp: "release" },
  onMove: { eventType: "move", wireProp: "move" },
  onScroll: { eventType: "scroll", wireProp: "scroll" },
};

/** Canvas children can be Layer elements, raw shapes, or pre-built UINodes. */
export type CanvasChild = LayerNode | CanvasShape | UINode;

/** Props for the Canvas widget. */
export interface CanvasProps {
  /** Unique widget identifier. */
  id?: string;
  /** Width of the canvas drawing surface. */
  width?: Length;
  /** Height of the canvas drawing surface. */
  height?: Length;
  /** Background color of the canvas. */
  background?: Color;
  /** When true, the canvas emits mouse/touch events (press, release, move, scroll). */
  interactive?: boolean;
  /** Accessible label for the canvas, announced by screen readers. */
  alt?: string;
  /** Extended accessible description of the canvas content. */
  description?: string;
  /** Accessibility properties. */
  a11y?: A11y;
  /** Accessible role for the canvas (e.g. "radiogroup", "toolbar"). */
  role?: string;
  /** Arrow key navigation mode ("wrap", "clamp", "linear", "none"). */
  arrowMode?: string;
  /** Maximum events per second for this widget's coalescable events. */
  eventRate?: number;
  /** Mouse press handler or boolean to enable press events. */
  onPress?: Handler<unknown> | boolean;
  /** Mouse release handler or boolean to enable release events. */
  onRelease?: Handler<unknown> | boolean;
  /** Mouse move handler or boolean to enable move events. */
  onMove?: Handler<unknown> | boolean;
  /** Scroll handler or boolean to enable scroll events. */
  onScroll?: Handler<unknown> | boolean;
  /** Canvas layer children (shapes, groups, layers, transforms). */
  children?: CanvasChild[];
}

const SHAPE_TYPES = new Set(["rect", "circle", "line", "text", "path", "image", "svg", "group"]);

function isCanvasShape(value: unknown): value is CanvasShape {
  if (typeof value !== "object" || value === null) return false;
  const type = (value as Record<string, unknown>)["type"];
  return typeof type === "string" && SHAPE_TYPES.has(type);
}

function isUINode(value: unknown): value is UINode {
  if (typeof value !== "object" || value === null) return false;
  const r = value as Record<string, unknown>;
  return typeof r["type"] === "string" && typeof r["props"] === "object";
}

function convertChildren(children: CanvasChild[]): UINode[] {
  const layers: UINode[] = [];
  const bareShapes: CanvasShape[] = [];

  for (const child of children) {
    if (isLayer(child)) {
      layers.push(layerToWireNode(child, layers.length));
    } else if (isUINode(child)) {
      layers.push(child);
    } else if (isCanvasShape(child)) {
      bareShapes.push(child);
    }
  }

  if (bareShapes.length > 0) {
    const defaultLayerId = "auto:layer:default";
    const shapeNodes = bareShapes.map((shape, i) => shapeToWireNode(shape, "default", i));
    const defaultLayer: UINode = Object.freeze({
      id: defaultLayerId,
      type: "__layer__",
      props: Object.freeze({ name: "default" }),
      children: Object.freeze(shapeNodes),
    });
    layers.unshift(defaultLayer);
  }

  return layers;
}

export function Canvas(props: CanvasProps): UINode {
  const id = props.id ?? autoId("canvas");
  const rawChildren = props.children ?? [];
  const children = convertChildren(rawChildren);
  const handlerProps: Record<string, string> = {};
  for (const [key, spec] of Object.entries(CANVAS_EVENTS)) {
    if (typeof (props as Record<string, unknown>)[key] === "function") {
      handlerProps[key] = spec.eventType;
    }
  }
  const { clean, meta } = extractHandlers(id, props, handlerProps);

  const p: Record<string, unknown> = {};
  putIf(p, clean.width, "width", encodeLength);
  putIf(p, clean.height, "height", encodeLength);
  putIf(p, clean.background, "background", encodeColor);
  putIf(p, clean.interactive, "interactive");
  putIf(p, clean.alt, "alt");
  putIf(p, clean.description, "description");
  putIf(p, clean.a11y, "a11y", encodeA11y);
  putIf(p, clean.role, "role");
  putIf(p, clean.arrowMode, "arrow_mode");
  putIf(p, clean.eventRate, "event_rate");
  for (const [key, spec] of Object.entries(CANVAS_EVENTS)) {
    const val = (props as Record<string, unknown>)[key];
    if (typeof val === "boolean") putIf(p, val, `on_${spec.wireProp}`);
    else if (typeof val === "function") p[`on_${spec.wireProp}`] = true;
  }
  return containerNodeWithMeta(id, "canvas", p, children, meta);
}

export function canvas(opts: Omit<CanvasProps, "children">, children: CanvasChild[]): UINode {
  return Canvas({ ...opts, children });
}
