// Comprehensive widget catalog exercising every real iced widget type in Plushie.
//
// Organized as a column layout with tab-like navigation across four sections:
// layout, input, display, and composite. Each section demonstrates a category
// of widgets with realistic props and interactive state.
//
// Demonstrated widgets:
//
// Layout: column, row, container, scrollable, stack, grid, pin, float,
// responsive, keyed_column, themer, space
//
// Input: button, text_input, checkbox, toggler, radio (with group prop),
// slider, vertical_slider, pick_list, combo_box, text_editor
//
// Display: text, rule, progress_bar, tooltip, image, svg, markdown,
// rich_text, canvas
//
// Interactive/Composite: mouse_area, sensor, pane_grid, table
//
// Uses update() for all event handling to showcase the event patterns.

import type { CanvasShape } from "../src/canvas/index.js";
import { circle, line, rect, stroke } from "../src/canvas/index.js";
import type { Event, UINode } from "../src/index.js";
import {
  app,
  isClick,
  isInput,
  isMouseArea,
  isSelect,
  isSensor,
  isSlide,
  isToggle,
} from "../src/index.js";
import {
  button,
  checkbox,
  column,
  comboBox,
  container,
  floating,
  grid,
  image,
  keyedColumn,
  markdown,
  mouseArea,
  paneGrid,
  pickList,
  pin,
  progressBar,
  radio,
  responsive,
  richText,
  row,
  rule,
  scrollable,
  sensor,
  slider,
  space,
  stack,
  svg,
  table,
  text,
  textEditor,
  textInput,
  themer,
  toggler,
  tooltip,
  verticalSlider,
  window,
} from "../src/ui/index.js";
import { Canvas } from "../src/ui/widgets/canvas.js";

// -- Types --------------------------------------------------------------------

interface Model {
  activeTab: string;
  demoTabsActive: string;
  textValue: string;
  checkboxChecked: boolean;
  togglerOn: boolean;
  sliderValue: number;
  vsliderValue: number;
  radioSelected: string;
  pickListSelected: string | null;
  comboValue: string | null;
  editorContent: string;
  progress: number;
  panelCollapsed: boolean;
  modalVisible: boolean;
  clickCount: number;
  mouseAreaStatus: string;
  sensorStatus: string;
}

// -- Tab views ----------------------------------------------------------------

function layoutTab(): UINode {
  return column({ spacing: 8 }, [
    text("layout_heading", "Layout Widgets", { size: 18 }),

    // Row
    row({ spacing: 8 }, [text("Row child 1"), text("Row child 2"), text("Row child 3")]),

    // Nested column
    column({ spacing: 4 }, [text("Nested column child 1"), text("Nested column child 2")]),

    // Container with padding
    container("demo_container", { padding: 12 }, [text("Inside a container")]),

    // Scrollable
    scrollable({ id: "demo_scrollable" }, [
      column({ spacing: 4 }, [
        text("Scrollable item 1"),
        text("Scrollable item 2"),
        text("Scrollable item 3"),
        text("Scrollable item 4"),
        text("Scrollable item 5"),
      ]),
    ]),

    // Stack - layers on top of each other
    stack([text("Stack layer 1 (back)"), text("Stack layer 2 (front)")]),

    // Grid layout
    grid({ columns: 3, spacing: 4 }, [
      text("Grid 1"),
      text("Grid 2"),
      text("Grid 3"),
      text("Grid 4"),
      text("Grid 5"),
      text("Grid 6"),
    ]),

    // Pin - positioned element
    pin({ id: "demo_pin", x: 0, y: 0 }, [text("Pinned content")]),

    // Float - floating overlay element with translation
    floating({ id: "demo_float", translateX: 100, translateY: 10 }, [text("Floating element")]),

    // Responsive layout
    responsive([column([text("Responsive content adapts to width")])]),

    // Keyed column - stable identity for children
    keyedColumn({ spacing: 4 }, [
      text("key_a", "Keyed item A"),
      text("key_b", "Keyed item B"),
      text("key_c", "Keyed item C"),
    ]),

    // Themer - overrides the theme for its subtree
    themer({ background: "#1a1a2e", text: "#e0e0e0", primary: "#0f3460" }, [
      container("themed_box", { padding: 12 }, [
        column({ spacing: 4 }, [
          text("Themed section with custom palette"),
          button("themed_btn", "Themed Button"),
        ]),
      ]),
    ]),

    // Space - explicit gap
    space({ height: 16 }),
  ]);
}

function inputTab(model: Model): UINode {
  return column({ spacing: 8 }, [
    text("input_heading", "Input Widgets", { size: 18 }),

    // Text input
    textInput("demo_input", model.textValue, { placeholder: "Type here..." }),

    // Button
    button("demo_button", "A Button"),

    // Checkbox
    checkbox("demo_check", model.checkboxChecked, { label: "Check me" }),

    // Toggler
    toggler("demo_toggler", model.togglerOn, { label: "Toggle me" }),

    // Radio group
    row({ spacing: 8 }, [
      radio("demo_radio_a", "a", model.radioSelected, { label: "Option A", group: "demo_radio" }),
      radio("demo_radio_b", "b", model.radioSelected, { label: "Option B", group: "demo_radio" }),
      radio("demo_radio_c", "c", model.radioSelected, { label: "Option C", group: "demo_radio" }),
    ]),

    // Slider
    slider("demo_slider", model.sliderValue, [0, 100], { step: 1 }),
    text(`Slider: ${model.sliderValue}`),

    // Vertical slider
    verticalSlider("demo_vslider", model.vsliderValue, [0, 100], { step: 1 }),

    // Pick list
    pickList("demo_pick", ["Small", "Medium", "Large"], {
      selected: model.pickListSelected,
      placeholder: "Pick a size...",
    }),

    // Combo box
    comboBox("demo_combo", ["Elixir", "Rust", "Go"], {
      value: model.comboValue ?? "",
      placeholder: "Choose a language...",
    }),

    // Text editor
    textEditor("demo_editor", { content: model.editorContent, height: 100 }),
  ]);
}

function displayTab(model: Model): UINode {
  const canvasShapes: CanvasShape[] = [
    rect(10, 10, 80, 60, { fill: "#3498db" }),
    circle(150, 75, 40, { fill: "#e74c3c" }),
    line(10, 130, 190, 130, { stroke: stroke("#2ecc71", 2) }),
  ];

  return column({ spacing: 8 }, [
    text("display_heading", "Display Widgets", { size: 18 }),

    // Plain text
    text("Plain text label"),

    // Rule (horizontal divider)
    rule(),

    // Progress bar with interactive control
    row({ spacing: 8 }, [
      progressBar("demo_progress", model.progress, [0, 100]),
      button("inc_progress", "+5%"),
    ]),

    // Tooltip wrapping a button
    tooltip("This is a tooltip", { id: "demo_tooltip", position: "top" }, [
      button("tooltip_target", "Hover me for tooltip"),
    ]),

    // Image
    image("demo_image", "/assets/placeholder.png", { width: 120, height: 80 }),

    // SVG
    svg("demo_svg", "/assets/icon.svg", { width: 24, height: 24 }),

    // Markdown with settings
    markdown(
      "demo_markdown",
      "## Markdown\n\nSome **bold** and *italic* text.\n\n- Item one\n- Item two",
    ),

    // Rich text with styled spans
    richText("demo_rich_text", [
      { text: "Bold text ", weight: "bold", size: 16 },
      { text: "italic text ", style: "italic" },
      { text: "normal text " },
      { text: "colored text", color: "#e74c3c" },
    ]),

    // Canvas with geometric shapes
    Canvas({
      id: "demo_canvas",
      width: 200,
      height: 150,
      children: canvasShapes as unknown as UINode[],
    }),
  ]);
}

function compositeTab(model: Model): UINode {
  return column({ spacing: 8 }, [
    text("composite_heading", "Interactive & Composite Widgets", { size: 18 }),

    // Mouse area wrapping content -- detects hover enter/exit
    mouseArea({ id: "demo_mouse_area", onEnter: true, onExit: true }, [
      container("mouse_area_box", { padding: 12 }, [text(`Mouse area: ${model.mouseAreaStatus}`)]),
    ]),

    // Sensor detecting pointer events
    sensor({ id: "demo_sensor", onResize: true }, [
      container("sensor_box", { padding: 12 }, [text(`Sensor: ${model.sensorStatus}`)]),
    ]),

    // Simulated tab switching using buttons and conditional content
    container("demo_tabs", {}, [
      column({ spacing: 4 }, [
        row({ spacing: 4 }, [button("tab_one", "Tab One"), button("tab_two", "Tab Two")]),
        model.demoTabsActive === "tab_one" ? text("Tab one content") : text("Tab two content"),
      ]),
    ]),

    // Modal simulation using container with visible prop
    button("show_modal", "Show Modal"),

    ...(model.modalVisible
      ? [
          container("demo_modal", { padding: 16 }, [
            column({ spacing: 8 }, [text("Modal Content"), button("hide_modal", "Close")]),
          ]),
        ]
      : []),

    // Collapsible panel simulation
    button("demo_panel", model.panelCollapsed ? "Expand Panel" : "Collapse Panel"),

    ...(!model.panelCollapsed
      ? [container("panel_content", { padding: 8 }, [text("Panel content that can be collapsed")])]
      : []),

    // Counter demonstrating click events updating model
    row({ spacing: 8 }, [
      button("counter_btn", "Click me"),
      text(`Clicked ${model.clickCount} times`),
    ]),

    // PaneGrid with multiple panes
    paneGrid({ id: "demo_panes", spacing: 2 }, [
      container("pane_left", { padding: 8 }, [
        column([text("Left pane"), text("Navigation or file tree")]),
      ]),
      container("pane_right", { padding: 8 }, [
        column([text("Right pane"), text("Main editor area")]),
      ]),
    ]),

    // Table with columns and rows
    table(
      "demo_table",
      [
        { key: "name", label: "Name" },
        { key: "lang", label: "Language" },
        { key: "stars", label: "Stars" },
      ],
      [
        { name: "Phoenix", lang: "Elixir", stars: "20k" },
        { name: "Iced", lang: "Rust", stars: "24k" },
        { name: "React", lang: "JavaScript", stars: "220k" },
      ],
    ),
  ]);
}

// -- App ----------------------------------------------------------------------

export default app<Model>({
  // -- Init -------------------------------------------------------------------

  init: {
    activeTab: "layout",
    demoTabsActive: "tab_one",
    textValue: "",
    checkboxChecked: false,
    togglerOn: false,
    sliderValue: 50,
    vsliderValue: 50,
    radioSelected: "a",
    pickListSelected: null,
    comboValue: null,
    editorContent: "Edit me...",
    progress: 65,
    panelCollapsed: false,
    modalVisible: false,
    clickCount: 0,
    mouseAreaStatus: "idle",
    sensorStatus: "waiting",
  },

  // -- Update -----------------------------------------------------------------

  update(state, event: Event) {
    // Tab switching
    if (isClick(event, "tab_layout")) return { ...state, activeTab: "layout" };
    if (isClick(event, "tab_input")) return { ...state, activeTab: "input" };
    if (isClick(event, "tab_display")) return { ...state, activeTab: "display" };
    if (isClick(event, "tab_composite")) return { ...state, activeTab: "composite" };

    // Input widgets
    if (isInput(event, "demo_input")) return { ...state, textValue: String(event.value) };
    if (isToggle(event, "demo_check")) return { ...state, checkboxChecked: Boolean(event.value) };
    if (isToggle(event, "demo_toggler")) return { ...state, togglerOn: Boolean(event.value) };
    if (isSlide(event, "demo_slider")) return { ...state, sliderValue: Number(event.value) };
    if (isSlide(event, "demo_vslider")) return { ...state, vsliderValue: Number(event.value) };
    if (isSelect(event, "demo_radio")) return { ...state, radioSelected: String(event.value) };
    if (isSelect(event, "demo_pick")) return { ...state, pickListSelected: String(event.value) };
    if (isSelect(event, "demo_combo")) return { ...state, comboValue: String(event.value) };
    if (isInput(event, "demo_editor")) return { ...state, editorContent: String(event.value) };

    // Composite section - simulated tab switching with buttons
    if (isClick(event, "tab_one")) return { ...state, demoTabsActive: "tab_one" };
    if (isClick(event, "tab_two")) return { ...state, demoTabsActive: "tab_two" };

    // Modal show/hide
    if (isClick(event, "show_modal")) return { ...state, modalVisible: true };
    if (isClick(event, "hide_modal")) return { ...state, modalVisible: false };

    // Panel collapse toggle
    if (isClick(event, "demo_panel")) return { ...state, panelCollapsed: !state.panelCollapsed };

    // Interactive widgets
    if (isClick(event, "counter_btn")) return { ...state, clickCount: state.clickCount + 1 };
    if (isClick(event, "inc_progress"))
      return { ...state, progress: Math.min(state.progress + 5, 100) };

    // Mouse area enter/exit
    if (isMouseArea(event) && event.id === "demo_mouse_area") {
      if (event.type === "enter") return { ...state, mouseAreaStatus: "hovering" };
      if (event.type === "exit") return { ...state, mouseAreaStatus: "idle" };
    }

    // Sensor resize
    if (isSensor(event) && event.id === "demo_sensor") {
      if (event.type === "resize") return { ...state, sensorStatus: "activated" };
    }

    return state;
  },

  // -- View -------------------------------------------------------------------

  view: (s) =>
    window("catalog", { title: "Widget Catalog" }, [
      column({ spacing: 12, padding: 16 }, [
        text("catalog_title", "Plushie Widget Catalog", { size: 24 }),
        rule(),

        row({ spacing: 8 }, [
          button("tab_layout", "Layout"),
          button("tab_input", "Input"),
          button("tab_display", "Display"),
          button("tab_composite", "Composite"),
        ]),

        rule(),

        s.activeTab === "layout"
          ? layoutTab()
          : s.activeTab === "input"
            ? inputTab(s)
            : s.activeTab === "display"
              ? displayTab(s)
              : compositeTab(s),
      ]),
    ]),
});
