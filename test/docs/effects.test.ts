import { expect, test, beforeEach } from "vitest"
import { Effects, COMMAND, isEffect } from "../../src/index.js"
import type { EffectEvent } from "../../src/types.js"

beforeEach(() => {
  Effects._resetIdCounter()
})

// -- File open effect --

test("effects_file_open_returns_effect_command", () => {
  const cmd = Effects.fileOpen({
    title: "Choose a file",
    filters: [["Text files", "*.txt"], ["All files", "*"]],
  })

  expect(cmd[COMMAND]).toBe(true)
  expect(cmd.type).toBe("effect")
  expect(cmd.payload["kind"]).toBe("file_open")
  expect((cmd.payload["payload"] as Record<string, unknown>)["title"]).toBe("Choose a file")
  expect(typeof cmd.payload["id"]).toBe("string")
})

// -- Default timeouts --

test("effects_file_open_default_timeout", () => {
  const cmd = Effects.fileOpen()
  expect(cmd.payload["timeout"]).toBe(120_000)
})

test("effects_clipboard_read_default_timeout", () => {
  const cmd = Effects.clipboardRead()
  expect(cmd.payload["timeout"]).toBe(5_000)
})

test("effects_notification_default_timeout", () => {
  const cmd = Effects.notification("Title", "Body")
  expect(cmd.payload["timeout"]).toBe(5_000)
})

// -- Custom timeout --

test("effects_file_open_custom_timeout", () => {
  const cmd = Effects.fileOpen({ title: "Pick a file", timeout: 300_000 })
  expect(cmd.payload["timeout"]).toBe(300_000)
})

// -- Effect result event matching --

test("effects_ok_result_match", () => {
  const event: EffectEvent = {
    kind: "effect", requestId: "ef_1", status: "ok",
    result: { path: "/tmp/notes.txt" }, error: null,
  }

  expect(isEffect(event)).toBe(true)
  expect(event.status).toBe("ok")
  const result = event.result as Record<string, string>
  expect(result["path"]).toBe("/tmp/notes.txt")
})

test("effects_cancelled_result_match", () => {
  const event: EffectEvent = {
    kind: "effect", requestId: "ef_1", status: "cancelled",
    result: null, error: null,
  }

  expect(isEffect(event)).toBe(true)
  expect(event.status).toBe("cancelled")
})

test("effects_error_result_match", () => {
  const event: EffectEvent = {
    kind: "effect", requestId: "ef_1", status: "error",
    result: null, error: "unsupported",
  }

  expect(isEffect(event)).toBe(true)
  expect(event.status).toBe("error")
  expect(event.error).toBe("unsupported")
})

// -- Multiple effect kinds --

test("effects_file_save_construct", () => {
  const cmd = Effects.fileSave({ title: "Save as", defaultName: "output.txt" })
  expect(cmd.type).toBe("effect")
  expect(cmd.payload["kind"]).toBe("file_save")
})

test("effects_clipboard_write_construct", () => {
  const cmd = Effects.clipboardWrite("Hello")
  expect(cmd.type).toBe("effect")
  expect(cmd.payload["kind"]).toBe("clipboard_write")
})

test("effects_notification_construct", () => {
  const cmd = Effects.notification("Title", "Body", {
    icon: "dialog-information",
    urgency: "normal",
  })
  expect(cmd.type).toBe("effect")
  expect(cmd.payload["kind"]).toBe("notification")
})
