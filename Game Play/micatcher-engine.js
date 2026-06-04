/* ────────────────────────────────────────────────────────────────────────────
 * Micatcher Jump Jump — game canvas + scene rendering
 * Side-view 2.5D, mic mascot character, charge-and-release physics
 * ──────────────────────────────────────────────────────────────────────────── */

const Game = (() => {
  // ── Assets ─────────────────────────────────────────────────────────────────
  const assets = {};
  const ASSET_LIST = {
    mascot: 'assets/mascot.png',
    star: 'assets/star.png',
    bgStalTL: 'assets/bg-6.png',
    bgStalTR: 'assets/bg-5.png',
    bgMountain: 'assets/bg-8.png',
    bgMountain2: 'assets/bg-4.png',
    bgWaveL: 'assets/bg-1.png',
    bgWaveR: 'assets/bg-2.png',
    bgPeak: 'assets/bg-3.png',
    bgRipple: 'assets/ripple.png',
    bgMicLight: 'assets/mic-light.png',
  };

  function loadAssets() {
    return Promise.all(Object.entries(ASSET_LIST).map(([k, src]) => new Promise((res) => {
      const img = new Image();
      img.onload = () => { assets[k] = img; res(); };
      img.onerror = () => { res(); };
      img.src = src;
    })));
  }

  // ── World / state ──────────────────────────────────────────────────────────
  const W = { width: 0, height: 0, dpr: 1 };
  const camera = { x: 0, targetX: 0, shake: 0 };
  const platforms = [];
  const particles = [];
  const ambientStars = [];
  let player = null;
  let score = 0;
  let best = parseInt(localStorage.getItem('mc-best') || '0', 10);
  let sessionScores = JSON.parse(localStorage.getItem('mc-session') || '[]');
  let state = 'ATTRACT'; // ATTRACT | TUTORIAL | PLAYING | OVER
  let theme = 'echoCave';
  let frame = 0;
  let chargingStartedAt = null;

  // Physics tuning — jump range scales ~ power²; gaps derived from jumpRangeAtPower()
  const GRAVITY = 0.35;
  const JUMP_VX = 0.076;   // horizontal speed per power unit (per frame)
  const JUMP_VY = -0.118;  // initial upward speed per power unit (per frame)
  const MAX_POWER = 100;
  const CHARGE_RATE = 70;  // power per second
  const GAP_POWER_MIN = 40;  // shortest gaps need ~this much power
  const GAP_POWER_MAX = 86;  // longest gaps need ~this much power (full squat)
  const GAP_MIN_PX = 250;    // minimum center-to-center spacing between platforms
  const FINAL_BLOCK_AT = 15; // platform id of the final/goal block
  let finalStyle = 'trophy'; // 'trophy' | 'throne'

  // Platform sizing
  const GROUND_Y = 540;      // screen y of "world floor" (platform top reference)
  const PLATFORM_TOP_W = 130; // visible top width
  const PLATFORM_HEIGHT = 80; // body height (visible)

  // ── Init ───────────────────────────────────────────────────────────────────
  function init(canvas, callbacks = {}) {
    Game.canvas = canvas;
    Game.ctx = canvas.getContext('2d');
    Game.callbacks = callbacks;
    resize();
    window.addEventListener('resize', resize);
    setupAmbientStars();
    return loadAssets();
  }

  function resize() {
    const c = Game.canvas;
    const rect = c.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.floor(rect.width * dpr);
    c.height = Math.floor(rect.height * dpr);
    c.style.width = rect.width + 'px';
    c.style.height = rect.height + 'px';
    W.width = rect.width;
    W.height = rect.height;
    W.dpr = dpr;
    Game.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function setupAmbientStars() {
    ambientStars.length = 0;
    for (let i = 0; i < 40; i++) {
      ambientStars.push({
        x: Math.random() * 2400,
        y: 30 + Math.random() * 360,
        s: 0.3 + Math.random() * 0.8,
        twk: Math.random() * Math.PI * 2,
        speed: 0.6 + Math.random() * 1.2,
      });
    }
  }

  // ── Game flow ──────────────────────────────────────────────────────────────
  function start() {
    state = 'PLAYING';
    score = 0;
    camera.x = 0;
    camera.targetX = 0;
    camera.shake = 0;
    platforms.length = 0;
    particles.length = 0;
    generateInitialPlatforms();
    player = createPlayer(platforms[0]);
    chargingStartedAt = null;
    if (Game.callbacks.onStateChange) Game.callbacks.onStateChange(state);
  }

  function gameOver() {
    state = 'OVER';
    sessionScores.push(score);
    sessionScores.sort((a, b) => b - a);
    sessionScores = sessionScores.slice(0, 5);
    localStorage.setItem('mc-session', JSON.stringify(sessionScores));
    if (score > best) {
      best = score;
      localStorage.setItem('mc-best', String(best));
    }
    if (Game.callbacks.onStateChange) Game.callbacks.onStateChange(state);
  }

  function reset() {
    state = 'ATTRACT';
    if (Game.callbacks.onStateChange) Game.callbacks.onStateChange(state);
  }

  function win() {
    state = 'WIN';
    // confetti burst
    for (let i = 0; i < 80; i++) {
      particles.push({
        x: (player ? player.x : 0),
        y: (player ? player.y - 80 : 0),
        vx: (Math.random() - 0.5) * 9,
        vy: -Math.random() * 8 - 2,
        life: 90,
        max: 90,
        size: 2 + Math.random() * 3,
        color: ['#FFD93D','#FFE873','#00E5FF','#80FFDC','#FF6B9D','#FF8E3C'][Math.floor(Math.random() * 6)],
        gravity: 0.15,
      });
    }
    sessionScores.push(score);
    sessionScores.sort((a, b) => b - a);
    sessionScores = sessionScores.slice(0, 5);
    localStorage.setItem('mc-session', JSON.stringify(sessionScores));
    if (score > best) {
      best = score;
      localStorage.setItem('mc-best', String(best));
    }
    if (Game.callbacks.onStateChange) Game.callbacks.onStateChange(state);
  }

  // ── World gen ──────────────────────────────────────────────────────────────
  const TYPES = ['crystal', 'podium', 'speaker', 'vinyl'];

  function pickType(idx) {
    if (idx === 0) return 'podium';
    if (idx < 3) return Math.random() < 0.5 ? 'crystal' : 'podium';
    return TYPES[Math.floor(Math.random() * TYPES.length)];
  }

  /** Horizontal travel (px) at landing height for a given charge power. */
  function jumpRangeAtPower(power) {
    const p = Math.max(0, Math.min(MAX_POWER, Number(power) || 0));
    if (p <= 0) return 0;
    let x = 0;
    let y = 0;
    let vx = p * JUMP_VX;
    let vy = p * JUMP_VY;
    for (let f = 0; f < 400; f++) {
      const prevY = y;
      x += vx;
      y += vy;
      vy += GRAVITY;
      if (f > 4 && vy >= 0 && prevY < 0 && y >= 0) return x;
    }
    return x;
  }

  function nextPlatformGap() {
    const minGap = Math.max(GAP_MIN_PX, PLATFORM_TOP_W, jumpRangeAtPower(GAP_POWER_MIN));
    const maxGap = Math.max(minGap + 48, jumpRangeAtPower(GAP_POWER_MAX) * 0.94);
    return minGap + Math.random() * (maxGap - minGap);
  }

  function generateInitialPlatforms() {
    let x = 220;
    for (let i = 0; i < 6; i++) {
      platforms.push(createPlatform(i, x, pickType(i)));
      if (i < 5) x += nextPlatformGap();
    }
  }

  function ensureAheadPlatforms() {
    const last = platforms[platforms.length - 1];
    if (last.id >= FINAL_BLOCK_AT) return; // stop generating past the final
    if (last.x - camera.x < W.width + 600) {
      const next = createPlatform(
        last.id + 1,
        last.x + nextPlatformGap(),
        pickType(last.id + 1)
      );
      platforms.push(next);
    }
  }

  function createPlatform(id, x, type) {
    const isFinal = id === FINAL_BLOCK_AT;
    if (isFinal) type = 'final';
    const sizeMul = isFinal ? 1.55 : (type === 'vinyl' ? 1.05 : type === 'speaker' ? 0.95 : 1.0);
    const heightMul = isFinal ? 1.25 : 1.0;
    return {
      id,
      x,
      surfaceY: GROUND_Y,
      topW: PLATFORM_TOP_W * sizeMul,
      h: PLATFORM_HEIGHT * heightMul,
      type,
      shimmer: Math.random() * Math.PI * 2,
      isFinal,
      collected: false,
    };
  }

  function createPlayer(plat) {
    return {
      x: plat.x,
      y: plat.surfaceY,
      vx: 0,
      vy: 0,
      power: 0,
      charging: false,
      airborne: false,
      facing: 1,
      squash: 0, // 0..1
      rot: 0,
      lastPlatId: plat.id,
    };
  }

  // ── Input ──────────────────────────────────────────────────────────────────
  function chargeStart() {
    if (state !== 'PLAYING' || !player || player.airborne) return;
    player.charging = true;
    chargingStartedAt = performance.now();
  }

  function launchWithPower(power) {
    if (state !== 'PLAYING' || !player || player.airborne) return;
    const p = Math.max(0, Math.min(MAX_POWER, Number(power) || 0));
    if (p <= 0) return;
    player.power = p;
    player.charging = true;
    chargeRelease();
  }

  function chargeRelease() {
    if (state !== 'PLAYING' || !player || !player.charging) return;
    player.charging = false;
    const power = player.power;
    player.power = 0;
    // launch
    player.vx = power * JUMP_VX * player.facing;
    player.vy = power * JUMP_VY;
    player.airborne = true;
    player.squash = 0;
    // particles
    for (let i = 0; i < 12; i++) {
      particles.push({
        x: player.x + (Math.random() - 0.5) * 30,
        y: player.y - 6,
        vx: (Math.random() - 0.5) * 2,
        vy: -Math.random() * 3 - 1,
        life: 30,
        max: 30,
        size: 1 + Math.random() * 2,
        color: power > 70 ? '#FFE873' : '#80FFDC',
      });
    }
  }

  // ── Update ─────────────────────────────────────────────────────────────────
  function update(dt) {
    frame++;
    // ambient stars drift
    for (const st of ambientStars) {
      st.twk += dt * 3;
    }
    // particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += (p.gravity != null ? p.gravity : 0.08);
      p.life--;
      if (p.life <= 0) particles.splice(i, 1);
    }

    if (state !== 'PLAYING' || !player) return;

    // charge
    if (player.charging && !player.airborne) {
      player.power = Math.min(MAX_POWER, player.power + CHARGE_RATE * dt);
      player.squash = Math.min(1, player.power / MAX_POWER);
    }

    // physics
    if (player.airborne) {
      player.x += player.vx;
      player.y += player.vy;
      player.vy += GRAVITY;
      player.rot += player.vx * 0.005;

      // check landing on platforms
      for (const plat of platforms) {
        const dx = Math.abs(player.x - plat.x);
        if (dx <= plat.topW * 0.5 && player.vy >= 0) {
          // detect crossing surface
          const prevY = player.y - player.vy;
          if (prevY <= plat.surfaceY && player.y >= plat.surfaceY) {
            // land
            player.y = plat.surfaceY;
            player.vx = 0;
            player.vy = 0;
            player.airborne = false;
            player.rot = 0;
            camera.shake = 6;
            if (plat.id > player.lastPlatId) {
              const diff = plat.id - player.lastPlatId;
              score += diff;
              player.lastPlatId = plat.id;
              // landing particles
              for (let i = 0; i < 18; i++) {
                particles.push({
                  x: player.x + (Math.random() - 0.5) * 60,
                  y: player.y - 4,
                  vx: (Math.random() - 0.5) * 3,
                  vy: -Math.random() * 4 - 0.5,
                  life: 40,
                  max: 40,
                  size: 1 + Math.random() * 2,
                  color: ['#00E5FF', '#80FFDC', '#FFD93D'][Math.floor(Math.random() * 3)],
                });
              }
              // ── Final block reached → WIN ──
              if (plat.isFinal && !plat.collected) {
                plat.collected = true;
                setTimeout(() => win(), 250);
              }
            }
            return;
          }
        }
      }

      // fall off bottom
      if (player.y > W.height + 200) {
        gameOver();
        return;
      }
    }

    // camera follow
    camera.targetX = player.x - W.width * 0.35;
    camera.x += (camera.targetX - camera.x) * 0.08;
    camera.shake *= 0.85;

    ensureAheadPlatforms();
    // cull behind
    while (platforms.length > 0 && platforms[0].x < camera.x - 400) {
      platforms.shift();
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const THEMES = {
    echoCave: {
      bgTop: '#050B1F',
      bgMid: '#0A1838',
      bgGlow: '#1E4D9E',
      bgGlowOpacity: 0.55,
      accent: '#00E5FF',
      mint: '#80FFDC',
      gold: '#FFD93D',
      stalLayer: true,
      mountainLayer: true,
      spotlightBeams: false,
    },
    crystalArena: {
      bgTop: '#031440',
      bgMid: '#0E2A78',
      bgGlow: '#3DC9F5',
      bgGlowOpacity: 0.75,
      accent: '#5BEEFF',
      mint: '#A2FFE3',
      gold: '#FFE873',
      stalLayer: true,
      mountainLayer: true,
      spotlightBeams: false,
    },
    spotlightStage: {
      bgTop: '#02071A',
      bgMid: '#0A1838',
      bgGlow: '#FFD93D',
      bgGlowOpacity: 0.32,
      accent: '#FFD93D',
      mint: '#80FFDC',
      gold: '#FFE873',
      stalLayer: true,
      mountainLayer: true,
      spotlightBeams: true,
    },
  };

  function render() {
    const ctx = Game.ctx;
    const t = THEMES[theme] || THEMES.echoCave;

    ctx.clearRect(0, 0, W.width, W.height);

    // ── Sky / cave background ───────────────────────────────────────────────
    const g = ctx.createLinearGradient(0, 0, 0, W.height);
    g.addColorStop(0, t.bgTop);
    g.addColorStop(0.5, t.bgMid);
    g.addColorStop(1, t.bgTop);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W.width, W.height);

    // central glow
    const glow = ctx.createRadialGradient(
      W.width * 0.5, W.height * 0.62, 30,
      W.width * 0.5, W.height * 0.62, W.width * 0.55
    );
    glow.addColorStop(0, withAlpha(t.bgGlow, t.bgGlowOpacity));
    glow.addColorStop(0.6, withAlpha(t.bgGlow, t.bgGlowOpacity * 0.25));
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W.width, W.height);

    // spotlight beams
    if (t.spotlightBeams) {
      drawSpotlightBeams(ctx, t);
    }

    // ── Far parallax: mountain peak ─────────────────────────────────────────
    if (t.mountainLayer && assets.bgPeak) {
      const px = -camera.x * 0.05;
      ctx.globalAlpha = 0.55;
      const pw = 460, ph = 460;
      const py = W.height - ph - 40;
      // tile
      for (let i = -1; i < 4; i++) {
        const x = ((px + i * 480) % (480 * 4)) - 240;
        ctx.drawImage(assets.bgPeak, x + W.width * 0.2, py, pw, ph);
      }
      ctx.globalAlpha = 1;
    }

    // ── ambient stars ───────────────────────────────────────────────────────
    for (const st of ambientStars) {
      const sx = ((st.x - camera.x * 0.3) % (W.width + 200)) - 100;
      const tw = 0.6 + Math.sin(st.twk + frame * 0.05) * 0.4;
      ctx.globalAlpha = tw;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(sx, st.y, st.s * 1.6, 0, Math.PI * 2);
      ctx.fill();
      // halo
      ctx.globalAlpha = tw * 0.3;
      ctx.beginPath();
      ctx.arc(sx, st.y, st.s * 4, 0, Math.PI * 2);
      ctx.fillStyle = t.accent;
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // ── Mid parallax: mountain silhouette ───────────────────────────────────
    if (t.mountainLayer && assets.bgMountain) {
      ctx.globalAlpha = 0.85;
      const mh = 280;
      const my = W.height - mh + 10;
      const mw = W.width + 200;
      const ox = (-camera.x * 0.15) % (mw * 0.6);
      ctx.drawImage(assets.bgMountain, ox - 100, my, mw, mh);
      ctx.drawImage(assets.bgMountain, ox - 100 + mw * 0.6, my, mw, mh);
      ctx.globalAlpha = 1;
    }
    if (t.mountainLayer && assets.bgMountain2) {
      ctx.globalAlpha = 0.7;
      const mh = 200;
      const my = W.height - mh + 30;
      const mw = W.width + 300;
      const ox = (-camera.x * 0.22) % (mw * 0.7);
      ctx.drawImage(assets.bgMountain2, ox - 150, my, mw, mh);
      ctx.drawImage(assets.bgMountain2, ox - 150 + mw * 0.7, my, mw, mh);
      ctx.globalAlpha = 1;
    }

    // ── Top stalactite layer ────────────────────────────────────────────────
    if (t.stalLayer) {
      if (assets.bgStalTL) {
        ctx.globalAlpha = 0.95;
        ctx.drawImage(assets.bgStalTL, -30, -20, W.width * 0.65, 320);
      }
      if (assets.bgStalTR) {
        ctx.globalAlpha = 0.95;
        ctx.drawImage(assets.bgStalTR, W.width * 0.45, -20, W.width * 0.55, 280);
      }
      ctx.globalAlpha = 1;
    }

    // camera shake
    ctx.save();
    if (camera.shake > 0.3) {
      ctx.translate(
        (Math.random() - 0.5) * camera.shake,
        (Math.random() - 0.5) * camera.shake
      );
    }

    // ── Platforms (world space) ─────────────────────────────────────────────
    ctx.save();
    ctx.translate(-camera.x, 0);
    for (const plat of platforms) {
      drawPlatform(ctx, plat, t);
    }

    // player
    if (player) drawPlayer(ctx, player, t);

    // particles
    for (const p of particles) {
      ctx.globalAlpha = p.life / p.max;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.restore();
    ctx.restore();

    // ── Foreground vignette ─────────────────────────────────────────────────
    const vg = ctx.createRadialGradient(
      W.width * 0.5, W.height * 0.5, W.width * 0.3,
      W.width * 0.5, W.height * 0.5, W.width * 0.7
    );
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(2,5,15,0.55)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W.width, W.height);

    // ── Power charge ring around player ─────────────────────────────────────
    if (player && player.charging && !player.airborne) {
      drawChargeRing(ctx, player, t);
    }
  }

  function drawSpotlightBeams(ctx, t) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const beams = [
      { x: W.width * 0.2, angle: -0.15, hue: t.gold },
      { x: W.width * 0.5, angle: 0, hue: '#FFFFFF' },
      { x: W.width * 0.78, angle: 0.18, hue: t.accent },
    ];
    for (const b of beams) {
      ctx.save();
      ctx.translate(b.x, -40);
      ctx.rotate(b.angle);
      const beamG = ctx.createLinearGradient(0, 0, 0, W.height);
      beamG.addColorStop(0, withAlpha(b.hue, 0.55));
      beamG.addColorStop(0.4, withAlpha(b.hue, 0.18));
      beamG.addColorStop(1, withAlpha(b.hue, 0));
      ctx.fillStyle = beamG;
      ctx.beginPath();
      ctx.moveTo(-30, 0);
      ctx.lineTo(30, 0);
      ctx.lineTo(220, W.height + 50);
      ctx.lineTo(-220, W.height + 50);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  // ── Platform variants ──────────────────────────────────────────────────────
  function drawPlatform(ctx, plat, t) {
    const x = plat.x;
    const y = plat.surfaceY;
    const w = plat.topW;
    const h = plat.h;

    // ground reflection / glow circle under platform
    ctx.save();
    const gradPad = ctx.createRadialGradient(x, y + 4, 4, x, y + 8, w * 0.7);
    gradPad.addColorStop(0, withAlpha(t.accent, 0.25));
    gradPad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradPad;
    ctx.beginPath();
    ctx.ellipse(x, y + 6, w * 0.7, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (plat.type === 'crystal') drawCrystal(ctx, x, y, w, h, plat, t);
    else if (plat.type === 'podium') drawPodium(ctx, x, y, w, h, plat, t);
    else if (plat.type === 'speaker') drawSpeaker(ctx, x, y, w, h, plat, t);
    else if (plat.type === 'vinyl') drawVinyl(ctx, x, y, w, h, plat, t);
    else if (plat.type === 'final') drawFinalBlock(ctx, x, y, w, h, plat, t);
  }

  function drawCrystal(ctx, cx, cy, w, h, plat, t) {
    // Hexagonal crystal prism block — solid silhouette matching speaker/vinyl weight
    const baseY = cy + h;
    const hw = w * 0.48;           // half-width of the hex (top points)
    const sideX = hw * 0.78;       // x of the left/right "shoulder" points
    const topInsetY = 4;           // top hexagon's depth (front edge of top)
    const topPeakY = -3;           // top hexagon's back edge (slightly above surface)

    // Ground shadow
    ctx.fillStyle = 'rgba(2,8,28,0.65)';
    ctx.beginPath();
    ctx.ellipse(cx, baseY + 2, hw * 1.05, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // ── Body: two visible side faces of a hex prism ─────────────────────────
    // LEFT face: brighter (lit from left)
    const leftGrad = ctx.createLinearGradient(cx - hw, cy, cx - hw * 0.2, baseY);
    leftGrad.addColorStop(0, '#2A78D6');
    leftGrad.addColorStop(0.5, '#1A4DA8');
    leftGrad.addColorStop(1, '#0E2A78');
    ctx.fillStyle = leftGrad;
    ctx.beginPath();
    ctx.moveTo(cx - hw, cy + topInsetY);
    ctx.lineTo(cx - sideX, cy + topInsetY + 6);
    ctx.lineTo(cx, cy + topInsetY + 10);
    ctx.lineTo(cx, baseY);
    ctx.lineTo(cx - sideX, baseY - 6);
    ctx.lineTo(cx - hw, baseY - 12);
    ctx.closePath();
    ctx.fill();

    // RIGHT face: darker shadow side
    const rightGrad = ctx.createLinearGradient(cx, cy, cx + hw, baseY);
    rightGrad.addColorStop(0, '#0E2A78');
    rightGrad.addColorStop(0.5, '#08184A');
    rightGrad.addColorStop(1, '#040C2A');
    ctx.fillStyle = rightGrad;
    ctx.beginPath();
    ctx.moveTo(cx, cy + topInsetY + 10);
    ctx.lineTo(cx + sideX, cy + topInsetY + 6);
    ctx.lineTo(cx + hw, cy + topInsetY);
    ctx.lineTo(cx + hw, baseY - 12);
    ctx.lineTo(cx + sideX, baseY - 6);
    ctx.lineTo(cx, baseY);
    ctx.closePath();
    ctx.fill();

    // Inner facet line down the center (vertical ridge of the prism)
    ctx.strokeStyle = withAlpha(t.accent, 0.55);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy + topInsetY + 10);
    ctx.lineTo(cx, baseY);
    ctx.stroke();

    // Outer silhouette edges (mint glow)
    ctx.strokeStyle = withAlpha(t.mint, 0.85);
    ctx.lineWidth = 1.5;
    ctx.shadowColor = t.accent;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(cx - hw, cy + topInsetY);
    ctx.lineTo(cx - hw, baseY - 12);
    ctx.moveTo(cx + hw, cy + topInsetY);
    ctx.lineTo(cx + hw, baseY - 12);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Bottom rim curve
    ctx.strokeStyle = withAlpha(t.mint, 0.4);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - hw, baseY - 12);
    ctx.lineTo(cx - sideX, baseY - 6);
    ctx.lineTo(cx, baseY);
    ctx.lineTo(cx + sideX, baseY - 6);
    ctx.lineTo(cx + hw, baseY - 12);
    ctx.stroke();

    // ── Top hexagonal surface (the landing pad) ────────────────────────────
    // Filled hex top
    const topGrad = ctx.createLinearGradient(cx, cy + topPeakY, cx, cy + topInsetY + 10);
    topGrad.addColorStop(0, withAlpha(t.mint, 0.95));
    topGrad.addColorStop(0.5, withAlpha(t.accent, 0.85));
    topGrad.addColorStop(1, '#1A4DA8');
    ctx.fillStyle = topGrad;
    ctx.beginPath();
    ctx.moveTo(cx - hw, cy + topInsetY);
    ctx.lineTo(cx - sideX, cy + topPeakY);
    ctx.lineTo(cx + sideX, cy + topPeakY);
    ctx.lineTo(cx + hw, cy + topInsetY);
    ctx.lineTo(cx + sideX, cy + topInsetY + 6);
    ctx.lineTo(cx, cy + topInsetY + 10);
    ctx.lineTo(cx - sideX, cy + topInsetY + 6);
    ctx.closePath();
    ctx.fill();

    // Top facet split (back triangle highlight)
    ctx.fillStyle = withAlpha('#FFFFFF', 0.18);
    ctx.beginPath();
    ctx.moveTo(cx - sideX, cy + topPeakY);
    ctx.lineTo(cx + sideX, cy + topPeakY);
    ctx.lineTo(cx, cy + topInsetY + 4);
    ctx.closePath();
    ctx.fill();

    // Top edge highlight (bright mint stroke)
    ctx.strokeStyle = withAlpha(t.mint, 1);
    ctx.lineWidth = 1.5;
    ctx.shadowColor = t.mint;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(cx - hw, cy + topInsetY);
    ctx.lineTo(cx - sideX, cy + topPeakY);
    ctx.lineTo(cx + sideX, cy + topPeakY);
    ctx.lineTo(cx + hw, cy + topInsetY);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Front edges (more subtle, no glow)
    ctx.strokeStyle = withAlpha(t.accent, 0.6);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - hw, cy + topInsetY);
    ctx.lineTo(cx - sideX, cy + topInsetY + 6);
    ctx.lineTo(cx, cy + topInsetY + 10);
    ctx.lineTo(cx + sideX, cy + topInsetY + 6);
    ctx.lineTo(cx + hw, cy + topInsetY);
    ctx.stroke();

    // ── Small accent spike sticking up at the back (decorative) ────────────
    const spikeX = cx - hw * 0.45;
    const spikeBaseY = cy + topPeakY - 1;
    const spikeTipY = cy - 22;
    const spikeW = 6;
    ctx.fillStyle = '#1E5DAA';
    ctx.beginPath();
    ctx.moveTo(spikeX - spikeW, spikeBaseY);
    ctx.lineTo(spikeX, spikeTipY);
    ctx.lineTo(spikeX + spikeW, spikeBaseY);
    ctx.closePath();
    ctx.fill();
    // spike highlight
    ctx.fillStyle = withAlpha(t.mint, 0.7);
    ctx.beginPath();
    ctx.moveTo(spikeX - spikeW, spikeBaseY);
    ctx.lineTo(spikeX, spikeTipY);
    ctx.lineTo(spikeX - 1, spikeBaseY);
    ctx.closePath();
    ctx.fill();

    // Second smaller spike
    const spike2X = cx + hw * 0.35;
    const spike2BaseY = cy + topPeakY - 1;
    const spike2TipY = cy - 14;
    ctx.fillStyle = '#0E2A78';
    ctx.beginPath();
    ctx.moveTo(spike2X - 4, spike2BaseY);
    ctx.lineTo(spike2X, spike2TipY);
    ctx.lineTo(spike2X + 4, spike2BaseY);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = withAlpha(t.mint, 0.5);
    ctx.beginPath();
    ctx.moveTo(spike2X - 4, spike2BaseY);
    ctx.lineTo(spike2X, spike2TipY);
    ctx.lineTo(spike2X - 1, spike2BaseY);
    ctx.closePath();
    ctx.fill();

    // ── Shimmer specks on the top surface ──────────────────────────────────
    const tt = frame * 0.05 + plat.shimmer;
    for (let i = 0; i < 3; i++) {
      const sx = cx + Math.sin(tt + i * 2) * hw * 0.5;
      const sy = cy + 1 + Math.cos(tt * 1.3 + i) * 3;
      ctx.fillStyle = '#FFFFFF';
      ctx.globalAlpha = 0.5 + Math.sin(tt + i) * 0.5;
      ctx.beginPath();
      ctx.arc(sx, sy, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawPodium(ctx, cx, cy, w, h, plat, t) {
    // circular stage — like the mic base in the KV
    const baseY = cy + h;
    // bottom ellipse (depth band)
    ctx.fillStyle = '#0E2A78';
    ctx.beginPath();
    ctx.ellipse(cx, baseY, w * 0.55, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    // side band
    ctx.fillStyle = '#1A4DA8';
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.55, cy + 8);
    ctx.lineTo(cx + w * 0.55, cy + 8);
    ctx.lineTo(cx + w * 0.55, baseY);
    ctx.lineTo(cx - w * 0.55, baseY);
    ctx.closePath();
    // ah, use ellipse-clipped
    ctx.beginPath();
    ctx.ellipse(cx, baseY - 8, w * 0.55, 16, 0, 0, Math.PI, false);
    ctx.lineTo(cx + w * 0.55, baseY);
    ctx.ellipse(cx, baseY, w * 0.55, 16, 0, 0, Math.PI, true);
    ctx.lineTo(cx - w * 0.55, baseY - 8);
    ctx.fill();
    // top ring (cyan band)
    ctx.fillStyle = withAlpha(t.accent, 0.85);
    ctx.beginPath();
    ctx.ellipse(cx, cy + 4, w * 0.55, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    // top inset
    ctx.fillStyle = '#0A1838';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 2, w * 0.5, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    // top glow surface
    const tg = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.5);
    tg.addColorStop(0, withAlpha(t.accent, 0.7));
    tg.addColorStop(1, withAlpha(t.accent, 0));
    ctx.fillStyle = tg;
    ctx.beginPath();
    ctx.ellipse(cx, cy, w * 0.5, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    // gold accent rim
    ctx.strokeStyle = withAlpha(t.gold, 0.7);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 4, w * 0.55, 14, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawSpeaker(ctx, cx, cy, w, h, plat, t) {
    // subwoofer — round black with cyan rim
    const baseY = cy + h;
    // base shadow
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.ellipse(cx, baseY, w * 0.5, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    // body rect
    ctx.fillStyle = '#0A1024';
    ctx.fillRect(cx - w * 0.48, cy + 4, w * 0.96, h - 4);
    // body side
    ctx.fillStyle = '#161D38';
    ctx.beginPath();
    ctx.moveTo(cx + w * 0.48, cy + 4);
    ctx.lineTo(cx + w * 0.48 + 10, cy + 12);
    ctx.lineTo(cx + w * 0.48 + 10, baseY);
    ctx.lineTo(cx + w * 0.48, baseY);
    ctx.closePath();
    ctx.fill();
    // cone
    const coneR = Math.min(w * 0.36, h * 0.55);
    ctx.fillStyle = '#1A1F30';
    ctx.beginPath();
    ctx.arc(cx, cy + h * 0.55, coneR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0A0D18';
    ctx.beginPath();
    ctx.arc(cx, cy + h * 0.55, coneR * 0.7, 0, Math.PI * 2);
    ctx.fill();
    // cone center
    ctx.fillStyle = '#2A3252';
    ctx.beginPath();
    ctx.arc(cx, cy + h * 0.55, coneR * 0.25, 0, Math.PI * 2);
    ctx.fill();
    // pulse ring (audio reaction)
    const pulse = (Math.sin(frame * 0.08 + plat.shimmer) + 1) * 0.5;
    ctx.strokeStyle = withAlpha(t.accent, 0.4 + pulse * 0.4);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy + h * 0.55, coneR * (0.85 + pulse * 0.15), 0, Math.PI * 2);
    ctx.stroke();
    // top rim
    ctx.fillStyle = withAlpha(t.accent, 0.9);
    ctx.fillRect(cx - w * 0.48, cy, w * 0.96, 6);
    ctx.fillStyle = withAlpha(t.mint, 0.6);
    ctx.fillRect(cx - w * 0.48, cy + 1, w * 0.96, 2);
    // top surface inset
    ctx.fillStyle = '#0A1838';
    ctx.fillRect(cx - w * 0.45, cy + 6, w * 0.9, 4);
  }

  function drawVinyl(ctx, cx, cy, w, h, plat, t) {
    // vinyl record laying down, viewed at an angle
    const baseY = cy + h;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.ellipse(cx, baseY, w * 0.6, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    // side band (thickness)
    ctx.fillStyle = '#1A1A1A';
    ctx.beginPath();
    ctx.ellipse(cx, baseY - 10, w * 0.55, 18, 0, 0, Math.PI, false);
    ctx.lineTo(cx + w * 0.55, baseY);
    ctx.ellipse(cx, baseY, w * 0.55, 18, 0, 0, Math.PI, true);
    ctx.lineTo(cx - w * 0.55, baseY - 10);
    ctx.fill();
    // top disc
    ctx.fillStyle = '#0A0A0A';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 6, w * 0.55, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    // grooves
    const tt = frame * 0.02 + plat.shimmer;
    for (let r = 0.9; r > 0.25; r -= 0.12) {
      ctx.strokeStyle = `rgba(255,255,255,${0.05 + 0.05 * Math.sin(tt + r * 10)})`;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 6, w * 0.55 * r, 18 * r, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    // label (red gold KV-style)
    const labelGrad = ctx.createLinearGradient(cx - w * 0.2, cy, cx + w * 0.2, cy + 16);
    labelGrad.addColorStop(0, '#FF6B9D');
    labelGrad.addColorStop(0.5, t.gold);
    labelGrad.addColorStop(1, '#FF8E3C');
    ctx.fillStyle = labelGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 6, w * 0.2, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    // center hole
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 6, 2, 1, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── FINAL BLOCK (goal at score 15) ────────────────────────────────────────
  function drawFinalBlock(ctx, cx, cy, w, h, plat, t) {
    if (finalStyle === 'throne') drawThroneFinal(ctx, cx, cy, w, h, plat, t);
    else drawTrophyFinal(ctx, cx, cy, w, h, plat, t);
  }

  // Style A: Golden Mic Trophy Podium — spotlights only, no mascot statue
  function drawTrophyFinal(ctx, cx, cy, w, h, plat, t) {
    const baseY = cy + h;
    const tt = frame * 0.04 + plat.shimmer;
    const pulse = (Math.sin(tt * 2.2) + 1) * 0.5;

    // ── Spotlight beams from ABOVE THE STAGE down to the platform ─────────
    // Beams must start above the visible canvas and reach down to the floor
    const beamTopY = -180;
    const beamLen = (baseY + 20) - beamTopY;
    const beamCfg = [
      { x: cx - 60, angle: -0.05, color: '#FFE873', alpha: 0.42 },
      { x: cx,      angle:  0,    color: '#FFD93D', alpha: 0.55 },
      { x: cx + 60, angle:  0.05, color: '#FFE873', alpha: 0.42 },
    ];

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.filter = 'blur(10px)';
    for (const b of beamCfg) {
      ctx.save();
      ctx.translate(b.x, beamTopY);
      ctx.rotate(b.angle);
      const g = ctx.createLinearGradient(0, 0, 0, beamLen);
      g.addColorStop(0, withAlpha(b.color, 0));
      g.addColorStop(0.15, withAlpha(b.color, b.alpha * 0.25));
      g.addColorStop(0.8, withAlpha(b.color, b.alpha));
      g.addColorStop(1, withAlpha(b.color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-12, 0);
      ctx.lineTo(12, 0);
      ctx.lineTo(125, beamLen);
      ctx.lineTo(-125, beamLen);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.filter = 'none';
    ctx.restore();

    // ── Hot spot ellipse on top of podium ────────────────────────────────
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const hot = ctx.createRadialGradient(cx, cy + 4, 4, cx, cy + 4, w * 0.7);
    hot.addColorStop(0, 'rgba(255,255,255,0.65)');
    hot.addColorStop(0.35, 'rgba(255,232,115,0.42)');
    hot.addColorStop(1, 'rgba(255,217,61,0)');
    ctx.fillStyle = hot;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 4, w * 0.7, 30, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // ── Ground glow ring (pulsing) ─────────────────────────────────────────
    for (let r = 0; r < 4; r++) {
      const rad = w * 0.6 + r * 18 + pulse * 12;
      ctx.strokeStyle = `rgba(255,217,61,${0.35 - r * 0.07})`;
      ctx.lineWidth = 2.5 - r * 0.4;
      ctx.beginPath();
      ctx.ellipse(cx, baseY + 8, rad, 14 + r * 3, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // ── Podium body (large gold-tinted) ────────────────────────────────────
    ctx.fillStyle = '#2A1A05';
    ctx.beginPath();
    ctx.ellipse(cx, baseY, w * 0.6, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    const sideGrad = ctx.createLinearGradient(0, cy, 0, baseY);
    sideGrad.addColorStop(0, '#5C3A0F');
    sideGrad.addColorStop(1, '#1A0E03');
    ctx.fillStyle = sideGrad;
    ctx.beginPath();
    ctx.ellipse(cx, baseY - 12, w * 0.6, 18, 0, 0, Math.PI, false);
    ctx.lineTo(cx + w * 0.6, baseY);
    ctx.ellipse(cx, baseY, w * 0.6, 18, 0, 0, Math.PI, true);
    ctx.lineTo(cx - w * 0.6, baseY - 12);
    ctx.fill();

    // gold rim
    ctx.fillStyle = '#FFD93D';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 8, w * 0.6, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    const topInner = ctx.createRadialGradient(cx, cy, 4, cx, cy, w * 0.5);
    topInner.addColorStop(0, '#FFE873');
    topInner.addColorStop(0.5, '#FFD93D');
    topInner.addColorStop(1, '#3A2400');
    ctx.fillStyle = topInner;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 4, w * 0.52, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    // emblem
    ctx.fillStyle = '#1A0E03';
    ctx.font = 'bold 18px "Bagel Fat One", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★', cx, cy + 4);
    // outer rim
    ctx.strokeStyle = '#FFE873';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 8, w * 0.6, 18, 0, 0, Math.PI * 2);
    ctx.stroke();

    // small floating sparkles in the beam area
    for (let i = 0; i < 6; i++) {
      const ang = tt * 0.5 + (i / 6) * Math.PI * 2;
      const sx = cx + Math.cos(ang) * (w * 0.35);
      const sy = cy - 40 + Math.sin(ang * 1.3) * 35;
      const sz = 1.4 + Math.sin(tt + i) * 0.8;
      ctx.fillStyle = 'rgba(255,232,115,0.85)';
      ctx.beginPath();
      ctx.arc(sx, sy, sz, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Style C: Crystal Spotlight Throne — 2 pillars + spotlights from above, no mascot
  function drawThroneFinal(ctx, cx, cy, w, h, plat, t) {
    const baseY = cy + h;
    const tt = frame * 0.04 + plat.shimmer;
    const pulse = (Math.sin(tt * 2.2) + 1) * 0.5;
    const pillarOffset = w * 0.55;
    const pillarTopY = cy - 160;
    const pillarBaseY = baseY;

    // ── 2 spotlight beams from ABOVE THE STAGE down to the platform ───────
    const beamTopY = -180;
    const beamLen = (baseY + 20) - beamTopY;
    const beamCfg = [
      { x: cx - 45, angle: -0.04, color: '#5BEEFF', alpha: 0.4 },
      { x: cx + 45, angle:  0.04, color: '#FFE873', alpha: 0.42 },
    ];
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.filter = 'blur(10px)';
    for (const b of beamCfg) {
      ctx.save();
      ctx.translate(b.x, beamTopY);
      ctx.rotate(b.angle);
      const g = ctx.createLinearGradient(0, 0, 0, beamLen);
      g.addColorStop(0, withAlpha(b.color, 0));
      g.addColorStop(0.15, withAlpha(b.color, b.alpha * 0.25));
      g.addColorStop(0.8, withAlpha(b.color, b.alpha));
      g.addColorStop(1, withAlpha(b.color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-10, 0);
      ctx.lineTo(10, 0);
      ctx.lineTo(105, beamLen);
      ctx.lineTo(-105, beamLen);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.filter = 'none';
    ctx.restore();

    // Hot spots on top of podium where beams converge
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const hot = ctx.createRadialGradient(cx, cy + 4, 4, cx, cy + 4, w * 0.65);
    hot.addColorStop(0, 'rgba(255,255,255,0.55)');
    hot.addColorStop(0.4, 'rgba(91,238,255,0.35)');
    hot.addColorStop(1, 'rgba(0,229,255,0)');
    ctx.fillStyle = hot;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 4, w * 0.65, 28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // ── Ground shadow + ring ──────────────────────────────────────────────
    ctx.fillStyle = 'rgba(2,8,28,0.7)';
    ctx.beginPath();
    ctx.ellipse(cx, baseY + 4, w * 0.7, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    for (let r = 0; r < 3; r++) {
      const rad = w * 0.55 + r * 16 + pulse * 10;
      ctx.strokeStyle = `rgba(91,238,255,${0.3 - r * 0.07})`;
      ctx.lineWidth = 2 - r * 0.3;
      ctx.beginPath();
      ctx.ellipse(cx, baseY + 8, rad, 12 + r * 3, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // ── Carpet hint (red glow strip in front) ──────────────────────────────
    const carpGrad = ctx.createLinearGradient(cx - w * 0.35, baseY + 14, cx + w * 0.35, baseY + 14);
    carpGrad.addColorStop(0, 'rgba(255,107,157,0)');
    carpGrad.addColorStop(0.5, 'rgba(255,107,157,0.5)');
    carpGrad.addColorStop(1, 'rgba(255,107,157,0)');
    ctx.fillStyle = carpGrad;
    ctx.fillRect(cx - w * 0.5, baseY + 10, w, 6);

    // ── Left & Right crystal pillars ───────────────────────────────────────
    const drawPillar = (px) => {
      ctx.fillStyle = 'rgba(2,8,28,0.6)';
      ctx.beginPath();
      ctx.ellipse(px, pillarBaseY + 2, 26, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      const pg = ctx.createLinearGradient(px - 20, pillarTopY, px + 20, pillarBaseY);
      pg.addColorStop(0, '#5BEEFF');
      pg.addColorStop(0.4, '#2A78D6');
      pg.addColorStop(1, '#0A1838');
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.moveTo(px - 22, pillarBaseY);
      ctx.lineTo(px - 16, pillarTopY + 30);
      ctx.lineTo(px - 4, pillarTopY + 10);
      ctx.lineTo(px, pillarTopY);
      ctx.lineTo(px + 8, pillarTopY + 14);
      ctx.lineTo(px + 18, pillarTopY + 36);
      ctx.lineTo(px + 22, pillarBaseY);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(128,255,220,0.95)';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = '#80FFDC';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(px - 16, pillarTopY + 30);
      ctx.lineTo(px - 4, pillarTopY + 10);
      ctx.lineTo(px, pillarTopY);
      ctx.lineTo(px + 8, pillarTopY + 14);
      ctx.lineTo(px + 18, pillarTopY + 36);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#FFD93D';
      ctx.beginPath();
      ctx.arc(px, pillarTopY - 4, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFE873';
      ctx.beginPath();
      ctx.arc(px - 1.5, pillarTopY - 5.5, 2.2, 0, Math.PI * 2);
      ctx.fill();
    };
    drawPillar(cx - pillarOffset);
    drawPillar(cx + pillarOffset);

    // ── Central podium ───────────────────────────────────────────────────
    const podiumW = w * 0.7;
    ctx.fillStyle = '#1A0E03';
    ctx.beginPath();
    ctx.ellipse(cx, baseY, podiumW * 0.55, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3A2400';
    ctx.beginPath();
    ctx.ellipse(cx, baseY - 10, podiumW * 0.55, 14, 0, 0, Math.PI, false);
    ctx.lineTo(cx + podiumW * 0.55, baseY);
    ctx.ellipse(cx, baseY, podiumW * 0.55, 14, 0, 0, Math.PI, true);
    ctx.lineTo(cx - podiumW * 0.55, baseY - 10);
    ctx.fill();
    ctx.fillStyle = '#FFD93D';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 4, podiumW * 0.55, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    const cyaninset = ctx.createRadialGradient(cx, cy + 2, 4, cx, cy + 2, podiumW * 0.45);
    cyaninset.addColorStop(0, '#5BEEFF');
    cyaninset.addColorStop(0.6, '#0E2A78');
    cyaninset.addColorStop(1, '#020618');
    ctx.fillStyle = cyaninset;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 2, podiumW * 0.5, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFE873';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 4, podiumW * 0.55, 14, 0, 0, Math.PI * 2);
    ctx.stroke();
    // star emblem on top
    ctx.fillStyle = '#FFE873';
    ctx.font = 'bold 16px "Bagel Fat One", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★', cx, cy + 4);

    // sparkles between pillars
    for (let i = 0; i < 5; i++) {
      const ang = tt * 0.5 + (i / 5) * Math.PI * 2;
      const sx = cx + Math.cos(ang) * (w * 0.3);
      const sy = cy - 60 + Math.sin(ang * 1.2) * 40;
      const sz = 1.5 + Math.sin(tt + i) * 0.8;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,232,115,0.85)' : 'rgba(128,255,220,0.85)';
      ctx.beginPath();
      ctx.arc(sx, sy, sz, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Player ─────────────────────────────────────────────────────────────────
  function drawPlayer(ctx, p, t) {
    if (!assets.mascot) return;
    const img = assets.mascot;
    const targetH = 110;
    const ratio = img.naturalWidth / img.naturalHeight;
    let w = targetH * ratio;
    let h = targetH;
    const squashAmt = p.squash * 0.32;
    const drawH = h * (1 - squashAmt);
    const drawW = w * (1 + squashAmt * 0.4);

    ctx.save();
    // shadow ellipse
    const shadowR = w * 0.35 * (1 + squashAmt * 0.3);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 4, shadowR, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // glow halo on charge
    if (p.charging && p.power > 0) {
      const glowR = drawW * 0.5 + p.power * 0.4;
      const gr = ctx.createRadialGradient(p.x, p.y - drawH * 0.5, drawW * 0.3, p.x, p.y - drawH * 0.5, glowR);
      gr.addColorStop(0, withAlpha(p.power > 70 ? t.gold : t.accent, 0.45));
      gr.addColorStop(1, withAlpha(p.power > 70 ? t.gold : t.accent, 0));
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(p.x, p.y - drawH * 0.5, glowR, 0, Math.PI * 2);
      ctx.fill();
    }

    // rotation in air
    ctx.translate(p.x, p.y - drawH * 0.5);
    if (p.airborne) {
      ctx.rotate(Math.sin(frame * 0.05) * 0.08 + p.vx * 0.012);
    } else {
      ctx.rotate(Math.sin(frame * 0.035) * 0.04);
    }
    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();
  }

  function drawChargeRing(ctx, p, t) {
    const cx = p.x - camera.x;
    const cy = p.y - 75;
    const w = 100;
    const filled = p.power / MAX_POWER;
    // bg
    ctx.fillStyle = 'rgba(5,11,31,0.7)';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(cx - w / 2, cy, w, 10, 5) : ctx.rect(cx - w / 2, cy, w, 10);
    ctx.fill();
    // fill
    const c = p.power < 40 ? t.mint : p.power < 75 ? t.accent : t.gold;
    ctx.fillStyle = c;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(cx - w / 2 + 2, cy + 2, (w - 4) * filled, 6, 3);
    else ctx.rect(cx - w / 2 + 2, cy + 2, (w - 4) * filled, 6);
    ctx.fill();
    // zone marks
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    [0.4, 0.75].forEach((m) => {
      ctx.beginPath();
      ctx.moveTo(cx - w / 2 + w * m, cy);
      ctx.lineTo(cx - w / 2 + w * m, cy + 10);
      ctx.stroke();
    });
  }

  // ── helpers ────────────────────────────────────────────────────────────────
  function withAlpha(hex, a) {
    if (hex.startsWith('rgba')) return hex;
    const h = hex.replace('#', '');
    const r = parseInt(h.substr(0, 2), 16);
    const g = parseInt(h.substr(2, 2), 16);
    const b = parseInt(h.substr(4, 2), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  return {
    init,
    start,
    reset,
    gameOver,
    chargeStart,
    chargeRelease,
    launchWithPower,
    update,
    render,
    resize,
    get state() { return state; },
    set state(v) { state = v; },
    get score() { return score; },
    get best() { return best; },
    get player() { return player; },
    get sessionScores() { return sessionScores; },
    setTheme(name) { if (THEMES[name]) theme = name; },
    get theme() { return theme; },
    setFinalStyle(s) { if (s === 'trophy' || s === 'throne') finalStyle = s; },
    get finalStyle() { return finalStyle; },
    get platforms() { return platforms; },
    // jump player onto platform id N (without auto-winning)
    fastForward(toId) {
      if (!player) return;
      // build out platforms up to toId+2
      while (platforms[platforms.length - 1].id < toId + 2) {
        const last = platforms[platforms.length - 1];
        if (last.id >= FINAL_BLOCK_AT) break;
        platforms.push(createPlatform(last.id + 1, last.x + nextPlatformGap(), pickType(last.id + 1)));
      }
      const target = platforms.find(p => p.id === toId);
      if (!target) return;
      player.x = target.x;
      player.y = target.surfaceY;
      player.vx = 0;
      player.vy = 0;
      player.airborne = false;
      player.lastPlatId = toId;
      score = toId;
      camera.x = player.x - W.width * 0.35;
      camera.targetX = camera.x;
    },
    _fakeWin() {
      // force a win state for the Tweaks "Congrats" demo button
      score = 15;
      win();
    },
    THEMES,
    canvas: null,
    ctx: null,
    callbacks: {},
  };
})();
