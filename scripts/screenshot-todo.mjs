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

const mod = await import("../examples/todo.ts")
const session = await createSession(mod.default, { mode: "headless" })
await session.start()
await new Promise((r) => setTimeout(r, 400))

// Add some todos
await session.typeText("new_todo", "Buy milk")
await session.submit("new_todo")
await new Promise((r) => setTimeout(r, 200))

await session.typeText("new_todo", "Write tests")
await session.submit("new_todo")
await new Promise((r) => setTimeout(r, 200))

await session.typeText("new_todo", "Ship it")
await session.submit("new_todo")
await new Promise((r) => setTimeout(r, 200))

savePng("todo-items", await session.screenshot("items"))

// Toggle first todo
await session.toggle("todo:0")
await new Promise((r) => setTimeout(r, 200))
savePng("todo-toggled", await session.screenshot("toggled"))

session.stop()
stopPool()
process.exit(0)
