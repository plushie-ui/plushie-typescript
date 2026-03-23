import { createSession, stopPool } from "../src/testing/index.js"
import { mkdirSync, writeFileSync } from "node:fs"
import { execSync } from "node:child_process"

const dir = "/tmp/plushie_ss"
mkdirSync(dir, { recursive: true })

function savePng(name, result) {
  if (!result.rgba || !(result.rgba instanceof Uint8Array || Buffer.isBuffer(result.rgba))) return
  writeFileSync(`${dir}/${name}.rgba`, result.rgba)
  execSync(`convert -size ${result.width}x${result.height} -depth 8 rgba:${dir}/${name}.rgba ${dir}/${name}.png`)
}

const mod = await import("../examples/catalog.ts")
const session = await createSession(mod.default, { mode: "headless" })
await session.start()
await new Promise((r) => setTimeout(r, 400))

console.log("Before click:", session.model().activeTab)

await session.click("tab_display")
await new Promise((r) => setTimeout(r, 300))

console.log("After click:", session.model().activeTab)
savePng("catalog-display2", await session.screenshot("display2"))

session.stop()
stopPool()
process.exit(0)
