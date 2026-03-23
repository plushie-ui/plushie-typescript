// Re-export tree node utilities.
export { createNode, autoId, resetAutoId } from "../tree/index.js"

// Re-export handler utilities.
export { registerHandler, drainHandlers, clearHandlers } from "./handlers.js"

// Re-export prop types and encoders.
export type {
  Length, Padding, Color, Gradient, Font, FontWeight, FontStyle, FontStretch,
  Alignment, Border, CornerRadius, Shadow, StyleMap, StatusOverride,
  A11y, ContentFit, FilterMethod, Wrapping, Shaping, Direction,
  Anchor, LineHeight, BuiltinTheme, Theme, Position,
} from "./types.js"
export {
  encodeLength, encodePadding, encodeColor, encodeGradient, encodeBackground,
  encodeFont, encodeAlignment,
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
export type { CheckboxProps, CheckboxIcon } from "./widgets/checkbox.js"

export { Slider, slider } from "./widgets/slider.js"
export type { SliderProps } from "./widgets/slider.js"

// Input widgets
export { Radio, radio } from "./widgets/radio.js"
export type { RadioProps } from "./widgets/radio.js"

export { Toggler, toggler } from "./widgets/toggler.js"
export type { TogglerProps } from "./widgets/toggler.js"

export { VerticalSlider, verticalSlider } from "./widgets/vertical_slider.js"
export type { VerticalSliderProps } from "./widgets/vertical_slider.js"

export { PickList, pickList } from "./widgets/pick_list.js"
export type { PickListProps } from "./widgets/pick_list.js"

export { ComboBox, comboBox } from "./widgets/combo_box.js"
export type { ComboBoxProps } from "./widgets/combo_box.js"

export { TextEditor, textEditor } from "./widgets/text_editor.js"
export type { TextEditorProps } from "./widgets/text_editor.js"

// Display widgets
export { RichText, richText } from "./widgets/rich_text.js"
export type { RichTextProps } from "./widgets/rich_text.js"

export { Markdown, markdown } from "./widgets/markdown.js"
export type { MarkdownProps } from "./widgets/markdown.js"

export { Image, image } from "./widgets/image.js"
export type { ImageProps } from "./widgets/image.js"

export { Svg, svg } from "./widgets/svg.js"
export type { SvgProps } from "./widgets/svg.js"

export { ProgressBar, progressBar } from "./widgets/progress_bar.js"
export type { ProgressBarProps } from "./widgets/progress_bar.js"

export { QrCode, qrCode } from "./widgets/qr_code.js"
export type { QrCodeProps } from "./widgets/qr_code.js"

export { Rule, rule } from "./widgets/rule.js"
export type { RuleProps } from "./widgets/rule.js"

export { Space, space } from "./widgets/space.js"
export type { SpaceProps } from "./widgets/space.js"

export { Table, table } from "./widgets/table.js"
export type { TableProps } from "./widgets/table.js"

// Layout containers
export { Overlay, overlay } from "./widgets/overlay.js"
export type { OverlayProps } from "./widgets/overlay.js"

export { Scrollable, scrollable } from "./widgets/scrollable.js"
export type { ScrollableProps } from "./widgets/scrollable.js"

export { Stack, stack } from "./widgets/stack.js"
export type { StackProps } from "./widgets/stack.js"

export { Grid, grid } from "./widgets/grid.js"
export type { GridProps } from "./widgets/grid.js"

export { KeyedColumn, keyedColumn } from "./widgets/keyed_column.js"
export type { KeyedColumnProps } from "./widgets/keyed_column.js"

export { Responsive, responsive } from "./widgets/responsive.js"
export type { ResponsiveProps } from "./widgets/responsive.js"

export { Pin, pin } from "./widgets/pin.js"
export type { PinProps } from "./widgets/pin.js"

export { Floating, floating } from "./widgets/floating.js"
export type { FloatingProps } from "./widgets/floating.js"

// Interactive containers
export { PaneGrid, paneGrid } from "./widgets/pane_grid.js"
export type { PaneGridProps } from "./widgets/pane_grid.js"

export { Tooltip, tooltip } from "./widgets/tooltip.js"
export type { TooltipProps } from "./widgets/tooltip.js"

export { MouseArea, mouseArea } from "./widgets/mouse_area.js"
export type { MouseAreaProps } from "./widgets/mouse_area.js"

export { Sensor, sensor } from "./widgets/sensor.js"
export type { SensorProps } from "./widgets/sensor.js"

export { Themer, themer } from "./widgets/themer.js"
export type { ThemerProps } from "./widgets/themer.js"

export { Canvas, canvas } from "./widgets/canvas.js"
export type { CanvasProps } from "./widgets/canvas.js"
