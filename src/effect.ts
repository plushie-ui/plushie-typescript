/**
 * Platform effect commands: file dialogs, clipboard, notifications.
 *
 * Each function takes a `tag` string as the first argument and returns
 * a {@link Command} that triggers a platform-native side effect. Results
 * arrive as `EffectEvent` with the matching tag through the update cycle.
 *
 * Only one effect per tag can be in flight at a time. Starting a new
 * effect with a tag that already has a pending request discards the
 * previous one.
 *
 * @example
 * ```ts
 * import { Effect, isEffect } from 'plushie'
 *
 * // Dispatch an effect:
 * Effect.fileOpen("import", { title: "Pick a file" })
 *
 * // Handle the result in update:
 * if (isEffect(event, "import")) {
 *   if (event.status === "ok") handleFile(event.result)
 * }
 * ```
 *
 * @module
 */

import type { Command } from "./types.js";
import { COMMAND } from "./types.js";

function cmd(type: string, payload: Record<string, unknown>): Command {
  return Object.freeze({ [COMMAND]: true as const, type, payload });
}

let counter = 0;

function generateId(): string {
  counter += 1;
  return `ef_${counter}`;
}

/** Reset the ID counter (for testing). */
export function _resetIdCounter(): void {
  counter = 0;
}

// -- Default timeouts (ms) ------------------------------------------------

const FILE_TIMEOUT = 120_000;
const CLIPBOARD_TIMEOUT = 5_000;
const NOTIFICATION_TIMEOUT = 5_000;

// -- Types ----------------------------------------------------------------

/** Options for file open dialogs. */
export interface FileDialogOptions {
  readonly title?: string;
  readonly directory?: string;
  /** File type filters as [label, pattern] pairs (e.g. ["Images", "*.png"]). */
  readonly filters?: ReadonlyArray<readonly [string, string]>;
  /** Override the effect response timeout in milliseconds. Default: 120s. */
  readonly timeout?: number;
}

/** Options for file save dialogs. */
export interface FileSaveOptions extends FileDialogOptions {
  readonly defaultName?: string;
}

/** Options for directory picker dialogs. */
export interface DirectoryOptions {
  readonly title?: string;
  readonly directory?: string;
  readonly timeout?: number;
}

/** Options for OS notifications. */
export interface NotificationOptions {
  /** Icon name or path. */
  readonly icon?: string;
  /** Auto-dismiss timeout in milliseconds. Sent to the renderer as the display duration. */
  readonly timeout?: number;
  /** Notification urgency level. */
  readonly urgency?: "low" | "normal" | "critical";
  /** Sound name to play. */
  readonly sound?: string;
}

// -- Helpers --------------------------------------------------------------

function effectCmd(
  tag: string,
  kind: string,
  opts: Record<string, unknown>,
  defaultTimeout: number,
): Command {
  const timeout = typeof opts["timeout"] === "number" ? opts["timeout"] : defaultTimeout;
  const payload: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(opts)) {
    if (k !== "timeout" && v !== undefined) {
      payload[k] = v;
    }
  }
  const id = generateId();
  return cmd("effect", { id, tag, kind, payload, timeout });
}

// -- File dialogs ---------------------------------------------------------

/** Open-file dialog. Results arrive as EffectEvent with matching tag. */
export function fileOpen(tag: string, opts: FileDialogOptions = {}): Command {
  return effectCmd(tag, "file_open", opts as Record<string, unknown>, FILE_TIMEOUT);
}

/** Multi-file open dialog. Results arrive as EffectEvent with matching tag. */
export function fileOpenMultiple(tag: string, opts: FileDialogOptions = {}): Command {
  return effectCmd(tag, "file_open_multiple", opts as Record<string, unknown>, FILE_TIMEOUT);
}

/** Save-file dialog. Results arrive as EffectEvent with matching tag. */
export function fileSave(tag: string, opts: FileSaveOptions = {}): Command {
  return effectCmd(tag, "file_save", opts as Record<string, unknown>, FILE_TIMEOUT);
}

/** Directory picker. Results arrive as EffectEvent with matching tag. */
export function directorySelect(tag: string, opts: DirectoryOptions = {}): Command {
  return effectCmd(tag, "directory_select", opts as Record<string, unknown>, FILE_TIMEOUT);
}

/** Multi-directory picker. Results arrive as EffectEvent with matching tag. */
export function directorySelectMultiple(tag: string, opts: DirectoryOptions = {}): Command {
  return effectCmd(tag, "directory_select_multiple", opts as Record<string, unknown>, FILE_TIMEOUT);
}

// -- Clipboard ------------------------------------------------------------

/** Read clipboard contents. Results arrive as EffectEvent with matching tag. */
export function clipboardRead(tag: string): Command {
  return effectCmd(tag, "clipboard_read", {}, CLIPBOARD_TIMEOUT);
}

/** Write text to the clipboard. Results arrive as EffectEvent with matching tag. */
export function clipboardWrite(tag: string, text: string): Command {
  return effectCmd(tag, "clipboard_write", { text }, CLIPBOARD_TIMEOUT);
}

/** Read HTML content from the clipboard. */
export function clipboardReadHtml(tag: string): Command {
  return effectCmd(tag, "clipboard_read_html", {}, CLIPBOARD_TIMEOUT);
}

/** Write HTML content to the clipboard. */
export function clipboardWriteHtml(tag: string, html: string, altText?: string): Command {
  const opts: Record<string, unknown> = { html };
  if (altText !== undefined) {
    opts["alt_text"] = altText;
  }
  return effectCmd(tag, "clipboard_write_html", opts, CLIPBOARD_TIMEOUT);
}

/** Clear the clipboard. */
export function clipboardClear(tag: string): Command {
  return effectCmd(tag, "clipboard_clear", {}, CLIPBOARD_TIMEOUT);
}

/** Read primary clipboard (middle-click paste on Linux). */
export function clipboardReadPrimary(tag: string): Command {
  return effectCmd(tag, "clipboard_read_primary", {}, CLIPBOARD_TIMEOUT);
}

/** Write text to the primary clipboard. */
export function clipboardWritePrimary(tag: string, text: string): Command {
  return effectCmd(tag, "clipboard_write_primary", { text }, CLIPBOARD_TIMEOUT);
}

// -- Notifications --------------------------------------------------------

/**
 * Show an OS notification. Results arrive as EffectEvent with matching tag.
 *
 * The `timeout` option in `NotificationOptions` is the notification
 * display duration sent to the renderer, not the effect response
 * timeout (which uses the default 5s).
 */
export function notification(
  tag: string,
  title: string,
  body: string,
  opts: NotificationOptions = {},
): Command {
  const payload: Record<string, unknown> = { title, body };
  if (opts.icon !== undefined) payload["icon"] = opts.icon;
  if (opts.timeout !== undefined) payload["timeout"] = opts.timeout;
  if (opts.urgency !== undefined) payload["urgency"] = opts.urgency;
  if (opts.sound !== undefined) payload["sound"] = opts.sound;
  const id = generateId();
  return cmd("effect", { id, tag, kind: "notification", payload, timeout: NOTIFICATION_TIMEOUT });
}
