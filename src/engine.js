// Blast Maze game engine: pure logic, no DOM. Works in the browser (window.BM.Engine) and in Node (module.exports).
(function (root) {
  'use strict';
  var W = 15, H = 13, FLOOR = 0, WALL = 1, CRATE = 2;
  var BOMB_TIME = 2.4, FLAME_TIME = 0.55, KICK_SPEED = 9, STORY_TIME = 300, SHRINK_AT = 70, SHRINK_STEP = 0.3, BATTLE_TIME = 120;
  var DIRS = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] }, DKEYS = ['u', 'd', 'l', 'r'], OPP = { u: 'd', d: 'u', l: 'r', r: 'l' };
  var POWERS = ['bomb', 'fire', 'speed', 'kick', 'shield'];
  var DIFF = {
    easy: { espeed: 0.8, chase: 0.25, cpuMiss: 0.35, cpuThink: 0.45, lives: 5 },
    medium: { espeed: 1.0, chase: 0.55, cpuMiss: 0.12, cpuThink: 0.2, lives: 3 },
    hard: { espeed: 1.2, chase: 0.85, cpuMiss: 0.0, cpuThink: 0.05, lives: 2 }
  };
  var ETYPES = { blob: { speed: 1.9, pts: 100 }, chaser: { speed: 2.3, pts: 200 }, ghost: { speed: 1.7, pts: 300, ghost: true }, boss: { speed: 1.5, pts: 2000, hp: 6 } };
  // 12 story levels. b=blob, c=chaser, g=ghost, boss=true. crates = density.
  var LEVELS = [
    { name: 'Sunny Start', crates: 0.45, b: 2, c: 0, g: 0 },
    { name: 'Crate Garden', crates: 0.55, b: 3, c: 0, g: 0 },
    { name: 'Busy Blobs', crates: 0.55, b: 4, c: 0, g: 0 },
    { name: 'Here They Come', crates: 0.5, b: 2, c: 2, g: 0 },
    { name: 'Tight Corners', crates: 0.65, b: 3, c: 2, g: 0 },
    { name: 'Big Bolt Boss', crates: 0.3, b: 0, c: 0, g: 0, boss: true },
    { name: 'Spooky Floaters', crates: 0.55, b: 2, c: 0, g: 2 },
    { name: 'Mixed Bag', crates: 0.6, b: 2, c: 2, g: 1 },
    { name: 'Chase Lane', crates: 0.5, b: 0, c: 4, g: 1 },
    { name: 'Ghost Town', crates: 0.6, b: 1, c: 1, g: 4 },
    { name: 'Crowded Maze', crates: 0.55, b: 3, c: 3, g: 2 },
    { name: 'Mega Bolt Finale', crates: 0.35, b: 0, c: 1, g: 1, boss: true }
  ];

  // Seeded RNG (mulberry32).
  function RNG(seed) { var s = seed >>> 0; var f = function () { s = (s + 0x6D2B79F5) >>> 0; var t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; f.int = function (n) { return Math.floor(f() * n); }; f.pick = function (a) { return a[f.int(a.length)]; }; f.state = function () { return s; }; return f; }

  function grid(v) { var g = []; for (var y = 0; y < H; y++) { g.push([]); for (var x = 0; x < W; x++) g[y].push(v); } return g; }
  var CORNERS = [[1, 1], [W - 2, H - 2], [W - 2, 1], [1, H - 2]];
  function safeZone(x, y, spawns) { for (var i = 0; i < spawns.length; i++) { var dx = Math.abs(x - spawns[i][0]), dy = Math.abs(y - spawns[i][1]); if (dx <= 2 && dy <= 2 && dx + dy <= 3) return true; } return false; }

  function makeMap(rng, density, spawns, keep) {
    var map = grid(FLOOR), items = grid(null);
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1 || (x % 2 === 0 && y % 2 === 0)) map[y][x] = WALL;
      else if (!safeZone(x, y, spawns) && !(keep && keep(x, y)) && rng() < density) { map[y][x] = CRATE; if (rng() < 0.3) items[y][x] = rng.pick(POWERS); }
    }
    return { map: map, items: items };
  }

  function makePlayer(id, c, opts) {
    return { id: id, kind: 'player', x: c[0], y: c[1], tx: c[0], ty: c[1], dir: null, face: 'd', speed: 3.2, speedUps: 0, bombs: 1, range: 2, kick: false, shield: 0, inv: 0, alive: true, live: 0,
      human: !!opts.human, cpu: !opts.human, color: opts.color, name: opts.name, passBomb: null, wins: 0, pts: 0, think: 0, cpuDir: null, anim: 0 };
  }
  function makeEnemy(id, type, x, y, diff) {
    var t = ETYPES[type]; return { id: id, kind: 'enemy', type: type, x: x, y: y, tx: x, ty: y, dir: null, face: 'd', speed: t.speed * DIFF[diff].espeed, ghost: !!t.ghost, hp: t.hp || 1, inv: 0, alive: true, spawnT: 7, anim: 0, brain: true };
  }
  var COLORS = ['#3fa9ff', '#ff6b6b', '#5fd36a', '#ffc93c'], NAMES = ['Blue', 'Red', 'Green', 'Gold'];

  function base(mode, seed, diff) {
    return { mode: mode, seed: seed, rng: RNG(seed), diff: diff, t: 0, bombs: [], flames: grid(0), flameOwner: grid(null), players: [], enemies: [], items: null, map: null, events: [], status: 'play', nextId: 1, score: 0, endT: 0, shake: 0 };
  }

  function newStory(level, opts) {
    opts = opts || {}; var diff = opts.difficulty || 'medium', L = LEVELS[level], seed = ((opts.seed || 1) * 1000 + level * 7919) >>> 0;
    var g = base('story', seed, diff); g.level = level; g.levelName = L.name; g.timeLeft = STORY_TIME;
    var rng = g.rng, portal;
    var far = [];
    for (var y = 1; y < H - 1; y++) for (var x = 1; x < W - 1; x++) if (!(x % 2 === 0 && y % 2 === 0) && x + y >= 12) far.push([x, y]);
    portal = rng.pick(far);
    var m = makeMap(rng, L.crates, [CORNERS[0]], function (x, y) { return x === portal[0] && y === portal[1]; });
    g.map = m.map; g.items = m.items; g.portal = { x: portal[0], y: portal[1], open: false };
    var p = makePlayer(g.nextId++, CORNERS[0], { human: true, color: COLORS[0], name: 'You' });
    var c = opts.carry; if (c) { p.bombs = c.bombs; p.range = c.range; p.speedUps = c.speedUps; p.speed = 3.2 + 0.5 * c.speedUps; p.kick = c.kick; p.shield = c.shield; }
    g.players.push(p); g.lives = c ? c.lives : DIFF[diff].lives; g.score = c ? c.score : 0;
    var spots = [];
    for (y = 1; y < H - 1; y++) for (x = 1; x < W - 1; x++) if (g.map[y][x] === FLOOR && x + y >= 11 && !(x === portal[0] && y === portal[1])) spots.push([x, y]);
    function place(type) { var i = rng.int(spots.length), s = spots.splice(i, 1)[0]; unbox(g, s[0], s[1], 6); g.enemies.push(makeEnemy(g.nextId++, type, s[0], s[1], diff)); }
    if (L.boss) { var bx = W - 4 + (W % 2 ? 1 : 0), by = H - 4 + 1; g.map[by][bx] = FLOOR; g.items[by][bx] = null; g.enemies.push(makeEnemy(g.nextId++, 'boss', bx, by, diff)); }
    for (var i = 0; i < L.b; i++) place('blob'); for (i = 0; i < L.c; i++) place('chaser'); for (i = 0; i < L.g; i++) place('ghost');
    return g;
  }

  // Make sure an enemy starts with room to roam: open crates next to its pocket until the pocket has n floor tiles.
  function unbox(g, sx, sy, n) {
    for (var guard = 0; guard < 20; guard++) {
      var seen = {}, q = [[sx, sy]], region = []; seen[sx + ',' + sy] = 1;
      while (q.length) { var c = q.pop(); region.push(c); DKEYS.forEach(function (k) { var d = DIRS[k], nx = c[0] + d[0], ny = c[1] + d[1]; if (!seen[nx + ',' + ny] && g.map[ny][nx] === FLOOR) { seen[nx + ',' + ny] = 1; q.push([nx, ny]); } }); }
      if (region.length >= n) return region.length;
      var opened = false; for (var i = 0; i < region.length && !opened; i++) for (var j = 0; j < 4 && !opened; j++) { var d = DIRS[DKEYS[j]], x = region[i][0] + d[0], y = region[i][1] + d[1]; if (g.map[y][x] === CRATE) { g.map[y][x] = FLOOR; g.items[y][x] = null; opened = true; } }
      if (!opened) return region.length;
    }
  }
  function openTiles(g) { var n = 0; for (var y = 1; y < H - 1; y++) for (var x = 1; x < W - 1; x++) if (g.map[y][x] !== WALL) n++; return n; }
  function spiral() { var out = [], x0 = 1, y0 = 1, x1 = W - 2, y1 = H - 2; while (x0 <= x1 && y0 <= y1) { for (var x = x0; x <= x1; x++) out.push([x, y0]); for (var y = y0 + 1; y <= y1; y++) out.push([x1, y]); if (y0 < y1) for (x = x1 - 1; x >= x0; x--) out.push([x, y1]); if (x0 < x1) for (y = y1 - 1; y > y0; y--) out.push([x0, y]); x0++; y0++; x1--; y1--; } return out; }
  function newBattle(opts) {
    opts = opts || {}; var diff = opts.difficulty || 'medium', humans = Math.max(1, Math.min(2, opts.humans || 1)), cpus = Math.max(1, Math.min(4 - humans, opts.cpus == null ? 3 : opts.cpus));
    var g = base('battle', (opts.seed || 1) >>> 0, diff); g.round = opts.round || 1; g.timeLeft = BATTLE_TIME; g.shrink = spiral(); g.shrinkI = 0; g.shrinkT = 0;
    var n = humans + cpus, spawns = CORNERS.slice(0, n);
    var m = makeMap(g.rng, 0.6, spawns); g.map = m.map; g.items = m.items;
    for (var i = 0; i < n; i++) { var p = makePlayer(g.nextId++, spawns[i], { human: i < humans, color: COLORS[i], name: i < humans ? (humans > 1 ? 'Player ' + (i + 1) : 'You') : 'CPU ' + NAMES[i] }); if (opts.wins) p.wins = opts.wins[i] || 0; g.players.push(p); }
    return g;
  }

  function tileAt(e) { return [Math.round(e.x), Math.round(e.y)]; }
  function bombAt(g, x, y) { for (var i = 0; i < g.bombs.length; i++) { var b = g.bombs[i]; if (b.x === x && b.y === y) return b; } return null; }
  function passable(g, e, x, y) {
    if (x < 0 || y < 0 || x >= W || y >= H) return false; var t = g.map[y][x];
    if (t === WALL) return false; if (t === CRATE && !e.ghost) return false;
    var b = bombAt(g, x, y); if (b && !(e.passBomb === b.id)) return false;
    if (e.kind === 'enemy') for (var i = 0; i < g.enemies.length; i++) { var o = g.enemies[i]; if (o !== e && o.alive && ((o.tx === x && o.ty === y) || (Math.round(o.x) === x && Math.round(o.y) === y))) return false; }
    return true;
  }

  // Move an entity tile to tile. want = desired dir or null.
  function moveEnt(g, e, want, dt) {
    var dist = e.speed * dt;
    for (var k = 0; k < 3 && dist > 1e-9; k++) {
      var at = e.x === e.tx && e.y === e.ty;
      if (at) {
        if (k > 0 && e.brain) return;
        if (e.passBomb != null) { var pb = bombAt(g, e.tx, e.ty); if (!pb || pb.id !== e.passBomb) e.passBomb = null; }
        if (!want) { e.dir = null; return; }
        var d = DIRS[want], nx = e.tx + d[0], ny = e.ty + d[1]; e.face = want;
        if (!passable(g, e, nx, ny)) {
          var b = bombAt(g, nx, ny);
          if (b && e.kick && !b.slide && e.kind === 'player') { b.slide = want; b.sp = 0; g.events.push({ t: 'kick', x: nx, y: ny }); }
          e.dir = null; return;
        }
        e.tx = nx; e.ty = ny; e.dir = want;
      } else if (want && want === OPP[e.dir]) {
        var od = DIRS[e.dir]; e.tx -= od[0]; e.ty -= od[1]; e.dir = want; e.face = want;
      }
      var dx = e.tx - e.x, dy = e.ty - e.y, len = Math.abs(dx) + Math.abs(dy);
      if (len <= dist) { e.x = e.tx; e.y = e.ty; dist -= len; } else { e.x += Math.sign(dx) * dist; e.y += Math.sign(dy) * dist; dist = 0; }
      // leaving a bomb tile clears pass permission
      if (e.passBomb != null) { var t = tileAt(e), pb2 = bombAt(g, t[0], t[1]); if (!pb2 || pb2.id !== e.passBomb) { if (!(bombAt(g, e.tx, e.ty) && bombAt(g, e.tx, e.ty).id === e.passBomb)) e.passBomb = null; } }
    }
    e.anim += dt * e.speed;
  }

  function placeBomb(g, p) {
    var t = tileAt(p); if (!p.alive) return false;
    var active = 0; for (var i = 0; i < g.bombs.length; i++) if (g.bombs[i].owner === p.id) active++;
    if (active >= p.bombs || bombAt(g, t[0], t[1]) || g.map[t[1]][t[0]] !== FLOOR) return false;
    var b = { id: g.nextId++, x: t[0], y: t[1], ox: 0, oy: 0, timer: BOMB_TIME, range: p.range, owner: p.id, slide: null, sp: 0 };
    g.bombs.push(b); p.passBomb = b.id;
    for (i = 0; i < g.players.length; i++) { var o = g.players[i], ot = tileAt(o); if (o !== p && ot[0] === t[0] && ot[1] === t[1]) o.passBomb = b.id; }
    g.events.push({ t: 'place', x: t[0], y: t[1] }); return true;
  }

  function blastTiles(g, x, y, range, map) {
    map = map || g.map; var out = [[x, y, 'c']];
    DKEYS.forEach(function (k) { var d = DIRS[k]; for (var i = 1; i <= range; i++) { var nx = x + d[0] * i, ny = y + d[1] * i, t = map[ny][nx]; if (t === WALL) break; out.push([nx, ny, k, i === range]); if (t === CRATE) break; } });
    return out;
  }

  function explode(g, b) {
    var idx = g.bombs.indexOf(b); if (idx < 0) return; g.bombs.splice(idx, 1);
    var tiles = blastTiles(g, b.x, b.y, b.range), broke = 0;
    tiles.forEach(function (t) {
      var x = t[0], y = t[1]; g.flames[y][x] = FLAME_TIME; g.flameOwner[y][x] = b.owner;
      if (g.map[y][x] === CRATE) { g.map[y][x] = FLOOR; broke++; g.events.push({ t: 'crate', x: x, y: y }); var ow = byId(g, b.owner); if (ow) ow.pts += 10; if (g.items[y][x]) g.events.push({ t: 'reveal', x: x, y: y }); g.score += 10; }
      var o = bombAt(g, x, y); if (o && o.timer > 0) o.timer = 0;
    });
    g.events.push({ t: 'boom', x: b.x, y: b.y, tiles: tiles, owner: b.owner }); g.shake = Math.min(1, g.shake + 0.45);
  }

  function byId(g, id) { for (var i = 0; i < g.players.length; i++) if (g.players[i].id === id) return g.players[i]; return null; }
  function hit(g, e) {
    if (!e.alive || e.inv > 0) return;
    if (e.kind === 'player' && e.shield > 0) { e.shield--; e.inv = 2; g.events.push({ t: 'shield', x: e.x, y: e.y }); return; }
    if (e.kind === 'enemy' && e.hp > 1) { e.hp--; e.inv = 1.3; g.events.push({ t: 'bosshit', x: e.x, y: e.y }); g.shake = 1; return; }
    e.alive = false; e.deadT = 0; e.diedAt = g.t; var t0 = tileAt(e), kb = byId(g, g.flameOwner[t0[1]][t0[0]]); if (kb && kb !== e && g.flames[t0[1]][t0[0]] > 0) kb.pts += 100; g.events.push({ t: e.kind === 'player' ? 'ko' : 'pop', x: e.x, y: e.y, id: e.id, type: e.type });
    if (e.kind === 'enemy') g.score += ETYPES[e.type].pts;
  }

  function enemyThink(g, e) {
    var D = DIFF[g.diff], p = g.players[0], opts = DKEYS.filter(function (k) { var d = DIRS[k]; return passable(g, e, e.tx + d[0], e.ty + d[1]); });
    if (!opts.length) return null;
    var chase = e.type === 'chaser' ? D.chase : e.type === 'boss' ? D.chase * 0.8 : e.type === 'ghost' ? D.chase * 0.5 : 0.05;
    if (p && p.alive && g.rng() < chase) {
      // step toward player (BFS for walkers, greedy for ghosts)
      var step = e.ghost ? null : bfsStep(g, e, [Math.round(p.x), Math.round(p.y)], 12);
      if (step && opts.indexOf(step) >= 0) return step;
      var best = null, bd = 1e9; opts.forEach(function (k) { var d = DIRS[k], dd = Math.abs(e.tx + d[0] - p.x) + Math.abs(e.ty + d[1] - p.y); if (dd < bd) { bd = dd; best = k; } });
      if (best) return best;
    }
    if (e.dir && opts.indexOf(e.dir) >= 0 && g.rng() < 0.75) return e.dir;
    var nb = opts.filter(function (k) { return k !== OPP[e.dir]; }); return g.rng.pick(nb.length ? nb : opts);
  }
  function bfsStep(g, e, goal, maxD) {
    var sx = e.tx, sy = e.ty, seen = {}, q = [[sx, sy, null, 0]]; seen[sx + ',' + sy] = 1;
    while (q.length) { var c = q.shift(); if (c[0] === goal[0] && c[1] === goal[1]) return c[2]; if (c[3] >= maxD) continue;
      for (var i = 0; i < 4; i++) { var k = DKEYS[i], d = DIRS[k], nx = c[0] + d[0], ny = c[1] + d[1], key = nx + ',' + ny; if (seen[key] || !passable(g, e, nx, ny)) continue; seen[key] = 1; q.push([nx, ny, c[2] || k, c[3] + 1]); } }
    return null;
  }

  // ---------- CPU / bot brain ----------
  function dangerMap(g, extra) {
    var dm = grid(Infinity), bombs = g.bombs.map(function (b) { return { x: b.x, y: b.y, timer: b.timer, range: b.range }; });
    if (extra) bombs.push(extra);
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) if (g.flames[y][x] > 0) dm[y][x] = 0;
    if (g.mode === 'battle' && g.timeLeft <= SHRINK_AT + 3) for (var si = g.shrinkI; si < Math.min(g.shrink.length - 1, g.shrinkI + 14); si++) { var sc = g.shrink[si]; dm[sc[1]][sc[0]] = Math.min(dm[sc[1]][sc[0]], 0.8); }
    bombs.sort(function (a, b) { return a.timer - b.timer; });
    for (var pass = 0; pass < 2; pass++) bombs.forEach(function (b) {
      var t = Math.min(b.timer, dm[b.y][b.x]); b.timer = t;
      blastTiles(g, b.x, b.y, b.range).forEach(function (s) { if (t < dm[s[1]][s[0]]) dm[s[1]][s[0]] = t; });
    });
    return dm;
  }
  function threatMap(g, p) {
    var tm = grid(false); if (g.mode !== 'story') return tm;
    g.enemies.forEach(function (e) { if (!e.alive) return; [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { [[Math.round(e.x), Math.round(e.y)], [e.tx, e.ty]].forEach(function (c) { var x = c[0] + d[0], y = c[1] + d[1]; if (x >= 0 && y >= 0 && x < W && y < H) tm[y][x] = true; }); }); });
    return tm;
  }
  // BFS over walkable tiles; returns array of nodes {x,y,first,d}
  function reach(g, p, dm, tm, maxD, strict) {
    var st = 1 / p.speed, out = [], seen = grid(false), q = [{ x: p.tx, y: p.ty, first: null, d: 0 }]; seen[p.ty][p.tx] = true;
    while (q.length) { var c = q.shift(); out.push(c); if (c.d >= maxD) continue;
      for (var i = 0; i < 4; i++) { var k = DKEYS[i], d = DIRS[k], nx = c.x + d[0], ny = c.y + d[1]; if (seen[ny][nx] || !passable(g, p, nx, ny)) continue;
        var arrive = (c.d + 1) * st + 0.1; if (dm && (strict ? dm[ny][nx] < Infinity : dm[ny][nx] <= arrive + 0.3)) continue; if (tm && tm[ny][nx] && c.d < 3) continue;
        seen[ny][nx] = true; q.push({ x: nx, y: ny, first: c.first || k, d: c.d + 1 }); } }
    return out;
  }
  function targetsInLine(g, p, x, y) {
    var n = 0, crates = 0; blastTiles(g, x, y, p.range).forEach(function (s) {
      if (g.map[s[1]][s[0]] === CRATE) crates++;
      var list = g.mode === 'story' ? g.enemies : g.players; list.forEach(function (o) { if (o !== p && o.alive && Math.round(o.x) === s[0] && Math.round(o.y) === s[1]) n++; });
    }); return { foes: n, crates: crates };
  }
  function cpuInput(g, p, dt) {
    var D = DIFF[g.diff]; if (!p.alive) return { dir: null, bomb: false };
    if (!(p.x === p.tx && p.y === p.ty)) return { dir: p.cpuDir, bomb: false };
    p.think -= dt; if (p.think > 0 && p.cpuDir == null && !p.bot) return { dir: null, bomb: false };
    var isBot = p.bot, miss = isBot ? 0 : D.cpuMiss;
    var dm = dangerMap(g), tm = threatMap(g, p), here = dm[p.ty][p.tx], inDanger = here < Infinity || tm[p.ty][p.tx] && g.mode === 'story';
    var nodes = reach(g, p, dm, null, 60, !(here < Infinity)), safe = function (n) { return dm[n.y][n.x] === Infinity && !(tm[n.y][n.x]); };
    if (inDanger) {
      var s = nodes.filter(safe)[0]; p.cpuDir = s ? s.first : null; return { dir: p.cpuDir, bomb: false };
    }
    // Consider placing a bomb
    var tl = targetsInLine(g, p, p.tx, p.ty);
    var active = g.bombs.filter(function (b) { return b.owner === p.id; }).length;
    if ((tl.foes > 0 || tl.crates > 0) && active < p.bombs && !bombAt(g, p.tx, p.ty) && g.rng() >= miss) {
      var dm2 = dangerMap(g, { x: p.tx, y: p.ty, timer: BOMB_TIME, range: p.range });
      var save = p.passBomb; p.passBomb = -1; var fake = { id: -1, x: p.tx, y: p.ty }; g.bombs.push(fake);
      var esc = reach(g, p, dm2, tm, 10).filter(function (n) { return dm2[n.y][n.x] === Infinity && !tm[n.y][n.x] && n.d * (1 / p.speed) < BOMB_TIME - 0.6; });
      g.bombs.pop(); p.passBomb = save;
      if (esc.length) { p.cpuDir = esc[0].first; p.think = D.cpuThink * (isBot ? 0 : 1); return { dir: null, bomb: true }; }
    }
    var cand = nodes.filter(function (n) { return safe(n) && !(tm[n.y][n.x]); });
    var goal = null;
    // power-ups nearby
    cand.forEach(function (n) { if (!goal && n.d > 0 && n.d <= 7 && g.items[n.y][n.x] && g.map[n.y][n.x] === FLOOR) goal = n; });
    if (!goal && g.mode === 'story' && g.portal.open) cand.forEach(function (n) { if (!goal && n.x === g.portal.x && n.y === g.portal.y) goal = n; });
    if (g.mode === 'battle' && !goal) { var foe = null, fd = 1e9; g.players.forEach(function (o) { if (o !== p && o.alive) { var dd = Math.abs(o.x - p.x) + Math.abs(o.y - p.y); if (dd < fd) { fd = dd; foe = o; } } });
      if (foe && (fd <= 7 || g.timeLeft < 90) && g.rng() > miss) { var bh = 1e9; cand.forEach(function (n) { var t = targetsInLine(g, p, n.x, n.y), dd = Math.abs(n.x - foe.x) + Math.abs(n.y - foe.y) + n.d * 0.3 - (t.foes ? 4 : 0); if (n.d > 0 && dd < bh) { bh = dd; goal = n; } }); } }
    if (!goal) { var best = -1; cand.forEach(function (n) { if (n.d === 0 && !isBot) return; var t = targetsInLine(g, p, n.x, n.y), sc = t.foes * 6 + Math.min(t.crates, 3) - n.d * 0.35; if (n.d === 0) sc -= 2; if ((t.foes || t.crates) && sc > best) { best = sc; goal = n; } }); }
    if (!goal && g.mode === 'battle') { var foes = g.players.filter(function (o) { return o !== p && o.alive; }); if (foes.length) { var f = foes[0], bd = 1e9; cand.forEach(function (n) { var dd = Math.abs(n.x - f.x) + Math.abs(n.y - f.y); if (dd < bd) { bd = dd; goal = n; } }); } }
    if (!goal && g.mode === 'story') { var en = g.enemies.filter(function (e) { return e.alive; })[0]; if (en) { var bd2 = 1e9; cand.forEach(function (n) { var dd = Math.abs(n.x - en.x) + Math.abs(n.y - en.y) + (dd < 3 ? 5 : 0); if (dd < bd2 && dd >= 3) { bd2 = dd; goal = n; } }); } }
    if (!goal && p.goal) cand.forEach(function (n) { if (n.x === p.goal[0] && n.y === p.goal[1]) goal = n; });
    if (!goal && cand.length > 1) goal = g.rng.pick(cand.slice(1));
    p.goal = goal ? [goal.x, goal.y] : null;
    p.cpuDir = goal && goal.d > 0 ? goal.first : null;
    if (g.rng() < miss * 0.3 && p.cpuDir) p.cpuDir = g.rng.pick(DKEYS);
    p.think = D.cpuThink * (isBot ? 0 : 1) * (0.5 + g.rng());
    // never step into a dangerous tile
    if (p.cpuDir) { var dd3 = DIRS[p.cpuDir], nxx = p.tx + dd3[0], nyy = p.ty + dd3[1]; if (dm[nyy][nxx] < 1.2 || (tm[nyy][nxx] && g.mode === 'story')) p.cpuDir = null; }
    return { dir: p.cpuDir, bomb: false };
  }

  // ---------- Main step ----------
  function step(g, inputs, dt) {
    g.events = []; if (g.status !== 'play') { g.endT += dt; return g; }
    g.t += dt; g.timeLeft -= dt; g.shake = Math.max(0, g.shake - dt * 2.2);
    inputs = inputs || [];
    // players
    var hi = 0;
    g.players.forEach(function (p) {
      if (!p.alive) { p.deadT += dt; return; }
      var inp = p.human && !p.bot ? (inputs[hi++] || {}) : cpuInput(g, p, dt);
      if (p.human && p.bot) hi++;
      if (inp.bomb) placeBomb(g, p);
      p.brain = !p.human || p.bot; moveEnt(g, p, inp.dir || null, dt);
      if (p.inv > 0) p.inv -= dt;
      var t = tileAt(p), it = g.items[t[1]][t[0]];
      if (it && g.map[t[1]][t[0]] === FLOOR) { g.items[t[1]][t[0]] = null; applyPower(p, it); g.score += 50; p.pts += 20; g.events.push({ t: 'power', x: t[0], y: t[1], kind: it, id: p.id }); }
    });
    // enemies
    g.enemies.forEach(function (e) {
      if (!e.alive) { e.deadT += dt; return; }
      if (e.inv > 0) e.inv -= dt;
      var want = e.dir;
      if (e.x === e.tx && e.y === e.ty) want = enemyThink(g, e);
      moveEnt(g, e, want, dt);
      if (e.type === 'boss') { e.spawnT -= dt; var helpers = g.enemies.filter(function (o) { return o.alive && o.type !== 'boss'; }).length; if (e.spawnT <= 0) { e.spawnT = 12; if (helpers < 2) { var spot = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(function (d) { return [e.tx + d[0], e.ty + d[1]]; }).filter(function (c) { return g.map[c[1]][c[0]] === FLOOR && !bombAt(g, c[0], c[1]); })[0]; if (spot) { g.enemies.push(makeEnemy(g.nextId++, 'blob', spot[0], spot[1], g.diff)); g.events.push({ t: 'summon', x: spot[0], y: spot[1] }); } } } }
    });
    // bombs
    g.bombs.slice().forEach(function (b) {
      if (b.slide) {
        b.sp += KICK_SPEED * dt; while (b.sp >= 1) { var d = DIRS[b.slide], nx = b.x + d[0], ny = b.y + d[1]; var blocked = g.map[ny][nx] !== FLOOR || bombAt(g, nx, ny) || g.players.concat(g.enemies).some(function (o) { return o.alive && Math.round(o.x) === nx && Math.round(o.y) === ny; });
          if (blocked) { b.slide = null; b.sp = 0; break; } b.x = nx; b.y = ny; b.sp -= 1; }
      }
      b.timer -= dt;
    });
    var guard = 0; while (guard++ < 100) { var due = g.bombs.filter(function (b) { return b.timer <= 0; }); if (!due.length) break; due.forEach(function (b) { explode(g, b); }); }
    // flames
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) if (g.flames[y][x] > 0) { g.flames[y][x] -= dt; if (g.flames[y][x] < 0) g.flames[y][x] = 0; }
    g.players.concat(g.enemies).forEach(function (e) { if (!e.alive) return; var t = tileAt(e); if (g.flames[t[1]][t[0]] > 0) hit(g, e); });
    // contact with enemies (story)
    if (g.mode === 'story') g.enemies.forEach(function (e) { if (!e.alive) return; g.players.forEach(function (p) { var r = e.type === 'boss' ? 0.8 : 0.62; if (p.alive && Math.abs(p.x - e.x) + Math.abs(p.y - e.y) < r) hit(g, p); }); });
    // battle sudden death: blocks drop in a spiral from the edge once the clock is low
    if (g.mode === 'battle' && g.timeLeft <= SHRINK_AT) {
      if (!g.shrinking) { g.shrinking = true; g.events.push({ t: 'hurry' }); }
      g.shrinkT -= dt;
      while (g.shrinkT <= 0 && g.shrinkI < g.shrink.length - 1 && openTiles(g) > 7) {
        var c = g.shrink[g.shrinkI++]; if (g.map[c[1]][c[0]] === WALL) continue; g.shrinkT += SHRINK_STEP;
        g.map[c[1]][c[0]] = WALL; g.items[c[1]][c[0]] = null; g.flames[c[1]][c[0]] = 0; var bb = bombAt(g, c[0], c[1]); if (bb) g.bombs.splice(g.bombs.indexOf(bb), 1);
        g.events.push({ t: 'drop', x: c[0], y: c[1] }); g.shake = Math.min(1, g.shake + 0.15);
        g.players.forEach(function (p) { if (p.alive && (tileAt(p)[0] === c[0] && tileAt(p)[1] === c[1] || p.tx === c[0] && p.ty === c[1])) { p.shield = 0; p.inv = 0; hit(g, p); } });
      }
    }
    // outcome
    if (g.mode === 'story') {
      var p = g.players[0];
      var boss = g.enemies.filter(function (e) { return e.type === 'boss'; })[0];
      if (boss && !boss.alive) g.enemies.forEach(function (e) { if (e.alive) { e.alive = false; e.deadT = 0; g.events.push({ t: 'pop', x: e.x, y: e.y, id: e.id, type: e.type }); } });
      if (!g.portal.open && g.enemies.every(function (e) { return !e.alive; })) { g.portal.open = true; g.events.push({ t: 'portal', x: g.portal.x, y: g.portal.y }); }
      if (!p.alive || g.timeLeft <= 0) { if (p.alive) { p.alive = false; p.deadT = 0; g.timeUp = true; } g.status = 'dead'; g.lives--; if (g.lives <= 0) g.status = 'lost'; g.events.push({ t: 'lose' }); }
      else if (g.portal.open && Math.abs(p.x - g.portal.x) + Math.abs(p.y - g.portal.y) < 0.3) { g.status = 'won'; g.score += Math.round(g.timeLeft) * 5; g.events.push({ t: 'win' }); }
    } else {
      var alive = g.players.filter(function (p) { return p.alive; });
      if (alive.length <= 1 || g.timeLeft <= 0) {
        g.status = 'roundover'; var pool = alive.length ? alive : g.players.filter(function (p) { return p.diedAt === g.t; }), w = null;
        if (pool.length === 1) w = pool[0]; else if (pool.length > 1) { pool.sort(function (a, b) { return b.pts - a.pts; }); if (pool[0].pts > pool[1].pts) { w = pool[0]; g.onPoints = true; } }
        g.winner = w ? w.id : null; if (w) w.wins++; g.events.push({ t: w ? 'win' : 'draw' });
      }
    }
    return g;
  }
  function applyPower(p, k) {
    if (k === 'bomb') p.bombs = Math.min(8, p.bombs + 1);
    else if (k === 'fire') p.range = Math.min(8, p.range + 1);
    else if (k === 'speed') { if (p.speedUps < 4) { p.speedUps++; p.speed = 3.2 + 0.5 * p.speedUps; } }
    else if (k === 'kick') p.kick = true;
    else if (k === 'shield') p.shield = Math.min(2, p.shield + 1);
  }
  function carry(g) { var p = g.players[0]; return { bombs: p.bombs, range: p.range, speedUps: p.speedUps, kick: p.kick, shield: p.shield, lives: g.lives, score: g.score }; }
  // Solvability: flood fill over non-wall tiles from player spawn reaches every enemy and the portal.
  function solvable(g) {
    var seen = grid(false), q = [[1, 1]]; seen[1][1] = true;
    while (q.length) { var c = q.pop(); DKEYS.forEach(function (k) { var d = DIRS[k], nx = c[0] + d[0], ny = c[1] + d[1]; if (g.map[ny][nx] !== WALL && !seen[ny][nx]) { seen[ny][nx] = true; q.push([nx, ny]); } }); }
    return seen[g.portal.y][g.portal.x] && g.enemies.every(function (e) { return seen[e.ty][e.tx]; });
  }

  var api = { W: W, H: H, FLOOR: FLOOR, WALL: WALL, CRATE: CRATE, BOMB_TIME: BOMB_TIME, FLAME_TIME: FLAME_TIME, STORY_TIME: STORY_TIME, SHRINK_AT: SHRINK_AT, unbox: unbox, BATTLE_TIME: BATTLE_TIME, LEVELS: LEVELS, POWERS: POWERS, DIFF: DIFF, ETYPES: ETYPES, COLORS: COLORS,
    RNG: RNG, newStory: newStory, newBattle: newBattle, step: step, placeBomb: placeBomb, blastTiles: blastTiles, passable: passable, bombAt: bombAt, applyPower: applyPower, carry: carry, solvable: solvable, cpuInput: cpuInput, hit: hit };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else { root.BM = root.BM || {}; root.BM.Engine = api; }
})(this);
