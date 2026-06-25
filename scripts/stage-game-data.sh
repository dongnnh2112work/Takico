#!/bin/bash
# Copy + vendor hóa dữ liệu game vào thư mục đích (dùng chung macOS / Windows)
#   ./scripts/stage-game-data.sh /path/to/game
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <GAME_DIR>"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GAME="$(cd "$1" && pwd)"
RELEASE="$ROOT/release"

echo "==> Stage game data → $GAME"

rm -rf "$GAME"
mkdir -p "$GAME/vendor/mediapipe" "$GAME/bin" "$GAME/Game Play"

rsync -a \
  --exclude '.git' --exclude '.DS_Store' \
  --exclude 'uploads' \
  --exclude 'raw/Character.glb' --exclude 'raw/KEY VISUAL 26.png' \
  --exclude 'raw/ChatGPT*' --exclude 'raw/Micatcher*' --exclude 'raw/LOGO*' \
  --exclude 'assets/backround' --exclude 'assets/Background V2' \
  --exclude 'assets/mascot-ride.png' --exclude 'assets/mascot-ride-side.png' \
  --exclude 'assets/scene-bg*.png' --exclude 'assets/ref-keyart.png' \
  --exclude 'assets/idle-screen.jpg' --exclude 'assets/keyvisual-26.png' \
  --exclude 'assets/opt/round2_*' --exclude 'assets/opt/round3_*' \
  "$ROOT/takico" "$ROOT/assets" "$ROOT/raw" \
  "$GAME/"

cp "$ROOT/Game Play/micatcher-tracking.js" "$GAME/Game Play/"
cp "$RELEASE/index.offline.html" "$GAME/index.html"
cp "$RELEASE/takico-start.sh" "$RELEASE/stop-launcher.sh" "$GAME/"
chmod +x "$GAME/takico-start.sh" "$GAME/stop-launcher.sh"

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

echo "✓ Game data staged"
