#!/bin/bash
# Build both packages: macos/ and windows/
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "============================================"
echo "  DI CUNG TAKICO — Build packages"
echo "============================================"
echo ""

"$ROOT/scripts/build-macos-package.sh"
echo ""
"$ROOT/scripts/build-windows-package.sh"

echo ""
"$ROOT/scripts/verify-standalone.sh"

echo ""
echo "============================================"
echo "  Done!"
echo "  macos/   → Play Takico.command + _takico/"
echo "  windows/ → Play Takico.bat + Stop Takico.bat + GUIDE.md + VERSION.txt"
echo "============================================"
