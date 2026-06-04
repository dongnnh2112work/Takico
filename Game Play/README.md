# Gameplay export — gắn UI mới

Repo có **hai** engine gameplay. Chọn đúng bộ file theo giao diện bạn đang làm.

## 1. MiCatcher (side-view, mic mascot) — khuyên dùng nếu adapt từ `UI/Jump Jump Micatcher.html`

| File | Vai trò |
|------|---------|
| `micatcher-engine.js` | Canvas, physics, platforms, themes, vẽ scene |
| `micatcher-tracking.js` | MediaPipe pose + keyboard fallback |
| `micatcher-gameplay.html` | Demo tối thiểu + tài liệu API trong trang |

**Nguồn gốc:** copy từ `UI/game.js` và `UI/tracking.js` (giữ đồng bộ khi sửa engine).

### Chạy thử

```bash
cd "Game Play"
python3 -m http.server 3456
```

Mở: http://localhost:3456/micatcher-gameplay.html

Cần server local (camera / MediaPipe không chạy với `file://`).

### Gắn vào UI mới (HTML hoặc framework)

1. Một `<canvas id="gameCanvas">` full stage.
2. Load `micatcher-engine.js` (và `micatcher-tracking.js` nếu có camera).
3. Khởi tạo + game loop:

```javascript
await Game.init(canvas, {
  onStateChange(state) {
    // Cập nhật overlay: ATTRACT | TUTORIAL | PLAYING | OVER | WIN
  },
});
Game.setTheme("echoCave");      // echoCave | crystalArena | spotlightStage
Game.setFinalStyle("trophy");   // trophy | throne
Game.start();

function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  Game.update(dt);
  Game.render();
  requestAnimationFrame(tick);
}
```

**Input nhảy**

- Bàn phím / touch: `Game.chargeStart()` → `Game.chargeRelease()` (tự tính power).
- Hoặc gọi trực tiếp: `Game.launchWithPower(0–100)`.
- Camera: `MicatcherTracking.create({ videoEl, overlayEl, onJumpPower, onPowerPreview, canJump, ... })`.

**HUD / kiosk** không nằm trong engine — xem `UI/app.js` hoặc `web/src/components/micatcher/MicatcherGame.tsx` làm mẫu shell.

**Assets:** engine tham chiếu `assets/*.png` (mascot, nền). Khi embed, đặt thư mục `assets/` cùng cấp với HTML hoặc sửa `ASSET_LIST` trong `micatcher-engine.js`. Thiếu ảnh vẫn chạy (fallback vẽ vector).

---

## 2. Howl Jump (isometric voxel) — bundle một file

| File | Vai trò |
|------|---------|
| `jump-jump-gameplay.html` | Toàn bộ logic trong một HTML (~2500 dòng script), global `HowlJumpGameplay` |

### API

```javascript
const game = HowlJumpGameplay.create(canvas, {
  onScoreChange(score, best, jumpCount) {},
  onGameOver({ score, best }) {},
  onJump() {},
  onLand() {},
  onFail() {},
  onPlayerAnchor(x, y) {},
  options: {
    characterId: "boy",
    theme: "cloudGarden",
    persistBest: true,
    showBuiltInHud: false,
  },
});
game.resize(width, height);
game.update(dt);
game.render();
game.jumpWithPower(power);
game.setCrouch(true);
game.resetWorld();
```

Phần cuối file (`demoBootstrap`) là HUD demo — có thể xóa khi adapt.

---

## Không dùng cho export UI mới

- `game.js` + `main.js` trong `Game Play/` (ES modules) — **thiếu** `character.js`, `platforms.js`, `ui.js`, …; dùng `jump-jump-gameplay.html` thay thế.
- `UI/Jump Jump Micatcher.html` — full kiosk (CSS + overlay + tweaks), không phải gameplay thuần.

## Next.js

Engine MiCatcher đã có bản TypeScript: `web/src/lib/game/engine.js` + `pose.js` — cùng logic với `micatcher-engine.js`.
