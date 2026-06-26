#!/bin/bash
# Ad-hoc sign entire .app bundle (inside-out) for offline kiosk use
#   ./scripts/sign-macos-app.sh /path/to/Play\ Takico.app
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <path/to/Play Takico.app>"
  exit 1
fi

APP="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
GAME="$APP/Contents/Resources/game"

if [[ ! -d "$APP" ]]; then
  echo "ERROR: Không tìm thấy $APP"
  exit 1
fi

xattr -cr "$APP" 2>/dev/null || true

sign_file() {
  local f="$1"
  if [[ -f "$f" ]] && [[ -x "$f" ]]; then
    codesign -s - --force --timestamp=none "$f" 2>/dev/null || true
  fi
}

if [[ -d "$GAME" ]]; then
  sign_file "$GAME/bin/takico-server"
  while IFS= read -r -d '' f; do
    sign_file "$f"
  done < <(find "$GAME" -type f \( -perm -100 -o -name '*.sh' \) -print0 2>/dev/null)
fi

sign_file "$APP/Contents/Resources/launch.sh"
sign_file "$APP/Contents/MacOS/launcher"

codesign -s - --force --timestamp=none "$APP" 2>/dev/null || {
  echo "WARN: bundle codesign failed"
  exit 1
}

echo "✓ Signed: $APP"
codesign --verify --deep --strict "$APP" 2>&1 && echo "    verify: OK" || echo "    verify: WARN (adhoc)"
