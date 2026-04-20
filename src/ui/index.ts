// Re-export tree node utilities.
export { autoId, createNode, resetAutoId } from "../tree/index.js";
// Re-export build utilities.
export type { AnimationDescriptor, AnimationProps } from "./build.js";
export {
  containerNode,
  extractHandlers,
  isAnimationDescriptor,
  leafNode,
  mergeAnimationProps,
  putIf,
  withAnimation,
} from "./build.js";
// Re-export handler utilities.
export type { HandlerEntry } from "./handlers.js";
export { clearHandlers, drainHandlers, registerHandler } from "./handlers.js";
// Re-export prop types and encoders.
export type {
  A11y,
  Alignment,
  AlignX,
  AlignY,
  Anchor,
  Border,
  BuiltinTheme,
  Color,
  ContentFit,
  CornerRadius,
  Direction,
  FilterMethod,
  Font,
  FontStretch,
  FontStyle,
  FontWeight,
  Gradient,
  GradientStop,
  Length,
  LineHeight,
  Padding,
  Position,
  Shadow,
  Shaping,
  StatusOverride,
  StyleMap,
  Theme,
  ValidationState,
  Wrapping,
} from "./types.js";
export {
  customTheme,
  encodeA11y,
  encodeAlignment,
  encodeBackground,
  encodeBorder,
  encodeColor,
  encodeFont,
  encodeGradient,
  encodeLength,
  encodeLineHeight,
  encodePadding,
  encodeShadow,
  encodeStyleMap,
  encodeValidation,
  invalid,
  linearGradient,
  linearGradientFromAngle,
  namedColors,
} from "./types.js";

// -- Widget re-exports (PascalCase JSX components + camelCase functions) --

export type { ButtonProps } from "./widgets/button.js";
export { Button, button } from "./widgets/button.js";
export type { CanvasChild, CanvasProps } from "./widgets/canvas.js";
export { Canvas, canvas } from "./widgets/canvas.js";
export type { CheckboxIcon, CheckboxProps } from "./widgets/checkbox.js";
export { Checkbox, checkbox } from "./widgets/checkbox.js";
export type { ColumnProps } from "./widgets/column.js";
export { Column, column } from "./widgets/column.js";
export type { ComboBoxProps } from "./widgets/combo_box.js";
export { ComboBox, comboBox } from "./widgets/combo_box.js";
export type { ContainerProps } from "./widgets/container.js";
export { Container, container } from "./widgets/container.js";
export type { FloatingProps } from "./widgets/floating.js";
export { Floating, floating } from "./widgets/floating.js";
export type { GridProps } from "./widgets/grid.js";
export { Grid, grid } from "./widgets/grid.js";
export type { ImageProps } from "./widgets/image.js";
export { Image, image } from "./widgets/image.js";
export type { KeyedColumnProps } from "./widgets/keyed_column.js";
export { KeyedColumn, keyedColumn } from "./widgets/keyed_column.js";
export type { MarkdownProps } from "./widgets/markdown.js";
export { Markdown, markdown } from "./widgets/markdown.js";
export type { OverlayProps } from "./widgets/overlay.js";
// Layout containers
export { Overlay, overlay } from "./widgets/overlay.js";
export type { PaneGridProps } from "./widgets/pane_grid.js";
// Interactive containers
export { PaneGrid, paneGrid } from "./widgets/pane_grid.js";
export type { PickListProps } from "./widgets/pick_list.js";
export { PickList, pickList } from "./widgets/pick_list.js";
export type { PinProps } from "./widgets/pin.js";
export { Pin, pin } from "./widgets/pin.js";
export type { PointerAreaProps } from "./widgets/pointer_area.js";
export { PointerArea, pointerArea } from "./widgets/pointer_area.js";
export type { ProgressBarProps } from "./widgets/progress_bar.js";
export { ProgressBar, progressBar } from "./widgets/progress_bar.js";
export type { QrCodeProps } from "./widgets/qr_code.js";
export { QrCode, qrCode } from "./widgets/qr_code.js";
export type { RadioProps } from "./widgets/radio.js";
// Input widgets
export { Radio, radio } from "./widgets/radio.js";
export type { ResponsiveProps } from "./widgets/responsive.js";
export { Responsive, responsive } from "./widgets/responsive.js";
export type { RichTextProps, Span, SpanHighlight } from "./widgets/rich_text.js";
// Display widgets
export { encodeSpan, RichText, richText } from "./widgets/rich_text.js";
export type { RowProps } from "./widgets/row.js";
export { Row, row } from "./widgets/row.js";
export type { RuleProps } from "./widgets/rule.js";
export { Rule, rule } from "./widgets/rule.js";
export type { ScrollableProps } from "./widgets/scrollable.js";
export { Scrollable, scrollable } from "./widgets/scrollable.js";
export type { SensorProps } from "./widgets/sensor.js";
export { Sensor, sensor } from "./widgets/sensor.js";
export type { SliderProps } from "./widgets/slider.js";
export { Slider, slider } from "./widgets/slider.js";
export type { SpaceProps } from "./widgets/space.js";
export { Space, space } from "./widgets/space.js";
export type { StackProps } from "./widgets/stack.js";
export { Stack, stack } from "./widgets/stack.js";
export type { SvgProps } from "./widgets/svg.js";
export { Svg, svg } from "./widgets/svg.js";
export type { TableColumn, TableProps, TableRow } from "./widgets/table.js";
export { Table, table, tableCell, tableRow } from "./widgets/table.js";
export type { TextProps } from "./widgets/text.js";
export { Text, text } from "./widgets/text.js";
export type { TextEditorProps } from "./widgets/text_editor.js";
export { TextEditor, textEditor } from "./widgets/text_editor.js";
export type { TextInputIcon, TextInputProps } from "./widgets/text_input.js";
export { TextInput, textInput } from "./widgets/text_input.js";
export type { ThemerProps } from "./widgets/themer.js";
export { Themer, themer } from "./widgets/themer.js";
export type { TogglerProps } from "./widgets/toggler.js";
export { Toggler, toggler } from "./widgets/toggler.js";
export type { TooltipProps } from "./widgets/tooltip.js";
export { Tooltip, tooltip } from "./widgets/tooltip.js";
export type { VerticalSliderProps } from "./widgets/vertical_slider.js";
export { VerticalSlider, verticalSlider } from "./widgets/vertical_slider.js";
export type { WindowProps } from "./widgets/window.js";
// Core widgets
export { Window, window } from "./widgets/window.js";
