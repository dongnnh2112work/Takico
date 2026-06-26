#!/bin/bash
# Khởi động server nền + mở trình duyệt
set -uo pipefail

if [[ -n "${TAKICO_ROOT:-}" ]]; then
  ROOT="$TAKICO_ROOT"
else
  ROOT="$(cd "$(dirname "$0")" && pwd)"
fi
cd "$ROOT"

PORT=8765
export TAKICO_PORT="$PORT"
URL="http://127.0.0.1:${PORT}/"

# macOS: pid/log + server copy live beside Play Takico.app (not inside signed bundle)
if [[ "$ROOT" == *".app/Contents/"* ]]; then
  RUNTIME_DIR="$(cd "$ROOT/../../../.." && pwd)"
else
  RUNTIME_DIR="$ROOT"
fi
mkdir -p "$RUNTIME_DIR" 2>/dev/null || true

PID_FILE="$RUNTIME_DIR/.takico-server.pid"
LOG_FILE="$RUNTIME_DIR/.takico-server.log"
BUNDLED_SERVER="$ROOT/bin/takico-server"
SERVER_BIN="$RUNTIME_DIR/takico-server"

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

if curl -sf "$URL" >/dev/null 2>&1; then
  open_browser
  exit 0
fi

if [[ ! -f "$BUNDLED_SERVER" ]]; then
  alert "Thiếu bin/takico-server. Giải nén lại macos.zip đầy đủ."
  exit 1
fi

xattr -cr "$ROOT" 2>/dev/null || true
xattr -cr "$RUNTIME_DIR" 2>/dev/null || true

if [[ ! -x "$SERVER_BIN" ]] || ! cmp -s "$BUNDLED_SERVER" "$SERVER_BIN" 2>/dev/null; then
  if ! cp -f "$BUNDLED_SERVER" "$SERVER_BIN" 2>/dev/null; then
    alert "Không ghi được vào thư mục game (quyền hoặc ổ đĩa). Thử copy macos ra Desktop rồi chạy lại."
    exit 1
  fi
  chmod +x "$SERVER_BIN"
  xattr -cr "$SERVER_BIN" 2>/dev/null || true
  codesign -s - --force --timestamp=none "$SERVER_BIN" 2>/dev/null || true
fi

if [[ ! -x "$SERVER_BIN" ]]; then
  alert "Không chạy được takico-server. Mở Terminal: xattr -cr \"$(dirname "$RUNTIME_DIR")/macos\" (hoặc thư mục chứa Play Takico.app)"
  exit 1
fi

if [[ -f "$PID_FILE" ]]; then
  kill "$(cat "$PID_FILE")" 2>/dev/null || true
  rm -f "$PID_FILE"
fi
lsof -ti "tcp:${PORT}" 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 0.2

if ! : >>"$LOG_FILE" 2>/dev/null; then
  LOG_FILE="${TMPDIR:-/tmp}/takico-server.log"
fi
: >"$LOG_FILE"

( cd "$ROOT" && nohup "$SERVER_BIN" >>"$LOG_FILE" 2>&1 </dev/null & echo $! >"$PID_FILE" )
disown -a 2>/dev/null || true
sleep 0.5

if [[ -f "$PID_FILE" ]]; then
  spid="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [[ -n "$spid" ]] && ! kill -0 "$spid" 2>/dev/null; then
    err="$(tail -8 "$LOG_FILE" 2>/dev/null | tr '\n' ' ')"
    alert "Server dừng ngay sau khi khởi động.${err:+ $err}"
    exit 1
  fi
fi

ready=0
for _ in $(seq 1 40); do
  if curl -sf "$URL" >/dev/null 2>&1; then ready=1; break; fi
  sleep 0.3
done

if [[ "$ready" -ne 1 ]]; then
  err="$(tail -8 "$LOG_FILE" 2>/dev/null | tr '\n' ' ')"
  if [[ -z "$err" ]]; then
    err="Port ${PORT} chưa lắng nghe. Thử: chuột phải Play Takico.command → Open; hoặc xattr -cr thư mục macos."
  fi
  alert "Không khởi động được game. ${err}"
  exit 1
fi

open_browser
exit 0
