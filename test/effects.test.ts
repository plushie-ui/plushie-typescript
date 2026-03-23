import { beforeEach, describe, expect, test } from "vitest";
import { COMMAND, Effects } from "../src/index.js";

beforeEach(() => {
  Effects._resetIdCounter();
});

describe("Effects", () => {
  test("fileOpen creates an effect command with monotonic ID", () => {
    const cmd = Effects.fileOpen({ title: "Pick a file" });
    expect(cmd[COMMAND]).toBe(true);
    expect(cmd.type).toBe("effect");
    expect(cmd.payload["kind"]).toBe("file_open");
    expect(cmd.payload["id"]).toBe("ef_1");
    expect(cmd.payload["timeout"]).toBe(120_000);
    expect((cmd.payload["payload"] as Record<string, unknown>)["title"]).toBe("Pick a file");
  });

  test("IDs are monotonically increasing", () => {
    const a = Effects.fileOpen();
    const b = Effects.clipboardRead();
    expect(a.payload["id"]).toBe("ef_1");
    expect(b.payload["id"]).toBe("ef_2");
  });

  test("fileOpenMultiple creates the right kind", () => {
    const cmd = Effects.fileOpenMultiple();
    expect(cmd.payload["kind"]).toBe("file_open_multiple");
    expect(cmd.payload["timeout"]).toBe(120_000);
  });

  test("fileSave includes defaultName in payload", () => {
    const cmd = Effects.fileSave({ defaultName: "report.pdf" });
    const payload = cmd.payload["payload"] as Record<string, unknown>;
    expect(payload["defaultName"]).toBe("report.pdf");
  });

  test("directorySelect creates the right kind", () => {
    const cmd = Effects.directorySelect({ title: "Choose folder" });
    expect(cmd.payload["kind"]).toBe("directory_select");
  });

  test("directorySelectMultiple creates the right kind", () => {
    const cmd = Effects.directorySelectMultiple();
    expect(cmd.payload["kind"]).toBe("directory_select_multiple");
  });

  test("clipboardRead has 5s timeout", () => {
    const cmd = Effects.clipboardRead();
    expect(cmd.payload["kind"]).toBe("clipboard_read");
    expect(cmd.payload["timeout"]).toBe(5_000);
  });

  test("clipboardWrite includes text", () => {
    const cmd = Effects.clipboardWrite("hello");
    const payload = cmd.payload["payload"] as Record<string, unknown>;
    expect(payload["text"]).toBe("hello");
  });

  test("clipboardReadHtml has 5s timeout", () => {
    const cmd = Effects.clipboardReadHtml();
    expect(cmd.payload["kind"]).toBe("clipboard_read_html");
    expect(cmd.payload["timeout"]).toBe(5_000);
  });

  test("clipboardWriteHtml includes html and optional altText", () => {
    const cmd = Effects.clipboardWriteHtml("<b>hi</b>", "hi");
    const payload = cmd.payload["payload"] as Record<string, unknown>;
    expect(payload["html"]).toBe("<b>hi</b>");
    expect(payload["altText"]).toBe("hi");
  });

  test("clipboardWriteHtml omits altText when not provided", () => {
    const cmd = Effects.clipboardWriteHtml("<b>hi</b>");
    const payload = cmd.payload["payload"] as Record<string, unknown>;
    expect(payload["html"]).toBe("<b>hi</b>");
    expect(payload["altText"]).toBeUndefined();
  });

  test("clipboardClear creates the right kind", () => {
    const cmd = Effects.clipboardClear();
    expect(cmd.payload["kind"]).toBe("clipboard_clear");
  });

  test("clipboardReadPrimary creates the right kind", () => {
    const cmd = Effects.clipboardReadPrimary();
    expect(cmd.payload["kind"]).toBe("clipboard_read_primary");
  });

  test("clipboardWritePrimary includes text", () => {
    const cmd = Effects.clipboardWritePrimary("selected text");
    const payload = cmd.payload["payload"] as Record<string, unknown>;
    expect(payload["text"]).toBe("selected text");
  });

  test("notification includes title, body, and optional fields", () => {
    const cmd = Effects.notification("Alert", "Something happened", {
      icon: "warning",
      urgency: "critical",
      sound: "ding",
    });
    expect(cmd.payload["kind"]).toBe("notification");
    expect(cmd.payload["timeout"]).toBe(5_000);
    const payload = cmd.payload["payload"] as Record<string, unknown>;
    expect(payload["title"]).toBe("Alert");
    expect(payload["body"]).toBe("Something happened");
    expect(payload["icon"]).toBe("warning");
    expect(payload["urgency"]).toBe("critical");
    expect(payload["sound"]).toBe("ding");
  });

  test("commands are frozen", () => {
    const cmd = Effects.fileOpen();
    expect(Object.isFrozen(cmd)).toBe(true);
  });

  test("custom timeout overrides default", () => {
    const cmd = Effects.fileOpen({ timeout: 300_000 });
    expect(cmd.payload["timeout"]).toBe(300_000);
  });
});
