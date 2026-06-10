#!/bin/bash
# Tắt server khi Quit app (Cmd+Q / menu Thoát)
if [[ -n "${TAKICO_ROOT:-}" ]]; then
  ROOT="$TAKICO_ROOT"
else
  ROOT="$(cd "$(dirname "$0")" && pwd)"
fi

PORT=8765
PID_FILE="$ROOT/.takico-server.pid"

if [[ -f "$PID_FILE" ]]; then
  kill "$(cat "$PID_FILE")" 2>/dev/null || true
  rm -f "$PID_FILE"
fi
lsof -ti "tcp:${PORT}" 2>/dev/null | xargs kill -9 2>/dev/null || true
pkill -f "takico-server" 2>/dev/null || true
