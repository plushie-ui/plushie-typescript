# Effects

Effects are native platform operations that require the renderer to
interact with the OS on behalf of the host. File dialogs, clipboard
access, notifications, and similar features are effects.

## How effects work

Every effect function returns a `Command`. Return it from a handler
or `update()` as part of a `[model, command]` tuple. The result
arrives as an `EffectEvent` in `update()`.

<!-- test: effects_file_open_returns_effect_command, effects_ok_result_match, effects_cancelled_result_match, effects_error_result_match -- keep this code block in sync with the test -->
```typescript
import { Command, isEffect } from 'plushie'
import { Effects } from 'plushie'

const openFile = (s: Model) => [
  s,
  Effects.fileOpen({ title: 'Choose a file', filters: [['Text (*.txt)', '*.txt']] }),
]

// In update():
if (isEffect(event)) {
  if (event.status === 'ok') {
    return { ...state, filePath: (event.result as { path: string }).path }
  }
  if (event.status === 'cancelled') {
    return state  // user dismissed the dialog
  }
  if (event.status === 'error') {
    return { ...state, error: event.error }
  }
}
```

## File dialogs

```typescript
Effects.fileOpen({ title?, directory?, filters? })
Effects.fileOpenMultiple({ title?, directory?, filters? })
Effects.fileSave({ title?, directory?, filters?, defaultName? })
Effects.directorySelect({ title?, directory? })
Effects.directorySelectMultiple({ title?, directory? })
```

Filter format: `[['Label (*.ext)', '*.ext'], ...]`

Results:
- `fileOpen`: `{ path: string }`
- `fileOpenMultiple`: `{ paths: string[] }`
- `fileSave`: `{ path: string }`
- `directorySelect`: `{ path: string }`
- `directorySelectMultiple`: `{ paths: string[] }`

Default timeout: 120 seconds (file dialogs can stay open a long time).

## Clipboard

```typescript
Effects.clipboardRead()                          // { text: string }
Effects.clipboardWrite('Hello')                  // no result
Effects.clipboardReadHtml()                      // { html: string }
Effects.clipboardWriteHtml('<b>Hello</b>')       // no result
Effects.clipboardClear()                         // no result
Effects.clipboardReadPrimary()                   // Linux only
Effects.clipboardWritePrimary('Hello')           // Linux only
```

Default timeout: 5 seconds.

## Notifications

```typescript
Effects.notification('Title', 'Body', {
  icon?: 'dialog-information',   // freedesktop icon name
  timeout?: 5000,                // auto-dismiss in ms
  urgency?: 'normal',            // 'low' | 'normal' | 'critical'
  sound?: 'message-new-instant', // sound theme name
})
```

Default timeout: 5 seconds.

## Timeouts

Each effect kind has a default timeout. If the renderer doesn't
respond within the timeout, an error event is dispatched:

| Kind | Default timeout |
|---|---|
| File dialogs | 120 seconds |
| Clipboard ops | 5 seconds |
| Notifications | 5 seconds |

Override per-request:

<!-- test: effects_file_open_default_timeout, effects_clipboard_read_default_timeout, effects_notification_default_timeout, effects_file_open_custom_timeout -- keep this code block in sync with the test -->
```typescript
Effects.fileOpen({ title: 'Pick a file', timeout: 300000 })
```

## Effect status

The `EffectEvent` has three possible statuses:

- `'ok'`: the effect completed successfully. `event.result`
  contains the response data.
- `'cancelled'`: the user dismissed a dialog without selecting.
  No result or error field.
- `'error'`: something went wrong. `event.error` contains the
  reason string.

## Headless and mock modes

In headless and mock modes, all effects return `'cancelled'` status
immediately (there are no real platform dialogs). This is by design
-- tests should mock effect results at the app level, not depend on
platform dialogs.
