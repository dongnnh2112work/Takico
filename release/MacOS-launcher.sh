#!/bin/bash
# Entry point Play Takico.app — game in Contents/Resources/game
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GAME="$ROOT/Resources/game"
export TAKICO_ROOT="$GAME"

xattr -cr "$GAME" 2>/dev/null || true

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

PID_FILE="$GAME/.takico-server.pid"
if [[ -f "$PID_FILE" ]]; then
  PID="$(cat "$PID_FILE")"
  while kill -0 "$PID" 2>/dev/null; do
    sleep 1
  done
fi
