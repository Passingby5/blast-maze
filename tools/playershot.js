// Player close-up: battle start, player drops an energy orb bomb; crops the top-left corner at DPR 3. Usage: node tools/playershot.js out.jpg
const { chromium } = require('playwright-core'), fs = require('fs');
(async () => {
  const exe = ['/usr/bin/google-chrome', '/usr/bin/chromium'].find(f => fs.existsSync(f)); const b = await chromium.launch(exe ? { executablePath: exe, args: ['--no-sandbox'] } : {});
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }), p = await ctx.newPage(); const errs = [];
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); }); p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + __dirname + '/../site/index.html'); await p.waitForTimeout(300);
  await p.tap('[data-act=story]'); await p.waitForTimeout(2300);
  await p.evaluate(() => { const g = BM.UI.game(), q = g.players[0]; q.inv = 0; g.enemies.forEach(e => e.speed = 0.0001); BM.Engine.placeBomb(g, q); q.x = q.tx = 2; q.y = q.ty = 1; q.face = 'd'; g.map[1][2] = BM.Engine.FLOOR; });
  await p.waitForTimeout(1300);
  const r = await p.evaluate(() => { const c = document.getElementById('cv').getBoundingClientRect(); return { x: c.x, y: c.y }; });
  await p.screenshot({ path: process.argv[2] || 'shots/7-player-closeup.jpg', type: 'jpeg', quality: 90, clip: { x: r.x, y: r.y, width: 150, height: 120 } });
  console.log('player shot', errs.length ? errs : 'no console errors'); await b.close(); if (errs.length) process.exit(1);
})();
