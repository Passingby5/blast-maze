// Renderer: everything is drawn with canvas paths at devicePixelRatio, so it stays sharp on any screen.
(function (root) {
  var E = root.BM.Engine, W = E.W, H = E.H;
  var cv, ctx, dpr = 1, T = 32, bw = 0, bh = 0, vw = 0, vh = 0, camX = 0, camY = 0, camInit = false, staticLayer = null, parts = [], rings = [], time = 0, banner = null;
  function setup(canvas) { cv = canvas; ctx = cv.getContext('2d'); }
  function resize(cssW, cssH, minT) {
    // minT: on phones the board may be bigger than the screen; the view then follows the player (camera).
    dpr = Math.min(3, root.devicePixelRatio || 1); T = Math.floor(Math.max(Math.min(cssW / W, cssH / H), Math.min(minT || 0, cssH / H * 1.25)) * 4) / 4; bw = T * W; bh = T * H;
    vw = Math.min(bw, Math.floor(cssW)); vh = Math.min(bh, Math.floor(cssH)); camInit = false;
    cv.style.width = vw + 'px'; cv.style.height = vh + 'px'; cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr); staticLayer = null;
    return { w: vw, h: vh, tile: T };
  }
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function buildStatic(g) {
    var c = document.createElement('canvas'); c.width = Math.round(bw * dpr); c.height = Math.round(bh * dpr); var x2 = c.getContext('2d'); x2.setTransform(dpr, 0, 0, dpr, 0, 0);
    // floor
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      var px = x * T, py = y * T, gr = x2.createLinearGradient(px, py, px + T, py + T), even = (x + y) % 2 === 0;
      gr.addColorStop(0, even ? '#3d8b5a' : '#378252'); gr.addColorStop(1, even ? '#327a4b' : '#2d7045'); x2.fillStyle = gr; x2.fillRect(px, py, T + 0.5, T + 0.5);
      x2.fillStyle = 'rgba(255,255,255,0.05)'; x2.beginPath(); x2.arc(px + T * 0.3, py + T * 0.7, T * 0.05, 0, 7); x2.arc(px + T * 0.72, py + T * 0.28, T * 0.04, 0, 7); x2.fill();
    }
    // wall shadows then walls
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) if (g.map[y][x] === E.WALL) { x2.fillStyle = 'rgba(0,20,10,0.35)'; rr(x2, x * T + T * 0.12, y * T + T * 0.2, T, T, T * 0.2); x2.fill(); }
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) if (g.map[y][x] === E.WALL) drawWall(x2, x * T, y * T, x === 0 || y === 0 || x === W - 1 || y === H - 1);
    staticLayer = c;
  }
  function drawWall(c, px, py, border) {
    var s = T * 0.04, gr = c.createLinearGradient(px, py, px, py + T);
    gr.addColorStop(0, border ? '#6f7b99' : '#8892b0'); gr.addColorStop(1, border ? '#454e68' : '#5a6382');
    c.fillStyle = '#353c52'; rr(c, px + s, py + s * 2, T - s * 2, T - s * 2, T * 0.16); c.fill();
    c.fillStyle = gr; rr(c, px + s, py + s, T - s * 2, T - s * 4, T * 0.16); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.28)'; rr(c, px + T * 0.14, py + T * 0.1, T * 0.72, T * 0.12, T * 0.06); c.fill();
    c.strokeStyle = 'rgba(30,35,55,0.35)'; c.lineWidth = Math.max(1, T * 0.03); c.beginPath(); c.moveTo(px + T * 0.2, py + T * 0.5); c.lineTo(px + T * 0.8, py + T * 0.5); c.moveTo(px + T * 0.5, py + T * 0.5); c.lineTo(px + T * 0.5, py + T * 0.82); c.stroke();
  }
  function drawCrate(c, px, py) {
    var s = T * 0.07;
    c.fillStyle = 'rgba(0,20,10,0.3)'; rr(c, px + s + T * 0.08, py + s + T * 0.12, T - s * 2, T - s * 2, T * 0.12); c.fill();
    var gr = c.createLinearGradient(px, py, px, py + T); gr.addColorStop(0, '#e9a75a'); gr.addColorStop(1, '#b8722f');
    c.fillStyle = gr; rr(c, px + s, py + s, T - s * 2, T - s * 2, T * 0.12); c.fill();
    c.strokeStyle = '#8a5222'; c.lineWidth = T * 0.06; rr(c, px + s * 1.6, py + s * 1.6, T - s * 3.2, T - s * 3.2, T * 0.08); c.stroke();
    c.beginPath(); c.moveTo(px + s * 2, py + s * 2); c.lineTo(px + T - s * 2, py + T - s * 2); c.stroke();
    c.strokeStyle = 'rgba(255,235,190,0.45)'; c.lineWidth = T * 0.03; c.beginPath(); c.moveTo(px + s * 1.8, py + s * 1.5); c.lineTo(px + T - s * 1.8, py + s * 1.5); c.stroke();
    c.fillStyle = '#5c3615'; [[0.22, 0.22], [0.78, 0.22], [0.22, 0.78], [0.78, 0.78]].forEach(function (n) { c.beginPath(); c.arc(px + T * n[0], py + T * n[1], T * 0.035, 0, 7); c.fill(); });
  }
  var ICON = { bomb: '#4aa3ff', fire: '#ff7a2f', speed: '#ffd43b', kick: '#b377ff', shield: '#3ee0c0' };
  function drawItem(c, px, py, k) {
    var cx = px + T / 2, cy = py + T / 2 + Math.sin(time * 4 + px) * T * 0.05, r = T * 0.36;
    var gl = c.createRadialGradient(cx, cy, 0, cx, cy, T * 0.7); gl.addColorStop(0, hexA(ICON[k], 0.55)); gl.addColorStop(1, hexA(ICON[k], 0)); c.fillStyle = gl; c.fillRect(px - T * 0.2, py - T * 0.2, T * 1.4, T * 1.4);
    var gr = c.createLinearGradient(cx, cy - r, cx, cy + r); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.15, ICON[k]); gr.addColorStop(1, shade(ICON[k], -0.35));
    c.fillStyle = gr; rr(c, cx - r, cy - r, r * 2, r * 2, r * 0.45); c.fill(); c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = T * 0.04; c.stroke();
    c.save(); c.translate(cx, cy); c.fillStyle = '#fff'; c.strokeStyle = '#fff'; c.lineWidth = T * 0.06; c.lineCap = 'round'; c.lineJoin = 'round'; var u = T * 0.2;
    if (k === 'bomb') { c.beginPath(); c.arc(-u * 0.1, u * 0.2, u * 0.7, 0, 7); c.fill(); c.beginPath(); c.moveTo(u * 0.3, -u * 0.4); c.quadraticCurveTo(u * 0.6, -u * 0.9, u * 0.9, -u * 0.8); c.stroke(); }
    else if (k === 'fire') { c.beginPath(); c.moveTo(0, -u); c.bezierCurveTo(u * 0.9, -u * 0.2, u * 0.8, u, 0, u); c.bezierCurveTo(-u * 0.8, u, -u * 0.9, -u * 0.1, -u * 0.2, -u * 0.4); c.quadraticCurveTo(-u * 0.1, -u * 0.7, 0, -u); c.fill(); }
    else if (k === 'speed') { c.beginPath(); c.moveTo(u * 0.3, -u); c.lineTo(-u * 0.5, u * 0.15); c.lineTo(0, u * 0.15); c.lineTo(-u * 0.3, u); c.lineTo(u * 0.5, -u * 0.15); c.lineTo(0, -u * 0.15); c.closePath(); c.fill(); }
    else if (k === 'kick') { c.beginPath(); c.moveTo(-u * 0.6, -u); c.lineTo(-u * 0.6, u * 0.6); c.lineTo(u * 0.9, u * 0.6); c.lineTo(u * 0.9, u * 0.1); c.lineTo(-u * 0.05, -u * 0.1); c.lineTo(-u * 0.05, -u); c.closePath(); c.fill(); }
    else if (k === 'shield') { c.beginPath(); c.moveTo(0, -u); c.lineTo(u * 0.85, -u * 0.6); c.quadraticCurveTo(u * 0.8, u * 0.6, 0, u); c.quadraticCurveTo(-u * 0.8, u * 0.6, -u * 0.85, -u * 0.6); c.closePath(); c.fill(); }
    c.restore();
  }
  function hexA(h, a) { var n = parseInt(h.slice(1), 16); return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; }
  function shade(h, f) { var n = parseInt(h.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255, m = function (v) { return Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f))); }; return 'rgb(' + m(r) + ',' + m(g) + ',' + m(b) + ')'; }
  function shadow(c, cx, cy, w) { c.fillStyle = 'rgba(0,25,10,0.35)'; c.beginPath(); c.ellipse(cx, cy, w, w * 0.38, 0, 0, 7); c.fill(); }
  function drawBomb(c, b) {
    var cx = (b.x + 0.5) * T, cy = (b.y + 0.5) * T, k = 1 - b.timer / E.BOMB_TIME, pulse = 1 + Math.sin(time * (8 + k * 18)) * 0.06 * (0.5 + k), r = T * 0.34 * pulse;
    shadow(c, cx + T * 0.05, cy + T * 0.32, T * 0.3);
    var gr = c.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r); gr.addColorStop(0, '#6a7aa8'); gr.addColorStop(0.5, '#262d4a'); gr.addColorStop(1, '#0d1022');
    c.fillStyle = gr; c.beginPath(); c.arc(cx, cy, r, 0, 7); c.fill();
    if (k > 0.6) { c.fillStyle = 'rgba(255,60,60,' + (0.45 * Math.max(0, Math.sin(time * 20))) + ')'; c.beginPath(); c.arc(cx, cy, r, 0, 7); c.fill(); }
    c.fillStyle = 'rgba(255,255,255,0.7)'; c.beginPath(); c.ellipse(cx - r * 0.38, cy - r * 0.42, r * 0.22, r * 0.13, -0.6, 0, 7); c.fill();
    c.fillStyle = '#3c4466'; rr(c, cx - r * 0.25, cy - r * 1.12, r * 0.5, r * 0.3, 2); c.fill();
    c.strokeStyle = '#c9a36b'; c.lineWidth = T * 0.05; c.lineCap = 'round'; c.beginPath(); c.moveTo(cx, cy - r * 1.05); c.quadraticCurveTo(cx + r * 0.5, cy - r * 1.6, cx + r * 0.75, cy - r * 1.35); c.stroke();
    var sx = cx + r * 0.75, sy = cy - r * 1.35, sg = c.createRadialGradient(sx, sy, 0, sx, sy, T * 0.22);
    sg.addColorStop(0, 'rgba(255,255,220,1)'); sg.addColorStop(0.3, 'rgba(255,200,60,0.9)'); sg.addColorStop(1, 'rgba(255,120,0,0)'); c.fillStyle = sg; c.beginPath(); c.arc(sx, sy, T * 0.22 * (0.8 + Math.random() * 0.4), 0, 7); c.fill();
    if (Math.random() < 0.5) parts.push({ x: sx, y: sy, vx: (Math.random() - 0.5) * T * 3, vy: -Math.random() * T * 3, life: 0.3, max: 0.3, s: T * 0.05, col: '255,210,90', add: true, g: T * 6 });
  }
  function drawFlames(c, g) {
    c.save(); c.globalCompositeOperation = 'lighter';
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      var f = g.flames[y][x]; if (f <= 0) continue; var k = f / E.FLAME_TIME, cx = (x + 0.5) * T, cy = (y + 0.5) * T, s = Math.sin(k * Math.PI);
      var gl = c.createRadialGradient(cx, cy, 0, cx, cy, T * 1.1); gl.addColorStop(0, 'rgba(255,110,20,' + 0.45 * s + ')'); gl.addColorStop(1, 'rgba(255,80,0,0)'); c.fillStyle = gl; c.fillRect(cx - T * 1.1, cy - T * 1.1, T * 2.2, T * 2.2);
      var hor = (g.flames[y][x - 1] > 0) || (g.flames[y][x + 1] > 0), ver = (g.flames[y - 1] && g.flames[y - 1][x] > 0) || (g.flames[y + 1] && g.flames[y + 1][x] > 0);
      c.globalCompositeOperation = 'source-over';
      [[0.48, 'rgba(235,60,10,0.92)'], [0.36, 'rgba(255,130,20,0.96)'], [0.23, 'rgba(255,205,70,1)'], [0.1, 'rgba(255,255,225,1)']].forEach(function (L) {
        var w = T * L[0] * (0.6 + 0.4 * s) * (0.92 + Math.sin(time * 40 + x * 3 + y) * 0.08); c.fillStyle = L[1];
        if (hor || !ver) { rr(c, x * T - 1, cy - w, T + 2, w * 2, w * 0.9); c.fill(); }
        if (ver) { rr(c, cx - w, y * T - 1, w * 2, T + 2, w * 0.9); c.fill(); }
        if (!hor && !ver) { c.beginPath(); c.arc(cx, cy, w * 1.2, 0, 7); c.fill(); }
      });
      c.globalCompositeOperation = 'lighter';
    }
    c.restore();
  }
  function drawRobot(c, p, alpha) {
    var cx = (p.x + 0.5) * T, cy = (p.y + 0.5) * T, mv = p.dir ? 1 : 0, bob = Math.sin(p.anim * 6.5) * T * 0.04 * mv, lean = { l: -1, r: 1 }[p.face] || 0;
    c.save(); c.globalAlpha = alpha == null ? 1 : alpha;
    shadow(c, cx, cy + T * 0.36, T * 0.3);
    // feet
    c.fillStyle = '#2a2f45'; var st = Math.sin(p.anim * 6.5) * T * 0.07 * mv; c.beginPath(); c.ellipse(cx - T * 0.13, cy + T * 0.32 + Math.max(0, st), T * 0.1, T * 0.06, 0, 0, 7); c.ellipse(cx + T * 0.13, cy + T * 0.32 + Math.max(0, -st), T * 0.1, T * 0.06, 0, 0, 7); c.fill();
    var by = cy + bob, gr = c.createLinearGradient(cx, by - T * 0.4, cx, by + T * 0.3); gr.addColorStop(0, shade(p.color, 0.45)); gr.addColorStop(0.5, p.color); gr.addColorStop(1, shade(p.color, -0.4));
    // antenna
    c.strokeStyle = '#d8deef'; c.lineWidth = T * 0.035; c.beginPath(); c.moveTo(cx, by - T * 0.36); c.lineTo(cx + lean * T * 0.05, by - T * 0.5); c.stroke();
    c.fillStyle = '#fff15c'; c.beginPath(); c.arc(cx + lean * T * 0.05, by - T * 0.52, T * 0.055, 0, 7); c.fill();
    c.fillStyle = gr; rr(c, cx - T * 0.3, by - T * 0.38, T * 0.6, T * 0.66, T * 0.24); c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = T * 0.025; c.stroke();
    // visor
    var vx = cx + lean * T * 0.05, vy = by - T * 0.14 + (p.face === 'u' ? -T * 0.04 : p.face === 'd' ? T * 0.02 : 0);
    c.fillStyle = '#16203a'; rr(c, vx - T * 0.22, vy - T * 0.12, T * 0.44, T * 0.24, T * 0.11); c.fill();
    if (p.face !== 'u') { c.fillStyle = '#7ff3ff'; var ex = lean * T * 0.05; c.beginPath(); c.ellipse(vx - T * 0.09 + ex, vy, T * 0.045, T * 0.065, 0, 0, 7); c.ellipse(vx + T * 0.09 + ex, vy, T * 0.045, T * 0.065, 0, 0, 7); c.fill(); }
    c.fillStyle = 'rgba(255,255,255,0.35)'; rr(c, cx - T * 0.2, by - T * 0.34, T * 0.22, T * 0.06, T * 0.03); c.fill();
    if (p.shield > 0 || p.inv > 0) {
      var a = p.inv > 0 ? 0.35 + 0.3 * Math.sin(time * 25) : 0.35, sg = c.createRadialGradient(cx, by, T * 0.2, cx, by, T * 0.55);
      sg.addColorStop(0, 'rgba(120,255,230,0)'); sg.addColorStop(0.8, 'rgba(120,255,230,' + a * 0.6 + ')'); sg.addColorStop(1, 'rgba(200,255,250,' + a + ')');
      c.fillStyle = sg; c.beginPath(); c.arc(cx, by, T * 0.55, 0, 7); c.fill();
    }
    c.restore();
  }
  function drawEnemy(c, e) {
    var cx = (e.x + 0.5) * T, cy = (e.y + 0.5) * T, w = Math.sin(time * 6 + e.id) * 0.06, blink = e.inv > 0 && Math.sin(time * 30) > 0;
    c.save(); if (blink) c.globalAlpha = 0.45;
    if (e.type === 'boss') {
      var s = 1.35; shadow(c, cx, cy + T * 0.45, T * 0.5);
      var gr = c.createLinearGradient(cx, cy - T * 0.6, cx, cy + T * 0.4); gr.addColorStop(0, '#ffe58a'); gr.addColorStop(1, '#d98a12');
      c.fillStyle = gr; rr(c, cx - T * 0.45 * s, cy - T * 0.42 * s + w * T, T * 0.9 * s, T * 0.8 * s, T * 0.3); c.fill(); c.strokeStyle = '#8a5200'; c.lineWidth = T * 0.04; c.stroke();
      c.fillStyle = '#ff5ca8'; c.beginPath(); var ty = cy - T * 0.55 * s + w * T; c.moveTo(cx - T * 0.32, ty + T * 0.12); c.lineTo(cx - T * 0.3, ty - T * 0.14); c.lineTo(cx - T * 0.12, ty); c.lineTo(cx, ty - T * 0.2); c.lineTo(cx + T * 0.12, ty); c.lineTo(cx + T * 0.3, ty - T * 0.14); c.lineTo(cx + T * 0.32, ty + T * 0.12); c.closePath(); c.fill();
      c.fillStyle = '#1b1433'; rr(c, cx - T * 0.4, cy - T * 0.2 + w * T, T * 0.8, T * 0.3, T * 0.14); c.fill();
      c.fillStyle = '#ff4757'; c.beginPath(); c.arc(cx - T * 0.17, cy - T * 0.05 + w * T, T * 0.07, 0, 7); c.arc(cx + T * 0.17, cy - T * 0.05 + w * T, T * 0.07, 0, 7); c.fill();
      c.fillStyle = 'rgba(0,0,0,0.5)'; rr(c, cx - T * 0.5, cy - T * 0.95, T, T * 0.1, 3); c.fill(); c.fillStyle = '#5fff8a'; rr(c, cx - T * 0.5, cy - T * 0.95, T * e.hp / 6, T * 0.1, 3); c.fill();
    } else if (e.type === 'ghost') {
      var a = 0.78 + Math.sin(time * 3 + e.id) * 0.12; c.globalAlpha *= a; var gy = cy - T * 0.06 + Math.sin(time * 3 + e.id) * T * 0.06;
      shadow(c, cx, cy + T * 0.38, T * 0.22);
      var g2 = c.createLinearGradient(cx, gy - T * 0.35, cx, gy + T * 0.35); g2.addColorStop(0, '#ffffff'); g2.addColorStop(1, '#b9c7ff');
      c.fillStyle = g2; c.beginPath(); c.arc(cx, gy - T * 0.05, T * 0.3, Math.PI, 0); c.lineTo(cx + T * 0.3, gy + T * 0.3);
      for (var i = 0; i < 4; i++) { var xx = cx + T * 0.3 - (i + 0.5) * T * 0.15; c.quadraticCurveTo(xx, gy + T * (i % 2 ? 0.38 : 0.2) + Math.sin(time * 8 + i) * T * 0.03, xx - T * 0.075, gy + T * 0.3); }
      c.closePath(); c.fill();
      c.fillStyle = '#3a3f7a'; c.beginPath(); c.ellipse(cx - T * 0.1, gy - T * 0.05, T * 0.05, T * 0.08, 0, 0, 7); c.ellipse(cx + T * 0.1, gy - T * 0.05, T * 0.05, T * 0.08, 0, 0, 7); c.fill();
      c.beginPath(); c.arc(cx, gy + T * 0.1, T * 0.05, 0, Math.PI); c.fill();
    } else {
      var chaser = e.type === 'chaser', col = chaser ? '#ff5d5d' : '#a66bff';
      shadow(c, cx, cy + T * 0.36, T * 0.3);
      var sq = 1 + w, rx = T * 0.33 * sq, ry = T * 0.3 / sq, by = cy + T * 0.06 - (ry - T * 0.3);
      var g3 = c.createRadialGradient(cx - rx * 0.4, by - ry * 0.5, T * 0.04, cx, by, rx * 1.1); g3.addColorStop(0, shade(col, 0.55)); g3.addColorStop(0.6, col); g3.addColorStop(1, shade(col, -0.45));
      c.fillStyle = g3; c.beginPath();
      if (chaser) { for (var j = 0; j < 16; j++) { var an = j / 16 * Math.PI * 2, rad = j % 2 ? 1 : 1.16; c.lineTo(cx + Math.cos(an) * rx * rad, by + Math.sin(an) * ry * rad); } c.closePath(); }
      else c.ellipse(cx, by, rx, ry, 0, 0, 7);
      c.fill();
      var lx = e.dir === 'l' ? -1 : e.dir === 'r' ? 1 : 0, ly = e.dir === 'u' ? -1 : e.dir === 'd' ? 1 : 0;
      c.fillStyle = '#fff'; c.beginPath(); c.arc(cx - T * 0.11, by - T * 0.05, T * 0.085, 0, 7); c.arc(cx + T * 0.11, by - T * 0.05, T * 0.085, 0, 7); c.fill();
      c.fillStyle = '#1a1a2e'; c.beginPath(); c.arc(cx - T * 0.11 + lx * T * 0.03, by - T * 0.05 + ly * T * 0.03, T * 0.04, 0, 7); c.arc(cx + T * 0.11 + lx * T * 0.03, by - T * 0.05 + ly * T * 0.03, T * 0.04, 0, 7); c.fill();
      if (chaser) { c.strokeStyle = '#5a0f1a'; c.lineWidth = T * 0.04; c.lineCap = 'round'; c.beginPath(); c.moveTo(cx - T * 0.2, by - T * 0.17); c.lineTo(cx - T * 0.05, by - T * 0.12); c.moveTo(cx + T * 0.2, by - T * 0.17); c.lineTo(cx + T * 0.05, by - T * 0.12); c.stroke(); }
      c.fillStyle = 'rgba(255,255,255,0.4)'; c.beginPath(); c.ellipse(cx - rx * 0.45, by - ry * 0.55, rx * 0.2, ry * 0.12, -0.5, 0, 7); c.fill();
    }
    c.restore();
  }
  function drawPortal(c, p) {
    var cx = (p.x + 0.5) * T, cy = (p.y + 0.5) * T;
    if (!p.open) { c.fillStyle = 'rgba(20,30,60,0.35)'; c.beginPath(); c.ellipse(cx, cy, T * 0.38, T * 0.3, 0, 0, 7); c.fill(); c.strokeStyle = 'rgba(150,170,255,0.4)'; c.lineWidth = T * 0.04; c.stroke(); return; }
    c.save(); c.globalCompositeOperation = 'lighter';
    var gl = c.createRadialGradient(cx, cy, 0, cx, cy, T * 0.9); gl.addColorStop(0, 'rgba(160,120,255,0.8)'); gl.addColorStop(1, 'rgba(60,40,255,0)'); c.fillStyle = gl; c.fillRect(cx - T, cy - T, T * 2, T * 2);
    for (var i = 0; i < 3; i++) { c.strokeStyle = ['rgba(255,255,255,0.9)', 'rgba(140,220,255,0.8)', 'rgba(200,140,255,0.8)'][i]; c.lineWidth = T * 0.05; c.beginPath(); c.ellipse(cx, cy, T * (0.15 + i * 0.1), T * (0.12 + i * 0.08), 0, time * (2 + i) + i, time * (2 + i) + i + 4.2); c.stroke(); }
    c.restore();
  }
  function burst(x, y, n, col, speed, life, size, add, grav) { for (var i = 0; i < n; i++) { var a = Math.random() * 6.283, s = speed * (0.3 + Math.random() * 0.7); parts.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (0.6 + Math.random() * 0.4), max: life, s: size * (0.6 + Math.random() * 0.8), col: col, add: add, g: grav || 0 }); } }
  function onEvents(g) {
    g.events.forEach(function (ev) {
      var cx = (ev.x + 0.5) * T, cy = (ev.y + 0.5) * T;
      if (ev.t === 'boom') { rings.push({ x: cx, y: cy, life: 0.35, max: 0.35 }); ev.tiles.forEach(function (t) { var tx = (t[0] + 0.5) * T, ty = (t[1] + 0.5) * T; burst(tx, ty, 5, '255,190,80', T * 4, 0.45, T * 0.08, true); burst(tx, ty, 2, '200,200,210', T * 1, 0.9, T * 0.22, false, -T * 1.5); }); }
      else if (ev.t === 'crate') { burst(cx, cy, 10, '200,130,60', T * 4, 0.6, T * 0.09, false, T * 8); }
      else if (ev.t === 'power') { burst(cx, cy, 18, '255,240,140', T * 4, 0.6, T * 0.07, true); }
      else if (ev.t === 'pop' || ev.t === 'ko') { burst(cx, cy, 24, ev.t === 'ko' ? '255,255,255' : '220,170,255', T * 5, 0.8, T * 0.09, true); burst(cx, cy, 6, '230,230,240', T * 1.2, 1, T * 0.25, false, -T); }
      else if (ev.t === 'shield' || ev.t === 'bosshit') { rings.push({ x: cx, y: cy, life: 0.3, max: 0.3, col: '120,255,230' }); }
      else if (ev.t === 'drop') { staticLayer = null; burst(cx, cy, 8, '190,200,220', T * 2, 0.6, T * 0.15, false, -T); }
      else if (ev.t === 'portal') { burst(cx, cy, 30, '180,150,255', T * 4, 1, T * 0.08, true); }
    });
  }
  function showBanner(text, sub, dur) { banner = { text: text, sub: sub || '', t: 0, dur: dur || 2 }; }
  function frame(g, dt) {
    time += dt; if (!staticLayer || staticLayer.width !== Math.round(bw * dpr)) buildStatic(g);
    var focus = g.players.filter(function (p) { return p.human && !p.bot; })[0] || g.players[0], tx = Math.max(0, Math.min(bw - vw, (focus.x + 0.5) * T - vw / 2)), ty = Math.max(0, Math.min(bh - vh, (focus.y + 0.5) * T - vh / 2));
    if (!camInit) { camX = tx; camY = ty; camInit = true; } else { var kk = Math.min(1, dt * 7); camX += (tx - camX) * kk; camY += (ty - camY) * kk; }
    var c = ctx; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height);
    var sh = g.shake * g.shake * T * 0.3, ox = (Math.random() - 0.5) * sh, oy = (Math.random() - 0.5) * sh;
    c.setTransform(dpr, 0, 0, dpr, (ox - camX) * dpr, (oy - camY) * dpr);
    c.drawImage(staticLayer, 0, 0, bw, bh);
    var x, y;
    if (g.portal) drawPortal(c, g.portal);
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) if (g.items[y][x] && g.map[y][x] === E.FLOOR) drawItem(c, x * T, y * T, g.items[y][x]);
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) if (g.map[y][x] === E.CRATE) drawCrate(c, x * T, y * T);
    g.bombs.forEach(function (b) { drawBomb(c, { x: b.x + (b.slide ? (EDIR[b.slide][0] * b.sp) : 0), y: b.y + (b.slide ? EDIR[b.slide][1] * b.sp : 0), timer: b.timer }); });
    var ents = g.enemies.filter(function (e) { return e.alive; }).concat(g.players.filter(function (p) { return p.alive || p.deadT < 0.6; })).sort(function (a, b) { return a.y - b.y; });
    ents.forEach(function (e) { if (e.kind === 'player') drawRobot(c, e, e.alive ? 1 : Math.max(0, 1 - e.deadT / 0.6)); else drawEnemy(c, e); });
    drawFlames(c, g);
    // rings
    c.save(); c.globalCompositeOperation = 'lighter';
    rings = rings.filter(function (r) { r.life -= dt; if (r.life <= 0) return false; var k = 1 - r.life / r.max; c.strokeStyle = 'rgba(' + (r.col || '255,230,170') + ',' + (1 - k) + ')'; c.lineWidth = T * 0.15 * (1 - k); c.beginPath(); c.arc(r.x, r.y, T * (0.3 + k * 1.4), 0, 7); c.stroke(); return true; });
    parts = parts.filter(function (p) {
      p.life -= dt; if (p.life <= 0) return false; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.97; var k = p.life / p.max;
      c.globalCompositeOperation = p.add ? 'lighter' : 'source-over'; c.fillStyle = 'rgba(' + p.col + ',' + (p.add ? k : k * 0.5) + ')'; c.beginPath(); c.arc(p.x, p.y, p.s * (p.add ? k : 2 - k), 0, 7); c.fill(); return true;
    });
    if (parts.length > 700) parts.splice(0, parts.length - 700);
    c.restore();
    // vignette and banner in screen space
    c.setTransform(dpr, 0, 0, dpr, 0, 0); var bw0 = bw, bh0 = bh; bw = vw; bh = vh;
    var vg = c.createRadialGradient(bw / 2, bh / 2, Math.min(bw, bh) * 0.35, bw / 2, bh / 2, Math.max(bw, bh) * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,10,30,0.35)'); c.fillStyle = vg; c.fillRect(-10, -10, bw + 20, bh + 20);
    if (banner) { banner.t += dt; var a = Math.min(1, banner.t * 4, (banner.dur - banner.t) * 3); if (a <= 0 && banner.t > banner.dur) banner = null; else {
      c.save(); c.globalAlpha = Math.max(0, a); c.fillStyle = 'rgba(10,15,40,0.65)'; rr(c, bw * 0.1, bh * 0.36, bw * 0.8, bh * 0.28, T * 0.5); c.fill();
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff'; c.font = '800 ' + Math.round(T * 0.95) + 'px system-ui, sans-serif'; c.shadowColor = 'rgba(255,180,60,0.9)'; c.shadowBlur = T * 0.5; c.fillText(banner.text, bw / 2, bh * (banner.sub ? 0.46 : 0.5));
      if (banner.sub) { c.shadowBlur = 0; c.font = '600 ' + Math.round(T * 0.55) + 'px system-ui, sans-serif'; c.fillStyle = '#ffe9a8'; c.fillText(banner.sub, bw / 2, bh * 0.56); } c.restore(); } }
    bw = bw0; bh = bh0;
  }
  var EDIR = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] };
  function drawIcon(canvas, k, size) { var d = Math.min(3, root.devicePixelRatio || 1); canvas.width = size * d; canvas.height = size * d; canvas.style.width = size + 'px'; canvas.style.height = size + 'px'; var c = canvas.getContext('2d'), saveT = T; c.setTransform(d, 0, 0, d, 0, 0); T = size; if (k === 'robot') drawRobot(c, { x: 0, y: 0.05, face: 'd', anim: 0, dir: null, color: '#3fa9ff', shield: 0, inv: 0 }); else drawItem(c, 0, 0, k); T = saveT; }
  root.BM.Render = { setup: setup, resize: resize, frame: frame, onEvents: onEvents, showBanner: showBanner, drawIcon: drawIcon, reset: function () { parts = []; rings = []; staticLayer = null; banner = null; }, stats: function () { return { dpr: dpr, tile: T, w: cv.width, h: cv.height, boardW: bw, viewW: vw, parts: parts.length }; } };
})(this);
