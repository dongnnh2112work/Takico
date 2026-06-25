#!/bin/bash
# Biên dịch takico-server (Go) cho macOS universal + Windows — không cần Python trên máy khách
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/release/bin"
SRC="$ROOT/server/main.go"
LDFLAGS="-s -w"

if ! command -v go >/dev/null 2>&1; then
  if [[ -x "$OUT/takico-server" ]] && [[ -f "$OUT/takico-server.exe" ]]; then
    echo "==> Dùng server binary có sẵn (không có Go để build mới)"
    ls -lh "$OUT/takico-server" "$OUT/takico-server.exe"
    exit 0
  fi
  echo "ERROR: Cần Go để build server. Cài: brew install go"
  exit 1
fi

mkdir -p "$OUT"
echo "==> Build takico-server (macOS arm64 + amd64 universal)"
(
  cd "$ROOT/server"
  GOOS=darwin GOARCH=arm64 go build -ldflags="$LDFLAGS" -o "$OUT/takico-server-arm64" .
  GOOS=darwin GOARCH=amd64 go build -ldflags="$LDFLAGS" -o "$OUT/takico-server-amd64" .
)
lipo -create -output "$OUT/takico-server" "$OUT/takico-server-arm64" "$OUT/takico-server-amd64"
chmod +x "$OUT/takico-server"
rm -f "$OUT/takico-server-arm64" "$OUT/takico-server-amd64"

echo "==> Build takico-server.exe (Windows)"
(
  cd "$ROOT/server"
  GOOS=windows GOARCH=amd64 go build -ldflags="$LDFLAGS" -o "$OUT/takico-server.exe" .
)

ls -lh "$OUT/takico-server" "$OUT/takico-server.exe"
echo "✓ Server binaries ready in release/bin/"
