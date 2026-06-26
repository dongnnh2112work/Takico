#!/bin/bash
# Play Takico.app — runs from Contents/Resources/launch.sh
set -uo pipefail

RESOURCES="$(cd "$(dirname "$0")" && pwd)"
APP_ROOT="$(cd "$RESOURCES/../.." && pwd)"
GAME="$RESOURCES/game"
export TAKICO_ROOT="$GAME"

# Clear quarantine after copy/USB/zip (no-op if already clean)
xattr -cr "$APP_ROOT" 2>/dev/null || true

cleanup() {
  if [[ -x "$GAME/stop-launcher.sh" ]]; then
    bash "$GAME/stop-launcher.sh" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

if [[ ! -x "$GAME/takico-start.sh" ]]; then
  osascript -e 'display alert "DI CUNG TAKICO" message "Missing game data inside the app. Copy the full macos folder from the release package." as critical' 2>/dev/null || true
  exit 1
fi

bash "$GAME/takico-start.sh" || exit 1

RUNTIME_DIR="$(cd "$APP_ROOT/.." && pwd)"
PID_FILE="$RUNTIME_DIR/.takico-server.pid"
if [[ -f "$PID_FILE" ]]; then
  PID="$(cat "$PID_FILE")"
  while kill -0 "$PID" 2>/dev/null; do
    sleep 1
  done
fi
