#!/bin/bash
# Create Play Takico.app (bash launcher)
#   ./scripts/make-macos-app.sh /path/to/Play\ Takico.app
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <path/to/Play Takico.app>"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"

rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

cp "$ROOT/release/app-Info.plist" "$APP/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleExecutable launcher" "$APP/Contents/Info.plist"

cp "$ROOT/release/MacOS-launcher.sh" "$APP/Contents/MacOS/launcher"
chmod +x "$APP/Contents/MacOS/launcher"

if [[ -f "$ROOT/release/applet.icns" ]]; then
  cp "$ROOT/release/applet.icns" "$APP/Contents/Resources/applet.icns"
fi

echo "✓ App shell: $APP"
