# plushie-typescript - Development Tasks
#
# Run `just` to see available recipes.
# Run `just preflight` before pushing to catch CI failures locally.

set shell := ["bash", "-euo", "pipefail", "-c"]

default:
    @just --list

# Install dependencies
deps:
    pnpm install --frozen-lockfile

# Run all CI checks locally (same as CI pipeline).
# Auto-detects ../plushie-rust as PLUSHIE_RUST_SOURCE_PATH when not set.
# Set PLUSHIE_RUST_SOURCE_PATH="" to force non-local (skip auto-detect).
preflight: deps
    #!/usr/bin/env bash
    set -euo pipefail
    if [[ -z "${PLUSHIE_RUST_SOURCE_PATH+x}" ]] && [[ -d "../plushie-rust" ]]; then
        export PLUSHIE_RUST_SOURCE_PATH="$(cd ../plushie-rust && pwd)"
        echo "==> auto: PLUSHIE_RUST_SOURCE_PATH=$PLUSHIE_RUST_SOURCE_PATH"
    fi
    pnpm preflight

# Run tests
test:
    pnpm test

# Check code formatting and lint
fmt-check:
    pnpm exec biome check src/ test/ examples/

# Apply formatting fixes
fmt:
    pnpm exec biome format --write src/ test/ examples/

# Run linter
lint:
    pnpm lint

# Run type checker
typecheck:
    pnpm check

# Build package
build:
    pnpm build

# Generate docs
docs:
    pnpm docs

# Remove gitignored build artifacts
clean:
    git clean -fdX
