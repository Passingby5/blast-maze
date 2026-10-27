// Renderer (v4 art): modern 2D look, all procedural vector art drawn at devicePixelRatio so it stays crisp.
// Static floor + walls are pre-rendered once per level into an offscreen layer; crates, power-ups, bombs and glows
// are cached sprites at the exact tile size and DPR. Only characters, flames and particles are drawn live.
(function (root) {
  var E = root.BM.Engine, W = E.W, H = E.H;
  var cv, ctx, dpr = 1, T = 32, bw = 0, bh = 0, vw = 0, vh = 0, camX = 0, camY = 0, camInit = false, staticLayer = null, staticKey = '', parts = [], rings = [], time = 0, banner = null, vignette = null;
  var sprites = {}, reduceMotion = false, theme = null;
  try { reduceMotion = !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { }
  var sysReduce = reduceMotion, userReduce = false;
  function setup(canvas) { cv = canvas; ctx = cv.getContext('2d'); }
  function resize(cssW, cssH, minT) {
    // minT: on phones the board may be bigger than the screen; the view then follows the player (camera).
    dpr = Math.min(3, root.devicePixelRatio || 1); T = Math.floor(Math.max(Math.min(cssW / W, cssH / H), Math.min(minT || 0, cssH / H * 1.25)) * 4) / 4; bw = T * W; bh = T * H;
    vw = Math.min(bw, Math.floor(cssW)); vh = Math.min(bh, Math.floor(cssH)); camInit = false;
    cv.style.width = vw + 'px'; cv.style.height = vh + 'px'; cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr); staticLayer = null; sprites = {}; vignette = null;
    return { w: vw, h: vh, tile: T };
  }
  // ---------- helpers ----------
  function rr(c, x, y, w, h, r) { r = Math.max(0, Math.min(r, w / 2, h / 2)); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function hexA(h, a) { var n = parseInt(h.slice(1), 16); return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; }
  function shade(h, f) { var n = parseInt(h.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255, m = function (v) { return Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f))); }; return 'rgb(' + m(r) + ',' + m(g) + ',' + m(b) + ')'; }
  function hash(x, y, s) { var h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  // Cached sprite: drawn once at tile size x DPR, then blitted. pad = extra tiles around for shadows/glow.
  function sprite(key, wt, ht, pad, fn) {
    var s = sprites[key]; if (s) return s;
    var c = document.createElement('canvas'), pw = (wt + pad * 2) * T, ph = (ht + pad * 2) * T; c.width = Math.ceil(pw * dpr); c.height = Math.ceil(ph * dpr);
    var x = c.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.translate(pad * T, pad * T); fn(x);
    s = sprites[key] = { c: c, w: pw, h: ph, ox: pad * T, oy: pad * T }; return s;
  }
  function blit(c, s, px, py, sc) { if (sc && sc !== 1) { var w = s.w * sc, h = s.h * sc; c.drawImage(s.c, px - s.ox * sc, py - s.oy * sc, w, h); } else c.drawImage(s.c, px - s.ox, py - s.oy, s.w, s.h); }
  function glowSprite(col) { return sprite('glow' + col, 1, 1, 1, function (c) { var g = c.createRadialGradient(T / 2, T / 2, 0, T / 2, T / 2, T * 1.45); g.addColorStop(0, 'rgba(' + col + ',0.85)'); g.addColorStop(0.35, 'rgba(' + col + ',0.35)'); g.addColorStop(1, 'rgba(' + col + ',0)'); c.fillStyle = g; c.fillRect(-T, -T, T * 3, T * 3); }); }
  // ---------- level themes (floor + walls); purely visual ----------
  var THEMES = [
    { name: 'meadow', f: ['#6cc46a', '#62b960'], grout: '#4e9a4f', spot: 'rgba(255,255,255,0.10)', blade: '#4fa152', wall: ['#a9b6cf', '#7d8bab', '#56617f', '#2a2f48'], edge: ['#8b97b3', '#646f8f', '#454e6b', '#232840'], bg: '#2d6b3a' },
    { name: 'desert', f: ['#f0cf8a', '#e8c47a'], grout: '#c99d55', spot: 'rgba(255,255,255,0.14)', blade: '#d6ad65', wall: ['#e6b979', '#c38f52', '#94653a', '#4d321b'], edge: ['#cf9c5f', '#a8763f', '#7a512c', '#3f2814'], bg: '#9c6d36' },
    { name: 'ice', f: ['#d7f0fb', '#c9e7f6'], grout: '#9fcbe2', spot: 'rgba(255,255,255,0.55)', blade: '#b3dcef', wall: ['#e9f7ff', '#9fd2f0', '#6aa6cf', '#2d4f78'], edge: ['#bfe1f5', '#7fb4da', '#4f86b3', '#22406a'], bg: '#5c8fb8' },
    { name: 'volcano', f: ['#7b6a86', '#72627d'], grout: '#55465f', spot: 'rgba(255,170,90,0.10)', blade: '#ff8a3d', wall: ['#7d7489', '#5a5266', '#3d3747', '#1b1722'], edge: ['#6a6176', '#4a4355', '#322c3b', '#15111b'], bg: '#3a2f45' }
  ];
  function themeFor(g) { var i = g.mode === 'story' ? Math.min(3, Math.floor((g.level || 0) / 3)) : ((g.seed || 0) >>> 0) % 4; return THEMES[i] || THEMES[0]; }
  function buildStatic(g) {
    theme = themeFor(g); var th = theme, sd = (g.level || 0) * 31 + 7;
    var c = document.createElement('canvas'); c.width = Math.round(bw * dpr); c.height = Math.round(bh * dpr); var x2 = c.getContext('2d'); x2.setTransform(dpr, 0, 0, dpr, 0, 0);
    x2.fillStyle = th.grout; x2.fillRect(0, 0, bw, bh);
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) drawFloor(x2, x, y, th, sd);
    // ambient occlusion on floor next to walls, then soft drop shadows, then walls
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) if (g.map[y][x] !== E.WALL) aoTile(x2, g, x, y);
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) if (g.map[y][x] === E.WALL) wallShadow(x2, x * T, y * T);
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) if (g.map[y][x] === E.WALL) drawWall(x2, x * T, y * T, x === 0 || y === 0 || x === W - 1 || y === H - 1, th, hash(x, y, sd));
    staticLayer = c;
  }
  function drawFloor(c, x, y, th, sd) {
    var px = x * T, py = y * T, g1 = T * 0.03, v = hash(x, y, sd), even = (x + y) % 2 === 0, base = th.f[even ? 0 : 1];
    var gr = c.createLinearGradient(px, py, px + T, py + T); gr.addColorStop(0, shade(base, 0.06 + v * 0.04)); gr.addColorStop(1, shade(base, -0.06 - v * 0.03));
    c.fillStyle = gr; rr(c, px + g1, py + g1, T - g1 * 2, T - g1 * 2, T * 0.1); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = Math.max(0.5, T * 0.02); c.beginPath(); c.moveTo(px + T * 0.12, py + g1 * 1.6); c.lineTo(px + T * 0.88, py + g1 * 1.6); c.stroke();
    var n = 3 + Math.floor(v * 3);
    for (var i = 0; i < n; i++) {
      var a = hash(x * 7 + i, y * 13 - i, sd + 3), b = hash(x * 11 - i, y * 5 + i, sd + 9), sx = px + T * (0.15 + a * 0.7), sy = py + T * (0.15 + b * 0.7);
      if (th.name === 'meadow') { c.strokeStyle = th.blade; c.lineWidth = T * 0.025; c.lineCap = 'round'; c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx - T * 0.03, sy - T * 0.08); c.moveTo(sx + T * 0.03, sy); c.lineTo(sx + T * 0.05, sy - T * 0.07); c.stroke(); }
      else if (th.name === 'desert') { c.strokeStyle = th.blade; c.lineWidth = T * 0.02; c.beginPath(); c.arc(sx, sy + T * 0.1, T * 0.12, -2.4, -0.7); c.stroke(); }
      else if (th.name === 'ice') { c.fillStyle = th.spot; c.beginPath(); c.arc(sx, sy, T * 0.025, 0, 7); c.fill(); }
      else { c.fillStyle = 'rgba(30,20,40,0.25)'; c.beginPath(); c.arc(sx, sy, T * 0.03, 0, 7); c.fill(); }
    }
    if (th.name === 'meadow' && v > 0.86) { c.fillStyle = v > 0.93 ? '#fff6a8' : '#ffd1e8'; for (var k = 0; k < 5; k++) { var an = k * 1.2566; c.beginPath(); c.arc(px + T * 0.6 + Math.cos(an) * T * 0.04, py + T * 0.4 + Math.sin(an) * T * 0.04, T * 0.03, 0, 7); c.fill(); } c.fillStyle = '#f2a33a'; c.beginPath(); c.arc(px + T * 0.6, py + T * 0.4, T * 0.025, 0, 7); c.fill(); }
    if (th.name === 'volcano' && v > 0.8) { c.strokeStyle = 'rgba(255,120,40,0.55)'; c.lineWidth = T * 0.025; c.beginPath(); c.moveTo(px + T * 0.25, py + T * 0.3); c.lineTo(px + T * 0.42, py + T * 0.48); c.lineTo(px + T * 0.38, py + T * 0.66); c.lineTo(px + T * 0.6, py + T * 0.78); c.stroke(); }
    if (th.name === 'ice' && v > 0.75) { c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = T * 0.02; c.beginPath(); c.moveTo(px + T * 0.2, py + T * 0.75); c.lineTo(px + T * 0.45, py + T * 0.5); c.stroke(); }
  }
  function isWall(g, x, y) { return x < 0 || y < 0 || x >= W || y >= H || g.map[y][x] === E.WALL; }
  function aoTile(c, g, x, y) {
    var px = x * T, py = y * T, d = T * 0.32, gr;
    if (isWall(g, x, y - 1)) { gr = c.createLinearGradient(0, py, 0, py + d); gr.addColorStop(0, 'rgba(0,0,0,0.30)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fillRect(px, py, T, d); }
    if (isWall(g, x - 1, y)) { gr = c.createLinearGradient(px, 0, px + d, 0); gr.addColorStop(0, 'rgba(0,0,0,0.22)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fillRect(px, py, d, T); }
    if (isWall(g, x + 1, y)) { gr = c.createLinearGradient(px + T, 0, px + T - d * 0.6, 0); gr.addColorStop(0, 'rgba(0,0,0,0.14)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fillRect(px + T - d, py, d, T); }
  }
  function wallShadow(c, px, py) { c.fillStyle = 'rgba(10,20,30,0.28)'; rr(c, px + T * 0.1, py + T * 0.16, T, T, T * 0.18); c.fill(); }
  // A beveled 2.5D block: lit top face, darker front lip, outline, texture.
  function drawWall(c, px, py, border, th, v) {
    var C = border ? th.edge : th.wall, o = T * 0.02, lip = T * 0.24, r = T * 0.16;
    c.fillStyle = C[3]; rr(c, px + o, py + o, T - o * 2, T - o * 2, r); c.fill();
    var lw = T * 0.05;
    c.fillStyle = C[2]; rr(c, px + lw, py + lw, T - lw * 2, T - lw * 2, r * 0.8); c.fill();
    var gr = c.createLinearGradient(px, py, px, py + T - lip); gr.addColorStop(0, C[0]); gr.addColorStop(1, C[1]);
    c.fillStyle = gr; rr(c, px + lw, py + lw, T - lw * 2, T - lip - lw, r * 0.8); c.fill();
    c.save(); rr(c, px + lw, py + lw, T - lw * 2, T - lip - lw, r * 0.8); c.clip();
    // texture
    c.strokeStyle = hexA(C[3], 0.28); c.lineWidth = Math.max(0.6, T * 0.025);
    if (th.name === 'ice') { c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = T * 0.04; c.beginPath(); c.moveTo(px + T * 0.2, py + T * 0.55); c.lineTo(px + T * 0.55, py + T * 0.2); c.moveTo(px + T * 0.4, py + T * 0.6); c.lineTo(px + T * 0.7, py + T * 0.3); c.stroke(); }
    else { var my = py + T * 0.4; c.beginPath(); c.moveTo(px, my); c.lineTo(px + T, my); var vx = px + T * (0.35 + v * 0.3); c.moveTo(vx, py); c.lineTo(vx, my); c.moveTo(px + T * (0.2 + v * 0.15), my); c.lineTo(px + T * (0.2 + v * 0.15), py + T); c.moveTo(px + T * (0.7 + v * 0.1), my); c.lineTo(px + T * (0.7 + v * 0.1), py + T); c.stroke();
      c.fillStyle = 'rgba(0,0,0,0.08)'; for (var i = 0; i < 4; i++) { c.beginPath(); c.arc(px + T * (0.2 + hash(i, 3, v * 99) * 0.6), py + T * (0.15 + hash(3, i, v * 77) * 0.45), T * 0.025, 0, 7); c.fill(); } }
    var hl = c.createLinearGradient(px, py, px + T, py + T); hl.addColorStop(0, 'rgba(255,255,255,0.35)'); hl.addColorStop(0.5, 'rgba(255,255,255,0)'); c.fillStyle = hl; c.fillRect(px, py, T, T);
    c.restore();
    c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = T * 0.03; c.lineCap = 'round'; c.beginPath(); c.moveTo(px + T * 0.2, py + lw + T * 0.03); c.lineTo(px + T * 0.8, py + lw + T * 0.03); c.stroke();
    c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(px + T * 0.18, py + T - lip * 0.55, T * 0.64, T * 0.025);
    if (th.name === 'volcano' && !border && v > 0.6) { c.strokeStyle = 'rgba(255,130,50,0.7)'; c.lineWidth = T * 0.025; c.beginPath(); c.moveTo(px + T * 0.3, py + T * 0.15); c.lineTo(px + T * 0.4, py + T * 0.35); c.lineTo(px + T * 0.33, py + T * 0.5); c.stroke(); }
  }
  // ---------- crates (cached sprite) ----------
  function crateSprite() { return sprite('crate', 1, 1, 0.25, function (c) {
    var o = T * 0.06, lip = T * 0.2, r = T * 0.12;
    c.fillStyle = 'rgba(10,20,10,0.32)'; rr(c, o + T * 0.08, o + T * 0.14, T - o * 2, T - o * 2, r); c.fill();
    c.fillStyle = '#4a2a10'; rr(c, o, o, T - o * 2, T - o * 2, r); c.fill();
    var lw = T * 0.045, x0 = o + lw, w = T - (o + lw) * 2, topH = T - o - lw - lip - x0 + T * 0.04;
    c.fillStyle = '#a3622a'; rr(c, x0, x0, w, T - x0 * 2, r * 0.8); c.fill();
    var gr = c.createLinearGradient(0, x0, 0, x0 + topH); gr.addColorStop(0, '#f2b467'); gr.addColorStop(1, '#d48a3e'); c.fillStyle = gr; rr(c, x0, x0, w, topH, r * 0.8); c.fill();
    c.save(); rr(c, x0, x0, w, topH, r * 0.8); c.clip();
    c.strokeStyle = 'rgba(110,55,15,0.55)'; c.lineWidth = T * 0.022; for (var i = 1; i < 3; i++) { var yy = x0 + topH * i / 3; c.beginPath(); c.moveTo(x0, yy); c.lineTo(x0 + w, yy); c.stroke(); }
    c.strokeStyle = 'rgba(120,60,20,0.25)'; c.lineWidth = T * 0.012; for (i = 0; i < 6; i++) { var yy2 = x0 + topH * (0.1 + i * 0.16); c.beginPath(); c.moveTo(x0 + w * 0.1, yy2); c.bezierCurveTo(x0 + w * 0.4, yy2 + T * 0.02, x0 + w * 0.6, yy2 - T * 0.02, x0 + w * 0.9, yy2); c.stroke(); }
    c.strokeStyle = '#8a4c1c'; c.lineWidth = T * 0.07; c.lineCap = 'round'; c.beginPath(); c.moveTo(x0 + w * 0.12, x0 + topH * 0.12); c.lineTo(x0 + w * 0.88, x0 + topH * 0.88); c.stroke();
    c.strokeStyle = 'rgba(255,220,160,0.45)'; c.lineWidth = T * 0.02; c.beginPath(); c.moveTo(x0 + w * 0.14, x0 + topH * 0.08); c.lineTo(x0 + w * 0.9, x0 + topH * 0.82); c.stroke();
    c.restore();
    c.strokeStyle = 'rgba(255,230,180,0.7)'; c.lineWidth = T * 0.025; c.lineCap = 'round'; c.beginPath(); c.moveTo(x0 + T * 0.1, x0 + T * 0.03); c.lineTo(x0 + w - T * 0.1, x0 + T * 0.03); c.stroke();
    c.strokeStyle = 'rgba(70,35,10,0.6)'; c.lineWidth = T * 0.02; c.beginPath(); c.moveTo(x0 + w * 0.33, x0 + topH + T * 0.02); c.lineTo(x0 + w * 0.33, T - x0); c.moveTo(x0 + w * 0.66, x0 + topH + T * 0.02); c.lineTo(x0 + w * 0.66, T - x0); c.stroke();
    // metal corner brackets
    [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(function (k) { var bx = k[0] ? T - x0 - T * 0.17 : x0, by = k[1] ? T - x0 - T * 0.17 : x0; var mg = c.createLinearGradient(0, by, 0, by + T * 0.17); mg.addColorStop(0, '#e6ecf5'); mg.addColorStop(1, '#8e98ab'); c.fillStyle = mg; rr(c, bx, by, T * 0.17, T * 0.17, T * 0.05); c.fill(); c.strokeStyle = '#4b5263'; c.lineWidth = T * 0.015; c.stroke(); c.fillStyle = '#4b5263'; c.beginPath(); c.arc(bx + T * 0.085, by + T * 0.085, T * 0.025, 0, 7); c.fill(); });
  }); }
  // ---------- power-ups (glossy gem tiles, cached) ----------
  var ICON = { bomb: '#3d8bff', fire: '#ff6a2b', speed: '#ffc21a', kick: '#a35cff', shield: '#1fd1b0' };
  function iconGlyph(c, k, u) {
    c.lineCap = 'round'; c.lineJoin = 'round';
    if (k === 'bomb') { c.beginPath(); c.arc(0, 0, u * 0.85, 0, 7); c.fill(); c.lineWidth = u * 0.16; c.beginPath(); c.moveTo(-u * 1.05, -u * 0.15); c.lineTo(u * 1.05, -u * 0.15); c.moveTo(-u * 1.05, u * 0.15); c.lineTo(u * 1.05, u * 0.15); c.stroke(); for (var q = 0; q < 4; q++) { var qa = q * 1.571 + 0.785; c.beginPath(); c.arc(Math.cos(qa) * u * 1.15, Math.sin(qa) * u * 1.15, u * 0.12, 0, 7); c.fill(); } }
    else if (k === 'fire') { c.beginPath(); c.moveTo(0, -u * 1.05); c.bezierCurveTo(u * 1.0, -u * 0.2, u * 0.85, u, 0, u); c.bezierCurveTo(-u * 0.85, u, -u * 0.95, -u * 0.1, -u * 0.25, -u * 0.45); c.quadraticCurveTo(-u * 0.1, -u * 0.75, 0, -u * 1.05); c.fill(); }
    else if (k === 'speed') { c.beginPath(); c.moveTo(u * 0.35, -u * 1.05); c.lineTo(-u * 0.55, u * 0.15); c.lineTo(-u * 0.02, u * 0.15); c.lineTo(-u * 0.35, u * 1.05); c.lineTo(u * 0.55, -u * 0.15); c.lineTo(u * 0.02, -u * 0.15); c.closePath(); c.fill(); }
    else if (k === 'kick') { c.beginPath(); c.moveTo(-u * 0.6, -u); c.lineTo(-u * 0.6, u * 0.55); c.quadraticCurveTo(-u * 0.6, u * 0.75, -u * 0.4, u * 0.75); c.lineTo(u * 0.85, u * 0.75); c.quadraticCurveTo(u * 1.0, u * 0.75, u * 1.0, u * 0.5); c.quadraticCurveTo(u * 1.0, u * 0.1, u * 0.2, -u * 0.05); c.lineTo(u * 0.05, -u); c.closePath(); c.fill(); }
    else if (k === 'shield') { c.beginPath(); c.moveTo(0, -u); c.lineTo(u * 0.85, -u * 0.6); c.quadraticCurveTo(u * 0.8, u * 0.6, 0, u); c.quadraticCurveTo(-u * 0.8, u * 0.6, -u * 0.85, -u * 0.6); c.closePath(); c.fill(); }
  }
  function itemSprite(k) { return sprite('item' + k, 1, 1, 0.3, function (c) {
    var cx = T / 2, cy = T / 2, r = T * 0.36, col = ICON[k];
    var gl = c.createRadialGradient(cx, cy, 0, cx, cy, T * 0.75); gl.addColorStop(0, hexA(col, 0.5)); gl.addColorStop(1, hexA(col, 0)); c.fillStyle = gl; c.fillRect(-T * 0.3, -T * 0.3, T * 1.6, T * 1.6);
    c.fillStyle = shade(col, -0.6); rr(c, cx - r - T * 0.035, cy - r - T * 0.035, r * 2 + T * 0.07, r * 2 + T * 0.1, r * 0.5); c.fill();
    c.fillStyle = shade(col, -0.3); rr(c, cx - r, cy - r + T * 0.05, r * 2, r * 2, r * 0.45); c.fill();
    var gr = c.createLinearGradient(cx, cy - r, cx, cy + r); gr.addColorStop(0, shade(col, 0.45)); gr.addColorStop(0.5, col); gr.addColorStop(1, shade(col, -0.15));
    c.fillStyle = gr; rr(c, cx - r, cy - r, r * 2, r * 2 - T * 0.03, r * 0.45); c.fill();
    c.save(); c.translate(cx, cy + T * 0.02); var u = T * 0.19;
    c.fillStyle = 'rgba(0,0,0,0.3)'; c.strokeStyle = 'rgba(0,0,0,0.3)'; c.translate(0, T * 0.025); iconGlyph(c, k, u); c.translate(0, -T * 0.025);
    c.fillStyle = '#fff'; c.strokeStyle = '#fff'; iconGlyph(c, k, u); c.restore();
    c.fillStyle = 'rgba(255,255,255,0.45)'; c.beginPath(); c.ellipse(cx - r * 0.25, cy - r * 0.62, r * 0.55, r * 0.22, -0.15, 0, 7); c.fill();
  }); }
  function drawItem(c, px, py, k, still) {
    var ph = time * 3.2 + px * 0.05 + py * 0.07, bob = still ? 0 : (Math.sin(ph) * 0.5 + 0.5) * T * 0.08;
    if (!still) { c.fillStyle = 'rgba(0,20,10,' + (0.28 - bob / T) + ')'; c.beginPath(); c.ellipse(px + T / 2, py + T * 0.86, T * (0.3 - bob / T), T * 0.08, 0, 0, 7); c.fill(); }
    var s = itemSprite(k); blit(c, s, px, py - bob);
    // shine sweep every ~2.5 s
    var sw = ((time * 0.4 + (px + py) * 0.003) % 1); if (!still && !lowFx && sw < 0.35) { var k2 = sw / 0.35, r = T * 0.36, cx = px + T / 2, cy = py + T / 2 - bob;
      c.save(); rr(c, cx - r, cy - r, r * 2, r * 2, r * 0.45); c.clip(); c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(255,255,255,0.35)'; var sx = cx - r * 2 + k2 * r * 4; c.beginPath(); c.moveTo(sx, cy - r); c.lineTo(sx + r * 0.35, cy - r); c.lineTo(sx - r * 0.25, cy + r); c.lineTo(sx - r * 0.6, cy + r); c.closePath(); c.fill(); c.restore(); }
  }
  // ---------- bombs ----------
  // Bomb: an energy orb in a metal cage (no fuse). Glow shifts from cyan to orange/red as it counts down.
  function bombSprite() { return sprite('orb', 1, 1, 0.3, function (c) {
    var cx = T / 2, cy = T / 2 + T * 0.04, r = T * 0.32;
    c.fillStyle = OUT; c.beginPath(); c.arc(cx, cy, r + T * 0.04, 0, 7); c.fill();
    var gr = c.createRadialGradient(cx - r * 0.25, cy - r * 0.3, r * 0.05, cx, cy, r); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.3, '#9ff3ff'); gr.addColorStop(0.75, '#2b8fe8'); gr.addColorStop(1, '#1b3f8f');
    c.fillStyle = gr; c.beginPath(); c.arc(cx, cy, r, 0, 7); c.fill();
    // metal cage: equator band and two vertical ribs
    var mg = c.createLinearGradient(0, cy - T * 0.07, 0, cy + T * 0.07); mg.addColorStop(0, '#eef2fb'); mg.addColorStop(1, '#7c86a3');
    c.save(); c.beginPath(); c.arc(cx, cy, r, 0, 7); c.clip();
    c.fillStyle = OUT; c.fillRect(cx - r, cy - T * 0.075, r * 2, T * 0.15); c.fillStyle = mg; c.fillRect(cx - r, cy - T * 0.055, r * 2, T * 0.11);
    c.strokeStyle = OUT; c.lineWidth = T * 0.06; c.beginPath(); c.ellipse(cx, cy, r * 0.45, r, 0, 0, 7); c.stroke(); c.strokeStyle = '#b9c2da'; c.lineWidth = T * 0.03; c.stroke();
    c.restore();
    c.fillStyle = '#3a4466'; for (var i = -1; i <= 1; i += 2) { c.beginPath(); c.arc(cx + i * r * 0.72, cy, T * 0.03, 0, 7); c.fill(); }
    c.fillStyle = 'rgba(255,255,255,0.8)'; c.beginPath(); c.ellipse(cx - r * 0.42, cy - r * 0.5, r * 0.2, r * 0.1, -0.7, 0, 7); c.fill();
  }); }
  function drawBomb(c, b) {
    var cx = (b.x + 0.5) * T, cy = (b.y + 0.5) * T, k = 1 - b.timer / E.BOMB_TIME, rate = 7 + k * 16, pl = Math.sin(time * rate), sx = 1 + pl * 0.06 * (0.5 + k), sy = 1 - pl * 0.05 * (0.5 + k), r = T * 0.32;
    c.fillStyle = 'rgba(0,20,10,0.32)'; c.beginPath(); c.ellipse(cx + T * 0.04, cy + T * 0.36, T * 0.3 * sx, T * 0.1, 0, 0, 7); c.fill();
    var s = bombSprite(); c.save(); c.translate(cx, cy + T * 0.37); c.scale(sx, sy); c.drawImage(s.c, -T / 2 - s.ox, -T * 0.87 - s.oy, s.w, s.h); c.restore();
    var bcy = cy + T * 0.37 - (T * 0.37 - T * 0.04) * sy;
    c.save(); c.globalCompositeOperation = 'lighter';
    var hot = Math.min(1, k * 1.3), gs = glowSprite(hot > 0.6 ? '255,90,50' : hot > 0.3 ? '255,170,60' : '80,200,255'), gsc = 0.75 + 0.15 * pl;
    c.globalAlpha = 0.35 + 0.35 * hot; blit(c, gs, cx - T / 2 * gsc, bcy - T / 2 * gsc, gsc);
    if (k > 0.35) { c.globalAlpha = (k - 0.35) * (0.6 + 0.4 * Math.max(0, pl)); c.fillStyle = 'rgb(255,' + Math.round(150 - k * 110) + ',40)'; c.beginPath(); c.ellipse(cx, bcy, r * sx * 0.9, r * sy * 0.9, 0, 0, 7); c.fill(); }
    // orbiting spark
    c.globalAlpha = 1; var oa = time * (5 + k * 10), ox = cx + Math.cos(oa) * r * 1.15, oy = bcy + Math.sin(oa) * r * 0.45;
    c.fillStyle = '#fffbe0'; c.beginPath(); c.arc(ox, oy, T * 0.04, 0, 7); c.fill(); c.restore();
  }
  // ---------- explosions ----------
  function drawFlames(c, g) {
    c.save(); c.globalCompositeOperation = 'lighter'; var gs = glowSprite('255,120,30');
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) { var f = g.flames[y][x]; if (f <= 0) continue; var k = f / E.FLAME_TIME, s = Math.sin(k * Math.PI); c.globalAlpha = 0.55 * s; blit(c, gs, x * T, y * T); }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
      f = g.flames[y][x]; if (f <= 0) continue; k = f / E.FLAME_TIME; s = Math.sin(k * Math.PI); var cx = (x + 0.5) * T, cy = (y + 0.5) * T;
      var L = g.flames[y][x - 1] > 0, R = g.flames[y][x + 1] > 0, U = !!(g.flames[y - 1] && g.flames[y - 1][x] > 0), D = !!(g.flames[y + 1] && g.flames[y + 1][x] > 0), hor = L || R, ver = U || D;
      var layers = [[0.46, 'rgba(225,55,15,0.92)'], [0.36, 'rgba(255,125,25,0.96)'], [0.24, 'rgba(255,205,70,1)'], [0.1, 'rgba(255,255,230,1)']];
      for (var li = 0; li < 4; li++) {
        var w = T * layers[li][0] * (0.55 + 0.45 * s) * (0.9 + Math.sin(time * 38 + x * 3 + y * 5 + li) * 0.1); c.fillStyle = layers[li][1];
        if (hor || !ver) { var x0 = L ? x * T - 1 : cx - w, x1 = R ? x * T + T + 1 : cx + w; rr(c, x0, cy - w, x1 - x0, w * 2, w); c.fill(); }
        if (ver) { var y0 = U ? y * T - 1 : cy - w, y1 = D ? y * T + T + 1 : cy + w; rr(c, cx - w, y0, w * 2, y1 - y0, w); c.fill(); }
        if (!hor && !ver || (hor && ver)) { c.beginPath(); c.arc(cx, cy, w * 1.15, 0, 7); c.fill(); }
      }
    }
    c.restore();
  }
  // ---------- characters ----------
  var OUT = '#1d1830';
  function eyes(c, ex, ey, sp, rw, rh, lx, ly, blink, mood) {
    for (var i = -1; i <= 1; i += 2) {
      var x = ex + i * sp;
      if (blink) { c.strokeStyle = OUT; c.lineWidth = rh * 0.35; c.lineCap = 'round'; c.beginPath(); c.moveTo(x - rw * 0.8, ey); c.quadraticCurveTo(x, ey + rh * 0.45, x + rw * 0.8, ey); c.stroke(); continue; }
      if (mood === 'dizzy') { c.strokeStyle = OUT; c.lineWidth = rh * 0.25; c.lineCap = 'round'; c.beginPath(); for (var a = 0; a < 9; a += 0.5) c.lineTo(x + Math.cos(a + time * 8) * rw * a / 9, ey + Math.sin(a + time * 8) * rh * a / 9); c.stroke(); continue; }
      c.fillStyle = '#fff'; c.beginPath(); c.ellipse(x, ey, rw, rh, 0, 0, 7); c.fill(); c.strokeStyle = OUT; c.lineWidth = rw * 0.22; c.stroke();
      c.fillStyle = OUT; c.beginPath(); c.ellipse(x + lx * rw * 0.35, ey + ly * rh * 0.3 + rh * 0.08, rw * 0.55, rh * 0.62, 0, 0, 7); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(x + lx * rw * 0.35 - rw * 0.2, ey + ly * rh * 0.3 - rh * 0.18, rw * 0.22, 0, 7); c.fill();
      if (mood === 'angry') { c.strokeStyle = OUT; c.lineWidth = rh * 0.3; c.lineCap = 'round'; c.beginPath(); c.moveTo(x - i * rw * 1.1, ey - rh * 1.25); c.lineTo(x + i * rw * 0.7, ey - rh * 0.8); c.stroke(); }
    }
  }
  function blinkNow(id) { var t = (time + id * 1.37) % 3.4; return t < 0.12; }
  // Player/CPU "Boxbot": original design. Rounded-square head with two camera-lens eyes, a light bar on top,
  // swept ear fins, colored mitten hands and boots. Static head+body parts are cached per color/facing/blink.
  function botBody(c, col, face, blink, dead) {
    var lx = { l: -1, r: 1 }[face] || 0, ly = { u: -1, d: 1 }[face] || 0, lw = T * 0.05, dk = shade(col, -0.45), i;
    // body: short rounded box, light belly plate
    c.fillStyle = OUT; rr(c, -T * 0.22 - lw / 2, -T * 0.3 - lw / 2, T * 0.44 + lw, T * 0.28 + lw, T * 0.09); c.fill();
    var bg = c.createLinearGradient(0, -T * 0.3, 0, -T * 0.02); bg.addColorStop(0, shade(col, 0.15)); bg.addColorStop(1, dk); c.fillStyle = bg; rr(c, -T * 0.22, -T * 0.3, T * 0.44, T * 0.28, T * 0.08); c.fill();
    if (face !== 'u') { c.fillStyle = 'rgba(255,255,255,0.85)'; rr(c, -T * 0.11 + lx * T * 0.04, -T * 0.25, T * 0.22, T * 0.15, T * 0.05); c.fill(); c.fillStyle = col; c.beginPath(); c.arc(lx * T * 0.04, -T * 0.175, T * 0.035, 0, 7); c.fill(); }
    // ear fins (swept back, triangular)
    for (i = -1; i <= 1; i += 2) { if (i === -lx) continue; c.beginPath(); c.moveTo(i * T * 0.27, -T * 0.62); c.lineTo(i * T * 0.42, -T * 0.72); c.lineTo(i * T * 0.36, -T * 0.42); c.lineTo(i * T * 0.27, -T * 0.42); c.closePath(); c.lineJoin = 'round'; c.lineWidth = lw; c.strokeStyle = OUT; c.stroke(); c.fillStyle = dk; c.fill(); }
    // head: rounded square
    var hw = T * 0.62, hh = T * 0.46, hx = -hw / 2, hy = -T * 0.78;
    c.fillStyle = OUT; rr(c, hx - lw / 2, hy - lw / 2, hw + lw, hh + lw, T * 0.14); c.fill();
    var hg = c.createLinearGradient(0, hy, 0, hy + hh); hg.addColorStop(0, shade(col, 0.5)); hg.addColorStop(0.45, col); hg.addColorStop(1, shade(col, -0.3)); c.fillStyle = hg; rr(c, hx, hy, hw, hh, T * 0.13); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.35)'; rr(c, hx + T * 0.07, hy + T * 0.04, hw * 0.45, T * 0.06, T * 0.03); c.fill();
    // light bar on top (no antenna)
    c.fillStyle = OUT; rr(c, -T * 0.13, hy - T * 0.07, T * 0.26, T * 0.1, T * 0.05); c.fill(); c.fillStyle = '#9ff7ff'; rr(c, -T * 0.105, hy - T * 0.05, T * 0.21, T * 0.055, T * 0.03); c.fill();
    if (face === 'u') { c.strokeStyle = 'rgba(0,0,0,0.28)'; c.lineWidth = T * 0.03; c.lineCap = 'round'; c.beginPath(); for (i = 0; i < 3; i++) { c.moveTo(-T * 0.14, hy + T * 0.17 + i * T * 0.08); c.lineTo(T * 0.14, hy + T * 0.17 + i * T * 0.08); } c.stroke(); return; }
    // two camera-lens eyes directly on the head
    var ex = lx * T * 0.08, ey = hy + T * 0.22 + ly * T * 0.02;
    for (i = -1; i <= 1; i += 2) {
      var x = ex + i * T * 0.13, rO = T * 0.1;
      if (lx && i === -lx) x = ex + i * T * 0.1;
      c.fillStyle = OUT; c.beginPath(); c.arc(x, ey, rO + lw * 0.4, 0, 7); c.fill();
      var rg = c.createLinearGradient(0, ey - rO, 0, ey + rO); rg.addColorStop(0, '#f2f5ff'); rg.addColorStop(1, '#9aa4c4'); c.fillStyle = rg; c.beginPath(); c.arc(x, ey, rO, 0, 7); c.fill();
      if (blink) { c.strokeStyle = OUT; c.lineWidth = T * 0.03; c.beginPath(); c.moveTo(x - rO * 0.6, ey); c.lineTo(x + rO * 0.6, ey); c.stroke(); continue; }
      if (dead) { c.strokeStyle = OUT; c.lineWidth = T * 0.025; c.beginPath(); for (var a = 0; a < 9; a += 0.5) c.lineTo(x + Math.cos(a) * rO * 0.7 * a / 9, ey + Math.sin(a) * rO * 0.7 * a / 9); c.stroke(); continue; }
      var px = x + lx * rO * 0.18, py = ey + ly * rO * 0.15;
      c.fillStyle = '#141a33'; c.beginPath(); c.arc(px, py, rO * 0.66, 0, 7); c.fill();
      var ig = c.createRadialGradient(px, py, 0, px, py, rO * 0.5); ig.addColorStop(0, '#d8fbff'); ig.addColorStop(0.5, '#38d6ff'); ig.addColorStop(1, 'rgba(40,120,255,0.2)'); c.fillStyle = ig; c.beginPath(); c.arc(px, py, rO * 0.45, 0, 7); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(px - rO * 0.22, py - rO * 0.25, rO * 0.16, 0, 7); c.fill();
    }
    c.strokeStyle = OUT; c.lineWidth = T * 0.028; c.lineCap = 'round'; c.beginPath(); c.arc(ex, hy + T * 0.33, T * 0.05, 0.4, Math.PI - 0.4); c.stroke();
  }
  function drawRobot(c, p, alpha) {
    var cx = (p.x + 0.5) * T, cy = (p.y + 0.5) * T, mv = p.dir && p.alive ? 1 : 0, ph = p.anim * 6.5, id = p.id || 0;
    var hop = mv ? Math.abs(Math.sin(ph)) * T * 0.06 : 0, br = mv ? 0 : Math.sin(time * 3 + id) * 0.025;
    var sqx = mv ? 1 + Math.cos(ph * 2) * 0.04 : 1 + br, sqy = mv ? 1 - Math.cos(ph * 2) * 0.04 : 1 - br;
    var lx = { l: -1, r: 1 }[p.face] || 0, col = p.color || '#3fa9ff', dk = shade(col, -0.45), lw = T * 0.05, i;
    c.save(); c.globalAlpha = alpha == null ? 1 : alpha;
    c.fillStyle = 'rgba(0,20,10,0.32)'; c.beginPath(); c.ellipse(cx, cy + T * 0.38, T * (0.28 - hop / T), T * 0.09, 0, 0, 7); c.fill();
    var foot = mv ? Math.sin(ph) * T * 0.07 : 0;
    for (i = -1; i <= 1; i += 2) { var fy = cy + T * 0.3 - Math.max(0, i * foot), fx = cx + i * T * 0.12 + lx * T * 0.03; c.fillStyle = OUT; rr(c, fx - T * 0.1 - lw / 2, fy - T * 0.06 - lw / 2, T * 0.2 + lw, T * 0.12 + lw, T * 0.06); c.fill(); c.fillStyle = dk; rr(c, fx - T * 0.1, fy - T * 0.06, T * 0.2, T * 0.12, T * 0.05); c.fill(); }
    c.translate(cx, cy + T * 0.3 - hop); c.scale(sqx, sqy);
    // mitten hands (colored, with thumb)
    var sw = mv ? Math.sin(ph) * T * 0.05 : 0;
    for (i = -1; i <= 1; i += 2) { var hx = i * T * 0.29, hy = -T * 0.17 + i * sw; c.fillStyle = OUT; rr(c, hx - T * 0.075 - lw / 2, hy - T * 0.08 - lw / 2, T * 0.15 + lw, T * 0.16 + lw, T * 0.07); c.fill(); c.fillStyle = shade(col, 0.2); rr(c, hx - T * 0.075, hy - T * 0.08, T * 0.15, T * 0.16, T * 0.065); c.fill(); c.fillStyle = dk; c.beginPath(); c.arc(hx - i * T * 0.06, hy - T * 0.03, T * 0.035, 0, 7); c.fill(); }
    if (!p.alive) botBody(c, col, p.face, false, true);
    else { var bl = blinkNow(id), s = sprite('bot' + col + p.face + (bl ? 1 : 0), 1, 1, 0.6, function (x) { x.translate(T / 2, T * 0.85); botBody(x, col, p.face, bl, false); }); c.drawImage(s.c, -T / 2 - s.ox, -T * 0.85 - s.oy, s.w, s.h); }
    c.restore(); c.save(); c.globalAlpha = alpha == null ? 1 : alpha;
    if (p.shield > 0 || p.inv > 0) {
      var a = p.inv > 0 ? 0.35 + 0.3 * Math.sin(time * 25) : 0.4, gy = cy - T * 0.1, sg2 = c.createRadialGradient(cx - T * 0.15, gy - T * 0.2, T * 0.05, cx, gy, T * 0.62);
      sg2.addColorStop(0, 'rgba(160,255,240,0)'); sg2.addColorStop(0.75, 'rgba(120,255,230,' + a * 0.4 + ')'); sg2.addColorStop(1, 'rgba(220,255,250,' + a + ')');
      c.fillStyle = sg2; c.beginPath(); c.arc(cx, gy, T * 0.62, 0, 7); c.fill(); c.strokeStyle = 'rgba(255,255,255,' + a * 0.8 + ')'; c.lineWidth = T * 0.03; c.beginPath(); c.arc(cx, gy, T * 0.55, 3.6, 4.6); c.stroke();
    }
    c.restore();
  }
  function drawEnemy(c, e) {
    var cx = (e.x + 0.5) * T, cy = (e.y + 0.5) * T, id = e.id || 0, w = Math.sin(time * 6 + id) * 0.06, hit = e.inv > 0 && Math.sin(time * 30) > 0;
    var lx = e.dir === 'l' ? -1 : e.dir === 'r' ? 1 : 0, ly = e.dir === 'u' ? -1 : e.dir === 'd' ? 1 : 0, lw = T * 0.055;
    c.save();
    if (e.type === 'boss') { drawBoss(c, e, cx, cy, hit, lx, ly); c.restore(); return; }
    if (hit) c.globalAlpha = 0.5;
    if (e.type === 'ghost') {
      var a = 0.82 + Math.sin(time * 3 + id) * 0.1; c.globalAlpha *= a; var gy = cy - T * 0.08 + Math.sin(time * 3 + id) * T * 0.06;
      c.fillStyle = 'rgba(0,20,10,0.22)'; c.beginPath(); c.ellipse(cx, cy + T * 0.38, T * 0.2, T * 0.06, 0, 0, 7); c.fill();
      var path = function (g) { c.beginPath(); c.arc(cx, gy - T * 0.05, T * 0.3 + g, Math.PI, 0); c.lineTo(cx + T * 0.3 + g, gy + T * 0.3 + g); for (var i = 0; i < 4; i++) { var xx = cx + T * 0.3 - (i + 0.5) * T * 0.15; c.quadraticCurveTo(xx, gy + T * (i % 2 ? 0.4 : 0.22) + g + Math.sin(time * 8 + i) * T * 0.03, xx - T * 0.075, gy + T * 0.3 + g); } c.lineTo(cx - T * 0.3 - g, gy - T * 0.05); c.closePath(); };
      path(lw / 2); c.fillStyle = '#3a3f7a'; c.fill();
      var g2 = c.createLinearGradient(cx, gy - T * 0.35, cx, gy + T * 0.35); g2.addColorStop(0, '#ffffff'); g2.addColorStop(1, '#c3ccff'); path(0); c.fillStyle = g2; c.fill();
      eyes(c, cx + lx * T * 0.05, gy - T * 0.06, T * 0.1, T * 0.055, T * 0.075, lx, ly, blinkNow(id), '');
      c.fillStyle = 'rgba(255,130,180,0.5)'; c.beginPath(); c.ellipse(cx - T * 0.18, gy + T * 0.06, T * 0.04, T * 0.022, 0, 0, 7); c.ellipse(cx + T * 0.18, gy + T * 0.06, T * 0.04, T * 0.022, 0, 0, 7); c.fill();
      c.fillStyle = '#3a3f7a'; c.beginPath(); c.ellipse(cx, gy + T * 0.1, T * 0.04, T * 0.05, 0, 0, 7); c.fill();
    } else {
      var chaser = e.type === 'chaser', col = chaser ? '#ff5050' : '#9b5cff';
      c.fillStyle = 'rgba(0,20,10,0.3)'; c.beginPath(); c.ellipse(cx, cy + T * 0.37, T * 0.3, T * 0.09, 0, 0, 7); c.fill();
      var sq = 1 + w, rx = T * 0.33 * sq, ry = T * 0.3 / sq, by = cy + T * 0.08 - (ry - T * 0.3);
      var shape = function (g) { c.beginPath(); if (chaser) { for (var j = 0; j < 18; j++) { var an = j / 18 * Math.PI * 2 + time * 0.8, rad = j % 2 ? 1 : 1.2; c.lineTo(cx + Math.cos(an) * (rx * rad + g), by + Math.sin(an) * (ry * rad + g)); } c.closePath(); } else { c.moveTo(cx - rx - g, by + ry * 0.8 + g); c.bezierCurveTo(cx - rx - g, by - ry * 0.6, cx - rx * 0.4, by - ry * 1.35 - g, cx, by - ry * 1.3 - g); c.bezierCurveTo(cx + rx * 0.4, by - ry * 1.35 - g, cx + rx + g, by - ry * 0.6, cx + rx + g, by + ry * 0.8 + g); c.quadraticCurveTo(cx, by + ry * 1.05 + g, cx - rx - g, by + ry * 0.8 + g); c.closePath(); } };
      shape(lw / 2); c.fillStyle = OUT; c.fill();
      var g3 = c.createRadialGradient(cx - rx * 0.4, by - ry * 0.6, T * 0.03, cx, by, rx * 1.2); g3.addColorStop(0, shade(col, 0.6)); g3.addColorStop(0.55, col); g3.addColorStop(1, shade(col, -0.4)); shape(0); c.fillStyle = g3; c.fill();
      eyes(c, cx + lx * T * 0.04, by - T * 0.06 + ly * T * 0.02, T * 0.11, T * 0.07, T * 0.09, lx, ly, !chaser && blinkNow(id), chaser ? 'angry' : '');
      c.strokeStyle = OUT; c.lineWidth = T * 0.035; c.lineCap = 'round'; c.beginPath();
      if (chaser) { c.moveTo(cx - T * 0.09, by + T * 0.13); c.quadraticCurveTo(cx, by + T * 0.08, cx + T * 0.09, by + T * 0.13); c.stroke(); c.fillStyle = '#fff'; c.beginPath(); c.moveTo(cx - T * 0.06, by + T * 0.105); c.lineTo(cx - T * 0.035, by + T * 0.16); c.lineTo(cx - T * 0.01, by + T * 0.1); c.fill(); }
      else { c.arc(cx, by + T * 0.07, T * 0.07, 0.3, Math.PI - 0.3); c.stroke(); }
      c.fillStyle = 'rgba(255,255,255,0.5)'; c.beginPath(); c.ellipse(cx - rx * 0.45, by - ry * 0.75, rx * 0.2, ry * 0.12, -0.5, 0, 7); c.fill();
    }
    c.restore();
  }
  function drawBoss(c, e, cx, cy, hit, lx, ly) {
    var s = 1.45, bob = Math.sin(time * 2.5) * T * 0.04, lw = T * 0.07, hp = e.hp || 1, angry = hp <= 2;
    c.fillStyle = 'rgba(0,15,10,0.35)'; c.beginPath(); c.ellipse(cx, cy + T * 0.45, T * 0.55, T * 0.14, 0, 0, 7); c.fill();
    c.translate(cx, cy + T * 0.2 + bob); c.scale(s, s);
    var gold = hit ? ['#ffffff', '#ffffff', '#ffd0d0'] : ['#fff1a8', '#ffc533', '#c97a0a'];
    // little treads
    c.fillStyle = OUT; rr(c, -T * 0.42, -T * 0.02, T * 0.84, T * 0.2, T * 0.1); c.fill(); c.fillStyle = '#4b5170'; rr(c, -T * 0.39, 0, T * 0.78, T * 0.15, T * 0.08); c.fill();
    c.fillStyle = '#8b93b5'; for (var i = 0; i < 5; i++) { c.beginPath(); c.arc(-T * 0.3 + i * T * 0.15, T * 0.075, T * 0.035, 0, 7); c.fill(); }
    // body
    c.fillStyle = OUT; rr(c, -T * 0.4 - lw / 2, -T * 0.66 - lw / 2, T * 0.8 + lw, T * 0.66 + lw, T * 0.24); c.fill();
    var gr = c.createLinearGradient(0, -T * 0.66, 0, 0); gr.addColorStop(0, gold[0]); gr.addColorStop(0.45, gold[1]); gr.addColorStop(1, gold[2]); c.fillStyle = gr; rr(c, -T * 0.4, -T * 0.66, T * 0.8, T * 0.66, T * 0.24); c.fill();
    // crest (lightning crown)
    c.fillStyle = OUT; c.beginPath(); c.moveTo(-T * 0.24, -T * 0.64); c.lineTo(-T * 0.27, -T * 0.86); c.lineTo(-T * 0.1, -T * 0.74); c.lineTo(0, -T * 0.94); c.lineTo(T * 0.1, -T * 0.74); c.lineTo(T * 0.27, -T * 0.86); c.lineTo(T * 0.24, -T * 0.64); c.closePath(); c.lineWidth = lw; c.lineJoin = 'round'; c.strokeStyle = OUT; c.stroke();
    var cg = c.createLinearGradient(0, -T * 0.94, 0, -T * 0.64); cg.addColorStop(0, '#ff9ccf'); cg.addColorStop(1, '#e0307e'); c.fillStyle = cg; c.fill();
    c.fillStyle = '#7ff3ff'; c.beginPath(); c.arc(0, -T * 0.76, T * 0.035, 0, 7); c.fill();
    // face plate
    c.fillStyle = OUT; rr(c, -T * 0.32, -T * 0.52, T * 0.64, T * 0.32, T * 0.14); c.fill();
    var fg = c.createLinearGradient(0, -T * 0.52, 0, -T * 0.2); fg.addColorStop(0, '#2e2558'); fg.addColorStop(1, '#140f2c'); c.fillStyle = fg; rr(c, -T * 0.3, -T * 0.5, T * 0.6, T * 0.28, T * 0.12); c.fill();
    c.save(); c.globalCompositeOperation = 'lighter'; var ex = lx * T * 0.03, ey = -T * 0.37 + ly * T * 0.015;
    for (i = -1; i <= 1; i += 2) { var eg = c.createRadialGradient(i * T * 0.13 + ex, ey, 0, i * T * 0.13 + ex, ey, T * 0.12); eg.addColorStop(0, 'rgba(255,240,240,1)'); eg.addColorStop(0.35, angry ? 'rgba(255,60,60,0.95)' : 'rgba(255,90,140,0.95)'); eg.addColorStop(1, 'rgba(255,40,80,0)'); c.fillStyle = eg; c.beginPath(); c.arc(i * T * 0.13 + ex, ey, T * 0.12, 0, 7); c.fill(); }
    c.restore();
    c.strokeStyle = OUT; c.lineWidth = T * 0.045; c.lineCap = 'round'; c.beginPath(); c.moveTo(-T * 0.24, -T * 0.5 + (angry ? T * 0.02 : 0)); c.lineTo(-T * 0.05, -T * 0.45 + (angry ? T * 0.03 : 0)); c.moveTo(T * 0.24, -T * 0.5 + (angry ? T * 0.02 : 0)); c.lineTo(T * 0.05, -T * 0.45 + (angry ? T * 0.03 : 0)); c.stroke();
    // grill mouth
    c.fillStyle = OUT; rr(c, -T * 0.16, -T * 0.16, T * 0.32, T * 0.1, T * 0.04); c.fill(); c.fillStyle = '#ffe9a8'; for (i = 0; i < 4; i++) { rr(c, -T * 0.14 + i * T * 0.072, -T * 0.145, T * 0.05, T * 0.07, T * 0.015); c.fill(); }
    // side bolts + gloss
    for (i = -1; i <= 1; i += 2) { c.fillStyle = OUT; c.beginPath(); c.arc(i * T * 0.43, -T * 0.35, T * 0.08, 0, 7); c.fill(); c.fillStyle = '#c9d2ea'; c.beginPath(); c.arc(i * T * 0.43, -T * 0.35, T * 0.055, 0, 7); c.fill(); }
    c.fillStyle = 'rgba(255,255,255,0.5)'; c.beginPath(); c.ellipse(-T * 0.2, -T * 0.6, T * 0.12, T * 0.035, -0.2, 0, 7); c.fill();
  }
  function drawBossHp(c, e) {
    var cx = (e.x + 0.5) * T, top = (e.y + 0.5) * T - T * 1.25, n = 6, pw = T * 0.16, gap = T * 0.04, tw = n * pw + (n - 1) * gap, x0 = cx - tw / 2;
    c.fillStyle = 'rgba(15,12,35,0.75)'; rr(c, x0 - T * 0.06, top - T * 0.06, tw + T * 0.12, T * 0.2, T * 0.1); c.fill();
    for (var i = 0; i < n; i++) { var on = i < e.hp; c.fillStyle = on ? (e.hp <= 2 ? '#ff5a5a' : '#5fff8a') : 'rgba(255,255,255,0.15)'; rr(c, x0 + i * (pw + gap), top, pw, T * 0.08, T * 0.04); c.fill(); }
  }
  function drawPortal(c, p) {
    var cx = (p.x + 0.5) * T, cy = (p.y + 0.5) * T;
    c.fillStyle = 'rgba(20,20,50,0.45)'; c.beginPath(); c.ellipse(cx, cy + T * 0.04, T * 0.4, T * 0.32, 0, 0, 7); c.fill();
    c.strokeStyle = p.open ? '#d9c8ff' : 'rgba(160,170,220,0.6)'; c.lineWidth = T * 0.05; c.stroke();
    if (!p.open) return;
    c.save(); c.globalCompositeOperation = 'lighter';
    var gs = glowSprite('150,110,255'); c.globalAlpha = 0.7 + 0.2 * Math.sin(time * 4); blit(c, gs, cx - T / 2, cy - T / 2); c.globalAlpha = 1;
    for (var i = 0; i < 3; i++) { c.strokeStyle = ['rgba(255,255,255,0.9)', 'rgba(140,220,255,0.8)', 'rgba(200,140,255,0.8)'][i]; c.lineWidth = T * 0.05; c.beginPath(); c.ellipse(cx, cy, T * (0.14 + i * 0.1), T * (0.11 + i * 0.08), 0, time * (2 + i) + i, time * (2 + i) + i + 4.2); c.stroke(); }
    if (!lowFx && Math.random() < 0.2) spawn(cx + (Math.random() - 0.5) * T * 0.6, cy, 0, -T * 1.2, 0.8, 0.8, T * 0.04, '200,170,255', true, 0, 0);
    c.restore();
  }
  // ---------- particles: pooled and capped so busy scenes stay smooth ----------
  var pool = [], MAXP = 360, capP = 360, ema = 1 / 60, lowFx = false;
  function spawn(x, y, vx, vy, life, max, sz, col, add, grav, kind) { if (parts.length >= capP) return; var p = pool.pop() || {}; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = life; p.max = max; p.s = sz; p.col = col; p.add = add; p.g = grav || 0; p.k = kind || 0; p.rot = Math.random() * 6; p.vr = (Math.random() - 0.5) * 14; parts.push(p); }
  function burst(x, y, n, col, speed, life, size, add, grav, kind) { if (lowFx || parts.length > capP * 0.7) n = Math.ceil(n / 2); for (var i = 0; i < n; i++) { var a = Math.random() * 6.283, s = speed * (0.3 + Math.random() * 0.7); spawn(x, y, Math.cos(a) * s, Math.sin(a) * s - (kind === 1 ? speed * 0.5 : 0), life * (0.6 + Math.random() * 0.4), life, size * (0.6 + Math.random() * 0.8), col, add, grav, kind); } }
  var shakeT = 0;
  function onEvents(g) {
    g.events.forEach(function (ev) {
      var cx = (ev.x + 0.5) * T, cy = (ev.y + 0.5) * T;
      if (ev.t === 'boom') { rings.push({ x: cx, y: cy, life: 0.35, max: 0.35 }); shakeT = Math.max(shakeT, 0.12); ev.tiles.forEach(function (t, i) { var tx = (t[0] + 0.5) * T, ty = (t[1] + 0.5) * T; burst(tx, ty, 4, '255,190,80', T * 4, 0.45, T * 0.07, true); if (i % 2 === 0) burst(tx, ty, 1, '210,210,220', T * 0.8, 0.9, T * 0.24, false, -T * 1.5); }); }
      else if (ev.t === 'crate') { burst(cx, cy, 9, '196,120,52', T * 4, 0.7, T * 0.09, false, T * 9, 1); burst(cx, cy, 4, '240,190,120', T * 3, 0.5, T * 0.06, false, T * 9, 1); burst(cx, cy, 2, '200,190,170', T * 0.8, 0.8, T * 0.22, false, -T); }
      else if (ev.t === 'power') { burst(cx, cy, 18, '255,240,140', T * 4, 0.6, T * 0.07, true); rings.push({ x: cx, y: cy, life: 0.3, max: 0.3, col: '255,240,160' }); }
      else if (ev.t === 'pop' || ev.t === 'ko') { burst(cx, cy, 22, ev.t === 'ko' ? '255,255,255' : '220,170,255', T * 5, 0.8, T * 0.08, true); burst(cx, cy, 5, '230,230,240', T * 1.2, 1, T * 0.25, false, -T); burst(cx, cy, 6, '255,220,90', T * 3, 0.9, T * 0.1, true, T * 2, 2); }
      else if (ev.t === 'shield' || ev.t === 'bosshit') { rings.push({ x: cx, y: cy, life: 0.3, max: 0.3, col: '120,255,230' }); if (ev.t === 'bosshit') burst(cx, cy, 10, '255,230,120', T * 4, 0.5, T * 0.08, true); }
      else if (ev.t === 'drop') { if (staticLayer) { var sx2 = staticLayer.getContext('2d'); sx2.setTransform(dpr, 0, 0, dpr, 0, 0); wallShadow(sx2, ev.x * T, ev.y * T); drawWall(sx2, ev.x * T, ev.y * T, true, theme || THEMES[0], 0.5); } burst(cx, cy, 8, '190,200,220', T * 2, 0.6, T * 0.15, false, -T); }
      else if (ev.t === 'portal') { burst(cx, cy, 30, '180,150,255', T * 4, 1, T * 0.08, true); }
    });
  }
  function showBanner(text, sub, dur) { banner = { text: text, sub: sub || '', t: 0, dur: Math.min(1.6, dur || 2) }; }
  function buildVignette() { var c = document.createElement('canvas'); c.width = Math.max(1, Math.round(vw)); c.height = Math.max(1, Math.round(vh)); var x = c.getContext('2d'), vg = x.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.38, vw / 2, vh / 2, Math.max(vw, vh) * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,10,30,0.32)'); x.fillStyle = vg; x.fillRect(0, 0, vw, vh); vignette = c; }
  function frame(g, dt) {
    time += dt; if (dt > 0 && dt < 0.25) { ema += (dt - ema) * 0.05; if (!lowFx && ema > 0.024) lowFx = true; else if (lowFx && ema < 0.0175) lowFx = false; } capP = lowFx ? 160 : MAXP;
    var key = (g.mode || '') + (g.level || 0) + ':' + (g.seed || 0);
    if (!staticLayer || staticLayer.width !== Math.round(bw * dpr) || key !== staticKey) { staticKey = key; buildStatic(g); }
    var focus = g.players.filter(function (p) { return p.human && !p.bot && p.alive; })[0] || g.players.filter(function (p) { return p.alive; })[0] || g.players[0], tx = Math.max(0, Math.min(bw - vw, (focus.x + 0.5) * T - vw / 2)), ty = Math.max(0, Math.min(bh - vh, (focus.y + 0.5) * T - vh / 2));
    if (!camInit) { camX = tx; camY = ty; camInit = true; } else { var kk = Math.min(1, dt * 7); camX += (tx - camX) * kk; camY += (ty - camY) * kk; }
    var c = ctx; c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.fillStyle = (theme && theme.bg) || '#000'; c.fillRect(0, 0, cv.width, cv.height);
    shakeT = Math.max(0, shakeT - dt); var amp = reduceMotion ? 0 : (g.shake * g.shake * T * 0.3 + shakeT * T * 0.5), ox = (Math.random() - 0.5) * amp, oy = (Math.random() - 0.5) * amp;
    c.setTransform(dpr, 0, 0, dpr, Math.round((ox - camX) * dpr), Math.round((oy - camY) * dpr));
    c.drawImage(staticLayer, 0, 0, bw, bh);
    var x, y, cs = crateSprite();
    if (g.portal) drawPortal(c, g.portal);
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) if (g.items[y][x] && g.map[y][x] === E.FLOOR) drawItem(c, x * T, y * T, g.items[y][x]);
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) if (g.map[y][x] === E.CRATE) blit(c, cs, x * T, y * T);
    g.bombs.forEach(function (b) { drawBomb(c, { x: b.x + (b.slide ? (EDIR[b.slide][0] * b.sp) : 0), y: b.y + (b.slide ? EDIR[b.slide][1] * b.sp : 0), timer: b.timer }); });
    var ents = g.enemies.filter(function (e) { return e.alive; }).concat(g.players.filter(function (p) { return p.alive || p.deadT < 0.6; })).sort(function (a, b) { return a.y - b.y; });
    ents.forEach(function (e) { if (e.kind === 'player') drawRobot(c, e, e.alive ? 1 : Math.max(0, 1 - e.deadT / 0.6)); else drawEnemy(c, e); });
    drawFlames(c, g);
    g.enemies.forEach(function (e) { if (e.alive && e.type === 'boss') drawBossHp(c, e); });
    c.save(); c.globalCompositeOperation = 'lighter';
    rings = rings.filter(function (r) { r.life -= dt; if (r.life <= 0) return false; var k = 1 - r.life / r.max; c.strokeStyle = 'rgba(' + (r.col || '255,230,170') + ',' + (1 - k) + ')'; c.lineWidth = T * 0.16 * (1 - k); c.beginPath(); c.arc(r.x, r.y, T * (0.3 + k * 1.5), 0, 7); c.stroke(); return true; });
    var keep = 0;
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i]; p.life -= dt; if (p.life <= 0) { pool.push(p); continue; } parts[keep++] = p; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.97; p.rot += p.vr * dt; var k = p.life / p.max;
      c.globalCompositeOperation = p.add ? 'lighter' : 'source-over';
      if (p.k === 1) { c.fillStyle = 'rgba(' + p.col + ',' + Math.min(1, k * 1.5) + ')'; c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillRect(-p.s, -p.s * 0.45, p.s * 2, p.s * 0.9); c.restore(); }
      else if (p.k === 2) { c.fillStyle = 'rgba(' + p.col + ',' + k + ')'; c.beginPath(); for (var j = 0; j < 8; j++) { var an = j * 0.785 + p.rot, rad = j % 2 ? p.s * 0.4 : p.s; c.lineTo(p.x + Math.cos(an) * rad, p.y + Math.sin(an) * rad); } c.fill(); }
      else { c.fillStyle = 'rgba(' + p.col + ',' + (p.add ? k : k * 0.5) + ')'; c.beginPath(); c.arc(p.x, p.y, p.s * (p.add ? k : 2 - k), 0, 7); c.fill(); }
    }
    parts.length = keep;
    c.restore();
    // vignette and banner in screen space
    c.setTransform(dpr, 0, 0, dpr, 0, 0); if (!vignette) buildVignette(); c.drawImage(vignette, 0, 0, vw, vh);
    if (banner) { banner.t += dt; var a = Math.min(1, banner.t * 4, (banner.dur - banner.t) * 3); if (a <= 0 && banner.t > banner.dur) banner = null; else {
      var U = Math.min(T, vw / 11), bH = U * (banner.sub ? 1.9 : 1.3), bW = Math.min(vw * 0.9, U * 10), bx = (vw - bW) / 2, by = U * 0.3 + (reduceMotion ? 0 : (1 - Math.min(1, banner.t * 5)) * -U), pop = 1;
      c.save(); c.globalAlpha = Math.max(0, a) * 0.95;
      var pg = c.createLinearGradient(0, by, 0, by + bH); pg.addColorStop(0, 'rgba(60,80,170,0.94)'); pg.addColorStop(1, 'rgba(20,26,70,0.94)'); c.fillStyle = 'rgba(0,0,0,0.35)'; rr(c, bx, by + U * 0.12, bW, bH, U * 0.4); c.fill(); c.fillStyle = pg; rr(c, bx, by, bW, bH, U * 0.4); c.fill(); c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 2; c.stroke();
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '900 ' + Math.round(U * 0.75) + 'px system-ui, sans-serif'; c.lineJoin = 'round'; c.lineWidth = U * 0.14; c.strokeStyle = '#7a2c10';
      var ty2 = by + U * 0.62; c.strokeText(banner.text, vw / 2, ty2); var tg = c.createLinearGradient(0, ty2 - U * 0.4, 0, ty2 + U * 0.4); tg.addColorStop(0, '#fff6c8'); tg.addColorStop(0.55, '#ffb43a'); tg.addColorStop(1, '#ff6a2a'); c.fillStyle = tg; c.fillText(banner.text, vw / 2, ty2);
      if (banner.sub) { c.font = '700 ' + Math.round(U * 0.45) + 'px system-ui, sans-serif'; c.fillStyle = '#e6eeff'; c.fillText(banner.sub, vw / 2, by + U * 1.35); } c.restore(); } }
  }
  var EDIR = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] };
  function drawIcon(canvas, k, size) {
    var d = Math.min(3, root.devicePixelRatio || 1); canvas.width = size * d; canvas.height = size * d; canvas.style.width = size + 'px'; canvas.style.height = size + 'px';
    var c = canvas.getContext('2d'), saveT = T, saveS = sprites, saveD = dpr; dpr = d; sprites = {}; c.setTransform(d, 0, 0, d, 0, 0); T = size;
    if (k === 'robot') { T = size * 0.82; c.translate(size * 0.09, size * 0.16); drawRobot(c, { id: 0, x: 0, y: 0, face: 'd', anim: 0, dir: null, color: '#3fa9ff', shield: 0, inv: 0, alive: true }); }
    else drawItem(c, 0, 0, k, true);
    T = saveT; sprites = saveS; dpr = saveD;
  }
  function setReduceMotion(v) { userReduce = !!v; reduceMotion = sysReduce || userReduce; }
  root.BM.Render = { setup: setup, resize: resize, frame: frame, onEvents: onEvents, showBanner: showBanner, drawIcon: drawIcon, setReduceMotion: setReduceMotion, systemReduce: function () { return sysReduce; },
    reset: function () { parts = []; rings = []; staticLayer = null; banner = null; shakeT = 0; }, stats: function () { return { dpr: dpr, tile: T, w: cv.width, h: cv.height, boardW: bw, viewW: vw, parts: parts.length, lowFx: lowFx, reduceMotion: reduceMotion, sprites: Object.keys(sprites).length }; } };
})(this);
