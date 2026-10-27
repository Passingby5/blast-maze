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
    await tap('[data-act=help]'); assert.strictEqual(await page.locator('#powerList canvas').count(), 5); await layout('help'); await tap('#help [data-act=home]'); ok(vp.name + ' how to play lists 5 power-ups');
    // difficulty
    await tap('[data-act=diff][data-v=easy]'); assert.strictEqual((await S()).save.settings.difficulty, 'easy'); await tap('[data-act=diff][data-v=medium]'); ok(vp.name + ' difficulty select');
    // double tap debounced: story starts once
    await page.dblclick('[data-act=story]'); await page.waitForTimeout(500); let s = await S(); assert.strictEqual(s.screen, 'play'); assert.strictEqual(s.level, 0); ok(vp.name + ' story starts on (double) tap');
    assert(await page.isVisible('#stick') && await page.isVisible('#bombBtn')); await layout('play');
    const r = s.render; assert.strictEqual(r.dpr, 3); const cssW = await page.evaluate(() => document.getElementById('cv').getBoundingClientRect().width); assert(Math.abs(r.w - cssW * 3) < 2, 'canvas at full dpr'); ok(vp.name + ' touch controls shown; canvas drawn at devicePixelRatio ' + r.dpr + ' (' + r.w + 'px wide)');
    // joystick moves player
    const p0 = s.player; const sb = await page.locator('#stick').boundingBox();
    await page.evaluate(() => { BM.UI.game().players[0].inv = 999; });
    await page.dispatchEvent('#stick', 'pointerdown', { pointerId: 5, clientX: sb.x + sb.width / 2 + 60, clientY: sb.y + sb.height / 2, isPrimary: true });
    await page.waitForTimeout(500); await page.dispatchEvent('#stick', 'pointerup', { pointerId: 5 }); s = await S(); assert(s.player.x > p0.x + 0.5, 'joystick moved player right'); ok(vp.name + ' joystick moves player');
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
    await page.evaluate(() => { const g = BM.UI.game(); g.players.slice(1).forEach(p => p.alive = false); g.players[0].inv = 99; }); await page.waitForTimeout(1900); assert(/wins the round/.test(await page.textContent('#ovTitle'))); await tap('#ovBtns [data-act=next]'); s = await S(); assert.strictEqual(s.status, 'play'); ok(vp.name + ' round over, next round starts');
    await tap('[data-act=pause]'); await tap('#ovBtns [data-act=home]');
    assert.deepStrictEqual(errors, [], vp.name + ' console errors'); ok(vp.name + ' no console errors or warnings');
    await ctx.close();
  }
  // desktop: keyboard, 2 players
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 }), page = await ctx.newPage(), errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); page.on('pageerror', e => errors.push(e.message));
  await page.goto(base, { waitUntil: 'load' }); await page.waitForTimeout(300);
  await page.click('[data-act=battle]'); await page.waitForTimeout(400); await page.click('[data-act=humans][data-v="2"]'); await page.waitForTimeout(400); await page.click('[data-act=startBattle]'); await page.waitForTimeout(400);
  assert(!(await page.isVisible('#stick'))); let s = await page.evaluate(() => BM.UI.state()); assert.strictEqual(s.humans, 2); assert.strictEqual(s.players, 4);
  const before = await page.evaluate(() => BM.UI.game().players.map(p => [p.x, p.y]));
  await page.keyboard.down('KeyD'); await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(300); await page.keyboard.up('KeyD'); await page.keyboard.up('ArrowLeft');
  await page.keyboard.press('Space'); await page.keyboard.press('Enter'); await page.waitForTimeout(100);
  const after = await page.evaluate(() => { const g = BM.UI.game(); return { pos: g.players.map(p => [p.x, p.y]), owners: g.bombs.map(b => b.owner), ids: g.players.map(p => p.id) }; });
  assert(after.pos[0][0] > before[0][0] && after.pos[1][0] < before[1][0], 'both players moved'); assert(after.owners.includes(after.ids[0]) && after.owners.includes(after.ids[1]), 'both dropped bombs');
  await page.keyboard.press('KeyP'); await page.waitForTimeout(200); assert((await page.evaluate(() => BM.UI.state())).paused); ok('desktop 2 players on one keyboard (WASD+Space, arrows+Enter), P pauses, no touch controls');
  assert.deepStrictEqual(errors, []); await ctx.close();
  await browser.close(); if (server) server.close(); console.log('browser tests passed:', passed);
})().catch(e => { console.error(e); process.exit(1); });
