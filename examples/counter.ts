// Minimal counter example.
//
// Demonstrates:
// - Button click handling via inline handlers
// - Model updates from events
// - Basic column/row layout

import { app } from "../src/index.js";
import { button, column, row, text, window } from "../src/ui/index.js";

// -- Types --------------------------------------------------------------------

type Model = { count: number };

// -- Handlers -----------------------------------------------------------------

const increment = (s: Model): Model => ({ ...s, count: s.count + 1 });
const decrement = (s: Model): Model => ({ ...s, count: s.count - 1 });

// -- App ----------------------------------------------------------------------

export default app<Model>({
  // -- Init -------------------------------------------------------------------

  init: { count: 0 },

  // -- View -------------------------------------------------------------------

  view: (s) =>
    window("main", { title: "Counter" }, [
      column({ padding: 16, spacing: 8 }, [
        text("count", `Count: ${s.count}`),

        row({ spacing: 8 }, [
          button("increment", "+", { onClick: increment }),
          button("decrement", "-", { onClick: decrement }),
        ]),
      ]),
    ]),
});
