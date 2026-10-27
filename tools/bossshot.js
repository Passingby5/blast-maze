// Boss screenshot: loads a save at the first boss level (index 5), continues, and captures the arena. Usage: node tools/bossshot.js out.jpg [zoom.png]
const { chromium } = require('playwright-core'), fs = require('fs');
(async () => {
  const exe = ['/usr/bin/google-chrome', '/usr/bin/chromium'].find(f => fs.existsSync(f)); const b = await chromium.launch(exe ? { executablePath: exe, args: ['--no-sandbox'] } : {});
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }), p = await ctx.newPage(); const errs = [];
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); }); p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + __dirname + '/../site/index.html'); await p.waitForTimeout(300);
  await p.evaluate(() => { localStorage.setItem('blastmaze_save', JSON.stringify({ v: 2, best: 0, settings: { muted: true, difficulty: 'easy' }, story: { level: 5, difficulty: 'easy', attempt: 0, carry: { bombs: 3, range: 3, speedUps: 1, kick: false, shield: 0, lives: 3, score: 1200 } } })); }); await p.reload(); await p.waitForTimeout(400);
  await p.tap('#btnContinue'); await p.waitForTimeout(2600);
  await p.evaluate(() => { const g = BM.UI.game(), boss = g.enemies.find(e => e.type === 'boss'), q = g.players[0]; q.inv = 1e9; const E = BM.Engine; let best = null; for (let y = 1; y < E.H - 1; y++) for (let x = 1; x < E.W - 1; x++) { const d = Math.abs(x - boss.tx) + Math.abs(y - boss.ty); if (g.map[y][x] === E.FLOOR && d >= 2 && d <= 3 && !best) best = [x, y]; } if (best) { q.x = q.tx = best[0]; q.y = q.ty = best[1]; } boss.x = boss.tx; boss.y = boss.ty; boss.speed = 0.0001; g.enemies.forEach(e => { if (e.type !== 'boss') { e.speed = 0.0001; } }); BM.Engine.placeBomb(g, q); });
  await p.waitForTimeout(500); await p.evaluate(() => { BM.UI.game().players[0].inv = 0; });
  await p.waitForTimeout(400); await p.screenshot({ path: process.argv[2] || 'shots/6-boss.jpg', type: 'jpeg', quality: 85 });
  if (process.argv[3]) { const r = await p.evaluate(() => { const c = document.getElementById('cv').getBoundingClientRect(); return { x: c.x, y: c.y, w: c.width, h: c.height }; }); await p.screenshot({ path: process.argv[3], clip: { x: r.x + r.w - 200, y: r.y + r.h - 200, width: 200, height: 200 } }); }
  console.log('boss shot', errs.length ? errs : 'no console errors'); await b.close(); if (errs.length) process.exit(1);
})();
