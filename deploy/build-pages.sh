#!/usr/bin/env bash
set -euo pipefail

# 工具版本固定：Rust 由 rust-toolchain.toml 決定；wasm-pack 與 CI 使用同一版本。
WASM_PACK_VERSION="0.13.1"
WASM_PACK_SHA256="c539d91ccab2591a7e975bcf82c82e1911b03335c80aa83d67ad25ed2ad06539"

export PATH="$HOME/.cargo/bin:$PATH"

if ! command -v rustup >/dev/null 2>&1; then
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
    | sh -s -- -y --profile minimal --default-toolchain none
fi

# rustup >= 1.28 用 `toolchain install` 讀取 rust-toolchain.toml；舊版由 `show` 自動安裝。
rustup toolchain install 2>/dev/null || rustup show
rustup target add wasm32-unknown-unknown

if [ "$(wasm-pack --version 2>/dev/null)" != "wasm-pack ${WASM_PACK_VERSION}" ]; then
  name="wasm-pack-v${WASM_PACK_VERSION}-x86_64-unknown-linux-musl"
  tmp="$(mktemp -d)"
  curl --proto '=https' --tlsv1.2 -sSfL -o "$tmp/wasm-pack.tar.gz" \
    "https://github.com/wasm-bindgen/wasm-pack/releases/download/v${WASM_PACK_VERSION}/${name}.tar.gz"
  echo "${WASM_PACK_SHA256}  $tmp/wasm-pack.tar.gz" | sha256sum -c -
  tar -xzf "$tmp/wasm-pack.tar.gz" -C "$tmp"
  mkdir -p "$HOME/.cargo/bin"
  install -m 0755 "$tmp/${name}/wasm-pack" "$HOME/.cargo/bin/wasm-pack"
  rm -rf "$tmp"
fi

npm --prefix web ci
npm --prefix web run build:wasm
npm --prefix web run build
