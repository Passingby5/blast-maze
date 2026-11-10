// Late-level hunters screenshot (L20 Swarm).
const { chromium } = require('playwright-core'), fs = require('fs');
(async () => {
  const exe = ['/usr/bin/google-chrome', '/usr/bin/chromium'].find(f => fs.existsSync(f));
  const b = await chromium.launch(exe ? { executablePath: exe, args: ['--no-sandbox'] } : {});
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(); const errs = [];
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + __dirname + '/../site/index.html'); await p.waitForTimeout(300);
  await p.evaluate(() => {
    localStorage.setItem('blastmaze_save', JSON.stringify({
      v: 2, best: 0, settings: { muted: true, difficulty: 'hard', calm: true },
      story: { level: 19, difficulty: 'hard', attempt: 1, carry: { bombs: 5, range: 4, speedUps: 3, kick: true, shield: 1, lives: 3, score: 14000 } }
    }));
  });
  await p.reload(); await p.waitForTimeout(400);
  await p.tap('#btnContinue'); await p.waitForTimeout(2400);
  await p.evaluate(() => {
    const g = BM.UI.game(), E = BM.Engine, q = g.players[0];
    q.inv = 1e9; q.x = q.tx = 5; q.y = q.ty = 5;
    // Nudge a couple of chasers into view near the player
    const ch = g.enemies.filter(e => e.type === 'chaser' && e.alive);
    [[7, 5], [5, 7], [3, 5]].forEach((c, i) => { if (ch[i]) { ch[i].x = ch[i].tx = c[0]; ch[i].y = ch[i].ty = c[1]; ch[i].speed = 0.4; } });
  });
  await p.waitForTimeout(500);
  await p.screenshot({ path: process.argv[2] || 'shots/11-hunters-l20.jpg', type: 'jpeg', quality: 88 });
  console.log('hunter shot', errs.length ? errs : 'no console errors');
  await b.close(); if (errs.length) process.exit(1);
})();
