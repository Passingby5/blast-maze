// Busy-scene frame timing: 4 robots, many bombs with big blasts, and sudden death drops, at 390x844 DPR 3. Reports p99 frame time.
const { chromium } = require('playwright-core'), fs = require('fs'), path = require('path'), assert = require('assert');
(async () => {
  const exe = ['/usr/bin/google-chrome', '/usr/bin/chromium'].find(f => fs.existsSync(f));
  const b = await chromium.launch(exe ? { executablePath: exe, args: ['--no-sandbox'] } : {}); const out = {};
  for (const scene of ['stress', 'suddendeath']) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }), p = await ctx.newPage();
    await p.goto('file://' + path.join(__dirname, '../site/index.html')); await p.waitForTimeout(300); await p.tap('[data-act=battle]'); await p.waitForTimeout(400); await p.tap('[data-act=cpus][data-v="3"]'); await p.waitForTimeout(400); await p.tap('[data-act=startBattle]'); await p.waitForTimeout(800);
    const r = await p.evaluate(scene => new Promise(res => { const g = BM.UI.game(); g.players.forEach(q => { q.inv = 1e9; q.bombs = 8; q.range = 8; });
      if (scene === 'suddendeath') g.timeLeft = BM.Engine.SHRINK_AT + 1; const T = [], t0 = performance.now(); let last = t0;
      const iv = setInterval(() => { if (scene === 'stress') g.players.forEach(q => BM.Engine.placeBomb(g, q)); }, 250);
      (function f(t) { T.push(t - last); last = t; if (t - t0 < 5000) requestAnimationFrame(f); else { clearInterval(iv); T.shift(); T.sort((a, b) => a - b); res({ frames: T.length, avg: +(T.reduce((a, b) => a + b, 0) / T.length).toFixed(2), p99: +T[Math.floor(T.length * 0.99)].toFixed(1), over33: T.filter(x => x > 33).length }); } })(performance.now()); }), scene);
    out[scene] = r; console.log(scene, JSON.stringify(r)); await ctx.close();
  }
  await b.close(); for (const k in out) assert(out[k].p99 < 25 && out[k].avg < 18, k + ' too slow'); console.log('ok perf p99 under 25 ms');
})().catch(e => { console.error(e); process.exit(1); });
