# Blast Maze

Original family-friendly maze blasting game. All art drawn in code (canvas at devicePixelRatio), all sound synthesized with WebAudio.

- Spec and numbered acceptance checklist: docs/SPEC.md
- Build: `node build.js` (writes site/). Test copy: `npm run testcopy` (writes /workspace/blast-maze-test.html)
- Tests: `npm test` (unit, headless simulation, Playwright at 390x844 and 844x390 plus desktop keyboard, and the single-file copy)
- Screenshots: `npm run shots` (shots/*.jpg)
- v2 fixes every item in QA report /workspace/qa/blast-maze-v1/REPORT.md (BLK-1, MAJ-1 to 4, MIN-1 to 7, POL-1 to 5).
- Not on GitHub. Nothing is pushed until Tom approves.
