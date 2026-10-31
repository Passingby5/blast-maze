// UI: screens, input (keyboard + touch), game loop, save/resume.
(function (root) {
  var E = BM.Engine, R = BM.Render, A = BM.Audio, S = BM.Save, $ = function (id) { return document.getElementById(id); };
  var store = root.localStorage, data = S.read(store), st = { screen: 'home', g: null, paused: false, humans: 1, cpus: 3, story: null, wins: null, round: 1, handled: false, frames: 0 };
  var touch = ('ontouchstart' in root) || (root.matchMedia && root.matchMedia('(pointer: coarse)').matches);
  document.body.classList.toggle('touch', !!touch);
  // ---------- screens ----------
  var hist = false;
  function guardBack() { if (!hist && root.history && history.pushState) { try { history.pushState({ bm: 1 }, ''); hist = true; } catch (e) { } } }
  root.addEventListener('popstate', function () { hist = false;
    if (st.screen === 'play') { pause(); guardBack(); } else if (st.screen === 'overlay' && st.g) { guardBack(); } else if (st.screen !== 'home') { st.g = null; st.paused = false; show('home'); } });
  function show(id) { if (id !== 'home') guardBack(); ['home', 'battleSetup', 'help', 'play', 'overlay'].forEach(function (s) { $(s).classList.toggle('hidden', s !== id && !(id === 'overlay' && s === 'play')); }); st.screen = id; if (id === 'home') refreshHome(); if (id !== 'play' && id !== 'overlay') A.music('menu'); }
  function refreshHome() {
    $('btnContinue').classList.toggle('hidden', !data.story);
    if (data.story) $('btnContinue').textContent = 'Continue: Level ' + (data.story.level + 1);
    [].forEach.call(document.querySelectorAll('[data-act=diff]'), function (b) { b.classList.toggle('on', b.dataset.v === data.settings.difficulty); });
    $('best').textContent = data.best ? 'Best story score: ' + data.best : '';
  }
  function refreshCalm() { var b = document.getElementById('btnCalm'); var sys = R.systemReduce(); if (b) { b.textContent = sys ? 'Screen shake: Off (reduced motion)' : 'Screen shake: ' + (data.settings.calm ? 'Off' : 'On'); b.disabled = sys; b.title = sys ? 'Your device asks for reduced motion, so shaking stays off.' : ''; b.classList.toggle('on', !sys && !data.settings.calm); } R.setReduceMotion(data.settings.calm); }
  function refreshMute() { [].forEach.call(document.querySelectorAll('.muteBtn'), function (b) { b.textContent = b.classList.contains('icon') ? (data.settings.muted ? '\u00d7' : '\u266b') : 'Sound: ' + (data.settings.muted ? 'Off' : 'On'); b.classList.toggle('on', !data.settings.muted && !b.classList.contains('icon')); }); A.setMuted(data.settings.muted); }
  function overlay(title, text, btns, html) { $('ovTitle').textContent = title; if (html) $('ovText').innerHTML = html; else $('ovText').textContent = text || ''; var box = $('ovBtns'); box.innerHTML = ''; btns.forEach(function (b) { var el = document.createElement('button'); el.textContent = b[0]; el.dataset.act = b[1]; if (b[2]) el.className = b[2]; box.appendChild(el); }); show('overlay'); }
  function save() { S.write(store, data); }
  // ---------- game start ----------
  function startStory(level, carry) {
    st.story = { level: level, carry: carry || null }; var attempt = ((data.story && data.story.attempt) || 0) + 1;
    data.story = { level: level, difficulty: data.settings.difficulty, attempt: attempt, carry: carry || { bombs: 1, range: 2, speedUps: 0, kick: false, shield: 0, lives: E.DIFF[data.settings.difficulty].lives, score: 0 } }; save();
    begin(E.newStory(level, { seed: 20261026 + attempt * 7919, difficulty: data.story.difficulty, carry: data.story.carry }));
    R.showBanner('Level ' + (level + 1), E.LEVELS[level].name, 2.2); A.music(E.LEVELS[level].boss ? 'boss' : 'main');
  }
  function startBattle(round) {
    st.round = round; if (round === 1) st.wins = [0, 0, 0, 0];
    begin(E.newBattle({ humans: st.humans, cpus: st.cpus, difficulty: data.settings.difficulty, seed: (Date.now() % 100000) + round, wins: st.wins }));
    R.showBanner('Round ' + round, 'Last robot standing wins!', 2); A.music('main');
  }
  function begin(g) { st.zoomOut = false; st.g = g; st.paused = false; st.handled = false; R.reset(); show('play'); layout(); updateHud(true); }
  // ---------- layout ----------
  function layout() {
    var vw = root.innerWidth, vh = root.innerHeight, land = vw > vh; document.body.classList.toggle('landscape', land && touch);
    if (st.screen !== 'play' && st.screen !== 'overlay') return;
    var hud = 56, aw = vw - 12, ah = vh - hud - 12;
    if (touch && !land) ah -= 230; if (touch && land) aw = vw - 2 * 218;
    R.resize(Math.max(150, aw), Math.max(130, ah), touch && !st.zoomOut ? (land ? 30 : 36) : 0);
  }
  root.addEventListener('resize', layout); root.addEventListener('orientationchange', function () { setTimeout(layout, 200); });
  // ---------- HUD ----------
  var hudKey = ''; function fmt(n) { return n >= 100000 ? Math.floor(n / 1000) + 'k' : String(n); }
  function updateHud(force) {
    var g = st.g; if (!g) return; var p = g.players[0], L, M;
    if (g.mode === 'story') { L = '<span class="chip">L' + (g.level + 1) + '</span><span class="chip">\u2665 ' + g.lives + '</span>'; M = '<span class="chip">\u25cf' + p.bombs + ' \u2739' + p.range + '</span><span class="chip">' + Math.max(0, Math.ceil(g.timeLeft)) + 's</span><span class="chip score">' + fmt(g.score) + '</span>'; }
    else { L = g.players.map(function (q) { return '<span class="chip" style="opacity:' + (q.alive ? 1 : 0.4) + '"><i class="dot" style="background:' + q.color + ';color:' + q.color + '"></i>' + q.wins + '</span>'; }).join(''); M = '<span class="chip">' + Math.max(0, Math.ceil(g.timeLeft)) + 's</span>'; }
    var k = L + M; if (k !== hudKey || force) { hudKey = k; $('hudL').innerHTML = L; $('hudM').innerHTML = M; }
  }
  // ---------- input ----------
  var keys = [[], []], bombQ = [false, false], stickDir = null;
  var KMAP = { KeyW: [0, 'u'], KeyS: [0, 'd'], KeyA: [0, 'l'], KeyD: [0, 'r'], ArrowUp: [1, 'u'], ArrowDown: [1, 'd'], ArrowLeft: [1, 'l'], ArrowRight: [1, 'r'] };
  function who(k) { var m = KMAP[k]; if (!m) return null; var pl = m[0]; if (!st.g || st.g.players.filter(function (p) { return p.human; }).length < 2) pl = 0; return [pl, m[1]]; }
  root.addEventListener('keydown', function (e) {
    A.init();
    if (e.code === 'KeyP' || e.code === 'Escape') { if (st.screen === 'play') pause(); else if (st.paused && st.g && st.screen === 'overlay') resume(); return; }
    var m = who(e.code); if (m) { e.preventDefault(); var a = keys[m[0]]; if (a.indexOf(m[1]) < 0) a.push(m[1]); return; }
    if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') { if (st.screen !== 'play') return; e.preventDefault(); if (e.repeat) return; var two = st.g && st.g.players.filter(function (p) { return p.human; }).length > 1; bombQ[two && e.code !== 'Space' ? 1 : 0] = true; }
  });
  root.addEventListener('keyup', function (e) { var m = who(e.code); if (m) { var a = keys[m[0]], i = a.indexOf(m[1]); if (i >= 0) a.splice(i, 1); } });
  root.addEventListener('blur', function () { keys = [[], []]; if (st.screen === 'play') pause(); });
  // D-pad: each finger on the pad picks the arm under it (by angle from the center), sliding switches arms without lifting,
  // and the most recently pressed or changed finger wins.
  var pad = $('dpad'), arms = {}, padPts = {}, padSeq = 0;
  [].forEach.call(pad.querySelectorAll('.arm'), function (a) { arms[a.dataset.d] = a; });
  function padDirAt(e) { var r = pad.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2); if (Math.hypot(dx, dy) < r.width * 0.09) return null; return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'r' : 'l') : (dy > 0 ? 'd' : 'u'); }
  function padRefresh() { var best = null; for (var k in padPts) if (padPts[k].d && (!best || padPts[k].s > best.s)) best = padPts[k]; stickDir = best ? best.d : null; for (var d in arms) arms[d].classList.toggle('on', d === stickDir); }
  function padMove(e) { var pt = padPts[e.pointerId]; if (!pt) return; var d = padDirAt(e); if (d !== pt.d) { pt.d = d; pt.s = ++padSeq; padRefresh(); } e.preventDefault(); }
  pad.addEventListener('pointerdown', function (e) { A.init(); try { pad.setPointerCapture(e.pointerId); } catch (x) { } padPts[e.pointerId] = { d: null, s: 0 }; padMove(e); if (navigator.vibrate) try { navigator.vibrate(8); } catch (x) { } e.preventDefault(); });
  pad.addEventListener('pointermove', padMove);
  function padUp(e) { if (!padPts[e.pointerId]) return; delete padPts[e.pointerId]; padRefresh(); }
  pad.addEventListener('pointerup', padUp); pad.addEventListener('pointercancel', padUp); pad.addEventListener('lostpointercapture', padUp);
  pad.addEventListener('contextmenu', function (e) { e.preventDefault(); }); $('bombBtn').addEventListener('contextmenu', function (e) { e.preventDefault(); });
  $('bombBtn').addEventListener('pointerdown', function (e) { e.preventDefault(); A.init(); bombQ[0] = true; if (navigator.vibrate) try { navigator.vibrate(12); } catch (x) { } });
  function inputs() { var out = [0, 1].map(function (i) { var a = keys[i], d = a.length ? a[a.length - 1] : null; if (i === 0 && stickDir) d = stickDir; var o = { dir: d, bomb: bombQ[i] }; bombQ[i] = false; return o; }); return out; }
  // ---------- buttons (debounced) ----------
  var lastTap = 0;
  document.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-act]'); if (!b) return; var now = Date.now(); if (now - lastTap < 350) return; lastTap = now;
    A.init(); A.sfx('tap'); act(b.dataset.act, b.dataset.v);
  });
  function act(a, v) {
    switch (a) {
      case 'story': startStory(0, null); break;
      case 'continue': if (data.story) { if (data.story.difficulty) data.settings.difficulty = data.story.difficulty; startStory(data.story.level, data.story.carry); } break;
      case 'battle': show('battleSetup'); setupRefresh(); break;
      case 'humans': st.humans = +v; if (st.humans + st.cpus > 4) st.cpus = 4 - st.humans; setupRefresh(); break;
      case 'cpus': st.cpus = Math.min(+v, 4 - st.humans); setupRefresh(); break;
      case 'startBattle': startBattle(1); break;
      case 'diff': data.settings.difficulty = v; save(); refreshHome(); break;
      case 'calm': data.settings.calm = !data.settings.calm; save(); refreshCalm(); break;
      case 'mute': data.settings.muted = !data.settings.muted; save(); refreshMute(); break;
      case 'help': show('help'); break;
      case 'home': st.g = null; st.paused = false; show('home'); break;
      case 'pause': pause(); break;
      case 'resume': resume(); break;
      case 'restart': if (st.g.mode === 'story') { var lv = st.g.lives - 1; if (lv <= 0) { st.g.lives = 0; st.g.status = 'lost'; st.g.endT = 9; st.handled = false; st.paused = false; outcome(); } else startStory(st.story.level, Object.assign(E.carry(st.g), { lives: lv, score: data.story.carry.score })); } else startBattle(st.round); break;
      case 'next': if (st.g.mode === 'story') { var c = E.carry(st.g); if (st.g.level + 1 >= E.LEVELS.length) { data.story = null; save(); show('home'); } else startStory(st.g.level + 1, c); } else startBattle(st.round + 1); break;
      case 'retry': var dl = E.DIFF[data.settings.difficulty].lives, cc = Object.assign({}, data.story.carry, { lives: dl }); startStory(st.story.level, cc); break;
      case 'again': if (st.g.mode === 'story') { var c2 = E.carry(st.g); startStory(st.g.level, c2); } else startBattle(1); break;
    }
  }
  function setupRefresh() {
    [].forEach.call(document.querySelectorAll('[data-act=humans]'), function (b) { b.classList.toggle('on', +b.dataset.v === st.humans); });
    [].forEach.call(document.querySelectorAll('[data-act=cpus]'), function (b) { b.classList.toggle('on', +b.dataset.v === st.cpus); b.disabled = +b.dataset.v + st.humans > 4; });
    $('twoNote').classList.toggle('hidden', st.humans < 2);
  }
  function pause() { if (!st.g || st.g.status !== 'play') return; st.paused = true; overlay('Paused', 'Take a breather.', [['Resume', 'resume', 'big'], ['Restart', 'restart'], ['Home', 'home', 'back']]); }
  function resume() { if (!st.g) { st.paused = false; show('home'); return; } st.paused = false; show('play'); }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden' && st.screen === 'play') pause(); });
  // ---------- outcome ----------
  function outcome() {
    var g = st.g; if (st.handled || g.status === 'play' || g.endT < 1.4) return; st.handled = true;
    if (g.mode === 'story') {
      if (g.status === 'won') {
        if (g.score > data.best) data.best = g.score;
        if (g.level + 1 >= E.LEVELS.length) { data.story = null; save(); overlay('You did it!', 'You beat all 12 levels and the Mega Bolt. Final score: ' + g.score + '. Great teamwork!', [['Play Again', 'story', 'big'], ['Home', 'home', 'back']]); }
        else { data.story = { level: g.level + 1, difficulty: g.diff, carry: E.carry(g) }; save(); overlay('Level Clear!', E.LEVELS[g.level].name + ' done. Score: ' + g.score, [['Next Level', 'next', 'big'], ['Home', 'home', 'back']]); }
      } else if (g.status === 'dead') { data.story.carry = Object.assign({}, data.story.carry, { lives: g.lives }); save(); overlay(g.timeUp ? "Time's up!" : 'Oops!', (g.timeUp ? 'The clock ran out. ' : '') + 'You have ' + g.lives + (g.lives === 1 ? ' life' : ' lives') + ' left. Try again!', [['Try Again', 'again', 'big'], ['Home', 'home', 'back']]); }
      else { data.story = { level: g.level, difficulty: g.diff, attempt: data.story ? data.story.attempt : 0, carry: Object.assign({}, data.story ? data.story.carry : E.carry(g), { lives: E.DIFF[g.diff].lives }) }; save(); overlay(g.timeUp ? "Time's up! Game Over" : 'Game Over', 'Nice try! You can start again from level ' + (g.level + 1) + ' with full lives.', [['Retry Level', 'retry', 'big'], ['Home', 'home', 'back']]); }
    } else {
      st.wins = g.players.map(function (p) { return p.wins; });
      var w = g.players.find(function (p) { return p.id === g.winner; }), champ = g.players.find(function (p) { return p.wins >= 2; });
      var tally = g.players.map(function (p) { return p.name + ': ' + p.wins; }).join('   '), html = null;
      if (g.onPoints || !w) html = pointsHtml(g, w) + '<p class="tally">Rounds won: ' + g.players.map(function (p) { return esc(p.name) + ' ' + p.wins; }).join(', ') + '</p>';
      if (champ) overlay(wins(champ.name) + (g.onPoints ? ' the match on points!' : ' the match!'), tally, [['Play Again', 'again', 'big'], ['Home', 'home', 'back']], html);
      else overlay(w ? wins(w.name) + (g.onPoints ? ' on points!' : ' the round!') : "Time's up! It's a draw.", tally, [['Next Round', 'next', 'big'], ['Home', 'home', 'back']], html);
    }
  }
  function wins(name) { return name === 'You' ? 'You win' : name + ' wins'; }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function pointsHtml(g, w) {
    var rows = g.players.slice().sort(function (a, b) { return b.pts - a.pts; }).map(function (p) {
      return '<tr' + (w && p.id === w.id ? ' class="top"' : '') + '><td><i class="dot" style="background:' + p.color + ';color:' + p.color + '"></i> ' + esc(p.name) + '</td><td>' + p.kos + '</td><td>' + p.crates + '</td><td>' + p.ups + '</td><td><b>' + p.pts + '</b></td></tr>'; }).join('');
    return '<p class="why">' + (g.timeLeft <= 0 ? 'Time\'s up! More than one robot was still standing, so we count points!' : 'Nobody was left standing alone, so we count points!') + '<br>Knock out a robot = 100, break a crate = 10, grab a power-up = 20.</p><table class="pts"><tr><th></th><th>KOs</th><th>Crates</th><th>Power-ups</th><th>Points</th></tr>' + rows + '</table>';
  }
  function sounds(g) { g.events.forEach(function (ev) { var m = { place: 'place', boom: 'boom', crate: 'crate', power: 'power', kick: 'kick', shield: 'shield', pop: 'pop', ko: 'ko', win: 'win', lose: 'lose', portal: 'portal', bosshit: 'bosshit', draw: 'lose' }[ev.t]; if (m) A.sfx(m); }); }
  // ---------- loop ----------
  var lastT = 0, acc = 0, STEP = 1 / 60;
  function loop(t) {
    requestAnimationFrame(loop); var dt = Math.min(0.1, (t - (lastT || t)) / 1000); lastT = t; st.frames++;
    var g = st.g; if (!g || (st.screen !== 'play' && st.screen !== 'overlay')) return;
    if (!st.paused) { acc += dt; var n = 0; while (acc >= STEP && n++ < 6) { E.step(g, inputs(), STEP); R.onEvents(g); sounds(g); acc -= STEP; } if (acc > STEP) acc = 0; }
    if (touch && !st.zoomOut && g.mode === 'battle' && !g.players.some(function (p) { return p.human && p.alive; }) && g.players.some(function (p) { return p.human && p.deadT > 0.8; })) { st.zoomOut = true; layout(); }
    R.frame(g, st.paused ? 0 : dt); updateHud(); outcome();
  }
  // ---------- init ----------
  $('ver').textContent = BM_BUILD.label;
  R.setup($('cv')); refreshCalm(); R.drawIcon($('logoBot'), 'robot', 84);
  var names = { bomb: 'Extra Bomb', fire: 'Bigger Blast', speed: 'Speed', kick: 'Kick', shield: 'Shield' };
  E.POWERS.forEach(function (k) { var d = document.createElement('div'), c = document.createElement('canvas'); R.drawIcon(c, k, 34); d.appendChild(c); d.appendChild(document.createTextNode(names[k])); $('powerList').appendChild(d); });
  refreshMute(); show('home'); requestAnimationFrame(loop);
  BM.UI = { state: function () { var g = st.g; return { screen: st.screen, paused: st.paused, frames: st.frames, save: data, mode: g && g.mode, status: g && g.status, level: g && g.level, bombs: g ? g.bombs.length : 0, flames: g ? g.flames.flat().filter(function (f) { return f > 0; }).length : 0, player: g && { x: g.players[0].x, y: g.players[0].y, range: g.players[0].range, bombs: g.players[0].bombs, alive: g.players[0].alive }, players: g ? g.players.length : 0, humans: g ? g.players.filter(function (p) { return p.human; }).length : 0, render: R.stats(), muted: data.settings.muted }; },
    game: function () { return st.g; }, save: save };
})(this);
