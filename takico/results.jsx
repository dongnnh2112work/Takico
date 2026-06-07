/* ĐI CÙNG TAKICO — Lose / Win result screens + confetti */

function ResultTitle({ text, tone }) {
  return (
    <h2 className={'result-title' + (tone ? ' ' + tone : '')}>{text}</h2>
  );
}

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
function LoseScreen({ reason, stagesCleared, totalStages, totalLives, onRetry, onHome }) {
  const copy = {
    redlight: { title: 'VƯỢT ĐÈN ĐỎ!', tag: 'Chưa an toàn rồi', desc: <>Takico lấy đà quá mạnh nên <b>vượt qua vạch khi đèn đỏ</b> — chú công an đã tuýt còi. Nhớ dừng đúng vạch để đi tiếp nhé!</> },
    short:    { title: 'CHƯA TỚI VẠCH', tag: 'Gần được rồi', desc: <>Lực nhún hơi nhẹ nên xe <b>dừng trước vạch</b>. Thử lấy đà mạnh hơn một chút để dừng đúng vạch!</> },
    timeout:  { title: 'HẾT GIỜ', tag: 'Cố lên lần sau', desc: <>Đã hết thời gian của lượt chơi. Lấy đà dứt khoát hơn để về đích nhanh hơn nhé!</> },
  }[reason] || { title: 'KẾT THÚC LƯỢT', tag: '', desc: '' };

  return (
    <div className="overlay-screen overlay-lose">
      <div className="scrim"></div>
      <div className="result-popup result-popup--lose">
        <header className="result-popup__head">
          <div className="result-emblem bad">🚦</div>
          <div className="result-popup__titles">
            <div className="result-tag">{copy.tag}</div>
            <ResultTitle text={copy.title} tone="bad" />
          </div>
        </header>
        <p className="result-desc">{copy.desc}</p>
        <div className="result-stats-row">
          <div className="result-stat">
            <div className="lbl">Chặng đạt được</div>
            <div className="num">{stagesCleared}<small>/{totalStages}</small></div>
          </div>
          {totalLives != null && (
            <div className="result-stat">
              <div className="lbl">Đã dùng hết</div>
              <div className="num">{totalLives}<small> mạng</small></div>
            </div>
          )}
        </div>
        <div className="result-actions">
          <button type="button" className="btn btn-lg btn-primary" onClick={onRetry}>↻ CHƠI LẠI</button>
          <button type="button" className="btn btn-lg btn-ghost" onClick={onHome}>VỀ MÀN CHÍNH</button>
        </div>
      </div>
    </div>
  );
}

/* ── 05 · WIN ── */
function WinScreen({ totalStages, onHome }) {
  return (
    <div className="overlay-screen overlay-win">
      <div className="scrim scrim--win"></div>
      <Confetti />
      <div className="result-popup result-popup--win">
        <header className="result-popup__head result-popup__head--win">
          <div className="win-mascot"><Mascot3D orbit="15deg 80deg 100%" fov="32deg" /></div>
          <div className="result-popup__titles">
            <div className="result-tag">Chúc mừng nhà vô địch</div>
            <ResultTitle text="VỀ ĐÍCH AN TOÀN!" tone="win" />
          </div>
        </header>
        <p className="result-desc">
          Takico đã đồng hành cùng bạn vượt <b>{totalStages} chặng</b> và về đến <b>HEAD Tân Kiều</b> an toàn.
          <br />“Cùng Takico đồng hành trên mọi nẻo đường.”
        </p>
        <div className="result-notice" role="status">
          <span className="result-notice__icon" aria-hidden="true">✓</span>
          <p>
            Bạn đã hoàn thành thử thách an toàn giao thông. Nhân viên sự kiện sẽ hướng dẫn bạn nhận phần quà tại quầy HEAD Tân Kiều.
          </p>
        </div>
        <div className="result-actions result-actions--single">
          <button type="button" className="btn btn-lg btn-primary" onClick={onHome}>VỀ MÀN CHÍNH</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Confetti, LoseScreen, WinScreen });
