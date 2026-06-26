/* ĐI CÙNG TAKICO — Idle screen (World/Mascot3D live in world.jsx) */

const TAK = window.TAK;

/* ── 01 · IDLE / Màn chờ ── */
function IdleScreen({ onStart, lightSrc }) {
  return (
    <div className="screen-inner idle-photo" onClick={onStart} style={{ position: 'absolute', inset: 0, cursor: 'pointer' }}>
      <img className="idle-photo-bg" src={TAK.A.idleBg} alt="ĐI CÙNG TAKICO — An toàn giao thông, hạnh phúc vững bền" />
      <div className="idle-start-pulse" aria-hidden="true"></div>
    </div>
  );
}

Object.assign(window, { IdleScreen });
