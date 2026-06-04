/* ĐI CÙNG TAKICO — App shell: state machine, input, kiosk scaling, dev nav */

const TOTAL_STAGES = 5;
const STATES = ['IDLE', 'TUTORIAL', 'PLAYING', 'LOSE', 'WIN'];

function App() {
  const [state, setState] = React.useState('IDLE');
  const [runKey, setRunKey] = React.useState(0);
  const [lose, setLose] = React.useState({ reason: 'redlight', cleared: 0 });
  const playRef = React.useRef(null);

  // process white-bg props once, share down
  const policeSrc = TAK.useKnockout(TAK.A.police);
  const lightSrc = TAK.useKnockout(TAK.A.light);
  const dealerSrc = TAK.A.dealer;

  const stateRef = React.useRef(state); stateRef.current = state;

  function startGame() { setRunKey((k) => k + 1); setState('PLAYING'); }

  // ── input routing (space + pointer) ──
  React.useEffect(() => {
    function press() {
      const s = stateRef.current;
      if (s === 'IDLE') setState('TUTORIAL');
      else if (s === 'TUTORIAL') startGame();
      else if (s === 'PLAYING') playRef.current && playRef.current.press();
    }
    function release() {
      if (stateRef.current === 'PLAYING') playRef.current && playRef.current.release();
    }
    function onKeyDown(e) { if (e.code === 'Space' && !e.repeat) { e.preventDefault(); press(); } }
    function onKeyUp(e) { if (e.code === 'Space') { e.preventDefault(); release(); } }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.TAKICO_INPUT = { press, release };
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      delete window.TAKICO_INPUT;
    };
  }, []);

  // pointer hold only matters during PLAYING (idle/tutorial use onClick)
  const stageHold = {
    onPointerDown: () => { if (stateRef.current === 'PLAYING') playRef.current && playRef.current.press(); },
    onPointerUp: () => { if (stateRef.current === 'PLAYING') playRef.current && playRef.current.release(); },
    onPointerLeave: () => { if (stateRef.current === 'PLAYING') playRef.current && playRef.current.release(); },
  };

  // ── kiosk scaling ──
  React.useEffect(() => {
    const el = document.getElementById('kiosk');
    function fit() {
      const vw = window.innerWidth, vh = window.innerHeight;
      if (!vw || !vh) return;                       // guard against 0 before layout
      const s = Math.min(vw / 1920, vh / 1080);
      if (!s) return;
      const tx = (vw - 1920 * s) / 2, ty = (vh - 1080 * s) / 2;
      el.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
    }
    fit();
    requestAnimationFrame(fit);                     // after first layout
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

  return (
    <div className="stage-viewport">
      <div className="kiosk" id="kiosk">

        <div className={'screen' + (state === 'IDLE' ? ' active' : '')}>
          {state === 'IDLE' && <IdleScreen lightSrc={lightSrc} onStart={() => setState('TUTORIAL')} />}
        </div>

        <div className={'screen' + (state === 'TUTORIAL' ? ' active' : '')}>
          {state === 'TUTORIAL' && <TutorialScreen onStart={startGame} />}
        </div>

        <div className={'screen' + (state === 'PLAYING' ? ' active' : '')} {...stageHold} style={{ touchAction: 'none' }}>
          {state === 'PLAYING' && (
            <PlayingScreen
              key={runKey}
              ref={playRef}
              totalStages={TOTAL_STAGES}
              policeSrc={policeSrc}
              lightSrc={lightSrc}
              dealerSrc={dealerSrc}
              onWin={() => setState('WIN')}
              onLose={(reason, cleared) => { setLose({ reason, cleared }); setState('LOSE'); }}
            />
          )}
        </div>

        <div className={'screen' + (state === 'LOSE' ? ' active' : '')}>
          {state === 'LOSE' && (
            <LoseScreen
              reason={lose.reason}
              stagesCleared={lose.cleared}
              totalStages={TOTAL_STAGES}
              policeSrc={policeSrc}
              onRetry={startGame}
              onHome={() => setState('IDLE')}
            />
          )}
        </div>

        <div className={'screen' + (state === 'WIN' ? ' active' : '')}>
          {state === 'WIN' && (
            <WinScreen
              totalStages={TOTAL_STAGES}
              dealerSrc={dealerSrc}
              onClaim={() => setState('IDLE')}
              onHome={() => setState('IDLE')}
            />
          )}
        </div>

      </div>

      {/* review-only navigation */}
      <div className="dev-nav">
        {STATES.map((s) => (
          <button key={s} className={state === s ? 'active' : ''}
            onClick={() => { if (s === 'PLAYING') startGame(); else setState(s); }}>
            {{ IDLE: '01 Chờ', TUTORIAL: '02 Hướng dẫn', PLAYING: '03 Chơi', LOSE: '04 Thua', WIN: '05 Thắng' }[s]}
          </button>
        ))}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
