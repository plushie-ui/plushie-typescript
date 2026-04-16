import { beforeEach, describe, expect, test } from "vitest";
import {
  Canvas,
  ComboBox,
  canvas,
  clearHandlers,
  comboBox,
  drainHandlers,
  Floating,
  floating,
  Grid,
  grid,
  Image,
  image,
  KeyedColumn,
  keyedColumn,
  Markdown,
  markdown,
  Overlay,
  overlay,
  PaneGrid,
  PickList,
  Pin,
  PointerArea,
  ProgressBar,
  paneGrid,
  pickList,
  pin,
  pointerArea,
  progressBar,
  QrCode,
  qrCode,
  Radio,
  Responsive,
  RichText,
  Rule,
  radio,
  responsive,
  richText,
  rule,
  Scrollable,
  Sensor,
  Space,
  Stack,
  Svg,
  scrollable,
  sensor,
  space,
  stack,
  svg,
  Table,
  TextEditor,
  Themer,
  Toggler,
  Tooltip,
  table,
  tableCell,
  tableRow,
  text,
  textEditor,
  themer,
  toggler,
  tooltip,
  VerticalSlider,
  verticalSlider,
} from "../../src/ui/index.js";

beforeEach(() => clearHandlers());

// ---------------------------------------------------------------------------
// Radio
// ---------------------------------------------------------------------------

describe("Radio", () => {
  test("creates radio node with value and selected", () => {
    const node = Radio({ id: "opt-a", value: "a", selected: "a" });
    expect(node.type).toBe("radio");
    expect(node.id).toBe("opt-a");
    expect(node.props["value"]).toBe("a");
    expect(node.props["selected"]).toBe("a");
  });

  test("encodes textSize as text_size", () => {
    const node = radio("opt-b", "b", null, { textSize: 14 });
    expect(node.props["text_size"]).toBe(14);
    expect(node.props["textSize"]).toBeUndefined();
  });

  test("registers onSelect handler", () => {
    const handler = (s: unknown) => s;
    radio("opt-c", "c", null, { onSelect: handler });
    const handlers = drainHandlers();
    expect(handlers).toHaveLength(1);
    expect(handlers[0]!.eventType).toBe("select");
    expect(handlers[0]!.handler).toBe(handler);
  });
});

// ---------------------------------------------------------------------------
// Toggler
// ---------------------------------------------------------------------------

describe("Toggler", () => {
  test("creates toggler with is_toggled prop", () => {
    const node = Toggler({ id: "dark-mode", value: true });
    expect(node.type).toBe("toggler");
    expect(node.props["is_toggled"]).toBe(true);
  });

  test("encodes textAlignment as text_alignment", () => {
    const node = toggler("t1", false, { textAlignment: "center" });
    expect(node.props["text_alignment"]).toBe("center");
  });

  test("registers onToggle handler, not in wire props", () => {
    const handler = (s: unknown) => s;
    const node = Toggler({ id: "tog", value: false, onToggle: handler });
    expect(node.props["onToggle"]).toBeUndefined();
    const handlers = drainHandlers();
    expect(handlers).toHaveLength(1);
    expect(handlers[0]!.eventType).toBe("toggle");
  });
});

// ---------------------------------------------------------------------------
// VerticalSlider
// ---------------------------------------------------------------------------

describe("VerticalSlider", () => {
  test("creates vertical_slider with value and range", () => {
    const node = VerticalSlider({ id: "vs", value: 30, range: [0, 100] });
    expect(node.type).toBe("vertical_slider");
    expect(node.props["value"]).toBe(30);
    expect(node.props["range"]).toEqual([0, 100]);
  });

  test("encodes shiftStep as shift_step", () => {
    const node = verticalSlider("vs2", 50, [0, 100], { shiftStep: 10 });
    expect(node.props["shift_step"]).toBe(10);
  });

  test("registers onSlide and onSlideRelease handlers", () => {
    const h1 = (s: unknown) => s;
    const h2 = (s: unknown) => s;
    verticalSlider("vs3", 50, [0, 100], { onSlide: h1, onSlideRelease: h2 });
    const handlers = drainHandlers();
    expect(handlers).toHaveLength(2);
    expect(handlers.map((h) => h.eventType).sort()).toEqual(["slide", "slide_release"]);
  });
});

// ---------------------------------------------------------------------------
// PickList
// ---------------------------------------------------------------------------

describe("PickList", () => {
  test("creates pick_list with options", () => {
    const node = PickList({ id: "pl", options: ["a", "b", "c"], selected: "b" });
    expect(node.type).toBe("pick_list");
    expect(node.props["options"]).toEqual(["a", "b", "c"]);
    expect(node.props["selected"]).toBe("b");
  });

  test("encodes textSize as text_size", () => {
    const node = pickList("pl2", ["x"], { textSize: 16 });
    expect(node.props["text_size"]).toBe(16);
  });

  test("registers onSelect handler, not in wire props", () => {
    const handler = (s: unknown) => s;
    const node = PickList({ id: "pl3", options: ["a"], onSelect: handler });
    expect(node.props["onSelect"]).toBeUndefined();
    const handlers = drainHandlers();
    expect(handlers).toHaveLength(1);
    expect(handlers[0]!.eventType).toBe("select");
  });

  test("boolean onOpen sets wire prop without handler", () => {
    const node = PickList({ id: "pl4", options: ["a"], onOpen: true });
    expect(node.props["on_open"]).toBe(true);
    expect(drainHandlers()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// ComboBox
// ---------------------------------------------------------------------------

describe("ComboBox", () => {
  test("creates combo_box with options", () => {
    const node = ComboBox({ id: "cb", options: ["red", "blue"] });
    expect(node.type).toBe("combo_box");
    expect(node.props["options"]).toEqual(["red", "blue"]);
  });

  test("registers onSelect and onInput handlers", () => {
    const h1 = (s: unknown) => s;
    const h2 = (s: unknown) => s;
    comboBox("cb2", ["a"], { onSelect: h1, onInput: h2 });
    const handlers = drainHandlers();
    expect(handlers).toHaveLength(2);
    expect(handlers.map((h) => h.eventType).sort()).toEqual(["input", "select"]);
  });

  test("function handler for onOptionHovered sets on_option_hovered=true", () => {
    const handler = (s: unknown) => s;
    const node = ComboBox({ id: "cb3", options: [], onOptionHovered: handler });
    expect(node.props["on_option_hovered"]).toBe(true);
    expect(node.props["onOptionHovered"]).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// TextEditor
// ---------------------------------------------------------------------------

describe("TextEditor", () => {
  test("creates text_editor node", () => {
    const node = TextEditor({ id: "editor", content: "hello" });
    expect(node.type).toBe("text_editor");
    expect(node.props["content"]).toBe("hello");
  });

  test("encodes highlightSyntax as highlight_syntax", () => {
    const node = textEditor("ed2", { highlightSyntax: "elixir" });
    expect(node.props["highlight_syntax"]).toBe("elixir");
  });

  test("registers onInput handler, not in wire props", () => {
    const handler = (s: unknown) => s;
    const node = TextEditor({ id: "ed3", onInput: handler });
    expect(node.props["onInput"]).toBeUndefined();
    const handlers = drainHandlers();
    expect(handlers).toHaveLength(1);
    expect(handlers[0]!.eventType).toBe("input");
  });
});

// ---------------------------------------------------------------------------
// RichText
// ---------------------------------------------------------------------------

describe("RichText", () => {
  test("creates rich_text with spans", () => {
    const spans = [{ text: "bold", bold: true }];
    const node = RichText({ id: "rt", spans });
    expect(node.type).toBe("rich_text");
    expect(node.props["spans"]).toEqual(spans);
  });

  test("function API with id, spans, opts", () => {
    const node = richText("rt2", [{ text: "hi" }], { size: 20 });
    expect(node.id).toBe("rt2");
    expect(node.props["size"]).toBe(20);
  });

  test("encodes lineHeight as line_height", () => {
    const node = RichText({ lineHeight: 1.5 });
    expect(node.props["line_height"]).toBe(1.5);
  });
});

// ---------------------------------------------------------------------------
// Markdown
// ---------------------------------------------------------------------------

describe("Markdown", () => {
  test("creates markdown with content", () => {
    const node = Markdown({ content: "# Title" });
    expect(node.type).toBe("markdown");
    expect(node.props["content"]).toBe("# Title");
  });

  test("function API: content only", () => {
    const node = markdown("# Hello");
    expect(node.props["content"]).toBe("# Hello");
  });

  test("function API: id + content", () => {
    const node = markdown("docs", "# API");
    expect(node.id).toBe("docs");
    expect(node.props["content"]).toBe("# API");
  });

  test("encodes h1Size as h1_size", () => {
    const node = Markdown({ content: "x", h1Size: 32 });
    expect(node.props["h1_size"]).toBe(32);
  });
});

// ---------------------------------------------------------------------------
// Image
// ---------------------------------------------------------------------------

describe("Image", () => {
  test("creates image with source", () => {
    const node = Image({ source: "/img/cat.png" });
    expect(node.type).toBe("image");
    expect(node.props["source"]).toBe("/img/cat.png");
  });

  test("encodes contentFit as content_fit", () => {
    const node = image("pic", "/img.png", { contentFit: "cover" });
    expect(node.props["content_fit"]).toBe("cover");
  });

  test("encodes borderRadius as border_radius", () => {
    const node = Image({ source: "/x.png", borderRadius: 8 });
    expect(node.props["border_radius"]).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// Svg
// ---------------------------------------------------------------------------

describe("Svg", () => {
  test("creates svg with source", () => {
    const node = Svg({ source: "/icon.svg" });
    expect(node.type).toBe("svg");
    expect(node.props["source"]).toBe("/icon.svg");
  });

  test("function API: auto-id", () => {
    const node = svg("/icon.svg");
    expect(node.props["source"]).toBe("/icon.svg");
  });

  test("encodes contentFit as content_fit", () => {
    const node = svg("ic", "/x.svg", { contentFit: "contain" });
    expect(node.props["content_fit"]).toBe("contain");
  });
});

// ---------------------------------------------------------------------------
// ProgressBar
// ---------------------------------------------------------------------------

describe("ProgressBar", () => {
  test("creates progress_bar with value and range", () => {
    const node = ProgressBar({ value: 50, range: [0, 100] });
    expect(node.type).toBe("progress_bar");
    expect(node.props["value"]).toBe(50);
    expect(node.props["range"]).toEqual([0, 100]);
  });

  test("function API: id, value, range", () => {
    const node = progressBar("loading", 75, [0, 100]);
    expect(node.id).toBe("loading");
  });
});

// ---------------------------------------------------------------------------
// QrCode
// ---------------------------------------------------------------------------

describe("QrCode", () => {
  test("creates qr_code with data", () => {
    const node = QrCode({ data: "https://example.com" });
    expect(node.type).toBe("qr_code");
    expect(node.props["data"]).toBe("https://example.com");
  });

  test("encodes cellSize as cell_size and errorCorrection as error_correction", () => {
    const node = qrCode("qr1", "test", { cellSize: 4, errorCorrection: "high" });
    expect(node.props["cell_size"]).toBe(4);
    expect(node.props["error_correction"]).toBe("high");
  });

  test("function API: data only", () => {
    const node = qrCode("hello");
    expect(node.props["data"]).toBe("hello");
  });
});

// ---------------------------------------------------------------------------
// Rule
// ---------------------------------------------------------------------------

describe("Rule", () => {
  test("creates rule node", () => {
    const node = Rule({});
    expect(node.type).toBe("rule");
  });

  test("encodes direction prop", () => {
    const node = rule({ direction: "horizontal", thickness: 2 });
    expect(node.props["direction"]).toBe("horizontal");
    expect(node.props["thickness"]).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Space
// ---------------------------------------------------------------------------

describe("Space", () => {
  test("creates space node", () => {
    const node = Space({});
    expect(node.type).toBe("space");
  });

  test("function API: with opts", () => {
    const node = space({ width: 16, height: 16 });
    expect(node.props["width"]).toBe(16);
    expect(node.props["height"]).toBe(16);
  });
});

// ---------------------------------------------------------------------------
// Overlay
// ---------------------------------------------------------------------------

describe("Overlay", () => {
  test("creates overlay with children", () => {
    const child1 = text("anchor");
    const child2 = text("popup");
    const node = Overlay({ children: [child1, child2] });
    expect(node.type).toBe("overlay");
    expect(node.children).toHaveLength(2);
  });

  test("encodes offsetX/offsetY as offset_x/offset_y", () => {
    const node = overlay({ offsetX: 10, offsetY: 20 }, [text("a")]);
    expect(node.props["offset_x"]).toBe(10);
    expect(node.props["offset_y"]).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// Scrollable
// ---------------------------------------------------------------------------

describe("Scrollable", () => {
  test("creates scrollable container", () => {
    const node = Scrollable({ children: [text("content")] });
    expect(node.type).toBe("scrollable");
    expect(node.children).toHaveLength(1);
  });

  test("encodes scrollbarWidth as scrollbar_width", () => {
    const node = scrollable({ scrollbarWidth: 8 }, [text("x")]);
    expect(node.props["scrollbar_width"]).toBe(8);
  });

  test("function handler for onScroll registers and sets wire prop", () => {
    const handler = (s: unknown) => s;
    const node = Scrollable({ id: "sc", onScroll: handler, children: [] });
    expect(node.props["on_scroll"]).toBe(true);
    expect(node.props["onScroll"]).toBeUndefined();
    const handlers = drainHandlers();
    expect(handlers).toHaveLength(1);
    expect(handlers[0]!.eventType).toBe("scrolled");
  });

  test("boolean onScroll sets wire prop without handler", () => {
    const node = Scrollable({ id: "sc2", onScroll: true, children: [] });
    expect(node.props["on_scroll"]).toBe(true);
    expect(drainHandlers()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Stack
// ---------------------------------------------------------------------------

describe("Stack", () => {
  test("creates stack with children", () => {
    const node = Stack({ children: [text("a"), text("b")] });
    expect(node.type).toBe("stack");
    expect(node.children).toHaveLength(2);
  });

  test("function API: children only", () => {
    const node = stack([text("x")]);
    expect(node.children).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Grid
// ---------------------------------------------------------------------------

describe("Grid", () => {
  test("creates grid with columns", () => {
    const node = Grid({ columns: 3, children: [text("a")] });
    expect(node.type).toBe("grid");
    expect(node.props["columns"]).toBe(3);
    expect(node.children).toHaveLength(1);
  });

  test("encodes columnWidth as column_width", () => {
    const node = grid({ columnWidth: 100 }, [text("x")]);
    expect(node.props["column_width"]).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// KeyedColumn
// ---------------------------------------------------------------------------

describe("KeyedColumn", () => {
  test("creates keyed_column with children", () => {
    const node = KeyedColumn({ spacing: 4, children: [text("a")] });
    expect(node.type).toBe("keyed_column");
    expect(node.props["spacing"]).toBe(4);
    expect(node.children).toHaveLength(1);
  });

  test("encodes maxWidth as max_width", () => {
    const node = keyedColumn({ maxWidth: 400 }, [text("x")]);
    expect(node.props["max_width"]).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Responsive
// ---------------------------------------------------------------------------

describe("Responsive", () => {
  test("creates responsive container", () => {
    const node = Responsive({ children: [text("a")] });
    expect(node.type).toBe("responsive");
    expect(node.children).toHaveLength(1);
  });

  test("function API: children only", () => {
    const node = responsive([text("x")]);
    expect(node.children).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Pin
// ---------------------------------------------------------------------------

describe("Pin", () => {
  test("creates pin with coordinates", () => {
    const node = Pin({ x: 10, y: 20, children: [text("dot")] });
    expect(node.type).toBe("pin");
    expect(node.props["x"]).toBe(10);
    expect(node.props["y"]).toBe(20);
    expect(node.children).toHaveLength(1);
  });

  test("function API", () => {
    const node = pin({ x: 5 }, [text("a")]);
    expect(node.props["x"]).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Floating
// ---------------------------------------------------------------------------

describe("Floating", () => {
  test("creates floating with translate props", () => {
    const node = Floating({ translateX: 10, translateY: 20, children: [text("f")] });
    expect(node.type).toBe("floating");
    expect(node.props["translate_x"]).toBe(10);
    expect(node.props["translate_y"]).toBe(20);
  });

  test("function API", () => {
    const node = floating({ scale: 1.5 }, [text("a")]);
    expect(node.props["scale"]).toBe(1.5);
  });
});

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

describe("Table", () => {
  test("creates table with columns and rows expanded into children", () => {
    const cols = [
      { key: "name", label: "Name" },
      { key: "email", label: "Email" },
    ];
    const rows = [{ id: "u1", name: "Alice", email: "a@b.com" }];
    const node = Table({ id: "tbl", columns: cols, rows });
    expect(node.type).toBe("table");
    expect(node.props["columns"]).toEqual(cols);
    expect(node.props["rows"]).toBeUndefined();
    expect(node.children).toHaveLength(1);

    const row = node.children[0]!;
    expect(row.type).toBe("table_row");
    expect(row.id).toBe("u1");
    expect(row.children).toHaveLength(2);

    const nameCell = row.children[0]!;
    expect(nameCell.type).toBe("table_cell");
    expect(nameCell.id).toBe("name");
    expect(nameCell.props["column"]).toBe("name");

    const emailCell = row.children[1]!;
    expect(emailCell.type).toBe("table_cell");
    expect(emailCell.id).toBe("email");
    expect(emailCell.props["column"]).toBe("email");
  });

  test("expand_rows uses index-based row ID when row has no id field", () => {
    const cols = [{ key: "name", label: "Name" }];
    const rows = [{ name: "Alice" }];
    const node = Table({ id: "tbl", columns: cols, rows });
    expect(node.children[0]!.id).toBe("tbl/row/0");
  });

  test("encodes sortBy as sort_by and sortOrder as sort_order", () => {
    const node = table("tbl2", [{ key: "x", label: "X" }], [{}], { sortBy: "x", sortOrder: "asc" });
    expect(node.props["sort_by"]).toBe("x");
    expect(node.props["sort_order"]).toBe("asc");
  });

  test("registers onSort handler, not in wire props", () => {
    const handler = (s: unknown) => s;
    const node = Table({ id: "tbl3", columns: [], rows: [], onSort: handler });
    expect(node.props["onSort"]).toBeUndefined();
    const handlers = drainHandlers();
    expect(handlers).toHaveLength(1);
    expect(handlers[0]!.eventType).toBe("sort");
  });

  test("tableRow creates a table_row container with children", () => {
    const cell = tableCell("name", "name", [text("Alice")]);
    const row = tableRow("user-1", [cell]);
    expect(row.type).toBe("table_row");
    expect(row.id).toBe("user-1");
    expect(row.children).toHaveLength(1);
  });

  test("tableCell creates a table_cell with column key", () => {
    const cell = tableCell("email", "email", [text("alice@example.com")]);
    expect(cell.type).toBe("table_cell");
    expect(cell.id).toBe("email");
    expect(cell.props["column"]).toBe("email");
    expect(cell.props["id"]).toBe("email");
    expect(cell.children).toHaveLength(1);
    expect(cell.children[0]!.props["content"]).toBe("alice@example.com");
  });
});

// ---------------------------------------------------------------------------
// PaneGrid
// ---------------------------------------------------------------------------

describe("PaneGrid", () => {
  test("creates pane_grid with children", () => {
    const node = PaneGrid({ id: "pg", children: [text("pane1")] });
    expect(node.type).toBe("pane_grid");
    expect(node.children).toHaveLength(1);
  });

  test("encodes splitAxis as split_axis", () => {
    const node = paneGrid({ splitAxis: "horizontal" }, [text("a")]);
    expect(node.props["split_axis"]).toBe("horizontal");
  });

  test("registers handler props", () => {
    const h1 = (s: unknown) => s;
    const h2 = (s: unknown) => s;
    const node = PaneGrid({ id: "pg2", onPaneClick: h1, onPaneResize: h2, children: [] });
    expect(node.props["onPaneClick"]).toBeUndefined();
    const handlers = drainHandlers();
    expect(handlers).toHaveLength(2);
    expect(handlers.map((h) => h.eventType).sort()).toEqual(["pane_clicked", "pane_resized"]);
  });
});

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

describe("Tooltip", () => {
  test("creates tooltip with tip", () => {
    const node = Tooltip({ tip: "helpful info", children: [text("hover me")] });
    expect(node.type).toBe("tooltip");
    expect(node.props["tip"]).toBe("helpful info");
    expect(node.children).toHaveLength(1);
  });

  test("encodes snapWithinViewport as snap_within_viewport", () => {
    const node = tooltip("tip", { snapWithinViewport: true }, [text("a")]);
    expect(node.props["snap_within_viewport"]).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// PointerArea
// ---------------------------------------------------------------------------

describe("PointerArea", () => {
  test("creates pointer_area with children", () => {
    const node = PointerArea({ id: "ma", children: [text("content")] });
    expect(node.type).toBe("pointer_area");
    expect(node.children).toHaveLength(1);
  });

  test("function handler registers and sets wire prop", () => {
    const handler = (s: unknown) => s;
    const node = PointerArea({ id: "ma2", onPress: handler, children: [] });
    expect(node.props["on_press"]).toBe(true);
    expect(node.props["onPress"]).toBeUndefined();
    const handlers = drainHandlers();
    expect(handlers).toHaveLength(1);
    expect(handlers[0]!.eventType).toBe("click");
  });

  test("boolean-only props set wire prop without registering", () => {
    const node = PointerArea({
      id: "ma3",
      onDoubleClick: true,
      onRightPress: true,
      onEnter: true,
      children: [],
    });
    expect(node.props["on_double_click"]).toBe(true);
    expect(node.props["on_right_press"]).toBe(true);
    expect(node.props["on_enter"]).toBe(true);
    expect(drainHandlers()).toHaveLength(0);
  });

  test("multiple handler-capable props registered correctly", () => {
    const h = (s: unknown) => s;
    pointerArea({ id: "ma4", onPress: h, onMove: h, onScroll: h }, []);
    const handlers = drainHandlers();
    expect(handlers).toHaveLength(3);
    expect(handlers.map((e) => e.eventType).sort()).toEqual(["click", "move", "scroll"]);
  });
});

// ---------------------------------------------------------------------------
// Sensor
// ---------------------------------------------------------------------------

describe("Sensor", () => {
  test("creates sensor with children", () => {
    const node = Sensor({ id: "sen", children: [text("watched")] });
    expect(node.type).toBe("sensor");
    expect(node.children).toHaveLength(1);
  });

  test("function handler sets on_resize wire prop", () => {
    const handler = (s: unknown) => s;
    const node = Sensor({ id: "sen2", onResize: handler, children: [] });
    expect(node.props["on_resize"]).toBe(true);
    expect(node.props["onResize"]).toBeUndefined();
    const handlers = drainHandlers();
    expect(handlers).toHaveLength(1);
    expect(handlers[0]!.eventType).toBe("resize");
  });

  test("boolean onResize sets wire prop without handler", () => {
    const node = sensor({ id: "sen3", onResize: true }, []);
    expect(node.props["on_resize"]).toBe(true);
    expect(drainHandlers()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Themer
// ---------------------------------------------------------------------------

describe("Themer", () => {
  test("creates themer with theme string", () => {
    const node = Themer({ theme: "dark", children: [text("styled")] });
    expect(node.type).toBe("themer");
    expect(node.props["theme"]).toBe("dark");
    expect(node.children).toHaveLength(1);
  });

  test("function API: theme + children", () => {
    const node = themer("light", [text("a")]);
    expect(node.props["theme"]).toBe("light");
  });

  test("accepts theme as record", () => {
    const theme = { primary: "#ff0000" };
    const node = Themer({ theme, children: [] });
    expect(node.props["theme"]).toEqual(theme);
  });
});

// ---------------------------------------------------------------------------
// Canvas
// ---------------------------------------------------------------------------

describe("Canvas", () => {
  test("creates canvas with children", () => {
    const node = Canvas({ id: "cv", children: [] });
    expect(node.type).toBe("canvas");
    expect(node.id).toBe("cv");
  });

  test("function handler registers and sets wire prop", () => {
    const handler = (s: unknown) => s;
    const node = Canvas({ id: "cv2", onPress: handler, children: [] });
    expect(node.props["on_press"]).toBe(true);
    expect(node.props["onPress"]).toBeUndefined();
    const handlers = drainHandlers();
    expect(handlers).toHaveLength(1);
    expect(handlers[0]!.eventType).toBe("press");
  });

  test("boolean handler sets wire prop without registering", () => {
    const node = Canvas({ id: "cv3", onMove: true, children: [] });
    expect(node.props["on_move"]).toBe(true);
    expect(drainHandlers()).toHaveLength(0);
  });

  test("function API: opts + children", () => {
    const node = canvas({ id: "cv4", interactive: true }, []);
    expect(node.props["interactive"]).toBe(true);
  });
});
