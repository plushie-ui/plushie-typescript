# Versioning

## Two independent axes

The plushie TypeScript SDK has its own npm version, tracked via
`package.json`. Separately, it pins an exact plushie-rust release via
`PLUSHIE_RUST_VERSION` in `src/client/binary.ts`.

- SDK version: bumps for TypeScript-only changes (API tweaks,
  documentation, build fixes, new high-level helpers built on top of
  the existing wire protocol).
- `PLUSHIE_RUST_VERSION`: bumps when the SDK moves to a newer plushie
  renderer, build tool, or wire protocol.

An SDK release can bump one axis without the other. A dialyzer-style
fix in TypeScript lands as an SDK bump with `PLUSHIE_RUST_VERSION`
unchanged. A renderer bug fix typically bumps `PLUSHIE_RUST_VERSION`
and the SDK version together.

## Exact-match compatibility rule

`PLUSHIE_RUST_VERSION` is a precise pin, not a semver range. The SDK
release promises that every plushie-rust artifact it touches (the
renderer binary, `cargo-plushie`, the generated `Cargo.toml` deps,
the protocol messages) comes from exactly that plushie-rust release.

Rationale: the renderer binary, the build-tool-generated workspace,
and the wire protocol all travel together. One mismatched axis puts
the SDK out of sync with itself. Forcing an exact match removes the
entire "mostly works except for the message that changed" class of
bugs.

## What PLUSHIE_RUST_VERSION pins

- The prebuilt `plushie-renderer` binary downloaded from GitHub
  releases by `npx plushie download` and `scripts/postinstall.mjs`.
- The `cargo-plushie` CLI invoked by `npx plushie build` (either
  installed as `cargo-plushie --version <pin>` or resolved through
  `PLUSHIE_RUST_SOURCE_PATH`).
- The protocol version asserted at handshake in `session.ts`.

## Updating the pin

1. Edit `src/client/binary.ts` and bump `PLUSHIE_RUST_VERSION`.
2. Edit `scripts/postinstall.mjs` and bump the matching constant.
3. Note the change in `CHANGELOG.md` under "Changed" with a link to
   the upstream plushie-rust release notes.
4. Run `pnpm preflight`.

Consumers installing `cargo-plushie` from crates.io must match the
new pin: `cargo install cargo-plushie --version <new pin>`.
Developers running against a local checkout via
`PLUSHIE_RUST_SOURCE_PATH` should update that checkout to the tagged
release.

## Related docs

- plushie-rust workspace policy:
  [docs/versioning.md](https://github.com/plushie-ui/plushie-rust/blob/main/docs/versioning.md)
- Custom renderer builds: [native-widgets.md](native-widgets.md)
