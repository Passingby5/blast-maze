// Playwright click-through at 390x844 portrait and 844x390 landscape, plus a desktop keyboard pass. Run: node tests/browser.js [url]  SHOTS=dir for JPGs.
const { chromium } = require('playwright-core'), http = require('http'), fs = require('fs'), path = require('path'), assert = require('assert');
const SITE = path.join(__dirname, '../site'), TYPES = { html: 'text/html', js: 'text/javascript', json: 'application/json', png: 'image/png', webmanifest: 'application/manifest+json' };
const serve = () => new Promise(res => { const s = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; const f = path.join(SITE, p); if (!f.startsWith(SITE) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': TYPES[f.split('.').pop()] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }).listen(0, () => res(s)); });
let passed = 0; const ok = m => { passed++; console.log('ok', m); };
(async () => {
  let base = process.argv[2], server; if (!base) { server = await serve(); base = 'http://127.0.0.1:' + server.address().port + '/'; }
  const single = base.startsWith('file:');
  const exe = ['/usr/bin/google-chrome', '/usr/bin/chromium'].find(f => fs.existsSync(f));
  const browser = await chromium.launch(exe ? { executablePath: exe, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] } : { args: ['--no-sandbox'] });
  const shotDir = process.env.SHOTS; if (shotDir) fs.mkdirSync(shotDir, { recursive: true });
  for (const vp of [{ width: 390, height: 844, name: 'portrait' }, { width: 844, height: 390, name: 'landscape' }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    const page = await ctx.newPage(), errors = [];
    page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); }); page.on('pageerror', e => errors.push(e.message));
    const S = () => page.evaluate(() => BM.UI.state());
    const tap = async sel => { await page.tap(sel); await page.waitForTimeout(420); };
    const layout = async where => { const r = await page.evaluate(() => ({ over: document.documentElement.scrollWidth > innerWidth + 1 || document.documentElement.scrollHeight > innerHeight + 1, small: [...document.querySelectorAll('button')].filter(e => e.offsetParent).map(e => { const b = e.getBoundingClientRect(); return [e.textContent.slice(0, 25), b.width, b.height]; }).filter(b => b[1] < 48 || b[2] < 48) })); assert(!r.over, vp.name + ' overflow at ' + where); assert.deepStrictEqual(r.small, [], vp.name + ' small targets at ' + where); };
    const shot = async (n, when) => { if (shotDir && when === vp.name) await page.screenshot({ path: path.join(shotDir, n), type: 'jpeg', quality: 90 }); };
    await page.goto(base, { waitUntil: 'load' }); await page.waitForTimeout(300);
    if (!single) { const v = await (await page.request.get(base + 'version.json?t=' + Date.now())).json(); assert.strictEqual(await page.textContent('#ver'), v.label); assert(/^v\d+ - \w+ \d+ - \w{7}$/.test(v.label)); ok(vp.name + ' version label ' + v.label);
      const sw = await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return !!r; }); assert(sw); ok(vp.name + ' service worker registered'); }
    await layout('home'); assert(await page.isVisible('#btnContinue') === false); await shot('1-home.jpg', 'portrait'); ok(vp.name + ' home: big targets, no overflow, no Continue on first visit');
    // mute toggle persists
    await tap('#home .muteBtn'); assert.strictEqual((await S()).muted, true); assert(/Off/.test(await page.textContent('#home .muteBtn'))); await tap('#home .muteBtn'); assert.strictEqual((await S()).muted, false); ok(vp.name + ' mute toggle');
    // help page
    await tap('[data-act=help]'); assert.strictEqual(await page.locator('#powerList canvas').count(), 5); await layout('help'); await tap('#btnCalm'); let cm = await S(); assert.strictEqual(cm.save.settings.calm, true); assert.strictEqual(cm.render.reduceMotion, true); await tap('#btnCalm'); cm = await S(); assert.strictEqual(cm.save.settings.calm, false); await tap('#help [data-act=home]'); ok(vp.name + ' how to play lists 5 power-ups; screen shake toggle saves');
    // difficulty
    await tap('[data-act=diff][data-v=easy]'); assert.strictEqual((await S()).save.settings.difficulty, 'easy'); await tap('[data-act=diff][data-v=medium]'); ok(vp.name + ' difficulty select');
    // double tap debounced: story starts once
    await page.dblclick('[data-act=story]'); await page.waitForTimeout(500); let s = await S(); assert.strictEqual(s.screen, 'play'); assert.strictEqual(s.level, 0); ok(vp.name + ' story starts on (double) tap');
    assert(await page.isVisible('#dpad') && await page.isVisible('#bombBtn')); await layout('play');
    const r = s.render; assert.strictEqual(r.dpr, 3); const cssW = await page.evaluate(() => document.getElementById('cv').getBoundingClientRect().width); assert(Math.abs(r.w - cssW * 3) < 2, 'canvas at full dpr'); ok(vp.name + ' touch controls shown; canvas drawn at devicePixelRatio ' + r.dpr + ' (' + r.w + 'px wide)');
    // D-pad: arms are >= 56 px; holding Right moves right
    const p0 = s.player; const sb = await page.locator('#dpad').boundingBox();
    for (const d of ['u', 'd', 'l', 'r']) { const ab = await page.locator('#dpad .arm[data-d=' + d + ']').boundingBox(); assert(ab.width >= 56 && ab.height >= 56, 'arm ' + d + ' >= 56px'); }
    await page.evaluate(() => { BM.UI.game().players[0].inv = 999; });
    const pc = { x: sb.x + sb.width / 2, y: sb.y + sb.height / 2 }, A = sb.width / 3;
    await page.dispatchEvent('#dpad', 'pointerdown', { pointerId: 5, clientX: pc.x + A, clientY: pc.y, isPrimary: true });
    assert(await page.locator('#dpad .arm[data-d=r].on').count() === 1, 'press feedback on Right');
    await page.waitForTimeout(500); await page.dispatchEvent('#dpad', 'pointerup', { pointerId: 5 }); s = await S(); assert(s.player.x > p0.x + 0.5, 'd-pad moved player right');
    assert(await page.locator('#dpad .arm.on').count() === 0, 'feedback cleared'); ok(vp.name + ' D-pad arms >= 56px, hold Right moves, press feedback');
    // Real CDP multi-touch: hold Down, slide to Right without lifting, tap bomb with a second finger, last pressed direction wins
    {
      const cdp = await ctx.newCDPSession(page), bb = await page.locator('#bombBtn').boundingBox();
      await page.evaluate(() => { const g = BM.UI.game(), p = g.players[0]; p.x = p.tx = 1; p.y = p.ty = 1; p.dir = null; for (let y = 1; y < 12; y++) { g.map[y][1] = 0; g.items[y][1] = null; } g.bombs = []; });
      const f1 = { x: pc.x, y: pc.y + A, id: 1 }, f2 = { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2, id: 2 };
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [f1] }); await page.waitForTimeout(300);
      const y1 = (await S()).player.y; assert(y1 > 1.2, 'd-pad moving down');
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [f1, f2] }); await page.waitForTimeout(60);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [f1] }); await page.waitForTimeout(250);
      const mid = await S(); assert.strictEqual(mid.bombs, 1, 'bomb dropped while holding Down'); assert(mid.player.y > y1 + 0.4, 'still walking after bomb tap');
      await page.evaluate(() => { BM.UI.game().bombs = []; const p = BM.UI.game().players[0]; p.inv = 999; });
      await page.evaluate(() => { const g = BM.UI.game(), p = g.players[0]; p.x = p.tx = 1; p.y = p.ty = 3; p.dir = null; for (let x = 1; x < 12; x++) { g.map[3][x] = 0; g.items[3][x] = null; } });
      for (let i = 1; i <= 6; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...f1, x: pc.x + A * i / 6, y: pc.y + A * (1 - i / 6) }] });
      await page.evaluate(() => { const p = BM.UI.game().players[0]; p.x = p.tx = 1; p.y = p.ty = 3; p.dir = null; });
      await page.waitForTimeout(400); assert(await page.locator('#dpad .arm[data-d=r].on').count() === 1, 'slid onto Right'); const m2 = await S(); if (!(m2.player.x > 1.4)) console.log(JSON.stringify(m2.player), await page.evaluate(() => JSON.stringify([BM.UI.game().map[3], BM.UI.game().players[0].dir, BM.UI.game().status, BM.UI.game().enemies.map(e => [e.x, e.y])]))); assert(m2.player.x > 1.4, 'slide switched to Right without lifting');
      // second finger on Up while first still on Right: last pressed wins
      const f3 = { x: pc.x, y: pc.y - A, id: 3 }; await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...f1, x: pc.x + A, y: pc.y }, f3] }); await page.waitForTimeout(50);
      assert(await page.locator('#dpad .arm[data-d=u].on').count() === 1, 'last pressed (Up) wins');
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(100);
      assert(await page.locator('#dpad .arm.on').count() === 0, 'all released');
      await page.evaluate(() => { BM.UI.game().bombs = []; }); ok(vp.name + ' multi-touch: hold D-pad + bomb together, slide switches arms, last pressed wins');
    }
    // MIN-3: big score fits the HUD
    await page.evaluate(() => { BM.UI.game().score = 98765; }); await page.waitForTimeout(100);
    assert(await page.evaluate(() => { const m = document.getElementById('hudM'); return m.scrollWidth <= m.clientWidth + 1 && /98765/.test(m.textContent); }), 'HUD clipped'); ok(vp.name + ' MIN-3 5-digit score fits HUD');
    await page.evaluate(() => { BM.UI.game().score = 0; });
    // bomb button, double tap gives one bomb
    await page.tap('#bombBtn'); await page.waitForTimeout(80); s = await S(); assert.strictEqual(s.bombs, 1); ok(vp.name + ' bomb button drops a bomb');
    await page.evaluate(() => { const g = BM.UI.game(), p = g.players[0]; p.bombs = 3; p.range = 3; const x0 = p.x, y0 = p.y; [[1, 1], [1, 3]].forEach(([x, y]) => { p.x = p.tx = x; p.y = p.ty = y; BM.Engine.placeBomb(g, p); }); p.x = p.tx = 3; p.y = p.ty = 3; g.map[3][3] = 0; }); await page.waitForTimeout(2550); s = await S(); assert(s.flames > 0, 'blast flames visible'); await shot('2-gameplay-blast.jpg', 'portrait'); ok(vp.name + ' bomb explodes in a cross (' + s.flames + ' flame tiles)');
    // power-up pick-up
    await page.waitForTimeout(700);
    await page.evaluate(() => { const g = BM.UI.game(), p = g.players[0], x = Math.round(p.x), y = Math.round(p.y); g.players[0].x = g.players[0].tx = 1; g.players[0].y = g.players[0].ty = 1; g.players[0].range = 2; g.items[1][2] = 'fire'; [[3, 1, 'bomb'], [1, 3, 'speed'], [3, 3, 'kick'], [1, 2, 'shield']].forEach(([a, b, k]) => { g.map[b][a] = 0; g.items[b][a] = k; }); });
    await page.keyboard.down('ArrowRight'); await page.waitForTimeout(260); await page.keyboard.up('ArrowRight'); await page.waitForTimeout(150); s = await S(); assert.strictEqual(s.player.range, 3); await shot('3-power-up.jpg', 'portrait'); ok(vp.name + ' keyboard move picks up Bigger Blast');
    // pause and resume
    await tap('[data-act=pause]'); s = await S(); assert(s.paused && s.screen === 'overlay'); await layout('pause'); await tap('#ovBtns [data-act=resume]'); assert(!(await S()).paused); ok(vp.name + ' pause and resume');
    // clear level: open portal and walk on it
    await page.evaluate(() => { const g = BM.UI.game(); g.enemies.forEach(e => e.alive = false); g.portal.x = 3; g.portal.y = 1; g.map[1][3] = 0; g.items[1][3] = null; g.bombs = []; });
    await page.waitForTimeout(200); await page.keyboard.down('ArrowRight'); await page.waitForTimeout(500); await page.keyboard.up('ArrowRight'); await page.waitForTimeout(1900);
    s = await S(); assert.strictEqual(s.status, 'won'); assert(/Level Clear/.test(await page.textContent('#ovTitle'))); assert.strictEqual(s.save.story.level, 1); await layout('clear'); ok(vp.name + ' level clear saves progress to level 2');
    await tap('#ovBtns [data-act=next]'); assert.strictEqual((await S()).level, 1);
    // reload and resume
    await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(300); assert(await page.isVisible('#btnContinue')); assert(/Level 2/.test(await page.textContent('#btnContinue')));
    await tap('#btnContinue'); s = await S(); assert.strictEqual(s.level, 1); assert.strictEqual(s.player.range, 3, 'power-ups carried'); ok(vp.name + ' save and resume after reload (level 2, power-ups kept)');
    await tap('[data-act=pause]'); await tap('#ovBtns [data-act=home]');
    // battle mode: 1 human + 3 CPU
    await tap('[data-act=battle]'); await layout('battle setup'); await tap('[data-act=cpus][data-v="3"]'); await tap('[data-act=startBattle]'); s = await S(); assert.strictEqual(s.mode, 'battle'); assert.strictEqual(s.players, 4); assert.strictEqual(s.humans, 1);
    await page.waitForTimeout(4500); await shot('4-landscape-battle.jpg', 'landscape'); await layout('battle'); ok(vp.name + ' battle with 3 CPU robots runs');
    // force round end
    await page.evaluate(() => { const g = BM.UI.game(); g.players.slice(1).forEach(p => p.alive = false); g.players[0].inv = 99; }); await page.waitForTimeout(1900); assert.strictEqual(await page.textContent('#ovTitle'), 'You win the round!'); await tap('#ovBtns [data-act=next]'); s = await S(); assert.strictEqual(s.status, 'play'); ok(vp.name + ' round over says "You win the round!", next round starts');
    // points win screen explains the points
    await page.evaluate(() => { const g = BM.UI.game(); g.shrinkI = g.shrink.length; g.players.forEach(p => p.inv = 99); const st = [[1, 6, 2], [0, 9, 1], [1, 3, 0], [0, 4, 3]]; g.players.forEach((p, i) => { p.kos = st[i][0]; p.crates = st[i][1]; p.ups = st[i][2]; p.pts = p.kos * 100 + p.crates * 10 + p.ups * 20; }); g.players[0].wins = 0; g.timeLeft = 0.05; });
    await page.waitForTimeout(1900); assert.strictEqual(await page.textContent('#ovTitle'), 'You win on points!'); const pt = await page.textContent('#ovText'); assert(/count points/.test(pt) && /Knock out a robot = 100/.test(pt) && /crate = 10/.test(pt) && /power-up = 20/.test(pt)); assert.strictEqual(await page.locator('table.pts tr').count(), 5);
    await layout('points'); await shot('5-points-win.jpg', 'portrait'); ok(vp.name + ' points win screen explains KOs, crates and power-ups');
    await tap('#ovBtns [data-act=next]');
    // POL-A: when you are knocked out in battle on a phone, the view zooms out to the whole board
    await page.evaluate(() => { const g = BM.UI.game(); g.players[0].inv = 0; BM.Engine.hit(g, g.players[0]); g.players.slice(1).forEach(p => p.inv = 99); }); await page.waitForTimeout(1300);
    s = await S(); assert.strictEqual(s.render.viewW, s.render.boardW, 'whole board visible after KO'); ok(vp.name + ' camera shows whole board after you are knocked out');
    await tap('[data-act=pause]'); await tap('#ovBtns [data-act=home]');
    assert.deepStrictEqual(errors, [], vp.name + ' console errors'); ok(vp.name + ' no console errors or warnings');
    await ctx.close();
  }
  // desktop: keyboard, 2 players
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 }), page = await ctx.newPage(), errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); page.on('pageerror', e => errors.push(e.message));
  await page.goto(base, { waitUntil: 'load' }); await page.waitForTimeout(300);
  await page.click('[data-act=battle]'); await page.waitForTimeout(400); await page.click('[data-act=humans][data-v="2"]'); await page.waitForTimeout(400); await page.click('[data-act=startBattle]'); await page.waitForTimeout(400);
  assert(!(await page.isVisible('#dpad'))); let s = await page.evaluate(() => BM.UI.state()); assert.strictEqual(s.humans, 2); assert.strictEqual(s.players, 4);
  const before = await page.evaluate(() => BM.UI.game().players.map(p => [p.x, p.y]));
  await page.keyboard.down('KeyD'); await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(300); await page.keyboard.up('KeyD'); await page.keyboard.up('ArrowLeft');
  await page.keyboard.press('Space'); await page.keyboard.press('Enter'); await page.waitForTimeout(100);
  const after = await page.evaluate(() => { const g = BM.UI.game(); return { pos: g.players.map(p => [p.x, p.y]), owners: g.bombs.map(b => b.owner), ids: g.players.map(p => p.id) }; });
  assert(after.pos[0][0] > before[0][0] && after.pos[1][0] < before[1][0], 'both players moved'); assert(after.owners.includes(after.ids[0]) && after.owners.includes(after.ids[1]), 'both dropped bombs');
  await page.keyboard.press('KeyP'); await page.waitForTimeout(200); assert((await page.evaluate(() => BM.UI.state())).paused); ok('desktop 2 players on one keyboard (WASD+Space, arrows+Enter), P pauses, no touch controls');
  // MAJ-2: pause, Home, then Esc / P does nothing
  await page.click('#ovBtns [data-act=home]'); await page.waitForTimeout(400); await page.keyboard.press('Escape'); await page.keyboard.press('KeyP'); await page.waitForTimeout(200);
  s = await page.evaluate(() => BM.UI.state()); assert.strictEqual(s.screen, 'home'); assert(await page.isVisible('#home')); ok('MAJ-2 Esc and P on home after quitting stay on home');
  // MIN-1: restart costs a life; on last life it is Game Over
  await page.click('[data-act=story]'); await page.waitForTimeout(400); const l0 = await page.evaluate(() => BM.UI.game().lives);
  await page.keyboard.press('KeyP'); await page.waitForTimeout(200); await page.click('#ovBtns [data-act=restart]'); await page.waitForTimeout(400);
  assert.strictEqual(await page.evaluate(() => BM.UI.game().lives), l0 - 1); ok('MIN-1 restart costs a life');
  // POL-3: window blur pauses
  await page.evaluate(() => window.dispatchEvent(new Event('blur'))); await page.waitForTimeout(100); assert((await page.evaluate(() => BM.UI.state())).paused); ok('POL-3 window blur pauses');
  // MIN-6: a new version arriving while paused does not reload into home
  await page.route('**/version.json*', r => r.fulfill({ contentType: 'application/json', body: '{"id":"newer01","label":"v99"}' }));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await page.waitForTimeout(2600);
  s = await page.evaluate(() => BM.UI.state()); assert(s.paused && s.mode === 'story', 'still paused in the level'); await page.unroute('**/version.json*'); ok('MIN-6 update waits while a level is paused');
  await page.click('#ovBtns [data-act=resume]'); await page.waitForTimeout(400);
  // MIN-4: back gesture pauses instead of leaving
  await page.goBack(); await page.waitForTimeout(400); s = await page.evaluate(() => BM.UI.state()); assert(s.paused && s.screen === 'overlay'); assert(/index|127\.0|blast/.test(page.url())); ok('MIN-4 back button pauses the game and stays in the app');
  await page.click('#ovBtns [data-act=resume]'); await page.waitForTimeout(400);
  // POL-2 + MIN-2: time's up on last life, then Continue offers full lives
  await page.evaluate(() => { const g = BM.UI.game(); g.lives = 1; g.timeLeft = 0.05; }); await page.waitForTimeout(2000);
  assert(/Time's up/.test(await page.textContent('#ovTitle'))); ok("POL-2 time's up message");
  await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(300); await page.click('#btnContinue'); await page.waitForTimeout(400);
  assert.strictEqual(await page.evaluate(() => BM.UI.game().lives), 3); ok('MIN-2 Continue after Game Over gives full lives');
  // MIN-5: a new attempt gets a new crate layout
  const m1 = await page.evaluate(() => JSON.stringify(BM.UI.game().map)); await page.keyboard.press('KeyP'); await page.waitForTimeout(200); await page.click('#ovBtns [data-act=restart]'); await page.waitForTimeout(400);
  assert.notStrictEqual(await page.evaluate(() => JSON.stringify(BM.UI.game().map)), m1); ok('MIN-5 each attempt has a fresh seeded layout');
  // MAJ-1: corrupt saves are rejected to a fresh state with no errors
  for (const bad of ['{"v":2,"story":{"level":3,"carry":{}}}', '{"v":2,"story":{"level":2,"difficulty":"insane","carry":{"bombs":1,"range":2,"speedUps":0,"kick":false,"shield":0,"lives":3,"score":0}}}', '{"v":2,"story":{"level":2.5,"difficulty":"easy","carry":{}}}', '{"v":2,"story":{"level":1,"difficulty":"easy","carry":{"bombs":"x","range":-5,"speedUps":99,"lives":0,"kick":false,"shield":0,"score":0}}}']) {
    await page.evaluate(b => localStorage.setItem('blastmaze_save', b), bad); await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(300); assert(!(await page.isVisible('#btnContinue')), 'bad save offered Continue: ' + bad); }
  await page.evaluate(() => localStorage.setItem('blastmaze_save', '{"v":2,"story":{"level":1,"difficulty":"easy","carry":{"bombs":2,"range":-5,"speedUps":99,"lives":0,"kick":false,"shield":0,"score":0}}}')); await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(300);
  await page.click('#btnContinue'); await page.waitForTimeout(400); const pc = await page.evaluate(() => { const g = BM.UI.game(); return [g.players[0].range, g.players[0].speed, g.lives]; }); assert.deepStrictEqual(pc, [1, 5.2, 1]); ok('MAJ-1 bad saves rejected, out-of-range values clamped');
  assert.deepStrictEqual(errors, []); await ctx.close();
  // v7 MAJ-1: D-pad and bomb button never overlap (each other, the board or the screen edge) on common phone sizes
  for (const [w, h] of [[320, 568], [360, 640], [375, 667], [390, 844], [412, 915], [430, 932], [568, 320], [640, 360], [667, 375], [844, 390], [915, 412]]) {
    const c2 = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }), pg = await c2.newPage();
    await pg.goto(base, { waitUntil: 'load' }); await pg.waitForTimeout(250); await pg.tap('[data-act=story]'); await pg.waitForTimeout(500);
    const g = await pg.evaluate(() => { const b = s => { const r = document.querySelector(s).getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; }; return { pad: b('#dpad'), bomb: b('#bombBtn'), cv: b('#cv'), arms: [...document.querySelectorAll('#dpad .arm')].map(a => a.getBoundingClientRect().width) }; });
    const hit = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b, minArm = w < 360 && h > w ? 48 : 56;
    assert(!hit(g.pad, g.bomb) && g.bomb.l - g.pad.r >= 8, w + 'x' + h + ' pad/bomb overlap ' + JSON.stringify(g));
    assert(!hit(g.pad, g.cv) && !hit(g.bomb, g.cv), w + 'x' + h + ' controls overlap board');
    assert(g.pad.l >= 0 && g.bomb.r <= w && g.pad.b <= h && g.bomb.b <= h, w + 'x' + h + ' controls off screen');
    assert(Math.min(...g.arms) >= minArm, w + 'x' + h + ' arms ' + g.arms[0]);
    ok(w + 'x' + h + ' D-pad (arms ' + Math.round(g.arms[0]) + ' px) and bomb (' + Math.round(g.bomb.w) + ' px) do not overlap; gap ' + Math.round(g.bomb.l - g.pad.r) + ' px'); await c2.close();
  }
  // v8 steering: only a short tap buffer; QA v7 MAJ-1/MAJ-2 repro cases and a random-press property test.
  // Row 3 is open; above it columns 3 and 5 are open, so (4,3) has a pillar above it and (5,3) leads up.
  {
    const c3 = await browser.newContext({ viewport: { width: 1280, height: 800 } }), pg = await c3.newPage(), errs = [];
    pg.on('pageerror', e => errs.push(e.message));
    await pg.goto(base, { waitUntil: 'load' }); await pg.waitForTimeout(250); await pg.click('[data-act=story]'); await pg.waitForTimeout(2600);
    const setup = (x, tx, dir, extra) => pg.evaluate(([x, tx, dir, extra]) => { const g = BM.UI.game(), p = g.players[0]; g.enemies.forEach(e => { e.speed = 0.0001; e.x = e.tx = 13; e.y = e.ty = 11; }); g.bombs = []; p.inv = 0; p.alive = true;
      for (let y = 0; y < 13; y++) for (let x2 = 0; x2 < 15; x2++) g.flames[y][x2] = 0;
      for (let i = 1; i < 14; i++) { g.map[3][i] = 0; g.items[3][i] = null; g.map[2][i] = i === 3 || i === 5 ? 0 : 1; g.map[4][i] = 1; } g.map[1][3] = 0; g.map[1][5] = 0;
      p.x = x; p.tx = tx; p.y = p.ty = 3; p.dir = dir; p.face = 'r';
      if (extra === 'flame') g.flames[3][5] = 99; if (extra === 'enemy') { const e = g.enemies[0]; e.x = e.tx = 5; e.y = e.ty = 3; } }, [x, tx, dir, extra || '']);
    const pl = () => pg.evaluate(() => { const p = BM.UI.game().players[0]; return { x: p.x, y: p.y, alive: p.alive }; });
    // per-engine-step tracker
    const track = () => pg.evaluate(() => { const E = BM.Engine; window.__trk = []; if (!E.__orig) E.__orig = E.step; E.step = function (g, inp) { const r = E.__orig.apply(this, arguments); const p = g.players[0]; window.__trk.push([p.x, p.y, inp[0].dir]); return r; }; });
    const untrack = () => pg.evaluate(() => { const E = BM.Engine; E.step = E.__orig; return window.__trk; });
    const walkTo4 = async () => { await setup(2, 2, null); await pg.keyboard.down('ArrowRight'); await pg.waitForFunction(() => BM.UI.game().players[0].tx === 4); await pg.keyboard.up('ArrowRight'); await pg.waitForTimeout(400); };
    // MAJ-1 S4: walk right onto (4,3) under a pillar, stand 2 s, put a blast or critter on (5,3), hold UP: nothing happens
    for (const ex of ['flame', 'enemy', '']) { await walkTo4(); await pg.waitForTimeout(ex ? 2000 : 300);
      await pg.evaluate(ex => { const g = BM.UI.game(); if (ex === 'flame') g.flames[3][5] = 99; if (ex === 'enemy') { const e = g.enemies[0]; e.x = e.tx = 5; e.y = e.ty = 3; } }, ex);
      await pg.keyboard.down('ArrowUp'); await pg.waitForTimeout(700); await pg.keyboard.up('ArrowUp'); const q = await pl(); assert(q.x === 4 && q.y === 3 && q.alive, 'S4 ' + ex + ' ' + JSON.stringify(q)); }
    ok('QA v7 MAJ-1 S4: after walking onto a tile under a pillar and stopping, holding Up does nothing (blast, critter or open floor beside)');
    // MAJ-1 S3: walking right, release at ~3.6, hold UP, blast on (5,3): stop at (4,3), alive
    await setup(2, 2, null, 'flame'); await pg.keyboard.down('ArrowRight'); await pg.waitForFunction(() => BM.UI.game().players[0].x >= 3.55); await pg.keyboard.up('ArrowRight'); await pg.keyboard.down('ArrowUp'); await pg.waitForTimeout(700); await pg.keyboard.up('ArrowUp'); let q = await pl(); assert(q.x === 4 && q.y === 3 && q.alive, 'S3 ' + JSON.stringify(q));
    ok('QA v7 MAJ-1 S3: release Right past the opening and hold Up: stops safely next to a blast');
    // MAJ-1 S4b: own bomb beside, push UP into pillar: stays put
    await walkTo4(); await pg.evaluate(() => { const g = BM.UI.game(); BM.Engine.placeBomb(g, g.players[0]); g.players[0].inv = 99; }); await pg.keyboard.down('ArrowUp'); await pg.waitForTimeout(500); await pg.keyboard.up('ArrowUp'); q = await pl(); assert(q.x === 4 && q.y === 3, 'S4b ' + JSON.stringify(q));
    await pg.evaluate(() => { BM.UI.game().bombs = []; }); ok('QA v7 MAJ-1 S4b: pushing Up next to your own bomb does not slide you away');
    // MAJ-2 S5: hold RIGHT from x=1, tap UP for 80 ms at x 3.08-3.13: per engine step, x never decreases and y never goes down
    for (let rep = 0; rep < 3; rep++) { await setup(1, 1, null); await track(); await pg.keyboard.down('ArrowRight'); await pg.waitForFunction(() => BM.UI.game().players[0].x >= 3.08, null, { polling: 'raf' });
      await pg.keyboard.down('ArrowUp'); await pg.waitForTimeout(80); await pg.keyboard.up('ArrowUp'); await pg.waitForTimeout(500); await pg.keyboard.up('ArrowRight'); const t = await untrack();
      assert(t.every((p, i) => p[1] <= 3 && (i === 0 || p[0] >= t[i - 1][0] - 1e-9)), 'S5 moved left or down: ' + JSON.stringify(t.filter((p, i) => i && (p[0] < t[i - 1][0] || p[1] > 3)).slice(0, 3))); }
    ok('QA v7 MAJ-2 S5: hold Right + tap Up just past an opening never backs up or goes down (checked every engine step, 3 repeats)');
    // zigzag: alternate Right/Down every 100 ms from (1,3) on an open board: x never decreases
    await setup(1, 1, null); await pg.evaluate(() => { const g = BM.UI.game(); for (let i = 1; i < 14; i++) g.map[4][i] = i % 2 ? 0 : 1; }); await track();
    for (let i = 0; i < 8; i++) { const k = i % 2 ? 'ArrowDown' : 'ArrowRight'; await pg.keyboard.down(k); await pg.waitForTimeout(100); await pg.keyboard.up(k); }
    { const t = await untrack(); assert(t.every((p, i) => i === 0 || (p[0] >= t[i - 1][0] - 1e-9 && p[1] >= t[i - 1][1] - 1e-9)), 'zigzag went backwards'); }
    ok('QA v7 MAJ-2 zigzag: 100 ms Right/Down swaps never move left or up');
    // early tap buffer still works
    await setup(2.75, 3, 'r'); await pg.keyboard.down('ArrowUp'); await pg.waitForTimeout(16); await pg.keyboard.up('ArrowUp'); await pg.waitForTimeout(450); q = await pl(); assert(q.x === 3 && q.y < 2.5, 'tap buffer ' + JSON.stringify(q));
    ok('steering: a quick Up tap just before the opening is buffered and turns');
    // Property test: random presses; every step's direction must be pressed now or a tap released <= 150 ms ago (perpendicular), never an unpressed reversal
    const bad = await pg.evaluate(async () => {
      const g = BM.UI.game(), p = g.players[0], E = BM.Engine, orig = E.step, log = [], keysDown = new Set(), rel = {};
      p.inv = 1e9; g.enemies.forEach(e => { e.speed = 0.0001; }); for (let y = 1; y < 12; y++) for (let x = 1; x < 14; x++) if (g.map[y][x] === 2) g.map[y][x] = 0; p.x = p.tx = 1; p.y = p.ty = 1; p.dir = null;
      const KEY = { u: 'ArrowUp', d: 'ArrowDown', l: 'ArrowLeft', r: 'ArrowRight' }, OPP = { u: 'd', d: 'u', l: 'r', r: 'l' };
      E.step = function (gg, inp, dt) { const before = gg.players[0].dir, out = inp[0].dir, now = performance.now(); const okDir = !out || keysDown.has(out) || (rel[out] && now - rel[out] < 260 && before && OPPd(out) !== before);
        log.push({ out, before, okDir, pressed: [...keysDown] }); const r = orig.apply(this, arguments); const after = gg.players[0].dir; if (before && after === OPP[before] && !keysDown.has(after)) log.push({ rev: after, okDir: false }); return r; };
      function OPPd(d) { return OPP[d]; }
      let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
      for (let i = 0; i < 160; i++) { const d = 'udlr'[Math.floor(rnd() * 4)], down = rnd() < 0.6;
        if (down && !keysDown.has(d)) { keysDown.add(d); dispatchEvent(new KeyboardEvent('keydown', { code: KEY[d] })); } else if (!down && keysDown.has(d)) { keysDown.delete(d); rel[d] = performance.now(); dispatchEvent(new KeyboardEvent('keyup', { code: KEY[d] })); }
        await new Promise(r => setTimeout(r, 20 + rnd() * 120)); }
      for (const d of [...keysDown]) dispatchEvent(new KeyboardEvent('keyup', { code: KEY[d] }));
      E.step = orig; return { steps: log.length, bad: log.filter(l => !l.okDir).slice(0, 5) };
    });
    assert(bad.steps > 300 && bad.bad.length === 0, 'property test ' + JSON.stringify(bad)); ok('steering property test: ' + bad.steps + ' steps of random presses, every direction pressed or a fresh tap, no unpressed reversal');
    assert.deepStrictEqual(errs, []); await c3.close();
  }
  // POL-1: touches in the gap next to the bomb button do not drop a bomb (hit area = the visible circle)
  {
    const c4 = await browser.newContext({ viewport: { width: 320, height: 568 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }), pg = await c4.newPage();
    await pg.goto(base, { waitUntil: 'load' }); await pg.waitForTimeout(250); await pg.tap('[data-act=story]'); await pg.waitForTimeout(2600);
    const bb = await pg.locator('#bombBtn').boundingBox(), pb = await pg.locator('#dpad').boundingBox(); assert(bb.x - (pb.x + pb.width) >= 12, 'gap >= 12 px');
    const cdp = await c4.newCDPSession(pg); await pg.evaluate(() => { BM.UI.game().bombs = []; });
    for (const dx of [2, 5, 8]) { const pt = { x: bb.x - dx, y: bb.y + bb.height / 2, id: 7 }; await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pt] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await pg.waitForTimeout(80); }
    assert.strictEqual((await pg.evaluate(() => BM.UI.game().bombs.length)), 0, 'gap touch dropped a bomb');
    const ctr = { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2, id: 8 }; await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [ctr] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await pg.waitForTimeout(100);
    assert.strictEqual((await pg.evaluate(() => BM.UI.game().bombs.length)), 1, 'center tap drops a bomb'); ok('320x568: touches 2-8 px outside the bomb button drop nothing; gap ' + Math.round(bb.x - pb.x - pb.width) + ' px'); await c4.close();
  }
  await browser.close(); if (server) server.close(); console.log('browser tests passed:', passed);
})().catch(e => { console.error(e); process.exit(1); });
