import { expect, test } from "vitest";
import { COMMAND, Command, Subscription } from "../../src/index.js";

// -- command.none --

test("commands_none", () => {
  const cmd = Command.none();
  expect(cmd.type).toBe("none");
  expect(cmd[COMMAND]).toBe(true);
});

// -- command.async --

test("commands_async_construct", () => {
  const cmd = Command.async(async (_signal) => {
    return { data: "ok" };
  }, "fetchResult");
  expect(cmd.type).toBe("async");
  expect(cmd.payload["tag"]).toBe("fetchResult");
});

// -- command.stream --

test("commands_stream_construct", () => {
  const cmd = Command.stream(async function* (_signal) {
    yield { progress: 1 };
    return { total: 1 };
  }, "fileImport");
  expect(cmd.type).toBe("stream");
  expect(cmd.payload["tag"]).toBe("fileImport");
});

// -- command.cancel --

test("commands_cancel_construct", () => {
  const cmd = Command.cancel("fileImport");
  expect(cmd.type).toBe("cancel");
  expect(cmd.payload["tag"]).toBe("fileImport");
});

// -- command.done --

test("commands_done_construct", () => {
  const defaults = { theme: "dark" };
  const cmd = Command.done(defaults, (v) => ({ type: "configLoaded", config: v }));
  expect(cmd.type).toBe("done");
  expect(cmd.payload["value"]).toBe(defaults);
});

// -- command.exit --

test("commands_exit_construct", () => {
  const cmd = Command.exit();
  expect(cmd.type).toBe("exit");
});

// -- Focus commands --

test("commands_focus_construct", () => {
  const cmd = Command.focus("todoInput");
  expect(cmd.type).toBe("focus");
  expect(cmd.payload["target"]).toBe("todoInput");
});

test("commands_focus_next_construct", () => {
  const cmd = Command.focusNext();
  expect(cmd.type).toBe("focus_next");
});

test("commands_focus_previous_construct", () => {
  const cmd = Command.focusPrevious();
  expect(cmd.type).toBe("focus_previous");
});

// -- Text operations --

test("commands_select_all_construct", () => {
  const cmd = Command.selectAll("editor");
  expect(cmd.type).toBe("select_all");
  expect(cmd.payload["target"]).toBe("editor");
});

test("commands_select_range_construct", () => {
  const cmd = Command.selectRange("editor", 5, 10);
  expect(cmd.type).toBe("select_range");
  expect(cmd.payload["target"]).toBe("editor");
  expect(cmd.payload["start"]).toBe(5);
  expect(cmd.payload["end"]).toBe(10);
});

// -- Scroll operations --

test("commands_snap_to_end_construct", () => {
  const cmd = Command.snapToEnd("chatLog");
  expect(cmd.type).toBe("snap_to_end");
  expect(cmd.payload["target"]).toBe("chatLog");
});

test("commands_snap_to_construct", () => {
  const cmd = Command.snapTo("scroller", 0.0, 0.5);
  expect(cmd.type).toBe("snap_to");
  expect(cmd.payload["target"]).toBe("scroller");
  expect(cmd.payload["x"]).toBe(0.0);
  expect(cmd.payload["y"]).toBe(0.5);
});

test("commands_scroll_by_construct", () => {
  const cmd = Command.scrollBy("scroller", 0, 50);
  expect(cmd.type).toBe("scroll_by");
  expect(cmd.payload["target"]).toBe("scroller");
});

// -- Window management --

test("commands_close_window_construct", () => {
  const cmd = Command.closeWindow("main");
  expect(cmd.type).toBe("close_window");
  expect(cmd.payload["window_id"]).toBe("main");
});

test("commands_set_window_mode_construct", () => {
  const cmd = Command.setWindowMode("main", "fullscreen");
  expect(cmd.type).toBe("window_op");
  expect(cmd.payload["window_id"]).toBe("main");
  expect(cmd.payload["mode"]).toBe("fullscreen");
});

test("commands_set_window_level_construct", () => {
  const cmd = Command.setWindowLevel("main", "always_on_top");
  expect(cmd.type).toBe("window_op");
  expect(cmd.payload["window_id"]).toBe("main");
  expect(cmd.payload["level"]).toBe("always_on_top");
});

// -- Timer --

test("commands_send_after_construct", () => {
  const cmd = Command.sendAfter(3000, { type: "clearMessage" });
  expect(cmd.type).toBe("send_after");
  expect(cmd.payload["delay"]).toBe(3000);
});

// -- Batch --

test("commands_batch_construct", () => {
  const cmds = [Command.focus("nameInput"), Command.sendAfter(5000, { type: "autoSave" })];
  const batch = Command.batch(cmds);
  expect(batch.type).toBe("batch");
  const commands = batch.payload["commands"] as unknown[];
  expect(commands).toHaveLength(2);
});

// -- Extension commands --

test("commands_extension_command_construct", () => {
  const cmd = Command.nativeWidgetCommand("term-1", "write", { data: "output" });
  expect(cmd.type).toBe("extension_command");
  expect(cmd.payload["node_id"]).toBe("term-1");
  expect(cmd.payload["op"]).toBe("write");
});

test("commands_extension_commands_construct", () => {
  const cmds = [
    { nodeId: "term-1", op: "write", payload: { data: "line1" } },
    { nodeId: "log-1", op: "append", payload: { line: "entry" } },
  ];
  const cmd = Command.nativeWidgetCommands(cmds);
  expect(cmd.type).toBe("extension_commands");
});

// -- Subscriptions --

test("subscriptions_every_construct", () => {
  const sub = Subscription.every(1000, "tick");
  expect(sub.type).toBe("every");
  expect(sub.interval).toBe(1000);
  expect(sub.tag).toBe("tick");
});

test("subscriptions_on_key_press_construct", () => {
  const sub = Subscription.onKeyPress("keyEvent");
  expect(sub.type).toBe("on_key_press");
  expect(sub.tag).toBe("keyEvent");
});

test("subscriptions_set_max_rate", () => {
  const sub = Subscription.maxRate(Subscription.onMouseMove("mouse"), 30);
  expect(sub.maxRate).toBe(30);
});

test("subscriptions_on_animation_frame_with_rate", () => {
  const sub = Subscription.onAnimationFrame("frame", { maxRate: 60 });
  expect(sub.maxRate).toBe(60);
});

test("subscriptions_on_window_close", () => {
  const sub = Subscription.onWindowClose("winClose");
  expect(sub.type).toBe("on_window_close");
  expect(sub.tag).toBe("winClose");
});

test("subscriptions_on_window_resize", () => {
  const sub = Subscription.onWindowResize("winResize");
  expect(sub.type).toBe("on_window_resize");
  expect(sub.tag).toBe("winResize");
});

test("subscriptions_on_mouse_button", () => {
  const sub = Subscription.onMouseButton("mouseBtn");
  expect(sub.type).toBe("on_mouse_button");
  expect(sub.tag).toBe("mouseBtn");
});

test("subscriptions_on_mouse_scroll", () => {
  const sub = Subscription.onMouseScroll("scroll");
  expect(sub.type).toBe("on_mouse_scroll");
  expect(sub.tag).toBe("scroll");
});

test("subscriptions_on_touch", () => {
  const sub = Subscription.onTouch("touch");
  expect(sub.type).toBe("on_touch");
  expect(sub.tag).toBe("touch");
});

test("subscriptions_on_ime", () => {
  const sub = Subscription.onIme("ime");
  expect(sub.type).toBe("on_ime");
  expect(sub.tag).toBe("ime");
});

test("subscriptions_on_theme_change", () => {
  const sub = Subscription.onThemeChange("theme");
  expect(sub.type).toBe("on_theme_change");
  expect(sub.tag).toBe("theme");
});

test("subscriptions_on_file_drop", () => {
  const sub = Subscription.onFileDrop("files");
  expect(sub.type).toBe("on_file_drop");
  expect(sub.tag).toBe("files");
});

test("subscriptions_on_event", () => {
  const sub = Subscription.onEvent("all");
  expect(sub.type).toBe("on_event");
  expect(sub.tag).toBe("all");
});

// -- Settings --

test("commands_settings_vsync_and_scale", () => {
  const settings = {
    antialiasing: true,
    vsync: false,
    scaleFactor: 1.5,
    defaultEventRate: 60,
  };
  expect(settings.vsync).toBe(false);
  expect(settings.scaleFactor).toBe(1.5);
  expect(settings.defaultEventRate).toBe(60);
});
