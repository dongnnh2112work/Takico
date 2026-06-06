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
  const CALIB_FRAMES = 30;
  const CROUCH_HOLD_FRAMES = 6;

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

  // ── Squat metric — measured in SHOULDER-WIDTH units (distance-invariant) ──
  // Depth = how far shoulders dropped below baseline, divided by shoulder
  // width. This stays consistent whether the player is near or far.
  const SQUAT_TH = 0.34;         // shoulder-width units to START charging
  const MAX_DEPTH = 1.15;        // depth that maps to full power
  const JUMP_VEL_TH = 0.06;      // upward velocity (sw-units / window) to trigger jump
  const STAND_RECENTER = 0.12;   // baseline follow rate while standing (absorbs walking)

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function median(values) {
    const s = [...values].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  /** Preview power from squat depth (shoulder-width units): 0 until real squat. */
  function calcPreviewPower(depthUnits) {
    if (depthUnits < SQUAT_TH) return 0;
    const norm = clamp((depthUnits - SQUAT_TH) / (MAX_DEPTH - SQUAT_TH), 0, 1);
    return Math.round(norm * 100);
  }

  /** Jump release — aligned with preview so full squat ≈ 95–100. */
  function calcJumpPower(velocityUp, depthUnits) {
    const preview = calcPreviewPower(depthUnits);
    if (preview <= 0) return POWER.MIN;
    const velBonus = clamp(velocityUp / 0.18, 0, 1) * 12;
    return clamp(Math.round(Math.min(100, preview * 0.95 + velBonus)), POWER.MIN, 100);
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
    await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js", "mediapipe-pose");
    await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js", "mediapipe-camera-utils");
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
      calibrated: false,
      calibSamples: [],
      crouchHoldFrames: 0,
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
      state.calibrated = false;
      state.calibSamples = [];
      state.crouchHoldFrames = 0;
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
    }

    /** Map video landmark → overlay pixel (cover + selfie mirror). */
    function updateDisplayTransform() {
      const vw = videoEl.videoWidth || 640;
      const vh = videoEl.videoHeight || 480;
      const dw = overlayEl.width || 1;
      const dh = overlayEl.height || 1;
      const scale = Math.max(dw / vw, dh / vh);
      const sw = vw * scale;
      const sh = vh * scale;
      state.displayTransform = {
        vw, vh, dw, dh, scale, ox: (dw - sw) / 2, oy: (dh - sh) / 2,
      };
    }

    function mapLandmark(lm) {
      const t = state.displayTransform;
      if (!t || !lm) return null;
      const x = (1 - lm.x) * t.vw * t.scale + t.ox;
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

    function smoothDisplayPower(target) {
      if (target <= 0) {
        state.displayPower = 0;
        return 0;
      }
      state.displayPower = state.displayPower * 0.55 + target * 0.45;
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
      const shoulderWn = Math.max(MIN_SHOULDER_W, subject.shoulderW);

      if (!state.calibrated) {
        state.calibSamples.push(shoulderYn);
        if (state.calibSamples.length < CALIB_FRAMES) {
          setPoseState("IDLE");
          onPowerPreview?.(0);
          return;
        }
        // Median standing shoulder-Y = robust baseline (ignores brief outliers)
        state.standingBaseY = median(state.calibSamples);
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

      // Depth & velocity in SHOULDER-WIDTH units → distance-invariant.
      const currentDepth = Math.max(0, (shoulderYn - state.standingBaseY) / shoulderWn);
      const sqDepth = Math.max(0, (state.recentPeakY - state.standingBaseY) / shoulderWn);

      // Standing (or slowly walking near/far): re-center baseline so distance
      // changes get absorbed instead of reading as power. A real squat is
      // faster than this follow rate, so it still registers.
      if (currentDepth < SQUAT_TH * 0.5) {
        state.crouchHoldFrames = 0;
        state.standingBaseY =
          state.standingBaseY * (1 - STAND_RECENTER) + shoulderYn * STAND_RECENTER;
        const peakMargin = SQUAT_TH * 0.3 * shoulderWn;
        state.recentPeakY = Math.min(state.recentPeakY, shoulderYn + peakMargin);
      }

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

      if (now < state.cooldownUntil) {
        setPoseState("COOLDOWN");
        onPowerPreview?.(state.currentPower);
        return;
      }

      const hadSquat = sqDepth >= SQUAT_TH * 1.05;
      const isCrouchingRaw = currentDepth >= SQUAT_TH * 0.92;

      if (isCrouchingRaw) {
        state.crouchHoldFrames = Math.min(state.crouchHoldFrames + 1, CROUCH_HOLD_FRAMES + 2);
      } else {
        state.crouchHoldFrames = 0;
      }

      const isCrouching = state.crouchHoldFrames >= CROUCH_HOLD_FRAMES;
      const launchingUp = velocity < -JUMP_VEL_TH;

      if (launchingUp && (isCrouching || hadSquat)) {
        const depthForJump = Math.max(currentDepth, sqDepth * 0.5);
        const jumpPower = calcJumpPower(Math.abs(velocity), depthForJump);
        setPoseState("JUMP");
        state.currentPower = jumpPower;
        state.displayPower = jumpPower;
        onPowerPreview?.(jumpPower);
        if (canJump()) onJumpPower?.(jumpPower);
        state.cooldownUntil = now + state.tuning.cooldownMs;
        state.crouchHoldFrames = 0;
        state.recentPeakY = shoulderYn;
        state.recentPeakAt = now;
        return;
      }

      if (isCrouching) {
        setPoseState("CROUCHING");
        const previewPower = calcPreviewPower(currentDepth);
        state.currentPower = previewPower;
        onPowerPreview?.(smoothDisplayPower(previewPower));
        return;
      }

      setPoseState("STANDING");
      state.currentPower = 0;
      state.displayPower = 0;
      onPowerPreview?.(0);
    }

    function drawSkeleton(results) {
      const ctx = overlayEl.getContext("2d");
      if (!ctx) return;
      updateDisplayTransform();
      const { width, height } = overlayEl;
      ctx.clearRect(0, 0, width, height);

      const landmarks = results.poseLandmarks;
      if (!landmarks) return;

      const subject = state.lastGoodSubject;
      if (!subject) return;

      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(91,238,255,0.8)";

      const segments = [
        [0, 11], [0, 12], [11, 12], [11, 23], [12, 24], [23, 24],
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

      const faceIds = [0, 2, 5];
      const shoulderIds = [11, 12];
      for (const id of faceIds) {
        const p = mapLandmark(landmarks[id]);
        if (!p) continue;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = "#FFD23E";
        ctx.fill();
      }
      for (const id of shoulderIds) {
        const p = mapLandmark(landmarks[id]);
        if (!p) continue;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
        ctx.fillStyle = "#00E5FF";
        ctx.fill();
      }

      if (state.lockedPlayer) {
        const lock = state.lockedPlayer;
        const ref = mapLandmark({ x: lock.faceX, y: lock.faceY, visibility: 1 });
        const t = state.displayTransform;
        if (ref && t) {
          const radius = Math.max(14, lock.faceW * t.vw * t.scale * 0.85);
          ctx.strokeStyle = "rgba(255, 210, 60, 0.45)";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(ref.x, ref.y, radius, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }

    async function initPosePipeline() {
      await loadMediaPipeScripts();
      const PoseCtor = window.Pose;
      const CameraCtor = window.Camera;
      if (!PoseCtor || !CameraCtor) throw new Error("MediaPipe runtime unavailable");

      const pose = new PoseCtor({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
      });
      pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        minDetectionConfidence: 0.65,
        minTrackingConfidence: 0.78,
      });
      pose.onResults((results) => {
        processPoseResults(results);
        drawSkeleton(results);
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
      const rect = box.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      overlayEl.width = Math.max(1, Math.floor(rect.width * dpr));
      overlayEl.height = Math.max(1, Math.floor(rect.height * dpr));
      overlayEl.style.width = `${rect.width}px`;
      overlayEl.style.height = `${rect.height}px`;
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

