import { expect, test } from "vitest";
import { normalize } from "../../src/tree/index.js";
import {
  button,
  column,
  container,
  image,
  row,
  scrollable,
  space,
  stack,
  text,
} from "../../src/ui/index.js";

// -- Length examples --

test("layout_length_fill", () => {
  const tree = normalize(column({ id: "main", width: "fill" }, [text("x", "x")]));
  expect(tree.type).toBe("column");
  expect(tree.id).toBe("main");
  expect(tree.props["width"]).toBe("fill");
});

test("layout_length_fixed", () => {
  const tree = normalize(container("sidebar", { width: 250 }, [text("x", "x")]));
  expect(tree.type).toBe("container");
  expect(tree.id).toBe("sidebar");
  expect(tree.props["width"]).toBe(250);
});

test("layout_length_fill_portion", () => {
  const tree = normalize(
    row({}, [
      container("left", { width: { fillPortion: 2 } }, [text("x", "x")]),
      container("right", { width: { fillPortion: 1 } }, [text("y", "y")]),
    ]),
  );
  expect(tree.type).toBe("row");
  const [left, right] = tree.children;
  expect(left!.id).toBe("left");
  expect(right!.id).toBe("right");
  // fillPortion encodes as ["fill_portion", n]
  expect(left!.props["width"]).toEqual({ fill_portion: 2 });
  expect(right!.props["width"]).toEqual({ fill_portion: 1 });
});

test("layout_length_shrink", () => {
  const tree = normalize(button("save", "Save", { width: "shrink" }));
  expect(tree.type).toBe("button");
  expect(tree.props["width"]).toBe("shrink");
});

// -- Padding examples --

test("layout_padding_uniform", () => {
  const tree = normalize(container("box", { padding: 16 }, [text("x", "x")]));
  expect(tree.props["padding"]).toBe(16);
});

test("layout_padding_xy", () => {
  const tree = normalize(container("box", { padding: [8, 16] }, [text("x", "x")]));
  expect(tree.props["padding"]).toEqual([8, 16]);
});

test("layout_padding_per_side", () => {
  const tree = normalize(
    container("box", { padding: { top: 0, right: 16, bottom: 8, left: 16 } }, [text("x", "x")]),
  );
  // Named per-side padding encodes to [top, right, bottom, left] on the wire
  expect(tree.props["padding"]).toEqual([0, 16, 8, 16]);
});

// -- Spacing --

test("layout_spacing", () => {
  const tree = normalize(column({ spacing: 8 }, [text("First"), text("Second"), text("Third")]));
  expect(tree.type).toBe("column");
  expect(tree.props["spacing"]).toBe(8);
  const [a, b, c] = tree.children;
  expect(a!.props["content"]).toBe("First");
  expect(b!.props["content"]).toBe("Second");
  expect(c!.props["content"]).toBe("Third");
});

// -- Alignment --

test("layout_align_x_column", () => {
  const tree = normalize(column({ alignX: "center" }, [text("Centered"), button("ok", "OK")]));
  expect(tree.type).toBe("column");
  expect(tree.props["align_x"]).toBe("center");
  const [textNode, btnNode] = tree.children;
  expect(textNode!.props["content"]).toBe("Centered");
  expect(btnNode!.props["label"]).toBe("OK");
});

test("layout_align_center_container", () => {
  const tree = normalize(
    container("page", { width: "fill", height: "fill", center: true }, [text("Dead center")]),
  );
  expect(tree.type).toBe("container");
  expect(tree.props["width"]).toBe("fill");
  expect(tree.props["height"]).toBe("fill");
  expect(tree.props["center"]).toBe(true);
  const [child] = tree.children;
  expect(child!.props["content"]).toBe("Dead center");
});

// -- Layout containers --

test("layout_column_with_props", () => {
  const tree = normalize(
    column({ id: "main", spacing: 16, padding: 20, width: "fill", alignX: "center" }, [
      text("title", "Title", { size: 24 }),
      text("subtitle", "Subtitle", { size: 14 }),
    ]),
  );
  expect(tree.type).toBe("column");
  expect(tree.id).toBe("main");
  expect(tree.props["spacing"]).toBe(16);
  expect(tree.props["padding"]).toBe(20);
  expect(tree.props["width"]).toBe("fill");
  expect(tree.props["align_x"]).toBe("center");
  const [title, subtitle] = tree.children;
  expect(title!.props["size"]).toBe(24);
  expect(subtitle!.props["size"]).toBe(14);
});

test("layout_row_with_align_y", () => {
  const tree = normalize(
    row({ spacing: 8, alignY: "center" }, [
      button("back", "<"),
      text("Page 1 of 5"),
      button("next", ">"),
    ]),
  );
  expect(tree.type).toBe("row");
  expect(tree.props["spacing"]).toBe(8);
  expect(tree.props["align_y"]).toBe("center");
  const [back, page, next] = tree.children;
  expect(back!.props["label"]).toBe("<");
  expect(page!.props["content"]).toBe("Page 1 of 5");
  expect(next!.props["label"]).toBe(">");
});

test("layout_container_with_style", () => {
  const tree = normalize(
    container("card", { padding: 16, style: "rounded_box", width: "fill" }, [
      column({}, [text("Card title"), text("Card content")]),
    ]),
  );
  expect(tree.type).toBe("container");
  expect(tree.id).toBe("card");
  expect(tree.props["style"]).toBe("rounded_box");
  expect(tree.props["width"]).toBe("fill");
  expect(tree.props["padding"]).toBe(16);
  const [col] = tree.children;
  expect(col!.type).toBe("column");
  const [t, c] = col!.children;
  expect(t!.props["content"]).toBe("Card title");
  expect(c!.props["content"]).toBe("Card content");
});

test("layout_scrollable", () => {
  const tree = normalize(
    scrollable({ id: "list", height: 400, width: "fill" }, [
      column({ spacing: 4 }, [text("item", "Item")]),
    ]),
  );
  expect(tree.type).toBe("scrollable");
  expect(tree.id).toBe("list");
  expect(tree.props["height"]).toBe(400);
  expect(tree.props["width"]).toBe("fill");
  const [col] = tree.children;
  expect(col!.type).toBe("column");
  expect(col!.props["spacing"]).toBe(4);
});

test("layout_stack", () => {
  const tree = normalize(
    stack({}, [
      image("bg", "background.png", { width: "fill", height: "fill" }),
      container("overlay", { width: "fill", height: "fill", center: true }, [
        text("title", "Overlaid text", { size: 48 }),
      ]),
    ]),
  );
  expect(tree.type).toBe("stack");
  const [bg, overlay] = tree.children;
  expect(bg!.type).toBe("image");
  expect(bg!.props["source"]).toBe("background.png");
  expect(bg!.props["width"]).toBe("fill");
  expect(overlay!.type).toBe("container");
  const [textNode] = overlay!.children;
  expect(textNode!.props["content"]).toBe("Overlaid text");
  expect(textNode!.props["size"]).toBe(48);
});

test("layout_space", () => {
  const tree = normalize(row({}, [text("Left"), space({ width: "fill" }), text("Right")]));
  expect(tree.type).toBe("row");
  const [left, gap, right] = tree.children;
  expect(left!.props["content"]).toBe("Left");
  expect(gap!.type).toBe("space");
  expect(gap!.props["width"]).toBe("fill");
  expect(right!.props["content"]).toBe("Right");
});

test("layout_centered_page", () => {
  const tree = normalize(
    container("page", { width: "fill", height: "fill", center: true }, [
      column({ spacing: 16, alignX: "center" }, [
        text("welcome", "Welcome", { size: 32 }),
        button("start", "Get Started"),
      ]),
    ]),
  );
  expect(tree.type).toBe("container");
  expect(tree.id).toBe("page");
  expect(tree.props["width"]).toBe("fill");
  expect(tree.props["height"]).toBe("fill");
  expect(tree.props["center"]).toBe(true);
  const [col] = tree.children;
  expect(col!.props["align_x"]).toBe("center");
  expect(col!.props["spacing"]).toBe(16);
  const [textNode, btn] = col!.children;
  expect(textNode!.props["content"]).toBe("Welcome");
  expect(textNode!.props["size"]).toBe(32);
  expect(btn!.props["label"]).toBe("Get Started");
});
