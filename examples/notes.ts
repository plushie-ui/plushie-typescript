// Simple text editor example.
// Demonstrates TextEditor widget with syntax highlighting and onInput handling.

import { app } from '../src/index.js'
import type { Handler, WidgetEvent } from '../src/index.js'
import { window, column, text, textEditor } from '../src/ui/index.js'

interface Model {
  content: string
}

const onEdit: Handler<Model> = (_s, e: WidgetEvent) => ({ content: String(e.value) })

export default app<Model>({
  init: { content: "" },

  view: (s) => {
    const lines = s.content.split("\n").length
    const chars = s.content.length

    return window("main", { title: "Notes" }, [
      column({ padding: 16, spacing: 12, width: "fill" }, [
        text("header", "Notes", { size: 20 }),
        text("stats", `${lines} lines, ${chars} chars`, { size: 12, color: "#888888" }),
        textEditor("editor", {
          content: s.content,
          placeholder: "Start typing...",
          width: "fill",
          height: "fill",
          highlightSyntax: "markdown",
          onInput: onEdit,
        }),
      ]),
    ])
  },
})
