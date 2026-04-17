import { describe, expect, test } from "vitest";
import { COMMAND, Command } from "../src/index.js";

describe("Command", () => {
  test("none() creates a no-op command", () => {
    const cmd = Command.none();
    expect(cmd.type).toBe("none");
    expect(cmd[COMMAND]).toBe(true);
  });

  test("focus() creates a command with the widget ID", () => {
    const cmd = Command.focus("form/email");
    expect(cmd.type).toBe("command");
    expect(cmd.payload).toEqual({ id: "form/email", family: "focus", value: null });
  });

  test("batch() wraps multiple commands", () => {
    const cmds = Command.batch([Command.focus("input"), Command.scrollTo("list", 0, 100)]);
    expect(cmds.type).toBe("batch");
    const commands = cmds.payload["commands"] as unknown[];
    expect(commands).toHaveLength(2);
  });

  test("async() stores function and tag", () => {
    const fn = async () => 42;
    const cmd = Command.async(fn, "result");
    expect(cmd.type).toBe("async");
    expect(cmd.payload["tag"]).toBe("result");
    expect(cmd.payload["fn"]).toBe(fn);
  });

  test("focusElement() is unified into focus()", () => {
    const cmd = Command.focus("my-canvas/element-42");
    expect(cmd.type).toBe("command");
    expect(cmd.payload).toEqual({ id: "my-canvas/element-42", family: "focus", value: null });
  });

  test("commands are frozen", () => {
    const cmd = Command.focus("x");
    expect(Object.isFrozen(cmd)).toBe(true);
  });

  test("isCommand detects commands", () => {
    expect(Command.isCommand(Command.none())).toBe(true);
    expect(Command.isCommand({ type: "none" })).toBe(false);
    expect(Command.isCommand(null)).toBe(false);
    expect(Command.isCommand("not a command")).toBe(false);
  });

  // -- Window operations ----------------------------------------------------

  test("maximizeWindow() creates a window_op maximize command", () => {
    const cmd = Command.maximizeWindow("main");
    expect(cmd.type).toBe("window_op");
    expect(cmd.payload).toEqual({ op: "maximize", window_id: "main", maximized: true });
  });

  test("minimizeWindow() defaults to minimized=true", () => {
    const cmd = Command.minimizeWindow("main", false);
    expect(cmd.payload).toEqual({ op: "minimize", window_id: "main", minimized: false });
  });

  test("setWindowMode() sets mode as string", () => {
    const cmd = Command.setWindowMode("main", "fullscreen");
    expect(cmd.payload).toEqual({ op: "set_mode", window_id: "main", mode: "fullscreen" });
  });

  test("toggleMaximize() sends toggle_maximize op", () => {
    const cmd = Command.toggleMaximize("main");
    expect(cmd.type).toBe("window_op");
    expect(cmd.payload["op"]).toBe("toggle_maximize");
  });

  test("dragWindow() sends drag op", () => {
    const cmd = Command.dragWindow("main");
    expect(cmd.payload).toEqual({ op: "drag", window_id: "main" });
  });

  test("setResizable() sends resizable flag", () => {
    const cmd = Command.setResizable("main", false);
    expect(cmd.payload).toEqual({ op: "set_resizable", window_id: "main", resizable: false });
  });

  test("setMinSize() sends dimensions", () => {
    const cmd = Command.setMinSize("main", 200, 100);
    expect(cmd.payload).toEqual({ op: "set_min_size", window_id: "main", width: 200, height: 100 });
  });

  test("screenshotWindow() sends screenshot op with tag", () => {
    const cmd = Command.screenshotWindow("main", "snap");
    expect(cmd.payload).toEqual({ op: "screenshot", window_id: "main", tag: "snap" });
  });

  test("allowAutomaticTabbing() creates a system_op command", () => {
    const cmd = Command.allowAutomaticTabbing(true);
    expect(cmd.type).toBe("system_op");
    expect(cmd.payload).toEqual({ op: "allow_automatic_tabbing", enabled: true });
  });

  // -- Window queries -------------------------------------------------------

  test("windowSize() creates a window_query command", () => {
    const cmd = Command.windowSize("main", "size_result");
    expect(cmd.type).toBe("window_query");
    expect(cmd.payload).toEqual({ op: "get_size", window_id: "main", tag: "size_result" });
  });

  test("isMaximized() creates a window_query command", () => {
    const cmd = Command.isMaximized("main", "max_check");
    expect(cmd.type).toBe("window_query");
    expect(cmd.payload["op"]).toBe("is_maximized");
  });

  test("monitorSize() creates a window_query command", () => {
    const cmd = Command.monitorSize("main", "monitor");
    expect(cmd.payload).toEqual({ op: "monitor_size", window_id: "main", tag: "monitor" });
  });

  // -- System queries -------------------------------------------------------

  test("systemTheme() creates a system_query command", () => {
    const cmd = Command.systemTheme("theme");
    expect(cmd.type).toBe("system_query");
    expect(cmd.payload).toEqual({ op: "get_system_theme", tag: "theme" });
  });

  test("systemInfo() creates a system_query command", () => {
    const cmd = Command.systemInfo("info");
    expect(cmd.type).toBe("system_query");
    expect(cmd.payload).toEqual({ op: "get_system_info", tag: "info" });
  });

  // -- Text editing ---------------------------------------------------------

  test("moveCursorTo() sends command with position value", () => {
    const cmd = Command.moveCursorTo("editor", 42);
    expect(cmd.type).toBe("command");
    expect(cmd.payload).toEqual({ id: "editor", family: "move_cursor_to", value: 42 });
  });

  test("moveCursorToFront() sends command", () => {
    const cmd = Command.moveCursorToFront("editor");
    expect(cmd.type).toBe("command");
    expect(cmd.payload).toEqual({ id: "editor", family: "move_cursor_to_front", value: null });
  });

  test("selectRange() sets start_pos and end_pos", () => {
    const cmd = Command.selectRange("editor", 5, 15);
    expect(cmd.type).toBe("command");
    expect(cmd.payload).toEqual({
      id: "editor",
      family: "select_range",
      value: { start_pos: 5, end_pos: 15 },
    });
  });

  // -- Image operations -----------------------------------------------------

  test("createImage() with encoded data", () => {
    const data = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const cmd = Command.createImage("avatar", data);
    expect(cmd.type).toBe("image_op");
    expect(cmd.payload["op"]).toBe("create_image");
    expect(cmd.payload["handle"]).toBe("avatar");
    expect(cmd.payload["data"]).toBe(data);
  });

  test("createImage() with raw RGBA pixels", () => {
    const pixels = new Uint8Array(4 * 4 * 4);
    const cmd = Command.createImage("icon", 4, 4, pixels);
    expect(cmd.payload["width"]).toBe(4);
    expect(cmd.payload["height"]).toBe(4);
    expect(cmd.payload["pixels"]).toBe(pixels);
  });

  test("deleteImage() deletes by handle", () => {
    const cmd = Command.deleteImage("avatar");
    expect(cmd.type).toBe("image_op");
    expect(cmd.payload).toEqual({ op: "delete_image", handle: "avatar" });
  });

  test("clearImages() clears all images", () => {
    const cmd = Command.clearImages();
    expect(cmd.type).toBe("widget_op");
    expect(cmd.payload["op"]).toBe("clear_images");
  });

  // -- Pane operations ------------------------------------------------------

  test("paneSplit() creates a split command", () => {
    const cmd = Command.paneSplit("grid", "pane1", "horizontal", "pane2");
    expect(cmd.type).toBe("command");
    expect(cmd.payload).toEqual({
      id: "grid",
      family: "pane_split",
      value: {
        pane: "pane1",
        axis: "horizontal",
        new_pane_id: "pane2",
      },
    });
  });

  test("paneClose() closes a pane", () => {
    const cmd = Command.paneClose("grid", "pane1");
    expect(cmd.type).toBe("command");
    expect(cmd.payload).toEqual({ id: "grid", family: "pane_close", value: { pane: "pane1" } });
  });

  test("paneSwap() swaps two panes", () => {
    const cmd = Command.paneSwap("grid", "a", "b");
    expect(cmd.type).toBe("command");
    expect(cmd.payload).toEqual({ id: "grid", family: "pane_swap", value: { a: "a", b: "b" } });
  });

  test("paneRestore() restores from maximized state", () => {
    const cmd = Command.paneRestore("grid");
    expect(cmd.type).toBe("command");
    expect(cmd.payload).toEqual({ id: "grid", family: "pane_restore", value: null });
  });

  // -- Widget commands -------------------------------------------------------

  test("widgetCommand() sends command to widget by ID", () => {
    const cmd = Command.widgetCommand("ext-1", "set_value", { value: 42 });
    expect(cmd.type).toBe("command");
    expect(cmd.payload).toEqual({ id: "ext-1", family: "set_value", value: { value: 42 } });
  });

  test("widgetCommand() defaults value to null", () => {
    const cmd = Command.widgetCommand("ext-1", "reset");
    expect(cmd.payload["value"]).toBe(null);
  });

  // -- Other ----------------------------------------------------------------

  test("advanceFrame() sends timestamp", () => {
    const cmd = Command.advanceFrame(16);
    expect(cmd.type).toBe("advance_frame");
    expect(cmd.payload).toEqual({ timestamp: 16 });
  });

  test("loadFont() sends font data", () => {
    const data = new Uint8Array([0, 1, 2, 3]);
    const cmd = Command.loadFont(data);
    expect(cmd.type).toBe("widget_op");
    expect(cmd.payload["op"]).toBe("load_font");
    expect(cmd.payload["data"]).toBe(data);
  });

  test("findFocused() queries focused widget", () => {
    const cmd = Command.findFocused("focus_check");
    expect(cmd.type).toBe("widget_op");
    expect(cmd.payload).toEqual({ op: "find_focused", tag: "focus_check" });
  });

  test("treeHash() queries tree hash", () => {
    const cmd = Command.treeHash("hash_check");
    expect(cmd.payload).toEqual({ op: "tree_hash", tag: "hash_check" });
  });

  test("done() wraps value with mapper", () => {
    const mapper = (v: unknown) => ({ result: v });
    const cmd = Command.done(42, mapper);
    expect(cmd.type).toBe("done");
    expect(cmd.payload["value"]).toBe(42);
    expect(cmd.payload["mapper"]).toBe(mapper);
  });

  test("announce() defaults to polite politeness", () => {
    const cmd = Command.announce("File saved");
    expect(cmd.type).toBe("widget_op");
    expect(cmd.payload).toEqual({ op: "announce", text: "File saved", politeness: "polite" });
  });

  test("announce() accepts an assertive politeness", () => {
    const cmd = Command.announce("Connection lost", "assertive");
    expect(cmd.payload).toEqual({
      op: "announce",
      text: "Connection lost",
      politeness: "assertive",
    });
  });

  test("focusNextWithin() carries the scope in the payload", () => {
    const cmd = Command.focusNextWithin("main#menu");
    expect(cmd.type).toBe("widget_op");
    expect(cmd.payload).toEqual({ op: "focus_next_within", scope: "main#menu" });
  });

  test("focusPreviousWithin() carries the scope in the payload", () => {
    const cmd = Command.focusPreviousWithin("main#menu");
    expect(cmd.type).toBe("widget_op");
    expect(cmd.payload).toEqual({ op: "focus_previous_within", scope: "main#menu" });
  });

  // -- Window-qualified selectors --

  test("focus() without window qualifier", () => {
    const cmd = Command.focus("form/email");
    expect(cmd.payload["id"]).toBe("form/email");
  });

  test("focus() with window qualifier", () => {
    const cmd = Command.focus("main#form/email");
    expect(cmd.payload["id"]).toBe("main#form/email");
  });

  test("scrollTo() with window qualifier", () => {
    const cmd = Command.scrollTo("editor#content", 0, 100);
    expect(cmd.payload["id"]).toBe("editor#content");
    expect((cmd.payload["value"] as Record<string, unknown>)["offset_y"]).toBe(100);
  });

  test("selectAll() with window qualifier", () => {
    const cmd = Command.selectAll("main#editor");
    expect(cmd.payload["id"]).toBe("main#editor");
  });

  test("moveCursorToEnd() with window qualifier", () => {
    const cmd = Command.moveCursorToEnd("main#input");
    expect(cmd.payload["id"]).toBe("main#input");
  });
});
