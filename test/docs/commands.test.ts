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
  expect(cmd.type).toBe("command");
  expect(cmd.payload["id"]).toBe("todoInput");
  expect(cmd.payload["family"]).toBe("focus");
});

test("commands_focus_next_construct", () => {
  const cmd = Command.focusNext();
  expect(cmd.type).toBe("widget_op");
  expect(cmd.payload["op"]).toBe("focus_next");
});

test("commands_focus_previous_construct", () => {
  const cmd = Command.focusPrevious();
  expect(cmd.type).toBe("widget_op");
  expect(cmd.payload["op"]).toBe("focus_previous");
});

// -- Text operations --

test("commands_select_all_construct", () => {
  const cmd = Command.selectAll("editor");
  expect(cmd.type).toBe("command");
  expect(cmd.payload["id"]).toBe("editor");
  expect(cmd.payload["family"]).toBe("select_all");
});

test("commands_select_range_construct", () => {
  const cmd = Command.selectRange("editor", 5, 10);
  expect(cmd.type).toBe("command");
  expect(cmd.payload["id"]).toBe("editor");
  expect(cmd.payload["family"]).toBe("select_range");
  expect((cmd.payload["value"] as Record<string, unknown>)["start_pos"]).toBe(5);
  expect((cmd.payload["value"] as Record<string, unknown>)["end_pos"]).toBe(10);
});

// -- Scroll operations --

test("commands_snap_to_end_construct", () => {
  const cmd = Command.snapToEnd("chatLog");
  expect(cmd.type).toBe("command");
  expect(cmd.payload["id"]).toBe("chatLog");
  expect(cmd.payload["family"]).toBe("snap_to_end");
});

test("commands_snap_to_construct", () => {
  const cmd = Command.snapTo("scroller", 0.0, 0.5);
  expect(cmd.type).toBe("command");
  expect(cmd.payload["id"]).toBe("scroller");
  expect(cmd.payload["family"]).toBe("snap_to");
  expect((cmd.payload["value"] as Record<string, unknown>)["x"]).toBe(0.0);
  expect((cmd.payload["value"] as Record<string, unknown>)["y"]).toBe(0.5);
});

test("commands_scroll_by_construct", () => {
  const cmd = Command.scrollBy("scroller", 0, 50);
  expect(cmd.type).toBe("command");
  expect(cmd.payload["id"]).toBe("scroller");
  expect(cmd.payload["family"]).toBe("scroll_by");
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

// -- Widget commands --

test("commands_widget_command_construct", () => {
  const cmd = Command.widgetCommand("term-1", "write", { data: "output" });
  expect(cmd.type).toBe("command");
  expect(cmd.payload["id"]).toBe("term-1");
  expect(cmd.payload["family"]).toBe("write");
});

test("commands_widget_commands_construct", () => {
  const cmds = [
    { id: "term-1", family: "write", value: { data: "line1" } },
    { id: "log-1", family: "append", value: { line: "entry" } },
  ];
  const cmd = Command.widgetCommands(cmds);
  expect(cmd.type).toBe("commands");
});

// -- Subscriptions --

test("subscriptions_every_construct", () => {
  const sub = Subscription.every(1000, "tick");
  expect(sub.type).toBe("every");
  expect(sub.interval).toBe(1000);
  expect(sub.tag).toBe("tick");
});

test("subscriptions_on_key_press_construct", () => {
  const sub = Subscription.onKeyPress();
  expect(sub.type).toBe("on_key_press");
  expect(sub.tag).toBeUndefined();
});

test("subscriptions_set_max_rate", () => {
  const sub = Subscription.maxRate(Subscription.onPointerMove(), 30);
  expect(sub.maxRate).toBe(30);
});

test("subscriptions_on_animation_frame_with_rate", () => {
  const sub = Subscription.onAnimationFrame({ maxRate: 60 });
  expect(sub.maxRate).toBe(60);
});

test("subscriptions_on_window_close", () => {
  const sub = Subscription.onWindowClose();
  expect(sub.type).toBe("on_window_close");
  expect(sub.tag).toBeUndefined();
});

test("subscriptions_on_window_resize", () => {
  const sub = Subscription.onWindowResize();
  expect(sub.type).toBe("on_window_resize");
  expect(sub.tag).toBeUndefined();
});

test("subscriptions_on_pointer_button", () => {
  const sub = Subscription.onPointerButton();
  expect(sub.type).toBe("on_pointer_button");
  expect(sub.tag).toBeUndefined();
});

test("subscriptions_on_pointer_scroll", () => {
  const sub = Subscription.onPointerScroll();
  expect(sub.type).toBe("on_pointer_scroll");
  expect(sub.tag).toBeUndefined();
});

test("subscriptions_on_pointer_touch", () => {
  const sub = Subscription.onPointerTouch();
  expect(sub.type).toBe("on_pointer_touch");
  expect(sub.tag).toBeUndefined();
});

test("subscriptions_on_ime", () => {
  const sub = Subscription.onIme();
  expect(sub.type).toBe("on_ime");
  expect(sub.tag).toBeUndefined();
});

test("subscriptions_on_theme_change", () => {
  const sub = Subscription.onThemeChange();
  expect(sub.type).toBe("on_theme_change");
  expect(sub.tag).toBeUndefined();
});

test("subscriptions_on_file_drop", () => {
  const sub = Subscription.onFileDrop();
  expect(sub.type).toBe("on_file_drop");
  expect(sub.tag).toBeUndefined();
});

test("subscriptions_on_event", () => {
  const sub = Subscription.onEvent();
  expect(sub.type).toBe("on_event");
  expect(sub.tag).toBeUndefined();
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
