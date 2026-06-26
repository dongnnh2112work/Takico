#!/bin/bash
# Notarize macOS package (requires Apple Developer Program ~$99/year)
#
# Setup once:
#   1. Create "Developer ID Application" cert in Apple Developer account
#   2. xcode-select --install
#   3. Store notary credentials:
#      xcrun notarytool store-credentials takico-notary \
#        --apple-id "you@email.com" --team-id "TEAMID" \
#        --password "app-specific-password"
#
# Usage:
#   DEVELOPER_ID="Developer ID Application: Your Name (TEAMID)" \
#     ./scripts/notarize-macos-package.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MACOS="$ROOT/macos"
ZIP="$ROOT/macos.zip"
KEYCHAIN_PROFILE="${NOTARY_PROFILE:-takico-notary}"

if [[ -z "${DEVELOPER_ID:-}" ]]; then
  echo "ERROR: Set DEVELOPER_ID, e.g.:"
  echo '  export DEVELOPER_ID="Developer ID Application: Howls Studio (XXXXXXXXXX)"'
  exit 1
fi

if [[ ! -d "$MACOS" ]]; then
  echo "==> Build package first"
  "$ROOT/scripts/build-macos-package.sh"
fi

echo "==> Sign binaries"
SERVER="$MACOS/_takico/bin/takico-server"
CMD="$MACOS/Play Takico.command"

codesign -s "$DEVELOPER_ID" --force --timestamp --options runtime "$SERVER"
codesign -s "$DEVELOPER_ID" --force --timestamp "$CMD" 2>/dev/null || true

echo "==> Create zip"
rm -f "$ZIP"
ditto -c -k --sequesterRsrc --keepParent "$MACOS" "$ZIP"

echo "==> Submit to Apple notary (may take a few minutes)"
xcrun notarytool submit "$ZIP" --keychain-profile "$KEYCHAIN_PROFILE" --wait

echo "==> Staple ticket to zip"
xcrun stapler staple "$ZIP"

echo ""
echo "✓ Notarized: $ZIP"
echo "  Upload this zip to Drive — other Macs should open without 'damaged' errors."
echo "  First download may still need double-click Open once on very strict macOS versions."
