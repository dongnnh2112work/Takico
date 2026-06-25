# DI CUNG TAKICO — User Guide (macOS)

**Portable:** Copy the entire `macos` folder anywhere (USB, Desktop, another Mac).  
No repo, Python, Node, or Internet required.

After copying, you only need **3 items**:

| | |
|---|---|
| **Play Takico.app** | Double-click to play |
| **GUIDE.md** | This file |
| **VERSION.txt** | Build info |

All game data is **inside** `Play Takico.app` — do not open or edit files inside.

---

## Start

1. Double-click **`Play Takico.app`**
2. **First launch** (Gatekeeper): Right-click → **Open** → **Open**
3. Or Terminal: `xattr -cr /path/to/macos` then open the app again
4. Allow **Camera** when the browser asks
5. Tap the idle screen or press **SPACE** to start

## Quit / restart

| Action | How |
|--------|-----|
| **Quit** | **Cmd+Q** or menu **Play Takico → Quit** |
| **Reopen** | Double-click `Play Takico.app` again |

## Requirements

- macOS 11+
- Chrome / Edge / Safari (Chrome recommended)
- Webcam
- No Python, Node, or Internet required after install
- **3 stages** per run (see `VERSION.txt`)

## Kiosk / booth

- Camera **1.5–2.5 m** from player, avoid backlight
- One person in frame
- Disable screen sleep during the event

## Troubleshooting

| Issue | Fix |
|-------|-----|
| App won't open | Right-click → **Open**; or `xattr -cr` on the macos folder |
| "App is damaged" | Run `xattr -cr`; open via **Play Takico.app** only |
| Camera error | Chrome → lock icon → Camera → **Allow** |

---

**Howls Studio** — Honda HEAD Tan Kieu · DI CUNG TAKICO
