// Easy CPUs must be clearly weaker than Hard. Two measures over many seeded matches:
// 1) how long an idle player lasts before the CPUs knock it out (median, before sudden death), 2) how often the test bot (standing in for a player) wins.
const E = require('../src/engine.js'), assert = require('assert'), N = +process.env.SEEDS || 40;
function trial(diff, cpus) { let idleKO = 0, botWins = 0, bombs = 0; const tk = [];
  for (let s = 1; s <= N; s++) {
    let g = E.newBattle({ humans: 1, cpus, difficulty: diff, seed: s });
    while (g.status === 'play' && g.players[0].alive && g.timeLeft > E.SHRINK_AT + 0.5) { E.step(g, [{}], 1 / 60); g.events.forEach(e => { if (e.t === 'place') bombs++; }); }
    if (!g.players[0].alive) idleKO++; tk.push(g.players[0].alive ? 49.5 : g.t);
    g = E.newBattle({ humans: 1, cpus, difficulty: diff, seed: s + 500 }); g.players[0].bot = true;
    while (g.status === 'play') E.step(g, [], 1 / 60); if (g.winner === g.players[0].id) botWins++;
  }
  tk.sort((a, b) => a - b); return { koMedianS: +tk[N >> 1].toFixed(1), idleKO: idleKO / N, botWin: botWins / N, cpuBombsPerGame: +(bombs / N).toFixed(1) }; }
for (const cpus of [1, 3]) { const ez = trial('easy', cpus), hd = trial('hard', cpus);
  console.log(cpus + ' CPU  easy ' + JSON.stringify(ez) + '  hard ' + JSON.stringify(hd));
  assert(ez.idleKO <= hd.idleKO * 0.6 || ez.koMedianS >= hd.koMedianS * 1.3, 'easy CPUs should knock out an idle player less often or later (' + cpus + ')');
  assert(ez.botWin >= hd.botWin + 0.15, 'player should win much more on easy (' + cpus + ')');
  assert(ez.cpuBombsPerGame < hd.cpuBombsPerGame, 'easy drops fewer bombs'); }
console.log('ok difficulty: Easy CPUs clearly weaker than Hard');
