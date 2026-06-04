/* ĐI CÙNG TAKICO — Playing screen (charge → stop-at-line mechanic) */

const { useState, useEffect, useRef, forwardRef, useImperativeHandle } = React;

// stop line sits at this % across the lane; mascot starts here
const LINE_X = 60;
const START_X = 15;

const PlayingScreen = forwardRef(function PlayingScreen(props, ref) {
  const { totalStages, policeSrc, lightSrc, dealerSrc, onWin, onLose } = props;

  const [stage, setStage] = useState(1);          // 1-indexed current chặng
  const [phase, setPhase] = useState('aim');       // aim | charging | flying | result
  const [power, setPower] = useState(0);
  const [mascotX, setMascotX] = useState(START_X);
  const [timeLeft, setTimeLeft] = useState(60);
  const [toast, setToast] = useState(null);        // {cls,text}
  const [whistle, setWhistle] = useState(false);
  const [camPose, setCamPose] = useState('ready'); // ready|charging|go
  const [camLive, setCamLive] = useState(false);   // true when MediaPipe feed active
  const [bgScroll, setBgScroll] = useState(false); // panning to next scene
  const [snap, setSnap] = useState(false);         // teleport (no transition)

  const videoRef = useRef(null);
  const overlayRef = useRef(null);
  const trackingRef = useRef(null);
  const inputModeRef = useRef('keyboard'); // keyboard | camera

  // per-stage backgrounds — the scene the rider arrives at each chặng
  // per-stage backgrounds (1 distinct scene per chặng; stage 5 = HEAD Tân Kiều)
  const BGS = [TAK.A.sceneBg, TAK.A.sceneBg2, TAK.A.sceneBg3, TAK.A.sceneBg5, TAK.A.sceneBg6];
  const curBg  = BGS[(stage - 1) % BGS.length];
  const nextBg = BGS[stage % BGS.length];

  const raf = useRef(0);
  const dir = useRef(1);
  const powerRef = useRef(0);
  const phaseRef = useRef('aim');
  const stageRef = useRef(1);
  phaseRef.current = phase; stageRef.current = stage;

  const isFinal = stage >= totalStages;

  // success window varies a touch per stage
  const band = (() => {
    const lo = 60 - (stage - 1) * 1.5;
    return { lo, hi: lo + 16 };
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
    if (phaseRef.current !== 'aim') return;
    setPhase('charging'); phaseRef.current = 'charging';
    setCamPose('charging');
    powerRef.current = 0; dir.current = 1;
    clearInterval(raf.current);
    // Camera: lực từ độ sâu nhún thật (onPowerPreview). Keyboard: thanh dao động.
    if (!fromTracking && inputModeRef.current !== 'camera') {
      raf.current = setInterval(tick, 24);
    }
  }

  function release(forcedPower) {
    if (phaseRef.current !== 'charging') return;
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

  function resolve(outcome) {
    setPhase('result'); phaseRef.current = 'result';
    if (outcome === 'ok') {
      if (isFinal) { setToast({ cls: 'ok', text: 'VỀ ĐÍCH! 🎉' }); setTimeout(() => onWin(totalStages), 900); return; }
      setToast({ cls: 'ok', text: 'DỪNG CHUẨN! 👏' });
      // 1) green light → Takico rides on while the scene pans to the next background
      setTimeout(() => {
        setToast(null);
        setCamPose('go');
        setMascotX(122);     // ride off the right edge
        setBgScroll(true);   // pan backdrop to the next scene
      }, 850);
      // 2) once the next scene is in view, drop the rider back to the start (no slide)
      setTimeout(() => {
        setSnap(true);
        setStage((s) => s + 1);   // curBg becomes the scene now showing
        setBgScroll(false);       // track snaps back to 0 (no transition) — no visible jump
        setMascotX(-24);          // park off-screen left
        setPower(0); powerRef.current = 0;
      }, 850 + 1350);
      // 3) ride in from the left and begin the next chặng
      setTimeout(() => {
        setSnap(false);
        setMascotX(START_X);
        setCamPose('ready');
        setPhase('aim'); phaseRef.current = 'aim';
      }, 850 + 1350 + 80);
    } else if (outcome === 'over') {
      setWhistle(true);
      setToast({ cls: 'bad', text: 'VƯỢT ĐÈN ĐỎ!' });
      setTimeout(() => onLose('redlight', stageRef.current - 1), 1500);
    } else {
      setToast({ cls: 'bad', text: 'CHƯA TỚI VẠCH' });
      setTimeout(() => onLose('short', stageRef.current - 1), 1400);
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
        if (mode === 'camera') tracking.resetCalibration();
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
          powerRef.current = power;
          setPower(power);
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

    tracking.init().catch(() => {});

    return () => {
      tracking.cleanup();
      ro?.disconnect();
      trackingRef.current = null;
    };
  }, []);

  // ── countdown ──
  useEffect(() => {
    const id = setInterval(() => {
      setTimeLeft((t) => {
        if (phaseRef.current === 'result') return t;
        if (t <= 1) { clearInterval(id); onLose('timeout', stageRef.current - 1); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => { clearInterval(id); clearInterval(raf.current); };
  }, []);

  const mins = Math.floor(timeLeft / 60), secs = String(timeLeft % 60).padStart(2, '0');
  const flying = phase === 'flying' || phase === 'result';

  return (
    <div className="play-world">
      <div className={'play-bg-track' + (bgScroll ? ' scroll' : '')}>
        <div className="play-bg" style={{ backgroundImage: `url("${curBg}")` }}></div>
        <div className="play-bg" style={{ backgroundImage: `url("${nextBg}")` }}></div>
      </div>

      {/* ── lane scene ── */}
      <div className="lane-scene">
        {/* checkpoint at the stop line */}
        <div className="checkpoint" style={{ left: 0, width: '100%' }}>
          {!isFinal && <>
            <div className="stop-zone" style={{ left: `calc(${LINE_X}% - 60px)` }}></div>
            <div className="stop-line" style={{ left: `${LINE_X}%` }}></div>
            <div className="tl-game" style={{ left: `calc(${LINE_X}% - 90px)` }}>
              <img src={lightSrc} alt="đèn đỏ" />
            </div>
            <div className={'police-game' + (whistle ? ' whistle' : '')} style={{ left: `calc(${LINE_X}% + 160px)` }}>
              <img src={policeSrc} alt="công an" />
            </div>
            <div className={'whistle-fx' + (whistle ? ' show' : '')} style={{ left: `calc(${LINE_X}% + 300px)` }}>TUÝT! 📣</div>
          </>}

          {/* stage 5's destination (HEAD Tân Kiều) is now part of the backdrop art */}
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
          <div className="power-fill" style={{ width: `${power}%`, transition: phase === 'charging' ? 'none' : 'width .3s' }}></div>
        </div>
        <div className="power-hint">
          {phase === 'charging'
            ? <>Thả ra khi lực vào <b>vùng xanh</b> để dừng đúng vạch</>
            : phase === 'aim'
              ? camLive
                ? <>Nhún xuống lấy đà — <b>đứng lên</b> để phóng xe</>
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
