/**
 * Parser and runner for .plushie test scripts.
 *
 * The .plushie format is a text-based scripting language for
 * automated UI testing against the renderer.
 *
 * ## Format
 *
 *     app: MyApp
 *     viewport: 800x600
 *     theme: dark
 *     backend: mock
 *     -----
 *     click "#increment"
 *     expect "Count: 1"
 *     tree_hash "counter-at-1"
 *
 * @module
 */

import { readFileSync } from "node:fs"
import type { Session } from "./client/session.js"

export interface ScriptHeader {
  app?: string
  viewport?: [number, number]
  theme?: string
  backend?: "mock" | "headless" | "windowed"
}

export type Instruction =
  | { type: "click"; selector: string }
  | { type: "type_text"; selector: string; text: string }
  | { type: "type_key"; key: string }
  | { type: "press"; key: string }
  | { type: "release"; key: string }
  | { type: "toggle"; selector: string }
  | { type: "select"; selector: string; value: string }
  | { type: "slide"; selector: string; value: number }
  | { type: "expect"; text: string }
  | { type: "tree_hash"; name: string }
  | { type: "screenshot"; name: string }
  | { type: "assert_text"; selector: string; text: string }
  | { type: "wait"; ms: number }
  | { type: "move_to"; x: number; y: number }

export interface Script {
  header: ScriptHeader
  instructions: Instruction[]
}

export interface RunResult {
  passed: boolean
  failures: string[]
}

/**
 * Parse a .plushie script from a string.
 */
export function parseScript(content: string): Script {
  const lines = content.split("\n")
  const header: ScriptHeader = {}
  const instructions: Instruction[] = []
  let inBody = false

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (line === "" || line.startsWith("#")) continue

    if (line === "-----") {
      inBody = true
      continue
    }

    if (!inBody) {
      const colonIdx = line.indexOf(":")
      if (colonIdx !== -1) {
        const key = line.slice(0, colonIdx).trim()
        const val = line.slice(colonIdx + 1).trim()
        switch (key) {
          case "app":
            header.app = val
            break
          case "viewport": {
            const parts = val.split("x")
            const w = Number(parts[0])
            const h = Number(parts[1])
            if (w && h) header.viewport = [w, h]
            break
          }
          case "theme":
            header.theme = val
            break
          case "backend":
            if (val === "mock" || val === "headless" || val === "windowed") {
              header.backend = val
            }
            break
        }
      }
    } else {
      const instr = parseInstruction(line)
      if (instr) instructions.push(instr)
    }
  }

  return { header, instructions }
}

function parseInstruction(line: string): Instruction | null {
  const match = line.match(/^(\w+)\s+(.*)$/)
  if (!match) return null
  const cmd = match[1]
  const rest = match[2]!
  const args = parseArgs(rest)

  switch (cmd) {
    case "click":
      return { type: "click", selector: args[0] ?? "" }
    case "type_text":
      return { type: "type_text", selector: args[0] ?? "", text: args[1] ?? "" }
    case "type":
      // "type" with two args is type_text, with one arg is type_key
      if (args.length >= 2) {
        return { type: "type_text", selector: args[0] ?? "", text: args[1] ?? "" }
      }
      return { type: "type_key", key: args[0] ?? "" }
    case "type_key":
      return { type: "type_key", key: args[0] ?? "" }
    case "press":
      return { type: "press", key: args[0] ?? "" }
    case "release":
      return { type: "release", key: args[0] ?? "" }
    case "toggle":
      return { type: "toggle", selector: args[0] ?? "" }
    case "select":
      return { type: "select", selector: args[0] ?? "", value: args[1] ?? "" }
    case "slide":
      return { type: "slide", selector: args[0] ?? "", value: Number(args[1] ?? 0) }
    case "expect":
      return { type: "expect", text: args[0] ?? "" }
    case "tree_hash":
      return { type: "tree_hash", name: args[0] ?? "" }
    case "screenshot":
      return { type: "screenshot", name: args[0] ?? "" }
    case "assert_text":
      return { type: "assert_text", selector: args[0] ?? "", text: args[1] ?? "" }
    case "wait":
      return { type: "wait", ms: Number(args[0] ?? 0) }
    case "move_to":
      return { type: "move_to", x: Number(args[0] ?? 0), y: Number(args[1] ?? 0) }
    case "move": {
      // "move 100,200" -> move_to
      const target = args[0] ?? ""
      const parts = target.split(",")
      if (parts.length === 2) {
        return { type: "move_to", x: Number(parts[0]?.trim()), y: Number(parts[1]?.trim()) }
      }
      return null
    }
    default:
      return null
  }
}

function parseArgs(str: string): string[] {
  const args: string[] = []
  let i = 0
  while (i < str.length) {
    if (str[i] === '"') {
      i++
      let arg = ""
      while (i < str.length && str[i] !== '"') {
        arg += str[i]
        i++
      }
      i++ // skip closing quote
      args.push(arg)
    } else if (str[i] !== " ") {
      let arg = ""
      while (i < str.length && str[i] !== " ") {
        arg += str[i]
        i++
      }
      args.push(arg)
    } else {
      i++
    }
  }
  return args
}

/**
 * Parse a .plushie script from a file.
 */
export function parseScriptFile(filePath: string): Script {
  const content = readFileSync(filePath, "utf-8")
  return parseScript(content)
}

/**
 * Run a parsed script against a connected Session.
 *
 * Sends interact/query/tree_hash messages for each instruction
 * and collects failures.
 */
export async function runScript(
  script: Script,
  session: Session,
): Promise<RunResult> {
  const failures: string[] = []

  for (const instr of script.instructions) {
    try {
      await executeInstruction(session, instr)
    } catch (err) {
      failures.push(`${instr.type}: ${String(err)}`)
    }
  }

  return { passed: failures.length === 0, failures }
}

async function executeInstruction(
  session: Session,
  instr: Instruction,
): Promise<void> {
  switch (instr.type) {
    case "click":
      await session.sendRequest(
        { type: "interact", action: "click", selector: { by: "id", value: instr.selector }, payload: {} },
        "interact_response",
      )
      break

    case "type_text":
      await session.sendRequest(
        { type: "interact", action: "type_text", selector: { by: "id", value: instr.selector }, payload: { text: instr.text } },
        "interact_response",
      )
      break

    case "type_key":
      await session.sendRequest(
        { type: "interact", action: "type_key", selector: {}, payload: { key: instr.key } },
        "interact_response",
      )
      break

    case "press":
      await session.sendRequest(
        { type: "interact", action: "press", selector: {}, payload: { key: instr.key } },
        "interact_response",
      )
      break

    case "release":
      await session.sendRequest(
        { type: "interact", action: "release", selector: {}, payload: { key: instr.key } },
        "interact_response",
      )
      break

    case "toggle":
      await session.sendRequest(
        { type: "interact", action: "toggle", selector: { by: "id", value: instr.selector }, payload: {} },
        "interact_response",
      )
      break

    case "select":
      await session.sendRequest(
        { type: "interact", action: "select", selector: { by: "id", value: instr.selector }, payload: { value: instr.value } },
        "interact_response",
      )
      break

    case "slide":
      await session.sendRequest(
        { type: "interact", action: "slide", selector: { by: "id", value: instr.selector }, payload: { value: instr.value } },
        "interact_response",
      )
      break

    case "expect": {
      const resp = await session.sendRequest(
        { type: "query", target: "tree", selector: {} },
        "query_response",
      )
      const tree = resp.type === "query_response" ? resp.data : null
      if (!treeContainsText(tree, instr.text)) {
        throw new Error(`expected to find text "${instr.text}" in tree`)
      }
      break
    }

    case "tree_hash":
      await session.sendRequest(
        { type: "tree_hash", name: instr.name },
        "tree_hash_response",
      )
      break

    case "screenshot":
      await session.sendRequest(
        { type: "screenshot", name: instr.name },
        "screenshot_response",
      )
      break

    case "assert_text": {
      const findResp = await session.sendRequest(
        { type: "query", target: "find", selector: { by: "id", value: instr.selector } },
        "query_response",
      )
      if (findResp.type !== "query_response" || findResp.data === null) {
        throw new Error(`element "${instr.selector}" not found`)
      }
      const node = findResp.data as Record<string, unknown>
      const props = (node["props"] ?? {}) as Record<string, unknown>
      const actual =
        (typeof props["content"] === "string" ? props["content"] : null) ??
        (typeof props["label"] === "string" ? props["label"] : null) ??
        (typeof props["value"] === "string" ? props["value"] : null)
      if (actual !== instr.text) {
        throw new Error(`expected text "${instr.text}" for "${instr.selector}", got "${String(actual)}"`)
      }
      break
    }

    case "wait":
      await new Promise((resolve) => setTimeout(resolve, instr.ms))
      break

    case "move_to":
      await session.sendRequest(
        { type: "interact", action: "move_to", selector: {}, payload: { x: instr.x, y: instr.y } },
        "interact_response",
      )
      break
  }
}

/**
 * Recursively check if any node in a tree contains the given text
 * in its content, label, value, or placeholder props.
 */
function treeContainsText(node: unknown, text: string): boolean {
  if (node === null || node === undefined || typeof node !== "object") return false

  const n = node as Record<string, unknown>
  const props = (n["props"] ?? {}) as Record<string, unknown>

  const values = [
    props["content"],
    props["label"],
    props["value"],
    props["placeholder"],
  ]

  if (values.some((v) => v === text)) return true

  const children = n["children"]
  if (Array.isArray(children)) {
    return children.some((child) => treeContainsText(child, text))
  }

  return false
}
