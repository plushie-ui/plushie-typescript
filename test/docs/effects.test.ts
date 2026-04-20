import { beforeEach, expect, test } from "vitest";
import { COMMAND, Effect, isEffect } from "../../src/index.js";
import type { EffectEvent } from "../../src/types.js";

beforeEach(() => {
  Effect._resetIdCounter();
});

// -- File open effect --

test("effects_file_open_returns_effect_command", () => {
  const cmd = Effect.fileOpen("import", {
    title: "Choose a file",
    filters: [
      ["Text files", "*.txt"],
      ["All files", "*"],
    ],
  });

  expect(cmd[COMMAND]).toBe(true);
  expect(cmd.type).toBe("effect");
  expect(cmd.payload["kind"]).toBe("file_open");
  expect(cmd.payload["tag"]).toBe("import");
  expect((cmd.payload["payload"] as Record<string, unknown>)["title"]).toBe("Choose a file");
  expect(typeof cmd.payload["id"]).toBe("string");
});

// -- Default timeouts --

test("effects_file_open_default_timeout", () => {
  const cmd = Effect.fileOpen("open");
  expect(cmd.payload["timeout"]).toBe(120_000);
});

test("effects_clipboard_read_default_timeout", () => {
  const cmd = Effect.clipboardRead("clip");
  expect(cmd.payload["timeout"]).toBe(5_000);
});

test("effects_notification_default_timeout", () => {
  const cmd = Effect.notification("notify", "Title", "Body");
  expect(cmd.payload["timeout"]).toBe(5_000);
});

// -- Custom timeout --

test("effects_file_open_custom_timeout", () => {
  const cmd = Effect.fileOpen("open", { title: "Pick a file", timeout: 300_000 });
  expect(cmd.payload["timeout"]).toBe(300_000);
});

// -- Effect result event matching --

test("effects_ok_result_match", () => {
  const event: EffectEvent = {
    kind: "effect",
    tag: "import",
    result: { kind: "file_opened", path: "/tmp/notes.txt" },
  };

  expect(isEffect(event)).toBe(true);
  expect(isEffect(event, "import")).toBe(true);
  expect(isEffect(event, "other")).toBe(false);
  expect(event.result.kind).toBe("file_opened");
  if (event.result.kind === "file_opened") {
    expect(event.result.path).toBe("/tmp/notes.txt");
  }
});

test("effects_cancelled_result_match", () => {
  const event: EffectEvent = {
    kind: "effect",
    tag: "import",
    result: { kind: "cancelled" },
  };

  expect(isEffect(event)).toBe(true);
  expect(event.result.kind).toBe("cancelled");
});

test("effects_error_result_match", () => {
  const event: EffectEvent = {
    kind: "effect",
    tag: "import",
    result: { kind: "error", message: "unsupported" },
  };

  expect(isEffect(event)).toBe(true);
  expect(event.result.kind).toBe("error");
  if (event.result.kind === "error") {
    expect(event.result.message).toBe("unsupported");
  }
});

// -- Multiple effect kinds --

test("effects_file_save_construct", () => {
  const cmd = Effect.fileSave("save", { title: "Save as", defaultName: "output.txt" });
  expect(cmd.type).toBe("effect");
  expect(cmd.payload["kind"]).toBe("file_save");
});

test("effects_clipboard_write_construct", () => {
  const cmd = Effect.clipboardWrite("copy", "Hello");
  expect(cmd.type).toBe("effect");
  expect(cmd.payload["kind"]).toBe("clipboard_write");
});

test("effects_notification_construct", () => {
  const cmd = Effect.notification("notify", "Title", "Body", {
    icon: "dialog-information",
    urgency: "normal",
  });
  expect(cmd.type).toBe("effect");
  expect(cmd.payload["kind"]).toBe("notification");
});
