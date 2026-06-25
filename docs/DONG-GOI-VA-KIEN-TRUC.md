# ĐI CÙNG TAKICO — Kiến trúc dự án & hướng đóng gói Application

Tài liệu phân tích kiến trúc và hướng dẫn đóng gói bản **offline kiosk** cho **macOS** và **Windows**.  
Dự án **không** phải app native (Electron/Tauri) — mà là **game web tĩnh** + **server file nhỏ** + **trình duyệt chạy fullscreen.

---

## Mục lục

1. [Kiến trúc tổng thể](#1-kiến-trúc-tổng-thể)
2. [Cấu trúc source](#2-cấu-trúc-source)
3. [Luồng runtime](#3-luồng-runtime)
4. [Hai chế độ chạy: Dev vs Production](#4-hai-chế-độ-chạy-dev-vs-production)
5. [Những gì đã có sẵn](#5-những-gì-đã-có-sẵn-cho-đóng-gói)
6. [Hướng đóng gói đề xuất](#6-hướng-đóng-gói-đề-xuất)
7. [macOS — quy trình build](#7-macos--quy-trình-build)
8. [Windows — quy trình build](#8-windows--quy-trình-build)
9. [Checklist trước production](#9-checklist-trước-khi-đóng-gói-production)
10. [So sánh deliverable](#10-so-sánh-deliverable-cho-khách)
11. [Lộ trình thực tế](#11-lộ-trình-thực-tế)
12. [Tóm tắt](#12-tóm-tắt)

---

## 1. Kiến trúc tổng thể

Game gồm **4 lớp** xếp chồng:

```
┌─────────────────────────────────────────────────────────┐
│  Lớp 1 — Launcher OS                                    │
│  macOS: Chơi Takico.app (AppleScript)                   │
│  Windows: Chơi Takico.bat / shortcut                    │
└──────────────────────────┬──────────────────────────────┘
                           │ khởi động
┌──────────────────────────▼──────────────────────────────┐
│  Lớp 2 — Static Server                                  │
│  takico-server (Go) — http://127.0.0.1:8765             │
└──────────────────────────┬──────────────────────────────┘
                           │ phục vụ file
┌──────────────────────────▼──────────────────────────────┐
│  Lớp 3 — Browser Runtime                                │
│  Chrome / Edge (--app --start-fullscreen)               │
│  React 18 UMD · Babel in-browser · MediaPipe Pose       │
└──────────────────────────┬──────────────────────────────┘
                           │ render
┌──────────────────────────▼──────────────────────────────┐
│  Lớp 4 — Game Logic + Assets                            │
│  app.jsx · playing.jsx · micatcher-tracking.js          │
│  manifest.json · assets/                                │
└─────────────────────────────────────────────────────────┘
```

| Lớp | Vai trò | Công nghệ |
|-----|---------|-----------|
| **Launcher** | Double-click → khởi động server + mở trình duyệt fullscreen | `.app` (macOS), `.bat` (Windows) |
| **Server** | Phục vụ file tĩnh qua HTTP local (camera/MediaPipe **không** chạy với `file://`) | Go binary ~vài MB |
| **Browser** | Runtime UI, Babel compile JSX, WebGL (model-viewer), WebRTC camera | Chrome/Edge khuyến nghị |
| **Game** | State machine, gameplay, tracking, assets theo manifest | HTML + JSX + CSS thuần |

**Điểm quan trọng:** Game **không cần npm build** khi chạy. JSX biên dịch tại trình duyệt. Đóng gói = copy file + vendor hóa dependency CDN + build server binary.

---

## 2. Cấu trúc source

```
Takico/
├── index.html                    ← entry dev (CDN: React, Babel, fonts Google)
├── Đi Cùng Takico.html           ← entry dev cũ (tương tự)
│
├── takico/                       ← toàn bộ UI + logic
│   ├── app.jsx                   ← state machine (IDLE → TUTORIAL → PLAYING → WIN/LOSE)
│   ├── playing.jsx               ← gameplay + camera hook
│   ├── screens.jsx               ← màn Chờ + Hướng dẫn
│   ├── results.jsx               ← popup Thắng / Thua
│   ├── assets.jsx                ← load manifest → window.TAK
│   ├── loadPack.js               ← chọn asset pack (honda-2026)
│   ├── world.jsx                 ← Mascot3D (model-viewer)
│   ├── kiosk.css                 ← ẩn dev-nav cho production
│   ├── core.css / world.css / game.css
│   └── export.js                 ← xuất PNG từng màn (dev tool)
│
├── Game Play/
│   ├── micatcher-tracking.js     ← MediaPipe pose → press() / release()
│   ├── micatcher-engine.js       ← engine canvas (không dùng trong UI hiện tại)
│   └── micatcher-gameplay.html   ← demo engine
│
├── assets/
│   ├── packs/honda-2026/manifest.json   ← config game + đường dẫn asset
│   ├── backround/                ← nền đèn đỏ/xanh từng chặng (PNG gốc)
│   └── opt/                      ← ảnh WebP tối ưu (dùng cho bản offline)
│
├── server/
│   └── main.go                   ← takico-server (static file server)
│
├── release/                      ← script + launcher + binary sẵn
│   ├── bin/
│   │   ├── takico-server         ← macOS universal (arm64 + amd64)
│   │   └── takico-server.exe     ← Windows amd64
│   ├── index.offline.html        ← entry production (vendor local)
│   ├── takico-start.sh           ← khởi động server + browser (dùng trong .app)
│   ├── takico-serve.sh           ← launcher dev / .command
│   ├── stop-launcher.sh          ← dừng server
│   ├── launch.applescript        ← logic Chơi Takico.app
│   ├── Chơi Takico.bat           ← launcher Windows
│   ├── Chơi Takico.command       ← launcher macOS (Terminal)
│   ├── HUONG-DAN-SU-DUNG.md      ← hướng dẫn khách
│   └── applet.icns               ← icon Dock macOS
│
├── scripts/
│   ├── build-server.sh           ← build Go cho Mac + Win
│   ├── build-offline-package.sh  ← đóng gói macOS .app + zip
│   └── build-app-icon.sh         ← tạo icon từ logo
│
└── docs/
    └── DONG-GOI-VA-KIEN-TRUC.md  ← file này
```

### Bảng file quan trọng

| Cần lấy gì | File | Ghi chú |
|------------|------|---------|
| Khung app + state machine + input | `takico/app.jsx` | "Bộ não" điều phối 5 màn |
| Màn Chờ | `takico/screens.jsx` → `IdleScreen` | |
| Màn Hướng dẫn | `takico/screens.jsx` → `TutorialScreen` | |
| Màn Chơi | `takico/playing.jsx` → `PlayingScreen` | Nơi cắm engine / camera |
| Popup Thắng / Thua | `takico/results.jsx` | Overlay trên màn chơi |
| Asset + manifest | `takico/assets.jsx` + `assets/packs/*/manifest.json` | `window.TAK.GAME`, `window.TAK.A` |
| Tracking camera | `Game Play/micatcher-tracking.js` | MediaPipe Pose |
| Config game | `assets/packs/honda-2026/manifest.json` | stages, lives, timeLimit, assets |

---

## 3. Luồng runtime

### 3.1 Khởi động

1. Người dùng double-click launcher (`Chơi Takico.app` hoặc `Chơi Takico.bat`).
2. Launcher khởi động `takico-server` tại thư mục game (cwd = root static files).
3. Server lắng nghe `http://127.0.0.1:8765`.
4. Mở trình duyệt fullscreen (`--app=URL --start-fullscreen`).
5. Browser tải `index.html` → nạp script theo thứ tự.

### 3.2 Thứ tự nạp file (production)

```
index.offline.html
  → takico/loadPack.js
  → Game Play/micatcher-tracking.js
  → vendor/react.production.min.js
  → vendor/react-dom.production.min.js
  → vendor/babel.min.js
  → takico/assets.jsx      (Babel)
  → takico/world.jsx
  → takico/screens.jsx
  → takico/playing.jsx
  → takico/results.jsx
  → takico/app.jsx         → ReactDOM.render(<App />)
```

### 3.3 Máy trạng thái game

```
IDLE ──(chạm/Space)──▶ TUTORIAL ──(chạm/Space)──▶ PLAYING
                                                     │
                          ┌──────────────────────────┼───────────────┐
                       onWin                       onLose          (hết giờ)
                          ▼                            ▼               ▼
                    overlay WIN                  overlay LOSE
                          │                            │
                    (Về màn chính)               (Chơi lại / Về màn chính)
                          ▼                            ▼
                         IDLE  ◀───────────────────── IDLE
```

- Config từ `manifest.json`: `totalStages`, `totalLives`, `timeLimitSec`.
- Mỗi lượt có N mạng; sai vạch trừ 1 mạng, thử lại cùng chặng; hết mạng mới thua.
- Win/Lose hiển thị **overlay trên màn chơi** (game blur phía sau), không chuyển trang.

### 3.4 Điểm cắm engine / camera

Engine nhận diện động tác chỉ cần phát ra **2 sự kiện**:

| Động tác | Hàm | Ý nghĩa |
|----------|-----|---------|
| Bắt đầu nhún xuống | `press()` | Bắt đầu nạp lực |
| Đứng bật lên | `release()` | Chốt lực → Takico phóng xe |

`micatcher-tracking.js` đã tích hợp MediaPipe Pose và gọi `press()` / `release()` qua `PlayingScreen` (ref từ `app.jsx`).

Callback kết quả:

| Callback | Khi nào |
|----------|---------|
| `onWin(totalStages)` | Về đích chặng cuối |
| `onGameOver(reason, cleared)` | Hết mạng — `reason`: `redlight` \| `short` \| `timeout` |

### 3.5 Scaling kiosk

UI thiết kế cố định **1920×1080**. `app.jsx` tự `transform: scale()` khung `#kiosk` cho vừa mọi màn hình, căn giữa, viền đen letterbox.

> Cần tab/cửa sổ **đang hiển thị & focus**. Trình duyệt bóp tốc độ timer khi tab chạy nền.

---

## 4. Hai chế độ chạy: Dev vs Production

| | **Dev** (`index.html`) | **Production** (`release/index.offline.html`) |
|--|------------------------|-----------------------------------------------|
| React / Babel | CDN unpkg | `vendor/` local |
| MediaPipe | CDN jsdelivr | `vendor/mediapipe/` local |
| model-viewer | CDN | `vendor/model-viewer.min.js` |
| Font | Google Fonts (CDN) | **Chưa bundle** → fallback `system-ui` |
| Dev nav | Hiện (`.dev-nav`) | Ẩn qua `takico/kiosk.css` |
| Server | Python `http.server` hoặc `takico-server` | Chỉ `takico-server` |
| Cache bust | `?v=devN` trên script | Không cần |

**Chạy dev:**

```bash
cd Takico
python3 -m http.server 8765
# hoặc
./release/bin/takico-server
```

Mở: http://localhost:8765/

---

## 5. Những gì đã có sẵn cho đóng gói

Repo **đã thiết kế đúng hướng** "offline kiosk, không cần Python trên máy khách":

| Thành phần | Trạng thái | File / script |
|------------|------------|---------------|
| Go static server (Mac + Win) | Có | `scripts/build-server.sh` |
| macOS `.app` + zip | Có | `scripts/build-offline-package.sh` |
| Windows `.bat` launcher | Có | `release/Chơi Takico.bat` |
| Windows zip build script | **Chưa có** | Cần bổ sung mirror macOS |
| Hướng dẫn khách | Có | `release/HUONG-DAN-SU-DUNG.md` |
| Icon app macOS | Có | `scripts/build-app-icon.sh` |

### Cấu trúc gói macOS (đã implement)

```
Di-Cung-Takico-Offline/
├── Chơi Takico.app              ← khách chỉ thấy cái này
│   └── Contents/
│       ├── MacOS/               ← AppleScript launcher
│       └── Resources/
│           ├── applet.icns
│           └── game/            ← toàn bộ game ẩn bên trong
│               ├── index.html
│               ├── takico/, assets/, Game Play/
│               ├── vendor/, bin/takico-server
│               └── takico-start.sh, stop-launcher.sh
└── HUONG-DAN-SU-DUNG.md
```

`.app` là AppleScript "stay-open":
- **Cmd+Q** hoặc menu Thoát → dừng server.
- Double-click lại khi đang chạy → mở lại trình duyệt.

---

## 6. Hướng đóng gói đề xuất

### Nguyên tắc: Giữ mô hình hiện tại — không cần Electron

| Phương án | Ưu điểm | Nhược điểm | Khuyến nghị |
|-----------|---------|------------|-------------|
| **A. Browser kiosk + Go server** (hiện tại) | Nhẹ, build nhanh, camera ổn trên Chrome | Phụ thuộc Chrome/Edge đã cài | **Dùng cho sự kiện / booth** |
| B. Electron / Tauri | Một file .exe/.app, không cần browser riêng | Nặng (100MB+), build phức tạp | Chỉ khi bắt buộc "1 file duy nhất" |
| C. PWA / installable web | Không cần server | Camera + MediaPipe hạn chế | Không phù hợp kiosk |

**Kết luận:** Với kiosk Honda HEAD, **phương án A** là đúng. Máy booth thường đã có Chrome; chỉ cần zip gọn + shortcut rõ ràng.

### Tại sao cần HTTP server?

- `getUserMedia` (webcam) và MediaPipe **không hoạt động** khi mở file trực tiếp (`file://`).
- `takico-server` (Go) nhẹ, không cần cài Python/Node trên máy khách.
- Bind `127.0.0.1` — chỉ local, an toàn cho kiosk.

---

## 7. macOS — quy trình build

### Yêu cầu máy build

- macOS
- Go (`brew install go`)
- Python 3 (patch script + icon)
- curl, npm (tải vendor + MediaPipe tạm)
- `iconutil`, `sips` (có sẵn trên macOS)

### Lệnh build

```bash
./scripts/build-offline-package.sh
```

Script tự động:
1. Build `takico-server` (universal binary).
2. Tạo icon `applet.icns` từ logo.
3. Compile `Chơi Takico.app` từ AppleScript.
4. Copy game files (rsync, exclude file thừa).
5. Tải React, Babel, model-viewer, MediaPipe vào `vendor/`.
6. Patch đường dẫn CDN → local trong `micatcher-tracking.js` và `world.jsx`.
7. Zip → `Di-Cung-Takico-Offline.zip`.

### Output

| File | Mô tả |
|------|-------|
| `Di-Cung-Takico-Offline/` | Thư mục gói |
| `Di-Cung-Takico-Offline.zip` | File giao khách |

### Phân phối macOS

| Mức độ | Việc cần làm |
|--------|--------------|
| Nội bộ / sự kiện | Zip + hướng dẫn "chuột phải → Mở"; `xattr -cr` nếu Gatekeeper chặn |
| Khách doanh nghiệp | Apple Developer → codesign binary + .app → notarize → staple |
| Mac App Store | Không khuyến nghị cho use case kiosk + camera |

### Khách sử dụng

1. Giải nén zip.
2. Double-click `Chơi Takico.app`.
3. Lần đầu: chuột phải → **Mở** → **Mở**.
4. Cho phép **Camera** khi trình duyệt hỏi.
5. Tắt: **Cmd+Q**.

---

## 8. Windows — quy trình build

### Hiện trạng

- `release/bin/takico-server.exe` — đã build sẵn.
- `release/Chơi Takico.bat` — launcher thủ công.
- **Chưa có** `build-windows-package.sh` tương đương macOS.

### Cấu trúc zip đề xuất

```
Di-Cung-Takico-Windows/
├── Chơi Takico.bat              ← hoặc shortcut .lnk
├── HUONG-DAN-SU-DUNG.md
└── game/
    ├── index.html               ← từ release/index.offline.html
    ├── takico/, assets/, Game Play/, vendor/
    ├── bin/takico-server.exe
    └── (tùy chọn) stop.bat
```

### Quy trình build (cần tạo script)

1. `./scripts/build-server.sh` — đảm bảo `takico-server.exe` mới nhất.
2. Tạo `scripts/build-windows-package.sh` (mirror `build-offline-package.sh`):
   - rsync game files + patch MediaPipe / model-viewer paths
   - curl vendor (React, Babel, model-viewer)
   - npm install MediaPipe → copy vào `vendor/mediapipe/`
   - copy `Chơi Takico.bat`, chỉnh `cd` trỏ đúng thư mục `game/`
3. Zip → `Di-Cung-Takico-Windows.zip`.

Có thể chạy bước 2–3 trên **macOS** (cross-build Go đã hỗ trợ Windows).

### Phân phối Windows

| Mức độ | Việc cần làm |
|--------|--------------|
| Booth / nội bộ | Zip + hướng dẫn; SmartScreen: "More info → Run anyway" |
| Doanh nghiệp | Code signing (Authenticode) cho `.exe` |
| Microsoft Store | Không cần cho use case này |

### Khách sử dụng

1. Giải nén zip.
2. Double-click `Chơi Takico.bat`.
3. Cho phép Camera trên Chrome/Edge.
4. Tắt: đóng cửa sổ "Takico Server" hoặc script stop.

### Cải tiến launcher Windows (tùy chọn)

- Icon `.ico` cho shortcut.
- Wrapper `.vbs` để ẩn cửa sổ console khi chạy `.bat`.
- Script `stop.bat` kill process trên port 8765.

---

## 9. Checklist trước khi đóng gói production

### Asset & nội dung

- [ ] `assets/packs/honda-2026/manifest.json` — `totalStages`, `totalLives`, `timeLimitSec` đúng
- [ ] Đường dẫn nền trong manifest khớp file thực tế (`assets/opt/*.webp` cho zip nhẹ)
- [ ] `takico/kiosk.css` được nạp trong `index.offline.html` (ẩn dev-nav)
- [ ] Loại `uploads/`, `raw/` thừa khỏi gói (script offline đã exclude một phần)

### Offline thật sự

- [ ] **Bundle font** Baloo 2 + Be Vietnam Pro vào `vendor/fonts/` + `@font-face` trong `core.css`  
      *(hiện bản offline chưa có font — sẽ lệch typography nếu không có mạng)*
- [ ] Không còn URL CDN trong file đã patch
- [ ] Test trên máy **không có Internet**

### Runtime kiosk

- [ ] Chrome/Edge: `--app=URL --start-fullscreen --autoplay-policy=no-user-gesture-required`
- [ ] Camera permission documented trong `HUONG-DAN-SU-DUNG.md`
- [ ] Tắt sleep màn hình trên máy booth
- [ ] Port `8765` — launcher kill process cũ nếu bị chiếm

### QA trước giao khách

- [ ] Máy sạch: không Python, không Node — chỉ giải nén + double-click
- [ ] Camera hoạt động, tracking nhún → thanh lực
- [ ] 5 chặng + 3 mạng + popup win/lose
- [ ] Chuyển nền đèn đỏ/xanh + fade đen khi dừng đúng vạch
- [ ] Thoát game → port giải phóng, mở lại được

---

## 10. So sánh deliverable cho khách

| | macOS | Windows |
|--|-------|---------|
| **File giao** | `Di-Cung-Takico-Offline.zip` | `Di-Cung-Takico-Windows.zip` *(cần tạo)* |
| **Cách chạy** | Double-click `Chơi Takico.app` | Double-click `Chơi Takico.bat` |
| **Phụ thuộc** | Chrome / Edge / Safari + webcam | Chrome / Edge + webcam |
| **Không cần** | Python, Node, Internet *(sau build)* | Tương tự |
| **Tắt game** | Cmd+Q | Đóng server / stop script |
| **Hướng dẫn** | `HUONG-DAN-SU-DUNG.md` | Cùng file, bổ sung mục Windows |

---

## 11. Lộ trình thực tế

### Giai đoạn 1 — Hoàn thiện build (1–2 ngày)

1. Chạy `build-offline-package.sh`, test zip trên Mac sạch.
2. Viết `build-windows-package.sh` mirror logic macOS.
3. Bundle font local cho bản offline.

### Giai đoạn 2 — Polish launcher (0.5–1 ngày)

4. Icon `.ico` cho Windows shortcut.
5. Script stop Windows + ẩn console khi chạy `.bat`.
6. Cập nhật `HUONG-DAN-SU-DUNG.md` cho cả hai OS.

### Giai đoạn 3 — Phân phối (tùy khách)

7. macOS: notarize nếu khách sợ Gatekeeper.
8. Windows: sign `.exe` nếu triển khai nhiều máy doanh nghiệp.
9. Shortcut / QR trên màn booth.

### Không nên làm ngay

- Chuyển sang Electron / Tauri
- Thêm npm build pipeline (Vite, webpack)
- Refactor sang Next.js / framework SPA

Không cần cho kiosk offline hiện tại.

---

## 12. Tóm tắt

| Khía cạnh | Kết luận |
|-----------|----------|
| **Kiến trúc** | Web tĩnh + manifest asset + Go server + browser fullscreen |
| **macOS** | Gần xong — `scripts/build-offline-package.sh` |
| **Windows** | Thiếu script zip — binary + `.bat` đã sẵn |
| **Hướng đi** | Hoàn thiện pipeline mirror Mac → Win, bundle font, QA máy sạch |
| **Không cần** | App native mới (Electron) |

---

**Howls Studio** — tài liệu nội bộ, cập nhật theo repo `Takico`.
