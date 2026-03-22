import { app, Subscription, isTimer } from '../src/index.js'
import type { Event } from '../src/index.js'
import { window, column, text } from '../src/ui/index.js'

type Model = { time: string }

function currentTime(): string {
  return new Date().toLocaleTimeString()
}

export default app<Model>({
  init: { time: currentTime() },

  subscriptions: () => [Subscription.every(1000, "tick")],

  update(state, event: Event) {
    if (isTimer(event, "tick")) {
      return { ...state, time: currentTime() }
    }
    return state
  },

  view: (s) =>
    window("main", { title: "Clock" }, [
      column({ padding: 24, spacing: 16, width: "fill", alignX: "center" }, [
        text("clock_display", s.time, { size: 48 }),
        text("subtitle", "Updates every second", { size: 12, color: "#888888" }),
      ]),
    ]),
})
