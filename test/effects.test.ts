import { beforeEach, describe, expect, test } from "vitest";
import { COMMAND, Effect } from "../src/index.js";

beforeEach(() => {
  Effect._resetIdCounter();
});

describe("Effect", () => {
  test("fileOpen creates an effect command with tag and monotonic wire ID", () => {
    const cmd = Effect.fileOpen("import", { title: "Pick a file" });
    expect(cmd[COMMAND]).toBe(true);
    expect(cmd.type).toBe("effect");
    expect(cmd.payload["kind"]).toBe("file_open");
    expect(cmd.payload["tag"]).toBe("import");
    expect(cmd.payload["id"]).toBe("ef_1");
    expect(cmd.payload["timeout"]).toBe(120_000);
    expect((cmd.payload["payload"] as Record<string, unknown>)["title"]).toBe("Pick a file");
  });

  test("wire IDs are monotonically increasing", () => {
    const a = Effect.fileOpen("a");
    const b = Effect.clipboardRead("b");
    expect(a.payload["id"]).toBe("ef_1");
    expect(b.payload["id"]).toBe("ef_2");
  });

  test("fileOpenMultiple creates the right kind", () => {
    const cmd = Effect.fileOpenMultiple("multi");
    expect(cmd.payload["kind"]).toBe("file_open_multiple");
    expect(cmd.payload["tag"]).toBe("multi");
    expect(cmd.payload["timeout"]).toBe(120_000);
  });

  test("fileSave includes defaultName in payload", () => {
    const cmd = Effect.fileSave("save", { defaultName: "report.pdf" });
    const payload = cmd.payload["payload"] as Record<string, unknown>;
    expect(payload["defaultName"]).toBe("report.pdf");
  });

  test("directorySelect creates the right kind", () => {
    const cmd = Effect.directorySelect("dir", { title: "Choose folder" });
    expect(cmd.payload["kind"]).toBe("directory_select");
    expect(cmd.payload["tag"]).toBe("dir");
  });

  test("directorySelectMultiple creates the right kind", () => {
    const cmd = Effect.directorySelectMultiple("dirs");
    expect(cmd.payload["kind"]).toBe("directory_select_multiple");
  });

  test("clipboardRead has 5s timeout", () => {
    const cmd = Effect.clipboardRead("clip");
    expect(cmd.payload["kind"]).toBe("clipboard_read");
    expect(cmd.payload["timeout"]).toBe(5_000);
  });

  test("clipboardWrite includes text", () => {
    const cmd = Effect.clipboardWrite("copy", "hello");
    const payload = cmd.payload["payload"] as Record<string, unknown>;
    expect(payload["text"]).toBe("hello");
  });

  test("clipboardReadHtml has 5s timeout", () => {
    const cmd = Effect.clipboardReadHtml("html-read");
    expect(cmd.payload["kind"]).toBe("clipboard_read_html");
    expect(cmd.payload["timeout"]).toBe(5_000);
  });

  test("clipboardWriteHtml emits html and alt_text on the wire", () => {
    const cmd = Effect.clipboardWriteHtml("html-write", "<b>hi</b>", "hi");
    const payload = cmd.payload["payload"] as Record<string, unknown>;
    expect(payload["html"]).toBe("<b>hi</b>");
    expect(payload["alt_text"]).toBe("hi");
    expect(payload["altText"]).toBeUndefined();
  });

  test("clipboardWriteHtml omits alt_text when not provided", () => {
    const cmd = Effect.clipboardWriteHtml("html-write", "<b>hi</b>");
    const payload = cmd.payload["payload"] as Record<string, unknown>;
    expect(payload["html"]).toBe("<b>hi</b>");
    expect(payload["alt_text"]).toBeUndefined();
  });

  test("clipboardClear creates the right kind", () => {
    const cmd = Effect.clipboardClear("clear");
    expect(cmd.payload["kind"]).toBe("clipboard_clear");
  });

  test("clipboardReadPrimary creates the right kind", () => {
    const cmd = Effect.clipboardReadPrimary("primary");
    expect(cmd.payload["kind"]).toBe("clipboard_read_primary");
  });

  test("clipboardWritePrimary includes text", () => {
    const cmd = Effect.clipboardWritePrimary("primary-write", "selected text");
    const payload = cmd.payload["payload"] as Record<string, unknown>;
    expect(payload["text"]).toBe("selected text");
  });

  test("notification includes tag, title, body, and optional fields", () => {
    const cmd = Effect.notification("notify", "Alert", "Something happened", {
      icon: "warning",
      urgency: "critical",
      sound: "ding",
    });
    expect(cmd.payload["kind"]).toBe("notification");
    expect(cmd.payload["tag"]).toBe("notify");
    expect(cmd.payload["timeout"]).toBe(5_000);
    const payload = cmd.payload["payload"] as Record<string, unknown>;
    expect(payload["title"]).toBe("Alert");
    expect(payload["body"]).toBe("Something happened");
    expect(payload["icon"]).toBe("warning");
    expect(payload["urgency"]).toBe("critical");
    expect(payload["sound"]).toBe("ding");
  });

  test("commands are frozen", () => {
    const cmd = Effect.fileOpen("frozen");
    expect(Object.isFrozen(cmd)).toBe(true);
  });

  test("custom timeout overrides default", () => {
    const cmd = Effect.fileOpen("custom", { timeout: 300_000 });
    expect(cmd.payload["timeout"]).toBe(300_000);
  });
});
