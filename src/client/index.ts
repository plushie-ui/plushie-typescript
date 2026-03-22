/**
 * Layer 1: Protocol Client.
 *
 * Foundational infrastructure for communicating with the plushie
 * binary. Everything else in the SDK depends on this layer.
 *
 * @module
 */

export { encodePacket, decodePackets, encodeLine, decodeLines } from "./framing.js"
export type { DecodePacketsResult, DecodeLinesResult } from "./framing.js"

export {
  encodeSettings, encodeSnapshot, encodePatch, encodeSubscribe,
  encodeUnsubscribe, encodeWidgetOp, encodeWindowOp, encodeEffect,
  encodeImageOp, encodeExtensionCommand, encodeExtensionCommands,
  encodeQuery, encodeInteract, encodeTreeHash, encodeScreenshot,
  encodeReset, encodeAdvanceFrame, decodeMessage, decodeEvent,
  splitScopedId, stringifyKeys, PROTOCOL_VERSION,
} from "./protocol.js"
export type {
  WireMessage, WirePatchOp, HelloInfo, WireSelector, ScopedId,
  DecodedResponse,
} from "./protocol.js"

export { resolveBinary, platformBinaryName } from "./binary.js"
export { buildRendererEnv } from "./env.js"

export { SpawnTransport } from "./transport.js"
export type { Transport, WireFormat, SpawnTransportOptions } from "./transport.js"

export { Session } from "./session.js"
export type { ConnectOptions } from "./session.js"
