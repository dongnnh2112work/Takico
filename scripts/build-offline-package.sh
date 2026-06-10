#!/bin/bash
# Đóng gói bản offline — khách chỉ thấy: Chơi Takico.app + HUONG-DAN-SU-DUNG.md
#   ./scripts/build-offline-package.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/Di-Cung-Takico-Offline"
RELEASE="$ROOT/release"
APP="$OUT/Chơi Takico.app"
GAME="$APP/Contents/Resources/game"

echo "==> Đóng gói ĐI CÙNG TAKICO (offline)"
echo "    Khách giải nén chỉ thấy: Chơi Takico.app + HUONG-DAN-SU-DUNG.md"
echo ""

"$ROOT/scripts/build-server.sh"
LOGO="$ROOT/assets/logo-takico.png" "$ROOT/scripts/build-app-icon.sh"

rm -rf "$OUT"
mkdir -p "$OUT"

# ── App + icon (tạo .app trước, rồi mới thêm game vào Resources/) ───────────
osacompile -o "$APP" "$RELEASE/launch.applescript"
mkdir -p "$GAME/vendor/mediapipe" "$GAME/bin"
cp "$RELEASE/applet.icns" "$APP/Contents/Resources/applet.icns"
cp "$RELEASE/HUONG-DAN-SU-DUNG.md" "$OUT/"
cp "$RELEASE/applet.icns" "$OUT/.VolumeIcon.icns"
if command -v SetFile >/dev/null 2>&1; then
  SetFile -a C "$OUT" 2>/dev/null || true
fi

# ── Game data (ẩn trong .app/Contents/Resources/game/) ───────────────────────
rsync -a \
  --exclude '.git' --exclude '.DS_Store' \
  --exclude 'uploads' \
  --exclude 'raw/Character.glb' --exclude 'raw/KEY VISUAL 26.png' \
  --exclude 'raw/ChatGPT*' --exclude 'raw/Micatcher*' --exclude 'raw/LOGO*' \
  --exclude 'assets/backround' --exclude 'assets/Background V2' \
  --exclude 'assets/mascot-ride.png' --exclude 'assets/mascot-ride-side.png' \
  --exclude 'assets/scene-bg*.png' --exclude 'assets/ref-keyart.png' \
  --exclude 'assets/idle-screen.jpg' --exclude 'assets/keyvisual-26.png' \
  "$ROOT/takico" "$ROOT/assets" "$ROOT/raw" \
  "$GAME/"

mkdir -p "$GAME/Game Play"
cp "$ROOT/Game Play/micatcher-tracking.js" "$GAME/Game Play/"
cp "$RELEASE/index.offline.html" "$GAME/index.html"
cp "$RELEASE/takico-start.sh" "$RELEASE/stop-launcher.sh" "$GAME/"
chmod +x "$GAME/takico-start.sh" "$GAME/stop-launcher.sh"

cp "$RELEASE/bin/takico-server" "$GAME/bin/"
chmod +x "$GAME/bin/takico-server"
if command -v codesign >/dev/null 2>&1; then
  codesign -s - --force "$GAME/bin/takico-server" 2>/dev/null || true
fi

echo "==> Tải React / Babel..."
curl -fsSL -o "$GAME/vendor/react.production.min.js" \
  "https://unpkg.com/react@18.3.1/umd/react.production.min.js"
curl -fsSL -o "$GAME/vendor/react-dom.production.min.js" \
  "https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js"
curl -fsSL -o "$GAME/vendor/babel.min.js" \
  "https://unpkg.com/@babel/standalone@7.29.0/babel.min.js"

echo "==> Tải model-viewer..."
curl -fsSL -o "$GAME/vendor/model-viewer.min.js" \
  "https://unpkg.com/@google/model-viewer@3.5.0/dist/model-viewer.min.js"

echo "==> Tải MediaPipe Pose..."
POSE_VER="0.5.1675469404"
CAM_VER="0.3.1675466862"
TMP_NPM="$(mktemp -d)"
(
  cd "$TMP_NPM"
  npm init -y >/dev/null 2>&1
  npm install "@mediapipe/pose@${POSE_VER}" "@mediapipe/camera_utils@${CAM_VER}" --silent
  cp -R "node_modules/@mediapipe/pose/." "$GAME/vendor/mediapipe/pose/"
  cp -R "node_modules/@mediapipe/camera_utils/." "$GAME/vendor/mediapipe/camera_utils/"
)
rm -rf "$TMP_NPM"

GAME="$GAME" python3 <<'PY'
import os, pathlib
root = pathlib.Path(os.environ["GAME"])
tracking = root / "Game Play" / "micatcher-tracking.js"
world = root / "takico" / "world.jsx"
t = tracking.read_text(encoding="utf-8")
t = t.replace("https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js", "vendor/mediapipe/pose/pose.js")
t = t.replace("https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js", "vendor/mediapipe/camera_utils/camera_utils.js")
t = t.replace("https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}", "vendor/mediapipe/pose/${file}")
tracking.write_text(t, encoding="utf-8")
w = world.read_text(encoding="utf-8")
w = w.replace("https://unpkg.com/@google/model-viewer@3.5.0/dist/model-viewer.min.js", "vendor/model-viewer.min.js")
world.write_text(w, encoding="utf-8")
print("    Patched MediaPipe + model-viewer → vendor/")
PY

xattr -cr "$OUT" 2>/dev/null || true

ZIP="$ROOT/Di-Cung-Takico-Offline.zip"
rm -f "$ZIP"
( cd "$ROOT" && zip -rq "$ZIP" "Di-Cung-Takico-Offline" -x "*.DS_Store" )

echo ""
echo "✓ Hoàn tất!"
echo "  Thư mục: $OUT  ($(du -sh "$OUT" | cut -f1))"
echo "  Zip:     $ZIP  ($(du -sh "$ZIP" | cut -f1))"
echo ""
echo "  Khách giải nén thấy:"
ls -1 "$OUT" | sed 's/^/    /'
