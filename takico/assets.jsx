/* ĐI CÙNG TAKICO — load asset pack manifest + white-background knockout */

(function () {
  const norm = (p) => encodeURI(p.normalize('NFD'));

  function flatAssets(manifest) {
    const a = manifest.assets;
    const props = a.props || {};
    return {
      logo: a.logo,
      mascot: a.mascotFront,
      mascotSide: a.mascotSide,
      idleBg: a.idleBackground,
      glb: a.characterGlb,
      kv26: a.keyvisual,
      stageBgs: a.stageBackgrounds || [],
      sceneBg: a.stageBackgrounds?.[0],
      sceneBg2: a.stageBackgrounds?.[1],
      sceneBg3: a.stageBackgrounds?.[2],
      sceneBg5: a.stageBackgrounds?.[3],
      sceneBg6: a.stageBackgrounds?.[4],
      police: norm(props.police),
      light: norm(props.trafficLight),
      dealer: norm(props.dealer),
    };
  }

  function knockoutWhite(url, thr) {
    thr = thr || 236;
    return new Promise((res) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        let d;
        try { d = ctx.getImageData(0, 0, c.width, c.height); }
        catch (e) { res(url); return; }
        const px = d.data, W = c.width, H = c.height;
        const seen = new Uint8Array(W * H);
        const stack = [];
        const isWhite = (i) => px[i] >= thr && px[i + 1] >= thr && px[i + 2] >= thr;
        function push(x, y) {
          if (x < 0 || y < 0 || x >= W || y >= H) return;
          const p = y * W + x;
          if (seen[p]) return;
          seen[p] = 1;
          const i = p * 4;
          if (isWhite(i)) { px[i + 3] = 0; stack.push(x, y); }
        }
        for (let x = 0; x < W; x++) { push(x, 0); push(x, H - 1); }
        for (let y = 0; y < H; y++) { push(0, y); push(W - 1, y); }
        while (stack.length) {
          const y = stack.pop(), x = stack.pop();
          push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
        }
        ctx.putImageData(d, 0, 0);
        res(c.toDataURL('image/png'));
      };
      img.onerror = () => res(url);
      img.src = url;
    });
  }

  function useKnockout(url, thr) {
    const [out, setOut] = React.useState(url);
    React.useEffect(() => {
      let on = true;
      knockoutWhite(url, thr).then((u) => { if (on) setOut(u); });
      return () => { on = false; };
    }, [url, thr]);
    return out;
  }

  window.TAK = {
    ready: false,
    packId: null,
    manifest: null,
    GAME: { totalStages: 5, totalLives: 3, timeLimitSec: 60 },
    A: {},
    norm,
    knockoutWhite,
    useKnockout,
  };

  async function init() {
    const packId = window.TAKICO_PACK || 'honda-2026';
    const url = `assets/packs/${packId}/manifest.json`;
    let manifest;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(res.statusText);
      manifest = await res.json();
    } catch (e) {
      console.error('[TAK] manifest load failed:', url, e);
      manifest = {
        id: packId,
        game: { totalStages: 5, totalLives: 3, timeLimitSec: 60 },
        assets: {
          logo: 'assets/logo-takico.png',
          mascotFront: 'assets/mascot-ride.png',
          mascotSide: 'assets/mascot-ride-side.png',
          idleBackground: 'assets/idle-screen.jpg',
          characterGlb: 'assets/character.glb',
          keyvisual: 'assets/keyvisual-26.png',
          stageBackgrounds: [
            'assets/scene-bg.png',
            'assets/scene-bg2.png',
            'assets/scene-bg3.png',
            'assets/scene-bg5.png',
            'assets/scene-bg6.png',
          ],
          props: {
            police: 'raw/Chú công an.png',
            trafficLight: 'raw/Đèn giao thông.png',
            dealer: 'raw/Đại lí Takico.jpg',
          },
        },
      };
    }
    window.TAK.packId = manifest.id || packId;
    window.TAK.manifest = manifest;
    window.TAK.GAME = { ...window.TAK.GAME, ...manifest.game };
    window.TAK.A = flatAssets(manifest);
    window.TAK.ready = true;
    window.dispatchEvent(new Event('tak-ready'));
  }

  init();
})();
