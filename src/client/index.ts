// Layer 1: Protocol Client
//
// Foundational infrastructure for communicating with the plushie
// binary over stdin/stdout. Everything else in the SDK depends on
// this layer.
//
// Modules:
//   binary.ts    -- binary resolution, download, architecture validation
//   transport.ts -- Transport interface, SpawnTransport, PooledTransport
//   framing.ts   -- wire framing (msgpack length-prefix, JSONL)
//   protocol.ts  -- message encode/decode (wire format <-> TS types)
//   session.ts   -- single session management
//   pool.ts      -- multiplexed session pool

export { }
