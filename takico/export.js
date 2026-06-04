/* ĐI CÙNG TAKICO — Scene PNG exporter (runs in foreground)
   Composites the full DOM/SVG scene (via html-to-image) with each live
   WebGL model-viewer (via toDataURL) onto a 1920×1080 canvas, then
   downloads one PNG per scene to the user's machine. */
(function () {
  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = () => rej(new Error('load fail ' + src));
      document.head.appendChild(s);
    });
  }

  async function waitModels(root) {
    const mvs = [...root.querySelectorAll('model-viewer')];
    await Promise.all(mvs.map(mv => mv.loaded ? Promise.resolve()
      : new Promise(r => { mv.addEventListener('load', r, { once: true }); setTimeout(r, 10000); })));
    return mvs;
  }

  window.exportScenes = async function (opts) {
    opts = opts || {};
    const log = [];
    window.__exp = { phase: 'start', done: false, log };
    if (!window.htmlToImage) {
      await loadScript('https://unpkg.com/html-to-image@1.11.11/dist/html-to-image.js');
    }
    const kiosk = document.getElementById('kiosk');
    const navs = document.querySelectorAll('.dev-nav button');
    const dev = document.querySelector('.dev-nav');
    const scenes = [
      ['01-man-cho', 0], ['02-huong-dan', 1], ['03-man-choi', 2],
      ['04-man-thua', 3], ['05-man-thang', 4],
    ];
    const prevT = kiosk.style.transform;
    kiosk.style.transform = 'none';
    if (dev) dev.style.visibility = 'hidden';

    for (const [name, idx] of scenes) {
      window.__exp.phase = 'capturing ' + name;
      navs[idx].click();
      await new Promise(r => setTimeout(r, 500));
      const mvs = await waitModels(kiosk);
      await new Promise(r => setTimeout(r, 900)); // settle render

      let canvas;
      try {
        canvas = await window.htmlToImage.toCanvas(kiosk, {
          width: 1920, height: 1080, pixelRatio: opts.scale || 1.5, cacheBust: true,
        });
      } catch (e) { log.push(name + ' html-to-image ERR ' + e.message); continue; }

      const sx = canvas.width / 1920, sy = canvas.height / 1080;
      const ctx = canvas.getContext('2d');
      const kr = kiosk.getBoundingClientRect();
      for (const mv of mvs) {
        try {
          const url = mv.toDataURL('image/png');
          const img = new Image();
          await new Promise(r => { img.onload = r; img.onerror = r; img.src = url; });
          const r = mv.getBoundingClientRect();
          ctx.drawImage(img, (r.left - kr.left) * sx, (r.top - kr.top) * sy, r.width * sx, r.height * sy);
        } catch (e) { log.push(name + ' model ERR ' + e.message); }
      }

      const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'takico-' + name + '.png';
      document.body.appendChild(a); a.click(); a.remove();
      await new Promise(r => setTimeout(r, 900));
      log.push(name + ' OK ' + canvas.width + 'x' + canvas.height);
    }

    kiosk.style.transform = prevT;
    if (dev) dev.style.visibility = '';
    navs[0].click();
    window.__exp.phase = 'finished';
    window.__exp.done = true;
    return log.join(' | ');
  };
})();
