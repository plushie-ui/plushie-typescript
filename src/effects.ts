import { COMMAND } from "./types.js"
import type { Command } from "./types.js"

function cmd(type: string, payload: Record<string, unknown>): Command {
  return Object.freeze({ [COMMAND]: true as const, type, payload })
}

let counter = 0

function generateId(): string {
  counter += 1
  return `ef_${counter}`
}

/** Reset the ID counter (for testing). */
export function _resetIdCounter(): void {
  counter = 0
}

// -- Default timeouts (ms) ------------------------------------------------

const FILE_TIMEOUT = 120_000
const CLIPBOARD_TIMEOUT = 5_000
const NOTIFICATION_TIMEOUT = 5_000

// -- Types ----------------------------------------------------------------

export interface FileDialogOptions {
  readonly title?: string
  readonly directory?: string
  readonly filters?: ReadonlyArray<readonly [string, string]>
  readonly timeout?: number
}

export interface FileSaveOptions extends FileDialogOptions {
  readonly defaultName?: string
}

export interface DirectoryOptions {
  readonly title?: string
  readonly directory?: string
  readonly timeout?: number
}

export interface NotificationOptions {
  readonly icon?: string
  readonly timeout?: number
  readonly urgency?: "low" | "normal" | "critical"
  readonly sound?: string
}

// -- Helpers --------------------------------------------------------------

function effectCmd(
  kind: string,
  opts: Record<string, unknown>,
  defaultTimeout: number,
): Command {
  const timeout = typeof opts["timeout"] === "number" ? opts["timeout"] : defaultTimeout
  const payload: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(opts)) {
    if (k !== "timeout" && v !== undefined) {
      payload[k] = v
    }
  }
  const id = generateId()
  return cmd("effect", { id, kind, payload, timeout })
}

// -- File dialogs ---------------------------------------------------------

/** Open-file dialog. */
export function fileOpen(opts: FileDialogOptions = {}): Command {
  return effectCmd("file_open", opts as Record<string, unknown>, FILE_TIMEOUT)
}

/** Multi-file open dialog. */
export function fileOpenMultiple(opts: FileDialogOptions = {}): Command {
  return effectCmd("file_open_multiple", opts as Record<string, unknown>, FILE_TIMEOUT)
}

/** Save-file dialog. */
export function fileSave(opts: FileSaveOptions = {}): Command {
  return effectCmd("file_save", opts as Record<string, unknown>, FILE_TIMEOUT)
}

/** Directory picker. */
export function directorySelect(opts: DirectoryOptions = {}): Command {
  return effectCmd("directory_select", opts as Record<string, unknown>, FILE_TIMEOUT)
}

/** Multi-directory picker. */
export function directorySelectMultiple(opts: DirectoryOptions = {}): Command {
  return effectCmd("directory_select_multiple", opts as Record<string, unknown>, FILE_TIMEOUT)
}

// -- Clipboard ------------------------------------------------------------

/** Read clipboard contents. */
export function clipboardRead(): Command {
  return effectCmd("clipboard_read", {}, CLIPBOARD_TIMEOUT)
}

/** Write text to the clipboard. */
export function clipboardWrite(text: string): Command {
  return effectCmd("clipboard_write", { text }, CLIPBOARD_TIMEOUT)
}

/** Read HTML content from the clipboard. */
export function clipboardReadHtml(): Command {
  return effectCmd("clipboard_read_html", {}, CLIPBOARD_TIMEOUT)
}

/** Write HTML content to the clipboard. */
export function clipboardWriteHtml(html: string, altText?: string): Command {
  const opts: Record<string, unknown> = { html }
  if (altText !== undefined) {
    opts["altText"] = altText
  }
  return effectCmd("clipboard_write_html", opts, CLIPBOARD_TIMEOUT)
}

/** Clear the clipboard. */
export function clipboardClear(): Command {
  return effectCmd("clipboard_clear", {}, CLIPBOARD_TIMEOUT)
}

/** Read primary clipboard (middle-click paste on Linux). */
export function clipboardReadPrimary(): Command {
  return effectCmd("clipboard_read_primary", {}, CLIPBOARD_TIMEOUT)
}

/** Write text to the primary clipboard. */
export function clipboardWritePrimary(text: string): Command {
  return effectCmd("clipboard_write_primary", { text }, CLIPBOARD_TIMEOUT)
}

// -- Notifications --------------------------------------------------------

/** Show an OS notification. */
export function notification(
  title: string,
  body: string,
  opts: NotificationOptions = {},
): Command {
  const payload: Record<string, unknown> = { title, body }
  if (opts.icon !== undefined) payload["icon"] = opts.icon
  if (opts.timeout !== undefined) payload["timeout"] = opts.timeout
  if (opts.urgency !== undefined) payload["urgency"] = opts.urgency
  if (opts.sound !== undefined) payload["sound"] = opts.sound
  return effectCmd("notification", payload, NOTIFICATION_TIMEOUT)
}
