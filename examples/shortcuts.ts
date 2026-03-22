// Keyboard shortcuts example.
// Demonstrates Subscription.onKeyPress, isKey() for narrowing key events,
// and displaying the last key pressed with modifier state.

import { app, Subscription, isKey } from '../src/index.js'
import type { Event, KeyEvent, Modifiers } from '../src/index.js'
import { window, column, text, rule } from '../src/ui/index.js'

interface Model {
  lastKey: string
  modifiers: string
}

function formatModifiers(m: Modifiers): string {
  const parts: string[] = []
  if (m.ctrl) parts.push("Ctrl")
  if (m.alt) parts.push("Alt")
  if (m.shift) parts.push("Shift")
  if (m.logo) parts.push("Super")
  return parts.join("+")
}

function applyKey(state: Model, event: KeyEvent): Model {
  const mods = formatModifiers(event.modifiers)
  return { lastKey: event.key, modifiers: mods }
}

export default app<Model>({
  init: { lastKey: "(none)", modifiers: "" },

  subscriptions: () => [Subscription.onKeyPress("keys")],

  update(state, event: Event) {
    if (isKey(event, "press")) return applyKey(state, event)
    return state
  },

  view: (s) => {
    const display = s.modifiers
      ? `${s.modifiers}+${s.lastKey}`
      : s.lastKey

    return window("main", { title: "Keyboard Shortcuts" }, [
      column({ padding: 16, spacing: 12, width: "fill" }, [
        text("header", "Press any key", { size: 20 }),
        rule(),
        text("label", "Last key pressed:", { size: 14, color: "#888888" }),
        text("key_display", display, { size: 24 }),
      ]),
    ])
  },
})
