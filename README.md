# MindForge Puzzle Triathlon

A timed puzzle game across three lanes: **Maths**, **Analytical** and **Logic**. Every puzzle is generated fresh from a seed and checked by a solver before you see it. Every attempt is logged in full, and you move up a level only after clearing all three lanes at your current level.

The whole game is a single self-contained HTML page. No server and no runtime dependencies; the build is one Node script.

## Play

- Open `dist/index.html` in any modern browser, or deploy the repo to Vercel (settings are in `vercel.json`: build `node build.js`, output `dist`). Attempts are saved in each player's browser storage.
- When published as a Claude artifact (`dist/puzzle-triathlon.html`), attempts are saved to a private per-user database instead, and CSV export goes through Claude's download prompt.

## Puzzles

| Lane | Puzzle | How difficulty scales (Level 1 → 10) |
|---|---|---|
| Maths | Sudoku | 4×4 → 9×9; graded by the hardest technique needed (singles → locked candidates → pairs → triples → X-wing → chains) |
| Maths | KenKen | 3×3 with + only → 9×9 with all four operations; unique solution checked by a solver |
| Maths | Cross Math | 3×3 (numbers 1–9) → 4×4 (1–16); fewer given numbers and more operators; usual order of operations; unique solution |
| Maths | Math Maze | 3×3 → 6×6 path grid; fewer routes hit the target |
| Maths | Number Sequence | Next term from 5 shown (add a fixed step) → next two terms from 6 shown (tribonacci, multiplying gaps, alternating operations); every puzzle is checked so no other simple rule gives a different answer |
| Analytical | Sliding Tiles | 3×3 by exact shortest solution (6 → 31 moves), then 4×4 by total distance from home |
| Analytical | Lights Out | 3×3 → 7×7; fewest-presses solution computed over GF(2) |
| Analytical | Colour Sort | 3 → 11 colours, tube height 4 → 5; every deal checked solvable |
| Analytical | Number Path | 4×4 with half the numbers fixed → 7×7 with about 1 in 6 fixed; draw one path 1 → N through every cell; unique solution checked by a solver |
| Logic | Nonogram | 5×5 → 15×15; always solvable line by line, graded by solver passes |
| Logic | Binary Grid (Takuzu) | 4×4 → 14×14; graded by the hardest deduction needed |
| Logic | Code Breaker (Mastermind) | 4 colours / 3 pegs → 9 colours / 5 pegs with repeats; fewer guesses allowed |
| Logic | Pattern Matrix | 3×3 shape grids with one panel missing: 1 changing feature, 6 options → all 5 features (shape, count, size, fill, colour), 8 options; 3–5 grids per attempt with limited wrong picks |
| Logic | Safe Cracker | Deduce a 3-digit → 5-digit lock code from guess-and-feedback clues; fewer "nothing is correct" clues and less informative clues at higher levels; exactly one code fits; 3 tries |

## Levels

- 10 levels. Level N+1 unlocks after **2 solves in each lane** at Level N, and at least one of each lane's solves must use no hints.
- A solve with more than one hint is logged but does not count toward the next level.
- Time never blocks a level. It sets 1–3 stars against a par time (your own median once you have 3 solves of that puzzle and level).
- Lower levels stay open for practice; practice solves don't move the lanes.

## Attempt log

Each attempt is one record with: attempt id, lane, puzzle, level, seed, generator version, generator settings, the full puzzle as dealt, difficulty score, start and end times, active time (pauses and hidden-tab time excluded), wall time, pause count and paused time, outcome (`solved`, `failed`, `abandoned`), moves, shortest possible moves where known, mistakes, hints, undos, checks, restarts, stars, score, par time, whether it counts toward the next level, the final board state, and a timestamped event log. The Attempt log screen exports all of it as CSV, and the Stats screen summarises solve rate, median times, hint use and abandon rate by lane, level and puzzle.

## Project layout

```
src/engines.js   seeded generators and solvers for all 14 puzzle types (runs in the page, a Web Worker, and Node)
src/app.js       UI, timer, puzzle boards, attempt log, stats, storage, level gate
src/style.css    styles, light and dark themes
src/body.html    page markup
build.js         combines src/ into dist/ (Node, no dependencies)
vercel.json      static deployment settings for Vercel
dist/            built pages (committed so the game can be opened without building)
tests/           generator test (Node) and browser test (Playwright)
```

## Build and test

```bash
node build.js                     # writes dist/index.html and dist/puzzle-triathlon.html
node tests/generators.test.js     # every type at every level: valid, solvable, unique where required
npm i -D playwright && npx playwright install chromium
npm run test:e2e                  # plays every type at Levels 1 and 10 in headless Chromium
```

`node tests/generators.test.js sudoku,crossmath 20` limits the run to some types and sets seeds per level.

## Known limitations

- The difficulty ladder is a reasoned starting point, not yet calibrated against real play. Use the Stats screen to see where a level is too easy or too hard.
- Sudoku Levels 8 and 9 aim for triples and X-wing but sometimes land one technique easier; they are never harder than labelled.
- 4×4 Sliding Tiles difficulty is an estimate (total distance from home), not the exact shortest solution.
- Browser local storage can be cleared by the browser; export to CSV to keep a copy.
