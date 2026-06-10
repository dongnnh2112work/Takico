#!/bin/bash
# ĐI CÙNG TAKICO — khởi động game offline (macOS)
# Được gọi từ Chơi Takico.command hoặc Chơi Takico.app

# Không dùng set -e: lỗi mở Chrome không được thì fallback Safari/trình duyệt mặc định
set -uo pipefail

# ROOT = thư mục chứa index.html (cha của .app nếu chạy từ app bundle)
if [[ -n "${TAKICO_ROOT:-}" ]]; then
  ROOT="$TAKICO_ROOT"
else
  ROOT="$(cd "$(dirname "$0")" && pwd)"
fi
cd "$ROOT"

# Gỡ cờ quarantine sau khi giải nén (macOS chặn file tải về)
xattr -cr "$ROOT" 2>/dev/null || true

PORT=8765
PID_FILE="$ROOT/.takico-server.pid"
URL="http://127.0.0.1:${PORT}/"

cleanup() {
  if [[ -f "$PID_FILE" ]]; then
    kill "$(cat "$PID_FILE")" 2>/dev/null || true
    rm -f "$PID_FILE"
  fi
}
trap cleanup EXIT INT TERM

if ! command -v python3 >/dev/null 2>&1; then
  osascript -e 'display alert "Thiếu Python 3" message "Cài Python 3 từ python.org hoặc chạy trong Terminal: xcode-select --install" as critical'
  read -r -p "Nhấn Enter để đóng..." _
  exit 1
fi

if lsof -ti "tcp:${PORT}" >/dev/null 2>&1; then
  lsof -ti "tcp:${PORT}" | xargs kill -9 2>/dev/null || true
  sleep 0.5
fi

python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
echo $! > "$PID_FILE"
sleep 1.2

if ! curl -sf "$URL" >/dev/null 2>&1; then
  osascript -e 'display alert "Không khởi động được game" message "Máy chủ cục bộ không phản hồi. Xem HUONG-DAN-SU-DUNG.md" as critical'
  read -r -p "Nhấn Enter để đóng..." _
  exit 1
fi

open_browser() {
  if [[ -d "/Applications/Google Chrome.app" ]]; then
    if open -na "Google Chrome" --args --app="$URL" --start-fullscreen --autoplay-policy=no-user-gesture-required 2>/dev/null; then
      return 0
    fi
  fi
  if [[ -d "/Applications/Microsoft Edge.app" ]]; then
    if open -na "Microsoft Edge" --args --app="$URL" --start-fullscreen 2>/dev/null; then
      return 0
    fi
  fi
  if [[ -d "/Applications/Safari.app" ]]; then
  open -a Safari "$URL" 2>/dev/null && return 0
  fi
  open "$URL" 2>/dev/null || true
}
open_browser

clear
echo ""
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║   ĐI CÙNG TAKICO — đang chạy                 ║"
echo "  ║   $URL"
echo "  ║                                              ║"
echo "  ║   • Cho phép Camera khi trình duyệt hỏi      ║"
echo "  ║   • Đóng cửa sổ Terminal này = tắt game      ║"
echo "  ╚══════════════════════════════════════════════╝"
echo ""

wait "$(cat "$PID_FILE")" 2>/dev/null || true
