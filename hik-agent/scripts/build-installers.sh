#!/usr/bin/env bash
# Zeeron Face ID agenti — bitta faylli o'rnatuvchilarni yig'ish (macOS'da ishga tushiriladi).
#   npm run build:installers
# Natija (release/):
#   zeeron-agent-win-x64.exe        — Windows: ikki marta bosiladi, o'zini o'rnatadi
#   Zeeron-Agent-macos-arm64.pkg    — macOS Apple Silicon
#   Zeeron-Agent-macos-x64.pkg      — macOS Intel
# ERP ularni yuklab berishda fayl nomiga bir martalik ulash kodini qo'shadi
# (zeeron-agent-K7Q2-M9XD.exe) — agent kodni o'z nomidan o'qiydi.
# Serverga:  scp release/* vista:/srv/vista/shared/agent-builds/
set -euo pipefail
cd "$(dirname "$0")/.."
NODE_VERSION="$(node -v)"            # blob va ichidagi node bir xil versiya bo'lishi shart
VERSION="$(node -p "require('./package.json').version")"
CACHE=".build-cache/$NODE_VERSION"
OUT="release"
WORK="$(mktemp -d)"
FUSE="NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$CACHE" "$OUT"

echo "==> Bundle (esbuild)"
npx --yes esbuild@0.25 src/index.ts --bundle --platform=node --target=node22 --format=cjs \
  --external:sharp --outfile="$WORK/agent.cjs" --log-level=warning
cat >"$WORK/sea-config.json" <<JSON
{ "main": "$WORK/agent.cjs", "output": "$WORK/sea-prep.blob", "disableExperimentalSEAWarning": true, "useCodeCache": false }
JSON
node --experimental-sea-config "$WORK/sea-config.json" >/dev/null

fetch_node() { # $1 = darwin-arm64 | darwin-x64 | win-x64
  local target="$1" dir="$CACHE/$1"
  [ -f "$dir/node" ] || [ -f "$dir/node.exe" ] && return 0
  mkdir -p "$dir"
  if [ "$target" = "win-x64" ]; then
    curl -fsSL "https://nodejs.org/dist/$NODE_VERSION/win-x64/node.exe" -o "$dir/node.exe"
  else
    curl -fsSL "https://nodejs.org/dist/$NODE_VERSION/node-$NODE_VERSION-$target.tar.gz" | tar -xz -C "$WORK"
    cp "$WORK/node-$NODE_VERSION-$target/bin/node" "$dir/node"
  fi
}

echo "==> Windows x64"
fetch_node win-x64
cp "$CACHE/win-x64/node.exe" "$OUT/zeeron-agent-win-x64.exe"
npx --yes postject "$OUT/zeeron-agent-win-x64.exe" NODE_SEA_BLOB "$WORK/sea-prep.blob" --sentinel-fuse "$FUSE" >/dev/null

for arch in arm64 x64; do
  echo "==> macOS $arch"
  fetch_node "darwin-$arch"
  bin="$WORK/zeeron-agent-$arch"
  cp "$CACHE/darwin-$arch/node" "$bin"
  codesign --remove-signature "$bin"
  npx --yes postject "$bin" NODE_SEA_BLOB "$WORK/sea-prep.blob" --sentinel-fuse "$FUSE" --macho-segment-name NODE_SEA >/dev/null
  codesign --sign - "$bin"
  root="$WORK/pkgroot-$arch/Library/Application Support/Zeeron Agent"
  scripts="$WORK/pkgscripts-$arch"
  mkdir -p "$root" "$scripts"
  cp "$bin" "$root/zeeron-agent"
  chmod 755 "$root/zeeron-agent"
  cat >"$scripts/postinstall" <<'SH'
#!/bin/bash
# $1 — .pkg fayl yo'li: nomida bir martalik ulash kodi (Zeeron-Agent-K7Q2-M9XD.pkg)
exec "/Library/Application Support/Zeeron Agent/zeeron-agent" --install --code-from "$1"
SH
  chmod 755 "$scripts/postinstall"
  pkgbuild --quiet --root "$WORK/pkgroot-$arch" --scripts "$scripts" --identifier uz.zeeron.agent \
    --version "$VERSION" --install-location / "$OUT/Zeeron-Agent-macos-$arch.pkg"
done

ls -lh "$OUT"
