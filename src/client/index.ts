/**
 * Layer 1: Protocol Client.
 *
 * Foundational infrastructure for communicating with the plushie
 * binary. Everything else in the SDK depends on this layer.
 *
 * @module
 */

// Tree normalization (UINode -> WireNode): needed by advanced users
// building custom transports or shared-state servers.
export type { NormalizeContext, WireNode } from "../tree/normalize.js";
export { normalize } from "../tree/normalize.js";
export {
  BINARY_VERSION,
  downloadBinary,
  platformBinaryName,
  RELEASE_BASE_URL,
  resolveBinary,
  validateArchitecture,
} from "./binary.js";
export { buildRendererEnv } from "./env.js";
export type { DecodeLinesResult, DecodePacketsResult } from "./framing.js";
export { decodeLines, decodePackets, encodeLine, encodePacket } from "./framing.js";
export type {
  DecodedResponse,
  HelloInfo,
  ScopedId,
  WireMessage,
  WirePatchOp,
  WireSelector,
} from "./protocol.js";
export {
  decodeEvent,
  decodeMessage,
  encodeAdvanceFrame,
  encodeCommand,
  encodeCommands,
  encodeEffect,
  encodeImageOp,
  encodeInteract,
  encodePatch,
  encodeQuery,
  encodeReset,
  encodeScreenshot,
  encodeSettings,
  encodeSnapshot,
  encodeSubscribe,
  encodeSystemOp,
  encodeSystemQuery,
  encodeTreeHash,
  encodeUnsubscribe,
  encodeWidgetOp,
  encodeWindowOp,
  PROTOCOL_VERSION,
  splitScopedId,
  stringifyKeys,
} from "./protocol.js";
export type { ConnectOptions } from "./session.js";
export { Session } from "./session.js";
export type { SocketTransportOptions } from "./socket_transport.js";
export { SocketTransport } from "./socket_transport.js";
export type {
  SpawnTransportOptions,
  StdioTransportOptions,
  Transport,
  WireFormat,
} from "./transport.js";
export { SpawnTransport, StdioTransport } from "./transport.js";
export type {
  PlushieAppConstructor,
  PlushieAppInstance,
  WasmTransportOptions,
} from "./wasm_transport.js";
export { WasmTransport } from "./wasm_transport.js";
