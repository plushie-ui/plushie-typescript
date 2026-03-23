import { createSession, stopPool } from "../src/testing/index.js"
import { mkdirSync, writeFileSync } from "node:fs"
import { execSync } from "node:child_process"

const dir = "/tmp/plushie_screenshots/examples"
mkdirSync(dir, { recursive: true })

function savePng(name, result) {
  if (!result.rgba || !(result.rgba instanceof Uint8Array || Buffer.isBuffer(result.rgba))) return
  const rgbaPath = `${dir}/${name}.rgba`
  writeFileSync(rgbaPath, result.rgba)
  execSync(`convert -size ${result.width}x${result.height} -depth 8 rgba:${rgbaPath} ${dir}/${name}.png`)
  console.log(`  -> ${dir}/${name}.png`)
}

async function screenshotApp(name) {
  console.log(`Screenshotting ${name}...`)
  const mod = await import(`../examples/${name}.ts`)
  const session = await createSession(mod.default, { mode: "headless" })
  await session.start()
  await new Promise((r) => setTimeout(r, 400))
  savePng(name, await session.screenshot("verify"))
  session.stop()
  stopPool()
}

const examples = [
  "counter", "clock", "todo", "notes", "shortcuts",
  "async_fetch", "color_picker", "catalog", "rate_plushie",
]

for (const name of examples) {
  try {
    await screenshotApp(name)
  } catch (e) {
    console.log(`  FAILED: ${e.message}`)
    stopPool()
  }
}

process.exit(0)
