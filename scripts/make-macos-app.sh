#!/bin/bash
# Create Play Takico.app (native launcher + Resources/launch.sh)
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

cp "$ROOT/release/launch.sh" "$APP/Contents/Resources/launch.sh"
chmod +x "$APP/Contents/Resources/launch.sh"

LAUNCHER="$APP/Contents/MacOS/launcher"
if cc -O2 -Wall -Wextra -arch arm64 -arch x86_64 -o "$LAUNCHER" "$ROOT/release/launcher.c" 2>/dev/null; then
  echo "    Native launcher (Mach-O universal)"
elif cc -O2 -Wall -Wextra -o "$LAUNCHER" "$ROOT/release/launcher.c" 2>/dev/null; then
  echo "    Native launcher (Mach-O)"
else
  echo "WARN: cc failed — fallback bash launcher in MacOS/"
  cp "$ROOT/release/launch.sh" "$LAUNCHER"
fi
chmod +x "$LAUNCHER"

if [[ -f "$ROOT/release/applet.icns" ]]; then
  cp "$ROOT/release/applet.icns" "$APP/Contents/Resources/applet.icns"
fi

echo "✓ App shell: $APP"
