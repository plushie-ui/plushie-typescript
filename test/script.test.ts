import { describe, expect, test } from "vitest"
import { parseScript, parseScriptFile } from "../src/script.js"
import { writeFileSync, unlinkSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"

describe("parseScript", () => {
  test("parses header and instructions", () => {
    const script = parseScript(`
app: Counter
viewport: 800x600
theme: dark
backend: mock
-----
click "#increment"
expect "Count: 1"
tree_hash "counter-at-1"
    `)

    expect(script.header).toEqual({
      app: "Counter",
      viewport: [800, 600],
      theme: "dark",
      backend: "mock",
    })
    expect(script.instructions).toEqual([
      { type: "click", selector: "#increment" },
      { type: "expect", text: "Count: 1" },
      { type: "tree_hash", name: "counter-at-1" },
    ])
  })

  test("skips comments and blank lines", () => {
    const script = parseScript(`
# this is a comment
app: MyApp
-----
# another comment

click "#btn"

expect "hello"
    `)

    expect(script.header.app).toBe("MyApp")
    expect(script.instructions).toHaveLength(2)
  })

  test("parses all instruction types", () => {
    const script = parseScript(`
app: Test
-----
click "#btn"
type_text "#input" "hello world"
type_key "enter"
press "ctrl+s"
release "shift"
toggle "#checkbox"
select "#dropdown" "option-2"
slide "#slider" 75
expect "visible text"
tree_hash "snapshot-name"
screenshot "shot-1"
assert_text "#label" "expected"
wait 500
move_to 100 200
    `)

    expect(script.instructions).toEqual([
      { type: "click", selector: "#btn" },
      { type: "type_text", selector: "#input", text: "hello world" },
      { type: "type_key", key: "enter" },
      { type: "press", key: "ctrl+s" },
      { type: "release", key: "shift" },
      { type: "toggle", selector: "#checkbox" },
      { type: "select", selector: "#dropdown", value: "option-2" },
      { type: "slide", selector: "#slider", value: 75 },
      { type: "expect", text: "visible text" },
      { type: "tree_hash", name: "snapshot-name" },
      { type: "screenshot", name: "shot-1" },
      { type: "assert_text", selector: "#label", text: "expected" },
      { type: "wait", ms: 500 },
      { type: "move_to", x: 100, y: 200 },
    ])
  })

  test("parses header with defaults for missing fields", () => {
    const script = parseScript(`
app: MinimalApp
-----
click "#go"
    `)

    expect(script.header.app).toBe("MinimalApp")
    expect(script.header.viewport).toBeUndefined()
    expect(script.header.theme).toBeUndefined()
    expect(script.header.backend).toBeUndefined()
  })

  test("handles script with no instructions", () => {
    const script = parseScript(`
app: Empty
-----
    `)

    expect(script.header.app).toBe("Empty")
    expect(script.instructions).toEqual([])
  })

  test("handles script with no separator (header only)", () => {
    const script = parseScript(`
app: NoBody
theme: light
    `)

    expect(script.header.app).toBe("NoBody")
    expect(script.header.theme).toBe("light")
    expect(script.instructions).toEqual([])
  })

  test("ignores unknown instructions", () => {
    const script = parseScript(`
app: Test
-----
click "#btn"
unknown_command "arg"
expect "text"
    `)

    expect(script.instructions).toHaveLength(2)
    expect(script.instructions[0]!.type).toBe("click")
    expect(script.instructions[1]!.type).toBe("expect")
  })

  test("parses 'type' shorthand for type_text and type_key", () => {
    const script = parseScript(`
app: Test
-----
type "#input" "some text"
type "enter"
    `)

    expect(script.instructions).toEqual([
      { type: "type_text", selector: "#input", text: "some text" },
      { type: "type_key", key: "enter" },
    ])
  })

  test("parses 'move' with coordinates as move_to", () => {
    const script = parseScript(`
app: Test
-----
move "100,200"
    `)

    expect(script.instructions).toEqual([
      { type: "move_to", x: 100, y: 200 },
    ])
  })

  test("parses viewport with different dimensions", () => {
    const script = parseScript(`
viewport: 1920x1080
-----
    `)

    expect(script.header.viewport).toEqual([1920, 1080])
  })

  test("handles quoted arguments with spaces", () => {
    const script = parseScript(`
app: Test
-----
assert_text "#status" "hello world"
type_text "#editor" "line 1\nline 2"
    `)

    expect(script.instructions[0]).toEqual({
      type: "assert_text",
      selector: "#status",
      text: "hello world",
    })
  })
})

describe("parseScriptFile", () => {
  test("reads and parses a file", () => {
    const dir = join(tmpdir(), `plushie-test-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
    const file = join(dir, "test.plushie")

    writeFileSync(file, `app: FileTest\n-----\nclick "#btn"\n`, "utf-8")

    try {
      const script = parseScriptFile(file)
      expect(script.header.app).toBe("FileTest")
      expect(script.instructions).toHaveLength(1)
    } finally {
      unlinkSync(file)
    }
  })
})
