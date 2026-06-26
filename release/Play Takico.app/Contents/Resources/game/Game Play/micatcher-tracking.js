/* Micatcher — pose tracking (MediaPipe). Keyboard fallback handled by app.js */

const MicatcherTracking = (() => {
  const POWER = { MIN: 15, MAX: 100 };

  const LANDMARK_CONFIGS = {
    SHOULDER: { ids: [11, 12], minLandmarks: 13 },
    HEAD: { ids: [0], minLandmarks: 1 },
    HIP: { ids: [23, 24], minLandmarks: 25 },
  };

  const MIN_VISIBILITY = 0.5;
  const HISTORY_SIZE = 10;
  const SQUAT_WINDOW_MS = 900;
  const CROUCH_HOLD_FRAMES = 6;
  const DRAW_INTERVAL_MS = 33; // throttle vẽ skeleton overlay ~30fps (chỉ hình ảnh)

  // Bật readout debug bằng URL ?debug=1 (depth / headDrop / legSignal / power).
  const DEBUG = typeof location !== "undefined" && /[?&]debug=1/.test(location.search || "");

  // ── Foreground-subject gating (reject background crowd) ──────────────────
  // Normalized coords [0..1]. Player stands close + centered; background
  // people are smaller (far) and/or off-center.
  const MIN_SHOULDER_W = 0.13;   // min shoulder width — reject far/background people
  const CENTER_X_MIN = 0.18;     // torso center must be within central band
  const CENTER_X_MAX = 0.82;
  const MAX_CENTER_JUMP = 0.18;  // per-frame torso jump → likely a different person
  const LOST_GRACE_MS = 650;     // keep lock briefly when subject lost
  const MIN_FACE_VIS = 0.45;
  const LOCK_ACQUIRE_FRAMES = 18;
  const LOCK_FACE_MAX_DX = 0.2;  // max face X drift vs locked player
  const LOCK_FACE_MAX_DY = 0.22;
  const LOCK_SHOULDER_MIN_RATIO = 0.72; // reject much smaller person (background)

  // ── Calibration — chốt baseline "đứng thẳng" khi người ĐỨNG YÊN ──────────
  const CALIB_FRAMES = 50;       // cửa sổ mẫu (raised from 30) — calibrate kỹ hơn
  const CALIB_STILL_TOL = 0.012; // stddev shoulder-Y tối đa để coi là đứng yên

  // ── Squat metric — measured in SHOULDER-WIDTH units (distance-invariant) ──
  // Depth = how far shoulders dropped below baseline, divided by shoulder
  // width. This stays consistent whether the player is near or far.
  const SQUAT_TH = 0.32;         // biên độ nhún rõ ràng mới bắt đầu tích lực
  const MAX_DEPTH = 0.92;        // squat vừa → gần full power
  const JUMP_VEL_TH = 0.12;      // vận tốc đi lên DỨT KHOÁT mới kích hoạt nhảy
                                 // (nhổm nhẹ để chỉnh lực sẽ KHÔNG bật)
  const STAND_RECENTER = 0.07;   // baseline trôi theo khi đứng (hấp thụ đi/lùi)
  const POWER_RISE = 0.22;       // làm mượt khi lực TĂNG (0..1, nhỏ = mượt)
  const POWER_FALL = 0.18;       // làm mượt khi lực GIẢM (hết nhún → tụt về 0)
  const HELD_DECAY_MS = 250;     // giữ đỉnh lực ngắn: cú bật nhanh dùng đúng lực,
                                 // nhổm lên lâu hơn mới cho lực hạ để chỉnh

  // ── Cổng chống false-positive (ngả người / khom / góc camera thấp) ───────
  const HEAD_SHOULDER_SYNC_TOL = 0.16; // sai lệch cho phép giữa head-drop & shoulder-drop (sw-units)
  const DIP_VEL_TH = 0.02;       // vận tốc đi xuống tối thiểu để "khởi phát" nhún (dip động)
  const LEG_MIN_VIS = 0.5;       // visibility tối thiểu của hông/gối/cổ chân
  const KNEE_STAND_ANGLE = 165;  // góc gối khi đứng thẳng (độ)
  const KNEE_SQUAT_ANGLE = 110;  // góc gối khi nhún sâu → tín hiệu chân = 1
  const LEG_MIN_SIGNAL = 0.12;   // tín hiệu chân tối thiểu để công nhận đang nhún

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function median(values) {
    const s = [...values].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  function stddev(values) {
    const n = values.length;
    if (n < 2) return 0;
    const mean = values.reduce((s, v) => s + v, 0) / n;
    const varc = values.reduce((s, v) => s + (v - mean) * (v - mean), 0) / n;
    return Math.sqrt(varc);
  }

  function visLeg(lm) {
    return lm && (lm.visibility ?? 0) >= LEG_MIN_VIS;
  }

  /** Góc (độ) tại đỉnh b tạo bởi a-b-c. */
  function angleAt(b, a, c) {
    const v1x = a.x - b.x, v1y = a.y - b.y;
    const v2x = c.x - b.x, v2y = c.y - b.y;
    const m1 = Math.hypot(v1x, v1y), m2 = Math.hypot(v2x, v2y);
    if (m1 === 0 || m2 === 0) return null;
    let cos = (v1x * v2x + v1y * v2y) / (m1 * m2);
    cos = Math.max(-1, Math.min(1, cos));
    return (Math.acos(cos) * 180) / Math.PI;
  }

  /**
   * Tín hiệu nhún từ độ gập gối (hip-knee-ankle). 0..1, hoặc null nếu chân
   * không nhìn thấy rõ → khi đó fallback về baseline vai + cổng đầu/vai.
   */
  function legSquatSignal(landmarks) {
    const sides = [[23, 25, 27], [24, 26, 28]];
    const angles = [];
    for (const [h, k, a] of sides) {
      const hp = landmarks[h], kp = landmarks[k], ap = landmarks[a];
      if (!visLeg(hp) || !visLeg(kp) || !visLeg(ap)) continue;
      const ang = angleAt(kp, hp, ap);
      if (ang != null) angles.push(ang);
    }
    if (!angles.length) return null;
    const ang = angles.reduce((s, v) => s + v, 0) / angles.length;
    return clamp((KNEE_STAND_ANGLE - ang) / (KNEE_STAND_ANGLE - KNEE_SQUAT_ANGLE), 0, 1);
  }

  /** Preview power — ease mid-range để dễ vào vùng xanh hơn. */
  function calcPreviewPower(depthUnits) {
    if (depthUnits < SQUAT_TH) return 0;
    let norm = clamp((depthUnits - SQUAT_TH) / (MAX_DEPTH - SQUAT_TH), 0, 1);
    norm = Math.pow(norm, 0.82);
    return Math.round(norm * 100);
  }

  function loadScript(src, id) {
    return new Promise((resolve, reject) => {
      if (document.getElementById(id)) return resolve();
      const script = document.createElement("script");
      script.id = id;
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Script load failed: ${src}`));
      document.head.appendChild(script);
    });
  }

  async function loadMediaPipeScripts() {
    await loadScript("vendor/mediapipe/pose/pose.js", "mediapipe-pose");
    await loadScript("vendor/mediapipe/camera_utils/camera_utils.js", "mediapipe-camera-utils");
  }

  function create(hooks) {
    const {
      videoEl,
      overlayEl,
      onJumpPower,
      onPowerPreview,
      onPoseState,
      onCameraStatus,
      onTrackingMode,
      canJump = () => true,
    } = hooks;

    const state = {
      mode: "keyboard",
      landmarkMode: "SHOULDER",
      currentPower: 0,
      displayPower: 0,
      poseState: "IDLE",
      standingBaseY: null,
      standingHeadY: null,
      calibrated: false,
      calibSamples: [],
      crouchHoldFrames: 0,
      dipArmed: false,    // đã phát hiện cú đi xuống (dip) → cho phép tích lực
      squatPrimed: false, // đã vào CROUCHING hợp lệ → cho phép nhảy
      heldPower: 0,       // lực đang giữ (đỉnh ngắn) — dùng khi bật lên
      heldPowerAt: 0,     // mốc thời gian cập nhật đỉnh lực gần nhất
      cooldownUntil: 0,
      shoulderHistory: [],
      recentPeakY: 0,
      recentPeakAt: 0,
      lastCenterX: null,
      lastSubjectAt: 0,
      lockedPlayer: null, // { faceX, faceY, faceW, shoulderW, centerX }
      lockAcquire: 0,
      lastGoodSubject: null,
      displayTransform: null,
      smoothLandmarks: null,
      lastDrawAt: 0,
      debug: null,
      pose: null,
      poseCamera: null,
      tuning: {
        powerMult: 1.15,
        cooldownMs: 450,
      },
    };

    function setPoseState(next) {
      state.poseState = next;
      onPoseState?.(next);
    }

    function resetCalibrationState() {
      state.standingBaseY = null;
      state.standingHeadY = null;
      state.calibrated = false;
      state.calibSamples = [];
      state.crouchHoldFrames = 0;
      state.dipArmed = false;
      state.squatPrimed = false;
      state.heldPower = 0;
      state.heldPowerAt = 0;
      state.recentPeakY = 0;
      state.recentPeakAt = 0;
      state.shoulderHistory.length = 0;
      state.currentPower = 0;
      state.displayPower = 0;
      state.lastCenterX = null;
      state.lastSubjectAt = 0;
      state.lockedPlayer = null;
      state.lockAcquire = 0;
      state.lastGoodSubject = null;
      state.smoothLandmarks = null;
      state.debug = null;
    }

    /** Làm mượt landmark overlay (face/shoulder ít giật) — mutate tại chỗ,
        tránh cấp phát mảng/đối tượng mới mỗi frame. */
    function smoothLandmarkFrame(landmarks) {
      const alpha = 0.38;
      const buf = state.smoothLandmarks;
      if (!buf || buf.length !== landmarks.length) {
        state.smoothLandmarks = landmarks.map((p) => ({ x: p.x, y: p.y, visibility: p.visibility }));
        return state.smoothLandmarks;
      }
      for (let i = 0; i < landmarks.length; i++) {
        const p = landmarks[i];
        const o = buf[i];
        o.x = o.x * (1 - alpha) + p.x * alpha;
        o.y = o.y * (1 - alpha) + p.y * alpha;
        o.visibility = p.visibility;
      }
      return buf;
    }

    /** Map landmark → canvas pixel (cover crop, khớp video mirror CSS). */
    function updateDisplayTransform() {
      const vw = videoEl.videoWidth || 640;
      const vh = videoEl.videoHeight || 480;
      // Làm việc trực tiếp trên kích thước backing thật của canvas → mirror axis
      // (dw) và cover crop luôn khớp đúng pixel, bất kể kiosk scale / làm tròn.
      const dw = Math.max(1, overlayEl.width);
      const dh = Math.max(1, overlayEl.height);
      const scale = Math.max(dw / vw, dh / vh); // object-fit: cover
      const sw = vw * scale;
      const sh = vh * scale;
      state.displayTransform = {
        vw, vh, dw, dh, scale, ox: (dw - sw) / 2, oy: (dh - sh) / 2,
      };
    }

    function mapLandmark(lm) {
      const t = state.displayTransform;
      if (!t || !lm) return null;
      const x = lm.x * t.vw * t.scale + t.ox;
      const y = lm.y * t.vh * t.scale + t.oy;
      return { x, y };
    }

    function vis(lm) {
      return lm && (lm.visibility ?? 1) >= MIN_VISIBILITY;
    }

    /**
     * Closest, frontal player: requires face + wide shoulders + center frame.
     */
    function extractSubject(landmarks) {
      const ls = landmarks[11];
      const rs = landmarks[12];
      const nose = landmarks[0];
      const le = landmarks[2];
      const re = landmarks[5];
      if (!vis(ls) || !vis(rs) || !nose || (nose.visibility ?? 0) < MIN_FACE_VIS) return null;

      const shoulderW = Math.abs(ls.x - rs.x);
      if (shoulderW < MIN_SHOULDER_W) return null;

      const shoulderX = (ls.x + rs.x) / 2;
      const shoulderY = (ls.y + rs.y) / 2;
      const faceX = nose.x;
      const faceY = nose.y;
      let faceW = shoulderW * 0.42;
      if (vis(le) && vis(re)) faceW = Math.abs(re.x - le.x);

      const lh = landmarks[23];
      const rh = landmarks[24];
      let centerX = shoulderX;
      if (vis(lh) && vis(rh)) {
        centerX = (shoulderX + (lh.x + rh.x) / 2) / 2;
      }
      if (centerX < CENTER_X_MIN || centerX > CENTER_X_MAX) return null;

      const centerBias = 1 - Math.min(1, Math.abs(centerX - 0.5) * 2.2);
      const frontalBias = vis(le) && vis(re)
        ? 1 - Math.min(1, Math.abs((le.x + re.x) / 2 - faceX) / (faceW * 0.35))
        : 0.7;
      const score = shoulderW * 3.2 + faceW * 2 + centerBias * 0.35 + frontalBias * 0.25;

      return {
        centerX, shoulderY, shoulderW, faceX, faceY, faceW, score, landmarks,
      };
    }

    function matchesLockedPlayer(subject) {
      const lock = state.lockedPlayer;
      if (!lock || !subject) return true;
      if (Math.abs(subject.faceX - lock.faceX) > LOCK_FACE_MAX_DX) return false;
      if (Math.abs(subject.faceY - lock.faceY) > LOCK_FACE_MAX_DY) return false;
      if (subject.shoulderW < lock.shoulderW * LOCK_SHOULDER_MIN_RATIO) return false;
      return true;
    }

    function updatePlayerLock(subject) {
      if (!subject) return;
      if (!state.lockedPlayer) {
        state.lockAcquire += 1;
        if (state.lockAcquire >= LOCK_ACQUIRE_FRAMES) {
          state.lockedPlayer = {
            faceX: subject.faceX,
            faceY: subject.faceY,
            faceW: subject.faceW,
            shoulderW: subject.shoulderW,
            centerX: subject.centerX,
          };
        }
        return;
      }
      const l = state.lockedPlayer;
      const a = 0.18;
      l.faceX = l.faceX * (1 - a) + subject.faceX * a;
      l.faceY = l.faceY * (1 - a) + subject.faceY * a;
      l.faceW = l.faceW * (1 - a) + subject.faceW * a;
      l.shoulderW = l.shoulderW * (1 - a) + subject.shoulderW * a;
      l.centerX = l.centerX * (1 - a) + subject.centerX * a;
    }

    function acceptSubject(subject, now) {
      if (!subject) return null;
      if (state.lockedPlayer && !matchesLockedPlayer(subject)) return null;
      if (
        state.calibrated &&
        state.lastCenterX != null &&
        Math.abs(subject.centerX - state.lastCenterX) > MAX_CENTER_JUMP
      ) {
        return null;
      }
      updatePlayerLock(subject);
      state.lastGoodSubject = subject;
      state.lastCenterX =
        state.lastCenterX == null
          ? subject.centerX
          : state.lastCenterX * 0.8 + subject.centerX * 0.2;
      state.lastSubjectAt = now;
      return subject;
    }

    /**
     * Làm mượt lực hiển thị về phía target theo CẢ hai chiều:
     * tăng nhanh (POWER_RISE) khi nhún sâu thêm, tụt (POWER_FALL) khi hết nhún.
     * Không còn giữ đỉnh → lực không bị "dính" sau một cú nhiễu.
     */
    function rampDisplayPower(target) {
      const t = Math.max(0, target);
      const rate = t > state.displayPower ? POWER_RISE : POWER_FALL;
      state.displayPower += (t - state.displayPower) * rate;
      if (state.displayPower < 0.5) state.displayPower = 0;
      return Math.round(state.displayPower);
    }

    function processPoseResults(results) {
      const landmarks = results.poseLandmarks;
      const cfg = LANDMARK_CONFIGS[state.landmarkMode];
      const now = performance.now();

      if (!landmarks || landmarks.length < cfg.minLandmarks) {
        setPoseState("IDLE");
        state.crouchHoldFrames = 0;
        onPowerPreview?.(0);
        return;
      }

      let subject = acceptSubject(extractSubject(landmarks), now);
      if (!subject && state.lastGoodSubject && now - state.lastSubjectAt <= LOST_GRACE_MS) {
        subject = state.lastGoodSubject;
      }
      if (!subject) {
        if (now - state.lastSubjectAt > LOST_GRACE_MS) {
          setPoseState("IDLE");
          state.crouchHoldFrames = 0;
          onPowerPreview?.(0);
        } else {
          onPowerPreview?.(state.currentPower);
        }
        return;
      }

      // Work in normalized shoulder-Y [0..1]; larger = lower on screen = deeper.
      const shoulderYn = subject.shoulderY;
      const headYn = subject.faceY;
      const shoulderWn = Math.max(MIN_SHOULDER_W, subject.shoulderW);

      // ── Calibrate baseline: chỉ chốt khi người ĐỨNG YÊN (variance thấp) ──
      if (!state.calibrated) {
        setPoseState("CALIBRATING");
        state.calibSamples.push({ y: shoulderYn, h: headYn });
        if (state.calibSamples.length > CALIB_FRAMES) state.calibSamples.shift();
        if (state.calibSamples.length < CALIB_FRAMES) {
          onPowerPreview?.(0);
          return;
        }
        const ys = state.calibSamples.map((s) => s.y);
        if (stddev(ys) > CALIB_STILL_TOL) {
          // Còn cử động → chưa chốt, trượt cửa sổ mẫu và chờ đứng yên.
          onPowerPreview?.(0);
          return;
        }
        state.standingBaseY = median(ys);
        const hs = state.calibSamples.map((s) => s.h).filter((v) => v != null);
        state.standingHeadY = hs.length ? median(hs) : null;
        state.recentPeakY = shoulderYn;
        state.recentPeakAt = now;
        state.calibrated = true;
      }

      if (shoulderYn >= state.recentPeakY) {
        state.recentPeakY = shoulderYn;
        state.recentPeakAt = now;
      } else if (now - state.recentPeakAt > SQUAT_WINDOW_MS) {
        state.recentPeakY = shoulderYn;
        state.recentPeakAt = now;
      }

      // Depth in SHOULDER-WIDTH units → distance-invariant.
      const currentDepth = Math.max(0, (shoulderYn - state.standingBaseY) / shoulderWn);

      // Velocity (sw-units / window); dương = vai đi xuống, âm = đi lên.
      state.shoulderHistory.unshift(shoulderYn);
      if (state.shoulderHistory.length > HISTORY_SIZE) state.shoulderHistory.pop();
      if (state.shoulderHistory.length < 4) {
        setPoseState("IDLE");
        onPowerPreview?.(0);
        return;
      }
      const vWindow = Math.min(state.shoulderHistory.length, 5);
      const velocity =
        (state.shoulderHistory[0] - state.shoulderHistory[vWindow - 1]) / shoulderWn;

      // ── Cổng 1: đầu + vai cùng tịnh tiến xuống (khử ngả/khom) ──
      let headDrop = null;
      if (state.standingHeadY != null && headYn != null) {
        headDrop = (headYn - state.standingHeadY) / shoulderWn;
      }
      const syncOk = headDrop == null
        ? true
        : Math.abs(headDrop - currentDepth) <= HEAD_SHOULDER_SYNC_TOL + currentDepth * 0.6;

      // ── Cổng 2: tín hiệu chân (gập gối) khi nhìn thấy cả người ──
      const legSignal = legSquatSignal(subject.landmarks); // 0..1 hoặc null
      const legOk = legSignal == null ? true : legSignal >= LEG_MIN_SIGNAL;

      // ── Cổng 3: dip động — phải có cú đi xuống mới "lên đạn" tích lực ──
      if (velocity > DIP_VEL_TH) state.dipArmed = true;

      const squatValid = state.dipArmed && syncOk && legOk;

      if (DEBUG) {
        state.debug = {
          depth: currentDepth,
          headDrop,
          legSignal,
          dip: state.dipArmed,
          sync: syncOk,
          valid: squatValid,
          power: Math.round(state.displayPower),
        };
      }

      if (now < state.cooldownUntil) {
        setPoseState("COOLDOWN");
        onPowerPreview?.(state.currentPower);
        return;
      }

      // ── Nhảy: cú bật DỨT KHOÁT lên sau một cú nhún hợp lệ.
      // Dùng đúng lực đang hiển thị (heldPower), KHÔNG cộng thêm → bật bao nhiêu
      // bằng đúng lực đã nạp. Kiểm tra TRƯỚC recenter để không bị reset sớm.
      const launchingUp = velocity < -JUMP_VEL_TH;
      if (launchingUp && state.squatPrimed) {
        const jumpPower = clamp(Math.round(state.heldPower), POWER.MIN, 100);
        setPoseState("JUMP");
        state.currentPower = jumpPower;
        state.displayPower = jumpPower;
        onPowerPreview?.(jumpPower);
        if (canJump()) onJumpPower?.(jumpPower);
        state.cooldownUntil = now + state.tuning.cooldownMs;
        state.crouchHoldFrames = 0;
        state.dipArmed = false;
        state.squatPrimed = false;
        state.heldPower = 0;
        state.recentPeakY = shoulderYn;
        state.recentPeakAt = now;
        return;
      }

      // Đứng / hấp thụ trôi: recenter baseline khi gần tư thế đứng.
      if (currentDepth < SQUAT_TH * 0.5) {
        state.crouchHoldFrames = 0;
        state.dipArmed = false;
        state.squatPrimed = false;
        state.heldPower = 0;
        state.standingBaseY =
          state.standingBaseY * (1 - STAND_RECENTER) + shoulderYn * STAND_RECENTER;
        if (state.standingHeadY != null && headYn != null) {
          state.standingHeadY =
            state.standingHeadY * (1 - STAND_RECENTER) + headYn * STAND_RECENTER;
        }
        const peakMargin = SQUAT_TH * 0.3 * shoulderWn;
        state.recentPeakY = Math.min(state.recentPeakY, shoulderYn + peakMargin);
      } else if (!squatValid && !state.squatPrimed) {
        // Ở độ sâu trung bình nhưng KHÔNG phải nhún hợp lệ (ngả/khom tĩnh):
        // recenter chậm để baseline trôi về tư thế hiện tại → lực không treo.
        const slow = STAND_RECENTER * 0.5;
        state.standingBaseY = state.standingBaseY * (1 - slow) + shoulderYn * slow;
        if (state.standingHeadY != null && headYn != null) {
          state.standingHeadY = state.standingHeadY * (1 - slow) + headYn * slow;
        }
      }

      // Đủ sâu VÀ hợp lệ → tích frame giữ nhún; ngược lại nhả dần.
      const deepEnough = currentDepth >= SQUAT_TH * 0.92;
      if (deepEnough && squatValid) {
        state.crouchHoldFrames = Math.min(state.crouchHoldFrames + 1, CROUCH_HOLD_FRAMES + 2);
      } else {
        state.crouchHoldFrames = Math.max(0, state.crouchHoldFrames - 1);
      }
      const isCrouching = state.crouchHoldFrames >= CROUCH_HOLD_FRAMES;

      // Đang nạp/giữ/chỉnh lực: nhún sâu hơn → lực tăng tức thì & giữ đỉnh ngắn;
      // nhổm lên lâu hơn HELD_DECAY_MS → lực hạ theo để người chơi điều chỉnh.
      if (isCrouching || state.squatPrimed || (squatValid && currentDepth >= SQUAT_TH * 0.5)) {
        if (isCrouching) state.squatPrimed = true;
        const preview = calcPreviewPower(currentDepth);
        if (preview >= state.heldPower) {
          state.heldPower = preview;
          state.heldPowerAt = now;
        } else if (now - state.heldPowerAt > HELD_DECAY_MS) {
          state.heldPower += (preview - state.heldPower) * POWER_FALL;
          if (state.heldPower < 0.5) state.heldPower = 0;
        }
        setPoseState("CROUCHING");
        state.displayPower = state.heldPower;
        state.currentPower = state.heldPower;
        onPowerPreview?.(Math.round(state.heldPower));
        return;
      }

      // Đứng / không hợp lệ: lực tụt mượt về 0.
      setPoseState("STANDING");
      const shownStand = rampDisplayPower(0);
      state.currentPower = shownStand;
      onPowerPreview?.(shownStand);
    }

    function drawDebug(ctx, d) {
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(4, 4, 158, 96);
      ctx.font = "12px monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      const f = (v) => (v == null ? "--" : v.toFixed(2));
      const lines = [
        `depth: ${f(d.depth)}`,
        `head : ${f(d.headDrop)}`,
        `leg  : ${f(d.legSignal)}`,
        `dip:${d.dip ? 1 : 0} sync:${d.sync ? 1 : 0} ok:${d.valid ? 1 : 0}`,
        `power: ${d.power}`,
      ];
      lines.forEach((ln, i) => {
        ctx.fillStyle = i === 3 ? "#FFD23E" : "#7CFFB2";
        ctx.fillText(ln, 10, 22 + i * 16);
      });
      ctx.restore();
    }

    function drawSkeleton(results) {
      const ctx = overlayEl.getContext("2d");
      if (!ctx) return;
      updateDisplayTransform();
      const t = state.displayTransform;
      const { width, height } = overlayEl;
      ctx.clearRect(0, 0, width, height);

      const raw = results.poseLandmarks;
      if (!raw || !t) return;

      if (DEBUG && state.debug) drawDebug(ctx, state.debug);

      const landmarks = smoothLandmarkFrame(raw);
      const subject = state.lastGoodSubject;
      if (!subject) return;

      ctx.save();
      ctx.translate(t.dw, 0);
      ctx.scale(-1, 1);

      ctx.lineWidth = 2.5;
      ctx.strokeStyle = "rgba(91,238,255,0.85)";

      const segments = [
        [0, 11], [0, 12], [11, 12], [11, 23], [12, 24],
      ];
      for (const [a, b] of segments) {
        const p1 = mapLandmark(landmarks[a]);
        const p2 = mapLandmark(landmarks[b]);
        if (!p1 || !p2) continue;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }

      const drawDot = (id, r, color) => {
        const p = mapLandmark(landmarks[id]);
        if (!p) return;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      };
      drawDot(0, 5, "#FFD23E");
      drawDot(2, 4, "#FFE566");
      drawDot(5, 4, "#FFE566");
      drawDot(11, 7, "#00E5FF");
      drawDot(12, 7, "#00E5FF");

      if (state.lockedPlayer) {
        const ref = mapLandmark({ x: state.lockedPlayer.faceX, y: state.lockedPlayer.faceY, visibility: 1 });
        if (ref) {
          const radius = Math.max(14, state.lockedPlayer.faceW * t.vw * t.scale * 0.9);
          ctx.strokeStyle = "rgba(255, 210, 60, 0.5)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(ref.x, ref.y, radius, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    async function initPosePipeline() {
      await loadMediaPipeScripts();
      const PoseCtor = window.Pose;
      const CameraCtor = window.Camera;
      if (!PoseCtor || !CameraCtor) throw new Error("MediaPipe runtime unavailable");

      const pose = new PoseCtor({
        locateFile: (file) => `vendor/mediapipe/pose/${file}`,
      });
      pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        minDetectionConfidence: 0.65,
        minTrackingConfidence: 0.78,
      });
      pose.onResults((results) => {
        // Logic phát hiện nhún chạy MỌI frame (giữ độ chính xác); chỉ vẽ overlay
        // tối đa ~30fps để giảm tải GPU/CPU khi camera chạy nhanh hơn.
        processPoseResults(results);
        const now = performance.now();
        if (now - state.lastDrawAt >= DRAW_INTERVAL_MS) {
          state.lastDrawAt = now;
          drawSkeleton(results);
        }
      });

      const camera = new CameraCtor(videoEl, {
        onFrame: async () => { await pose.send({ image: videoEl }); },
        width: 640,
        height: 480,
      });

      await camera.start();
      state.pose = pose;
      state.poseCamera = camera;
    }

    async function init() {
      try {
        await initPosePipeline();
        state.mode = "camera";
        onTrackingMode?.("camera");
        onCameraStatus?.("on", "Camera · tracking active");
      } catch (_err) {
        state.mode = "keyboard";
        onTrackingMode?.("keyboard");
        onCameraStatus?.("off", "No camera — use keyboard (Space)");
      }
    }

    function resizeOverlay() {
      const box = videoEl.parentElement;
      if (!box) return;
      // Dùng kích thước LAYOUT (clientWidth/Height) — bất biến với CSS transform
      // scale của kiosk. getBoundingClientRect() trả size SAU scale → nếu dùng nó
      // backing canvas sẽ sai tỉ lệ và điểm tracking lệch khỏi người.
      const w = box.clientWidth || box.offsetWidth || 1;
      const h = box.clientHeight || box.offsetHeight || 1;
      const dpr = window.devicePixelRatio || 1;
      overlayEl.width = Math.max(1, Math.round(w * dpr));
      overlayEl.height = Math.max(1, Math.round(h * dpr));
      // Hiển thị do CSS (.cam-overlay { width:100%; height:100% }) đảm nhiệm,
      // không set style px ở đây để khỏi xung đột với layout đã scale.
      updateDisplayTransform();
    }

    return {
      init,
      resizeOverlay,
      getMode() { return state.mode; },
      getPoseState() { return state.poseState; },
      getCurrentPower() { return state.currentPower; },
      resetCalibration() {
        resetCalibrationState();
      },
      resetPlayerLock() {
        state.lockedPlayer = null;
        state.lockAcquire = 0;
        state.lastGoodSubject = null;
      },
      cleanup() {
        if (state.poseCamera && typeof state.poseCamera.stop === "function") {
          state.poseCamera.stop();
        }
      },
    };
  }

  return { create };
})();

