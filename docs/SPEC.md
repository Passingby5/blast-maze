# Blast Maze: Spec and Acceptance Checklist

Blast Maze is an original, family-friendly maze blasting game. Cartoon robots, puffy cartoon blasts, no gore. All art is drawn in code, all sound is synthesized in code. No outside game names, characters, sprites or music.

## Acceptance checklist (each item is testable)

### Board and rules
1. The board is a 15 x 13 grid with a solid border, solid pillars on every even row and column, and breakable crates. (unit)
2. Player spawn corners always have 3 free tiles so the player can place a bomb and escape. (unit)
3. A bomb explodes after 2.4 seconds in a plus shape. The blast stops at solid walls, and breaks the first crate it hits. (unit)
4. A blast that reaches another bomb sets it off right away (chain reaction). (unit)
5. A player can walk off the bomb they just placed, but cannot walk back onto it. (unit)
6. Power-ups: Extra Bomb, Bigger Blast, Speed, Kick and Shield. Each one works. (unit)
7. Kick: walking into a bomb with Kick slides it until it hits something. (unit)
8. Shield takes one hit, then gives 2 seconds of safety. (unit)
9. Same seed gives the same level and the same game (seeded RNG). (unit)

### Enemies and modes
10. Three enemy types (Blob wanders, Chaser hunts you, Ghost floats through crates) plus a Boss with 6 hit points that calls in helpers. (unit)
11. Easy, Medium and Hard change enemy speed, how often enemies hunt you, CPU skill, and starting lives. (unit)
12. Story mode has 12 levels. Level 6 and level 12 are boss levels. Clear all enemies, then step on the glowing portal. (unit)
13. Every story level is solvable: every enemy and the portal can be reached once crates are broken. (unit + sim)
14. Battle mode: you plus 1 to 3 CPU robots, or 2 humans on one keyboard plus CPUs. Last robot standing wins the round. First to 2 round wins takes the match. (unit + sim)
15. Every round has a time limit (story 200 s, battle 120 s), so no game can get stuck. (sim)
16. Headless simulation of many story levels and battle matches: every game ends, no errors, and every story level is cleared by the bot in at least one seed. (sim)

### Controls
17. Keyboard: Player 1 uses WASD or arrow keys plus Space. With 2 players, Player 1 uses WASD + Space and Player 2 uses arrows + Enter. P or Esc pauses. (browser)
18. Touch: a virtual joystick and a big bomb button, shown on touch devices, at 390x844 portrait and 844x390 landscape. (browser)
19. All buttons are at least 48 x 48 px. Fast double taps only count once (debounced). No sideways scrolling. (browser)

### Look and sound
20. Canvas draws at devicePixelRatio, so lines stay sharp. Blasts glow, sparks and smoke fly, robots cast shadows, and the screen shakes on big blasts. Runs on requestAnimationFrame with a fixed 60 steps per second. (browser)
21. Sound effects and background music are made with WebAudio. A mute button works and is remembered. (browser)

### App
22. Single page PWA built by build.js into site/, with manifest, icons and a network-first, auto-updating service worker. (browser)
23. Home shows a version label like "v1 - Oct 26 - abc1234" that matches version.json. (browser)
24. Story progress saves after every level (save format has a version number; old or broken saves are ignored safely). Continue appears on home after a reload. (unit + browser)
25. No console errors or warnings during the click-through. (browser)
26. A single-file test copy is built at /workspace/blast-maze-test.html and runs with no server. (browser)
