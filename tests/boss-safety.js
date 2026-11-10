// Fuzz/sim gate: boss bombs must never create a sub-reaction unavoidable death.
// "Unavoidable" means every immediate direction dies to the blast itself (enemies removed).
const E = require('../src/engine.js'), assert = require('assert');
const DT = 1 / 60, SEEDS = +(process.env.SEEDS || 40);

function clearCrates(g) {
  for (let y = 1; y < E.H - 1; y++) for (let x = 1; x < E.W - 1; x++) if (g.map[y][x] === E.CRATE) g.map[y][x] = E.FLOOR;
}

function bombOnlyFate(g) {
  const raw = JSON.stringify(g, (k, v) => (typeof v === 'function' ? undefined : v));
  let survivor = false, early = 0;
  for (const dir of [null, 'u', 'd', 'l', 'r']) {
    const t = JSON.parse(raw);
    t.rng = E.RNG((t.seed || 1) >>> 0);
    t.enemies.forEach(e => { e.alive = false; }); // isolate bomb fairness from contact
    const p = t.players[0];
    for (let n = 0; n < 10 && t.status === 'play'; n++) E.step(t, [{ dir }], DT);
    if (!p.alive && t.t <= 0.12) early++;
    for (let n = 0; n < 180 && t.status === 'play'; n++) E.step(t, [{ dir }], DT);
    if (p.alive) survivor = true;
  }
  return { unavoidable: !survivor, earlyAll: early === 5 };
}

let placed = 0, checked = 0;
for (const lv of [16, 21]) for (const diff of ['easy', 'medium', 'hard']) for (let s = 1; s <= SEEDS; s++) {
  const g = E.newStory(lv, { seed: s, difficulty: diff, carry: { bombs: 3, range: 3, speedUps: 1, kick: false, shield: 0, lives: 3, score: 0 } });
  clearCrates(g);
  const boss = g.enemies.find(e => e.type === 'boss');
  const p = g.players[0];
  if (s % 3 === 0) {
    g.bombs.push({ id: g.nextId++, x: Math.max(1, Math.min(E.W - 2, p.tx - 3)), y: p.ty, timer: 0.05 + (s % 5) * 0.02, range: 2 + (s % 2), owner: p.id, slide: null, sp: 0 });
  }
  boss.bombCD = 0; boss.x = boss.tx; boss.y = boss.ty;
  p.inv = 0; p.shield = 0;
  p.x = p.tx = 5 + (s % 5); p.y = p.ty = 3 + (s % 4);
  if (g.map[p.ty][p.tx] !== E.FLOOR) { p.x = p.tx = 5; p.y = p.ty = 5; }
  if (E.placeBossBomb(g, boss)) {
    placed++;
    const bb = g.bombs.find(b => b.fromBoss);
    assert(bb && E.playerHasBombEscape(g, bb.x, bb.y, bb.range, bb.timer), 'placed bomb must still pass escape check');
    const r = bombOnlyFate(g);
    checked++;
    assert(!r.earlyAll, 'sub-reaction unavoidable death L' + (lv + 1) + ' ' + diff + ' seed ' + s);
    assert(!r.unavoidable, 'unavoidable boss-bomb blast L' + (lv + 1) + ' ' + diff + ' seed ' + s);
  }
}

// QA natural controller seed: corner bomb must not make every direction die to the blast
{
  const seed = 20324378;
  const g = E.newStory(16, { seed, difficulty: 'medium' });
  for (let i = 0; i < 93; i++) E.step(g, [{ dir: 'r' }], DT);
  for (let i = 0; i < 100; i++) E.step(g, [{}], DT);
  assert.strictEqual(E.playerHasBombEscape(g, 4, 1, 2, E.BOMB_TIME), false);
  if (g.bombs.some(b => b.fromBoss)) {
    const r = bombOnlyFate(g);
    assert(!r.unavoidable, 'QA natural trap seed must be escapable from the blast');
  }
}

// QA chain fixture: no sub-0.1s all-direction death
{
  const g = E.newStory(16, { seed: 3, difficulty: 'medium' });
  clearCrates(g);
  const boss = g.enemies.find(e => e.type === 'boss'), p = g.players[0];
  Object.assign(p, { x: 9, y: 5, tx: 9, ty: 5, shield: 0, inv: 0, speed: 3.2 });
  Object.assign(boss, { x: 11, y: 5, tx: 11, ty: 5, bombCD: 99, speed: 0 });
  g.enemies = [boss];
  g.bombs = [
    { id: 6, x: 5, y: 5, timer: 0.04, range: 3, owner: p.id, slide: null, sp: 0 },
    { id: 7, x: 8, y: 5, timer: 2.4, range: 2, owner: boss.id, fromBoss: true, slide: null, sp: 0 }
  ];
  const r = bombOnlyFate(g);
  assert(!r.earlyAll, 'chain fixture must not all-die under 0.12s');
  assert(!r.unavoidable, 'chain fixture must leave an escape after BOSS_CHAIN_MIN');
}

console.log('ok boss-safety placed', placed, 'checked', checked, 'seeds', SEEDS);
