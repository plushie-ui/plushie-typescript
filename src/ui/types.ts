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
 * - `number`: exact pixel size
 * - `'fill'`: fill available space (weight 1)
 * - `'shrink'`: shrink to content
 * - `{ fillPortion: n }`: fill with weight n
 */
export type Length = number | "fill" | "shrink" | { fillPortion: number };

/** Encode a Length to its wire representation.
 *
 * Throws when a numeric length is negative or when a `fillPortion` is
 * less than 1.
 */
export function encodeLength(value: Length): unknown {
  if (typeof value === "number") {
    if (value < 0) {
      throw new Error(`length must be non-negative, got ${value}`);
    }
    return value;
  }
  if (value === "fill") return "fill";
  if (value === "shrink") return "shrink";
  if (value.fillPortion < 1) {
    throw new Error(`length fillPortion must be >= 1, got ${value.fillPortion}`);
  }
  return { fill_portion: value.fillPortion };
}

// =========================================================================
// Padding
// =========================================================================

/**
 * Padding specification.
 *
 * - `number`: uniform padding on all sides
 * - `[vertical, horizontal]`: symmetric padding
 * - `[top, right, bottom, left]`: per-side padding
 * - `{ top?, right?, bottom?, left? }`: per-side with named fields
 */
export type Padding =
  | number
  | [number, number]
  | [number, number, number, number]
  | { top?: number; right?: number; bottom?: number; left?: number };

/** Encode Padding to its wire representation.
 *
 * The renderer accepts either a plain number (uniform on all sides) or
 * a `{top, right, bottom, left}` object. Arrays are rejected by the
 * renderer's padding decoder, so every shorthand form normalizes to
 * one of those shapes before emission.
 *
 * As a convenience that matches the renderer's own `wire_encode`,
 * uniform four-sided padding collapses to a single number.
 */
export function encodePadding(value: Padding): unknown {
  if (typeof value === "number") {
    if (value < 0) {
      throw new Error(`padding must be non-negative, got ${value}`);
    }
    return value;
  }

  let top: number;
  let right: number;
  let bottom: number;
  let left: number;

  if (Array.isArray(value)) {
    if (value.length === 2) {
      const [v, h] = value;
      top = v;
      right = h;
      bottom = v;
      left = h;
    } else {
      [top, right, bottom, left] = value;
    }
  } else {
    top = value.top ?? 0;
    right = value.right ?? 0;
    bottom = value.bottom ?? 0;
    left = value.left ?? 0;
  }

  for (const [side, n] of [
    ["top", top],
    ["right", right],
    ["bottom", bottom],
    ["left", left],
  ] as const) {
    if (n < 0) {
      throw new Error(`padding must be non-negative, got ${side}=${n}`);
    }
  }

  if (top === right && right === bottom && bottom === left) {
    return top;
  }
  return { top, right, bottom, left };
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
export type Color = string | { r: number; g: number; b: number; a?: number };

/**
 * Complete set of the 148 CSS Color Module Level 4 named colors plus
 * `transparent`, mapped to canonical `#rrggbb` / `#rrggbbaa` hex.
 *
 * Used by `encodeColor` to normalize named colors and exported so
 * callers can look up or enumerate the catalog:
 *
 * ```ts
 * import { namedColors } from "plushie/ui/types";
 *
 * const hex = namedColors["cornflowerblue"]; // "#6495ed"
 * ```
 */
export const namedColors: Readonly<Record<string, string>> = {
  aliceblue: "#f0f8ff",
  antiquewhite: "#faebd7",
  aqua: "#00ffff",
  aquamarine: "#7fffd4",
  azure: "#f0ffff",
  beige: "#f5f5dc",
  bisque: "#ffe4c4",
  black: "#000000",
  blanchedalmond: "#ffebcd",
  blue: "#0000ff",
  blueviolet: "#8a2be2",
  brown: "#a52a2a",
  burlywood: "#deb887",
  cadetblue: "#5f9ea0",
  chartreuse: "#7fff00",
  chocolate: "#d2691e",
  coral: "#ff7f50",
  cornflowerblue: "#6495ed",
  cornsilk: "#fff8dc",
  crimson: "#dc143c",
  cyan: "#00ffff",
  darkblue: "#00008b",
  darkcyan: "#008b8b",
  darkgoldenrod: "#b8860b",
  darkgray: "#a9a9a9",
  darkgrey: "#a9a9a9",
  darkgreen: "#006400",
  darkkhaki: "#bdb76b",
  darkmagenta: "#8b008b",
  darkolivegreen: "#556b2f",
  darkorange: "#ff8c00",
  darkorchid: "#9932cc",
  darkred: "#8b0000",
  darksalmon: "#e9967a",
  darkseagreen: "#8fbc8f",
  darkslateblue: "#483d8b",
  darkslategray: "#2f4f4f",
  darkslategrey: "#2f4f4f",
  darkturquoise: "#00ced1",
  darkviolet: "#9400d3",
  deeppink: "#ff1493",
  deepskyblue: "#00bfff",
  dimgray: "#696969",
  dimgrey: "#696969",
  dodgerblue: "#1e90ff",
  firebrick: "#b22222",
  floralwhite: "#fffaf0",
  forestgreen: "#228b22",
  fuchsia: "#ff00ff",
  gainsboro: "#dcdcdc",
  ghostwhite: "#f8f8ff",
  gold: "#ffd700",
  goldenrod: "#daa520",
  gray: "#808080",
  grey: "#808080",
  green: "#008000",
  greenyellow: "#adff2f",
  honeydew: "#f0fff0",
  hotpink: "#ff69b4",
  indianred: "#cd5c5c",
  indigo: "#4b0082",
  ivory: "#fffff0",
  khaki: "#f0e68c",
  lavender: "#e6e6fa",
  lavenderblush: "#fff0f5",
  lawngreen: "#7cfc00",
  lemonchiffon: "#fffacd",
  lightblue: "#add8e6",
  lightcoral: "#f08080",
  lightcyan: "#e0ffff",
  lightgoldenrodyellow: "#fafad2",
  lightgray: "#d3d3d3",
  lightgrey: "#d3d3d3",
  lightgreen: "#90ee90",
  lightpink: "#ffb6c1",
  lightsalmon: "#ffa07a",
  lightseagreen: "#20b2aa",
  lightskyblue: "#87cefa",
  lightslategray: "#778899",
  lightslategrey: "#778899",
  lightsteelblue: "#b0c4de",
  lightyellow: "#ffffe0",
  lime: "#00ff00",
  limegreen: "#32cd32",
  linen: "#faf0e6",
  magenta: "#ff00ff",
  maroon: "#800000",
  mediumaquamarine: "#66cdaa",
  mediumblue: "#0000cd",
  mediumorchid: "#ba55d3",
  mediumpurple: "#9370db",
  mediumseagreen: "#3cb371",
  mediumslateblue: "#7b68ee",
  mediumspringgreen: "#00fa9a",
  mediumturquoise: "#48d1cc",
  mediumvioletred: "#c71585",
  midnightblue: "#191970",
  mintcream: "#f5fffa",
  mistyrose: "#ffe4e1",
  moccasin: "#ffe4b5",
  navajowhite: "#ffdead",
  navy: "#000080",
  oldlace: "#fdf5e6",
  olive: "#808000",
  olivedrab: "#6b8e23",
  orange: "#ffa500",
  orangered: "#ff4500",
  orchid: "#da70d6",
  palegoldenrod: "#eee8aa",
  palegreen: "#98fb98",
  paleturquoise: "#afeeee",
  palevioletred: "#db7093",
  papayawhip: "#ffefd5",
  peachpuff: "#ffdab9",
  peru: "#cd853f",
  pink: "#ffc0cb",
  plum: "#dda0dd",
  powderblue: "#b0e0e6",
  purple: "#800080",
  rebeccapurple: "#663399",
  red: "#ff0000",
  rosybrown: "#bc8f8f",
  royalblue: "#4169e1",
  saddlebrown: "#8b4513",
  salmon: "#fa8072",
  sandybrown: "#f4a460",
  seagreen: "#2e8b57",
  seashell: "#fff5ee",
  sienna: "#a0522d",
  silver: "#c0c0c0",
  skyblue: "#87ceeb",
  slateblue: "#6a5acd",
  slategray: "#708090",
  slategrey: "#708090",
  snow: "#fffafa",
  springgreen: "#00ff7f",
  steelblue: "#4682b4",
  tan: "#d2b48c",
  teal: "#008080",
  thistle: "#d8bfd8",
  tomato: "#ff6347",
  transparent: "#00000000",
  turquoise: "#40e0d0",
  violet: "#ee82ee",
  wheat: "#f5deb3",
  white: "#ffffff",
  whitesmoke: "#f5f5f5",
  yellow: "#ffff00",
  yellowgreen: "#9acd32",
};

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
    const r = Math.round(value.r * 255);
    const g = Math.round(value.g * 255);
    const b = Math.round(value.b * 255);
    if (value.a !== undefined && value.a < 1) {
      const a = Math.round(value.a * 255);
      return `#${hex2(r)}${hex2(g)}${hex2(b)}${hex2(a)}`;
    }
    return `#${hex2(r)}${hex2(g)}${hex2(b)}`;
  }

  // Named color lookup (case-insensitive)
  const named = namedColors[value.toLowerCase()];
  if (named !== undefined) return named;

  // Already hex; normalize short forms
  if (value.startsWith("#")) {
    const h = value.slice(1);
    if (!/^[0-9a-fA-F]+$/.test(h)) {
      throw new Error(`invalid color: ${value}`);
    }
    if (h.length === 3) {
      return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
    }
    if (h.length === 4) {
      return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
    }
    if (h.length === 6 || h.length === 8) {
      return value.toLowerCase();
    }
    throw new Error(`invalid color: ${value}`);
  }

  // Pass through unrecognized strings (renderer may handle them)
  return value;
}

function hex2(n: number): string {
  return n.toString(16).padStart(2, "0");
}

// =========================================================================
// Gradient
// =========================================================================

/**
 * Gradient color stop: `[offset, color]` where offset is 0.0-1.0.
 */
export type GradientStop = readonly [number, Color];

/**
 * Linear gradient specification.
 *
 * Defines a gradient between two coordinate points with color stops.
 * Wire format uses coordinate-based start/end with array stops,
 * matching `Plushie.Canvas.Gradient`.
 */
export interface Gradient {
  readonly type: "linear";
  readonly start: readonly [number, number];
  readonly end: readonly [number, number];
  readonly stops: readonly GradientStop[];
}

/**
 * Create a linear gradient between two coordinate points.
 *
 * @param from - Start point `[x, y]`
 * @param to - End point `[x, y]`
 * @param stops - Color stops as `[offset, color]` tuples
 */
export function linearGradient(
  from: readonly [number, number],
  to: readonly [number, number],
  stops: readonly GradientStop[],
): Gradient {
  return {
    type: "linear",
    start: from,
    end: to,
    stops,
  };
}

/**
 * Create a linear gradient from an angle (degrees) and color stops.
 *
 * The angle is converted to start/end coordinates on a unit square
 * (0,0 to 1,1), matching the renderer's convention.
 */
export function linearGradientFromAngle(angle: number, stops: readonly GradientStop[]): Gradient {
  const radians = (angle * Math.PI) / 180;
  const dx = Math.cos(radians);
  const dy = Math.sin(radians);
  const halfLen = Math.abs(dx) / 2 + Math.abs(dy) / 2;
  const cx = 0.5;
  const cy = 0.5;
  return linearGradient(
    [cx - dx * halfLen, cy - dy * halfLen],
    [cx + dx * halfLen, cy + dy * halfLen],
    stops,
  );
}

/** Encode a Gradient to its wire representation. */
export function encodeGradient(value: Gradient): Record<string, unknown> {
  return {
    type: value.type,
    start: [...value.start],
    end: [...value.end],
    stops: value.stops.map(([offset, color]) => [offset, encodeColor(color)]),
  };
}

// =========================================================================
// Font
// =========================================================================

/** Font weight names supported by the renderer. */
export type FontWeight =
  | "thin"
  | "extra_light"
  | "light"
  | "normal"
  | "medium"
  | "semi_bold"
  | "bold"
  | "extra_bold"
  | "black";

/** Font style. */
export type FontStyle = "normal" | "italic" | "oblique";

/** Font stretch. */
export type FontStretch =
  | "ultra_condensed"
  | "extra_condensed"
  | "condensed"
  | "semi_condensed"
  | "normal"
  | "semi_expanded"
  | "expanded"
  | "extra_expanded"
  | "ultra_expanded";

/**
 * Font specification.
 *
 * - `'default'`: system default font
 * - `'monospace'`: system monospace font
 * - `string`: font family name
 * - Object with family, weight, style, stretch
 */
export type Font =
  | "default"
  | "monospace"
  | string
  | { family: string; weight?: FontWeight; style?: FontStyle; stretch?: FontStretch };

/** Encode a Font to its wire representation. */
export function encodeFont(value: Font): unknown {
  if (typeof value === "string") {
    if (value === "default" || value === "monospace") return value;
    return { family: value };
  }
  const result: Record<string, unknown> = { family: value.family };
  if (value.weight !== undefined) result["weight"] = value.weight;
  if (value.style !== undefined) result["style"] = value.style;
  if (value.stretch !== undefined) result["stretch"] = value.stretch;
  return result;
}

// =========================================================================
// Alignment
// =========================================================================

/**
 * Horizontal alignment within a container (maps directly to the
 * renderer's `horizontal_alignment` enum).
 */
export type AlignX = "left" | "center" | "right";

/**
 * Vertical alignment within a container (maps directly to the
 * renderer's `vertical_alignment` enum).
 */
export type AlignY = "top" | "center" | "bottom";

/**
 * Union over every accepted alignment value across the horizontal and
 * vertical axes. Prefer {@link AlignX} or {@link AlignY} at widget
 * boundaries; `Alignment` exists so shared helpers can accept either.
 */
export type Alignment = AlignX | AlignY;

/**
 * Pass-through encoder: the renderer accepts the literal strings
 * directly on the `align_x` / `align_y` wire fields.
 */
export function encodeAlignment(value: Alignment): string {
  return value;
}

// =========================================================================
// Border
// =========================================================================

/** Per-corner border radius. */
export interface CornerRadius {
  topLeft?: number;
  topRight?: number;
  bottomRight?: number;
  bottomLeft?: number;
}

/**
 * Border specification.
 */
export interface Border {
  color?: Color;
  width?: number;
  radius?: number | CornerRadius;
}

/** Encode a Border to its wire representation.
 *
 * Throws when the width or any radius value is negative.
 */
export function encodeBorder(value: Border): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (value.color !== undefined) result["color"] = encodeColor(value.color);
  if (value.width !== undefined) {
    if (value.width < 0) {
      throw new Error(`border width must be non-negative, got ${value.width}`);
    }
    result["width"] = value.width;
  }
  if (value.radius !== undefined) {
    if (typeof value.radius === "number") {
      if (value.radius < 0) {
        throw new Error(`border radius must be non-negative, got ${value.radius}`);
      }
      result["radius"] = value.radius;
    } else {
      const corners = {
        top_left: value.radius.topLeft ?? 0,
        top_right: value.radius.topRight ?? 0,
        bottom_right: value.radius.bottomRight ?? 0,
        bottom_left: value.radius.bottomLeft ?? 0,
      };
      for (const [corner, n] of Object.entries(corners)) {
        if (n < 0) {
          throw new Error(`border radius must be non-negative, got ${corner}=${n}`);
        }
      }
      result["radius"] = corners;
    }
  }
  return result;
}

// =========================================================================
// Shadow
// =========================================================================

/**
 * Drop shadow specification.
 */
export interface Shadow {
  color?: Color;
  offsetX?: number;
  offsetY?: number;
  blurRadius?: number;
}

/** Encode a Shadow to its wire representation. */
export function encodeShadow(value: Shadow): Record<string, unknown> {
  return {
    color: value.color !== undefined ? encodeColor(value.color) : "#000000",
    offset: [value.offsetX ?? 0, value.offsetY ?? 0],
    blur_radius: value.blurRadius ?? 0,
  };
}

// =========================================================================
// StyleMap
// =========================================================================

/** Status-specific style overrides (hover, press, disable, focus). */
export interface StatusOverride {
  background?: Color | Gradient;
  textColor?: Color;
  border?: Border;
  shadow?: Shadow;
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
      base?: string;
      background?: Color | Gradient;
      textColor?: Color;
      border?: Border;
      shadow?: Shadow;
      hovered?: StatusOverride;
      pressed?: StatusOverride;
      disabled?: StatusOverride;
      focused?: StatusOverride;
    };

/** Encode a Color or Gradient to its wire representation. */
export function encodeBackground(value: Color | Gradient): unknown {
  if (typeof value === "object" && "type" in value && value.type === "linear") {
    return encodeGradient(value as Gradient);
  }
  return encodeColor(value as Color);
}

/** Encode a StyleMap to its wire representation. */
export function encodeStyleMap(value: StyleMap): unknown {
  if (typeof value === "string") return value;
  const result: Record<string, unknown> = {};
  if (value.base !== undefined) result["base"] = value.base;
  if (value.background !== undefined) result["background"] = encodeBackground(value.background);
  if (value.textColor !== undefined) result["text_color"] = encodeColor(value.textColor);
  if (value.border !== undefined) result["border"] = encodeBorder(value.border);
  if (value.shadow !== undefined) result["shadow"] = encodeShadow(value.shadow);
  if (value.hovered !== undefined) result["hovered"] = encodeStatusOverride(value.hovered);
  if (value.pressed !== undefined) result["pressed"] = encodeStatusOverride(value.pressed);
  if (value.disabled !== undefined) result["disabled"] = encodeStatusOverride(value.disabled);
  if (value.focused !== undefined) result["focused"] = encodeStatusOverride(value.focused);
  return result;
}

function encodeStatusOverride(value: StatusOverride): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (value.background !== undefined) result["background"] = encodeBackground(value.background);
  if (value.textColor !== undefined) result["text_color"] = encodeColor(value.textColor);
  if (value.border !== undefined) result["border"] = encodeBorder(value.border);
  if (value.shadow !== undefined) result["shadow"] = encodeShadow(value.shadow);
  return result;
}

// =========================================================================
// Accessibility
// =========================================================================

/**
 * Accessibility metadata for a widget in the rendered UI tree.
 *
 * This is a view/wire prop: builders encode it into the node sent to
 * the renderer, and the renderer normalizes it into platform
 * accessibility metadata. Derive it in `view()` from app data instead
 * of storing the `A11y` object as independent app-model state. App data
 * can still contain natural labels or descriptions when those values are
 * part of the domain.
 *
 * All fields are optional. See the protocol spec for full documentation
 * of each field.
 */
export interface A11y {
  role?: string;
  label?: string;
  description?: string;
  hidden?: boolean;
  expanded?: boolean;
  required?: boolean;
  level?: number;
  live?: "off" | "polite" | "assertive";
  busy?: boolean;
  invalid?: boolean;
  modal?: boolean;
  readOnly?: boolean;
  mnemonic?: string;
  toggled?: boolean;
  selected?: boolean;
  value?: string;
  orientation?: "horizontal" | "vertical";
  labelledBy?: string;
  describedBy?: string;
  errorMessage?: string;
  disabled?: boolean;
  positionInSet?: number;
  sizeOfSet?: number;
  hasPopup?: "listbox" | "menu" | "dialog" | "tree" | "grid";
  activeDescendant?: string;
  radioGroup?: string;
}

/** Encode A11y to wire format (camelCase -> snake_case). */
export function encodeA11y(value: A11y): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (value.role !== undefined) result["role"] = value.role;
  if (value.label !== undefined) result["label"] = value.label;
  if (value.description !== undefined) result["description"] = value.description;
  if (value.hidden !== undefined) result["hidden"] = value.hidden;
  if (value.expanded !== undefined) result["expanded"] = value.expanded;
  if (value.required !== undefined) result["required"] = value.required;
  if (value.level !== undefined) result["level"] = value.level;
  if (value.live !== undefined) result["live"] = value.live;
  if (value.busy !== undefined) result["busy"] = value.busy;
  if (value.invalid !== undefined) result["invalid"] = value.invalid;
  if (value.modal !== undefined) result["modal"] = value.modal;
  if (value.readOnly !== undefined) result["read_only"] = value.readOnly;
  if (value.mnemonic !== undefined) {
    if (value.mnemonic.length !== 1) {
      throw new Error(
        `A11y mnemonic must be a single character, got "${value.mnemonic}" (${String(value.mnemonic.length)} characters)`,
      );
    }
    result["mnemonic"] = value.mnemonic;
  }
  if (value.toggled !== undefined) result["toggled"] = value.toggled;
  if (value.selected !== undefined) result["selected"] = value.selected;
  if (value.value !== undefined) result["value"] = value.value;
  if (value.orientation !== undefined) result["orientation"] = value.orientation;
  if (value.labelledBy !== undefined) result["labelled_by"] = value.labelledBy;
  if (value.describedBy !== undefined) result["described_by"] = value.describedBy;
  if (value.errorMessage !== undefined) result["error_message"] = value.errorMessage;
  if (value.disabled !== undefined) result["disabled"] = value.disabled;
  if (value.positionInSet !== undefined) result["position_in_set"] = value.positionInSet;
  if (value.sizeOfSet !== undefined) result["size_of_set"] = value.sizeOfSet;
  if (value.hasPopup !== undefined) result["has_popup"] = value.hasPopup;
  if (value.activeDescendant !== undefined) result["active_descendant"] = value.activeDescendant;
  if (value.radioGroup !== undefined) result["radio_group"] = value.radioGroup;
  return result;
}

// =========================================================================
// ValidationState
// =========================================================================

/**
 * Renderer-facing form-validation state for input widgets.
 *
 * This is a view/wire prop. Store whatever domain validation data your
 * app needs in the model, then project the current result to
 * `ValidationState` in `view()`. Do not keep the widget `validation`
 * prop as a second source of truth in app state.
 *
 * Accepted shapes (builders on text_input, text_editor, checkbox,
 * pick_list, combo_box accept this as their `validation` prop):
 *
 * - `"valid"` - validated and OK
 * - `"pending"` - validation in progress
 * - `["invalid", message]` or `{ state: "invalid", message }` -
 *   failed with a human-readable message (sets `a11y.invalid` and
 *   `a11y.error_message`)
 *
 * The normalizer projects this onto the `a11y` map automatically.
 */
export type ValidationState =
  | "valid"
  | "pending"
  | readonly ["invalid", string]
  | { readonly state: "valid" | "pending" }
  | { readonly state: "invalid"; readonly message: string };

/** Build an invalid validation tuple. */
export function invalid(message: string): readonly ["invalid", string] {
  return ["invalid", message] as const;
}

/**
 * Encode a {@link ValidationState} for the wire. Passes through as-is;
 * the normalizer understands all accepted shapes.
 */
export function encodeValidation(value: ValidationState): unknown {
  if (Array.isArray(value)) return [...value];
  if (typeof value === "object") return { ...value };
  return value;
}

// =========================================================================
// Other prop enums
// =========================================================================

/** Image content fit mode. */
export type ContentFit = "contain" | "cover" | "fill" | "none" | "scale_down";

/** Image filter method. */
export type FilterMethod = "nearest" | "linear";

/** Text wrapping mode. */
export type Wrapping = "none" | "word" | "glyph" | "word_or_glyph";

/** Text shaping mode. */
export type Shaping = "basic" | "advanced";

/** Layout direction. */
export type Direction = "horizontal" | "vertical";

/** Scrollable anchor position. */
export type Anchor = "start" | "end";

/**
 * Line height specification.
 *
 * - `number`: relative multiplier (e.g., 1.5 = 150% of font size)
 * - `{ absolute: number }`: absolute pixel value
 * - `{ relative: number }`: relative multiplier (explicit form)
 */
export type LineHeight = number | { absolute: number } | { relative: number };

/** Encode LineHeight to wire format. */
export function encodeLineHeight(value: LineHeight): unknown {
  if (typeof value === "number") return value;
  if ("absolute" in value) return { absolute: value.absolute };
  return { relative: value.relative };
}

// =========================================================================
// Theme
// =========================================================================

/** Built-in theme names supported by the renderer. */
export type BuiltinTheme =
  | "light"
  | "dark"
  | "system"
  | "dracula"
  | "nord"
  | "solarized"
  | "gruvbox"
  | "catppuccin"
  | "tokyo_night"
  | "kanagawa"
  | "moonfly"
  | "nightfly"
  | "oxocarbon"
  | "ferra";

/**
 * Theme specification.
 *
 * A string selects a built-in theme. An object defines a custom
 * palette with shade overrides.
 */
export type Theme = BuiltinTheme | string | Record<string, unknown>;

const CORE_SEEDS = new Set(["background", "text", "primary", "success", "danger", "warning"]);
const COLOR_FAMILIES = ["primary", "secondary", "success", "warning", "danger"];
const SHADES = ["base", "weak", "strong"];
const BG_SHADES = [
  "base",
  "weakest",
  "weaker",
  "weak",
  "neutral",
  "strong",
  "stronger",
  "strongest",
];

const VALID_CUSTOM_KEYS: Set<string> = (() => {
  const keys = new Set<string>();
  for (const seed of CORE_SEEDS) keys.add(seed);
  for (const family of COLOR_FAMILIES) {
    for (const shade of SHADES) {
      keys.add(`${family}_${shade}`);
      keys.add(`${family}_${shade}_text`);
    }
  }
  for (const shade of BG_SHADES) {
    keys.add(`background_${shade}`);
    keys.add(`background_${shade}_text`);
  }
  return keys;
})();

/**
 * Create a validated custom theme palette.
 *
 * Validates that all keys are recognized theme seed or shade override
 * keys. Throws on unknown keys to catch typos early.
 */
export function customTheme(
  name: string,
  palette: Record<string, string>,
): Record<string, unknown> {
  for (const key of Object.keys(palette)) {
    if (!VALID_CUSTOM_KEYS.has(key)) {
      const validList = [...VALID_CUSTOM_KEYS].sort().join(", ");
      throw new Error(`Unknown key "${key}" in custom theme. Valid keys: ${validList}`);
    }
  }
  return { name, ...palette };
}

// =========================================================================
// Position
// =========================================================================

/** Position mode. */
export type Position = "relative" | "absolute";
