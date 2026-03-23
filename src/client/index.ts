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

export {
  resolveBinary, platformBinaryName, validateArchitecture,
  downloadBinary, BINARY_VERSION, RELEASE_BASE_URL,
} from "./binary.js"
export { buildRendererEnv } from "./env.js"

export { SpawnTransport, StdioTransport } from "./transport.js"
export type { Transport, WireFormat, SpawnTransportOptions, StdioTransportOptions } from "./transport.js"

export { WasmTransport } from "./wasm_transport.js"
export type {
  PlushieAppConstructor, PlushieAppInstance, WasmTransportOptions,
} from "./wasm_transport.js"

export { Session } from "./session.js"
export type { ConnectOptions } from "./session.js"
