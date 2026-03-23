/**
 * Shared prop types for the widget builder layer.
 *
 * These types represent values as they appear in the TypeScript API.
 * Encoding functions convert them to wire-compatible format before
 * sending to the renderer.
 *
 * @module
 */

// =========================================================================
// Length
// =========================================================================

/**
 * Size dimension: fixed pixels, fill available space, or shrink to content.
 *
 * - `number` -- exact pixel size
 * - `'fill'` -- fill available space (weight 1)
 * - `'shrink'` -- shrink to content
 * - `{ fillPortion: n }` -- fill with weight n
 */
export type Length = number | "fill" | "shrink" | { fillPortion: number }

/** Encode a Length to its wire representation. */
export function encodeLength(value: Length): unknown {
  if (typeof value === "number") return value
  if (value === "fill") return "fill"
  if (value === "shrink") return "shrink"
  return { fill_portion: value.fillPortion }
}

// =========================================================================
// Padding
// =========================================================================

/**
 * Padding specification.
 *
 * - `number` -- uniform padding on all sides
 * - `[vertical, horizontal]` -- symmetric padding
 * - `[top, right, bottom, left]` -- per-side padding
 * - `{ top?, right?, bottom?, left? }` -- per-side with named fields
 */
export type Padding =
  | number
  | [number, number]
  | [number, number, number, number]
  | { top?: number; right?: number; bottom?: number; left?: number }

/** Encode Padding to its wire representation. */
export function encodePadding(value: Padding): unknown {
  if (typeof value === "number") return value
  if (Array.isArray(value)) return value
  // Named fields: send as [top, right, bottom, left]
  return [value.top ?? 0, value.right ?? 0, value.bottom ?? 0, value.left ?? 0]
}

// =========================================================================
// Color
// =========================================================================

/**
 * Color specification.
 *
 * Accepts hex strings (`"#rrggbb"`, `"#rrggbbaa"`, `"#rgb"`, `"#rgba"`),
 * CSS named colors (`"red"`, `"cornflowerblue"`, `"transparent"`), or
 * RGB/RGBA objects (`{ r, g, b, a? }` with values 0.0-1.0).
 */
export type Color =
  | string
  | { r: number; g: number; b: number; a?: number }

// Complete set of CSS named colors -> hex mapping.
// Used by encodeColor to normalize named colors to canonical hex.
const NAMED_COLORS: Record<string, string> = {
  aliceblue: "#f0f8ff", antiquewhite: "#faebd7", aqua: "#00ffff",
  aquamarine: "#7fffd4", azure: "#f0ffff", beige: "#f5f5dc",
  bisque: "#ffe4c4", black: "#000000", blanchedalmond: "#ffebcd",
  blue: "#0000ff", blueviolet: "#8a2be2", brown: "#a52a2a",
  burlywood: "#deb887", cadetblue: "#5f9ea0", chartreuse: "#7fff00",
  chocolate: "#d2691e", coral: "#ff7f50", cornflowerblue: "#6495ed",
  cornsilk: "#fff8dc", crimson: "#dc143c", cyan: "#00ffff",
  darkblue: "#00008b", darkcyan: "#008b8b", darkgoldenrod: "#b8860b",
  darkgray: "#a9a9a9", darkgrey: "#a9a9a9", darkgreen: "#006400",
  darkkhaki: "#bdb76b", darkmagenta: "#8b008b", darkolivegreen: "#556b2f",
  darkorange: "#ff8c00", darkorchid: "#9932cc", darkred: "#8b0000",
  darksalmon: "#e9967a", darkseagreen: "#8fbc8f", darkslateblue: "#483d8b",
  darkslategray: "#2f4f4f", darkslategrey: "#2f4f4f",
  darkturquoise: "#00ced1", darkviolet: "#9400d3", deeppink: "#ff1493",
  deepskyblue: "#00bfff", dimgray: "#696969", dimgrey: "#696969",
  dodgerblue: "#1e90ff", firebrick: "#b22222", floralwhite: "#fffaf0",
  forestgreen: "#228b22", fuchsia: "#ff00ff", gainsboro: "#dcdcdc",
  ghostwhite: "#f8f8ff", gold: "#ffd700", goldenrod: "#daa520",
  gray: "#808080", grey: "#808080", green: "#008000",
  greenyellow: "#adff2f", honeydew: "#f0fff0", hotpink: "#ff69b4",
  indianred: "#cd5c5c", indigo: "#4b0082", ivory: "#fffff0",
  khaki: "#f0e68c", lavender: "#e6e6fa", lavenderblush: "#fff0f5",
  lawngreen: "#7cfc00", lemonchiffon: "#fffacd", lightblue: "#add8e6",
  lightcoral: "#f08080", lightcyan: "#e0ffff",
  lightgoldenrodyellow: "#fafad2", lightgray: "#d3d3d3",
  lightgrey: "#d3d3d3", lightgreen: "#90ee90", lightpink: "#ffb6c1",
  lightsalmon: "#ffa07a", lightseagreen: "#20b2aa",
  lightskyblue: "#87cefa", lightslategray: "#778899",
  lightslategrey: "#778899", lightsteelblue: "#b0c4de",
  lightyellow: "#ffffe0", lime: "#00ff00", limegreen: "#32cd32",
  linen: "#faf0e6", magenta: "#ff00ff", maroon: "#800000",
  mediumaquamarine: "#66cdaa", mediumblue: "#0000cd",
  mediumorchid: "#ba55d3", mediumpurple: "#9370db",
  mediumseagreen: "#3cb371", mediumslateblue: "#7b68ee",
  mediumspringgreen: "#00fa9a", mediumturquoise: "#48d1cc",
  mediumvioletred: "#c71585", midnightblue: "#191970",
  mintcream: "#f5fffa", mistyrose: "#ffe4e1", moccasin: "#ffe4b5",
  navajowhite: "#ffdead", navy: "#000080", oldlace: "#fdf5e6",
  olive: "#808000", olivedrab: "#6b8e23", orange: "#ffa500",
  orangered: "#ff4500", orchid: "#da70d6", palegoldenrod: "#eee8aa",
  palegreen: "#98fb98", paleturquoise: "#afeeee",
  palevioletred: "#db7093", papayawhip: "#ffefd5", peachpuff: "#ffdab9",
  peru: "#cd853f", pink: "#ffc0cb", plum: "#dda0dd",
  powderblue: "#b0e0e6", purple: "#800080", rebeccapurple: "#663399",
  red: "#ff0000", rosybrown: "#bc8f8f", royalblue: "#4169e1",
  saddlebrown: "#8b4513", salmon: "#fa8072", sandybrown: "#f4a460",
  seagreen: "#2e8b57", seashell: "#fff5ee", sienna: "#a0522d",
  silver: "#c0c0c0", skyblue: "#87ceeb", slateblue: "#6a5acd",
  slategray: "#708090", slategrey: "#708090", snow: "#fffafa",
  springgreen: "#00ff7f", steelblue: "#4682b4", tan: "#d2b48c",
  teal: "#008080", thistle: "#d8bfd8", tomato: "#ff6347",
  transparent: "#00000000", turquoise: "#40e0d0", violet: "#ee82ee",
  wheat: "#f5deb3", white: "#ffffff", whitesmoke: "#f5f5f5",
  yellow: "#ffff00", yellowgreen: "#9acd32",
}

/**
 * Encode a Color to its canonical wire representation.
 *
 * All colors are normalized to `"#rrggbb"` or `"#rrggbbaa"` hex format
 * for the wire protocol.
 *
 * @throws {Error} If the color value is not a recognized format.
 */
export function encodeColor(value: Color): string {
  if (typeof value === "object") {
    const r = Math.round(value.r * 255)
    const g = Math.round(value.g * 255)
    const b = Math.round(value.b * 255)
    if (value.a !== undefined && value.a < 1) {
      const a = Math.round(value.a * 255)
      return `#${hex2(r)}${hex2(g)}${hex2(b)}${hex2(a)}`
    }
    return `#${hex2(r)}${hex2(g)}${hex2(b)}`
  }

  // Named color lookup (case-insensitive)
  const named = NAMED_COLORS[value.toLowerCase()]
  if (named !== undefined) return named

  // Already hex -- normalize short forms
  if (value.startsWith("#")) {
    const h = value.slice(1)
    if (h.length === 3) {
      return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`
    }
    if (h.length === 4) {
      return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`
    }
    if (h.length === 6 || h.length === 8) {
      return value.toLowerCase()
    }
  }

  // Pass through unrecognized strings (renderer may handle them)
  return value
}

function hex2(n: number): string {
  return n.toString(16).padStart(2, "0")
}

// =========================================================================
// Gradient
// =========================================================================

/**
 * Linear gradient specification.
 *
 * Defines a gradient with an angle (in degrees) and a list of color stops.
 * Each stop has an offset (0.0-1.0) and a color.
 */
export interface Gradient {
  type: 'linear'
  angle: number
  stops: Array<{ offset: number; color: Color }>
}

/** Encode a Gradient to its wire representation. */
export function encodeGradient(value: Gradient): Record<string, unknown> {
  return {
    type: value.type,
    angle: value.angle,
    stops: value.stops.map(s => ({ offset: s.offset, color: encodeColor(s.color) })),
  }
}

// =========================================================================
// Font
// =========================================================================

/** Font weight names supported by the renderer. */
export type FontWeight =
  | "thin" | "extra_light" | "light" | "normal" | "medium"
  | "semi_bold" | "bold" | "extra_bold" | "black"

/** Font style. */
export type FontStyle = "normal" | "italic" | "oblique"

/** Font stretch. */
export type FontStretch =
  | "ultra_condensed" | "extra_condensed" | "condensed" | "semi_condensed"
  | "normal"
  | "semi_expanded" | "expanded" | "extra_expanded" | "ultra_expanded"

/**
 * Font specification.
 *
 * - `'default'` -- system default font
 * - `'monospace'` -- system monospace font
 * - `string` -- font family name
 * - Object with family, weight, style, stretch
 */
export type Font =
  | "default"
  | "monospace"
  | string
  | { family: string; weight?: FontWeight; style?: FontStyle; stretch?: FontStretch }

/** Convert a snake_case string to PascalCase (e.g. "semi_bold" -> "SemiBold"). */
function toPascalCase(snakeCase: string): string {
  return snakeCase.split("_").map(s => s.charAt(0).toUpperCase() + s.slice(1)).join("")
}

/** Encode a Font to its wire representation. */
export function encodeFont(value: Font): unknown {
  if (typeof value === "string") {
    if (value === "default" || value === "monospace") return value
    return { family: value }
  }
  const result: Record<string, unknown> = { family: value.family }
  if (value.weight !== undefined) result["weight"] = toPascalCase(value.weight)
  if (value.style !== undefined) result["style"] = toPascalCase(value.style)
  if (value.stretch !== undefined) result["stretch"] = toPascalCase(value.stretch)
  return result
}

// =========================================================================
// Alignment
// =========================================================================

/**
 * Alignment values. `start`/`center`/`end` are the canonical forms.
 * `left`/`right` are aliases for horizontal alignment.
 * `top`/`bottom` are aliases for vertical alignment.
 */
export type Alignment = "start" | "center" | "end" | "left" | "right" | "top" | "bottom"

/** Normalize alignment to renderer-expected values. */
export function encodeAlignment(value: Alignment): string {
  switch (value) {
    case "left": return "start"
    case "right": return "end"
    case "top": return "start"
    case "bottom": return "end"
    default: return value
  }
}

// =========================================================================
// Border
// =========================================================================

/** Per-corner border radius. */
export interface CornerRadius {
  topLeft?: number
  topRight?: number
  bottomRight?: number
  bottomLeft?: number
}

/**
 * Border specification.
 */
export interface Border {
  color?: Color
  width?: number
  radius?: number | CornerRadius
}

/** Encode a Border to its wire representation. */
export function encodeBorder(value: Border): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  if (value.color !== undefined) result["color"] = encodeColor(value.color)
  if (value.width !== undefined) result["width"] = value.width
  if (value.radius !== undefined) {
    if (typeof value.radius === "number") {
      result["radius"] = value.radius
    } else {
      result["radius"] = {
        top_left: value.radius.topLeft ?? 0,
        top_right: value.radius.topRight ?? 0,
        bottom_right: value.radius.bottomRight ?? 0,
        bottom_left: value.radius.bottomLeft ?? 0,
      }
    }
  }
  return result
}

// =========================================================================
// Shadow
// =========================================================================

/**
 * Drop shadow specification.
 */
export interface Shadow {
  color?: Color
  offsetX?: number
  offsetY?: number
  blurRadius?: number
}

/** Encode a Shadow to its wire representation. */
export function encodeShadow(value: Shadow): Record<string, unknown> {
  return {
    color: value.color !== undefined ? encodeColor(value.color) : "#000000",
    offset: [value.offsetX ?? 0, value.offsetY ?? 0],
    blur_radius: value.blurRadius ?? 0,
  }
}

// =========================================================================
// StyleMap
// =========================================================================

/** Status-specific style overrides (hover, press, disable, focus). */
export interface StatusOverride {
  background?: Color | Gradient
  textColor?: Color
  border?: Border
  shadow?: Shadow
}

/**
 * Per-widget style customization.
 *
 * A string value is a preset name (e.g., `"primary"`, `"danger"`).
 * An object allows full customization with optional status overrides.
 */
export type StyleMap =
  | string
  | {
      base?: string
      background?: Color | Gradient
      textColor?: Color
      border?: Border
      shadow?: Shadow
      hovered?: StatusOverride
      pressed?: StatusOverride
      disabled?: StatusOverride
      focused?: StatusOverride
    }

/** Encode a Color or Gradient to its wire representation. */
export function encodeBackground(value: Color | Gradient): unknown {
  if (typeof value === "object" && "type" in value && value.type === "linear") {
    return encodeGradient(value as Gradient)
  }
  return encodeColor(value as Color)
}

/** Encode a StyleMap to its wire representation. */
export function encodeStyleMap(value: StyleMap): unknown {
  if (typeof value === "string") return value
  const result: Record<string, unknown> = {}
  if (value.base !== undefined) result["base"] = value.base
  if (value.background !== undefined) result["background"] = encodeBackground(value.background)
  if (value.textColor !== undefined) result["text_color"] = encodeColor(value.textColor)
  if (value.border !== undefined) result["border"] = encodeBorder(value.border)
  if (value.shadow !== undefined) result["shadow"] = encodeShadow(value.shadow)
  if (value.hovered !== undefined) result["hovered"] = encodeStatusOverride(value.hovered)
  if (value.pressed !== undefined) result["pressed"] = encodeStatusOverride(value.pressed)
  if (value.disabled !== undefined) result["disabled"] = encodeStatusOverride(value.disabled)
  if (value.focused !== undefined) result["focused"] = encodeStatusOverride(value.focused)
  return result
}

function encodeStatusOverride(value: StatusOverride): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  if (value.background !== undefined) result["background"] = encodeBackground(value.background)
  if (value.textColor !== undefined) result["text_color"] = encodeColor(value.textColor)
  if (value.border !== undefined) result["border"] = encodeBorder(value.border)
  if (value.shadow !== undefined) result["shadow"] = encodeShadow(value.shadow)
  return result
}

// =========================================================================
// Accessibility
// =========================================================================

/**
 * Accessibility properties. All fields are optional.
 * See the protocol spec for full documentation of each field.
 */
export interface A11y {
  role?: string
  label?: string
  description?: string
  hidden?: boolean
  expanded?: boolean
  required?: boolean
  level?: number
  live?: "off" | "polite" | "assertive"
  busy?: boolean
  invalid?: boolean
  modal?: boolean
  readOnly?: boolean
  mnemonic?: string
  toggled?: boolean
  selected?: boolean
  value?: string
  orientation?: "horizontal" | "vertical"
  labelledBy?: string
  describedBy?: string
  errorMessage?: string
  disabled?: boolean
  positionInSet?: number
  sizeOfSet?: number
  hasPopup?: "listbox" | "menu" | "dialog" | "tree" | "grid"
}

/** Encode A11y to wire format (camelCase -> snake_case). */
export function encodeA11y(value: A11y): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  if (value.role !== undefined) result["role"] = value.role
  if (value.label !== undefined) result["label"] = value.label
  if (value.description !== undefined) result["description"] = value.description
  if (value.hidden !== undefined) result["hidden"] = value.hidden
  if (value.expanded !== undefined) result["expanded"] = value.expanded
  if (value.required !== undefined) result["required"] = value.required
  if (value.level !== undefined) result["level"] = value.level
  if (value.live !== undefined) result["live"] = value.live
  if (value.busy !== undefined) result["busy"] = value.busy
  if (value.invalid !== undefined) result["invalid"] = value.invalid
  if (value.modal !== undefined) result["modal"] = value.modal
  if (value.readOnly !== undefined) result["read_only"] = value.readOnly
  if (value.mnemonic !== undefined) result["mnemonic"] = value.mnemonic
  if (value.toggled !== undefined) result["toggled"] = value.toggled
  if (value.selected !== undefined) result["selected"] = value.selected
  if (value.value !== undefined) result["value"] = value.value
  if (value.orientation !== undefined) result["orientation"] = value.orientation
  if (value.labelledBy !== undefined) result["labelled_by"] = value.labelledBy
  if (value.describedBy !== undefined) result["described_by"] = value.describedBy
  if (value.errorMessage !== undefined) result["error_message"] = value.errorMessage
  if (value.disabled !== undefined) result["disabled"] = value.disabled
  if (value.positionInSet !== undefined) result["position_in_set"] = value.positionInSet
  if (value.sizeOfSet !== undefined) result["size_of_set"] = value.sizeOfSet
  if (value.hasPopup !== undefined) result["has_popup"] = value.hasPopup
  return result
}

// =========================================================================
// Other prop enums
// =========================================================================

/** Image content fit mode. */
export type ContentFit = "contain" | "cover" | "fill" | "none" | "scale_down"

/** Image filter method. */
export type FilterMethod = "nearest" | "linear"

/** Text wrapping mode. */
export type Wrapping = "none" | "word" | "glyph" | "word_or_glyph"

/** Text shaping mode. */
export type Shaping = "basic" | "advanced"

/** Layout direction. */
export type Direction = "horizontal" | "vertical"

/** Scrollable anchor position. */
export type Anchor = "start" | "end"

/**
 * Line height specification.
 *
 * - `number` -- relative multiplier (e.g., 1.5 = 150% of font size)
 * - `{ absolute: number }` -- absolute pixel value
 * - `{ relative: number }` -- relative multiplier (explicit form)
 */
export type LineHeight = number | { absolute: number } | { relative: number }

/** Encode LineHeight to wire format. */
export function encodeLineHeight(value: LineHeight): unknown {
  if (typeof value === "number") return value
  if ("absolute" in value) return { absolute: value.absolute }
  return { relative: value.relative }
}

// =========================================================================
// Theme
// =========================================================================

/** Built-in theme names supported by the renderer. */
export type BuiltinTheme =
  | "light" | "dark" | "system"
  | "dracula" | "nord" | "solarized" | "gruvbox"
  | "catppuccin" | "tokyo_night" | "kanagawa"
  | "moonfly" | "nightfly" | "oxocarbon" | "ferra"

/**
 * Theme specification.
 *
 * A string selects a built-in theme. An object defines a custom
 * palette with shade overrides.
 */
export type Theme = BuiltinTheme | string | Record<string, unknown>

// =========================================================================
// Position
// =========================================================================

/** Position mode. */
export type Position = "relative" | "absolute"
