// Unit tests for the engine and save format. Run: node tests/unit.js
const E = require('../src/engine.js'), S = require('../src/save.js'), assert = require('assert');
let n = 0; const t = (name, f) => { f(); n++; console.log('ok', name); };
const run = (g, sec, inp) => { for (let i = 0; i < sec * 60; i++) E.step(g, inp || [], 1 / 60); };
function blank(mode) { const g = mode === 'battle' ? E.newBattle({ humans: 2, cpus: 1, seed: 3 }) : E.newStory(0, { seed: 5 }); for (let y = 1; y < E.H - 1; y++) for (let x = 1; x < E.W - 1; x++) if (g.map[y][x] === E.CRATE) g.map[y][x] = E.FLOOR; g.enemies = []; g.items = g.items.map(r => r.map(() => null)); return g; }
t('1 grid layout', () => { const g = E.newStory(0, { seed: 1 }); assert.strictEqual(g.map.length, 13); assert.strictEqual(g.map[0].length, 15); for (let x = 0; x < 15; x++) assert.strictEqual(g.map[0][x], E.WALL); assert.strictEqual(g.map[2][2], E.WALL); assert.strictEqual(g.map[4][6], E.WALL); assert(g.map.flat().filter(v => v === E.CRATE).length > 20); });
t('2 spawn corners free', () => { for (let s = 1; s < 30; s++) { const g = E.newBattle({ humans: 1, cpus: 3, seed: s }); [[1, 1], [2, 1], [1, 2], [3, 2], [2, 3], [13, 11], [12, 11], [13, 10], [13, 1], [1, 11]].forEach(([x, y]) => assert.strictEqual(g.map[y][x], E.FLOOR)); } });
t('3 blast shape, timer, walls and crates', () => {
  const g = blank(); g.map[1][4] = E.CRATE; g.map[1][5] = E.CRATE; const p = g.players[0]; p.x = p.tx = 3; p.y = p.ty = 1; p.range = 3; p.inv = 99;
  assert(E.placeBomb(g, p)); run(g, 2.3); assert.strictEqual(g.bombs.length, 1); run(g, 0.15); assert.strictEqual(g.bombs.length, 0);
  assert.strictEqual(g.map[1][4], E.FLOOR, 'first crate broken'); assert.strictEqual(g.map[1][5], E.CRATE, 'second crate kept');
  const tiles = E.blastTiles(g, 3, 2, 3).map(a => a[0] + ',' + a[1]); assert(tiles.includes('3,1') && tiles.includes('3,5') && !tiles.includes('2,2') && !tiles.includes('4,2'));
});
t('4 chain reaction', () => { const g = blank(), p = g.players[0]; p.bombs = 2; p.inv = 99; p.x = p.tx = 1; p.y = p.ty = 1; E.placeBomb(g, p); run(g, 1.0); p.x = p.tx = 3; p.y = p.ty = 1; E.placeBomb(g, p); assert.strictEqual(g.bombs.length, 2); run(g, 1.45); assert.strictEqual(g.bombs.length, 0, 'second bomb went off early with the first'); });
t('5 walk off own bomb but not back on', () => { const g = blank(), p = g.players[0]; E.placeBomb(g, p); run(g, 0.5, [{ dir: 'r' }]); assert(p.x > 1.9); run(g, 0.6, [{ dir: 'l' }]); assert(p.x >= 2, 'blocked by bomb'); });
t('6 power-ups', () => { const p = E.newStory(0, { seed: 1 }).players[0]; E.applyPower(p, 'bomb'); E.applyPower(p, 'fire'); E.applyPower(p, 'speed'); E.applyPower(p, 'kick'); E.applyPower(p, 'shield'); assert.deepStrictEqual([p.bombs, p.range, p.speed, p.kick, p.shield], [2, 3, 3.7, true, 1]);
  const g = blank(); g.items[1][2] = 'fire'; run(g, 0.5, [{ dir: 'r' }]); assert.strictEqual(g.players[0].range, 3); assert.strictEqual(g.items[1][2], null); });
t('7 kick slides bomb', () => { const g = blank(), p = g.players[0]; p.kick = true; p.x = p.tx = 3; p.y = p.ty = 1; E.placeBomb(g, p); p.x = p.tx = 1; p.passBomb = null; run(g, 1.2, [{ dir: 'r' }]); assert(g.bombs[0].x >= 10, 'bomb slid to ' + g.bombs[0].x); });
t('8 shield', () => { const g = blank(), p = g.players[0]; p.shield = 1; E.hit(g, p); assert(p.alive && p.shield === 0 && p.inv === 2); E.hit(g, p); assert(p.alive); p.inv = 0; E.hit(g, p); assert(!p.alive); });
t('9 seeded rng repeatable', () => { const a = E.newBattle({ seed: 42, cpus: 3 }), b = E.newBattle({ seed: 42, cpus: 3 }); assert.deepStrictEqual(a.map, b.map); run(a, 20); run(b, 20); assert.deepStrictEqual(a.players.map(p => [p.x, p.y, p.alive]), b.players.map(p => [p.x, p.y, p.alive])); const c = E.newBattle({ seed: 43 }); assert.notDeepStrictEqual(a.map, c.map); });
t('10 enemy types and boss', () => { assert.deepStrictEqual(Object.keys(E.ETYPES), ['blob', 'chaser', 'ghost', 'boss']); const g = E.newStory(5, { seed: 1 }), b = g.enemies.find(e => e.type === 'boss'); assert.strictEqual(b.hp, 6); E.hit(g, b); assert(b.alive && b.hp === 5); const gh = E.newStory(6, { seed: 1 }).enemies.find(e => e.type === 'ghost'); assert(gh.ghost); run(g, 10); assert(g.enemies.length > 1, 'boss calls helpers'); });
t('11 difficulty changes things', () => { const sp = d => E.newStory(3, { seed: 1, difficulty: d }).enemies[0].speed; assert(sp('easy') < sp('medium') && sp('medium') < sp('hard')); assert(E.DIFF.easy.lives > E.DIFF.hard.lives); assert(E.DIFF.easy.cpuMiss > E.DIFF.hard.cpuMiss); });
t('12 story 22 levels, bosses on 6/12/17/22, portal after clear', () => {
  assert.strictEqual(E.LEVELS.length, 22);
  assert(E.LEVELS[5].boss && E.LEVELS[11].boss && E.LEVELS[16].boss && E.LEVELS[21].boss);
  assert(E.LEVELS[16].bossBombs && E.LEVELS[21].bossBombs);
  assert(!E.LEVELS[5].bossBombs && !E.LEVELS[11].bossBombs);
  const g = blank(); g.portal = { x: 3, y: 1, open: false }; run(g, 0.1); assert(g.portal.open); run(g, 1, [{ dir: 'r' }]); assert.strictEqual(g.status, 'won');
});
t('13 all levels solvable', () => { for (let s = 1; s <= 50; s++) for (let l = 0; l < E.LEVELS.length; l++) assert(E.solvable(E.newStory(l, { seed: s })), l + ' ' + s); });
t('14 battle: last standing wins, 2 humans', () => { const g = E.newBattle({ humans: 2, cpus: 2, seed: 2 }); assert.strictEqual(g.players.length, 4); assert(g.players[0].human && g.players[1].human && g.players[2].cpu); g.players[1].alive = g.players[2].alive = g.players[3].alive = false; run(g, 0.1); assert.strictEqual(g.status, 'roundover'); assert.strictEqual(g.winner, g.players[0].id); assert.strictEqual(g.players[0].wins, 1); });
t('15 time limit ends round', () => { const g = blank('battle'); g.players.forEach(p => p.inv = 1e9); g.players[2].alive = true; g.timeLeft = 0.05; run(g, 0.2); assert.strictEqual(g.status, 'roundover'); });
t('24 save versioning', () => { const mem = {}; const st = { getItem: k => mem[k] ?? null, setItem: (k, v) => mem[k] = String(v), removeItem: k => delete mem[k] };
  S.write(st, { story: { level: 4, difficulty: 'hard', carry: { bombs: 2, range: 3, speedUps: 1, kick: false, shield: 0, lives: 2, score: 100 } } }); assert.strictEqual(S.read(st).story.level, 4); assert.strictEqual(JSON.parse(mem[S.KEY]).v, S.VERSION);
  mem[S.KEY] = '{bad json'; assert.deepStrictEqual(S.read(st).story, null); mem[S.KEY] = JSON.stringify({ v: 0, story: { level: 9 } }); assert.strictEqual(S.read(st).story, null); mem[S.KEY] = JSON.stringify({ v: S.VERSION, story: { level: 99 } }); assert.strictEqual(S.read(st).story, null); });
t('MAJ-3 sudden death shrinks the arena and ends the round', () => { const g = blank('battle'); [[7, 5], [7, 7], [5, 5]].forEach((c, i) => { const p = g.players[i]; p.x = p.tx = c[0]; p.y = p.ty = c[1]; p.human = true; p.cpu = false; }); const w0 = g.map.flat().filter(v => v === E.WALL).length; g.timeLeft = E.SHRINK_AT + 0.1; run(g, 70, [{}, {}, {}]); assert(g.shrinking); const walls = g.map.flat().filter(v => v === E.WALL).length; assert(walls > w0 + 20, 'walls dropped ' + (walls - w0)); assert.notStrictEqual(g.status, 'play'); });
t('MAJ-3 time out with 2 alive goes to points', () => { const g = blank('battle'); g.players.forEach(p => p.inv = 1e9); g.players[0].pts = 50; g.players[0].x = g.players[0].tx = 7; g.players[0].y = g.players[0].ty = 5; g.timeLeft = 0.02; run(g, 0.1); assert.strictEqual(g.winner, g.players[0].id); assert(g.onPoints); });
t('MAJ-4 boss defeat clears helpers and opens portal', () => { const g = E.newStory(5, { seed: 1 }); run(g, 13); const b = g.enemies.find(e => e.type === 'boss'); b.hp = 1; b.inv = 0; E.hit(g, b); run(g, 0.05); assert(g.enemies.every(e => !e.alive)); assert(g.portal.open); assert.strictEqual(E.STORY_TIME, 300); });
t('MIN-7 enemies start with room to move', () => { for (let s = 1; s <= 30; s++) for (let l = 0; l < E.LEVELS.length; l++) { const g = E.newStory(l, { seed: s }); g.enemies.forEach(e => { if (e.type !== 'ghost') assert(E.unbox(g, e.tx, e.ty, 6) >= 6, 'boxed ' + l + ' ' + s); }); } });
t('MIN-5 different attempt seeds give different crates', () => { assert.notDeepStrictEqual(E.newStory(2, { seed: 1 }).map, E.newStory(2, { seed: 2 }).map); assert.deepStrictEqual(E.newStory(2, { seed: 7 }).map, E.newStory(2, { seed: 7 }).map); });
t('POL-2 time up is flagged', () => { const g = blank(); g.enemies = [{ kind: 'enemy', alive: true, type: 'blob', x: 13, y: 11, tx: 13, ty: 11, speed: 0, hp: 1, inv: 0 }]; g.timeLeft = 0.01; run(g, 0.1); assert(g.timeUp); assert.strictEqual(g.status, 'dead'); });
t('POL-5 hard has fewer lives than medium', () => { assert(E.DIFF.hard.lives < E.DIFF.medium.lives && E.DIFF.medium.lives < E.DIFF.easy.lives); });
t('MAJ-1 strict save validation', () => { const good = { bombs: 2, range: 3, speedUps: 1, kick: true, shield: 1, lives: 2, score: 10 }, C = (st) => S.cleanStory(st);
  assert(C({ level: 3, difficulty: 'easy', carry: good })); assert.strictEqual(C({ level: 3, difficulty: 'easy', carry: {} }), null); assert.strictEqual(C({ level: 3, difficulty: 'insane', carry: good }), null);
  assert.strictEqual(C({ level: 2.5, difficulty: 'easy', carry: good }), null); assert.strictEqual(C({ level: 2, difficulty: 'easy', carry: Object.assign({}, good, { bombs: 'x' }) }), null);
  const cl = C({ level: 2, difficulty: 'easy', carry: Object.assign({}, good, { range: -5, speedUps: 99, lives: 0 }) }).carry; assert.deepStrictEqual([cl.range, cl.speedUps, cl.lives], [1, 4, 1]);
  assert.strictEqual(C(null), null); assert.strictEqual(C([]), null); assert.strictEqual(C({ level: 2, difficulty: 'easy', carry: Object.assign({}, good, { lives: Infinity }) }), null); });
t('POL-C bot blasts crates to reach a walled-in portal', () => { for (let s = 1; s <= 8; s++) { const g = E.newStory(0, { seed: s }); g.enemies = []; g.portal = { x: 13, y: 11, open: false }; g.map[11][13] = 0; [[12, 11], [13, 10], [11, 11], [13, 9]].forEach(([x, y]) => g.map[y][x] = E.CRATE);
  g.players[0].bot = true; let n = 0; while (g.status === 'play' && n++ < 60 * 300) { g.players[0].inv = 1; E.step(g, [], 1 / 60); } assert.strictEqual(g.status, 'won', 'seed ' + s); } });

t('v9 L1-12 names unchanged', () => {
  const names = ['Sunny Start','Crate Garden','Busy Blobs','Here They Come','Tight Corners','Big Bolt Boss','Spooky Floaters','Mixed Bag','Chase Lane','Ghost Town','Crowded Maze','Mega Bolt Finale'];
  names.forEach((n, i) => assert.strictEqual(E.LEVELS[i].name, n));
});
t('v9 speed ramp and CAP', () => {
  const sp = (lv, d) => E.newStory(lv, { seed: 1, difficulty: d }).enemies.filter(e => e.type === 'chaser')[0].speed;
  assert(sp(12, 'hard') > sp(3, 'hard'));
  assert(sp(20, 'hard') >= sp(12, 'hard'));
  assert.strictEqual(sp(21, 'hard'), E.SPEED_CAP);
  assert(sp(21, 'easy') < sp(21, 'medium') && sp(21, 'medium') <= sp(21, 'hard'));
  assert(E.SPEED_CAP === 3.3);
});
t('v9 chaser counts ramp', () => {
  const c = lv => E.LEVELS[lv].c;
  assert.strictEqual(c(12), 2); assert.strictEqual(c(14), 3); assert.strictEqual(c(17), 4); assert.strictEqual(c(19), 5); assert.strictEqual(c(20), 5);
});
t('v9 early bosses never drop bombs', () => {
  for (const lv of [5, 11]) {
    const g = E.newStory(lv, { seed: 1, difficulty: 'hard' });
    for (let y = 1; y < E.H - 1; y++) for (let x = 1; x < E.W - 1; x++) if (g.map[y][x] === E.CRATE) g.map[y][x] = E.FLOOR;
    const boss = g.enemies.find(e => e.type === 'boss'); boss.bombCD = 0; g.players[0].inv = 99;
    g.players[0].x = g.players[0].tx = boss.tx - 3; g.players[0].y = g.players[0].ty = boss.ty;
    assert.strictEqual(E.placeBossBomb(g, boss), false);
    for (let i = 0; i < 300; i++) E.step(g, [], 1 / 60);
    assert(g.bombs.every(b => !b.fromBoss));
  }
});
t('v9 L17/L22 boss bombs distinct and fair', () => {
  for (const lv of [16, 21]) {
    const g = E.newStory(lv, { seed: 7, difficulty: 'hard' });
    assert(g.bossBombs);
    for (let y = 1; y < E.H - 1; y++) for (let x = 1; x < E.W - 1; x++) if (g.map[y][x] === E.CRATE) g.map[y][x] = E.FLOOR;
    const boss = g.enemies.find(e => e.type === 'boss'), p = g.players[0];
    boss.bombCD = 0; p.inv = 99; p.x = p.tx = boss.tx - 4; p.y = p.ty = boss.ty;
    assert(E.placeBossBomb(g, boss));
    const bb = g.bombs.find(b => b.fromBoss);
    assert(bb && bb.fromBoss === true && bb.timer === E.BOMB_TIME && bb.range >= 2);
    assert(E.playerHasBombEscape(g, bb.x, bb.y, bb.range, bb.timer), 'escape required');
    // player bomb alongside boss bomb is visually/logic distinct via fromBoss flag
    p.x = p.tx = 1; p.y = p.ty = 1; assert(E.placeBomb(g, p));
    assert(g.bombs.some(b => b.fromBoss) && g.bombs.some(b => !b.fromBoss));
    // boss immune to own blast
    const hp = boss.hp; g.bombs.length = 0;
    g.bombs.push({ id: 999, x: boss.tx, y: boss.ty, timer: 0.01, range: 2, owner: boss.id, fromBoss: true, slide: null, sp: 0 });
    run(g, 0.4); assert(boss.alive && boss.hp === hp);
  }
  const p17 = E.bossBombParams(E.newStory(16, { seed: 1, difficulty: 'easy' }));
  const p22 = E.bossBombParams(E.newStory(21, { seed: 1, difficulty: 'hard' }));
  assert(p22.max >= p17.max && p22.cd <= p17.cd);
});
t('v9 escape-path rejects trapping bombs', () => {
  const g = E.newStory(16, { seed: 1, difficulty: 'medium' });
  for (let y = 1; y < E.H - 1; y++) for (let x = 1; x < E.W - 1; x++) g.map[y][x] = (x % 2 === 0 && y % 2 === 0) ? E.WALL : E.CRATE;
  for (let y = 1; y <= 11; y++) g.map[y][1] = E.FLOOR; // full open vertical corridor
  const p = g.players[0]; p.x = p.tx = 1; p.y = p.ty = 5; p.speed = 3.2;
  // Range 12 covers the whole corridor; no side doors => trapped
  assert.strictEqual(E.playerHasBombEscape(g, 1, 1, 12, E.BOMB_TIME), false, 'no side exit from blast corridor');
  g.map[5][2] = E.FLOOR; g.map[5][3] = E.FLOOR; g.map[5][4] = E.FLOOR; g.map[5][5] = E.FLOOR;
  assert.strictEqual(E.playerHasBombEscape(g, 1, 1, 12, E.BOMB_TIME), true, 'side corridor is an escape');
});
t('v9 save accepts levels through 21', () => {
  const good = { bombs: 2, range: 3, speedUps: 1, kick: true, shield: 1, lives: 2, score: 10 };
  assert(S.cleanStory({ level: 21, difficulty: 'hard', carry: good }));
  assert.strictEqual(S.cleanStory({ level: 22, difficulty: 'hard', carry: good }), null);
  assert(S.cleanStory({ level: 12, difficulty: 'medium', carry: good }));
});


t('v10 R9-1 escape treats proposed bomb as solid', () => {
  const g = E.newStory(16, { seed: 20324378, difficulty: 'medium' });
  for (let i = 0; i < 93; i++) E.step(g, [{ dir: 'r' }], 1 / 60);
  for (let i = 0; i < 100; i++) E.step(g, [{}], 1 / 60);
  assert.strictEqual(E.playerHasBombEscape(g, 4, 1, 2, E.BOMB_TIME), false);
  const boss = g.enemies.find(e => e.type === 'boss'); boss.bombCD = 0;
  E.placeBossBomb(g, boss);
  assert(!g.bombs.some(b => b.fromBoss && b.x === 4 && b.y === 1));
});
t('v10 R9-1 natural corner not unavoidable', () => {
  const seed = 20324378;
  function toFrame() {
    const g = E.newStory(16, { seed, difficulty: 'medium' });
    for (let i = 0; i < 93; i++) E.step(g, [{ dir: 'r' }], 1 / 60);
    for (let i = 0; i < 100; i++) E.step(g, [{}], 1 / 60);
    return g;
  }
  const g0 = toFrame();
  if (!g0.bombs.some(b => b.fromBoss)) return; // no bomb is also fine
  let survivor = false;
  for (const dir of [null, 'u', 'd', 'l', 'r']) {
    const g = toFrame();
    for (let n = 0; n < 180 && g.status === 'play'; n++) E.step(g, [{ dir }], 1 / 60);
    if (g.players[0].alive) survivor = true;
  }
  assert(survivor, 'at least one immediate direction must survive');
});
t('v10 R9-2 boss bombs keep reaction fuse on chain', () => {
  const g = E.newStory(16, { seed: 3, difficulty: 'medium' });
  for (let y = 1; y < E.H - 1; y++) for (let x = 1; x < E.W - 1; x++) if (g.map[y][x] === E.CRATE) g.map[y][x] = E.FLOOR;
  const boss = g.enemies.find(e => e.type === 'boss'), p = g.players[0];
  Object.assign(p, { x: 9, y: 5, tx: 9, ty: 5, shield: 0, inv: 0, speed: 3.2 });
  Object.assign(boss, { x: 11, y: 5, tx: 11, ty: 5, bombCD: 99, speed: 0.0001 });
  g.enemies = [boss];
  g.bombs = [
    { id: 6, x: 5, y: 5, timer: 0.04, range: 3, owner: p.id, slide: null, sp: 0 },
    { id: 7, x: 8, y: 5, timer: 2.4, range: 2, owner: boss.id, fromBoss: true, slide: null, sp: 0 }
  ];
  let survivor = false, early = false;
  for (const dir of [null, 'u', 'd', 'l', 'r']) {
    const t = E.newStory(16, { seed: 3, difficulty: 'medium' });
    for (let y = 1; y < E.H - 1; y++) for (let x = 1; x < E.W - 1; x++) if (t.map[y][x] === E.CRATE) t.map[y][x] = E.FLOOR;
    const b = t.enemies.find(e => e.type === 'boss'), q = t.players[0];
    Object.assign(q, { x: 9, y: 5, tx: 9, ty: 5, shield: 0, inv: 0, speed: 3.2 });
    Object.assign(b, { x: 11, y: 5, tx: 11, ty: 5, bombCD: 99, speed: 0.0001 });
    t.enemies = [b];
    t.bombs = [
      { id: 6, x: 5, y: 5, timer: 0.04, range: 3, owner: q.id, slide: null, sp: 0 },
      { id: 7, x: 8, y: 5, timer: 2.4, range: 2, owner: b.id, fromBoss: true, slide: null, sp: 0 }
    ];
    for (let n = 0; n < 8 && t.status === 'play'; n++) E.step(t, [{ dir }], 1 / 60);
    if (!q.alive && t.t <= 0.1) early = true;
    for (let n = 0; n < 60 && t.status === 'play'; n++) E.step(t, [{ dir }], 1 / 60);
    if (q.alive) survivor = true;
  }
  assert(!early, 'no sub-0.1s unavoidable chain death');
  assert(survivor, 'at least one direction escapes after chain floor');
  assert.strictEqual(E.BOSS_CHAIN_MIN, 0.55);
});
t('v10 R9-3 helper never spawns on or next to player', () => {
  const g = E.newStory(16, { seed: 1, difficulty: 'hard' });
  const boss = g.enemies.find(e => e.type === 'boss'), p = g.players[0];
  g.enemies = [boss]; g.bossBombs = false;
  Object.assign(boss, { x: 11, y: 9, tx: 11, ty: 9, dir: null, spawnT: 0 });
  g.map[9][11] = g.map[9][12] = E.FLOOR;
  Object.assign(p, { x: 12, y: 9, tx: 12, ty: 9, shield: 0, inv: 0 });
  E.step(g, [{}], 1 / 60);
  assert(p.alive);
  assert(!g.events.some(e => e.t === 'ko' || e.t === 'lose'));
  g.enemies.forEach(e => {
    if (e.type === 'boss') return;
    assert(Math.abs(e.x - p.x) + Math.abs(e.y - p.y) >= 1.25);
  });
});
t('v10 R9-4 boss bomb not placed on committed hunter tile', () => {
  const g = E.newStory(16, { seed: 3, difficulty: 'medium' });
  for (let y = 1; y < E.H - 1; y++) for (let x = 1; x < E.W - 1; x++) if (g.map[y][x] === E.CRATE) g.map[y][x] = E.FLOOR;
  const boss = g.enemies.find(e => e.type === 'boss'), ch = g.enemies.find(e => e.type === 'chaser'), p = g.players[0];
  Object.assign(p, { x: 9, y: 5, tx: 9, ty: 5, inv: 99 });
  Object.assign(boss, { x: 12, y: 5, tx: 12, ty: 5, bombCD: 0 });
  Object.assign(ch, { x: 7.1, y: 5, tx: 8, ty: 5, dir: 'r', speed: 2.5 });
  g.enemies = [boss, ch];
  const placed = E.placeBossBomb(g, boss);
  if (placed) assert(!g.bombs.some(b => b.fromBoss && b.x === 8 && b.y === 5));
});
t('v10 best score sanitized', () => {
  const mem = {}; const st = { getItem: k => mem[k] ?? null, setItem: (k, v) => mem[k] = String(v) };
  mem[S.KEY] = JSON.stringify({ v: S.VERSION, best: 'Infinity', settings: { muted: false, difficulty: 'medium', calm: false }, story: null });
  assert.strictEqual(S.read(st).best, 0);
  mem[S.KEY] = JSON.stringify({ v: S.VERSION, best: -12, settings: { muted: false, difficulty: 'medium', calm: false }, story: null });
  assert.strictEqual(S.read(st).best, 0);
});

console.log('unit tests passed:', n);
