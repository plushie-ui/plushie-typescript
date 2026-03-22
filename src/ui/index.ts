// Re-export tree node utilities.
export { createNode, autoId, resetAutoId } from "../tree/index.js"

// Re-export handler utilities.
export { registerHandler, drainHandlers, clearHandlers } from "./handlers.js"

// Re-export prop types and encoders.
export type {
  Length, Padding, Color, Font, FontWeight, FontStyle, FontStretch,
  Alignment, Border, CornerRadius, Shadow, StyleMap, StatusOverride,
  A11y, ContentFit, FilterMethod, Wrapping, Shaping, Direction,
  Anchor, LineHeight,
} from "./types.js"
export {
  encodeLength, encodePadding, encodeColor, encodeFont, encodeAlignment,
  encodeBorder, encodeShadow, encodeStyleMap, encodeA11y, encodeLineHeight,
} from "./types.js"

// Re-export build utilities.
export { putIf, leafNode, containerNode, extractHandlers } from "./build.js"

// -- Widget re-exports (PascalCase JSX components + camelCase functions) --

// Core widgets
export { Window, window } from "./widgets/window.js"
export type { WindowProps } from "./widgets/window.js"

export { Column, column } from "./widgets/column.js"
export type { ColumnProps } from "./widgets/column.js"

export { Row, row } from "./widgets/row.js"
export type { RowProps } from "./widgets/row.js"

export { Container, container } from "./widgets/container.js"
export type { ContainerProps } from "./widgets/container.js"

export { Text, text } from "./widgets/text.js"
export type { TextProps } from "./widgets/text.js"

export { Button, button } from "./widgets/button.js"
export type { ButtonProps } from "./widgets/button.js"

export { TextInput, textInput } from "./widgets/text_input.js"
export type { TextInputProps } from "./widgets/text_input.js"

export { Checkbox, checkbox } from "./widgets/checkbox.js"
export type { CheckboxProps } from "./widgets/checkbox.js"

export { Slider, slider } from "./widgets/slider.js"
export type { SliderProps } from "./widgets/slider.js"
