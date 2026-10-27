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
11. Easy, Medium and Hard change enemy speed, how often enemies hunt you, CPU skill, and starting lives (5, 3, 2). (unit)
12. Story mode has 12 levels. Level 6 and level 12 are boss levels. Clear all enemies, then step on the glowing portal. (unit)
13. Every story level is solvable: every enemy and the portal can be reached once crates are broken. (unit + sim)
14. Battle mode: you plus 1 to 3 CPU robots, or 2 humans on one keyboard plus CPUs. Last robot standing wins the round. First to 2 round wins takes the match. With 70 s left, sudden death starts: blocks drop in a spiral from the edge. If time runs out, or the last robots go out together, the robot with the most points (KOs, crates, power-ups) wins. Fewer than 25% of rounds may end in a draw. (unit + sim)
15. Every round has a time limit (story 300 s, battle 120 s). Boss levels and level 11 rarely time out (15% or less for a careful bot on every difficulty). Beating a boss clears its helpers, so no game can get stuck. (sim)
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
24. Story progress saves after every level (save format has a version number; old or broken saves are ignored safely). Continue appears on home after a reload. Saves are strictly checked: wrong types, missing fields, unknown difficulty or a non-whole level reject the story save; out-of-range numbers are clamped. (unit + browser)
25. No console errors or warnings during the click-through. (browser)
26. A single-file test copy is built at /workspace/blast-maze-test.html and runs with no server. (browser)

### Added in v2 (from QA v1)
27. Touch: you can hold and drag the stick with one finger while tapping the bomb button with another. (browser, real multi-touch)
28. Pause, Home, then Esc or P stays on home. Restart from Pause costs a life. After Game Over, Continue gives full lives. (browser)
29. The phone back button or gesture pauses the game instead of leaving. Window blur pauses. An app update waits until you are out of a level. (browser)
30. Each attempt at a level gets a fresh seeded crate layout. Enemies always start with room to move. On phones the board is drawn with bigger tiles and the view follows your robot. A 5-digit score fits the HUD. Running out of time says "Time's up". (unit + browser)

### Added in v3 (from QA v2)
31. Win screens use correct grammar: "You win the round!" for you, "Blue wins the round!" for others. (browser)
32. A points win shows a short kid-friendly reason and a table of knockouts (100), crates (10) and power-ups (20) for every robot. (browser, screenshot 5-points-win.jpg)
33. Easy CPUs are clearly weaker than Hard: they see bomb danger later, react slower, hold only 1 bomb, hunt less and aim worse. The test bot wins much more often on Easy, and Easy CPUs drop fewer bombs. (tests/difficulty.js)
34. After you are knocked out in a phone battle, the view zooms out to show the whole board. (browser)
35. Busy scenes (4 robots, 8 bombs each, range 8, and sudden death) run with p99 frame time under 25 ms at DPR 3. Particles are pooled and capped at 360. Dropped blocks are painted into the cached layer instead of rebuilding it. (tests/perf.js)
36. The test bot blasts crates to reach a portal that is walled in. (unit)

### Added in v4 (graphics upgrade, rules unchanged)
37. Modern 2D look with the same game rules, levels and save format: original rounded robots with outlines, shading, blinking eyes and idle/walk/squash animation; 4 level themes (meadow, desert, ice, volcano) with varied floor tiles, ambient occlusion and beveled walls; wooden crates with metal corners and flying debris; pulsing bombs with a burning fuse; glowing additive blasts; glossy bobbing power-ups with a shine; a polished boss with an HP pip bar; nicer HUD, buttons and banners. Static layers and sprites are pre-rendered per tile size and DPR. "Screen shake: On/Off" on How to Play (also off when the device asks for reduced motion) is saved in settings.calm. (browser, perf, screenshots 1-6)
