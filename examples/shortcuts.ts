// Keyboard shortcuts example showing a scrollable log of key presses.
//
// Demonstrates:
// - Subscription.onKeyPress() for global keyboard events
// - isKey() for narrowing key events in update()
// - scrollable for overflow content with dynamic list items
// - Capped log buffer (MAX_LOG_ENTRIES)

import type { Event, KeyEvent, Modifiers } from "../src/index.js";
import { app, isKey, Subscription } from "../src/index.js";
import { column, rule, scrollable, text, window } from "../src/ui/index.js";

// -- Types --------------------------------------------------------------------

interface Model {
  log: string[];
  count: number;
}

const MAX_LOG_ENTRIES = 50;

// -- Helpers ------------------------------------------------------------------

function formatModifiers(m: Modifiers): string {
  const parts: string[] = [];
  if (m.ctrl) parts.push("Ctrl");
  if (m.alt) parts.push("Alt");
  if (m.shift) parts.push("Shift");
  if (m.logo) parts.push("Super");
  return parts.join("+");
}

function formatKeyEvent(event: KeyEvent, n: number): string {
  const mods = formatModifiers(event.modifiers);
  const key = event.key;
  const prefix = mods ? `${mods}+` : "";
  return `#${n}: ${prefix}${key}`;
}

// -- App ----------------------------------------------------------------------

export default app<Model>({
  // -- Init -------------------------------------------------------------------

  init: { log: [], count: 0 },

  // -- Subscribe --------------------------------------------------------------

  subscriptions: () => [Subscription.onKeyPress("keys")],

  // -- Update -----------------------------------------------------------------

  update(state, event: Event) {
    if (isKey(event, "press")) {
      const entry = formatKeyEvent(event, state.count + 1);
      return {
        ...state,
        log: [entry, ...state.log].slice(0, MAX_LOG_ENTRIES),
        count: state.count + 1,
      };
    }
    return state;
  },

  // -- View -------------------------------------------------------------------

  view: (s) =>
    window("main", { title: "Keyboard Shortcuts" }, [
      column({ padding: 16, spacing: 12, width: "fill" }, [
        text("header", "Press any key", { size: 20 }),
        text("count", `${s.count} key events captured`, { size: 12, color: "#888888" }),

        rule(),

        scrollable({ id: "log", height: "fill" }, [
          column(
            { spacing: 2, width: "fill" },
            s.log.map((entry, index) => text(`log_${index}`, entry, { size: 13 })),
          ),
        ]),
      ]),
    ]),
});
