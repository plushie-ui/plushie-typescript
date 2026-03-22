import { describe, expect, test } from "vitest"
import { Command, COMMAND } from "../src/index.js"

describe("Command", () => {
  test("none() creates a no-op command", () => {
    const cmd = Command.none()
    expect(cmd.type).toBe("none")
    expect(cmd[COMMAND]).toBe(true)
  })

  test("focus() creates a focus command with target", () => {
    const cmd = Command.focus("form/email")
    expect(cmd.type).toBe("focus")
    expect(cmd.payload).toEqual({ target: "form/email" })
  })

  test("batch() wraps multiple commands", () => {
    const cmds = Command.batch([
      Command.focus("input"),
      Command.scrollTo("list", 0, 100),
    ])
    expect(cmds.type).toBe("batch")
    const commands = cmds.payload["commands"] as unknown[]
    expect(commands).toHaveLength(2)
  })

  test("async() stores function and tag", () => {
    const fn = async () => 42
    const cmd = Command.async(fn, "result")
    expect(cmd.type).toBe("async")
    expect(cmd.payload["tag"]).toBe("result")
    expect(cmd.payload["fn"]).toBe(fn)
  })

  test("commands are frozen", () => {
    const cmd = Command.focus("x")
    expect(Object.isFrozen(cmd)).toBe(true)
  })

  test("isCommand detects commands", () => {
    expect(Command.isCommand(Command.none())).toBe(true)
    expect(Command.isCommand({ type: "none" })).toBe(false)
    expect(Command.isCommand(null)).toBe(false)
    expect(Command.isCommand("not a command")).toBe(false)
  })
})
