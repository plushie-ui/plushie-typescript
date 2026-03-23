# Extensions

Plushie's extension system lets you define custom widget types that
wrap existing widgets or expose Rust-rendered native widgets.

## Defining an extension widget

Use `defineExtensionWidget()` to create a widget builder for a
custom type:

```typescript
import { defineExtensionWidget } from 'plushie'

const Chart = defineExtensionWidget({
  type: 'chart',
  props: {
    data: 'any',
    xLabel: 'string',
    yLabel: 'string',
    color: 'color',
    width: 'length',
    height: 'length',
  },
  events: ['data_point_click', 'zoom'],
  container: false,
})
```

This returns a function that creates UINodes:

```typescript
// In your view:
Chart('myChart', {
  data: state.chartData,
  xLabel: 'Month',
  yLabel: 'Revenue',
  color: '#3498db',
  width: 'fill',
  height: 300,
  onDataPointClick: handlePointClick,
})
```

## Prop types

| Type | TypeScript | Wire format |
|---|---|---|
| `'string'` | string | string |
| `'number'` | number | number |
| `'boolean'` | boolean | boolean |
| `'color'` | Color | hex string |
| `'length'` | Length | number/string/object |
| `'padding'` | Padding | number/array |
| `'font'` | Font | string/object |
| `'alignment'` | Alignment | string |
| `'style'` | StyleMap | string/object |
| `'any'` | unknown | passed through |
| `{ list: type }` | array | array |

## Events

Events declared in the `events` array automatically generate handler
props. The event name is converted to camelCase with an `on` prefix:

- `'data_point_click'` -> `onDataPointClick`
- `'zoom'` -> `onZoom`
- `'value_change'` -> `onValueChange`

Handlers follow the same pattern as built-in widgets: pure functions
`(state, event) => newState`.

## Container extensions

Set `container: true` to accept children:

```typescript
const Panel = defineExtensionWidget({
  type: 'panel',
  props: { title: 'string', collapsible: 'boolean' },
  container: true,
})

// Usage:
Panel('myPanel', { title: 'Settings', collapsible: true }, [
  text('Option 1'),
  text('Option 2'),
])
```

## Extension commands

Generate command constructors from the extension config:

```typescript
import { extensionCommands } from 'plushie'

const chartCommands = extensionCommands({
  type: 'chart',
  commands: ['set_data', 'zoom_to', 'reset_view'],
})

// Usage:
chartCommands.set_data('myChart', { values: [1, 2, 3] })
chartCommands.zoom_to('myChart', { range: [0, 100] })
chartCommands.reset_view('myChart')
```

Each returns a `Command` that sends an `extension_command` wire
message to the renderer.

## Extension config

Pass configuration to extensions via the app settings:

```typescript
app({
  settings: {
    extensionConfig: {
      chart: { defaultColor: '#3498db', gridLines: true },
    },
  },
  ...
})
```

The renderer forwards `extension_config` to registered extensions
at startup.

## Native widget extensions (Rust)

For extensions that render custom content (not composed from existing
widgets), the Rust side implements the `WidgetExtension` trait.
Build the custom binary with:

```sh
PLUSHIE_SOURCE_PATH=~/plushie npx plushie build
```

The TypeScript SDK handles the wire protocol automatically. Your
extension widget definition in TypeScript matches the Rust widget's
type name and props.

See the [plushie Rust docs](https://github.com/plushie-ui/plushie)
for the `WidgetExtension` trait API.
