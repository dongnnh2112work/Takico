#!/bin/bash
# Tắt server khi Quit app (Cmd+Q / menu Thoát)
if [[ -n "${TAKICO_ROOT:-}" ]]; then
  ROOT="$TAKICO_ROOT"
else
  ROOT="$(cd "$(dirname "$0")" && pwd)"
fi

PORT=8765

if [[ -n "${TAKICO_RUNTIME:-}" ]]; then
  RUNTIME_DIR="$TAKICO_RUNTIME"
elif [[ "$(basename "$ROOT")" == "_takico" ]]; then
  RUNTIME_DIR="$(cd "$ROOT/.." && pwd)"
elif [[ "$ROOT" == *".app/Contents/"* ]]; then
  RUNTIME_DIR="$(cd "$ROOT/../../../.." && pwd)"
else
  RUNTIME_DIR="$ROOT"
fi
PID_FILE="$RUNTIME_DIR/.takico-server.pid"

if [[ -f "$PID_FILE" ]]; then
  kill "$(cat "$PID_FILE")" 2>/dev/null || true
  rm -f "$PID_FILE"
fi
lsof -ti "tcp:${PORT}" 2>/dev/null | xargs kill -9 2>/dev/null || true
pkill -f "$RUNTIME_DIR/takico-server" 2>/dev/null || true
pkill -f "takico-server" 2>/dev/null || true
