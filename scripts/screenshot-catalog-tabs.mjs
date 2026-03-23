import { createSession, stopPool } from "../src/testing/index.js"
import { mkdirSync, writeFileSync } from "node:fs"
import { execSync } from "node:child_process"

const dir = "/tmp/plushie_ss"
mkdirSync(dir, { recursive: true })

function savePng(name, result) {
  if (!result.rgba || !(result.rgba instanceof Uint8Array || Buffer.isBuffer(result.rgba))) return
  writeFileSync(`${dir}/${name}.rgba`, result.rgba)
  execSync(`convert -size ${result.width}x${result.height} -depth 8 rgba:${dir}/${name}.rgba ${dir}/${name}.png`)
  console.log(`  -> ${dir}/${name}.png`)
}

const mod = await import("../examples/catalog.ts")
const session = await createSession(mod.default, { mode: "headless" })
await session.start()
await new Promise((r) => setTimeout(r, 400))

// Input tab
await session.click("tab_input")
await new Promise((r) => setTimeout(r, 300))
savePng("catalog-input", await session.screenshot("input"))

// Display tab
await session.click("tab_display")
await new Promise((r) => setTimeout(r, 300))
savePng("catalog-display", await session.screenshot("display"))

// Composite tab
await session.click("tab_composite")
await new Promise((r) => setTimeout(r, 300))
savePng("catalog-composite", await session.screenshot("composite"))

session.stop()
stopPool()
process.exit(0)
