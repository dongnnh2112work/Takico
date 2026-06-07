/* ĐI CÙNG TAKICO — Playing screen (charge → stop-at-line mechanic) */

const { useState, useEffect, useRef, forwardRef, useImperativeHandle } = React;

// stop line sits at this % across the lane; mascot starts here
const LINE_X = 60;
const START_X = 15;
const OK_BLACK_IN = 450;   // ms chờ trước khi fade đen
const OK_BLACK_HOLD = 550; // ms giữ màn đen
const OK_DRIVE_AT = OK_BLACK_IN + OK_BLACK_HOLD;

const PlayingScreen = forwardRef(function PlayingScreen(props, ref) {
  const {
    totalStages,
    totalLives = 3,
    timeLimitSec = 60,
    frozen = false,
    lightSrc,
    onWin,
    onGameOver,
  } = props;

  const [stage, setStage] = useState(1);          // 1-indexed current chặng
  const [phase, setPhase] = useState('aim');       // aim | charging | flying | result
  const [power, setPower] = useState(0);
  const [mascotX, setMascotX] = useState(START_X);
  const [timeLeft, setTimeLeft] = useState(timeLimitSec);
  const [lives, setLives] = useState(totalLives);
  const [toast, setToast] = useState(null);        // {cls,text}
  const [whistle, setWhistle] = useState(false);
  const [camPose, setCamPose] = useState('ready'); // ready|charging|go
  const [camLive, setCamLive] = useState(false);   // true when MediaPipe feed active
  const [signal, setSignal] = useState('red');     // red | green — đèn giao thông trong nền round
  const [cutBlack, setCutBlack] = useState(false); // fade đen trước khi đèn xanh + Takico chạy
  const [snap, setSnap] = useState(false);         // teleport (no transition)

  const videoRef = useRef(null);
  const overlayRef = useRef(null);
  const trackingRef = useRef(null);
  const inputModeRef = useRef('keyboard'); // keyboard | camera

  const roundBgs = TAK.A.roundBgs?.length ? TAK.A.roundBgs : TAK.A.stageBgs.map((bg, i) => ({
    red: bg,
    green: bg,
  }));
  const round = roundBgs[(stage - 1) % roundBgs.length] || roundBgs[0];
  const curBg = signal === 'green' ? round.green : round.red;

  const raf = useRef(0);
  const dir = useRef(1);
  const powerRef = useRef(0);
  const phaseRef = useRef('aim');
  const stageRef = useRef(1);
  const livesRef = useRef(totalLives);
  const timerIdRef = useRef(0);
  const keyboardChargeRef = useRef(false);
  const cameraPowerSmoothRef = useRef(0);
  phaseRef.current = phase; stageRef.current = stage; livesRef.current = lives;

  const isFinal = stage >= totalStages;

  // vùng xanh rộng hơn, lệch nhẹ theo chặng — dễ dừng đúng vạch
  const band = (() => {
    const lo = 57 - (stage - 1) * 1.0;
    return { lo, hi: lo + 22 };
  })();

  // ── charging loop (setInterval so it survives focus changes on kiosk) ──
  function tick() {
    let p = powerRef.current + dir.current * 2.6;
    if (p >= 100) { p = 100; dir.current = -1; }
    if (p <= 0) { p = 0; dir.current = 1; }
    powerRef.current = p;
    setPower(p);
  }

  function press(fromTracking) {
    if (frozen) return;

    // Space / chạm: luôn chạy thanh dao động (kể cả camera đã vào charging trước)
    if (!fromTracking) {
      if (phaseRef.current !== 'aim' && phaseRef.current !== 'charging') return;
      if (phaseRef.current === 'aim') {
        setPhase('charging'); phaseRef.current = 'charging';
        setCamPose('charging');
        powerRef.current = 0; dir.current = 1;
        cameraPowerSmoothRef.current = 0;
        setPower(0);
      }
      keyboardChargeRef.current = true;
      clearInterval(raf.current);
      tick();
      raf.current = setInterval(tick, 24);
      return;
    }

    if (phaseRef.current !== 'aim') return;
    setPhase('charging'); phaseRef.current = 'charging';
    setCamPose('charging');
    powerRef.current = 0;
    cameraPowerSmoothRef.current = 0;
    setPower(0);
    clearInterval(raf.current);
  }

  function release(forcedPower) {
    if (frozen) return;
    if (phaseRef.current !== 'charging') return;
    keyboardChargeRef.current = false;
    clearInterval(raf.current);
    const p = forcedPower != null ? forcedPower : powerRef.current;
    setPhase('flying'); phaseRef.current = 'flying';
    setCamPose('go');

    // classify
    let outcome, landX;
    if (p < band.lo) { outcome = 'short'; landX = START_X + (p / band.lo) * (LINE_X - START_X - 8); }
    else if (p > band.hi) { outcome = 'over'; landX = 130; }   // blow straight through the red light, off the right edge
    else { outcome = 'ok'; landX = LINE_X - 3; }

    setMascotX(landX);
    setTimeout(() => resolve(outcome), 1180);
  }

  function startCountdown() {
    clearInterval(timerIdRef.current);
    timerIdRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (phaseRef.current === 'result') return t;
        if (t <= 1) {
          clearInterval(timerIdRef.current);
          setPhase('result'); phaseRef.current = 'result';
          loseLife('timeout', 'HẾT GIỜ!');
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }

  function resetAttempt() {
    clearInterval(raf.current);
    keyboardChargeRef.current = false;
    setWhistle(false);
    setToast(null);
    setCutBlack(false);
    setSignal('red');
    setSnap(false);
    setMascotX(START_X);
    setPower(0); powerRef.current = 0;
    setCamPose('ready');
    setPhase('aim'); phaseRef.current = 'aim';
    setTimeLeft(timeLimitSec);
    startCountdown();
  }

  function loseLife(reason, failToast) {
    const next = livesRef.current - 1;
    livesRef.current = next;
    setLives(next);
    if (next <= 0) {
      const delay = reason === 'redlight' ? 1500 : 1400;
      setTimeout(() => onGameOver(reason, stageRef.current - 1), delay);
      return;
    }
    setToast({ cls: 'bad', text: failToast });
    setTimeout(() => {
      setToast({ cls: 'warn', text: `CÒN ${next} MẠNG — THỬ LẠI CHẶNG ${stageRef.current}` });
      setTimeout(resetAttempt, 1100);
    }, 900);
  }

  function resolve(outcome) {
    setPhase('result'); phaseRef.current = 'result';
    if (outcome === 'ok') {
      setToast({ cls: 'ok', text: 'DỪNG CHUẨN! 👏' });
      // 1) fade đen — vẫn giữ nền đèn đỏ, Takico đứng tại vạch
      setTimeout(() => setCutBlack(true), OK_BLACK_IN);
      // 2) bật đèn xanh rồi Takico mới chạy tiếp
      setTimeout(() => {
        setSignal('green');
        setCutBlack(false);
        setToast(isFinal ? { cls: 'ok', text: 'VỀ ĐÍCH! 🎉' } : null);
        setCamPose('go');
        setMascotX(122);
      }, OK_DRIVE_AT);
      if (isFinal) {
        setTimeout(() => onWin(totalStages), OK_DRIVE_AT + 1200);
        return;
      }
      // 3) sang round kế — nền đèn đỏ round mới
      setTimeout(() => {
        setSnap(true);
        setStage((s) => s + 1);
        setSignal('red');
        setMascotX(-24);
        setPower(0); powerRef.current = 0;
      }, OK_DRIVE_AT + 1350);
      // 4) ride in from the left and begin the next chặng
      setTimeout(() => {
        setSnap(false);
        setMascotX(START_X);
        setCamPose('ready');
        setPhase('aim'); phaseRef.current = 'aim';
      }, OK_DRIVE_AT + 1350 + 80);
    } else if (outcome === 'over') {
      setWhistle(true);
      loseLife('redlight', 'VƯỢT ĐÈN ĐỎ!');
    } else {
      loseLife('short', 'CHƯA TỚI VẠCH');
    }
  }

  useImperativeHandle(ref, () => ({ press, release }));

  // ── pose tracking (Game Play/micatcher-tracking.js) ──
  useEffect(() => {
    if (typeof MicatcherTracking === 'undefined') return undefined;
    const video = videoRef.current;
    const overlay = overlayRef.current;
    if (!video || !overlay) return undefined;

    const tracking = MicatcherTracking.create({
      videoEl: video,
      overlayEl: overlay,
      canJump: () => phaseRef.current === 'aim' || phaseRef.current === 'charging',
      onTrackingMode(mode) {
        inputModeRef.current = mode;
        setCamLive(mode === 'camera');
        if (mode === 'camera') {
          tracking.resetCalibration();
          tracking.resetPlayerLock?.();
        }
      },
      onPoseState(pose) {
        if (phaseRef.current === 'flying' || phaseRef.current === 'result') return;
        if (pose === 'CROUCHING') setCamPose('charging');
        else if (pose === 'JUMP') setCamPose('go');
        else setCamPose('ready');
      },
      onPowerPreview(power) {
        if (phaseRef.current === 'flying' || phaseRef.current === 'result') return;
        if (power > 0 && phaseRef.current === 'aim') press(true);
        if (phaseRef.current === 'charging') {
          if (keyboardChargeRef.current) {
            if (power > powerRef.current) {
              powerRef.current = power;
              setPower(power);
            }
            return;
          }
          // Camera: chỉ tăng, làm mượt — không dao động lên xuống
          const target = Math.max(powerRef.current, power);
          cameraPowerSmoothRef.current += (target - cameraPowerSmoothRef.current) * 0.28;
          const next = Math.round(Math.max(powerRef.current, cameraPowerSmoothRef.current));
          powerRef.current = next;
          setPower(next);
        }
      },
      onJumpPower(power) {
        if (phaseRef.current !== 'charging' && phaseRef.current !== 'aim') return;
        if (phaseRef.current === 'aim') press(true);
        powerRef.current = power;
        setPower(power);
        release(power);
      },
    });
    trackingRef.current = tracking;

    const box = video.parentElement;
    const ro = box ? new ResizeObserver(() => tracking.resizeOverlay()) : null;
    if (ro && box) ro.observe(box);

    const onVideoReady = () => tracking.resizeOverlay();
    video.addEventListener('loadedmetadata', onVideoReady);
    tracking.init().then(() => tracking.resizeOverlay()).catch(() => {});

    return () => {
      video.removeEventListener('loadedmetadata', onVideoReady);
      tracking.cleanup();
      ro?.disconnect();
      trackingRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!frozen) startCountdown();
    else {
      clearInterval(timerIdRef.current);
      clearInterval(raf.current);
    }
    return () => {
      clearInterval(timerIdRef.current);
      clearInterval(raf.current);
    };
  }, [frozen]);

  const mins = Math.floor(timeLeft / 60), secs = String(timeLeft % 60).padStart(2, '0');
  const flying = phase === 'flying' || phase === 'result';

  return (
    <div className="play-world">
      <div
        className={'play-bg-single' + (signal === 'green' ? ' signal-green' : ' signal-red')}
        style={{ backgroundImage: `url("${curBg}")` }}
        aria-hidden="true"
      />
      <div className={'play-cut-black' + (cutBlack ? ' on' : '')} aria-hidden="true" />

      {/* ── lane scene ── */}
      <div className="lane-scene">
        <div className="checkpoint" style={{ left: 0, width: '100%' }}>
          {!isFinal && <>
            <div className="stop-zone" style={{ left: `calc(${LINE_X}% - 60px)` }}></div>
            <div className="stop-line" style={{ left: `${LINE_X}%` }}></div>
            <div className={'whistle-fx' + (whistle ? ' show' : '')} style={{ left: `calc(${LINE_X}% + 300px)` }}>TUÝT! 📣</div>
          </>}
        </div>

        {/* mascot rider */}
        <div className={'mascot-rider'
            + (phase === 'aim' ? ' idle-bob' : '')
            + (phase === 'charging' ? ' revving' : '')
            + (flying ? ' go' : '')
            + (snap ? ' no-anim' : '')}
          style={{ left: `${mascotX}%` }}>
          <div className="speedlines"><i></i><i></i><i></i><i></i><i></i></div>
          <img className="rider-sprite" src={TAK.A.mascotSide} alt="Takico" />
          <div className="ride-shadow"></div>
        </div>
      </div>

      {/* ── HUD top ── */}
      <div className="hud-top">
        <div className="hud-chip">
          <div className="ic stage">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none"><path d="M6 3v18" stroke="#fff" strokeWidth="2.4" strokeLinecap="round"/><path d="M6 4h11l-2 3 2 3H6z" fill="#fff"/></svg>
          </div>
          <div>
            <div className="lbl">Chặng</div>
            <div className="val">{stage}<small>/{totalStages}</small></div>
            <div className="stage-dots">
              {Array.from({ length: totalStages }).map((_, i) => (
                <i key={i} className={i + 1 < stage ? 'done' : i + 1 === stage ? 'cur' : ''}></i>
              ))}
            </div>
          </div>
        </div>
        <div className="hud-mid">
          <div className="hud-chip lives-chip">
            <div className="ic lives">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none"><path d="M12 21s-7-4.6-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 5.4-7 10-7 10z" fill="#fff"/></svg>
            </div>
            <div>
              <div className="lbl">Mạng</div>
              <div className="lives-row" aria-label={`${lives} mạng còn lại`}>
                {Array.from({ length: totalLives }).map((_, i) => (
                  <i key={i} className={i < lives ? 'on' : 'off'}></i>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className={'hud-chip' + (timeLeft <= 10 ? ' warn' : '')}>
          <div className="ic time">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.5" stroke="#fff" strokeWidth="2.2"/><path d="M12 7.5V12l3 2" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"/></svg>
          </div>
          <div>
            <div className="lbl">Thời gian</div>
            <div className="val">{mins}:{secs}</div>
          </div>
        </div>
      </div>

      {/* ── camera HUD ── */}
      <div className="cam-hud">
        <div className={'cam-view' + (camLive ? ' has-camera' : '')}>
          <video ref={videoRef} playsInline muted autoPlay aria-hidden="true" />
          <canvas ref={overlayRef} className="cam-overlay" aria-hidden="true" />
          <div className="scan"></div>
          {!camLive && (
            <div className={'cam-silhouette' + (camPose === 'charging' ? ' squat' : '')}>
              <div className="h"></div><div className="t"></div>
            </div>
          )}
        </div>
        <div className={'cam-tag ' + camPose}>
          <span className="dot"></span>
          {camPose === 'ready' ? 'ĐỨNG SẴN' : camPose === 'charging' ? 'ĐANG LẤY ĐÀ' : 'PHÓNG ĐI!'}
        </div>
      </div>

      {/* ── power HUD ── */}
      <div className="power-hud">
        <div className="ph-top">
          <div className="ph-title">LỰC NHÚN</div>
          <div className="ph-num">{Math.round(power)}</div>
        </div>
        <div className="power-track">
          <div className="power-target" style={{ left: `${band.lo}%`, width: `${band.hi - band.lo}%` }}></div>
          <div className="power-fill" style={{
            width: `${power}%`,
            transition: phase === 'charging'
              ? (camLive && !keyboardChargeRef.current ? 'width 0.14s ease-out' : 'none')
              : 'width .3s',
          }}></div>
        </div>
        <div className="power-hint">
          {phase === 'charging'
            ? <>Thả ra khi lực vào <b>vùng xanh</b> để dừng đúng vạch</>
            : phase === 'aim'
              ? camLive
                ? <>Nhún xuống lấy đà — <b>đứng lên</b> hoặc thả <b>SPACE</b> để phóng</>
                : <>Giữ <b>SPACE</b> / chạm &amp; giữ để lấy đà — thả ra để phóng</>
              : <>Takico đang chạy…</>}
        </div>
      </div>

      {/* result toast */}
      {toast && <div className={'result-toast show ' + toast.cls}>{toast.text}</div>}
    </div>
  );
});

window.PlayingScreen = PlayingScreen;
