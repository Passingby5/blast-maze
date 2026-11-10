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
for (const lv of [14, 15, 16, 17, 18, 19, 20, 21]) for (const diff of ['easy', 'medium', 'hard']) for (let s = 1; s <= SEEDS; s++) {
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
  // Mid-move / fractional samples: committed step plus leftover pass on an own bomb
  if (s % 2 === 0) {
    const dirs = ['u', 'd', 'l', 'r'], dir = dirs[s % 4], d = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] }[dir];
    const ox = p.tx - d[0], oy = p.ty - d[1];
    if (ox > 0 && oy > 0 && ox < E.W - 1 && oy < E.H - 1 && g.map[oy][ox] === E.FLOOR) {
      p.dir = dir; p.face = dir;
      p.x = p.tx - d[0] * (0.25 + (s % 5) * 0.08);
      p.y = p.ty - d[1] * (0.25 + (s % 5) * 0.08);
      if (s % 4 === 0 && !g.bombs.some(b => b.x === ox && b.y === oy)) {
        const id = g.nextId++;
        g.bombs.push({ id, x: ox, y: oy, timer: 2.1 + (s % 4) * 0.05, range: 3, owner: p.id, slide: null, sp: 0 });
        p.passBomb = id;
      }
    }
  }
  if (E.placeBossBomb(g, boss)) {
    placed++;
    const bb = g.bombs.find(b => b.fromBoss);
    assert(bb && E.playerHasBombEscape(g, bb.x, bb.y, bb.range, bb.timer), 'placed bomb must still pass escape check');
    const margin = E.escapeReactionMargin(g, bb.x, bb.y, bb.range, bb.timer);
    assert(margin >= E.BOSS_ESCAPE_REACT - 1e-9, 'placement margin ' + margin + ' < ' + E.BOSS_ESCAPE_REACT + ' L' + (lv + 1) + ' ' + diff + ' seed ' + s);
    const r = bombOnlyFate(g);
    checked++;
    assert(!r.earlyAll, 'sub-reaction unavoidable death L' + (lv + 1) + ' ' + diff + ' seed ' + s);
    assert(!r.unavoidable, 'unavoidable boss-bomb blast L' + (lv + 1) + ' ' + diff + ' seed ' + s);
  }
}

// Constructed corridor trap: escape must refuse, and any natural boss bomb must stay escapable
{
  const g = E.newStory(16, { seed: 20324378, difficulty: 'medium' });
  for (let y = 1; y < E.H - 1; y++) for (let x = 1; x < E.W - 1; x++) g.map[y][x] = (x % 2 === 0 && y % 2 === 0) ? E.WALL : E.CRATE;
  for (let y = 1; y <= 11; y++) g.map[y][1] = E.FLOOR;
  const p = g.players[0]; Object.assign(p, { x: 1, y: 5, tx: 1, ty: 5, speed: 3.2, shield: 0, inv: 0 });
  assert.strictEqual(E.playerHasBombEscape(g, 1, 1, 12, E.BOMB_TIME), false);
  // Open play with crates cleared: any placed boss bomb must be bomb-escapable
  const g2 = E.newStory(16, { seed: 20324378, difficulty: 'medium' });
  clearCrates(g2);
  const boss = g2.enemies.find(e => e.type === 'boss');
  boss.bombCD = 0;
  if (E.placeBossBomb(g2, boss)) {
    const r = bombOnlyFate(g2);
    assert(!r.unavoidable, 'placed boss bomb on open map must be escapable from the blast');
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

// R10-1: QA mobile-chain corridor must be rejected
{
  const g = E.newStory(16, { seed: 1, difficulty: 'medium' });
  for (let y = 1; y < E.H - 1; y++) for (let x = 1; x < E.W - 1; x++) if (g.map[y][x] !== E.WALL) g.map[y][x] = E.FLOOR;
  g.map[4][9] = g.map[6][9] = E.CRATE;
  const boss = g.enemies.find(e => e.type === 'boss'), p = g.players[0];
  g.enemies = [boss];
  Object.assign(p, { x: 9, y: 5, tx: 9, ty: 5, speed: 3.2, shield: 0, inv: 0 });
  boss.bombCD = 0;
  g.bombs.push({ id: g.nextId++, x: 5, y: 5, timer: 0.04, range: 3, owner: p.id, slide: null, sp: 0 });
  assert.strictEqual(E.playerHasBombEscape(g, 8, 5, 2, E.BOMB_TIME), false);
  assert(E.escapeReactionMargin(g, 8, 5, 2, E.BOMB_TIME) < E.BOSS_ESCAPE_REACT);
  E.placeBossBomb(g, boss);
  assert(!g.bombs.some(b => b.fromBoss && b.x === 8 && b.y === 5));
}

console.log('ok boss-safety placed', placed, 'checked', checked, 'seeds', SEEDS);
