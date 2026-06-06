/* ĐI CÙNG TAKICO — Idle + Tutorial screens (World/Mascot3D live in world.jsx) */

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

/* ── 02 · TUTORIAL / Hướng dẫn ── */
function TutorialScreen({ onStart }) {
  const steps = [
    { n: '1', cls: 's1', label: 'ĐỨNG SẴN', sub: 'Đứng thẳng trước máy quay, sẵn sàng xuất phát', tf: 'none' },
    { n: '2', cls: 's2', label: 'NHÚN LẤY ĐÀ', sub: 'Nhún người xuống — giữ càng lâu, lực càng mạnh', tf: 'scaleY(0.74) translateY(14px)', charge: true },
    { n: '3', cls: 's3', label: 'ĐỨNG LÊN THẢ LỰC', sub: 'Bật người đứng lên để Takico phóng xe đi', tf: 'translateY(-12px) rotate(-7deg)' },
  ];
  return (
    <div className="screen-inner" onClick={onStart} style={{ position: 'absolute', inset: 0, cursor: 'pointer' }}>
      <World />
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.35)' }}></div>
      <div className="tut-wrap">
        <div className="tut-head">
          <div className="eyebrow">CÁCH ĐIỀU KHIỂN BẰNG ĐỘNG TÁC</div>
          <h2>Chơi thế nào?</h2>
        </div>
        <div className="tut-steps">
          {steps.map((s) => (
            <div key={s.n} className={'tut-card ' + s.cls}>
              <div className="tut-step-num">{s.n}</div>
              <div className="tut-figure">
                <img src={TAK.A.mascot} alt=""
                  style={{ width: 200, height: 200, objectFit: 'cover', borderRadius: '50%', border: '6px solid #fff', boxShadow: 'var(--shadow-md)', transform: s.tf, transition: 'transform .3s' }} />
                {s.charge && <div className="charge-arrow">
                  <svg width="46" height="46" viewBox="0 0 24 24" fill="none"><path d="M12 4v13M6 12l6 6 6-6" stroke="#FF9F1C" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>}
              </div>
              <div className="tut-label">{s.label}</div>
              <div className="tut-sub">{s.sub}</div>
            </div>
          ))}
        </div>
        <div className="tut-foot">
          Mục tiêu: dừng <b>đúng vạch đèn đỏ</b> ở mỗi chặng — bạn có <b>{TAK.GAME.totalLives} mạng</b> mỗi lượt · chạm/nhấn <b>SPACE</b> để bắt đầu
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { IdleScreen, TutorialScreen });
