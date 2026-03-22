import { describe, expect, test } from "vitest"
import {
  rect,
  circle,
  line,
  canvasText,
  path,
  canvasImage,
  canvasSvg,
  group,
  moveTo,
  lineTo,
  bezierTo,
  quadraticTo,
  arc,
  arcTo,
  ellipse,
  roundedRect,
  close,
  pushTransform,
  popTransform,
  translate,
  rotate,
  scale,
  pushClip,
  popClip,
  stroke,
  interactive,
  linearGradient,
} from "../../src/canvas/index.js"

// -- Shapes -------------------------------------------------------------------

describe("rect", () => {
  test("creates a minimal rect", () => {
    const r = rect(10, 20, 100, 50)
    expect(r).toEqual({ type: "rect", x: 10, y: 20, w: 100, h: 50 })
  })

  test("includes fill and stroke when provided", () => {
    const s = stroke("#000", 2)
    const r = rect(0, 0, 50, 50, { fill: "#ff0000", stroke: s })
    expect(r.type).toBe("rect")
    expect(r.fill).toBe("#ff0000")
    expect(r.stroke).toEqual({ color: "#000", width: 2 })
  })

  test("includes optional radius and opacity", () => {
    const r = rect(0, 0, 100, 100, { radius: 8, opacity: 0.5 })
    expect(r.radius).toBe(8)
    expect(r.opacity).toBe(0.5)
  })

  test("omits undefined optional fields from output", () => {
    const r = rect(0, 0, 10, 10)
    expect(Object.keys(r)).toEqual(["type", "x", "y", "w", "h"])
  })

  test("includes fill_rule", () => {
    const r = rect(0, 0, 10, 10, { fill: "#000", fill_rule: "even_odd" })
    expect(r.fill_rule).toBe("even_odd")
  })
})

describe("circle", () => {
  test("creates a minimal circle", () => {
    const c = circle(50, 50, 25)
    expect(c).toEqual({ type: "circle", x: 50, y: 50, r: 25 })
  })

  test("accepts fill and stroke", () => {
    const c = circle(0, 0, 10, { fill: "#00ff00", stroke: stroke("#333", 1) })
    expect(c.fill).toBe("#00ff00")
    expect(c.stroke).toEqual({ color: "#333", width: 1 })
  })
})

describe("line", () => {
  test("creates a line with coordinates", () => {
    const l = line(0, 0, 100, 100)
    expect(l).toEqual({ type: "line", x1: 0, y1: 0, x2: 100, y2: 100 })
  })

  test("accepts stroke and opacity", () => {
    const l = line(0, 0, 50, 50, { stroke: stroke("#999", 3), opacity: 0.7 })
    expect(l.stroke).toEqual({ color: "#999", width: 3 })
    expect(l.opacity).toBe(0.7)
  })
})

describe("canvasText", () => {
  test("creates text with position and content", () => {
    const t = canvasText(10, 20, "Hello")
    expect(t).toEqual({ type: "text", x: 10, y: 20, content: "Hello" })
  })

  test("accepts fill, size, font, alignment", () => {
    const t = canvasText(0, 0, "Centered", {
      fill: "#000",
      size: 16,
      font: "monospace",
      align_x: "center",
      align_y: "bottom",
    })
    expect(t.fill).toBe("#000")
    expect(t.size).toBe(16)
    expect(t.font).toBe("monospace")
    expect(t.align_x).toBe("center")
    expect(t.align_y).toBe("bottom")
  })
})

describe("path", () => {
  test("creates a path from commands", () => {
    const p = path([moveTo(0, 0), lineTo(100, 0), close()])
    expect(p.type).toBe("path")
    expect(p.commands).toEqual([["move_to", 0, 0], ["line_to", 100, 0], "close"])
  })

  test("accepts fill and stroke", () => {
    const p = path([moveTo(0, 0)], { fill: "#0088ff", stroke: stroke("#000", 2) })
    expect(p.fill).toBe("#0088ff")
    expect(p.stroke).toEqual({ color: "#000", width: 2 })
  })
})

describe("canvasImage", () => {
  test("creates an image shape", () => {
    const img = canvasImage("photo.png", 10, 20, 200, 150)
    expect(img).toEqual({ type: "image", source: "photo.png", x: 10, y: 20, w: 200, h: 150 })
  })

  test("accepts rotation and opacity", () => {
    const img = canvasImage("icon.png", 0, 0, 32, 32, { rotation: Math.PI / 4, opacity: 0.8 })
    expect(img.rotation).toBe(Math.PI / 4)
    expect(img.opacity).toBe(0.8)
  })
})

describe("canvasSvg", () => {
  test("creates an SVG shape", () => {
    const s = canvasSvg("logo.svg", 0, 0, 100, 100)
    expect(s).toEqual({ type: "svg", source: "logo.svg", x: 0, y: 0, w: 100, h: 100 })
  })
})

describe("group", () => {
  test("wraps children", () => {
    const g = group([circle(0, 0, 5), rect(10, 10, 20, 20)])
    expect(g.type).toBe("group")
    expect(g.children).toHaveLength(2)
  })

  test("accepts x, y offset", () => {
    const g = group([rect(0, 0, 10, 10)], { x: 50, y: 100 })
    expect(g.x).toBe(50)
    expect(g.y).toBe(100)
  })

  test("omits x/y when not provided", () => {
    const g = group([])
    expect(Object.keys(g)).toEqual(["type", "children"])
  })
})

// -- Path commands ------------------------------------------------------------

describe("path commands", () => {
  test("moveTo", () => {
    expect(moveTo(10, 20)).toEqual(["move_to", 10, 20])
  })

  test("lineTo", () => {
    expect(lineTo(30, 40)).toEqual(["line_to", 30, 40])
  })

  test("bezierTo", () => {
    expect(bezierTo(1, 2, 3, 4, 5, 6)).toEqual(["bezier_to", 1, 2, 3, 4, 5, 6])
  })

  test("quadraticTo", () => {
    expect(quadraticTo(10, 20, 30, 40)).toEqual(["quadratic_to", 10, 20, 30, 40])
  })

  test("arc", () => {
    expect(arc(50, 50, 25, 0, Math.PI)).toEqual(["arc", 50, 50, 25, 0, Math.PI])
  })

  test("arcTo", () => {
    expect(arcTo(0, 0, 100, 100, 10)).toEqual(["arc_to", 0, 0, 100, 100, 10])
  })

  test("ellipse", () => {
    expect(ellipse(50, 50, 30, 20, 0, 0, Math.PI * 2)).toEqual(
      ["ellipse", 50, 50, 30, 20, 0, 0, Math.PI * 2],
    )
  })

  test("roundedRect", () => {
    expect(roundedRect(0, 0, 100, 50, 8)).toEqual(["rounded_rect", 0, 0, 100, 50, 8])
  })

  test("close", () => {
    expect(close()).toBe("close")
  })
})

// -- Transform/clip commands --------------------------------------------------

describe("transform commands", () => {
  test("pushTransform / popTransform", () => {
    expect(pushTransform()).toEqual({ type: "push_transform" })
    expect(popTransform()).toEqual({ type: "pop_transform" })
  })

  test("translate", () => {
    expect(translate(100, 200)).toEqual({ type: "translate", x: 100, y: 200 })
  })

  test("rotate", () => {
    expect(rotate(Math.PI / 4)).toEqual({ type: "rotate", angle: Math.PI / 4 })
  })

  test("scale with two args", () => {
    expect(scale(2, 3)).toEqual({ type: "scale", x: 2, y: 3 })
  })

  test("scale with one arg uses uniform scaling", () => {
    expect(scale(2)).toEqual({ type: "scale", x: 2, y: 2 })
  })

  test("pushClip / popClip", () => {
    expect(pushClip(10, 10, 100, 80)).toEqual({ type: "push_clip", x: 10, y: 10, w: 100, h: 80 })
    expect(popClip()).toEqual({ type: "pop_clip" })
  })
})

// -- Stroke -------------------------------------------------------------------

describe("stroke", () => {
  test("minimal stroke", () => {
    expect(stroke("#000", 2)).toEqual({ color: "#000", width: 2 })
  })

  test("stroke with cap, join, dash", () => {
    const s = stroke("#fff", 3, {
      cap: "round",
      join: "bevel",
      dash: { segments: [5, 3], offset: 0 },
    })
    expect(s.cap).toBe("round")
    expect(s.join).toBe("bevel")
    expect(s.dash).toEqual({ segments: [5, 3], offset: 0 })
  })

  test("omits undefined optional fields", () => {
    const s = stroke("#000", 1)
    expect(Object.keys(s)).toEqual(["color", "width"])
  })
})

// -- Interactive --------------------------------------------------------------

describe("interactive", () => {
  test("attaches interactive descriptor to a shape", () => {
    const r = rect(0, 0, 100, 40, { fill: "#3498db" })
    const ir = interactive(r, { id: "btn", on_click: true, cursor: "pointer" })
    expect(ir.type).toBe("rect")
    expect(ir.fill).toBe("#3498db")
    expect(ir.interactive).toEqual({ id: "btn", on_click: true, cursor: "pointer" })
  })

  test("omits unset interactive fields", () => {
    const c = circle(0, 0, 10)
    const ic = interactive(c, { id: "dot" })
    expect(Object.keys(ic.interactive)).toEqual(["id"])
  })

  test("includes drag options", () => {
    const r = rect(0, 0, 50, 50)
    const ir = interactive(r, {
      id: "handle",
      draggable: true,
      drag_axis: "x",
      drag_bounds: { min_x: 0, max_x: 200 },
    })
    expect(ir.interactive.draggable).toBe(true)
    expect(ir.interactive.drag_axis).toBe("x")
    expect(ir.interactive.drag_bounds).toEqual({ min_x: 0, max_x: 200 })
  })
})

// -- Gradient -----------------------------------------------------------------

describe("linearGradient", () => {
  test("builds gradient wire format", () => {
    const g = linearGradient([0, 0], [200, 0], [
      { offset: 0, color: "#ff0000" },
      { offset: 1, color: "#0000ff" },
    ])
    expect(g).toEqual({
      type: "linear",
      start: [0, 0],
      end: [200, 0],
      stops: [[0, "#ff0000"], [1, "#0000ff"]],
    })
  })

  test("works as a fill value for rect", () => {
    const grad = linearGradient([0, 0], [100, 0], [
      { offset: 0, color: "#000" },
      { offset: 1, color: "#fff" },
    ])
    const r = rect(0, 0, 100, 50, { fill: grad })
    expect(r.fill).toBe(grad)
  })
})
