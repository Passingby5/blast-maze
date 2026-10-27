// Draws the app icons in a headless browser with the game's own renderer (no outside art). Run once: node tools/icons.js
const { chromium } = require('playwright-core'), fs = require('fs'), path = require('path');
(async () => {
  const exe = ['/usr/bin/google-chrome', '/usr/bin/chromium'].find(f => fs.existsSync(f));
  const b = await chromium.launch(exe ? { executablePath: exe, args: ['--no-sandbox'] } : {}), p = await b.newPage();
  const src = ['engine.js', 'render.js'].map(f => fs.readFileSync(path.join(__dirname, '../src', f), 'utf8')).join('\n');
  await p.setContent('<canvas id=c></canvas><script>' + src + '</script>');
  fs.mkdirSync(path.join(__dirname, '../src/icons'), { recursive: true });
  for (const [n, s, pad] of [['icon-192', 192, 0.1], ['icon-512', 512, 0.1], ['maskable-192', 192, 0.22], ['maskable-512', 512, 0.22], ['apple-touch-icon', 180, 0.12]]) {
    const url = await p.evaluate(([s, pad]) => { const c = document.getElementById('c'); c.width = c.height = s; const x = c.getContext('2d'); const g = x.createRadialGradient(s / 2, s * 0.3, 0, s / 2, s / 2, s * 0.75); g.addColorStop(0, '#3a56c0'); g.addColorStop(1, '#141c40'); x.fillStyle = g; x.fillRect(0, 0, s, s);
      const t = document.createElement('canvas'); window.devicePixelRatio = 1; BM.Render.drawIcon(t, 'robot', Math.round(s * (1 - pad * 2))); x.drawImage(t, s * pad, s * pad * 1.1); return c.toDataURL('image/png'); }, [s, pad]);
    fs.writeFileSync(path.join(__dirname, '../src/icons', n + '.png'), Buffer.from(url.split(',')[1], 'base64'));
  }
  await b.close(); console.log('icons done');
})();
