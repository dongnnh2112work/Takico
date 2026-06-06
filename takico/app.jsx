/* ĐI CÙNG TAKICO — App shell: state machine, input, kiosk scaling, dev nav */

const STATES = ['IDLE', 'TUTORIAL', 'PLAYING', 'LOSE', 'WIN'];

function App() {
  const game = window.TAK.GAME;
  const [state, setState] = React.useState('IDLE');
  const [runKey, setRunKey] = React.useState(0);
  const [playOverlay, setPlayOverlay] = React.useState(null); // null | 'win' | 'lose'
  const [lose, setLose] = React.useState({ reason: 'redlight', cleared: 0 });
  const playRef = React.useRef(null);

  const policeSrc = TAK.useKnockout(TAK.A.police);
  const lightSrc = TAK.useKnockout(TAK.A.light);

  const inGame = state === 'PLAYING';
  const overlayOpen = playOverlay != null;

  const stateRef = React.useRef(state);
  const overlayRef = React.useRef(playOverlay);
  stateRef.current = state;
  overlayRef.current = playOverlay;

  function startGame() {
    setPlayOverlay(null);
    setRunKey((k) => k + 1);
    setState('PLAYING');
  }

  function replayRun() {
    if (stateRef.current !== 'PLAYING') return;
    setPlayOverlay(null);
    setRunKey((k) => k + 1);
  }

  const replayRunRef = React.useRef(replayRun);
  replayRunRef.current = replayRun;

  function exitToIdle() {
    setPlayOverlay(null);
    setState('IDLE');
  }

  React.useEffect(() => {
    function press() {
      const s = stateRef.current;
      if (overlayRef.current) return;
      if (s === 'IDLE') setState('TUTORIAL');
      else if (s === 'TUTORIAL') startGame();
      else if (s === 'PLAYING') playRef.current && playRef.current.press();
    }
    function release() {
      if (overlayRef.current) return;
      if (stateRef.current === 'PLAYING') playRef.current && playRef.current.release();
    }
    function onKeyDown(e) {
      if (e.code === 'Space' && !e.repeat) { e.preventDefault(); press(); return; }
      if (e.code === 'KeyR' && !e.repeat) { e.preventDefault(); replayRunRef.current(); }
    }
    function onKeyUp(e) { if (e.code === 'Space') { e.preventDefault(); release(); } }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.TAKICO_INPUT = { press, release, replay: () => replayRunRef.current() };
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      delete window.TAKICO_INPUT;
    };
  }, []);

  const stageHold = {
    onPointerDown: () => {
      if (overlayRef.current || stateRef.current !== 'PLAYING') return;
      playRef.current && playRef.current.press();
    },
    onPointerUp: () => {
      if (overlayRef.current || stateRef.current !== 'PLAYING') return;
      playRef.current && playRef.current.release();
    },
    onPointerLeave: () => {
      if (overlayRef.current || stateRef.current !== 'PLAYING') return;
      playRef.current && playRef.current.release();
    },
  };

  React.useEffect(() => {
    const el = document.getElementById('kiosk');
    function fit() {
      const vw = window.innerWidth, vh = window.innerHeight;
      if (!vw || !vh) return;
      const s = Math.min(vw / 1920, vh / 1080);
      if (!s) return;
      const tx = (vw - 1920 * s) / 2, ty = (vh - 1080 * s) / 2;
      el.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
    }
    fit();
    requestAnimationFrame(fit);
    setTimeout(fit, 0);
    window.addEventListener('load', fit);
    window.addEventListener('resize', fit);
    const ro = new ResizeObserver(fit);
    ro.observe(document.documentElement);
    return () => {
      window.removeEventListener('load', fit);
      window.removeEventListener('resize', fit);
      ro.disconnect();
    };
  }, []);

  function devNavTo(s) {
    if (s === 'PLAYING') { startGame(); return; }
    if (s === 'LOSE') {
      setState('PLAYING');
      setPlayOverlay('lose');
      setLose({ reason: 'redlight', cleared: 2 });
      return;
    }
    if (s === 'WIN') {
      setState('PLAYING');
      setPlayOverlay('win');
      return;
    }
    setPlayOverlay(null);
    setState(s);
  }

  function devNavActive(s) {
    if (s === 'LOSE') return playOverlay === 'lose';
    if (s === 'WIN') return playOverlay === 'win';
    return state === s && !playOverlay;
  }

  return (
    <div className="stage-viewport">
      <div className="kiosk" id="kiosk">

        <div className={'screen' + (state === 'IDLE' ? ' active' : '')}>
          {state === 'IDLE' && <IdleScreen lightSrc={lightSrc} onStart={() => setState('TUTORIAL')} />}
        </div>

        <div className={'screen' + (state === 'TUTORIAL' ? ' active' : '')}>
          {state === 'TUTORIAL' && <TutorialScreen onStart={startGame} />}
        </div>

        <div
          className={'screen screen--play' + (inGame ? ' active' : '') + (overlayOpen ? ' has-overlay' : '')}
          {...stageHold}
          style={{ touchAction: overlayOpen ? 'auto' : 'none' }}
          onDoubleClick={() => { if (inGame) replayRun(); }}
        >
          {inGame && (
            <>
              <PlayingScreen
                key={runKey}
                ref={playRef}
                frozen={overlayOpen}
                totalStages={game.totalStages}
                totalLives={game.totalLives}
                timeLimitSec={game.timeLimitSec}
                policeSrc={policeSrc}
                lightSrc={lightSrc}
                onWin={() => setPlayOverlay('win')}
                onGameOver={(reason, cleared) => {
                  setLose({ reason, cleared });
                  setPlayOverlay('lose');
                }}
              />
              {playOverlay === 'lose' && (
                <LoseScreen
                  reason={lose.reason}
                  stagesCleared={lose.cleared}
                  totalStages={game.totalStages}
                  totalLives={game.totalLives}
                  policeSrc={policeSrc}
                  onRetry={startGame}
                  onHome={exitToIdle}
                />
              )}
              {playOverlay === 'win' && (
                <WinScreen
                  totalStages={game.totalStages}
                  onHome={exitToIdle}
                />
              )}
            </>
          )}
        </div>

      </div>

      <div className="dev-nav">
        {STATES.map((s) => (
          <button key={s} className={devNavActive(s) ? 'active' : ''} onClick={() => devNavTo(s)}>
            {{ IDLE: '01 Chờ', TUTORIAL: '02 Hướng dẫn', PLAYING: '03 Chơi', LOSE: '04 Thua', WIN: '05 Thắng' }[s]}
          </button>
        ))}
      </div>
    </div>
  );
}

function Boot() {
  const [ready, setReady] = React.useState(!!window.TAK?.ready);
  React.useEffect(() => {
    if (window.TAK?.ready) return undefined;
    const onReady = () => setReady(true);
    window.addEventListener('tak-ready', onReady);
    return () => window.removeEventListener('tak-ready', onReady);
  }, []);
  if (!ready) {
    return (
      <div className="boot-loading" aria-busy="true">
        <div className="boot-loading-inner">Đang tải…</div>
      </div>
    );
  }
  return <App />;
}

ReactDOM.createRoot(document.getElementById('root')).render(<Boot />);
