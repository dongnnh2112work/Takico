/* ĐI CÙNG TAKICO — Lose / Win result screens + confetti */

function Confetti() {
  const colors = ['#E4002B', '#2A3990', '#FFD23E', '#FFFFFF', '#1CA64C', '#FF3F5E'];
  const pieces = Array.from({ length: 70 }).map((_, i) => ({
    left: Math.random() * 100,
    bg: colors[i % colors.length],
    dur: 2.6 + Math.random() * 2.4,
    delay: -Math.random() * 4,
    w: 10 + Math.random() * 10,
    rot: Math.random() * 360,
  }));
  return (
    <div className="confetti">
      {pieces.map((p, i) => (
        <i key={i} style={{
          left: p.left + '%', background: p.bg, width: p.w, height: p.w * 1.4,
          animationDuration: p.dur + 's', animationDelay: p.delay + 's',
          transform: `rotate(${p.rot}deg)`,
          borderRadius: i % 3 === 0 ? '50%' : '3px',
        }}></i>
      ))}
    </div>
  );
}

/* ── 04 · LOSE ── */
function LoseScreen({ reason, stagesCleared, totalStages, policeSrc, onRetry, onHome }) {
  const copy = {
    redlight: { title: 'VƯỢT ĐÈN ĐỎ!', tag: 'Chưa an toàn rồi', desc: <>Takico lấy đà quá mạnh nên <b>vượt qua vạch khi đèn đỏ</b> — chú công an đã tuýt còi. Nhớ dừng đúng vạch để đi tiếp nhé!</> },
    short:    { title: 'CHƯA TỚI VẠCH', tag: 'Gần được rồi', desc: <>Lực nhún hơi nhẹ nên xe <b>dừng trước vạch</b>. Thử lấy đà mạnh hơn một chút để dừng đúng vạch!</> },
    timeout:  { title: 'HẾT GIỜ', tag: 'Cố lên lần sau', desc: <>Đã hết thời gian của lượt chơi. Lấy đà dứt khoát hơn để về đích nhanh hơn nhé!</> },
  }[reason] || { title: 'KẾT THÚC LƯỢT', tag: '', desc: '' };

  return (
    <div className="overlay-screen">
      <div className="scrim"></div>
      {reason === 'redlight' && (
        <img src={policeSrc} alt="" style={{ position: 'absolute', right: '8%', bottom: 0, height: 620, zIndex: 1, filter: 'drop-shadow(0 20px 30px rgba(0,0,0,0.4))' }} />
      )}
      <div className="result-card">
        <div className="result-emblem bad">🚦</div>
        <div className="result-tag">{copy.tag}</div>
        <div className="result-title bad">{copy.title}</div>
        <div className="result-desc">{copy.desc}</div>
        <div className="result-stat">
          <div className="lbl">Chặng đạt được</div>
          <div className="num">{stagesCleared}<small>/{totalStages}</small></div>
        </div>
        <div className="result-actions">
          <button className="btn btn-lg btn-primary" onClick={onRetry}>↻ CHƠI LẠI</button>
          <button className="btn btn-lg btn-ghost" onClick={onHome}>VỀ MÀN CHÍNH</button>
        </div>
      </div>
    </div>
  );
}

/* ── 05 · WIN ── */
function WinScreen({ totalStages, dealerSrc, onClaim, onHome }) {
  return (
    <div className="overlay-screen">
      <div className="scrim" style={{ background: 'rgba(20,12,24,0.42)' }}></div>
      <Confetti />
      <img src={dealerSrc} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.18, zIndex: 1 }} />
      <div className="result-card win">
        <div className="win-mascot"><Mascot3D orbit="15deg 80deg 100%" fov="32deg" /></div>
        <div className="result-tag">Chúc mừng nhà vô địch</div>
        <div className="result-title win">VỀ ĐÍCH AN TOÀN!</div>
        <div className="result-desc">
          Takico đã đồng hành cùng bạn vượt <b>{totalStages} chặng</b> và về đến <b>HEAD Tân Kiều</b> an toàn.
          <br />“Cùng Takico đồng hành trên mọi nẻo đường.”
        </div>
        <div className="reward-box">
          <div className="qr">
            <svg width="78" height="78" viewBox="0 0 78 78">
              <rect width="78" height="78" fill="#fff" />
              <g fill="#211E2B">
                <rect x="6" y="6" width="22" height="22" /><rect x="12" y="12" width="10" height="10" fill="#fff" />
                <rect x="50" y="6" width="22" height="22" /><rect x="56" y="12" width="10" height="10" fill="#fff" />
                <rect x="6" y="50" width="22" height="22" /><rect x="12" y="56" width="10" height="10" fill="#fff" />
                <rect x="36" y="6" width="8" height="8" /><rect x="36" y="22" width="8" height="8" /><rect x="36" y="38" width="8" height="8" />
                <rect x="50" y="38" width="8" height="8" /><rect x="64" y="50" width="8" height="8" /><rect x="50" y="64" width="8" height="8" /><rect x="64" y="36" width="8" height="8" />
              </g>
            </svg>
          </div>
          <div>
            <div className="rt">🎁 Mang màn hình này đến quầy để nhận quà</div>
            <div className="rd">Nhân viên HEAD Tân Kiều sẽ quét mã &amp; trao phần quà an toàn giao thông của bạn.</div>
          </div>
        </div>
        <div className="result-actions">
          <button className="btn btn-lg btn-primary" onClick={onClaim}>🎁 NHẬN QUÀ</button>
          <button className="btn btn-lg btn-ghost" onClick={onHome}>VỀ MÀN CHÍNH</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Confetti, LoseScreen, WinScreen });
