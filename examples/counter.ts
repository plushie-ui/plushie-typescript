// Minimal counter example.
//
// Demonstrates:
// - Button click handling via inline handlers
// - Model updates from events
// - Basic column/row layout

import { app, type Handler, type WindowNode } from "../src/index.js";
import { button, column, row, text, window } from "../src/ui/index.js";

// -- Types --------------------------------------------------------------------

type Model = { count: number };

// -- Handlers -----------------------------------------------------------------

const inc = (s: Model): Model => ({ ...s, count: s.count + 1 });
const dec = (s: Model): Model => ({ ...s, count: s.count - 1 });

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
          button("inc", "+", { onClick: inc as Handler<unknown> }),
          button("dec", "-", { onClick: dec as Handler<unknown> }),
        ]),
      ]),
    ]) as WindowNode,
});
