import { createSession, stopPool } from "../src/testing/index.js"
import { mkdirSync, writeFileSync, existsSync } from "node:fs"
import { execSync } from "node:child_process"

const name = process.argv[2] ?? "counter"
const dir = "/tmp/plushie_ss"
mkdirSync(dir, { recursive: true })

console.log(`Loading ${name}...`)
const mod = await import(`../examples/${name}.ts`)
const session = await createSession(mod.default, { mode: "headless" })
await session.start()
await new Promise((r) => setTimeout(r, 500))

const result = await session.screenshot("verify")
console.log(`Screenshot: ${result.width}x${result.height}`)

if (result.rgba && (result.rgba instanceof Uint8Array || Buffer.isBuffer(result.rgba))) {
  const rgbaPath = `${dir}/${name}.rgba`
  writeFileSync(rgbaPath, result.rgba)
  console.log(`RGBA size: ${result.rgba.length} bytes`)

  const pngPath = `${dir}/${name}.png`
  try {
    execSync(`convert -size ${result.width}x${result.height} -depth 8 rgba:${rgbaPath} ${pngPath}`, { stdio: "pipe" })
    console.log(`PNG: ${pngPath} exists=${existsSync(pngPath)}`)
  } catch (e) {
    console.log(`convert failed: ${e.message}`)
  }
}

session.stop()
stopPool()
process.exit(0)
