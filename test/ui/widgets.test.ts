import { beforeEach, describe, expect, test } from "vitest";
import { handlersMeta } from "../../src/ui/handlers.js";
import {
  Button,
  button,
  Checkbox,
  Column,
  Container,
  checkbox,
  clearHandlers,
  column,
  container,
  drainHandlers,
  encodeValidation,
  extractHandlers,
  invalid,
  Row,
  registerHandler,
  Slider,
  slider,
  Text,
  TextInput,
  text,
  Window,
} from "../../src/ui/index.js";

function expectNodeHandler(
  node: { meta?: Readonly<Record<string, unknown>> | undefined },
  eventType: string,
) {
  const handlers = handlersMeta(node.meta);
  expect(handlers).toBeDefined();
  expect(handlers?.[eventType]).toEqual(expect.any(Function));
  return handlers?.[eventType];
}

beforeEach(() => clearHandlers());

describe("handler collector", () => {
  test("direct register and drain returns collected handlers", () => {
    const handler = (s: unknown) => s;
    registerHandler("save", "click", handler);
    const handlers = drainHandlers();
    expect(handlers).toEqual([{ widgetId: "save", eventType: "click", handler }]);
    expect(drainHandlers()).toEqual([]);
  });

  test("clear drops collected handlers", () => {
    registerHandler("save", "click", (s: unknown) => s);
    clearHandlers();
    expect(drainHandlers()).toEqual([]);
  });

  test("extractHandlers keeps non-function handler props", () => {
    const { clean, meta } = extractHandlers(
      "save",
      { label: "Save", onClick: false },
      { onClick: "click" },
    );

    expect(clean).toEqual({ label: "Save", onClick: false });
    expect(meta).toBeUndefined();
  });
});

describe("Text", () => {
  test("creates text node with content", () => {
    const node = Text({ children: "Hello" });
    expect(node.type).toBe("text");
    expect(node.props["content"]).toBe("Hello");
    expect(node.children).toHaveLength(0);
  });

  test("auto-generates ID", () => {
    const node = Text({ children: "Hi" });
    expect(node.id).toMatch(/^auto:text:\d+$/);
  });

  test("accepts explicit ID", () => {
    const node = Text({ id: "greeting", children: "Hello" });
    expect(node.id).toBe("greeting");
  });

  test("encodes color prop", () => {
    const node = Text({ children: "Hi", color: "red" });
    expect(node.props["color"]).toBe("#ff0000");
  });

  test("encodes text direction and ellipsis props", () => {
    const node = Text({ children: "Hi", textDirection: "rtl", ellipsis: "middle" });
    expect(node.props["text_direction"]).toBe("rtl");
    expect(node.props["ellipsis"]).toBe("middle");
  });

  test("function API: auto-id", () => {
    const node = text("Hello");
    expect(node.props["content"]).toBe("Hello");
  });

  test("function API: explicit id", () => {
    const node = text("greeting", "Hello", { size: 18 });
    expect(node.id).toBe("greeting");
    expect(node.props["content"]).toBe("Hello");
    expect(node.props["size"]).toBe(18);
  });
});

describe("Button", () => {
  test("creates button with label", () => {
    const node = Button({ children: "Save" });
    expect(node.type).toBe("button");
    expect(node.props["label"]).toBe("Save");
  });

  test("attaches onClick handler metadata", () => {
    const handler = (s: unknown) => s;
    const node = Button({ id: "save", children: "Save", onClick: handler });
    expect(expectNodeHandler(node, "click")).toBe(handler);
    expect(drainHandlers()).toEqual([]);
  });

  test("handler NOT in wire props", () => {
    const node = Button({ id: "save", children: "Save", onClick: (s: unknown) => s });
    expect(node.props["onClick"]).toBeUndefined();
  });

  test("function API: auto-id", () => {
    const node = button("Click me");
    expect(node.props["label"]).toBe("Click me");
  });

  test("function API: explicit id with handler metadata", () => {
    const handler = (s: unknown) => s;
    const node = button("save", "Save", { onClick: handler });
    expect(expectNodeHandler(node, "click")).toBe(handler);
  });

  test("handler construction does not populate stale collector state", () => {
    const handler = (s: unknown) => s;
    expect(() => {
      Button({ id: "save", children: "Save", onClick: handler });
      throw new Error("view failed");
    }).toThrow("view failed");
    expect(drainHandlers()).toEqual([]);
  });
});

describe("Column", () => {
  test("creates column with children", () => {
    const child = text("Hello");
    const node = Column({ children: [child] });
    expect(node.type).toBe("column");
    expect(node.children).toHaveLength(1);
  });

  test("encodes props", () => {
    const node = Column({ spacing: 8, padding: 16, width: "fill" });
    expect(node.props["spacing"]).toBe(8);
    expect(node.props["padding"]).toBe(16);
    expect(node.props["width"]).toBe("fill");
  });

  test("function API: children only", () => {
    const node = column([text("A"), text("B")]);
    expect(node.children).toHaveLength(2);
  });

  test("function API: opts + children", () => {
    const node = column({ spacing: 8 }, [text("A")]);
    expect(node.props["spacing"]).toBe(8);
    expect(node.children).toHaveLength(1);
  });
});

describe("Row", () => {
  test("creates row with children", () => {
    const node = Row({ spacing: 4, children: [button("A"), button("B")] });
    expect(node.type).toBe("row");
    expect(node.children).toHaveLength(2);
    expect(node.props["spacing"]).toBe(4);
  });
});

describe("Container", () => {
  test("creates container with styling", () => {
    const node = Container({
      id: "card",
      padding: 16,
      background: "#ffffff",
      border: { width: 1, color: "#cccccc" },
      children: [text("Content")],
    });
    expect(node.type).toBe("container");
    expect(node.id).toBe("card");
    expect(node.props["background"]).toBe("#ffffff");
    expect(node.props["border"]).toEqual({ width: 1, color: "#cccccc" });
  });

  test("function API: id + opts + children", () => {
    const node = container("card", { padding: 16 }, [text("Hi")]);
    expect(node.id).toBe("card");
  });
});

describe("Window", () => {
  test("creates window node", () => {
    const node = Window({
      id: "main",
      title: "My App",
      width: 800,
      height: 600,
      children: [column([text("Hello")])],
    });
    expect(node.type).toBe("window");
    expect(node.id).toBe("main");
    expect(node.props["title"]).toBe("My App");
    expect(node.props["width"]).toBe(800);
  });

  test("requires an explicit id", () => {
    const node = Window({ id: "main", title: "App" });
    expect(node.id).toBe("main");
  });
});

describe("TextInput", () => {
  test("creates text_input with required props", () => {
    const node = TextInput({ id: "email", value: "test@example.com" });
    expect(node.type).toBe("text_input");
    expect(node.props["value"]).toBe("test@example.com");
  });

  test("attaches onInput handler metadata", () => {
    const handler = (s: unknown) => s;
    const node = TextInput({ id: "email", value: "", onInput: handler });
    expect(expectNodeHandler(node, "input")).toBe(handler);
  });

  test("onSubmit as boolean sets wire prop", () => {
    const node = TextInput({ id: "email", value: "", onSubmit: true });
    expect(node.props["on_submit"]).toBe(true);
  });

  test("onSubmit as handler attaches metadata and sets wire prop", () => {
    const handler = (s: unknown) => s;
    const node = TextInput({ id: "email", value: "", onSubmit: handler });
    expect(node.props["on_submit"]).toBe(true);
    expect(expectNodeHandler(node, "submit")).toBe(handler);
  });

  test("encodes text direction prop", () => {
    const node = TextInput({ id: "email", value: "", textDirection: "rtl" });
    expect(node.props["text_direction"]).toBe("rtl");
  });

  test("onPaste as boolean sets wire prop", () => {
    const node = TextInput({ id: "email", value: "", onPaste: true });
    expect(node.props["on_paste"]).toBe(true);
    expect(drainHandlers()).toHaveLength(0);
  });

  test("onPaste as handler attaches metadata and sets wire prop", () => {
    const handler = (s: unknown) => s;
    const node = TextInput({ id: "email", value: "", onPaste: handler });
    expect(node.props["on_paste"]).toBe(true);
    expect(expectNodeHandler(node, "paste")).toBe(handler);
  });
});

describe("ValidationState", () => {
  test("invalid tuple encodes as renderer map shape", () => {
    expect(encodeValidation(invalid("Required"))).toEqual({
      state: "invalid",
      message: "Required",
    });
  });
});

describe("Checkbox", () => {
  test("creates checkbox with checked state", () => {
    const node = Checkbox({ id: "agree", value: true, label: "I agree" });
    expect(node.type).toBe("checkbox");
    expect(node.props["checked"]).toBe(true);
    expect(node.props["label"]).toBe("I agree");
  });

  test("attaches onToggle handler metadata", () => {
    const handler = (s: unknown) => s;
    const node = checkbox("agree", false, { onToggle: handler });
    expect(expectNodeHandler(node, "toggle")).toBe(handler);
  });
});

describe("Slider", () => {
  test("creates slider with value and range", () => {
    const node = Slider({ id: "vol", value: 50, range: [0, 100] });
    expect(node.type).toBe("slider");
    expect(node.props["value"]).toBe(50);
    expect(node.props["range"]).toEqual([0, 100]);
  });

  test("attaches onSlide and onSlideRelease handler metadata", () => {
    const h1 = (s: unknown) => s;
    const h2 = (s: unknown) => s;
    const node = slider("vol", 50, [0, 100], { onSlide: h1, onSlideRelease: h2 });
    expect(expectNodeHandler(node, "slide")).toBe(h1);
    expect(expectNodeHandler(node, "slide_release")).toBe(h2);
  });
});
