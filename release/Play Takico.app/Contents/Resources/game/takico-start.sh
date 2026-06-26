#!/bin/bash
# Khởi động server nền + mở trình duyệt, thoát ngay (app giữ menu Quit hoạt động)
set -uo pipefail

if [[ -n "${TAKICO_ROOT:-}" ]]; then
  ROOT="$TAKICO_ROOT"
else
  ROOT="$(cd "$(dirname "$0")" && pwd)"
fi
cd "$ROOT"

PORT=8765
export TAKICO_PORT="$PORT"
PID_FILE="$ROOT/.takico-server.pid"
LOG_FILE="$ROOT/.takico-server.log"
URL="http://127.0.0.1:${PORT}/"
SERVER_BIN="$ROOT/bin/takico-server"

alert() {
  osascript -e "display alert \"ĐI CÙNG TAKICO\" message \"$1\" as critical" 2>/dev/null || true
}

open_browser() {
  if [[ -d "/Applications/Google Chrome.app" ]]; then
    open -na "Google Chrome" --args --app="$URL" --start-fullscreen --autoplay-policy=no-user-gesture-required 2>/dev/null && return 0
  fi
  if [[ -d "/Applications/Microsoft Edge.app" ]]; then
    open -na "Microsoft Edge" --args --app="$URL" --start-fullscreen 2>/dev/null && return 0
  fi
  if [[ -d "/Applications/Safari.app" ]]; then
    open -a Safari "$URL" 2>/dev/null && return 0
  fi
  open "$URL" 2>/dev/null || true
}

# Đã chạy → chỉ mở lại trình duyệt (double-click app / Reopen)
if curl -sf "$URL" >/dev/null 2>&1; then
  open_browser
  exit 0
fi

if [[ ! -x "$SERVER_BIN" ]]; then
  alert "Thiếu file bin/takico-server. Giải nén lại bản zip đầy đủ."
  exit 1
fi

if [[ -f "$PID_FILE" ]]; then
  kill "$(cat "$PID_FILE")" 2>/dev/null || true
  rm -f "$PID_FILE"
fi
lsof -ti "tcp:${PORT}" 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 0.2

: >"$LOG_FILE"
( cd "$ROOT" && nohup "$SERVER_BIN" >>"$LOG_FILE" 2>&1 </dev/null & echo $! >"$PID_FILE" )
disown -a 2>/dev/null || true
sleep 0.5

ready=0
for _ in $(seq 1 25); do
  if curl -sf "$URL" >/dev/null 2>&1; then ready=1; break; fi
  sleep 0.3
done

if [[ "$ready" -ne 1 ]]; then
  err="$(tail -5 "$LOG_FILE" 2>/dev/null | tr '\n' ' ')"
  alert "Không khởi động được game. Chi tiết: ${err:-không có log}"
  exit 1
fi

open_browser
exit 0
