// Clock example showing the current time, updated every second.
//
// Demonstrates:
// - Subscription.every() for timer-based updates
// - isTimer() for narrowing timer events in update()
// - Simple model with derived display value

import { app, Subscription, isTimer } from '../src/index.js'
import type { Event } from '../src/index.js'
import { window, column, text } from '../src/ui/index.js'

// -- Types --------------------------------------------------------------------

type Model = { time: string }

// -- Helpers ------------------------------------------------------------------

function currentTime(): string {
  return new Date().toLocaleTimeString()
}

// -- App ----------------------------------------------------------------------

export default app<Model>({
  // -- Init -------------------------------------------------------------------

  init: { time: currentTime() },

  // -- Subscribe --------------------------------------------------------------

  subscriptions: () => [Subscription.every(1000, "tick")],

  // -- Update -----------------------------------------------------------------

  update(state, event: Event) {
    if (isTimer(event, "tick")) {
      return { ...state, time: currentTime() }
    }
    return state
  },

  // -- View -------------------------------------------------------------------

  view: (s) =>
    window("main", { title: "Clock" }, [
      column({ padding: 24, spacing: 16, width: "fill", alignX: "center" }, [
        text("clock_display", s.time, { size: 48 }),
        text("subtitle", "Updates every second", { size: 12, color: "#888888" }),
      ]),
    ]),
})
