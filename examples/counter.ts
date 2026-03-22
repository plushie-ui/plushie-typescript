import { app } from '../src/index.js'
import { window, column, row, text, button } from '../src/ui/index.js'

type Model = { count: number }

const increment = (s: Model): Model => ({ ...s, count: s.count + 1 })
const decrement = (s: Model): Model => ({ ...s, count: s.count - 1 })

export default app<Model>({
  init: { count: 0 },

  view: (s) =>
    window("main", { title: "Counter" }, [
      column({ padding: 16, spacing: 8 }, [
        text("count", `Count: ${s.count}`, { size: 20 }),
        row({ spacing: 8 }, [
          button("increment", "+", { onClick: increment }),
          button("decrement", "-", { onClick: decrement }),
        ]),
      ]),
    ]),
})
