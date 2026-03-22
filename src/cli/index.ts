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

function readVersion(): string {
  const require = createRequire(import.meta.url)
  const pkg = require("../../package.json") as { version: string }
  return pkg.version
}

const USAGE = `\
Usage: plushie <command> [options]

Commands:
  download          Download the precompiled plushie binary
  dev <app>         Run an app with file watching (hot reload)
  run <app>         Run an app

Options:
  --help            Show this help message
  --version         Show version number`

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
      console.log("Download not yet implemented")
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
