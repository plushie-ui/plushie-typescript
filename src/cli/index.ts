#!/usr/bin/env node

/**
 * CLI entry point for the plushie SDK.
 *
 * Supports:
 *   plushie download       -- download the precompiled binary
 *   plushie dev <app>      -- run an app with file watching
 *   plushie run <app>      -- run an app
 *   plushie --help         -- print usage
 *   plushie --version      -- print package version
 *
 * @module
 */

import { createRequire } from "node:module"
import { resolve } from "node:path"
import { platformBinaryName } from "../client/binary.js"
import { DEFAULT_WASM_DIR, WASM_JS_FILE, WASM_BG_FILE } from "../wasm.js"

function readVersion(): string {
  const require = createRequire(import.meta.url)
  const pkg = require("../../package.json") as { version: string }
  return pkg.version
}

const USAGE = `\
Usage: plushie <command> [options]

Commands:
  download          Download the precompiled plushie binary
  download --wasm   Download the WASM renderer
  dev <app>         Run an app with file watching (hot reload)
  run <app>         Run an app

Options:
  --help            Show this help message
  --version         Show version number`

const BASE_URL = "https://github.com/nicholasgasior/plushie/releases/download"

function handleDownload(flags: string[]): void {
  const version = readVersion()
  const isWasm = flags.includes("--wasm")

  if (isWasm) {
    const wasmDir = resolve(DEFAULT_WASM_DIR)
    const jsUrl = `${BASE_URL}/v${version}/${WASM_JS_FILE}`
    const bgUrl = `${BASE_URL}/v${version}/${WASM_BG_FILE}`
    console.log(`WASM renderer download (not yet automated).\n`)
    console.log(`Version:  ${version}`)
    console.log(`Dest dir: ${wasmDir}\n`)
    console.log(`Download these files manually:`)
    console.log(`  ${jsUrl}`)
    console.log(`  ${bgUrl}`)
  } else {
    const binaryName = platformBinaryName()
    const destDir = resolve("node_modules", ".plushie", "bin")
    const url = `${BASE_URL}/v${version}/${binaryName}`
    console.log(`Binary download (not yet automated).\n`)
    console.log(`Version:  ${version}`)
    console.log(`Binary:   ${binaryName}`)
    console.log(`Dest dir: ${destDir}\n`)
    console.log(`Download manually:`)
    console.log(`  ${url}`)
  }
}

function main(argv: string[]): void {
  const args = argv.slice(2)
  const command = args[0]

  if (command === "--help" || command === "-h" || command === undefined) {
    console.log(USAGE)
    return
  }

  if (command === "--version" || command === "-v") {
    console.log(readVersion())
    return
  }

  switch (command) {
    case "download":
      handleDownload(args.slice(1))
      break
    case "dev":
      if (args[1] === undefined) {
        console.error("Error: missing <app> argument\n")
        console.log(USAGE)
        process.exitCode = 1
        return
      }
      console.log("Dev server not yet implemented")
      break
    case "run":
      if (args[1] === undefined) {
        console.error("Error: missing <app> argument\n")
        console.log(USAGE)
        process.exitCode = 1
        return
      }
      console.log("Run not yet implemented")
      break
    default:
      console.error(`Unknown command: ${command}\n`)
      console.log(USAGE)
      process.exitCode = 1
  }
}

main(process.argv)
