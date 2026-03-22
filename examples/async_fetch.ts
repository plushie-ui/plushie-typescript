import { app, Command, isClick, isAsync } from '../src/index.js'
import type { Event, UINode } from '../src/index.js'
import { window, column, text, button } from '../src/ui/index.js'

type Status = "idle" | "loading" | "done" | "error"

interface Model {
  status: Status
  result: string | null
  error: string | null
}

// -- View helpers -----------------------------------------------------------

function statusMessage(model: Model): UINode {
  switch (model.status) {
    case "loading":
      return text("status", "Loading...", { color: "#cc8800" })
    case "done":
      return column({ spacing: 4 }, [
        text("label", "Result:", { size: 14 }),
        text("result", model.result ?? "", { color: "#22aa44" }),
      ])
    case "error":
      return text("error", `Error: ${model.error ?? "unknown"}`, { color: "#cc2222" })
    default:
      return text("status", "Press the button to start", { color: "#888888" })
  }
}

// -- App --------------------------------------------------------------------

export default app<Model>({
  init: { status: "idle", result: null, error: null },

  update(state, event: Event) {
    if (isClick(event, "fetch")) {
      const cmd = Command.async(async () => {
        // Simulate a slow network call
        await new Promise((resolve) => setTimeout(resolve, 500))
        return `Fetched at ${new Date().toLocaleTimeString()}`
      }, "fetch_result")
      return [{ ...state, status: "loading" as const, result: null, error: null }, cmd] as const
    }
    if (isAsync(event, "fetch_result")) {
      if (event.result.ok) {
        return { ...state, status: "done" as const, result: String(event.result.value) }
      }
      return { ...state, status: "error" as const, error: String(event.result.error) }
    }
    return state
  },

  view: (s) =>
    window("main", { title: "Async Fetch" }, [
      column({ padding: 24, spacing: 16, width: "fill" }, [
        text("header", "Async Command Demo", { size: 20 }),
        button("fetch", "Fetch Data"),
        statusMessage(s),
      ]),
    ]),
})
