#!/bin/bash
# First launch helper — strips quarantine then opens the app (double-click this if Gatekeeper blocks)
DIR="$(cd "$(dirname "$0")" && pwd)"
APP="$DIR/Play Takico.app"

if [[ ! -d "$APP" ]]; then
  osascript -e 'display alert "DI CUNG TAKICO" message "Play Takico.app not found in this folder." as critical' 2>/dev/null || true
  exit 1
fi

xattr -cr "$DIR" 2>/dev/null || true
open "$APP"
