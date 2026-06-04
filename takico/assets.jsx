/* ĐI CÙNG TAKICO — asset URLs + white-background knockout (runtime) */
(function () {
  // raw/ files have NFD-decomposed Vietnamese names → decompose at runtime so the URL matches disk
  const norm = (p) => encodeURI(p.normalize('NFD'));

  const A = {
    logo:   'assets/logo-takico.png',
    mascot: 'assets/mascot-ride.png',
    mascotSide: 'assets/mascot-ride-side.png',
    idleBg: 'assets/idle-screen.jpg',
    sceneBg: 'assets/scene-bg.png',
    sceneBg2: 'assets/scene-bg2.png',
    sceneBg3: 'assets/scene-bg3.png',
    sceneBg5: 'assets/scene-bg5.png',
    sceneBg6: 'assets/scene-bg6.png',
    kv26:   'assets/keyvisual-26.png',
    glb:    'assets/character.glb',
    police: norm('raw/Chú công an.png'),
    light:  norm('raw/Đèn giao thông.png'),
    dealer: norm('raw/Đại lí Takico.jpg'),
  };

  // Flood-fill near-white background → transparent (preserves interior whites)
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

  // React hook: returns original url, then swaps to knocked-out version when ready
  function useKnockout(url, thr) {
    const [out, setOut] = React.useState(url);
    React.useEffect(() => {
      let on = true;
      knockoutWhite(url, thr).then((u) => { if (on) setOut(u); });
      return () => { on = false; };
    }, [url, thr]);
    return out;
  }

  window.TAK = { A, norm, knockoutWhite, useKnockout };
})();
