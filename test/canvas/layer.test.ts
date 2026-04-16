import { describe, expect, test } from "vitest";
import { circle, group, layer, line, rect } from "../../src/canvas/index.js";
import { isLayer, layerToWireNode, shapeToWireNode } from "../../src/canvas/layer.js";
import { Canvas } from "../../src/ui/widgets/canvas.js";

describe("layer", () => {
  test("creates a LayerNode with name and shapes", () => {
    const l = layer("bg", [rect(0, 0, 800, 600, { fill: "#f0f0f0" })]);
    expect(l.type).toBe("__layer__");
    expect(l.name).toBe("bg");
    expect(l.children).toHaveLength(1);
  });

  test("isLayer detects layer nodes", () => {
    const l = layer("bg", []);
    expect(isLayer(l)).toBe(true);
    expect(isLayer(rect(0, 0, 100, 100))).toBe(false);
    expect(isLayer(null)).toBe(false);
    expect(isLayer({})).toBe(false);
  });
});

describe("shapeToWireNode", () => {
  test("converts a rect shape to wire UINode", () => {
    const shape = rect(10, 20, 100, 200, { fill: "#ff0000" });
    const node = shapeToWireNode(shape, "bg", 0);

    expect(node.type).toBe("rect");
    expect(node.id).toBe("auto:shape:bg:0");
    expect(node.props).toEqual({ x: 10, y: 20, w: 100, h: 200, fill: "#ff0000" });
    expect(node.children).toEqual([]);
  });

  test("preserves explicit shape id", () => {
    const g = group("my-shape", [circle(0, 0, 10)]);
    const node = shapeToWireNode(g, "layer", 0);
    expect(node.id).toBe("my-shape");
  });

  test("converts group children recursively", () => {
    const g = group([rect(0, 0, 10, 10), circle(5, 5, 3)]);
    const node = shapeToWireNode(g, "layer", 0);

    expect(node.type).toBe("group");
    expect(node.children).toHaveLength(2);
    expect(node.children[0]!.type).toBe("rect");
    expect(node.children[1]!.type).toBe("circle");
  });

  test("omits undefined properties", () => {
    const shape = rect(0, 0, 100, 100);
    const node = shapeToWireNode(shape, "bg", 0);
    expect(node.props).toEqual({ x: 0, y: 0, w: 100, h: 100 });
    expect("fill" in node.props).toBe(false);
  });
});

describe("layerToWireNode", () => {
  test("converts a layer to wire UINode", () => {
    const l = layer("bg", [rect(0, 0, 800, 600, { fill: "#f0f0f0" })]);
    const node = layerToWireNode(l, 0);

    expect(node.id).toBe("auto:layer:bg");
    expect(node.type).toBe("__layer__");
    expect(node.props).toEqual({ name: "bg" });
    expect(node.children).toHaveLength(1);
    expect(node.children[0]!.type).toBe("rect");
  });
});

describe("Canvas with layers and shapes", () => {
  test("auto-wraps bare shapes in default layer", () => {
    const node = Canvas({
      id: "cv",
      children: [rect(0, 0, 100, 100), circle(50, 50, 25)],
    });

    expect(node.type).toBe("canvas");
    expect(node.children).toHaveLength(1);

    const defaultLayer = node.children[0]!;
    expect(defaultLayer.type).toBe("__layer__");
    expect(defaultLayer.id).toBe("auto:layer:default");
    expect(defaultLayer.props).toEqual({ name: "default" });
    expect(defaultLayer.children).toHaveLength(2);
    expect(defaultLayer.children[0]!.type).toBe("rect");
    expect(defaultLayer.children[1]!.type).toBe("circle");
  });

  test("passes Layer nodes through", () => {
    const bgLayer = layer("bg", [rect(0, 0, 800, 600)]);
    const fgLayer = layer("fg", [circle(400, 300, 50)]);

    const node = Canvas({ id: "cv", children: [bgLayer, fgLayer] });

    expect(node.children).toHaveLength(2);
    expect(node.children[0]!.type).toBe("__layer__");
    expect(node.children[0]!.id).toBe("auto:layer:bg");
    expect(node.children[1]!.type).toBe("__layer__");
    expect(node.children[1]!.id).toBe("auto:layer:fg");
  });

  test("mixes layers and bare shapes", () => {
    const bgLayer = layer("bg", [rect(0, 0, 800, 600)]);

    const node = Canvas({
      id: "cv",
      children: [circle(50, 50, 10), bgLayer],
    });

    expect(node.children).toHaveLength(2);
    expect(node.children[0]!.type).toBe("__layer__");
    expect(node.children[0]!.id).toBe("auto:layer:default");
    expect(node.children[1]!.type).toBe("__layer__");
    expect(node.children[1]!.id).toBe("auto:layer:bg");
  });

  test("converts nested group shapes", () => {
    const g = group("my-group", [rect(0, 0, 10, 10), line(0, 0, 10, 10)]);
    const node = Canvas({ id: "cv", children: [g] });

    const defaultLayer = node.children[0]!;
    expect(defaultLayer.children).toHaveLength(1);
    const groupNode = defaultLayer.children[0]!;
    expect(groupNode.type).toBe("group");
    expect(groupNode.id).toBe("my-group");
    expect(groupNode.children).toHaveLength(2);
  });
});
