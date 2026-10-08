/* Generates puzzles for every type and level and checks each one is valid and solvable.
   Usage: node tests/generators.test.js [type,type,...] [seeds per level] */
const PT = require('../src/engines.js');
const types = process.argv[2] ? process.argv[2].split(',') : Object.keys(PT.TYPES);
const SEEDS = +(process.argv[3] || 5);
function check(o) {
  const p = o.puzzle;
  switch (o.type) {
    case 'sudoku': { const g = PT.sudGeom(p.N); if (PT.sudCount(g, p.givens, 2) !== 1) return 'not unique'; const l = PT.sudLogic(g, p.givens, 5); if (o.difficulty < 6 && !l.solved) return 'logic fail'; for (let i = 0; i < p.givens.length; i++) if (p.givens[i] && p.givens[i] !== p.solution[i]) return 'given mismatch'; return ''; }
    case 'kenken': { const seen = new Set(); p.cages.forEach(c => c.cells.forEach(x => seen.add(x))); if (seen.size !== p.n * p.n) return 'cover'; const r = PT.kkSolve(p.n, p.cages, p.solution, 3e6); if (r.limit) return 'limit'; if (r.found) return 'not unique'; return ''; }
    case 'mathmaze': { let t = p.cells[0].v; for (const i of p.solution.slice(1)) { t = PT.mmApply(t, p.cells[i]); if (t === null) return 'null'; } if (t !== p.target) return 'target mismatch'; if (p.solution[p.solution.length - 1] !== p.R * p.C - 1) return 'end'; return ''; }
    case 'sliding': { if (p.n === 3 && PT.slide3Dist(p.tiles) !== o.optimal) return 'dist'; return ''; }
    case 'lights': { const s = PT.lightsSolve(p.n, p.lit); if (!s) return 'unsolvable'; return ''; }
    case 'ballsort': { const s = PT.bsSolve(p.tubes, p.h, 200000); if (!s) return 'unsolved'; return ''; }
    case 'nonogram': { const r = PT.ngSolve(p.R, p.C, p.rowClues, p.colClues); if (!r.solved) return 'not line solvable'; for (let i = 0; i < p.solution.length; i++) if (r.grid[i] !== p.solution[i]) return 'mismatch'; return ''; }
    case 'takuzu': { if (PT.tkConflicts(p.n, p.solution).length) return 'bad solution'; const r = PT.tkLogic(p.n, p.givens, 3); if (!r.solved) return 'unsolved'; for (let i = 0; i < p.solution.length; i++) if (r.grid[i] !== p.solution[i]) return 'mismatch'; return ''; }
    case 'crossmath': { const N = p.n * p.n; const seen = new Set(p.solution); if (seen.size !== N) return 'not a permutation'; for (let k = 0; k < p.n; k++) { const rn = [], cn = []; for (let j = 0; j < p.n; j++) { rn.push(p.solution[k * p.n + j]); cn.push(p.solution[j * p.n + k]); } if (PT.cmEval(rn, p.rowOps[k]) !== p.rowRes[k]) return 'row ' + k; if (PT.cmEval(cn, p.colOps[k]) !== p.colRes[k]) return 'col ' + k; } const r = PT.cmCount(p, p.givens, 2, 5e7); if (r.over) return 'cap'; if (r.count !== 1) return 'not unique (' + r.count + ')'; for (let i = 0; i < N; i++) if (p.givens[i] && p.givens[i] !== p.solution[i]) return 'given mismatch'; return o.params.givens === o.params.target_givens ? '' : 'givens ' + o.params.givens + ' vs target ' + o.params.target_givens; }
    case 'mastermind': return p.code.length === p.pegs ? '' : 'len';
  }
}
let failed = false;
for (const type of types) {
  console.log('== ' + type);
  for (let level = 1; level <= 10; level++) {
    const times = [], diffs = [], errs = [], sizes = [];
    for (let s = 0; s < SEEDS; s++) {
      const t0 = Date.now();
      let o; try { o = PT.generate(type, level, type + ':' + level + ':' + s); } catch (e) { errs.push('THROW ' + e.message); continue; }
      times.push(Date.now() - t0); diffs.push(o.difficulty); sizes.push(JSON.stringify(o.puzzle).length);
      const e = check(o); if (e) errs.push(e);
    }
    if (errs.length) failed = true;
    console.log(`L${level} ms[max ${Math.max(...times)} avg ${Math.round(times.reduce((a, b) => a + b, 0) / times.length)}] diff[${diffs.join(',')}] bytes ${Math.max(...sizes)} ${errs.length ? 'ERR ' + errs.join(';') : 'ok'}`);
  }
}
process.exit(failed ? 1 : 0);
