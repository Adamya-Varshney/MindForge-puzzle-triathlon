/* Puzzle Triathlon engines: seeded generators and solvers for fourteen puzzle types.
   Runs in the page, in a Web Worker, and in Node (for tests). */
(function (root) {
'use strict';
var GEN_VERSION = '1.0.0';

/* ================= seeded RNG ================= */
function cyrb128(str) {
  var h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (var i = 0, k; i < str.length; i++) {
    k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= (h2 ^ h3 ^ h4); h2 ^= h1; h3 ^= h1; h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}
function sfc32(a, b, c, d) {
  return function () {
    a |= 0; b |= 0; c |= 0; d |= 0;
    var t = (a + b | 0) + d | 0;
    d = d + 1 | 0;
    a = b ^ b >>> 9;
    b = c + (c << 3) | 0;
    c = (c << 21 | c >>> 11);
    c = c + t | 0;
    return (t >>> 0) / 4294967296;
  };
}
function makeRng(seed) {
  var h = cyrb128(String(seed));
  var r = sfc32(h[0], h[1], h[2], h[3]);
  for (var i = 0; i < 15; i++) r();
  return r;
}
function ri(rng, n) { return Math.floor(rng() * n); }
function shuffle(rng, a) {
  for (var i = a.length - 1; i > 0; i--) { var j = ri(rng, i + 1); var t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}
function range(n) { var a = new Array(n); for (var i = 0; i < n; i++) a[i] = i; return a; }
function pick(rng, a) { return a[ri(rng, a.length)]; }
function wpick(rng, items, weights) {
  var s = 0, i; for (i = 0; i < weights.length; i++) s += weights[i];
  var x = rng() * s;
  for (i = 0; i < items.length; i++) { x -= weights[i]; if (x < 0) return items[i]; }
  return items[items.length - 1];
}
function pop(m) { var c = 0; while (m) { m &= m - 1; c++; } return c; }

/* ================= SUDOKU ================= */
var SG = {};
function sudGeom(N) {
  if (SG[N]) return SG[N];
  var br = N === 9 ? 3 : 2, bc = N === 4 ? 2 : 3;
  var perRow = N / bc, units = [], boxOf = new Int8Array(N * N), r, c, i;
  for (r = 0; r < N; r++) { var row = []; for (c = 0; c < N; c++) row.push(r * N + c); units.push(row); }
  for (c = 0; c < N; c++) { var col = []; for (r = 0; r < N; r++) col.push(r * N + c); units.push(col); }
  for (i = 0; i < N; i++) units.push([]);
  for (r = 0; r < N; r++) for (c = 0; c < N; c++) {
    var b = Math.floor(r / br) * perRow + Math.floor(c / bc);
    boxOf[r * N + c] = b; units[2 * N + b].push(r * N + c);
  }
  var peers = [];
  for (i = 0; i < N * N; i++) {
    var set = {}; r = Math.floor(i / N); c = i % N;
    [units[r], units[N + c], units[2 * N + boxOf[i]]].forEach(function (u) { u.forEach(function (j) { if (j !== i) set[j] = 1; }); });
    peers.push(Object.keys(set).map(Number));
  }
  return (SG[N] = { N: N, br: br, bc: bc, units: units, peers: peers, boxOf: boxOf });
}
function sudCands(g, val, i) {
  var m = (1 << g.N) - 1, p = g.peers[i];
  for (var k = 0; k < p.length; k++) if (val[p[k]]) m &= ~(1 << (val[p[k]] - 1));
  return m;
}
function sudFill(g, rng) {
  var N = g.N, NN = N * N, val = new Int8Array(NN);
  function rec() {
    var best = -1, bm = 0, bcnt = 99;
    for (var i = 0; i < NN; i++) if (!val[i]) {
      var m = sudCands(g, val, i), c = pop(m);
      if (c === 0) return false;
      if (c < bcnt) { bcnt = c; best = i; bm = m; if (c === 1) break; }
    }
    if (best < 0) return true;
    var ds = []; for (var d = 0; d < N; d++) if (bm >> d & 1) ds.push(d + 1);
    shuffle(rng, ds);
    for (var k = 0; k < ds.length; k++) { val[best] = ds[k]; if (rec()) return true; }
    val[best] = 0; return false;
  }
  rec(); return val;
}
function sudCount(g, givens, limit) {
  var N = g.N, NN = N * N, val = Int8Array.from(givens), count = 0;
  function rec() {
    var best = -1, bm = 0, bcnt = 99;
    for (var i = 0; i < NN; i++) if (!val[i]) {
      var m = sudCands(g, val, i), c = pop(m);
      if (c === 0) return;
      if (c < bcnt) { bcnt = c; best = i; bm = m; if (c === 1) break; }
    }
    if (best < 0) { count++; return; }
    for (var d = 0; d < N; d++) if (bm >> d & 1) { val[best] = d + 1; rec(); if (count >= limit) break; }
    val[best] = 0;
  }
  rec(); return count;
}
/* Human-style solver. Tiers: 1 singles, 2 locked candidates, 3 pairs, 4 triples, 5 X-wing. */
function sudLogic(g, givens, maxTier) {
  var N = g.N, NN = N * N, units = g.units, peers = g.peers, boxOf = g.boxOf, all = (1 << N) - 1;
  var val = Int8Array.from(givens), cand = new Int32Array(NN), left = 0, used = 0, adv = 0, i;
  for (i = 0; i < NN; i++) if (!val[i]) { cand[i] = sudCands(g, val, i); left++; }
  function place(c, d) {
    val[c] = d; cand[c] = 0; left--;
    var b = ~(1 << (d - 1)), p = peers[c];
    for (var k = 0; k < p.length; k++) cand[p[k]] &= b;
  }
  function rowOf(c) { return (c / N) | 0; }
  function colOf(c) { return c % N; }
  for (;;) {
    if (left === 0) break;
    var prog = false, ui, u, d, b, k, a, m;
    for (i = 0; i < NN; i++) if (!val[i]) {
      m = cand[i];
      if (m === 0) return { solved: false, used: used, bad: true, val: val };
      if ((m & (m - 1)) === 0) { place(i, 32 - Math.clz32(m)); prog = true; }
    }
    if (prog) { if (used < 1) used = 1; continue; }
    for (ui = 0; ui < units.length; ui++) {
      u = units[ui];
      for (d = 0; d < N; d++) {
        b = 1 << d; var cnt = 0, at = -1;
        for (k = 0; k < N; k++) { i = u[k]; if (val[i] === d + 1) { cnt = -1; break; } if (!val[i] && (cand[i] & b)) { cnt++; at = i; } }
        if (cnt === 1) { place(at, d + 1); prog = true; }
      }
    }
    if (prog) { if (used < 1) used = 1; continue; }
    if (maxTier < 2) break;
    /* locked candidates */
    for (ui = 0; ui < units.length; ui++) {
      u = units[ui];
      for (d = 0; d < N; d++) {
        b = 1 << d; var cs = [];
        for (k = 0; k < N; k++) { i = u[k]; if (!val[i] && (cand[i] & b)) cs.push(i); }
        if (cs.length < 2) continue;
        var j, tgt;
        if (ui >= 2 * N) {
          var r0 = rowOf(cs[0]), c0 = colOf(cs[0]), sameR = true, sameC = true;
          for (k = 1; k < cs.length; k++) { if (rowOf(cs[k]) !== r0) sameR = false; if (colOf(cs[k]) !== c0) sameC = false; }
          if (sameR) { tgt = units[r0]; for (k = 0; k < N; k++) { j = tgt[k]; if (!val[j] && boxOf[j] !== boxOf[cs[0]] && (cand[j] & b)) { cand[j] &= ~b; prog = true; } } }
          if (sameC) { tgt = units[N + c0]; for (k = 0; k < N; k++) { j = tgt[k]; if (!val[j] && boxOf[j] !== boxOf[cs[0]] && (cand[j] & b)) { cand[j] &= ~b; prog = true; } } }
        } else {
          var b0 = boxOf[cs[0]], sameB = true;
          for (k = 1; k < cs.length; k++) if (boxOf[cs[k]] !== b0) sameB = false;
          if (sameB) {
            tgt = units[2 * N + b0];
            for (k = 0; k < N; k++) {
              j = tgt[k];
              var inU = ui < N ? rowOf(j) === ui : colOf(j) === ui - N;
              if (!val[j] && !inU && (cand[j] & b)) { cand[j] &= ~b; prog = true; }
            }
          }
        }
      }
    }
    if (prog) { if (used < 2) used = 2; adv++; continue; }
    if (maxTier < 3) break;
    /* naked + hidden pairs */
    for (ui = 0; ui < units.length; ui++) {
      u = units[ui];
      var em = []; for (k = 0; k < N; k++) if (!val[u[k]]) em.push(u[k]);
      for (a = 0; a < em.length; a++) for (b = a + 1; b < em.length; b++) {
        m = cand[em[a]];
        if (m === cand[em[b]] && pop(m) === 2) {
          for (k = 0; k < em.length; k++) if (k !== a && k !== b && (cand[em[k]] & m)) { cand[em[k]] &= ~m; prog = true; }
        }
      }
      var posm = [];
      for (d = 0; d < N; d++) { m = 0; for (k = 0; k < N; k++) if (!val[u[k]] && (cand[u[k]] >> d & 1)) m |= 1 << k; posm.push(m); }
      for (a = 0; a < N; a++) for (b = a + 1; b < N; b++) {
        if (posm[a] && posm[a] === posm[b] && pop(posm[a]) === 2) {
          var keep = (1 << a) | (1 << b);
          for (k = 0; k < N; k++) if (posm[a] >> k & 1) { if (cand[u[k]] & ~keep) { cand[u[k]] &= keep; prog = true; } }
        }
      }
    }
    if (prog) { if (used < 3) used = 3; adv++; continue; }
    if (maxTier < 4) break;
    /* naked + hidden triples */
    for (ui = 0; ui < units.length; ui++) {
      u = units[ui];
      var e2 = []; for (k = 0; k < N; k++) if (!val[u[k]]) e2.push(u[k]);
      var x, y, z;
      if (e2.length > 3) {
        for (x = 0; x < e2.length; x++) for (y = x + 1; y < e2.length; y++) for (z = y + 1; z < e2.length; z++) {
          m = cand[e2[x]] | cand[e2[y]] | cand[e2[z]];
          if (pop(m) === 3) {
            for (k = 0; k < e2.length; k++) if (k !== x && k !== y && k !== z && (cand[e2[k]] & m)) { cand[e2[k]] &= ~m; prog = true; }
          }
        }
        var pm = [];
        for (d = 0; d < N; d++) { m = 0; for (k = 0; k < N; k++) if (!val[u[k]] && (cand[u[k]] >> d & 1)) m |= 1 << k; pm.push(m); }
        for (x = 0; x < N; x++) if (pm[x]) for (y = x + 1; y < N; y++) if (pm[y]) for (z = y + 1; z < N; z++) if (pm[z]) {
          m = pm[x] | pm[y] | pm[z];
          if (pop(m) === 3) {
            var kp = (1 << x) | (1 << y) | (1 << z);
            for (k = 0; k < N; k++) if (m >> k & 1) { if (cand[u[k]] & ~kp) { cand[u[k]] &= kp; prog = true; } }
          }
        }
      }
    }
    if (prog) { if (used < 4) used = 4; adv++; continue; }
    if (maxTier < 5) break;
    /* X-wing */
    for (d = 0; d < N; d++) {
      b = 1 << d;
      for (var orient = 0; orient < 2; orient++) {
        var masks = [], l, l2, l3;
        for (l = 0; l < N; l++) {
          m = 0;
          for (k = 0; k < N; k++) { i = orient ? k * N + l : l * N + k; if (!val[i] && (cand[i] & b)) m |= 1 << k; }
          masks.push(m);
        }
        for (l = 0; l < N; l++) if (pop(masks[l]) === 2) for (l2 = l + 1; l2 < N; l2++) if (masks[l2] === masks[l]) {
          for (l3 = 0; l3 < N; l3++) if (l3 !== l && l3 !== l2) for (k = 0; k < N; k++) if (masks[l] >> k & 1) {
            i = orient ? k * N + l3 : l3 * N + k;
            if (!val[i] && (cand[i] & b)) { cand[i] &= ~b; prog = true; }
          }
        }
      }
    }
    if (prog) { if (used < 5) used = 5; adv++; continue; }
    break;
  }
  return { solved: left === 0, used: used, adv: adv, val: val };
}
/* Next single for a hint: returns {cell, digit, why} or null. */
function sudHint(N, grid) {
  var g = sudGeom(N), NN = N * N, i, d, k;
  for (i = 0; i < NN; i++) if (!grid[i]) {
    var m = sudCands(g, grid, i);
    if (m && (m & (m - 1)) === 0) return { cell: i, digit: 32 - Math.clz32(m), why: 'it is the only digit that fits this cell' };
  }
  var names = ['row', 'column', 'box'];
  for (var ui = 0; ui < g.units.length; ui++) {
    var u = g.units[ui];
    for (d = 0; d < N; d++) {
      var cnt = 0, at = -1;
      for (k = 0; k < N; k++) { i = u[k]; if (grid[i] === d + 1) { cnt = -1; break; } if (!grid[i] && (sudCands(g, grid, i) >> d & 1)) { cnt++; at = i; } }
      if (cnt === 1) return { cell: at, digit: d + 1, why: 'it is the only place for ' + (d + 1) + ' in this ' + names[Math.floor(ui / N)] };
    }
  }
  return null;
}
var SUD_LEVELS = [
  { N: 4, tier: 1, givens: 8, tries: 1, need: 0 },
  { N: 6, tier: 1, givens: 16, tries: 1, need: 0 },
  { N: 9, tier: 1, givens: 40, tries: 1, need: 0 },
  { N: 9, tier: 1, givens: 34, tries: 1, need: 0 },
  { N: 9, tier: 1, givens: 0, tries: 1, need: 0 },
  { N: 9, tier: 2, givens: 0, tries: 24, need: 20 },
  { N: 9, tier: 3, givens: 0, tries: 45, need: 30 },
  { N: 9, tier: 4, givens: 0, tries: 90, need: 33 },
  { N: 9, tier: 5, givens: 0, tries: 130, need: 40 },
  { N: 9, tier: 6, givens: 0, tries: 25, need: 60 }
];
var SUD_TIER_NAMES = ['', 'singles', 'locked candidates', 'pairs', 'triples', 'X-wing', 'chains or trial'];
function genSudoku(level, rng) {
  var P = SUD_LEVELS[level - 1], g = sudGeom(P.N), NN = P.N * P.N, best = null;
  for (var t = 0; t < P.tries; t++) {
    var sol = sudFill(g, rng), puz = Int8Array.from(sol), order = shuffle(rng, range(NN)), givens = NN;
    for (var k = 0; k < NN; k++) {
      if (givens <= P.givens) break;
      var i = order[k], keep = puz[i]; puz[i] = 0;
      var ok = P.tier >= 6 ? sudCount(g, puz, 2) === 1 : sudLogic(g, puz, P.tier).solved;
      if (ok) givens--; else puz[i] = keep;
    }
    var gr = sudLogic(g, puz, 5), tier = gr.solved ? gr.used : 6;
    var score = tier * 10 + (gr.solved ? Math.min(gr.adv, 9) : 0);
    var cand = { puz: puz, sol: sol, tier: tier, givens: givens, score: score };
    if (score >= P.need) { best = cand; break; }
    if (!best || score > best.score) best = cand;
  }
  return {
    params: { size: P.N, target_technique: SUD_TIER_NAMES[P.tier], givens: best.givens },
    puzzle: { N: P.N, br: g.br, bc: g.bc, givens: Array.from(best.puz), solution: Array.from(best.sol) },
    difficulty: best.score, difficulty_label: 'hardest technique: ' + SUD_TIER_NAMES[best.tier], optimal: null
  };
}

/* ================= KENKEN ================= */
function latin(n, rng) {
  var rows = shuffle(rng, range(n)), cols = shuffle(rng, range(n)), sym = shuffle(rng, range(n)), g = new Array(n * n);
  for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) g[r * n + c] = sym[(rows[r] + cols[c]) % n] + 1;
  return g;
}
function nbrs(n, i) {
  var r = (i / n) | 0, c = i % n, out = [];
  if (r > 0) out.push(i - n); if (r < n - 1) out.push(i + n); if (c > 0) out.push(i - 1); if (c < n - 1) out.push(i + 1);
  return out;
}
function kkLabel(cells, sol, ops, n, rng) {
  var vals = cells.map(function (c) { return sol[c]; });
  if (cells.length === 1) return { cells: cells, op: '=', target: vals[0] };
  var sum = 0, prod = 1; vals.forEach(function (v) { sum += v; prod *= v; });
  var opts = [], w = [];
  if (cells.length === 2) {
    var hi = Math.max(vals[0], vals[1]), lo = Math.min(vals[0], vals[1]);
    opts.push('+'); w.push(2);
    if (ops.indexOf('-') >= 0) { opts.push('-'); w.push(2.5); }
    if (ops.indexOf('x') >= 0) { opts.push('x'); w.push(2); }
    if (ops.indexOf('/') >= 0 && hi % lo === 0) { opts.push('/'); w.push(5); }
    var op = wpick(rng, opts, w);
    return { cells: cells, op: op, target: op === '+' ? sum : op === '-' ? hi - lo : op === 'x' ? prod : hi / lo };
  }
  opts.push('+'); w.push(3);
  if (ops.indexOf('x') >= 0) { opts.push('x'); w.push(2); }
  var o = wpick(rng, opts, w);
  return { cells: cells, op: o, target: o === '+' ? sum : prod };
}
function kkCages(n, sol, P, rng) {
  var cageOf = new Int16Array(n * n).fill(-1), cages = [], sizes = [], weights = [], s;
  var W = { 2: [[1, 2], [1, 9]], 3: [[1, 2, 3], [0.7, 5, 4.3]], 4: [[1, 2, 3, 4], [0.4, 3.4, 4, 2.2]] }[P.maxCage];
  sizes = W[0]; weights = W[1];
  var order = shuffle(rng, range(n * n));
  for (var k = 0; k < order.length; k++) {
    s = order[k]; if (cageOf[s] >= 0) continue;
    var size = wpick(rng, sizes, weights), cells = [s]; cageOf[s] = cages.length;
    while (cells.length < size) {
      var nb = [];
      cells.forEach(function (c) { nbrs(n, c).forEach(function (x) { if (cageOf[x] < 0) nb.push(x); }); });
      if (!nb.length) break;
      var x = pick(rng, nb); cageOf[x] = cages.length; cells.push(x);
    }
    cages.push(cells);
  }
  return cages.map(function (cells) { return kkLabel(cells, sol, P.ops, n, rng); });
}
/* Looks for a solution that differs from `intended`. Returns {found, limit, nodes}. */
function kkSolve(n, cages, intended, nodeLimit) {
  var sorted = cages.slice().sort(function (a, b) { return a.cells.length - b.cells.length; });
  var cells = [], cg = [], posIn = [];
  sorted.forEach(function (c) {
    var o = { op: c.op, target: c.target, len: c.cells.length, acc: c.op === 'x' ? 1 : 0 };
    c.cells.forEach(function (cell, k) { cells.push(cell); cg.push(o); posIn.push(k); });
  });
  var total = cells.length, rowM = new Int32Array(n), colM = new Int32Array(n), val = new Int8Array(n * n);
  var nodes = 0, found = null, limit = false;
  function rec(k) {
    if (k === total) {
      for (var i = 0; i < total; i++) if (val[i] !== intended[i]) { found = Array.from(val); return true; }
      return false;
    }
    if (++nodes > nodeLimit) { limit = true; return true; }
    var cell = cells[k], c = cg[k], r = (cell / n) | 0, col = cell % n, pos = posIn[k], last = pos === c.len - 1, t = c.target, acc = c.acc;
    for (var d = 1; d <= n; d++) {
      var bit = 1 << d;
      if ((rowM[r] & bit) || (colM[col] & bit)) continue;
      var nacc = acc;
      switch (c.op) {
        case '=': if (d !== t) continue; break;
        case '+': nacc = acc + d; var rem = c.len - 1 - pos; if (nacc + rem > t || nacc + rem * n < t) continue; break;
        case 'x': nacc = acc * d; if (t % nacc !== 0) continue; if (last && nacc !== t) continue; break;
        case '-': if (pos === 0) { nacc = d; if (d + t > n && d - t < 1) continue; } else if (Math.abs(acc - d) !== t) continue; break;
        case '/': if (pos === 0) { nacc = d; if (d * t > n && d % t !== 0) continue; } else { var a = Math.max(acc, d), b = Math.min(acc, d); if (a !== b * t) continue; } break;
      }
      rowM[r] |= bit; colM[col] |= bit; val[cell] = d; c.acc = nacc;
      var stop = rec(k + 1);
      rowM[r] &= ~bit; colM[col] &= ~bit; val[cell] = 0; c.acc = acc;
      if (stop) return true;
    }
    return false;
  }
  rec(0);
  return { found: found, limit: limit, nodes: nodes };
}
function components(n, cells) {
  var set = {}, out = []; cells.forEach(function (c) { set[c] = 1; });
  cells.forEach(function (c) {
    if (!set[c]) return;
    var comp = [], st = [c]; set[c] = 0;
    while (st.length) { var x = st.pop(); comp.push(x); nbrs(n, x).forEach(function (y) { if (set[y]) { set[y] = 0; st.push(y); } }); }
    out.push(comp);
  });
  return out;
}
var KK_LEVELS = [
  { n: 3, ops: '+', maxCage: 2, maxSingles: 3 },
  { n: 4, ops: '+-', maxCage: 2, maxSingles: 4 },
  { n: 4, ops: '+-x', maxCage: 3, maxSingles: 3 },
  { n: 5, ops: '+-x', maxCage: 3, maxSingles: 4 },
  { n: 5, ops: '+-x/', maxCage: 3, maxSingles: 3 },
  { n: 6, ops: '+-x/', maxCage: 3, maxSingles: 4 },
  { n: 6, ops: '+-x/', maxCage: 4, maxSingles: 3 },
  { n: 7, ops: '+-x/', maxCage: 3, maxSingles: 5 },
  { n: 8, ops: '+-x/', maxCage: 4, maxSingles: 6 },
  { n: 9, ops: '+-x/', maxCage: 4, maxSingles: 8 }
];
function genKenken(level, rng) {
  var P = KK_LEVELS[level - 1], n = P.n, best = null;
  for (var attempt = 0; attempt < 200; attempt++) {
    var sol = latin(n, rng), cages = kkCages(n, sol, P, rng), ok = false, nodes = 0;
    for (var fix = 0; fix < 14; fix++) {
      var singles = cages.filter(function (c) { return c.cells.length === 1; }).length;
      if (singles > P.maxSingles + (attempt > 60 ? 2 : 0)) break;
      var res = kkSolve(n, cages, sol, 250000);
      if (res.limit) break;
      if (!res.found) { ok = true; nodes = res.nodes; break; }
      var diff = []; for (var i = 0; i < n * n; i++) if (res.found[i] !== sol[i]) diff.push(i);
      var cell = pick(rng, diff), ci = -1;
      cages.forEach(function (c, k) { if (c.cells.indexOf(cell) >= 0) ci = k; });
      var old = cages[ci]; cages.splice(ci, 1);
      cages.push(kkLabel([cell], sol, P.ops, n, rng));
      components(n, old.cells.filter(function (c) { return c !== cell; })).forEach(function (comp) { cages.push(kkLabel(comp, sol, P.ops, n, rng)); });
    }
    if (ok) { best = { sol: sol, cages: cages, nodes: nodes }; break; }
  }
  if (!best) { /* fallback: every cell given */ var s2 = latin(n, rng); best = { sol: s2, cages: s2.map(function (v, i) { return { cells: [i], op: '=', target: v }; }), nodes: 0 }; }
  best.cages.forEach(function (c) { c.cells.sort(function (a, b) { return a - b; }); });
  return {
    params: { size: n, operators: P.ops, max_cage: P.maxCage, cages: best.cages.length },
    puzzle: { n: n, cages: best.cages, solution: best.sol },
    difficulty: best.nodes, difficulty_label: 'solver search nodes: ' + best.nodes, optimal: null
  };
}

/* ================= MATH MAZE ================= */
var MM_LEVELS = [
  { R: 3, C: 3, ops: '+', maxSol: 3 },
  { R: 3, C: 3, ops: '+-', maxSol: 2 },
  { R: 4, C: 4, ops: '+-', maxSol: 6 },
  { R: 4, C: 4, ops: '+-x', maxSol: 3 },
  { R: 4, C: 4, ops: '+-x/', maxSol: 1 },
  { R: 5, C: 5, ops: '+-', maxSol: 40 },
  { R: 5, C: 5, ops: '+-x', maxSol: 8 },
  { R: 5, C: 5, ops: '+-x/', maxSol: 2 },
  { R: 5, C: 6, ops: '+-x', maxSol: 2 },
  { R: 6, C: 6, ops: '+-x/', maxSol: 1 }
];
function mmApply(total, cell) {
  switch (cell.op) {
    case '+': return total + cell.v;
    case '-': return total - cell.v;
    case 'x': return total * cell.v;
    case '/': return total % cell.v === 0 ? total / cell.v : null;
  }
  return total;
}
function mmEnumerate(R, C, cells, onEnd) {
  var n = R * C, visited = new Uint8Array(n), path = [0], goal = n - 1;
  visited[0] = 1;
  function rec(i, total) {
    if (i === goal) return onEnd(total, path);
    var r = (i / C) | 0, c = i % C, nx;
    for (var k = 0; k < 4; k++) {
      if (k === 0) { if (c >= C - 1) continue; nx = i + 1; }
      else if (k === 1) { if (r >= R - 1) continue; nx = i + C; }
      else if (k === 2) { if (c <= 0) continue; nx = i - 1; }
      else { if (r <= 0) continue; nx = i - C; }
      if (visited[nx]) continue;
      var t = mmApply(total, cells[nx]); if (t === null) continue;
      visited[nx] = 1; path.push(nx);
      var stop = rec(nx, t);
      visited[nx] = 0; path.pop();
      if (stop) return true;
    }
    return false;
  }
  rec(0, cells[0].v);
}
function genMaze(level, rng) {
  var P = MM_LEVELS[level - 1], R = P.R, C = P.C, n = R * C, out = null;
  var opList = P.ops.split(''), opW = opList.map(function (o) { return { '+': 4, '-': 3, 'x': 1.1, '/': 1.1 }[o]; });
  for (var attempt = 0; attempt < 80 && !out; attempt++) {
    var cells = [{ op: 's', v: 1 + ri(rng, 9) }];
    for (var i = 1; i < n; i++) {
      var op = wpick(rng, opList, opW);
      cells.push({ op: op, v: (op === 'x' || op === '/') ? 2 + ri(rng, 2) : 1 + ri(rng, 9) });
    }
    var hist = new Map(), paths = 0, lo = Infinity, hi = -Infinity;
    mmEnumerate(R, C, cells, function (t) { paths++; hist.set(t, (hist.get(t) || 0) + 1); if (t < lo) lo = t; if (t > hi) hi = t; return false; });
    var relax = attempt > 40 ? 3 : 1, cands = [];
    hist.forEach(function (cnt, t) {
      if (cnt > P.maxSol * relax) return;
      if (t < (level <= 4 ? 1 : -60) || t > 199) return;
      if ((t === lo || t === hi) && level > 2) return;
      cands.push(t);
    });
    if (!cands.length) continue;
    cands.sort(function (a, b) { return a - b; });
    var target = pick(rng, cands), solution = null;
    mmEnumerate(R, C, cells, function (t, path) { if (t === target) { solution = path.slice(); return true; } return false; });
    out = { cells: cells, target: target, solution: solution, paths: paths, sols: hist.get(target) };
  }
  if (!out) {
    /* fallback: target of the straight edge path */
    var cs = [{ op: 's', v: 3 }]; for (var j = 1; j < n; j++) cs.push({ op: '+', v: 1 + ri(rng, 9) });
    var sp = [0], q; for (q = 1; q < C; q++) sp.push(q); for (q = 1; q < R; q++) sp.push(q * C + C - 1);
    var tt = cs[0].v; sp.slice(1).forEach(function (x) { tt += cs[x].v; });
    out = { cells: cs, target: tt, solution: sp, paths: 0, sols: 1 };
  }
  return {
    params: { rows: R, cols: C, operators: P.ops, total_paths: out.paths, solution_paths: out.sols },
    puzzle: { R: R, C: C, cells: out.cells, target: out.target, solution: out.solution },
    difficulty: out.paths ? Math.round(out.paths / out.sols) : 1,
    difficulty_label: out.sols + ' of ' + out.paths + ' routes reach the target', optimal: out.solution.length - 1
  };
}

/* ================= SLIDING TILES ================= */
var S3 = null;
var FACT = [1, 1, 2, 6, 24, 120, 720, 5040, 40320];
function permRank(p) {
  var r = 0;
  for (var i = 0; i < 9; i++) { var c = 0; for (var j = i + 1; j < 9; j++) if (p[j] < p[i]) c++; r += c * FACT[8 - i]; }
  return r;
}
function permUnrank(r) {
  var items = [0, 1, 2, 3, 4, 5, 6, 7, 8], p = [];
  for (var i = 0; i < 9; i++) { var f = FACT[8 - i], k = Math.floor(r / f); r %= f; p.push(items[k]); items.splice(k, 1); }
  return p;
}
function slide3() {
  if (S3) return S3;
  var dist = new Int8Array(362880).fill(-1), queue = new Int32Array(181440), head = 0, tail = 0;
  var goal = [1, 2, 3, 4, 5, 6, 7, 8, 0], gr = permRank(goal), starts = [0];
  dist[gr] = 0; queue[tail++] = gr;
  while (head < tail) {
    var r = queue[head++], p = permUnrank(r), d = dist[r], z = p.indexOf(0), zr = (z / 3) | 0, zc = z % 3;
    if (starts.length <= d) starts[d] = head - 1;
    var moves = []; if (zr > 0) moves.push(z - 3); if (zr < 2) moves.push(z + 3); if (zc > 0) moves.push(z - 1); if (zc < 2) moves.push(z + 1);
    for (var k = 0; k < moves.length; k++) {
      var m = moves[k]; p[z] = p[m]; p[m] = 0;
      var nr = permRank(p);
      if (dist[nr] < 0) { dist[nr] = d + 1; queue[tail++] = nr; }
      p[m] = p[z]; p[z] = 0;
    }
  }
  starts.push(tail);
  return (S3 = { dist: dist, queue: queue, starts: starts });
}
function slide3Dist(tiles) { return slide3().dist[permRank(tiles)]; }
function manhattan(n, tiles) {
  var s = 0;
  for (var i = 0; i < tiles.length; i++) { var t = tiles[i]; if (!t) continue; var g = t - 1; s += Math.abs(((i / n) | 0) - ((g / n) | 0)) + Math.abs(i % n - g % n); }
  return s;
}
var SL_LEVELS = [
  { n: 3, lo: 6, hi: 8 }, { n: 3, lo: 10, hi: 12 }, { n: 3, lo: 14, hi: 16 }, { n: 3, lo: 18, hi: 20 },
  { n: 3, lo: 22, hi: 25 }, { n: 3, lo: 26, hi: 31 },
  { n: 4, lo: 14, hi: 20 }, { n: 4, lo: 21, hi: 28 }, { n: 4, lo: 29, hi: 36 }, { n: 4, lo: 37, hi: 48 }
];
function genSliding(level, rng) {
  var P = SL_LEVELS[level - 1];
  if (P.n === 3) {
    var T = slide3(), a = T.starts[P.lo], b = T.starts[Math.min(P.hi + 1, T.starts.length - 1)];
    var r = T.queue[a + ri(rng, b - a)], tiles = permUnrank(r);
    return { params: { size: 3, optimal_range: [P.lo, P.hi] }, puzzle: { n: 3, tiles: tiles }, difficulty: T.dist[r], difficulty_label: 'shortest solution: ' + T.dist[r] + ' moves', optimal: T.dist[r] };
  }
  var best = null, bestGap = 1e9;
  for (var t = 0; t < 4000; t++) {
    var g = range(16).map(function (i) { return (i + 1) % 16; }), z = 15, prev = -1, len = 20 + ri(rng, 300);
    for (var s = 0; s < len; s++) {
      var zr = (z / 4) | 0, zc = z % 4, mv = [];
      if (zr > 0) mv.push(z - 4); if (zr < 3) mv.push(z + 4); if (zc > 0) mv.push(z - 1); if (zc < 3) mv.push(z + 1);
      var m = pick(rng, mv); if (m === prev && mv.length > 1) { s--; continue; }
      g[z] = g[m]; g[m] = 0; prev = z; z = m;
    }
    var md = manhattan(4, g), gap = md < P.lo ? P.lo - md : md > P.hi ? md - P.hi : 0;
    if (gap < bestGap) { bestGap = gap; best = { tiles: g, md: md }; if (!gap) break; }
  }
  return { params: { size: 4, manhattan_range: [P.lo, P.hi] }, puzzle: { n: 4, tiles: best.tiles }, difficulty: best.md, difficulty_label: 'tiles are ' + best.md + ' steps from home in total', optimal: null };
}

/* ================= LIGHTS OUT ================= */
/* Returns the fewest-press solution (array of 0/1) for a board, or null if unsolvable. */
function lightsSolve(n, lit) {
  var N = n * n, rows = [], i, j, r, c;
  for (i = 0; i < N; i++) {
    var row = new Uint8Array(N + 1); r = (i / n) | 0; c = i % n;
    row[i] = 1; if (r > 0) row[i - n] = 1; if (r < n - 1) row[i + n] = 1; if (c > 0) row[i - 1] = 1; if (c < n - 1) row[i + 1] = 1;
    row[N] = lit[i] ? 1 : 0; rows.push(row);
  }
  var pivCol = [], rank = 0;
  for (var col = 0; col < N && rank < N; col++) {
    var p = -1; for (i = rank; i < N; i++) if (rows[i][col]) { p = i; break; }
    if (p < 0) continue;
    var tmp = rows[p]; rows[p] = rows[rank]; rows[rank] = tmp;
    for (i = 0; i < N; i++) if (i !== rank && rows[i][col]) { var a = rows[i], b = rows[rank]; for (j = col; j <= N; j++) a[j] ^= b[j]; }
    pivCol.push(col); rank++;
  }
  for (i = rank; i < N; i++) if (rows[i][N]) return null;
  var isPiv = new Uint8Array(N); pivCol.forEach(function (pc) { isPiv[pc] = 1; });
  var free = []; for (j = 0; j < N; j++) if (!isPiv[j]) free.push(j);
  var best = null, bestW = 1e9;
  for (var mask = 0; mask < (1 << free.length); mask++) {
    var x = new Uint8Array(N), w = 0;
    for (j = 0; j < free.length; j++) if (mask >> j & 1) { x[free[j]] = 1; w++; }
    for (i = 0; i < rank; i++) {
      var v = rows[i][N];
      for (j = 0; j < free.length; j++) if ((mask >> j & 1) && rows[i][free[j]]) v ^= 1;
      x[pivCol[i]] = v; w += v;
    }
    if (w < bestW) { bestW = w; best = x; }
  }
  return Array.from(best);
}
var LO_LEVELS = [
  { n: 3, lo: 2, hi: 3 }, { n: 3, lo: 4, hi: 5 }, { n: 4, lo: 3, hi: 4 }, { n: 4, lo: 5, hi: 7 },
  { n: 5, lo: 5, hi: 7 }, { n: 5, lo: 8, hi: 10 }, { n: 5, lo: 11, hi: 15 },
  { n: 6, lo: 10, hi: 14 }, { n: 6, lo: 15, hi: 20 }, { n: 7, lo: 18, hi: 26 }
];
function genLights(level, rng) {
  var P = LO_LEVELS[level - 1], n = P.n, N = n * n, best = null, bestGap = 1e9;
  for (var t = 0; t < 400; t++) {
    var k = P.lo + ri(rng, P.hi - P.lo + 1), press = shuffle(rng, range(N)).slice(0, Math.min(N, k + (t > 30 ? ri(rng, 4) : 0)));
    var lit = new Array(N).fill(0);
    press.forEach(function (i) {
      var r = (i / n) | 0, c = i % n;
      lit[i] ^= 1; if (r > 0) lit[i - n] ^= 1; if (r < n - 1) lit[i + n] ^= 1; if (c > 0) lit[i - 1] ^= 1; if (c < n - 1) lit[i + 1] ^= 1;
    });
    var sol = lightsSolve(n, lit), w = sol.reduce(function (a, b) { return a + b; }, 0);
    var gap = w < P.lo ? P.lo - w : w > P.hi ? w - P.hi : 0;
    if (w > 0 && gap < bestGap) { bestGap = gap; best = { lit: lit, w: w }; if (!gap) break; }
  }
  return { params: { size: n, min_presses_range: [P.lo, P.hi] }, puzzle: { n: n, lit: best.lit }, difficulty: best.w, difficulty_label: 'fewest presses: ' + best.w, optimal: best.w };
}

/* ================= BALL SORT ================= */
function bsDone(t, h) {
  for (var i = 0; i < t.length; i++) {
    var x = t[i]; if (!x.length) continue; if (x.length !== h) return false;
    for (var k = 1; k < h; k++) if (x[k] !== x[0]) return false;
  }
  return true;
}
/* Depth-first solver. Returns a list of [from, to] moves, or null. */
function bsSolve(tubesIn, h, cap) {
  var t = tubesIn.map(function (x) { return x.slice(); }), seen = new Set(), nodes = 0, path = [];
  function key() { return t.map(function (x) { return x.join(','); }).sort().join('|'); }
  function rec() {
    if (bsDone(t, h)) return true;
    if (++nodes > cap) return false;
    var k = key(); if (seen.has(k)) return false; seen.add(k);
    var moves = [], i, j;
    for (i = 0; i < t.length; i++) {
      var src = t[i]; if (!src.length) continue;
      var top = src[src.length - 1], uni = true;
      for (j = 0; j < src.length; j++) if (src[j] !== top) { uni = false; break; }
      if (uni && src.length === h) continue;
      var usedEmpty = false;
      for (j = 0; j < t.length; j++) {
        if (j === i) continue; var dst = t[j];
        if (dst.length === h) continue;
        if (!dst.length) { if (uni || usedEmpty) continue; usedEmpty = true; moves.push([i, j, 1]); }
        else if (dst[dst.length - 1] === top) {
          var du = true; for (var q = 0; q < dst.length; q++) if (dst[q] !== top) { du = false; break; }
          moves.push([i, j, du ? 3 + dst.length : 2]);
        }
      }
    }
    moves.sort(function (a, b) { return b[2] - a[2]; });
    for (var m = 0; m < moves.length; m++) {
      var mv = moves[m]; t[mv[1]].push(t[mv[0]].pop()); path.push([mv[0], mv[1]]);
      if (rec()) return true;
      t[mv[0]].push(t[mv[1]].pop()); path.pop();
      if (nodes > cap) return false;
    }
    return false;
  }
  return rec() ? path : null;
}
var BS_LEVELS = [
  { c: 3, h: 4 }, { c: 4, h: 4 }, { c: 5, h: 4 }, { c: 6, h: 4 }, { c: 7, h: 4 },
  { c: 8, h: 4 }, { c: 9, h: 4 }, { c: 10, h: 4 }, { c: 10, h: 5 }, { c: 11, h: 5 }
];
function genBallsort(level, rng) {
  var P = BS_LEVELS[level - 1], out = null;
  for (var t = 0; t < 60 && !out; t++) {
    var balls = []; for (var c = 0; c < P.c; c++) for (var k = 0; k < P.h; k++) balls.push(c);
    shuffle(rng, balls);
    var tubes = []; for (c = 0; c < P.c; c++) tubes.push(balls.slice(c * P.h, (c + 1) * P.h));
    tubes.push([]); tubes.push([]);
    var sortedAlready = tubes.some(function (x) { return x.length === P.h && x.every(function (v) { return v === x[0]; }); });
    if (sortedAlready && P.c > 3) continue;
    var sol = bsSolve(tubes, P.h, 60000);
    if (sol && sol.length >= P.c * 2) out = { tubes: tubes, len: sol.length };
  }
  if (!out) { /* fallback: scramble from solved with legal single moves */
    var tb = []; for (var cc = 0; cc < P.c; cc++) tb.push(new Array(P.h).fill(cc)); tb.push([]); tb.push([]);
    for (var s = 0; s < 400; s++) { var a = ri(rng, tb.length), b = ri(rng, tb.length); if (a !== b && tb[a].length && tb[b].length < P.h) tb[b].push(tb[a].pop()); }
    out = { tubes: tb, len: 0 };
  }
  return { params: { colours: P.c, tube_height: P.h, spare_tubes: 2 }, puzzle: { h: P.h, tubes: out.tubes }, difficulty: out.len, difficulty_label: 'a solver needed ' + out.len + ' moves', optimal: null };
}

/* ================= NONOGRAM ================= */
function ngClues(line) {
  var out = [], run = 0;
  for (var i = 0; i < line.length; i++) { if (line[i] === 1) run++; else if (run) { out.push(run); run = 0; } }
  if (run) out.push(run);
  return out;
}
/* line: Int8Array of -1 unknown / 0 empty / 1 filled. Returns false on contradiction, else updates line. */
function ngLine(clues, line) {
  var n = line.length, k = clues.length, memo = new Int8Array((n + 2) * (k + 1)).fill(-1);
  var canF = new Uint8Array(n), canE = new Uint8Array(n);
  function rec(pos, bi) {
    if (pos >= n) return bi === k;
    var key = pos * (k + 1) + bi; if (memo[key] >= 0) return memo[key] === 1;
    var res = false, i;
    if (line[pos] !== 1 && rec(pos + 1, bi)) { canE[pos] = 1; res = true; }
    if (bi < k) {
      var L = clues[bi], end = pos + L, ok = end <= n;
      if (ok) for (i = pos; i < end; i++) if (line[i] === 0) { ok = false; break; }
      if (ok && end < n && line[end] === 1) ok = false;
      if (ok && rec(end + 1, bi + 1)) { for (i = pos; i < end; i++) canF[i] = 1; if (end < n) canE[end] = 1; res = true; }
    }
    memo[key] = res ? 1 : 0; return res;
  }
  if (!rec(0, 0)) return false;
  var changed = 0;
  for (var j = 0; j < n; j++) if (line[j] < 0) {
    if (canF[j] && !canE[j]) { line[j] = 1; changed++; } else if (canE[j] && !canF[j]) { line[j] = 0; changed++; }
  }
  return changed + 1;
}
function ngSolve(R, C, rowClues, colClues) {
  var g = new Int8Array(R * C).fill(-1), sweeps = 0, line, r, c, res;
  for (;;) {
    var ch = false; sweeps++;
    for (r = 0; r < R; r++) {
      line = new Int8Array(C); for (c = 0; c < C; c++) line[c] = g[r * C + c];
      res = ngLine(rowClues[r], line); if (res === false) return { solved: false, grid: g, sweeps: sweeps };
      if (res > 1) { ch = true; for (c = 0; c < C; c++) g[r * C + c] = line[c]; }
    }
    for (c = 0; c < C; c++) {
      line = new Int8Array(R); for (r = 0; r < R; r++) line[r] = g[r * C + c];
      res = ngLine(colClues[c], line); if (res === false) return { solved: false, grid: g, sweeps: sweeps };
      if (res > 1) { ch = true; for (r = 0; r < R; r++) g[r * C + c] = line[r]; }
    }
    if (!ch) break;
  }
  var solved = true; for (var i = 0; i < g.length; i++) if (g[i] < 0) { solved = false; break; }
  return { solved: solved, grid: g, sweeps: sweeps - 1 };
}
var NG_LEVELS = [
  { n: 5, lo: 1, hi: 3 }, { n: 6, lo: 2, hi: 4 }, { n: 7, lo: 2, hi: 5 }, { n: 8, lo: 3, hi: 6 }, { n: 10, lo: 3, hi: 5 },
  { n: 10, lo: 6, hi: 99 }, { n: 12, lo: 4, hi: 7 }, { n: 12, lo: 8, hi: 99 }, { n: 15, lo: 5, hi: 8 }, { n: 15, lo: 9, hi: 99 }
];
function genNonogram(level, rng) {
  var P = NG_LEVELS[level - 1], n = P.n, best = null, bestGap = 1e9;
  for (var t = 0; t < 40; t++) {
    var pic = new Int8Array(n * n), dens = 0.5 + rng() * 0.16, i;
    for (i = 0; i < n * n; i++) pic[i] = rng() < dens ? 1 : 0;
    var found = null;
    for (var it = 0; it < n * n * 4; it++) {
      var rc = [], cc = [], r, c, line;
      for (r = 0; r < n; r++) { line = []; for (c = 0; c < n; c++) line.push(pic[r * n + c]); rc.push(ngClues(line)); }
      for (c = 0; c < n; c++) { line = []; for (r = 0; r < n; r++) line.push(pic[r * n + c]); cc.push(ngClues(line)); }
      var res = ngSolve(n, n, rc, cc);
      if (res.solved) { found = { rc: rc, cc: cc, sweeps: res.sweeps }; break; }
      var unk = []; for (i = 0; i < n * n; i++) if (res.grid[i] < 0) unk.push(i);
      var x = pick(rng, unk); pic[x] = 1 - pic[x];
    }
    if (!found) continue;
    var filled = 0; for (i = 0; i < n * n; i++) filled += pic[i];
    if (filled < n * n * 0.3) continue;
    var gap = found.sweeps < P.lo ? P.lo - found.sweeps : found.sweeps > P.hi ? found.sweeps - P.hi : 0;
    if (gap < bestGap) { bestGap = gap; best = { pic: Array.from(pic), rc: found.rc, cc: found.cc, sweeps: found.sweeps }; if (!gap) break; }
  }
  return {
    params: { size: n, solver_sweeps_range: [P.lo, P.hi] },
    puzzle: { R: n, C: n, rowClues: best.rc, colClues: best.cc, solution: best.pic },
    difficulty: best.sweeps, difficulty_label: 'line-solver passes: ' + best.sweeps, optimal: null
  };
}

/* ================= TAKUZU (binary puzzle) ================= */
var TKR = {};
function tkRows(n) {
  if (TKR[n]) return TKR[n];
  var out = [], half = n / 2;
  (function rec(pos, mask, ones, run, last) {
    if (ones > half || pos - ones > half) return;
    if (pos === n) { out.push(mask); return; }
    for (var v = 0; v < 2; v++) { var nr = v === last ? run + 1 : 1; if (nr > 2) continue; rec(pos + 1, mask | (v << pos), ones + v, nr, v); }
  })(0, 0, 0, 0, -1);
  return (TKR[n] = out);
}
function tkFull(n, rng) {
  var rowsAll = tkRows(n), half = n / 2, all = (1 << n) - 1;
  for (var guard = 0; guard < 50; guard++) {
    var chosen = [], ones = new Int8Array(n), budget = 20000;
    var ok = (function rec(r) {
      if (r === n) {
        var cols = {};
        for (var c = 0; c < n; c++) { var m = 0; for (var k = 0; k < n; k++) m |= ((chosen[k] >> c) & 1) << k; if (cols[m]) return false; cols[m] = 1; }
        return true;
      }
      if (--budget < 0) return false;
      var cand = shuffle(rng, rowsAll.slice());
      for (var q = 0; q < cand.length; q++) {
        var row = cand[q]; if (chosen.indexOf(row) >= 0) continue;
        if (r >= 2) { var p1 = chosen[r - 1], p2 = chosen[r - 2]; if ((~(p1 ^ p2)) & (~(p1 ^ row)) & all) continue; }
        var good = true, c;
        for (c = 0; c < n; c++) { var bit = (row >> c) & 1, o = ones[c] + bit, z = (r + 1) - o; if (o > half || z > half) { good = false; break; } }
        if (!good) continue;
        for (c = 0; c < n; c++) ones[c] += (row >> c) & 1;
        chosen.push(row);
        if (rec(r + 1)) return true;
        chosen.pop();
        for (c = 0; c < n; c++) ones[c] -= (row >> c) & 1;
        if (budget < 0) return false;
      }
      return false;
    })(0);
    if (ok) { var g = []; for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) g.push((chosen[r] >> c) & 1); return g; }
  }
  return null;
}
function tkLines(n) {
  var L = [], r, c, a;
  for (r = 0; r < n; r++) { a = []; for (c = 0; c < n; c++) a.push(r * n + c); L.push(a); }
  for (c = 0; c < n; c++) { a = []; for (r = 0; r < n; r++) a.push(r * n + c); L.push(a); }
  return L;
}
/* Rule violations in a (possibly partial) grid: returns list of cell indices involved. */
function tkConflicts(n, g) {
  var L = tkLines(n), half = n / 2, bad = {}, li, i;
  for (li = 0; li < L.length; li++) {
    var ln = L[li], c0 = 0, c1 = 0;
    for (i = 0; i < n; i++) {
      var v = g[ln[i]]; if (v === 0) c0++; else if (v === 1) c1++;
      if (v >= 0 && i + 2 < n && g[ln[i + 1]] === v && g[ln[i + 2]] === v) { bad[ln[i]] = bad[ln[i + 1]] = bad[ln[i + 2]] = 1; }
    }
    if (c0 > half || c1 > half) for (i = 0; i < n; i++) if (g[ln[i]] === (c0 > half ? 0 : 1)) bad[ln[i]] = 1;
  }
  for (var o = 0; o < 2; o++) for (var a = 0; a < n; a++) for (var b = a + 1; b < n; b++) {
    var la = L[o * n + a], lb = L[o * n + b], same = true;
    for (i = 0; i < n; i++) if (g[la[i]] < 0 || g[la[i]] !== g[lb[i]]) { same = false; break; }
    if (same) for (i = 0; i < n; i++) { bad[la[i]] = 1; bad[lb[i]] = 1; }
  }
  return Object.keys(bad).map(Number);
}
function tkLogic(n, grid, tier) {
  var g = Int8Array.from(grid), L = tkLines(n), half = n / 2, used = 0;
  function t1(gg) {
    var ch = false;
    for (var li = 0; li < L.length; li++) {
      var ln = L[li], i, v, c0 = 0, c1 = 0;
      for (i = 0; i < n; i++) {
        v = gg[ln[i]]; if (v < 0) continue;
        if (i + 1 < n && gg[ln[i + 1]] === v) {
          if (i > 0 && gg[ln[i - 1]] < 0) { gg[ln[i - 1]] = 1 - v; ch = true; }
          if (i + 2 < n && gg[ln[i + 2]] < 0) { gg[ln[i + 2]] = 1 - v; ch = true; }
        }
        if (i + 2 < n && gg[ln[i + 2]] === v && gg[ln[i + 1]] < 0) { gg[ln[i + 1]] = 1 - v; ch = true; }
      }
      for (i = 0; i < n; i++) { v = gg[ln[i]]; if (v === 0) c0++; else if (v === 1) c1++; }
      if (c0 + c1 < n) {
        if (c0 === half) { for (i = 0; i < n; i++) if (gg[ln[i]] < 0) { gg[ln[i]] = 1; ch = true; } }
        else if (c1 === half) { for (i = 0; i < n; i++) if (gg[ln[i]] < 0) { gg[ln[i]] = 0; ch = true; } }
      }
    }
    return ch;
  }
  function t2(gg) {
    var ch = false;
    for (var li = 0; li < L.length; li++) {
      var ln = L[li], i, c0 = 0, c1 = 0, E = [];
      for (i = 0; i < n; i++) { var v = gg[ln[i]]; if (v === 0) c0++; else if (v === 1) c1++; else E.push(i); }
      if (E.length < 2) continue;
      var s = -1; if (c0 === half - 1) s = 0; else if (c1 === half - 1) s = 1;
      if (s < 0) continue;
      var o = 1 - s, valid = [], base = li < n ? 0 : n;
      for (var e = 0; e < E.length; e++) {
        var arr = []; for (i = 0; i < n; i++) arr.push(gg[ln[i]]);
        for (var f = 0; f < E.length; f++) arr[E[f]] = f === e ? s : o;
        var okk = true;
        for (i = 0; i + 2 < n; i++) if (arr[i] === arr[i + 1] && arr[i] === arr[i + 2]) { okk = false; break; }
        if (okk) for (var q = 0; q < n && okk; q++) {
          if (base + q === li) continue; var other = L[base + q], same = true;
          for (i = 0; i < n; i++) if (gg[other[i]] !== arr[i]) { same = false; break; }
          if (same) okk = false;
        }
        if (okk) valid.push(e);
      }
      if (valid.length === 1) { for (var f2 = 0; f2 < E.length; f2++) gg[ln[E[f2]]] = f2 === valid[0] ? s : o; ch = true; }
      else if (valid.length > 1 && valid.length < E.length) { for (var f3 = 0; f3 < E.length; f3++) if (valid.indexOf(f3) < 0) { gg[ln[E[f3]]] = o; ch = true; } }
    }
    return ch;
  }
  function settle(gg) { for (;;) { if (t1(gg)) continue; if (t2(gg)) continue; break; } }
  function t3() {
    for (var i = 0; i < g.length; i++) if (g[i] < 0) for (var v = 0; v < 2; v++) {
      var cp = Int8Array.from(g); cp[i] = v; settle(cp);
      if (tkConflicts(n, cp).length) { g[i] = 1 - v; return true; }
    }
    return false;
  }
  for (;;) {
    if (t1(g)) { if (used < 1) used = 1; continue; }
    if (tier >= 2 && t2(g)) { if (used < 2) used = 2; continue; }
    if (tier >= 3 && t3()) { used = 3; continue; }
    break;
  }
  var solved = true; for (var i = 0; i < g.length; i++) if (g[i] < 0) { solved = false; break; }
  return { solved: solved, used: used, grid: g };
}
var TK_LEVELS = [
  { n: 4, tier: 1, keep: 0.42 }, { n: 6, tier: 1, keep: 0.4 }, { n: 6, tier: 2, keep: 0 }, { n: 8, tier: 1, keep: 0.36 }, { n: 8, tier: 2, keep: 0 },
  { n: 10, tier: 1, keep: 0 }, { n: 10, tier: 2, keep: 0 }, { n: 12, tier: 2, keep: 0 }, { n: 12, tier: 3, keep: 0 }, { n: 14, tier: 3, keep: 0 }
];
var TK_TIER = ['', 'pairs and counting', 'last-symbol placement', 'one-step lookahead'];
function genTakuzu(level, rng) {
  var P = TK_LEVELS[level - 1], n = P.n, sol = tkFull(n, rng), puz = Int8Array.from(sol), N = n * n;
  var order = shuffle(rng, range(N)), givens = N, minG = Math.round(N * P.keep), k, i, keep;
  for (k = 0; k < N; k++) {
    if (givens <= minG) break;
    i = order[k]; keep = puz[i]; puz[i] = -1;
    if (tkLogic(n, puz, Math.min(P.tier, 2)).solved) givens--; else puz[i] = keep;
  }
  if (P.tier >= 3) {
    var extra = shuffle(rng, range(N)).filter(function (c) { return puz[c] >= 0; }).slice(0, n >= 14 ? 6 : 18);
    for (k = 0; k < extra.length; k++) { i = extra[k]; keep = puz[i]; puz[i] = -1; if (tkLogic(n, puz, 3).solved) givens--; else puz[i] = keep; }
  }
  var used = tkLogic(n, puz, 3).used;
  return {
    params: { size: n, target_technique: TK_TIER[P.tier], givens: givens },
    puzzle: { n: n, givens: Array.from(puz), solution: sol },
    difficulty: used, difficulty_label: 'hardest step: ' + TK_TIER[used], optimal: null
  };
}

/* ================= MASTERMIND ================= */
var MM2_LEVELS = [
  { colors: 4, pegs: 3, dups: false, guesses: 10 }, { colors: 5, pegs: 3, dups: false, guesses: 10 }, { colors: 6, pegs: 4, dups: false, guesses: 10 },
  { colors: 6, pegs: 4, dups: true, guesses: 10 }, { colors: 6, pegs: 4, dups: true, guesses: 8 }, { colors: 7, pegs: 4, dups: true, guesses: 8 },
  { colors: 8, pegs: 4, dups: true, guesses: 8 }, { colors: 8, pegs: 5, dups: true, guesses: 10 }, { colors: 8, pegs: 5, dups: true, guesses: 9 },
  { colors: 9, pegs: 5, dups: true, guesses: 9 }
];
function mmScore(code, guess) {
  var black = 0, cc = {}, gc = {}, i, white = 0;
  for (i = 0; i < code.length; i++) {
    if (code[i] === guess[i]) black++;
    else { cc[code[i]] = (cc[code[i]] || 0) + 1; gc[guess[i]] = (gc[guess[i]] || 0) + 1; }
  }
  Object.keys(gc).forEach(function (k) { white += Math.min(gc[k], cc[k] || 0); });
  return [black, white];
}
function genMastermind(level, rng) {
  var P = MM2_LEVELS[level - 1], code = [];
  if (P.dups) for (var i = 0; i < P.pegs; i++) code.push(ri(rng, P.colors));
  else code = shuffle(rng, range(P.colors)).slice(0, P.pegs);
  var space = P.dups ? Math.pow(P.colors, P.pegs) : range(P.pegs).reduce(function (a, k) { return a * (P.colors - k); }, 1);
  return {
    params: { colours: P.colors, pegs: P.pegs, repeats_allowed: P.dups, guess_limit: P.guesses },
    puzzle: { colors: P.colors, pegs: P.pegs, dups: P.dups, guesses: P.guesses, code: code },
    difficulty: space, difficulty_label: space + ' possible codes', optimal: null
  };
}

/* ================= CROSS MATH ================= */
/* Evaluates one equation line with the usual order of operations. Returns null if a division is not exact. */
function cmEval(nums, ops) {
  var total = 0, sign = 1, cur = nums[0];
  for (var i = 0; i < ops.length; i++) {
    var o = ops[i], v = nums[i + 1];
    if (o === 'x') cur *= v;
    else if (o === '/') { if (!v || cur % v !== 0) return null; cur /= v; }
    else { total += sign * cur; sign = o === '+' ? 1 : -1; cur = v; }
  }
  return total + sign * cur;
}
function cmOrder(n) {
  var order = [], chk = [], k, j;
  for (k = 0; k < n; k++) {
    for (j = k; j < n; j++) { order.push(k * n + j); chk.push(null); }
    chk[chk.length - 1] = [[0, k]];
    for (j = k + 1; j < n; j++) { order.push(j * n + k); chk.push(null); }
    if (k < n - 1) chk[chk.length - 1] = [[1, k]]; else chk[chk.length - 1].push([1, k]);
  }
  return { order: order, chk: chk };
}
/* Counts solutions up to `limit`. Returns {count, over, nodes}; over means the node cap was hit. */
function cmCount(p, givens, limit, cap) {
  var n = p.n, N = n * n, o = cmOrder(n), order = o.order, chk = o.chk, val = new Array(N).fill(0), used = new Uint8Array(N + 1);
  var count = 0, nodes = 0, over = false, i;
  for (i = 0; i < N; i++) if (givens[i]) used[givens[i]] = 1;
  function lineOk(c) {
    var nums = [], k = c[1], j;
    if (c[0] === 0) { for (j = 0; j < n; j++) nums.push(val[k * n + j]); return cmEval(nums, p.rowOps[k]) === p.rowRes[k]; }
    for (j = 0; j < n; j++) nums.push(val[j * n + k]); return cmEval(nums, p.colOps[k]) === p.colRes[k];
  }
  function ok(pos) { var c = chk[pos]; if (!c) return true; for (var q = 0; q < c.length; q++) if (!lineOk(c[q])) return false; return true; }
  function rec(pos) {
    if (pos === N) { count++; return count >= limit; }
    if (++nodes > cap) { over = true; return true; }
    var cell = order[pos];
    if (givens[cell]) { val[cell] = givens[cell]; var r = ok(pos) && rec(pos + 1); val[cell] = 0; return r; }
    for (var v = 1; v <= N; v++) {
      if (used[v]) continue;
      used[v] = 1; val[cell] = v;
      var stop = ok(pos) && rec(pos + 1);
      used[v] = 0; val[cell] = 0;
      if (stop) return true;
    }
    return false;
  }
  rec(0);
  return { count: count, over: over, nodes: nodes };
}
var CM_LEVELS = [
  { n: 3, ops: '+', giv: 5 }, { n: 3, ops: '+-', giv: 4 }, { n: 3, ops: '+-', giv: 3 }, { n: 3, ops: '+-x', giv: 3 }, { n: 3, ops: '+-x', giv: 2 },
  { n: 3, ops: '+-x/', giv: 1 }, { n: 3, ops: '+-x/', giv: 0 }, { n: 4, ops: '+-', giv: 7 }, { n: 4, ops: '+-x', giv: 5 }, { n: 4, ops: '+-x/', giv: 4 }
];
function genCrossmath(level, rng) {
  var P = CM_LEVELS[level - 1], n = P.n, N = n * n, opList = P.ops.split(''), best = null;
  var opW = opList.map(function (o) { return { '+': 3, '-': 3, 'x': n === 3 ? 2 : 1.2, '/': 2.4 }[o]; });
  var maxRes = n === 3 ? 600 : 999, minRes = level <= 5 ? 0 : -99, wantDiv = P.ops.indexOf('/') >= 0, wantMul = P.ops.indexOf('x') >= 0;
  function pickLine(nums) {
    for (var t = 0; t < 40; t++) {
      var ops = []; for (var k = 0; k < n - 1; k++) ops.push(wpick(rng, opList, opW));
      var r = cmEval(nums, ops);
      if (r !== null && r >= minRes && r <= maxRes) return { ops: ops, res: r };
    }
    var plain = []; for (var q = 0; q < n - 1; q++) plain.push('+');
    return { ops: plain, res: cmEval(nums, plain) };
  }
  for (var attempt = 0; attempt < 40; attempt++) {
    var sol = shuffle(rng, range(N)).map(function (v) { return v + 1; });
    var p = { n: n, rowOps: [], colOps: [], rowRes: [], colRes: [] }, k, j, all = '';
    for (k = 0; k < n; k++) {
      var rn = [], cn = []; for (j = 0; j < n; j++) { rn.push(sol[k * n + j]); cn.push(sol[j * n + k]); }
      var a = pickLine(rn), b = pickLine(cn);
      p.rowOps.push(a.ops); p.rowRes.push(a.res); p.colOps.push(b.ops); p.colRes.push(b.res); all += a.ops.join('') + b.ops.join('');
    }
    if (attempt < 30 && ((wantDiv && all.indexOf('/') < 0) || (wantMul && all.indexOf('x') < 0))) continue;
    var giv = sol.slice(), count = N, order = shuffle(rng, range(N)), cap = n === 3 ? 200000 : 250000, nodes = 0;
    for (k = 0; k < N && count > P.giv; k++) {
      var cell = order[k], keep = giv[cell]; giv[cell] = 0;
      var res = cmCount(p, giv, 2, cap);
      if (res.count === 1 && !res.over) { count--; nodes = res.nodes; } else giv[cell] = keep;
    }
    var cand = { p: p, sol: sol, giv: giv, count: count, nodes: nodes };
    if (!best || count < best.count) best = cand;
    if (count <= P.giv) break;
  }
  best.p.givens = best.giv; best.p.solution = best.sol;
  return {
    params: { size: n, numbers: '1-' + N, operators: P.ops, target_givens: P.giv, givens: best.count },
    puzzle: best.p, difficulty: best.nodes,
    difficulty_label: best.count + ' of ' + N + ' numbers given, solver search nodes: ' + best.nodes, optimal: null
  };
}

/* ================= NUMBER SEQUENCE ================= */
function sqRand(rng, lo, hi) { return lo + ri(rng, hi - lo + 1); }
function sqStep(d) { return d > 0 ? 'add ' + d : 'subtract ' + (-d); }
function sqNonZero(rng, lo, hi) { var v = 0; while (!v) v = sqRand(rng, lo, hi); return v; }
var SQ_PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97];
function sqDigitSum(x) { x = Math.abs(x); var s = 0; while (x) { s += x % 10; x = Math.floor(x / 10); } return s; }
function sqIter(first, step) { return function (i) { var t = first.slice(); while (t.length <= i) t.push(step(t, t.length)); return t[i]; }; }
var SQ_CLUE = {
  gaps: 'Write down the gaps between neighbouring terms and look for a pattern in them.',
  gaps2: 'Look at the gaps between terms, then at the gaps between those gaps.',
  prev: 'Each term is built from the terms just before it.',
  ops: 'Two different operations take turns.',
  every: 'Look at every other term on its own.',
  power: 'Think about powers of whole numbers.',
  digits: 'Each term comes from the one before it, using its digits.'
};
var SQ_FAMS = {
  alt: function (rng, big) {
    var a = sqRand(rng, 1, 40), d1 = sqNonZero(rng, -12, big ? 25 : 15), d2 = sqNonZero(rng, -12, big ? 25 : 15);
    while (d2 === d1 || d2 === -d1) d2 = sqNonZero(rng, -12, 15);
    return { f: function (i) { var k = Math.floor(i / 2); return a + k * (d1 + d2) + (i % 2 ? d1 : 0); }, desc: 'Alternately ' + sqStep(d1) + ' and ' + sqStep(d2) + '.', clue: 'gaps' };
  },
  quad: function (rng, big) {
    var a = sqRand(rng, 1, 40), b = sqRand(rng, -8, 8), c = sqNonZero(rng, -6, big ? 9 : 6); if (Math.abs(c) < 2) c = 3;
    return { f: function (i) { return a + b * i + c * i * (i - 1) / 2; }, desc: 'The gaps between terms change by ' + c + ' each time.', clue: 'gaps' };
  },
  affine: function (rng, big) {
    var s = sqRand(rng, 2, 9), m = sqRand(rng, 2, 3), c = sqNonZero(rng, -9, 9);
    return { f: sqIter([s], function (t) { return m * t[t.length - 1] + c; }), desc: 'Multiply by ' + m + ', then ' + sqStep(c) + '.', clue: 'prev' };
  },
  inter: function (rng, big) {
    var a = sqRand(rng, 1, 40), d1 = sqNonZero(rng, -9, big ? 19 : 12), b = sqRand(rng, 1, 60), d2 = sqNonZero(rng, -9, big ? 19 : 12);
    while (d2 === d1) d2 = sqNonZero(rng, -9, 12);
    return { f: function (i) { var k = Math.floor(i / 2); return i % 2 ? b + k * d2 : a + k * d1; }, desc: 'Two sequences take turns: in one you ' + sqStep(d1) + ', in the other you ' + sqStep(d2) + '.', clue: 'every' };
  },
  diffgeom: function (rng, big) {
    var a = sqRand(rng, 1, 30), d = sqRand(rng, 1, big ? 7 : 5), r = sqRand(rng, 2, 3);
    return { f: function (i) { var x = a, g = d; for (var k = 0; k < i; k++) { x += g; g *= r; } return x; }, desc: 'The gaps between terms multiply by ' + r + ' each time.', clue: 'gaps' };
  },
  fibc: function (rng, big) {
    var a = sqRand(rng, 1, big ? 20 : 12), b = sqRand(rng, 1, big ? 20 : 12), c = rng() < 0.6 ? sqNonZero(rng, -4, 5) : 0;
    return { f: sqIter([a, b], function (t) { return t[t.length - 1] + t[t.length - 2] + c; }), desc: 'Each term is the sum of the two before it' + (c ? ', then ' + sqStep(c) : '') + '.', clue: 'prev' };
  },
  interMix: function (rng, big) {
    var a = sqRand(rng, 1, 30), d = sqNonZero(rng, -9, big ? 15 : 9), b = sqRand(rng, 1, 5), r = sqRand(rng, 2, 3);
    var geomFirst = rng() < 0.5;
    return { f: function (i) { var k = Math.floor(i / 2), g = (i % 2 === 0) === geomFirst; return g ? b * Math.pow(r, k) : a + k * d; }, desc: 'Two sequences take turns: one multiplies by ' + r + ', the other ' + (d > 0 ? 'adds ' + d : 'subtracts ' + (-d)) + '.', clue: 'every' };
  },
  diffFib: function (rng, big) {
    var a = sqRand(rng, 1, 30), g0 = sqRand(rng, 1, big ? 9 : 6), g1 = sqRand(rng, 1, big ? 9 : 6);
    return { f: function (i) { var x = a, p = g0, q = g1; for (var k = 0; k < i; k++) { x += p; var t = p + q; p = q; q = t; } return x; }, desc: 'Each gap between terms is the sum of the two gaps before it.', clue: 'gaps' };
  },
  diffPrimes: function (rng) {
    var a = sqRand(rng, 1, 40), j = sqRand(rng, 0, 6);
    return { f: function (i) { var x = a; for (var k = 0; k < i; k++) x += SQ_PRIMES[j + k]; return x; }, desc: 'The gaps between terms are the prime numbers in order, starting at ' + SQ_PRIMES[j] + '.', clue: 'gaps' };
  },
  diffSquares: function (rng) {
    var a = sqRand(rng, 1, 30), k0 = sqRand(rng, 1, 7);
    return { f: function (i) { var x = a; for (var k = 0; k < i; k++) x += (k0 + k) * (k0 + k); return x; }, desc: 'The gaps between terms are square numbers in order, starting at ' + (k0 * k0) + '.', clue: 'gaps' };
  },
  secondGeom: function (rng, big) {
    var a = sqRand(rng, 1, 30), g = sqRand(rng, 1, 6), hh = sqRand(rng, 1, big ? 4 : 3), r = sqRand(rng, 2, 3);
    return { f: function (i) { var x = a, gap = g, inc = hh; for (var k = 0; k < i; k++) { x += gap; gap += inc; inc *= r; } return x; }, desc: 'The gaps grow, and the amount they grow by multiplies by ' + r + ' each time.', clue: 'gaps2' };
  },
  cubes: function (rng, big) {
    var k = sqRand(rng, 1, big ? 7 : 5), c = sqRand(rng, -9, 9), neg = big && rng() < 0.4;
    return { f: function (i) { var v = Math.pow(i + k, 3) + c; return neg && i % 2 ? -v : v; }, desc: 'Cube numbers (' + Math.pow(k, 3) + ', ' + Math.pow(k + 1, 3) + ', ' + Math.pow(k + 2, 3) + ' and so on)' + (c ? (c > 0 ? ' plus ' + c : ' minus ' + (-c)) : '') + (neg ? ', with every second term made negative' : '') + '.', clue: 'power' };
  },
  tri: function (rng, big) {
    var a = sqRand(rng, 0, big ? 9 : 5), b = sqRand(rng, 1, big ? 9 : 5), c = sqRand(rng, 1, big ? 9 : 6);
    return { f: sqIter([a, b, c], function (t) { var n = t.length; return t[n - 1] + t[n - 2] + t[n - 3]; }), desc: 'Each term is the sum of the three before it.', clue: 'prev' };
  },
  altops: function (rng, big) {
    var s = sqRand(rng, 1, 9), m = sqRand(rng, 2, 3), c = sqNonZero(rng, -9, 12);
    return { f: sqIter([s], function (t, n) { var x = t[n - 1]; return (n - 1) % 2 ? x + c : x * m; }), desc: 'Multiply by ' + m + ', then ' + sqStep(c) + ', and repeat.', clue: 'ops' };
  },
  growOps: function (rng, big) {
    var s = sqRand(rng, 1, 6), m0 = 2, c0 = sqRand(rng, 1, 4), mulFirst = rng() < 0.6;
    return { f: sqIter([s], function (t, n) { var x = t[n - 1], k = n - 1, half = Math.floor(k / 2), mul = (k % 2 === 0) === mulFirst; return mul ? x * (m0 + half) : x + (c0 + half); }), desc: 'Operations take turns: multiply by 2, 3, 4… and add ' + c0 + ', ' + (c0 + 1) + ', ' + (c0 + 2) + '…', clue: 'ops' };
  },
  lin2: function (rng, big) {
    var p = pick(rng, [2, 3]), q = pick(rng, [1, -1, 2]), a = sqRand(rng, 1, big ? 9 : 6), b = sqRand(rng, 1, big ? 9 : 6);
    return { f: sqIter([a, b], function (t) { var n = t.length; return p * t[n - 1] + q * t[n - 2]; }), desc: 'Each term is ' + p + ' times the previous term ' + (q > 0 ? 'plus ' + (q === 1 ? '' : q + ' times ') : 'minus ') + 'the term before that.', clue: 'prev' };
  },
  posAffine: function (rng, big) {
    var s = sqRand(rng, 1, 6), m = sqRand(rng, 2, big ? 3 : 2), sg = rng() < 0.5 ? 1 : -1;
    return { f: sqIter([s], function (t, n) { return m * t[n - 1] + sg * n; }), desc: 'Multiply by ' + m + ', then ' + (sg > 0 ? 'add' : 'subtract') + ' the position of the new term (1, 2, 3…).', clue: 'prev' };
  },
  prodPrev: function (rng) {
    var a = sqRand(rng, 1, 3), b = sqRand(rng, 2, 4), c = pick(rng, [-1, 1, 2, 3]);
    return { f: sqIter([a, b], function (t) { var n = t.length; return t[n - 1] * t[n - 2] + c; }), desc: 'Multiply the two previous terms, then ' + sqStep(c) + '.', clue: 'prev' };
  },
  digitSum: function (rng) {
    var s = sqRand(rng, 11, 199), twice = rng() < 0.4;
    return { f: sqIter([s], function (t) { var x = t[t.length - 1]; return x + (twice ? 2 : 1) * sqDigitSum(x); }), desc: 'Add ' + (twice ? 'twice ' : '') + 'the sum of the digits of the previous term.', clue: 'digits' };
  }
};
/* Rules a solver spots at a glance. A puzzle is rejected if one of these also explains it,
   unless that simple rule is the family's own rule. */
var SQ_SIMPLE = ['poly1', 'geom', 'poly2', 'alt', 'inter', 'gaps:poly1', 'gaps:geom', 'gaps:alt'];
var SQ_ALLOW = { alt: ['alt', 'inter', 'gaps:alt'], quad: ['poly2', 'gaps:poly1', 'gaps:alt'], inter: ['inter', 'alt'], interMix: ['inter'], diffgeom: ['gaps:geom'], affine: ['gaps:geom'] };
var SQ_HARD = ['fibc', 'interMix', 'diffFib', 'tri', 'lin2', 'posAffine', 'diffSquares', 'diffPrimes', 'secondGeom', 'growOps', 'prodPrev', 'digitSum', 'altops', 'cubes'];
var SQ_LEVELS = [
  { fams: ['alt', 'quad', 'affine', 'inter', 'diffgeom'], shown: 6, ans: 1 },
  { fams: ['fibc', 'interMix', 'diffFib', 'cubes', 'altops'], shown: 6, ans: 1 },
  { fams: ['tri', 'lin2', 'posAffine', 'diffSquares', 'diffPrimes'], shown: 6, ans: 1 },
  { fams: ['secondGeom', 'growOps', 'prodPrev', 'digitSum', 'lin2'], shown: 6, ans: 1 },
  { fams: SQ_HARD, shown: 6, ans: 2 }, { fams: SQ_HARD, shown: 6, ans: 2, big: true },
  { fams: SQ_HARD, shown: 5, ans: 2 }, { fams: SQ_HARD, shown: 5, ans: 2, big: true },
  { fams: SQ_HARD, shown: 6, ans: 3, big: true }, { fams: SQ_HARD, shown: 5, ans: 3, big: true }
];
/* Base rule fitters: each returns predictions for the next k terms, or nothing if the rule does not fit. */
function sqBase(s, k, deep) {
  var out = [], m = s.length, i;
  function push(name, pred) { if (pred && pred.every(function (v) { return isFinite(v) && Math.abs(v) < 1e12; })) out.push({ name: name, pred: pred }); }
  for (var ord = 1; ord <= 3; ord++) {
    if (m < ord + 2) continue;
    var rows = [s.slice()], j;
    for (j = 0; j < ord; j++) { var pr0 = rows[j], d = []; for (i = 1; i < pr0.length; i++) d.push(pr0[i] - pr0[i - 1]); rows.push(d); }
    var last = rows[ord], ok = true; for (i = 1; i < last.length; i++) if (last[i] !== last[0]) ok = false;
    if (!ok) continue;
    var tails = rows.map(function (r) { return r[r.length - 1]; }), pred = [];
    for (var t = 0; t < k; t++) { for (j = ord - 1; j >= 0; j--) tails[j] += tails[j + 1]; pred.push(tails[0]); }
    push('poly' + ord, pred);
  }
  (function () {
    if (m < 3) return; for (i = 0; i < m; i++) if (!s[i]) return;
    if (s[1] % s[0]) return; var r = s[1] / s[0]; if (Math.abs(r) < 2) return;
    for (i = 1; i < m; i++) if (s[i] !== s[i - 1] * r) return;
    var pr = [], x = s[m - 1]; for (var t = 0; t < k; t++) { x *= r; pr.push(x); } push('geom', pr);
  })();
  (function () {
    if (m < 5) return;
    for (var p = -3; p <= 3; p++) for (var q = -3; q <= 3; q++) for (var sl = -4; sl <= 4; sl++) {
      if (!deep && sl) continue;
      var r = s[2] - p * s[1] - q * s[0] - sl * 2, ok2 = true;
      for (i = 3; i < m; i++) if (s[i] !== p * s[i - 1] + q * s[i - 2] + sl * i + r) { ok2 = false; break; }
      if (!ok2) continue;
      var a = s[m - 2], b = s[m - 1], pr = []; for (var t = 0; t < k; t++) { var c = p * b + q * a + sl * (m + t) + r; pr.push(c); a = b; b = c; }
      push('lin2', pr);
    }
  })();
  (function () {
    if (m < 5) return; var d = []; for (i = 1; i < m; i++) d.push(s[i] - s[i - 1]);
    for (i = 2; i < d.length; i++) if (d[i] !== d[i - 2]) return;
    var pr = [], x = s[m - 1]; for (var t = 0; t < k; t++) { x += d[(m - 1 + t) % 2]; pr.push(x); } push('alt', pr);
  })();
  (function () {
    if (m < 5) return;
    for (i = 3; i < m; i++) if (s[i] !== s[i - 1] + s[i - 2] + s[i - 3]) return;
    var t3 = s.slice(m - 3), pr = []; for (var t = 0; t < k; t++) { var c = t3[0] + t3[1] + t3[2]; pr.push(c); t3 = [t3[1], t3[2], c]; } push('tri', pr);
  })();
  (function () {
    if (m < 4 || !deep) return;
    for (var c = -6; c <= 6; c++) {
      var ok3 = true; for (i = 2; i < m; i++) if (s[i] !== s[i - 1] * s[i - 2] + c) { ok3 = false; break; }
      if (!ok3) continue;
      var a = s[m - 2], b = s[m - 1], pr = []; for (var t = 0; t < k; t++) { var v = a * b + c; pr.push(v); a = b; b = v; } push('prod', pr);
    }
  })();
  (function () {
    if (m < 3 || !deep) return;
    for (var mult = 1; mult <= 2; mult++) {
      var ok4 = true; for (i = 1; i < m; i++) if (s[i] !== s[i - 1] + mult * sqDigitSum(s[i - 1])) { ok4 = false; break; }
      if (!ok4) continue;
      var x = s[m - 1], pr = []; for (var t = 0; t < k; t++) { x += mult * sqDigitSum(x); pr.push(x); } push('digits', pr);
    }
  })();
  (function () {
    if (m < 4) return; var j0 = SQ_PRIMES.indexOf(s[0]); if (j0 < 0) return;
    for (i = 1; i < m; i++) if (SQ_PRIMES[j0 + i] !== s[i]) return;
    var pr = []; for (var t = 0; t < k; t++) pr.push(SQ_PRIMES[j0 + m + t]); push('primes', pr);
  })();
  (function () {
    /* two operations take turns (multiply / add); their amounts may each step by a constant */
    if (m < 5 || !deep) return;
    for (var ph = 0; ph < 2; ph++) {
      var mulv = [], addv = [], ok5 = true;
      for (i = 1; i < m; i++) {
        if ((i - 1) % 2 === ph) { if (!s[i - 1] || s[i] % s[i - 1]) { ok5 = false; break; } mulv.push(s[i] / s[i - 1]); }
        else addv.push(s[i] - s[i - 1]);
      }
      if (!ok5 || mulv.length < 2 || addv.length < 1) continue;
      if (mulv.some(function (v) { return Math.abs(v) < 2; })) continue;
      var dm = mulv[1] - mulv[0]; if (dm !== 0 && dm !== 1) continue;
      var okm = true; for (i = 2; i < mulv.length; i++) if (mulv[i] - mulv[i - 1] !== dm) okm = false;
      var da = addv.length > 1 ? addv[1] - addv[0] : 0, oka = true; for (i = 2; i < addv.length; i++) if (addv[i] - addv[i - 1] !== da) oka = false;
      if (!okm || !oka || (addv.length < 2 && dm)) continue;
      var nm = mulv[mulv.length - 1], na = addv[addv.length - 1], x = s[m - 1], pr = [];
      for (var t = 0; t < k; t++) { var st = m - 1 + t; if (st % 2 === ph) { nm += dm; x *= nm; } else { na += da; x += na; } pr.push(x); }
      push('ops', pr);
    }
  })();
  (function () {
    if (m < 4 || !deep) return; var rs = [];
    for (i = 1; i < m; i++) { if (!s[i - 1] || s[i] % s[i - 1]) return; rs.push(s[i] / s[i - 1]); }
    for (i = 1; i < rs.length; i++) if (rs[i] !== rs[i - 1] + 1) return;
    var pr = [], x = s[m - 1], r = rs[rs.length - 1]; for (var t = 0; t < k; t++) { r++; x *= r; pr.push(x); } push('posmult', pr);
  })();
  return out;
}
/* Every rule we know that fits the shown terms: base rules, rules on the gaps (and the gaps of the gaps),
   and two interleaved sequences, each with its predictions for the next k terms. */
function sqFits(s, k) {
  var out = sqBase(s, k, true), m = s.length, i;
  function lift(seq, fits) { return fits.map(function (f) { var x = seq[seq.length - 1], pr = []; f.pred.forEach(function (d) { x += d; pr.push(x); }); return { name: 'gaps:' + f.name, pred: pr }; }); }
  var d1 = []; for (i = 1; i < m; i++) d1.push(s[i] - s[i - 1]);
  out = out.concat(lift(s, sqBase(d1, k, false)));
  var d2 = []; for (i = 1; i < d1.length; i++) d2.push(d1[i] - d1[i - 1]);
  lift(d1, sqBase(d2, k, false)).forEach(function (f) { out = out.concat(lift(s, [{ name: f.name, pred: f.pred }])); });
  (function () {
    /* signs alternate: fit the sizes, then restore the signs */
    for (i = 0; i < m; i++) if (!s[i]) return;
    for (i = 1; i < m; i++) if ((s[i] > 0) === (s[i - 1] > 0)) return;
    var mag = s.map(Math.abs), sg = s[m - 1] > 0 ? -1 : 1;
    sqBase(mag, k, false).forEach(function (f) { out.push({ name: 'signs:' + f.name, pred: f.pred.map(function (v, t) { return v * (t % 2 ? -sg : sg); }) }); });
  })();
  if (m >= 5) {
    var ev = [], od = []; for (i = 0; i < m; i++) (i % 2 ? od : ev).push(s[i]);
    var need = function (sub, n) { return sqBase(sub, n, false).filter(function (f) { return f.name === 'poly1' || f.name === 'geom' || f.name === 'poly2'; }); };
    var ne = 0, no = 0; for (i = m; i < m + k; i++) { if (i % 2) no++; else ne++; }
    var fe = ne ? need(ev, ne) : [{ pred: [] }], fo = no ? need(od, no) : [{ pred: [] }];
    if (ev.length >= 3 && od.length >= 3) fe.forEach(function (a) { fo.forEach(function (b) {
      var pr = [], ie = 0, io = 0; for (var t = m; t < m + k; t++) pr.push(t % 2 ? b.pred[io++] : a.pred[ie++]);
      out.push({ name: 'inter', pred: pr });
    }); });
  }
  return out;
}
function genSequence(level, rng) {
  var P = SQ_LEVELS[level - 1], total = P.shown + P.ans, out = null, fam, rule, terms, tried = 0;
  for (var attempt = 0; attempt < 3000 && !out; attempt++) {
    fam = pick(rng, P.fams); if (P.shown < 6 && (fam === 'inter' || fam === 'interMix')) continue;
    rule = SQ_FAMS[fam](rng, !!P.big);
    terms = []; for (var i = 0; i < total; i++) terms.push(rule.f(i));
    if (terms.some(function (v) { return Math.abs(v) > (P.ans > 1 ? 99999 : 999999) || !isFinite(v) || v !== Math.round(v); })) continue;
    var uniq = {}; terms.forEach(function (v) { uniq[v] = 1; }); if (Object.keys(uniq).length < total - 1) continue;
    tried++;
    var shown = terms.slice(0, P.shown), ans = terms.slice(P.shown), fits = sqFits(shown, P.ans);
    if (!fits.length) continue;
    if (fits.some(function (f) { return f.pred.join(',') !== ans.join(','); })) continue;
    var allow = SQ_ALLOW[fam] || [];
    if (fits.some(function (f) { return SQ_SIMPLE.indexOf(f.name) >= 0 && allow.indexOf(f.name) < 0; })) continue;
    out = { shown: shown, ans: ans, desc: rule.desc, clue: SQ_CLUE[rule.clue], fam: fam, fits: fits.length };
  }
  if (!out) { out = { shown: [3, 4, 7, 11, 18, 29], ans: [47, 76, 123].slice(0, P.ans), desc: 'Each term is the sum of the two before it.', clue: SQ_CLUE.prev, fam: 'fibc', fits: 1 }; }
  return {
    params: { family: out.fam, shown_terms: P.shown, answers: P.ans, rule_checks_passed: out.fits },
    puzzle: { shown: out.shown, answers: out.ans, rule: out.desc, clue: out.clue },
    difficulty: level, difficulty_label: 'rule family: ' + out.fam + ', ' + P.shown + ' shown, ' + P.ans + ' to find', optimal: null
  };
}

/* ================= NUMBER PATH ================= */
function npNbrs(R, C, i) {
  var r = (i / C) | 0, c = i % C, o = [];
  if (r > 0) o.push(i - C); if (r < R - 1) o.push(i + C); if (c > 0) o.push(i - 1); if (c < C - 1) o.push(i + 1);
  return o;
}
function npDist(C, a, b) { return Math.abs(((a / C) | 0) - ((b / C) | 0)) + Math.abs(a % C - b % C); }
/* Random Hamiltonian path by repeated backbite moves from a serpentine path. */
function npPath(R, C, rng) {
  var path = [], r, c;
  for (r = 0; r < R; r++) for (c = 0; c < C; c++) path.push(r * C + (r % 2 ? C - 1 - c : c));
  var N = R * C, idx = new Array(N);
  function reindex() { for (var k = 0; k < N; k++) idx[path[k]] = k; }
  reindex();
  for (var it = 0; it < N * 40; it++) {
    if (rng() < 0.5) { path.reverse(); reindex(); }
    var end = path[N - 1], nb = npNbrs(R, C, end), x = pick(rng, nb), j = idx[x];
    if (j === N - 2) continue;
    var tail = path.slice(j + 1).reverse();
    path = path.slice(0, j + 1).concat(tail); reindex();
  }
  return path;
}
/* Counts solutions up to `limit`; givens[cell] = number or 0. At least one number must be given.
   Grows the path up from the smallest given number to N, then down to 1, pruning on distance to the
   next fixed number, cells that could not have two path neighbours, and cut-off regions. */
function npCount(R, C, givens, limit, cap) {
  var N = R * C, pos = new Array(N + 2).fill(-1), val = givens.slice(), i, k, nb = [];
  for (i = 0; i < N; i++) { if (givens[i]) pos[givens[i]] = i; nb.push(npNbrs(R, C, i)); }
  var gmin = 0; for (k = 1; k <= N; k++) if (pos[k] >= 0) { gmin = k; break; }
  if (!gmin) return { count: 0, over: true, nodes: 0 };
  var nextG = new Array(N + 2).fill(0);
  for (k = N; k >= 1; k--) nextG[k] = pos[k] >= 0 ? k : (k < N ? nextG[k + 1] : 0);
  var count = 0, nodes = 0, over = false, seen = new Int32Array(N), stamp = 0, queue = new Int32Array(N);
  var lowCell = pos[gmin];
  /* phase: 'up' while placing gmin+1..N (head = upper end), 'down' while placing gmin-1..1 */
  function feasible(k, head, up) {
    var ends = 0, empty = 0, q, j, c, a;
    if (up && pos[N] < 0) ends++;
    if (gmin > 1) ends++;
    for (c = 0; c < N; c++) {
      if (val[c]) continue;
      empty++; a = 0;
      for (j = 0; j < nb[c].length; j++) {
        q = nb[c][j];
        if (!val[q] || q === head || (up && val[q] > k) || (up && q === lowCell && gmin > 1)) a++;
      }
      if (a === 0) return false;
      if (a === 1 && --ends < 0) return false;
    }
    if (!empty) return true;
    stamp++; var qh = 0, qt = 0;
    var seeds = [head]; if (up && gmin > 1) seeds.push(lowCell);
    for (j = 0; j < seeds.length; j++) { seen[seeds[j]] = stamp; queue[qt++] = seeds[j]; }
    var reached = 0;
    while (qh < qt) {
      c = queue[qh++];
      for (j = 0; j < nb[c].length; j++) {
        q = nb[c][j]; if (seen[q] === stamp) continue;
        if (!val[q] || (up && val[q] > k)) { seen[q] = stamp; queue[qt++] = q; if (!val[q]) reached++; }
      }
    }
    return reached === empty;
  }
  function down(k, cell) {
    if (k === 1) { count++; return count >= limit; }
    if (++nodes > cap) { over = true; return true; }
    var nx = k - 1, list = nb[cell];
    for (var q = 0; q < list.length; q++) {
      var c2 = list[q]; if (val[c2]) continue;
      val[c2] = nx;
      var stop = feasible(nx, c2, false) && down(nx, c2);
      val[c2] = 0;
      if (stop) return true;
    }
    return false;
  }
  function up(k, cell) {
    if (k === N) return gmin > 1 ? down(gmin, lowCell) : (count++, count >= limit);
    if (++nodes > cap) { over = true; return true; }
    var nx = k + 1;
    if (pos[nx] >= 0) return npDist(C, cell, pos[nx]) === 1 ? up(nx, pos[nx]) : false;
    var g = nx < N ? nextG[nx + 1] : 0, list = nb[cell];
    for (var q = 0; q < list.length; q++) {
      var c2 = list[q]; if (val[c2]) continue;
      if (g) { var dd = npDist(C, c2, pos[g]); if (dd > g - nx || ((g - nx - dd) & 1)) continue; }
      val[c2] = nx;
      var stop = feasible(nx, c2, true) && up(nx, c2);
      val[c2] = 0;
      if (stop) return true;
    }
    return false;
  }
  up(gmin, lowCell);
  return { count: count, over: over, nodes: nodes };
}
var NP_LEVELS = [
  { n: 6, tries: 3 }, { n: 6, tries: 5 }, { n: 7, tries: 2 }, { n: 7, tries: 4 }, { n: 8, tries: 1 },
  { n: 8, tries: 2 }, { n: 9, tries: 1 }, { n: 9, tries: 1 }, { n: 10, tries: 1 }, { n: 10, tries: 1 }
];
/* Removes fixed numbers one at a time, keeping a removal only while the solution stays unique,
   until no more can go. Keeps the hardest of a few attempts (most solver search). */
function genNumpath(level, rng) {
  var P = NP_LEVELS[level - 1], R = P.n, C = P.n, N = R * C, best = null, cap = N > 64 ? 25000 : 50000;
  for (var attempt = 0; attempt < P.tries; attempt++) {
    var path = npPath(R, C, rng), sol = new Array(N);
    path.forEach(function (cell, k) { sol[cell] = k + 1; });
    var giv = sol.slice(), count = N, order = shuffle(rng, range(N));
    for (var q = 0; q < N; q++) {
      var cell = order[q], keep = giv[cell]; giv[cell] = 0;
      var res = npCount(R, C, giv, 2, cap);
      if (res.count === 1 && !res.over) count--; else giv[cell] = keep;
    }
    var fin = npCount(R, C, giv, 2, cap * 4);
    var cand = { giv: giv, sol: sol, path: path, count: count, nodes: fin.nodes };
    if (!best || cand.nodes > best.nodes) best = cand;
  }
  return {
    params: { rows: R, cols: C, givens: best.count },
    puzzle: { R: R, C: C, givens: best.giv, solution: best.sol, path: best.path },
    difficulty: best.nodes, difficulty_label: best.count + ' of ' + N + ' numbers given, solver search nodes: ' + best.nodes, optimal: null
  };
}

/* ================= PATTERN MATRIX ================= */
var PM_ATTRS = { shape: 5, count: 5, fill: 3, size: 3, color: 3 };
var PM_NUMERIC = { count: 1, size: 1 };
var PM_LEVELS = [
  { attrs: [['count', ['prog']]], n: 1, opts: 6, rounds: 3, lives: 3 },
  { attrs: [['count', ['prog', 'dist']], ['shape', ['dist']], ['fill', ['dist']]], n: 1, opts: 6, rounds: 3, lives: 3 },
  { attrs: [['count', ['prog', 'const']], ['shape', ['dist', 'const']], ['fill', ['dist']]], n: 2, opts: 6, rounds: 3, lives: 3 },
  { attrs: [['count', ['prog', 'dist']], ['shape', ['dist', 'const']], ['fill', ['dist', 'const']], ['size', ['prog', 'dist']]], n: 2, opts: 6, rounds: 4, lives: 3 },
  { attrs: [['count', ['prog', 'dist']], ['shape', ['dist', 'const']], ['fill', ['dist', 'const']], ['size', ['prog', 'dist']]], n: 3, opts: 6, rounds: 4, lives: 3 },
  { attrs: [['count', ['prog', 'dist']], ['shape', ['dist', 'const']], ['fill', ['dist', 'const']], ['size', ['prog', 'dist', 'const']]], n: 3, opts: 8, rounds: 4, lives: 2 },
  { attrs: [['count', ['arith', 'prog', 'dist']], ['shape', ['dist', 'const']], ['fill', ['dist', 'const']], ['size', ['prog', 'dist']]], n: 3, opts: 8, rounds: 4, lives: 2 },
  { attrs: [['count', ['prog', 'dist']], ['shape', ['dist', 'const']], ['fill', ['dist', 'const']], ['size', ['prog', 'dist', 'const']]], n: 4, opts: 8, rounds: 5, lives: 2 },
  { attrs: [['count', ['arith', 'dist']], ['shape', ['dist']], ['fill', ['dist', 'const']], ['size', ['prog', 'dist']], ['color', ['dist', 'const']]], n: 4, opts: 8, rounds: 5, lives: 2 },
  { attrs: [['count', ['arith', 'prog', 'dist']], ['shape', ['dist']], ['fill', ['dist']], ['size', ['prog', 'dist']], ['color', ['dist']]], n: 5, opts: 8, rounds: 5, lives: 2 }
];
/* Values for one attribute across the 3x3 grid (row-major), following a rule. */
function pmRule(rng, attr, rule) {
  var K = PM_ATTRS[attr], v = [], r;
  if (rule === 'global') { var g = ri(rng, K); for (r = 0; r < 9; r++) v.push(g); return v; }
  if (rule === 'const') { var vals = shuffle(rng, range(K)).slice(0, 3); for (r = 0; r < 3; r++) v.push(vals[r], vals[r], vals[r]); return v; }
  if (rule === 'dist') { var d = shuffle(rng, range(K)).slice(0, 3), sh = rng() < 0.5 ? 1 : 2; for (r = 0; r < 3; r++) for (var c = 0; c < 3; c++) v.push(d[(c + r * sh) % 3]); return v; }
  if (rule === 'prog') {
    var step = K >= 5 && rng() < 0.3 ? 2 : 1; if (rng() < 0.4) step = -step;
    for (r = 0; r < 3; r++) {
      var lo = Math.max(0, -2 * step), hi = Math.min(K - 1, K - 1 - 2 * step), s0 = lo + ri(rng, hi - lo + 1);
      if (attr === 'size') s0 = step > 0 ? 0 : 2;
      v.push(s0, s0 + step, s0 + 2 * step);
    }
    return v;
  }
  if (rule === 'arith') { for (r = 0; r < 3; r++) { var a = 1 + ri(rng, 2), b = 1 + ri(rng, 4 - a); v.push(a - 1, b - 1, a + b - 1); } return v; }
}
/* Predictions of every rule hypothesis that fits the eight visible values of one attribute. */
function pmPredict(attr, v) {
  var preds = {}, row = function (r) { return [v[r * 3], v[r * 3 + 1], v[r * 3 + 2]]; }, a = row(0), b = row(1), c3 = [v[6], v[7]];
  if (a[0] === a[1] && a[1] === a[2] && b[0] === b[1] && b[1] === b[2] && c3[0] === c3[1]) preds['const'] = c3[0];
  var sa = a.slice().sort().join(), sb = b.slice().sort().join();
  if (sa === sb && new Set(a).size === 3) { var miss = a.filter(function (x) { return c3.indexOf(x) < 0; }); if (miss.length === 1 && c3[0] !== c3[1]) preds['dist'] = miss[0]; }
  if (PM_NUMERIC[attr]) {
    var st = a[1] - a[0];
    if (st && a[2] - a[1] === st && b[1] - b[0] === st && b[2] - b[1] === st && c3[1] - c3[0] === st) preds['prog'] = c3[1] + st;
    if (attr === 'count' && a[2] === a[0] + a[1] + 1 && b[2] === b[0] + b[1] + 1) preds['arith'] = c3[0] + c3[1] + 1;
  }
  return preds;
}
var PM_DESC = {
  'const': { shape: 'Each row uses one shape.', count: 'Each row keeps the same number of shapes.', fill: 'Each row keeps one fill style.', size: 'Each row keeps one size.', color: 'Each row keeps one colour.' },
  'dist': { shape: 'Each row has the same three shapes in a different order.', count: 'Each row has the same three counts in a different order.', fill: 'Each row has the same three fills in a different order.', size: 'Each row has the same three sizes in a different order.', color: 'Each row has the same three colours in a different order.' },
  'prog': { count: 'The number of shapes changes by the same step along each row.', size: 'The size changes by one step along each row.' },
  'arith': { count: 'In each row, the third panel has as many shapes as the first two together.' }
};
function pmOne(rng, P) {
  for (var guard = 0; guard < 200; guard++) {
    var pool = shuffle(rng, P.attrs.slice()), active = pool.slice(0, P.n), rules = {}, vals = {}, ok = true, descs = [];
    Object.keys(PM_ATTRS).forEach(function (attr) { rules[attr] = 'global'; });
    active.forEach(function (a) { rules[a[0]] = pick(rng, a[1]); });
    Object.keys(PM_ATTRS).forEach(function (attr) {
      if (attr === 'color' && rules.color === 'global') { vals.color = new Array(9).fill(1); return; }
      vals[attr] = pmRule(rng, attr, rules[attr]);
      if (rules[attr] === 'global') return;
      var preds = pmPredict(attr, vals[attr]), keys = Object.keys(preds), want = vals[attr][8];
      if (!keys.length || keys.some(function (k) { return preds[k] !== want; })) ok = false;
      descs.push(PM_DESC[rules[attr]][attr]);
    });
    if (!ok) continue;
    var panels = range(9).map(function (i) { var o = {}; Object.keys(PM_ATTRS).forEach(function (attr) { o[attr] = vals[attr][i]; }); return o; });
    var answer = panels[8], key = function (p) { return [p.shape, p.count, p.fill, p.size, p.color].join(''); };
    var seen = {}; seen[key(answer)] = 1;
    var actNames = active.map(function (a) { return a[0]; }), otherNames = Object.keys(PM_ATTRS).filter(function (x) { return actNames.indexOf(x) < 0 && x !== 'color'; });
    var opts = [answer];
    for (var t = 0; t < 400 && opts.length < P.opts; t++) {
      var o2 = Object.assign({}, answer), flips = rng() < 0.75 ? 1 : 2;
      for (var f = 0; f < flips; f++) {
        var attr2 = rng() < 0.75 ? pick(rng, actNames) : pick(rng, otherNames.length ? otherNames : actNames), nv = ri(rng, PM_ATTRS[attr2]);
        o2[attr2] = nv;
      }
      if (o2.count === 4 && o2.size === 2) continue;
      if (seen[key(o2)]) continue; seen[key(o2)] = 1; opts.push(o2);
    }
    if (opts.length < P.opts) continue;
    if (panels.some(function (p) { return p.count === 4 && p.size === 2; })) continue;
    shuffle(rng, opts);
    return { panels: panels.slice(0, 8), options: opts, answer: opts.indexOf(answer), rules: descs };
  }
  return null;
}
function genMatrix(level, rng) {
  var P = PM_LEVELS[level - 1], rounds = [];
  while (rounds.length < P.rounds) { var one = pmOne(rng, P); if (one) rounds.push(one); }
  return {
    params: { rounds: P.rounds, varying_attributes: P.n, options: P.opts, wrong_picks_allowed: P.lives - 1 },
    puzzle: { rounds: rounds, lives: P.lives },
    difficulty: P.n * 10 + P.opts, difficulty_label: P.rounds + ' matrices, ' + P.n + ' changing ' + (P.n === 1 ? 'feature' : 'features') + ', ' + P.opts + ' options', optimal: null
  };
}

/* ================= SAFE CRACKER ================= */
function scPerms(N) {
  var out = [], cur = [], used = new Array(10).fill(false);
  (function rec() {
    if (cur.length === N) { out.push(cur.slice()); return; }
    for (var d = 0; d < 10; d++) if (!used[d]) { used[d] = true; cur.push(d); rec(); cur.pop(); used[d] = false; }
  })();
  return out;
}
function scScore(code, guess) {
  var e = 0, m = 0;
  for (var i = 0; i < guess.length; i++) { if (code[i] === guess[i]) e++; else if (code.indexOf(guess[i]) >= 0) m++; }
  return [e, m];
}
function scText(fb) {
  var W = ['No', 'One', 'Two', 'Three', 'Four', 'Five'], e = fb[0], m = fb[1], parts = [];
  if (!e && !m) return 'Nothing is correct';
  if (e) parts.push(W[e] + (e === 1 ? ' number is' : ' numbers are') + ' correct and well placed');
  if (m) parts.push((e ? W[m].toLowerCase() : W[m]) + (e ? (m === 1 ? ' is' : ' are') : (m === 1 ? ' number is' : ' numbers are')) + ' correct but wrongly placed');
  return parts.join(', ');
}
var SC_PERMS = {};
var SC_LEVELS = [
  { N: 3, p0: 0.4, pickMode: 'max', min: 3, max: 5 }, { N: 3, p0: 0.25, pickMode: 'max', min: 4, max: 6 }, { N: 3, p0: 0.1, pickMode: 'min', min: 4, max: 7 },
  { N: 4, p0: 0.3, pickMode: 'max', min: 4, max: 6 }, { N: 4, p0: 0.15, pickMode: 'mid', min: 5, max: 7 }, { N: 4, p0: 0, pickMode: 'min', min: 5, max: 8 },
  { N: 4, p0: 0, pickMode: 'min', min: 6, max: 8 }, { N: 5, p0: 0.2, pickMode: 'max', min: 5, max: 7 }, { N: 5, p0: 0.05, pickMode: 'mid', min: 6, max: 8 },
  { N: 5, p0: 0, pickMode: 'min', min: 6, max: 9 }
];
function scConsistent(cands, clues) {
  return cands.filter(function (c) { for (var i = 0; i < clues.length; i++) { var s = scScore(c, clues[i].g); if (s[0] !== clues[i].fb[0] || s[1] !== clues[i].fb[1]) return false; } return true; });
}
function genSafe(level, rng) {
  var P = SC_LEVELS[level - 1], all = SC_PERMS[P.N] || (SC_PERMS[P.N] = scPerms(P.N)), best = null;
  for (var attempt = 0; attempt < 30; attempt++) {
    var code = pick(rng, all), cands = all, clues = [];
    for (var guard = 0; guard < 300 && cands.length > 1; guard++) {
      var tries = P.pickMode === 'max' ? 6 : P.pickMode === 'mid' ? 3 : 6, opts = [];
      for (var t = 0; t < tries; t++) {
        var g = pick(rng, all); if (g.join() === code.join()) continue;
        var fb = scScore(code, g); if (!fb[0] && !fb[1] && rng() >= P.p0) continue;
        var left = cands.filter(function (c) { var s = scScore(c, g); return s[0] === fb[0] && s[1] === fb[1]; }).length;
        if (left < cands.length) opts.push({ g: g, fb: fb, left: left });
      }
      if (!opts.length) continue;
      opts.sort(function (a, b) { return a.left - b.left; });
      var ch = P.pickMode === 'max' ? opts[0] : P.pickMode === 'min' ? opts[opts.length - 1] : opts[opts.length >> 1];
      clues.push({ g: ch.g, fb: ch.fb });
      cands = cands.filter(function (c) { var s = scScore(c, ch.g); return s[0] === ch.fb[0] && s[1] === ch.fb[1]; });
    }
    if (cands.length !== 1) continue;
    var order = shuffle(rng, range(clues.length)), keepIdx = {};
    clues.forEach(function (c, i) { keepIdx[i] = true; });
    order.forEach(function (i) {
      keepIdx[i] = false;
      var rest = clues.filter(function (c, j) { return keepIdx[j]; });
      if (scConsistent(all, rest).length !== 1) keepIdx[i] = true;
    });
    var fin = clues.filter(function (c, j) { return keepIdx[j]; });
    var gap = fin.length < P.min ? P.min - fin.length : fin.length > P.max ? fin.length - P.max : 0;
    var cand = { code: code, clues: shuffle(rng, fin), gap: gap };
    if (!best || gap < best.gap) best = cand;
    if (!gap) break;
  }
  return {
    params: { digits: P.N, clues: best.clues.length, nothing_correct_clues: best.clues.filter(function (c) { return !c.fb[0] && !c.fb[1]; }).length },
    puzzle: { N: P.N, code: best.code, clues: best.clues.map(function (c) { return { guess: c.g, exact: c.fb[0], misplaced: c.fb[1], text: scText(c.fb) }; }), tries: 3 },
    difficulty: best.clues.length * 10 + P.N, difficulty_label: P.N + '-digit code, ' + best.clues.length + ' clues', optimal: null
  };
}

/* ================= registry ================= */
var TYPES = {
  sudoku: { track: 'math', name: 'Sudoku', gen: genSudoku },
  kenken: { track: 'math', name: 'KenKen', gen: genKenken },
  crossmath: { track: 'math', name: 'Cross Math', gen: genCrossmath },
  mathmaze: { track: 'math', name: 'Math Maze', gen: genMaze },
  sequence: { track: 'math', name: 'Number Sequence', gen: genSequence },
  sliding: { track: 'analytical', name: 'Sliding Tiles', gen: genSliding },
  lights: { track: 'analytical', name: 'Lights Out', gen: genLights },
  ballsort: { track: 'analytical', name: 'Colour Sort', gen: genBallsort },
  numpath: { track: 'analytical', name: 'Number Path', gen: genNumpath },
  nonogram: { track: 'logic', name: 'Nonogram', gen: genNonogram },
  takuzu: { track: 'logic', name: 'Binary Grid', gen: genTakuzu },
  mastermind: { track: 'logic', name: 'Code Breaker', gen: genMastermind },
  matrix: { track: 'logic', name: 'Pattern Matrix', gen: genMatrix },
  safe: { track: 'logic', name: 'Safe Cracker', gen: genSafe }
};
function generate(type, level, seed) {
  var out = TYPES[type].gen(level, makeRng(seed));
  out.type = type; out.level = level; out.seed = seed; out.generator_version = type + '@' + GEN_VERSION;
  return out;
}

var PT = {
  GEN_VERSION: GEN_VERSION, TYPES: TYPES, generate: generate, makeRng: makeRng,
  sudGeom: sudGeom, sudLogic: sudLogic, sudCount: sudCount, sudHint: sudHint,
  kkSolve: kkSolve, mmApply: mmApply, mmEnumerate: mmEnumerate,
  slide3Dist: slide3Dist, manhattan: manhattan, lightsSolve: lightsSolve,
  bsSolve: bsSolve, bsDone: bsDone, ngSolve: ngSolve, ngClues: ngClues,
  tkConflicts: tkConflicts, tkLogic: tkLogic, mmScore: mmScore,
  cmEval: cmEval, cmCount: cmCount,
  sqFits: sqFits, npCount: npCount, npDist: npDist, pmPredict: pmPredict, scScore: scScore, scText: scText, scConsistent: scConsistent, scPerms: scPerms
};
root.PT = PT;
if (typeof module !== 'undefined' && module.exports) module.exports = PT;
if (typeof WorkerGlobalScope !== 'undefined' && root instanceof WorkerGlobalScope) {
  root.onmessage = function (e) {
    var m = e.data;
    try { root.postMessage({ id: m.id, ok: true, result: generate(m.type, m.level, m.seed) }); }
    catch (err) { root.postMessage({ id: m.id, ok: false, error: String(err && err.message || err) }); }
  };
}
})(typeof self !== 'undefined' ? self : typeof globalThis !== 'undefined' ? globalThis : this);
