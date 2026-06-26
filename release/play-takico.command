#!/bin/bash
# DI CUNG TAKICO — double-click to play (only file in macos folder)
set -uo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
DATA="$DIR/_takico"
export TAKICO_ROOT="$DATA"
export TAKICO_RUNTIME="$DIR"

xattr -cr "$DIR" 2>/dev/null || true

if [[ ! -x "$DATA/takico-start.sh" ]]; then
  osascript -e 'display alert "DI CUNG TAKICO" message "Missing _takico folder. Extract the full macos zip." as critical' 2>/dev/null || true
  exit 1
fi

exec bash "$DATA/takico-start.sh"
