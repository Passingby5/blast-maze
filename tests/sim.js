// Headless simulation: many story levels (bot plays) and battle matches. Checks every game ends and every level gets cleared.
const E = require('../src/engine.js'), assert = require('assert');
const SEEDS = +process.env.SEEDS || 12, DT = 1 / 60;
let cleared = new Array(E.LEVELS.length).fill(0), games = 0;
for (const diff of ['easy', 'medium', 'hard']) for (let lv = 0; lv < E.LEVELS.length; lv++) for (let s = 1; s <= SEEDS; s++) {
  const g = E.newStory(lv, { seed: s, difficulty: diff, carry: lv > 0 ? { bombs: 1 + (lv >> 2), range: 2 + (lv >> 2), speedUps: lv >> 2, kick: false, shield: 1, lives: 3, score: 0 } : null });
  assert(E.solvable(g), 'level ' + lv + ' unsolvable seed ' + s);
  g.players[0].bot = true; let n = 0;
  while (g.status === 'play') { E.step(g, [], DT); if (++n > 60 * (E.STORY_TIME + 2)) throw new Error('softlock story ' + lv + ' ' + s); }
  games++; if (g.status === 'won') cleared[lv]++;
}
console.log('story clears per level (of ' + SEEDS * 3 + '):', cleared.join(' '));
cleared.forEach((c, i) => assert(c > 0, 'level ' + (i + 1) + ' never cleared'));
let wins = {}, draws = 0;
for (const diff of ['easy', 'medium', 'hard']) for (let s = 1; s <= SEEDS * 2; s++) {
  const cpus = 1 + (s % 3), g = E.newBattle({ humans: 1, cpus, difficulty: diff, seed: s }); g.players[0].bot = true; let n = 0;
  while (g.status === 'play') { E.step(g, [], DT); if (++n > 60 * (E.BATTLE_TIME + 2)) throw new Error('softlock battle'); }
  games++; if (g.winner == null) draws++; else wins[g.winner] = (wins[g.winner] || 0) + 1;
}
console.log('battle winners by slot:', JSON.stringify(wins), 'draws:', draws, 'of', SEEDS * 6);
assert(draws / (SEEDS * 6) < 0.25, 'too many battle draws');
// MAJ-4: boss levels and level 11 should rarely run out of time (invincible bot as a stand-in for a careful player)
for (const diff of ['easy', 'medium', 'hard']) for (const lv of [5, 10, 11]) { let to = 0; for (let s = 1; s <= SEEDS; s++) { const g = E.newStory(lv, { seed: s, difficulty: diff }); g.players[0].bot = true; while (g.status === 'play') { g.players[0].inv = 1; E.step(g, [], DT); } if (g.timeUp) to++; }
  console.log('timeouts', diff, 'L' + (lv + 1), to + '/' + SEEDS); assert(to / SEEDS <= 0.15, 'too many timeouts ' + diff + ' L' + (lv + 1)); }
console.log('ok sim', games, 'games, no softlocks');
