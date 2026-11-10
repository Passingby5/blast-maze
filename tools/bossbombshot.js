// Boss bomb vs player bomb screenshot on Mid Bolt (L17).
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
      story: { level: 16, difficulty: 'hard', attempt: 1, carry: { bombs: 4, range: 3, speedUps: 2, kick: true, shield: 1, lives: 3, score: 9000 } }
    }));
  });
  await p.reload(); await p.waitForTimeout(400);
  await p.tap('#btnContinue'); await p.waitForTimeout(2200);
  await p.evaluate(() => {
    const g = BM.UI.game(), E = BM.Engine, boss = g.enemies.find(e => e.type === 'boss'), q = g.players[0];
    for (let y = 1; y < E.H - 1; y++) for (let x = 1; x < E.W - 1; x++) if (g.map[y][x] === E.CRATE) g.map[y][x] = E.FLOOR;
    g.enemies.forEach(e => { if (e !== boss) e.alive = false; });
    boss.speed = 0.0001; boss.bombCD = 0; boss.x = boss.tx = 9; boss.y = boss.ty = 7;
    q.inv = 1e9; q.x = q.tx = 5; q.y = q.ty = 7; q.bombs = 4;
    E.placeBomb(g, q);
    q.x = q.tx = 7; q.y = q.ty = 7;
    E.placeBossBomb(g, boss);
    // Keep both bombs mid-fuse for the photo
    g.bombs.forEach(b => { b.timer = b.fromBoss ? 1.5 : 2.15; });
  });
  await p.waitForTimeout(400);
  await p.screenshot({ path: process.argv[2] || 'shots/10-boss-bombs.jpg', type: 'jpeg', quality: 88 });
  console.log('bossbomb shot', errs.length ? errs : 'no console errors');
  await b.close(); if (errs.length) process.exit(1);
})();
