# ĐI CÙNG TAKICO — Hướng dẫn UI & tích hợp Engine

Giao diện game kiosk điều khiển bằng **động tác cơ thể** (nhún người lấy đà → đứng lên thả lực) cho Honda HEAD Tân Kiều. Bản này là **lớp UI/giao diện** đã hoàn chỉnh, chạy thuần trình duyệt. Tài liệu này chỉ cho bạn **lấy đúng phần UI nào, ở đâu** và **cắm engine (nhận diện động tác / game runtime) vào chỗ nào**.

> TL;DR — Engine của bạn chỉ cần gọi đúng **2 hàm**: `press()` (bắt đầu nhún) và `release()` (đứng lên thả). Mọi thứ còn lại UI tự lo. Xem mục [3. Điểm cắm engine](#3-điểm-cắm-engine-quan-trọng-nhất).

---

## 1. Khởi động & thứ tự nạp file

Mở file gốc: **`Đi Cùng Takico.html`**. Đây là điểm vào duy nhất. Nó nạp theo thứ tự:

```
Fonts (Google: Baloo 2 + Be Vietnam Pro)
CSS:   takico/core.css → takico/world.css → takico/game.css
Libs:  model-viewer 3.5 (3D GLB) · React 18.3.1 · ReactDOM · Babel standalone
UI:    takico/assets.jsx → world.jsx → screens.jsx → playing.jsx → results.jsx → app.jsx
```

- Toàn bộ JSX biên dịch tại trình duyệt qua Babel (`type="text/babel"`). Không cần build.
- App mount vào `<div id="root">` ở cuối `app.jsx`: `ReactDOM.createRoot(...).render(<App />)`.
- Các component chia sẻ qua `window` (vd `window.PlayingScreen`, `window.TAK`...), **không** dùng ES module — nên giữ nguyên thứ tự `<script>`.

---

## 2. Bản đồ file — lấy UI ở đâu

| Cần lấy gì | File | Ghi chú |
|---|---|---|
| **Khung app + máy trạng thái + input + scaling kiosk** | `takico/app.jsx` | "Bộ não" điều phối 5 màn |
| **Màn 01 Chờ** (attract screen) | `takico/screens.jsx` → `IdleScreen` | Ảnh nền `idle-screen.jpg` |
| **Màn 02 Hướng dẫn** | `takico/screens.jsx` → `TutorialScreen` | 3 thẻ động tác |
| **Màn 03 Chơi** (cơ chế game) | `takico/playing.jsx` → `PlayingScreen` | ⭐ Nơi cắm engine |
| **Màn 04 Thua / 05 Thắng + pháo giấy** | `takico/results.jsx` → `LoseScreen`, `WinScreen`, `Confetti` | |
| **Phông nền chung + nhân vật 3D** | `takico/world.jsx` → `World`, `Mascot3D` | `Mascot3D` bọc `<model-viewer>` |
| **Đường dẫn ảnh / 3D + xử lý nền trắng** | `takico/assets.jsx` → `window.TAK` | Bảng asset, hook `useKnockout` |
| **Tokens màu/typography, nút bấm, màn Chờ, Hướng dẫn** | `takico/core.css` | Biến `--red`, `--blue`, `.btn`... |
| **Phông nền đường phố** | `takico/world.css` | |
| **Style màn Chơi / Thua / Thắng + animation nhân vật chạy** | `takico/game.css` | `.mascot-rider`, speedlines, bóng đổ |
| **Xuất ảnh PNG từng màn** | `takico/export.js` | Gọi `window.exportScenes()` ở console |

Tất cả tài nguyên hình/3D nằm trong thư mục **`assets/`** (xem [mục 5](#5-bảng-tài-nguyên-assets)).

---

## 3. Điểm cắm engine (QUAN TRỌNG NHẤT)

### 3.1 Hai hàm input duy nhất

Engine nhận diện động tác chỉ cần phát ra **2 sự kiện**:

| Động tác người chơi | Hàm cần gọi | Ý nghĩa |
|---|---|---|
| Bắt đầu **nhún xuống** lấy đà | `press()` | Bắt đầu nạp lực (thanh lực dâng lên) |
| **Đứng bật lên** thả | `release()` | Chốt lực → Takico phóng xe |

Hiện UI đang mô phỏng input bằng **phím Space** và **chạm/giữ màn hình**. Chỗ định tuyến nằm ở `takico/app.jsx`:

```js
// app.jsx — useEffect "input routing"
function press()   { ... if (s === 'PLAYING') playRef.current.press(); }
function release() { if (...'PLAYING') playRef.current.release(); }
window.addEventListener('keydown', onKeyDown); // Space → press
window.addEventListener('keyup',   onKeyUp);   // Space → release
// + stageHold: onPointerDown/Up → press/release
```

**Cách cắm engine:** thay (hoặc bổ sung) cho keyboard/pointer — khi engine phát hiện người **bắt đầu nhún** thì gọi `press()`, khi **đứng lên** thì gọi `release()`. Hai cách đơn giản:

- **Cách A (nhanh):** giả lập phím — engine bắn sự kiện `keydown`/`keyup` mã `Space`.
- **Cách B (sạch):** expose hàm ra ngoài để engine gọi trực tiếp. Thêm 1 dòng trong `press()`/`release()` của app, ví dụ `window.TAKICO_INPUT = { press, release }`, rồi engine gọi `window.TAKICO_INPUT.press()`.

`PlayingScreen` công bố `press`/`release` qua `useImperativeHandle` (cuối `playing.jsx`), `app.jsx` giữ tham chiếu bằng `playRef`.

### 3.2 Nếu engine đo được **độ sâu nhún** liên tục (nâng cao)

Hiện thanh lực **tự dao động lên–xuống** để người chơi canh nhịp. Logic ở `takico/playing.jsx`:

```js
const LINE_X = 60;          // vị trí vạch dừng (% chiều ngang)
const START_X = 15;         // vị trí xuất phát
function tick() {           // chạy mỗi 24ms khi đang charging
  let p = powerRef.current + dir.current * 2.6;   // dao động 0..100
  ...
}
const band = { lo: 60 - (stage-1)*1.5, hi: lo + 16 };  // vùng "xanh" thắng
```

Nếu engine cấp **giá trị lực/độ sâu nhún thật** (0–100), bạn thay vòng `tick()` dao động bằng việc set thẳng `powerRef.current = <giá trị từ engine>` và `setPower(...)`. Khi đó "lực" = độ nhún thật, không còn phải canh nhịp.

### 3.3 Khung camera (placeholder)

Ô camera góc dưới-trái màn Chơi là **giả lập** (`.cam-hud` trong `playing.jsx` + `game.css`): bóng người silhouette + nhãn `ĐỨNG SẴN / ĐANG LẤY ĐÀ / PHÓNG ĐI`. Nếu muốn hiện **feed camera thật**, thay phần `.cam-view` bằng `<video>`/`<canvas>` của engine. Nhãn trạng thái lấy từ biến `camPose` (`ready | charging | go`).

### 3.4 Kết quả ra ngoài — callback

`PlayingScreen` báo kết quả qua props (app.jsx truyền vào):

| Callback | Khi nào | Tham số |
|---|---|---|
| `onWin(totalStages)` | Về đích chặng cuối | tổng số chặng |
| `onLose(reason, cleared)` | Thua | `reason`, số chặng đã qua |

`reason` có 3 giá trị, ảnh hưởng nội dung màn Thua (`results.jsx → LoseScreen.copy`):

| reason | Tình huống | Tiêu đề màn Thua |
|---|---|---|
| `redlight` | Lực quá mạnh → **vượt qua vạch khi đèn đỏ** (xe phóng thẳng ra khỏi mép phải) | VƯỢT ĐÈN ĐỎ! |
| `short` | Lực quá nhẹ → dừng trước vạch | CHƯA TỚI VẠCH |
| `timeout` | Hết 60s | HẾT GIỜ |

Muốn ghi điểm/đẩy về server, móc thêm vào `onWin`/`onLose` trong `app.jsx`.

---

## 4. Máy trạng thái (5 màn)

`takico/app.jsx` quản lý `state ∈ { IDLE, TUTORIAL, PLAYING, LOSE, WIN }`. Mỗi state render 1 màn; chuyển màn bằng `setState`.

```
IDLE ──(chạm/Space)──▶ TUTORIAL ──(chạm/Space)──▶ PLAYING
                                                     │
                          ┌──────────────────────────┼───────────────┐
                       onWin                       onLose          (hết giờ)
                          ▼                            ▼               ▼
                         WIN                         LOSE ──(Chơi lại)─▶ PLAYING
                          │                            │
                    (Về màn chính)               (Về màn chính)
                          ▼                            ▼
                         IDLE  ◀───────────────────── IDLE
```

- `TOTAL_STAGES = 5` (đầu `app.jsx`) — đổi số chặng tại đây.
- **Thanh DEV NAV** dưới đáy (`.dev-nav`) để nhảy nhanh giữa 5 màn khi review. **Khi lên kiosk thật, ẩn nó đi** (đặt `.dev-nav{display:none}` hoặc xoá block trong `app.jsx`).

---

## 5. Bảng tài nguyên (`assets/`)

Khai báo tại `takico/assets.jsx` → `window.TAK.A`. Muốn **thay nhân vật/ảnh**, chỉ cần thay file trong `assets/` (giữ nguyên tên) hoặc sửa đường dẫn ở đây.

| Khoá (`TAK.A.*`) | File | Dùng ở màn |
|---|---|---|
| `logo` | `assets/logo-takico.png` | Chờ |
| `mascot` | `assets/mascot-ride.png` | Hướng dẫn (3 thẻ động tác) |
| `mascotSide` | `assets/mascot-ride-side.png` | **Chơi** — nhân vật chạy xe (góc nghiêng) |
| `idleBg` | `assets/idle-screen.jpg` | Chờ (ảnh nền full) |
| `sceneBg`..`sceneBg6` | `assets/scene-bg*.png` | Chơi — phông từng chặng |
| `kv26` | `assets/keyvisual-26.png` | Key visual |
| `glb` | `assets/character.glb` | Nhân vật 3D (màn Thắng, Hướng dẫn) qua `Mascot3D` |
| `police` | `raw/Chú công an.png` | Màn Thua (redlight) |
| `light` | `raw/Đèn giao thông.png` | Đèn giao thông |
| `dealer` | `raw/Đại lí Takico.jpg` | Màn Thắng (nền mờ) |

**Lưu ý nền trắng:** ảnh chụp/PNG nền trắng được tách nền **tại runtime** bằng `TAK.useKnockout()` / `knockoutWhite()` (flood-fill từ mép). Ảnh đã trong suốt sẵn (như nhân vật chạy xe) thì không cần.

---

## 6. Design tokens & component dùng lại

Tokens ở `:root` trong `takico/core.css`:

- **Màu thương hiệu:** `--red:#E4002B` (Honda) · `--blue:#2A3990` (Takico) · trắng. Phụ: `--green` (đúng vạch), `--amber` (lấy đà), `--red-deep`.
- **Font:** `--f-display: 'Baloo 2'` (tiêu đề) · `--f-body: 'Be Vietnam Pro'` (chữ thường).
- **Bóng/đổ:** `--shadow-lg`, `--shadow-md`.
- **Nút:** `.btn` + `.btn-lg/.btn-md` + `.btn-primary/.btn-ghost/.btn-blue`.

---

## 7. Scaling kiosk (full màn hình)

UI thiết kế cố định **1920×1080**. `app.jsx` (useEffect "kiosk scaling") tự `transform: scale()` khung `#kiosk` cho vừa mọi màn hình, căn giữa, viền đen letterbox. Không cần chỉnh khi đổi độ phân giải kiosk — chỉ cần chạy full-screen.

> ⚠️ Khi nhúng vào engine/webview: đảm bảo tab/cửa sổ **đang hiển thị & focus**. Trình duyệt "bóp" tốc độ timer (`setInterval`) khi tab chạy nền, khiến thanh lực & đồng hồ chạy chậm bất thường.

---

## 8. Công cụ xuất ảnh (tuỳ chọn)

`takico/export.js` cung cấp `window.exportScenes()` — chụp lần lượt 5 màn (gộp cả 3D WebGL) thành **5 file PNG 1920×1080** tải về máy. Mở Console gõ `await exportScenes()`. Hữu ích để làm ảnh giới thiệu/in ấn, không liên quan runtime game.

---

## 9. Checklist khi đưa lên kiosk thật

- [ ] Cắm engine vào `press()` / `release()` ([3.1](#31-hai-hàm-input-duy-nhất)).
- [ ] (Tuỳ chọn) Cấp lực nhún thật → bỏ dao động `tick()` ([3.2](#32-nếu-engine-đo-được-độ-sâu-nhún-liên-tục-nâng-cao)).
- [ ] (Tuỳ chọn) Gắn feed camera thật vào `.cam-view` ([3.3](#33-khung-camera-placeholder)).
- [ ] Móc `onWin` / `onLose` để ghi điểm/đẩy server nếu cần ([3.4](#34-kết-quả-ra-ngoài--callback)).
- [ ] **Ẩn `.dev-nav`** ([mục 4](#4-máy-trạng-thái-5-màn)).
- [ ] Chạy full-screen, focus cửa sổ ([mục 7](#7-scaling-kiosk-full-màn-hình)).
- [ ] Thay tài nguyên trong `assets/` nếu đổi nhân vật/phông ([mục 5](#5-bảng-tài-nguyên-assets)).
