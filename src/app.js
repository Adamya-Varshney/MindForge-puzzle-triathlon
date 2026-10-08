(function () {
'use strict';
var PT = window.PT, APP_VERSION = '1.1.0', MAX_LEVEL = 10, NEED = 2;

/* ================= helpers ================= */
function $(s, r) { return (r || document).querySelector(s); }
function h(tag, attrs, kids) {
  var e = document.createElement(tag), k;
  if (attrs) for (k in attrs) {
    var v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k === 'style') e.style.cssText = v;
    else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  if (kids != null) (Array.isArray(kids) ? kids : [kids]).forEach(function (c) {
    if (c == null || c === false) return;
    e.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  });
  return e;
}
function range(n) { var a = []; for (var i = 0; i < n; i++) a.push(i); return a; }
function pad2(n) { return n < 10 ? '0' + n : '' + n; }
function fmtTime(ms) {
  if (ms == null) return '-';
  var s = Math.floor(ms / 1000), m = Math.floor(s / 60), hh = Math.floor(m / 60);
  s %= 60;
  if (hh) return hh + ':' + pad2(m % 60) + ':' + pad2(s);
  return m + ':' + pad2(s);
}
function median(xs) {
  if (!xs.length) return null;
  var a = xs.slice().sort(function (x, y) { return x - y; }), m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
function pct(a, b) { return b ? Math.round(100 * a / b) + '%' : '-'; }
function nowIso() { return new Date().toISOString(); }
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function lsGet(k) { try { var v = window.localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
function lsSet(k, v) { try { window.localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
var OPS = { '+': '+', '-': '−', 'x': '×', '/': '÷' };

/* ================= catalogue ================= */
var TRACKS = [
  { id: 'math', lane: 1, name: 'Maths', blurb: 'Number placement and arithmetic: sums, cages and running totals.' },
  { id: 'analytical', lane: 2, name: 'Analytical', blurb: 'Visual and hands-on. You move pieces and watch the board respond.' },
  { id: 'logic', lane: 3, name: 'Logic', blurb: 'Pure deduction. Every step follows from the clues.' }
];
var TRACK = {}; TRACKS.forEach(function (t) { TRACK[t.id] = t; });
function sv(inner) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + inner + '</svg>'; }
var G = 'fill="none" stroke="var(--t-deep)" stroke-width="1.4"', F = 'fill="var(--t)"';
var PUZ = {
  sudoku: {
    name: 'Sudoku', desc: 'Place each digit once in every row, column and box.',
    icon: sv('<rect x="3" y="3" width="18" height="18" rx="2" ' + G + '/><path d="M9 3v18M15 3v18M3 9h18M3 15h18" ' + G + '/><rect x="9.8" y="9.8" width="4.4" height="4.4" ' + F + '/>'),
    rules: ['Every row, column and outlined box must hold each digit exactly once.', 'Select a cell, then pick a digit. Notes mode pencils in small candidates.', 'A wavy underline marks two equal digits that clash.', 'Hint places one digit and tells you why. Check marks wrong entries and counts them as mistakes.']
  },
  kenken: {
    name: 'KenKen', desc: 'Fill a Latin square so every cage hits its target.',
    icon: sv('<rect x="3" y="3" width="18" height="18" rx="2" ' + G + '/><path d="M3 12h9v9M12 3v9h9" fill="none" stroke="var(--t)" stroke-width="2.4"/>'),
    rules: ['Use the digits 1 to N. No digit repeats in a row or column.', 'Each outlined cage shows a target and an operation. The digits in the cage must produce that target.', 'Subtraction and division cages have two cells and work in either order.', 'A cage with only a number is a given.']
  },
  crossmath: {
    name: 'Cross Math', desc: 'Place each number once so every row and column equation holds.',
    icon: sv('<rect x="3" y="3" width="6" height="6" rx="1.5" ' + F + '/><rect x="15" y="3" width="6" height="6" rx="1.5" ' + G + '/><rect x="3" y="15" width="6" height="6" rx="1.5" ' + G + '/><rect x="15" y="15" width="6" height="6" rx="1.5" fill="var(--t-deep)"/><path d="M10.4 6h3.2M12 4.4v3.2M10.4 17.2h3.2M10.4 18.9h3.2M4.9 10.9l2.2 2.2M7.1 10.9l-2.2 2.2" fill="none" stroke="var(--t-deep)" stroke-width="1.3" stroke-linecap="round"/>'),
    rules: ['Fill the empty cells with the numbers 1 to 9, or 1 to 16 on the larger grid. Each number is used exactly once.', 'Every row reads left to right and every column top to bottom as a sum that must equal the result at its end.', 'Multiplication and division are done before addition and subtraction, as in ordinary arithmetic.', 'A result shows a tick when its line is right and is crossed out when the line is full but wrong.', 'Every puzzle has exactly one solution. A wavy underline marks a number you have used twice.']
  },
  mathmaze: {
    name: 'Math Maze', desc: 'Walk from Start to Finish and land on the exact target.',
    icon: sv('<path d="M5 5h7v7h7v7" fill="none" stroke="var(--t)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="5" cy="5" r="2.4" ' + F + '/><circle cx="19" cy="19" r="2.4" fill="var(--t-deep)"/>'),
    rules: ['You start on the top-left number. Step up, down, left or right, never onto a cell twice.', 'Each cell you enter changes your running total.', 'A division cell is blocked unless your total divides evenly.', 'Reach the Finish cell with exactly the target. Select a cell on your route to step back to it.']
  },
  sliding: {
    name: 'Sliding Tiles', desc: 'Slide tiles into the gap until they read in order.',
    icon: sv('<rect x="3" y="3" width="8" height="8" rx="2" ' + F + '/><rect x="13" y="3" width="8" height="8" rx="2" ' + F + '/><rect x="3" y="13" width="8" height="8" rx="2" ' + F + '/><rect x="13" y="13" width="8" height="8" rx="2" ' + G + ' stroke-dasharray="2 2"/>'),
    rules: ['Select a tile in line with the gap to slide it. Arrow keys work too.', 'Finish with the tiles in order, left to right and top to bottom, gap last.', 'Fewer moves earn nothing extra, but the shortest solution is shown for comparison.']
  },
  lights: {
    name: 'Lights Out', desc: 'Each press flips a light and its neighbours. Turn them all off.',
    icon: sv('<circle cx="6" cy="6" r="2.6" ' + F + '/><circle cx="12" cy="6" r="2.6" ' + G + '/><circle cx="18" cy="6" r="2.6" ' + F + '/><circle cx="6" cy="12" r="2.6" ' + G + '/><circle cx="12" cy="12" r="2.6" ' + F + '/><circle cx="18" cy="12" r="2.6" ' + G + '/><circle cx="6" cy="18" r="2.6" ' + F + '/><circle cx="12" cy="18" r="2.6" ' + G + '/><circle cx="18" cy="18" r="2.6" ' + G + '/>'),
    rules: ['Pressing a light flips it and the lights directly above, below, left and right.', 'The puzzle is solved when every light is off.', 'Pressing the same light twice cancels out, and the order of presses does not matter.']
  },
  ballsort: {
    name: 'Colour Sort', desc: 'Move one ball at a time until every tube holds one colour.',
    icon: sv('<path d="M5 3v14a3 3 0 0 0 6 0V3M13 3v14a3 3 0 0 0 6 0V3" ' + G + '/><circle cx="8" cy="16" r="2.3" ' + F + '/><circle cx="8" cy="11" r="2.3" fill="var(--t-deep)"/><circle cx="16" cy="16" r="2.3" fill="var(--t-deep)"/>'),
    rules: ['Select a tube to pick up its top ball, then select where it goes.', 'A ball can land in an empty tube or on a ball of the same colour.', 'Each ball carries a number as well as a colour.', 'Finish with every tube full of one colour, or empty.']
  },
  nonogram: {
    name: 'Nonogram', desc: 'Use run-length clues to paint the hidden picture.',
    icon: sv('<rect x="3" y="3" width="6" height="6" ' + F + '/><rect x="9" y="3" width="6" height="6" ' + F + '/><rect x="15" y="9" width="6" height="6" ' + F + '/><rect x="3" y="15" width="6" height="6" ' + F + '/><rect x="9" y="15" width="6" height="6" ' + F + '/><rect x="3" y="3" width="18" height="18" ' + G + '/>'),
    rules: ['The numbers beside each row and above each column give the lengths of its filled runs, in order.', 'Runs in one line are separated by at least one empty cell.', 'Choose Fill or Cross, then tap or drag across cells. Crosses are your own markers for empty cells.', 'Every puzzle here can be solved line by line without guessing.']
  },
  takuzu: {
    name: 'Binary Grid', desc: 'Fill with 0 and 1: no three alike in a line, equal counts.',
    icon: sv('<rect x="3" y="3" width="18" height="18" rx="2" ' + G + '/><text x="7.2" y="16.5" font-size="11" font-weight="700" font-family="monospace" ' + F + '>0</text><text x="13.2" y="16.5" font-size="11" font-weight="700" font-family="monospace" fill="var(--t-deep)">1</text>'),
    rules: ['Tap a cell to cycle through 0, 1 and empty.', 'No more than two equal digits may sit next to each other in a row or column.', 'Every row and column holds as many 0s as 1s.', 'No two rows are identical, and no two columns are identical.']
  },
  mastermind: {
    name: 'Code Breaker', desc: 'Deduce the hidden colour code from the feedback on each guess.',
    icon: sv('<circle cx="6" cy="12" r="3" ' + F + '/><circle cx="12" cy="12" r="3" fill="var(--t-deep)"/><circle cx="18" cy="12" r="3" ' + G + '/><path d="M4 19h16" stroke="var(--t-deep)" stroke-width="1.6" stroke-dasharray="1.5 2.5"/>'),
    rules: ['Build a guess from the colours, then submit it.', 'Exact means right colour in the right position. Misplaced means right colour in the wrong position.', 'You have a limited number of guesses. Running out logs the attempt as failed.', 'Each colour carries a number so it never depends on colour alone.']
  }
};
var TYPE_ORDER = { math: ['sudoku', 'kenken', 'crossmath', 'mathmaze'], analytical: ['sliding', 'lights', 'ballsort'], logic: ['nonogram', 'takuzu', 'mastermind'] };
var BASE_PAR = [60, 90, 150, 210, 270, 360, 450, 540, 660, 780];

/* ================= state ================= */
var S = { attempts: [], progress: { level: 1, unlocked: {} }, level: 1, playLevel: 1, ready: false, cur: null, screen: 'hub', openRow: null };

/* ================= storage ================= */
var Store = {
  mode: 'local', col: null, prog: null, uid: null, chains: {},
  init: function () {
    var self = this;
    if (!(window.claude && typeof window.claude.use === 'function')) return Promise.resolve();
    return Promise.all([window.claude.use('db'), window.claude.use('user')]).then(function (r) {
      var db = r[0], user = r[1];
      if (!db || !user) return;
      return user.id().then(function (uid) {
        if (!uid) return;
        self.uid = uid; self.mode = 'db';
        self.col = db.doc('data/users/' + uid + '/game').collection('attempts');
        self.prog = db.doc('data/users/' + uid + '/progress');
      });
    }).catch(function () { self.mode = 'local'; });
  },
  load: function () {
    var self = this;
    if (this.mode !== 'db') return Promise.resolve({ attempts: lsGet('pt_attempts') || [], progress: lsGet('pt_progress') });
    return Promise.all([this.col.orderBy('started_at', 'desc').limit(1000).get(), this.prog.get()]).then(function (r) {
      var rows = r[0].docs.map(function (d) { return clone(d.data()); });
      var pg = r[1].exists ? clone(r[1].data()) : null;
      var outbox = lsGet('pt_outbox') || [];
      if (outbox.length) {
        var have = {}; rows.forEach(function (a) { have[a.attempt_id] = 1; });
        outbox.forEach(function (a) { if (!have[a.attempt_id]) rows.push(a); self.save(a); });
        rows.sort(function (a, b) { return a.started_at < b.started_at ? 1 : -1; });
        lsSet('pt_outbox', []);
      }
      return { attempts: rows, progress: pg };
    }).catch(function () {
      self.mode = 'local'; self.broken = true;
      return { attempts: lsGet('pt_attempts') || [], progress: lsGet('pt_progress') };
    });
  },
  save: function (att) {
    var self = this, id = att.attempt_id, body = clone(att);
    if (this.mode !== 'db') { this.saveLocal(); return Promise.resolve(); }
    setSave('Saving…', '');
    var run = function () {
      return self.col.doc(id).set(body).catch(function (e) {
        if (e && e.code === 'unavailable') return new Promise(function (res) { setTimeout(res, 1200 + Math.random() * 800); }).then(function () { return self.col.doc(id).set(body); });
        throw e;
      });
    };
    var next = (this.chains[id] || Promise.resolve()).then(run).then(function () { setSave('Saved to your attempt database', 'ok'); }, function (e) {
      var out = lsGet('pt_outbox') || [];
      out = out.filter(function (a) { return a.attempt_id !== id; }); out.push(body); lsSet('pt_outbox', out);
      setSave(e && e.code === 'quota_exceeded' ? 'The database is full. This attempt is kept in this browser.' : 'Could not reach the database. This attempt is kept in this browser and will sync next time.', 'warn');
    });
    this.chains[id] = next; return next;
  },
  saveProgress: function (p) {
    if (this.mode !== 'db') { lsSet('pt_progress', p); return; }
    var self = this;
    this.chains._p = (this.chains._p || Promise.resolve()).then(function () { return self.prog.set(clone(p)); }).catch(function () {});
  },
  saveLocal: function () {
    var ok = lsSet('pt_attempts', S.attempts);
    setSave(ok ? 'Saved in this browser' : 'This browser is blocking storage. Attempts last only until you close the page.', ok ? 'ok' : 'warn');
  }
};
function setSave(text, state) { var e = $('#save-status'); e.textContent = text; e.setAttribute('data-state', state || ''); }

/* ================= progression ================= */
function gateFor(level) {
  var g = { math: { n: 0, clean: false }, analytical: { n: 0, clean: false }, logic: { n: 0, clean: false } };
  S.attempts.forEach(function (a) {
    if (a.level !== level || !a.counts_for_gate || !g[a.track]) return;
    g[a.track].n++; if (!a.hints_used) g[a.track].clean = true;
  });
  return g;
}
function laneDone(x) { return x.n >= NEED && x.clean; }
function computeLevel() {
  var L = 1;
  while (L < MAX_LEVEL) { var g = gateFor(L); if (laneDone(g.math) && laneDone(g.analytical) && laneDone(g.logic)) L++; else break; }
  return Math.max(L, (S.progress && S.progress.level) || 1);
}
function parMs(type, level, excludeId) {
  var xs = S.attempts.filter(function (a) { return a.puzzle_type === type && a.level === level && a.outcome === 'solved' && a.attempt_id !== excludeId; }).map(function (a) { return a.active_ms; });
  return xs.length >= 3 ? median(xs) : BASE_PAR[level - 1] * 1000;
}

/* ================= timer ================= */
function Timer() { this.acc = 0; this.t0 = null; this.pauses = 0; this.pausedAcc = 0; this.pt0 = null; }
Timer.prototype.start = function () {
  if (this.t0 !== null) return;
  var now = performance.now();
  if (this.pt0 !== null) { this.pausedAcc += now - this.pt0; this.pt0 = null; }
  this.t0 = now;
};
Timer.prototype.pause = function (count) {
  if (this.t0 === null) return;
  var now = performance.now();
  this.acc += now - this.t0; this.t0 = null;
  if (count !== false) { this.pauses++; this.pt0 = now; }
};
Timer.prototype.ms = function () { return this.acc + (this.t0 !== null ? performance.now() - this.t0 : 0); };
Timer.prototype.pausedMs = function () { return this.pausedAcc + (this.pt0 !== null ? performance.now() - this.pt0 : 0); };
Timer.prototype.running = function () { return this.t0 !== null; };

/* ================= generation (worker with fallback) ================= */
var worker = null, workerDead = false, reqId = 0, waiting = {};
function generateAsync(type, level, seed) {
  return new Promise(function (resolve) {
    var done = false;
    function local() { if (done) return; done = true; setTimeout(function () { resolve(PT.generate(type, level, seed)); }, 20); }
    if (!workerDead && !worker) {
      try {
        var src = document.getElementById('engines').textContent;
        worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
        worker.onmessage = function (e) { var w = waiting[e.data.id]; if (w) { delete waiting[e.data.id]; w(e.data); } };
        worker.onerror = function () { workerDead = true; Object.keys(waiting).forEach(function (k) { var w = waiting[k]; delete waiting[k]; w({ ok: false }); }); };
      } catch (e) { workerDead = true; }
    }
    if (workerDead) return local();
    var id = ++reqId;
    waiting[id] = function (m) { if (m.ok) { if (!done) { done = true; resolve(m.result); } } else local(); };
    worker.postMessage({ id: id, type: type, level: level, seed: seed });
    setTimeout(function () { if (waiting[id]) { delete waiting[id]; local(); } }, 6000);
  });
}

/* ================= puzzle views ================= */
function rcName(n, i) { return 'row ' + (Math.floor(i / n) + 1) + ', column ' + (i % n + 1); }
function rc(n, i) { return 'r' + (Math.floor(i / n) + 1) + 'c' + (i % n + 1); }
function flash(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

function numGridView(ctx, cfg) {
  var n = cfg.n, N = n * n, sol = cfg.solution, giv = cfg.givens, vals = giv.slice(), notes = new Array(N).fill(0);
  var sel = -1, notesMode = false, wrong = {}, hist = [], cells = [], padBtns = [], units = cfg.units;
  var cellUnits = range(N).map(function () { return []; });
  units.forEach(function (u, ui) { u.forEach(function (i) { cellUnits[i].push(ui); }); });
  function clash() {
    var bad = {};
    units.forEach(function (u) { var seen = {}; u.forEach(function (i) { var v = vals[i]; if (!v) return; if (seen[v] !== undefined) { bad[i] = 1; bad[seen[v]] = 1; } else seen[v] = i; }); });
    return bad;
  }
  function paint() {
    var bad = clash(), svv = sel >= 0 ? vals[sel] : 0, counts = new Array(n + 1).fill(0);
    cells.forEach(function (c, i) {
      var v = vals[i], cl = c.el.classList, peer = false, k;
      if (v) counts[v]++;
      c.v.textContent = v || '';
      if (sel >= 0 && i !== sel) for (k = 0; k < cellUnits[i].length; k++) if (cellUnits[sel].indexOf(cellUnits[i][k]) >= 0) { peer = true; break; }
      cl.toggle('sel', i === sel); cl.toggle('peer', peer); cl.toggle('same', !!v && v === svv && i !== sel);
      cl.toggle('clash', !!bad[i]); cl.toggle('wrong', !!wrong[i]);
      c.nt.hidden = !!v;
      for (k = 0; k < n; k++) c.ns[k].textContent = (!v && (notes[i] >> k & 1)) ? (k + 1) : '';
    });
    padBtns.forEach(function (b, d) { b.classList.toggle('done', counts[d + 1] >= n); });
  }
  function checkDone() {
    for (var i = 0; i < N; i++) if (!vals[i]) return;
    for (i = 0; i < N; i++) if (vals[i] !== sol[i]) { ctx.msg('The grid is full but not right yet. Check shows where.', 'bad'); return; }
    ctx.solved();
  }
  function input(d) {
    if (sel < 0) { ctx.msg('Select a cell first.'); return; }
    var i = sel; if (giv[i]) return;
    if (notesMode && d > 0) {
      if (vals[i]) return;
      hist.push({ i: i, v: vals[i], n: notes[i], pn: [] }); notes[i] ^= 1 << (d - 1); ctx.log('n', rc(n, i) + '~' + d); paint(); return;
    }
    if (vals[i] === d) return;
    var rec = { i: i, v: vals[i], n: notes[i], pn: [] };
    vals[i] = d; delete wrong[i];
    if (d) {
      notes[i] = 0;
      cellUnits[i].forEach(function (ui) { units[ui].forEach(function (j) { if (notes[j] >> (d - 1) & 1) { rec.pn.push([j, notes[j]]); notes[j] &= ~(1 << (d - 1)); } }); });
    }
    hist.push(rec); ctx.move(rc(n, i) + '=' + d); ctx.msg(''); paint(); if (d) checkDone();
  }
  function select(i) { sel = i; paint(); }
  return {
    tools: { undo: true, notes: true, hint: true, check: true, restart: true },
    mount: function () {
      var nc = Math.ceil(Math.sqrt(n)), grid = h('div', { class: 'numgrid ' + cfg.cls, style: '--n:' + n + ';--nc:' + nc });
      range(N).forEach(function (i) {
        var r = Math.floor(i / n), c = i % n, cls = 'cell';
        if (giv[i]) cls += ' given'; if (cfg.edgeR(i)) cls += ' er'; if (cfg.edgeB(i)) cls += ' eb';
        if (c === n - 1) cls += ' lastc'; if (r === n - 1) cls += ' lastr';
        var v = h('span', { class: 'v' }), ns = range(n).map(function () { return h('i'); }), nt = h('span', { class: 'notes' }, ns);
        var lab = cfg.label ? cfg.label(i) : '';
        var b = h('button', { class: cls, 'aria-label': 'Row ' + (r + 1) + ', column ' + (c + 1) + (lab ? ', cage ' + lab : ''), onclick: function () { select(i); } }, [lab ? h('span', { class: 'cage', text: lab }) : null, v, nt]);
        cells.push({ el: b, v: v, nt: nt, ns: ns }); grid.appendChild(b);
      });
      ctx.board.appendChild(grid);
      range(n).forEach(function (d) { var b = h('button', { class: 'btn', text: String(d + 1), 'aria-label': 'Digit ' + (d + 1), onclick: function () { input(d + 1); } }); padBtns.push(b); ctx.pad.appendChild(b); });
      ctx.pad.appendChild(h('button', { class: 'btn wide', text: 'Erase', onclick: function () { input(0); } }));
      paint();
    },
    undo: function () {
      var r = hist.pop(); if (!r) return false;
      vals[r.i] = r.v; notes[r.i] = r.n; r.pn.forEach(function (p) { notes[p[0]] = p[1]; });
      delete wrong[r.i]; sel = r.i; paint(); return true;
    },
    hint: function () {
      var i, t = null;
      for (i = 0; i < N; i++) if (!giv[i] && vals[i] && vals[i] !== sol[i]) {
        hist.push({ i: i, v: vals[i], n: notes[i], pn: [] });
        var was = vals[i]; vals[i] = 0; delete wrong[i]; sel = i; ctx.hintUsed('clear ' + rc(n, i)); paint(); flash(cells[i].el, 'flash');
        ctx.msg('The ' + was + ' in ' + rcName(n, i) + ' was wrong, so it has been cleared.'); return;
      }
      if (cfg.logicHint) t = cfg.logicHint(vals);
      if (!t) {
        i = (sel >= 0 && !vals[sel]) ? sel : vals.indexOf(0);
        if (i < 0) return;
        t = { cell: i, digit: sol[i], why: 'revealed from the solution' };
      }
      hist.push({ i: t.cell, v: 0, n: notes[t.cell], pn: [] });
      vals[t.cell] = t.digit; notes[t.cell] = 0; sel = t.cell; ctx.hintUsed(rc(n, t.cell) + '=' + t.digit); paint(); flash(cells[t.cell].el, 'flash');
      ctx.msg('Placed ' + t.digit + ' in ' + rcName(n, t.cell) + ': ' + t.why + '.'); checkDone();
    },
    check: function () {
      var cnt = 0; wrong = {};
      for (var i = 0; i < N; i++) if (!giv[i] && vals[i] && vals[i] !== sol[i]) { wrong[i] = 1; cnt++; }
      ctx.checked(cnt); paint();
      ctx.msg(cnt ? cnt + (cnt === 1 ? ' wrong entry is marked.' : ' wrong entries are marked.') : 'No mistakes so far.', cnt ? 'bad' : 'good');
    },
    restart: function () { vals = giv.slice(); notes = new Array(N).fill(0); hist = []; wrong = {}; sel = -1; paint(); },
    toggleNotes: function () { notesMode = !notesMode; return notesMode; },
    key: function (e) {
      var k = e.key;
      if (/^[1-9]$/.test(k) && +k <= n) { input(+k); return true; }
      if (k === 'Backspace' || k === 'Delete' || k === '0') { input(0); return true; }
      if (k.indexOf('Arrow') === 0) {
        if (sel < 0) sel = 0;
        else if (k === 'ArrowUp' && sel >= n) sel -= n; else if (k === 'ArrowDown' && sel < N - n) sel += n;
        else if (k === 'ArrowLeft' && sel % n > 0) sel--; else if (k === 'ArrowRight' && sel % n < n - 1) sel++;
        paint(); return true;
      }
      return false;
    },
    state: function () { return { values: vals }; },
    solve: function () { vals = sol.slice(); paint(); checkDone(); }
  };
}
function sudokuView(ctx) {
  var p = ctx.puzzle, n = p.N, g = PT.sudGeom(n);
  ctx.goal('Fill every row, column and box with <b>1–' + n + '</b>.');
  return numGridView(ctx, {
    n: n, cls: 'sudoku', solution: p.solution, givens: p.givens, units: g.units,
    edgeR: function (i) { var c = i % n; return (c + 1) % p.bc === 0 && c < n - 1; },
    edgeB: function (i) { var r = Math.floor(i / n); return (r + 1) % p.br === 0 && r < n - 1; },
    logicHint: function (vals) { return PT.sudHint(n, vals); }
  });
}
function kenkenView(ctx) {
  var p = ctx.puzzle, n = p.n, cageOf = new Array(n * n), labels = {}, giv = new Array(n * n).fill(0), units = [];
  p.cages.forEach(function (c, k) {
    c.cells.forEach(function (x) { cageOf[x] = k; });
    labels[Math.min.apply(null, c.cells)] = c.target + (c.op === '=' ? '' : OPS[c.op]);
    if (c.op === '=') giv[c.cells[0]] = c.target;
  });
  range(n).forEach(function (r) { units.push(range(n).map(function (c) { return r * n + c; })); });
  range(n).forEach(function (c) { units.push(range(n).map(function (r) { return r * n + c; })); });
  ctx.goal('Digits <b>1–' + n + '</b>, no repeats in a row or column. Every cage must make its target.');
  return numGridView(ctx, {
    n: n, cls: 'kk', solution: p.solution, givens: giv, units: units,
    edgeR: function (i) { return i % n < n - 1 && cageOf[i] !== cageOf[i + 1]; },
    edgeB: function (i) { return i < n * n - n && cageOf[i] !== cageOf[i + n]; },
    label: function (i) { return labels[i] || ''; }
  });
}

function takuzuView(ctx) {
  var p = ctx.puzzle, n = p.n, N = n * n, sol = p.solution, giv = p.givens, vals = giv.slice(), hist = [], wrong = {}, sel = -1, cells = [];
  ctx.goal('Fill the grid with <b>0</b> and <b>1</b>. Each row and column needs <b>' + (n / 2) + '</b> of each.');
  function paint() {
    var bad = {}; PT.tkConflicts(n, vals).forEach(function (i) { bad[i] = 1; });
    cells.forEach(function (el, i) {
      var v = vals[i], cl = el.classList;
      el.firstChild.textContent = v < 0 ? '' : String(v);
      cl.toggle('zero', v === 0); cl.toggle('one', v === 1); cl.toggle('clash', !!bad[i] && giv[i] < 0); cl.toggle('wrong', !!wrong[i]); cl.toggle('sel', i === sel);
    });
  }
  function checkDone() {
    for (var i = 0; i < N; i++) if (vals[i] < 0) return;
    for (i = 0; i < N; i++) if (vals[i] !== sol[i]) { ctx.msg('The grid is full but breaks a rule. Check shows where.', 'bad'); return; }
    ctx.solved();
  }
  function set(i, v) {
    if (giv[i] >= 0 || vals[i] === v) return;
    hist.push([i, vals[i]]); vals[i] = v; delete wrong[i]; sel = i; ctx.move(rc(n, i) + '=' + (v < 0 ? 'clear' : v)); ctx.msg(''); paint(); if (v >= 0) checkDone();
  }
  return {
    tools: { undo: true, notes: false, hint: true, check: true, restart: true },
    mount: function () {
      var grid = h('div', { class: 'tk', style: '--n:' + n });
      range(N).forEach(function (i) {
        var b = h('button', { class: 'cell' + (giv[i] >= 0 ? ' given' : ''), 'aria-label': rcName(n, i), onclick: function () { var v = vals[i]; set(i, v < 0 ? 0 : v === 0 ? 1 : -1); } }, h('span', { class: 'v' }));
        cells.push(b); grid.appendChild(b);
      });
      ctx.board.appendChild(grid); paint();
    },
    undo: function () { var r = hist.pop(); if (!r) return false; vals[r[0]] = r[1]; delete wrong[r[0]]; sel = r[0]; paint(); return true; },
    hint: function () {
      var i;
      for (i = 0; i < N; i++) if (giv[i] < 0 && vals[i] >= 0 && vals[i] !== sol[i]) {
        hist.push([i, vals[i]]); vals[i] = -1; delete wrong[i]; sel = i; ctx.hintUsed('clear ' + rc(n, i)); paint(); flash(cells[i], 'flash');
        ctx.msg('The entry in ' + rcName(n, i) + ' was wrong, so it has been cleared.'); return;
      }
      var forced = PT.tkLogic(n, vals, 2).grid, pickI = -1, why = 'revealed from the solution';
      for (i = 0; i < N; i++) if (vals[i] < 0 && forced[i] >= 0) { pickI = i; why = 'the row and column rules force it'; break; }
      if (pickI < 0) pickI = vals.indexOf(-1);
      if (pickI < 0) return;
      hist.push([pickI, -1]); vals[pickI] = sol[pickI]; sel = pickI; ctx.hintUsed(rc(n, pickI) + '=' + sol[pickI]); paint(); flash(cells[pickI], 'flash');
      ctx.msg('Placed ' + sol[pickI] + ' in ' + rcName(n, pickI) + ': ' + why + '.'); checkDone();
    },
    check: function () {
      var cnt = 0; wrong = {};
      for (var i = 0; i < N; i++) if (giv[i] < 0 && vals[i] >= 0 && vals[i] !== sol[i]) { wrong[i] = 1; cnt++; }
      ctx.checked(cnt); paint();
      ctx.msg(cnt ? cnt + (cnt === 1 ? ' wrong entry is marked.' : ' wrong entries are marked.') : 'No mistakes so far.', cnt ? 'bad' : 'good');
    },
    restart: function () { vals = giv.slice(); hist = []; wrong = {}; sel = -1; paint(); },
    key: function (e) {
      var k = e.key;
      if (k.indexOf('Arrow') === 0) {
        if (sel < 0) sel = 0;
        else if (k === 'ArrowUp' && sel >= n) sel -= n; else if (k === 'ArrowDown' && sel < N - n) sel += n;
        else if (k === 'ArrowLeft' && sel % n > 0) sel--; else if (k === 'ArrowRight' && sel % n < n - 1) sel++;
        paint(); return true;
      }
      if (sel >= 0 && (k === '0' || k === '1')) { set(sel, +k); return true; }
      if (sel >= 0 && (k === 'Backspace' || k === 'Delete')) { set(sel, -1); return true; }
      return false;
    },
    state: function () { return { values: vals }; },
    solve: function () { vals = sol.slice(); paint(); checkDone(); }
  };
}

function nonogramView(ctx) {
  var p = ctx.puzzle, R = p.R, C = p.C, sol = p.solution, st = new Array(R * C).fill(-1), mode = 1, hist = [], wrong = {};
  var cells = [], rowCl = [], colCl = [], drag = null, modeBtns = [], grid;
  ctx.goal('Paint the picture. A clue like <b>3 1</b> means a run of three, a gap, then a run of one.');
  function eq(a, b) { if (a.length !== b.length) return false; for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; }
  function paintCell(i) { var cl = cells[i].classList; cl.toggle('fill', st[i] === 1); cl.toggle('x', st[i] === 0); cl.toggle('wrong', !!wrong[i]); }
  function paintClues() {
    var r, c, line;
    for (r = 0; r < R; r++) { line = []; for (c = 0; c < C; c++) line.push(st[r * C + c] === 1 ? 1 : 0); rowCl[r].classList.toggle('done', eq(PT.ngClues(line), p.rowClues[r])); }
    for (c = 0; c < C; c++) { line = []; for (r = 0; r < R; r++) line.push(st[r * C + c] === 1 ? 1 : 0); colCl[c].classList.toggle('done', eq(PT.ngClues(line), p.colClues[c])); }
  }
  function paint() { for (var i = 0; i < R * C; i++) paintCell(i); paintClues(); }
  function checkDone() { for (var i = 0; i < R * C; i++) if ((st[i] === 1) !== (sol[i] === 1)) return; ctx.solved(); }
  function apply(i) { if (!drag || st[i] === drag.target) return; st[i] = drag.target; delete wrong[i]; drag.count++; paintCell(i); }
  function endDrag() {
    if (!drag) return; var d = drag; drag = null;
    if (d.count) { hist.push(d.snap); ctx.move((d.target === 1 ? 'fill ' : d.target === 0 ? 'cross ' : 'clear ') + d.count); ctx.msg(''); paintClues(); checkDone(); }
  }
  function startDrag(i) { drag = { target: st[i] === mode ? -1 : mode, snap: st.slice(), count: 0 }; apply(i); }
  function setMode(m) { mode = m; modeBtns.forEach(function (b, k) { b.classList.toggle('on', (k === 0 ? 1 : 0) === mode); }); }
  return {
    tools: { undo: true, notes: false, hint: true, check: true, restart: true },
    mount: function () {
      grid = h('div', { class: 'nono', style: '--n:' + C });
      grid.appendChild(h('div'));
      range(C).forEach(function (c) { var e = h('div', { class: 'cl col' }, (p.colClues[c].length ? p.colClues[c] : [0]).map(function (x) { return h('span', { text: String(x) }); })); colCl.push(e); grid.appendChild(e); });
      range(R).forEach(function (r) {
        var e = h('div', { class: 'cl row' }, (p.rowClues[r].length ? p.rowClues[r] : [0]).map(function (x) { return h('span', { text: String(x) }); })); rowCl.push(e); grid.appendChild(e);
        range(C).forEach(function (c) {
          var i = r * C + c, cls = 'cell';
          if (c === 0) cls += ' c0'; if (r === 0) cls += ' r0'; if ((c + 1) % 5 === 0 || c === C - 1) cls += ' e5c'; if ((r + 1) % 5 === 0 || r === R - 1) cls += ' e5r';
          var b = h('button', { class: cls, 'data-i': i, 'aria-label': rcName(C, i) });
          b.addEventListener('click', function (ev) { if (ev.detail === 0) { startDrag(i); endDrag(); } });
          cells.push(b); grid.appendChild(b);
        });
      });
      grid.addEventListener('pointerdown', function (ev) {
        var t = ev.target.closest('.cell'); if (!t) return;
        ev.preventDefault(); startDrag(+t.getAttribute('data-i'));
      });
      grid.addEventListener('pointermove', function (ev) {
        if (!drag) return;
        var t = document.elementFromPoint(ev.clientX, ev.clientY); t = t && t.closest ? t.closest('.nono .cell') : null;
        if (t) apply(+t.getAttribute('data-i'));
      });
      window.addEventListener('pointerup', endDrag); window.addEventListener('pointercancel', endDrag);
      ctx.board.appendChild(grid);
      ['Fill', 'Cross'].forEach(function (name, k) { var b = h('button', { class: 'btn wide', text: name, onclick: function () { setMode(k === 0 ? 1 : 0); } }); modeBtns.push(b); ctx.pad.appendChild(b); });
      setMode(1); paint();
    },
    unmount: function () { window.removeEventListener('pointerup', endDrag); window.removeEventListener('pointercancel', endDrag); },
    undo: function () { var s = hist.pop(); if (!s) return false; st = s; wrong = {}; paint(); return true; },
    hint: function () {
      var i, r, c, fixes = [];
      for (i = 0; i < R * C; i++) if ((st[i] === 1 && sol[i] === 0) || (st[i] === 0 && sol[i] === 1)) {
        hist.push(st.slice()); st[i] = sol[i]; delete wrong[i]; ctx.hintUsed('fix ' + rc(C, i)); paint(); flash(cells[i], 'flash');
        ctx.msg('One wrong cell in ' + rcName(C, i) + ' has been corrected.'); checkDone(); return;
      }
      var best = null;
      for (r = 0; r < R; r++) { var u = []; for (c = 0; c < C; c++) if (st[r * C + c] < 0) u.push(r * C + c); if (!best || u.length > best.u.length) best = { u: u, name: 'row ' + (r + 1) }; }
      for (c = 0; c < C; c++) { var u2 = []; for (r = 0; r < R; r++) if (st[r * C + c] < 0) u2.push(r * C + c); if (u2.length > best.u.length) best = { u: u2, name: 'column ' + (c + 1) }; }
      if (!best.u.length) return;
      fixes = best.u.slice(0, Math.max(1, Math.ceil(C / 3)));
      hist.push(st.slice()); fixes.forEach(function (x) { st[x] = sol[x]; });
      ctx.hintUsed('reveal ' + fixes.length + ' in ' + best.name); paint(); fixes.forEach(function (x) { flash(cells[x], 'flash'); });
      ctx.msg('Revealed ' + fixes.length + (fixes.length === 1 ? ' cell' : ' cells') + ' in ' + best.name + '.'); checkDone();
    },
    check: function () {
      var cnt = 0; wrong = {};
      for (var i = 0; i < R * C; i++) if ((st[i] === 1 && sol[i] === 0) || (st[i] === 0 && sol[i] === 1)) { wrong[i] = 1; cnt++; }
      ctx.checked(cnt); paint();
      ctx.msg(cnt ? cnt + (cnt === 1 ? ' wrong cell is marked.' : ' wrong cells are marked.') : 'No mistakes so far.', cnt ? 'bad' : 'good');
    },
    restart: function () { st = new Array(R * C).fill(-1); hist = []; wrong = {}; paint(); },
    key: function () { return false; },
    state: function () { return { cells: st }; },
    solve: function () { st = sol.map(function (v) { return v ? 1 : -1; }); paint(); checkDone(); }
  };
}

function mazeView(ctx) {
  var p = ctx.puzzle, R = p.R, C = p.C, data = p.cells, target = p.target, path = [0], els = [], line, goalIdx = R * C - 1;
  function totalAt(len) { var t = data[0].v; for (var k = 1; k < len; k++) t = PT.mmApply(t, data[path[k]]); return t; }
  function adj(a, b) { var ar = Math.floor(a / C), ac = a % C, br = Math.floor(b / C), bc = b % C; return Math.abs(ar - br) + Math.abs(ac - bc) === 1; }
  function paint() {
    var head = path[path.length - 1], inPath = {}; path.forEach(function (x) { inPath[x] = 1; });
    els.forEach(function (el, i) {
      var cl = el.classList;
      cl.toggle('on', !!inPath[i] && i !== head); cl.toggle('head', i === head); cl.toggle('next', !inPath[i] && adj(head, i));
    });
    line.setAttribute('points', path.map(function (x) { return (x % C + 0.5) + ',' + (Math.floor(x / C) + 0.5); }).join(' '));
    ctx.goal('Reach Finish on exactly <b>' + target + '</b>. Running total <b>' + totalAt(path.length) + '</b> after <b>' + (path.length - 1) + '</b> steps.');
  }
  function step(i) {
    var idx = path.indexOf(i);
    if (idx >= 0) { if (idx < path.length - 1) { path.length = idx + 1; ctx.undoUsed('back to ' + rc(C, i)); ctx.msg(''); paint(); } return; }
    var head = path[path.length - 1];
    if (!adj(head, i)) { ctx.msg('Pick a cell next to your current position.'); return; }
    var cur = totalAt(path.length), t = PT.mmApply(cur, data[i]);
    if (t === null) { ctx.msg(cur + ' does not divide evenly by ' + data[i].v + ', so that step is blocked.', 'bad'); return; }
    path.push(i); ctx.move(rc(C, i) + ' total ' + t); ctx.msg(''); paint();
    if (i === goalIdx) {
      if (t === target) ctx.solved();
      else { ctx.mistake(1); ctx.msg('You finished on ' + t + ' but need ' + target + '. Step back and try another route.', 'bad'); }
    }
  }
  return {
    tools: { undo: true, notes: false, hint: true, check: false, restart: true },
    mount: function () {
      var grid = h('div', { class: 'maze', style: '--c:' + C });
      data.forEach(function (cell, i) {
        var txt = cell.op === 's' ? String(cell.v) : OPS[cell.op] + cell.v, tag = i === 0 ? 'Start' : i === goalIdx ? 'Finish' : '';
        var b = h('button', { class: 'cell' + (i === goalIdx ? ' end' : ''), 'aria-label': rcName(C, i) + ', ' + (cell.op === 's' ? 'start at ' + cell.v : txt) + (tag === 'Finish' ? ', finish' : ''), onclick: function () { step(i); } }, [tag ? h('small', { text: tag }) : null, h('span', { text: txt })]);
        els.push(b); grid.appendChild(b);
      });
      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 ' + C + ' ' + R); svg.setAttribute('preserveAspectRatio', 'none');
      line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline'); svg.appendChild(line); grid.appendChild(svg);
      ctx.board.appendChild(grid); paint();
    },
    undo: function () { if (path.length < 2) return false; path.pop(); paint(); return true; },
    hint: function () {
      var s = p.solution, k = 0;
      while (k < path.length && k < s.length && path[k] === s[k]) k++;
      var cut = path.length > k;
      if (cut) path.length = k;
      if (k >= s.length) return;
      path.push(s[k]); ctx.hintUsed('step ' + rc(C, s[k]));
      ctx.msg(cut ? 'Your route left a working one, so it was backed up and moved one step along it.' : 'Moved one step along a route that works.'); paint();
      if (s[k] === goalIdx) ctx.solved();
    },
    restart: function () { path = [0]; paint(); },
    key: function (e) {
      var head = path[path.length - 1], r = Math.floor(head / C), c = head % C, t = -1;
      if (e.key === 'ArrowUp' && r > 0) t = head - C; else if (e.key === 'ArrowDown' && r < R - 1) t = head + C;
      else if (e.key === 'ArrowLeft' && c > 0) t = head - 1; else if (e.key === 'ArrowRight' && c < C - 1) t = head + 1;
      if (t >= 0) { step(t); return true; }
      return false;
    },
    state: function () { return { path: path, total: totalAt(path.length) }; },
    solve: function () { path = [0]; p.solution.slice(1).forEach(function (x) { if (!ctx.isDone()) step(x); }); }
  };
}

function slidingView(ctx) {
  var p = ctx.puzzle, n = p.n, N = n * n, tiles = p.tiles.slice(), hist = [], els = {}, opt = ctx.optimal;
  function solved() { for (var i = 0; i < N - 1; i++) if (tiles[i] !== i + 1) return false; return true; }
  function place() {
    tiles.forEach(function (v, i) {
      if (!v) return;
      els[v].style.transform = 'translate(' + (i % n) * 100 + '%,' + Math.floor(i / n) * 100 + '%)';
      els[v].classList.toggle('home', i === v - 1);
    });
    ctx.goal('Order the tiles <b>1–' + (N - 1) + '</b> with the gap last. Moves <b>' + ctx.moves() + '</b>' + (opt ? ', shortest possible <b>' + opt + '</b>.' : '.'));
  }
  function swap(pos, record) { var z = tiles.indexOf(0); tiles[z] = tiles[pos]; tiles[pos] = 0; if (record) { hist.push(z); ctx.move('tile ' + tiles[z]); } }
  function tap(v) {
    var pos = tiles.indexOf(v), z = tiles.indexOf(0), pr = Math.floor(pos / n), pc = pos % n, zr = Math.floor(z / n), zc = z % n, stepBy;
    if (pr === zr && pc !== zc) stepBy = pc > zc ? 1 : -1; else if (pc === zc && pr !== zr) stepBy = pr > zr ? n : -n;
    else { ctx.msg('That tile is not in line with the gap.'); return; }
    while (tiles.indexOf(0) !== pos) swap(tiles.indexOf(0) + stepBy, true);
    ctx.msg(''); place(); if (solved()) ctx.solved();
  }
  return {
    tools: { undo: true, notes: false, hint: true, check: false, restart: true },
    mount: function () {
      var wrap = h('div', { class: 'slide', style: '--n:' + n });
      for (var v = 1; v < N; v++) (function (v) { els[v] = h('button', { class: 'tile', 'aria-label': 'Tile ' + v, onclick: function () { tap(v); } }, h('span', { text: String(v) })); wrap.appendChild(els[v]); })(v);
      ctx.board.appendChild(wrap); place();
    },
    undo: function () { var z = hist.pop(); if (z === undefined) return false; swap(z, false); place(); return true; },
    hint: function () {
      var z = tiles.indexOf(0), zr = Math.floor(z / n), zc = z % n, v;
      if (n === 3) {
        var cur = PT.slide3Dist(tiles), mv = [], best = -1;
        if (zr > 0) mv.push(z - 3); if (zr < 2) mv.push(z + 3); if (zc > 0) mv.push(z - 1); if (zc < 2) mv.push(z + 1);
        mv.forEach(function (m) { var t = tiles.slice(); t[z] = t[m]; t[m] = 0; if (PT.slide3Dist(t) === cur - 1) best = m; });
        if (best < 0) return;
        v = tiles[best]; ctx.hintUsed('tile ' + v); flash(els[v], 'pulse');
        ctx.msg('Slide tile ' + v + '. The shortest finish from here is ' + cur + (cur === 1 ? ' move.' : ' moves.'));
      } else {
        for (var i = 0; i < N - 1; i++) if (tiles[i] !== i + 1) { v = i + 1; break; }
        if (!v) return;
        ctx.hintUsed('focus tile ' + v); flash(els[v], 'pulse');
        ctx.msg('Work on tile ' + v + ' next. Fill the top row, then the left column, and solve the last block at the end.');
      }
    },
    restart: function () { tiles = p.tiles.slice(); hist = []; place(); },
    key: function (e) {
      var z = tiles.indexOf(0), zr = Math.floor(z / n), zc = z % n, src = -1;
      if (e.key === 'ArrowUp' && zr < n - 1) src = z + n; else if (e.key === 'ArrowDown' && zr > 0) src = z - n;
      else if (e.key === 'ArrowLeft' && zc < n - 1) src = z + 1; else if (e.key === 'ArrowRight' && zc > 0) src = z - 1;
      if (src >= 0) { tap(tiles[src]); return true; }
      return false;
    },
    state: function () { return { tiles: tiles }; },
    solve: function () {
      if (n !== 3) { tiles = range(N).map(function (i) { return (i + 1) % N; }); var t = tiles[N - 2]; tiles[N - 2] = 0; tiles[N - 1] = t; place(); tap(t); return; }
      var guard = 0;
      while (!solved() && guard++ < 40) {
        var z = tiles.indexOf(0), zr = Math.floor(z / 3), zc = z % 3, cur = PT.slide3Dist(tiles), mv = [], best = -1;
        if (zr > 0) mv.push(z - 3); if (zr < 2) mv.push(z + 3); if (zc > 0) mv.push(z - 1); if (zc < 2) mv.push(z + 1);
        mv.forEach(function (m) { var t2 = tiles.slice(); t2[z] = t2[m]; t2[m] = 0; if (PT.slide3Dist(t2) === cur - 1) best = m; });
        tap(tiles[best]);
      }
    }
  };
}

function lightsView(ctx) {
  var p = ctx.puzzle, n = p.n, N = n * n, lit = p.lit.slice(), hist = [], els = [], opt = ctx.optimal;
  function flip(i) {
    var r = Math.floor(i / n), c = i % n;
    lit[i] ^= 1; if (r > 0) lit[i - n] ^= 1; if (r < n - 1) lit[i + n] ^= 1; if (c > 0) lit[i - 1] ^= 1; if (c < n - 1) lit[i + 1] ^= 1;
  }
  function paint() {
    var on = 0;
    els.forEach(function (el, i) { el.classList.toggle('lit', !!lit[i]); el.setAttribute('aria-pressed', lit[i] ? 'true' : 'false'); if (lit[i]) on++; });
    ctx.goal('Turn every light off. <b>' + on + '</b> still on. Presses <b>' + ctx.moves() + '</b>, fewest possible <b>' + opt + '</b>.');
  }
  function press(i) { flip(i); hist.push(i); ctx.move('press ' + rc(n, i)); ctx.msg(''); paint(); if (lit.indexOf(1) < 0) ctx.solved(); }
  return {
    tools: { undo: true, notes: false, hint: true, check: false, restart: true },
    mount: function () {
      var grid = h('div', { class: 'lights', style: '--n:' + n });
      range(N).forEach(function (i) { var b = h('button', { class: 'lamp', 'aria-label': 'Light at ' + rcName(n, i), onclick: function () { press(i); } }); els.push(b); grid.appendChild(b); });
      ctx.board.appendChild(grid); paint();
    },
    undo: function () { var i = hist.pop(); if (i === undefined) return false; flip(i); paint(); return true; },
    hint: function () {
      var s = PT.lightsSolve(n, lit); if (!s) return;
      var i = s.indexOf(1), w = s.reduce(function (a, b) { return a + b; }, 0); if (i < 0) return;
      ctx.hintUsed('press ' + rc(n, i)); flash(els[i], 'pulse');
      ctx.msg('Press the highlighted light. ' + w + (w === 1 ? ' press finishes' : ' presses finish') + ' it from here.');
    },
    restart: function () { lit = p.lit.slice(); hist = []; paint(); },
    key: function () { return false; },
    state: function () { return { lit: lit }; },
    solve: function () { var s = PT.lightsSolve(n, lit); s.forEach(function (v, i) { if (v && !ctx.isDone()) press(i); }); }
  };
}

function ballsortView(ctx) {
  var p = ctx.puzzle, hh = p.h, tubes = p.tubes.map(function (t) { return t.slice(); }), sel = -1, hist = [], els = [];
  ctx.goal('Sort the balls so each tube holds <b>' + hh + '</b> of one colour.');
  function paint() {
    tubes.forEach(function (t, j) {
      var el = els[j]; el.textContent = '';
      t.forEach(function (c) { el.appendChild(h('span', { class: 'ball', style: 'background:var(--b' + c + ')', text: String(c + 1) })); });
      var full = t.length === hh && t.every(function (v) { return v === t[0]; });
      el.classList.toggle('sel', j === sel); el.classList.toggle('done', full);
      el.setAttribute('aria-label', 'Tube ' + (j + 1) + ': ' + (t.length ? t.map(function (c) { return c + 1; }).join(', ') + ' from bottom to top' : 'empty'));
    });
  }
  function click(j) {
    if (sel < 0) { if (tubes[j].length) { sel = j; paint(); } return; }
    if (sel === j) { sel = -1; paint(); return; }
    var src = tubes[sel], dst = tubes[j], ball = src[src.length - 1];
    if (dst.length < hh && (!dst.length || dst[dst.length - 1] === ball)) {
      dst.push(src.pop()); hist.push([sel, j]); ctx.move('tube ' + (sel + 1) + ' to ' + (j + 1)); sel = -1; ctx.msg(''); paint();
      if (PT.bsDone(tubes, hh)) ctx.solved();
    } else {
      ctx.msg(dst.length >= hh ? 'That tube is full.' : 'A ball can only land on the same colour or in an empty tube.');
      sel = tubes[j].length ? j : -1; paint();
    }
  }
  return {
    tools: { undo: true, notes: false, hint: true, check: false, restart: true },
    mount: function () {
      var wrap = h('div', { class: 'tubes', style: '--h:' + hh });
      tubes.forEach(function (t, j) { var b = h('button', { class: 'tube', onclick: function () { click(j); } }); els.push(b); wrap.appendChild(b); });
      ctx.board.appendChild(wrap); paint();
    },
    undo: function () { var m = hist.pop(); if (!m) return false; tubes[m[0]].push(tubes[m[1]].pop()); sel = -1; paint(); return true; },
    hint: function () {
      var s = PT.bsSolve(tubes, hh, 40000);
      if (!s) { ctx.msg('There is no way to finish from this position. Undo a few moves or restart.', 'bad'); return; }
      if (!s.length) return;
      ctx.hintUsed('tube ' + (s[0][0] + 1) + ' to ' + (s[0][1] + 1)); sel = -1; paint(); flash(els[s[0][0]], 'pulse'); flash(els[s[0][1]], 'pulse');
      ctx.msg('Move the top ball of tube ' + (s[0][0] + 1) + ' to tube ' + (s[0][1] + 1) + '.');
    },
    restart: function () { tubes = p.tubes.map(function (t) { return t.slice(); }); hist = []; sel = -1; paint(); },
    key: function () { return false; },
    state: function () { return { tubes: tubes }; },
    solve: function () { var s = PT.bsSolve(tubes, hh, 200000); sel = -1; s.forEach(function (m) { if (!ctx.isDone()) { click(m[0]); click(m[1]); } }); }
  };
}

function mastermindView(ctx) {
  var p = ctx.puzzle, code = p.code, P = p.pegs, rows = [], cur = new Array(P).fill(-1), locked = {}, wrap, over = false;
  function pegEl(c, opts) {
    opts = opts || {};
    return h(opts.click ? 'button' : 'span', { class: 'peg' + (c >= 0 ? ' set' : '') + (opts.locked ? ' locked' : ''), style: c >= 0 ? 'background:var(--b' + c + ')' : null, text: c >= 0 ? String(c + 1) : '', 'aria-label': opts.label, onclick: opts.click });
  }
  function render() {
    wrap.textContent = '';
    for (var k = 0; k < p.guesses; k++) {
      if (k < rows.length) {
        var rw = rows[k];
        wrap.appendChild(h('div', { class: 'mm-row' }, [h('span', { class: 'ix', text: String(k + 1) }), h('div', { class: 'mm-pegs' }, rw.g.map(function (c) { return pegEl(c); })), h('span', { class: 'mm-fb', html: '<b>' + rw.fb[0] + '</b> exact<br><b>' + rw.fb[1] + '</b> misplaced' })]));
      } else if (k === rows.length && !over) {
        wrap.appendChild(h('div', { class: 'mm-row cur' }, [h('span', { class: 'ix', text: String(k + 1) }), h('div', { class: 'mm-pegs' }, cur.map(function (c, i) {
          return pegEl(c, { locked: locked[i], label: 'Slot ' + (i + 1) + (c >= 0 ? ', colour ' + (c + 1) : ', empty'), click: function () { if (!locked[i] && cur[i] >= 0) { cur[i] = -1; render(); } } });
        })), h('span', { class: 'mm-fb', text: 'your guess' })]));
      } else {
        wrap.appendChild(h('div', { class: 'mm-row empty' }, [h('span', { class: 'ix', text: String(k + 1) }), h('div', { class: 'mm-pegs' }, range(P).map(function () { return pegEl(-1); })), h('span')]));
      }
    }
    ctx.goal('Find the <b>' + P + '</b>-peg code from <b>' + p.colors + '</b> colours. ' + (p.dups ? 'Colours can repeat.' : 'No colour repeats.') + ' Guess <b>' + Math.min(rows.length + 1, p.guesses) + '</b> of <b>' + p.guesses + '</b>.');
  }
  function add(c) {
    var i = cur.indexOf(-1);
    if (i < 0) { ctx.msg('The row is full. Submit it, or select a peg to clear it.'); return; }
    if (!p.dups && cur.indexOf(c) >= 0) { ctx.msg('No colour repeats at this level.'); return; }
    cur[i] = c; ctx.msg(''); render();
  }
  function submit() {
    if (cur.indexOf(-1) >= 0) { ctx.msg('Fill every slot before submitting.'); return; }
    var fb = PT.mmScore(code, cur);
    rows.push({ g: cur.slice(), fb: fb }); ctx.move('guess ' + cur.map(function (c) { return c + 1; }).join('') + ' -> ' + fb[0] + ' exact, ' + fb[1] + ' misplaced');
    if (fb[0] === P) { over = true; render(); ctx.solved(); return; }
    if (rows.length >= p.guesses) { over = true; render(); ctx.failed('Out of guesses. The code was ' + code.map(function (c) { return c + 1; }).join(' ') + '.'); return; }
    cur = cur.map(function (c, i) { return locked[i] ? code[i] : -1; }); ctx.msg(''); render();
  }
  return {
    tools: { undo: true, notes: false, hint: true, check: false, restart: false },
    mount: function () {
      wrap = h('div', { class: 'mm' }); ctx.board.appendChild(wrap);
      range(p.colors).forEach(function (c) { ctx.pad.appendChild(h('button', { class: 'peg set', style: 'background:var(--b' + c + ')', text: String(c + 1), 'aria-label': 'Colour ' + (c + 1), onclick: function () { add(c); } })); });
      ctx.pad.appendChild(h('button', { class: 'btn wide primary', text: 'Submit guess', id: 'mm-submit', onclick: submit }));
      render();
    },
    undo: function () { for (var i = P - 1; i >= 0; i--) if (cur[i] >= 0 && !locked[i]) { cur[i] = -1; render(); return true; } return false; },
    hint: function () {
      var open = range(P).filter(function (i) { return !locked[i]; }); if (open.length <= 1) { ctx.msg('Only one slot is left unrevealed. That one is yours to find.'); return; }
      var i = open[0];
      if (!p.dups) cur = cur.map(function (c, k) { return (k !== i && c === code[i] && !locked[k]) ? -1 : c; });
      locked[i] = true; cur[i] = code[i]; ctx.hintUsed('slot ' + (i + 1)); render();
      ctx.msg('Slot ' + (i + 1) + ' is colour ' + (code[i] + 1) + '. It stays locked in.');
    },
    restart: function () {},
    key: function (e) {
      if (/^[1-9]$/.test(e.key) && +e.key <= p.colors) { add(+e.key - 1); return true; }
      if (e.key === 'Enter') { submit(); return true; }
      if (e.key === 'Backspace') { this.undo(); return true; }
      return false;
    },
    state: function () { return { guesses: rows.map(function (r) { return { guess: r.g, exact: r.fb[0], misplaced: r.fb[1] }; }) }; },
    solve: function () { cur = code.slice(); submit(); }
  };
}
function crossmathView(ctx) {
  var p = ctx.puzzle, n = p.n, N = n * n, sol = p.solution, giv = p.givens, vals = giv.slice(), sel = -1, hist = [], wrong = {};
  var cells = [], rowEl = [], colEl = [], padBtns = [], lastKey = 0;
  ctx.goal('Place <b>1–' + N + '</b> once each so every row and column works out. Multiply and divide before you add and subtract.');
  function line(isRow, k) { var a = []; for (var j = 0; j < n; j++) a.push(vals[isRow ? k * n + j : j * n + k]); return a; }
  function paint() {
    var cnt = {}, i, k;
    for (i = 0; i < N; i++) if (vals[i]) cnt[vals[i]] = (cnt[vals[i]] || 0) + 1;
    cells.forEach(function (c, i) {
      var v = vals[i], cl = c.classList;
      c.firstChild.textContent = v || '';
      cl.toggle('sel', i === sel); cl.toggle('clash', !!v && cnt[v] > 1); cl.toggle('wrong', !!wrong[i]);
    });
    for (k = 0; k < n; k++) [[rowEl, 1, p.rowOps, p.rowRes], [colEl, 0, p.colOps, p.colRes]].forEach(function (d) {
      var nums = line(d[1], k), full = nums.indexOf(0) < 0, ok = full && PT.cmEval(nums, d[2][k]) === d[3][k];
      d[0][k].classList.toggle('ok', ok); d[0][k].classList.toggle('bad', full && !ok);
    });
    padBtns.forEach(function (b, d) { b.classList.toggle('done', !!cnt[d + 1]); });
  }
  function checkDone() {
    for (var i = 0; i < N; i++) if (!vals[i]) return;
    for (i = 0; i < N; i++) if (vals[i] !== sol[i]) { ctx.msg('Every cell is filled but some lines are off. The crossed-out results show which.', 'bad'); return; }
    ctx.solved();
  }
  function input(d) {
    if (sel < 0) { ctx.msg('Select a cell first.'); return; }
    var i = sel; if (giv[i] || vals[i] === d) return;
    hist.push([i, vals[i]]); vals[i] = d; delete wrong[i]; ctx.move(rc(n, i) + '=' + (d || 'clear')); ctx.msg(''); paint(); if (d) checkDone();
  }
  return {
    tools: { undo: true, notes: false, hint: true, check: true, restart: true },
    mount: function () {
      var g = 2 * n + 1, grid = h('div', { class: 'cm', style: '--n:' + g }), R, C;
      for (R = 0; R < g; R++) for (C = 0; C < g; C++) (function (R, C) {
        var r = R >> 1, c = C >> 1, e;
        if (R % 2 === 0 && R < 2 * n && C % 2 === 0 && C < 2 * n) {
          var i = r * n + c;
          e = h('button', { class: 'cell' + (giv[i] ? ' given' : ''), 'aria-label': rcName(n, i), onclick: function () { sel = i; paint(); } }, h('span', { class: 'v' }));
          cells[i] = e;
        } else if (R % 2 === 0 && R < 2 * n && C < 2 * n - 1) e = h('div', { class: 'cm-op', text: OPS[p.rowOps[r][c]] });
        else if (R % 2 === 0 && R < 2 * n && C === 2 * n - 1) e = h('div', { class: 'cm-op', text: '=' });
        else if (R % 2 === 0 && R < 2 * n) { e = h('div', { class: 'cm-res', text: String(p.rowRes[r]).replace('-', '−'), 'aria-label': 'Row ' + (r + 1) + ' equals ' + p.rowRes[r] }); rowEl[r] = e; }
        else if (R % 2 === 1 && R < 2 * n - 1 && C % 2 === 0 && C < 2 * n) e = h('div', { class: 'cm-op', text: OPS[p.colOps[c][r]] });
        else if (R === 2 * n - 1 && C % 2 === 0 && C < 2 * n) e = h('div', { class: 'cm-op', text: '=' });
        else if (R === 2 * n && C % 2 === 0 && C < 2 * n) { e = h('div', { class: 'cm-res', text: String(p.colRes[c]).replace('-', '−'), 'aria-label': 'Column ' + (c + 1) + ' equals ' + p.colRes[c] }); colEl[c] = e; }
        else e = h('div', { 'aria-hidden': 'true' });
        grid.appendChild(e);
      })(R, C);
      ctx.board.appendChild(grid);
      range(N).forEach(function (d) { var b = h('button', { class: 'btn', text: String(d + 1), 'aria-label': 'Number ' + (d + 1), onclick: function () { input(d + 1); } }); padBtns.push(b); ctx.pad.appendChild(b); });
      ctx.pad.appendChild(h('button', { class: 'btn wide', text: 'Erase', onclick: function () { input(0); } }));
      paint();
    },
    undo: function () { var r = hist.pop(); if (!r) return false; vals[r[0]] = r[1]; delete wrong[r[0]]; sel = r[0]; paint(); return true; },
    hint: function () {
      var i;
      for (i = 0; i < N; i++) if (!giv[i] && vals[i] && vals[i] !== sol[i]) {
        hist.push([i, vals[i]]); var was = vals[i]; vals[i] = 0; delete wrong[i]; sel = i; ctx.hintUsed('clear ' + rc(n, i)); paint(); flash(cells[i], 'flash');
        ctx.msg('The ' + was + ' in ' + rcName(n, i) + ' was wrong, so it has been cleared.'); return;
      }
      i = (sel >= 0 && !vals[sel]) ? sel : vals.indexOf(0);
      if (i < 0) return;
      hist.push([i, 0]); vals[i] = sol[i]; sel = i; ctx.hintUsed(rc(n, i) + '=' + sol[i]); paint(); flash(cells[i], 'flash');
      ctx.msg('Placed ' + sol[i] + ' in ' + rcName(n, i) + ', revealed from the solution.'); checkDone();
    },
    check: function () {
      var cnt = 0; wrong = {};
      for (var i = 0; i < N; i++) if (!giv[i] && vals[i] && vals[i] !== sol[i]) { wrong[i] = 1; cnt++; }
      ctx.checked(cnt); paint();
      ctx.msg(cnt ? cnt + (cnt === 1 ? ' wrong entry is marked.' : ' wrong entries are marked.') : 'No mistakes so far.', cnt ? 'bad' : 'good');
    },
    restart: function () { vals = giv.slice(); hist = []; wrong = {}; sel = -1; paint(); },
    key: function (e) {
      var k = e.key, now = Date.now();
      if (/^[0-9]$/.test(k)) {
        var d = +k, prev = sel >= 0 ? vals[sel] : 0;
        if (N > 9 && prev === 1 && now - lastKey < 1200 && 10 + d <= N && !giv[sel]) { lastKey = 0; input(10 + d); return true; }
        if (d >= 1 && d <= N) { lastKey = now; input(d); return true; }
        if (d === 0) { input(0); return true; }
        return false;
      }
      if (k === 'Backspace' || k === 'Delete') { input(0); return true; }
      if (k.indexOf('Arrow') === 0) {
        if (sel < 0) sel = 0;
        else if (k === 'ArrowUp' && sel >= n) sel -= n; else if (k === 'ArrowDown' && sel < N - n) sel += n;
        else if (k === 'ArrowLeft' && sel % n > 0) sel--; else if (k === 'ArrowRight' && sel % n < n - 1) sel++;
        paint(); return true;
      }
      return false;
    },
    state: function () { return { values: vals }; },
    solve: function () { vals = sol.slice(); paint(); checkDone(); }
  };
}
var VIEWS = { sudoku: sudokuView, kenken: kenkenView, crossmath: crossmathView, mathmaze: mazeView, sliding: slidingView, lights: lightsView, ballsort: ballsortView, nonogram: nonogramView, takuzu: takuzuView, mastermind: mastermindView };

/* ================= play flow ================= */
var tick = null;
function setMsg(text, kind) { var e = $('#p-msg'); e.textContent = text || ''; e.setAttribute('data-kind', kind || ''); }
function setGoal(html) { $('#p-goal').innerHTML = html; }
function show(screen) {
  S.screen = screen;
  ['hub', 'play', 'log', 'stats'].forEach(function (s) { $('#s-' + s).hidden = s !== screen; });
  ['hub', 'log', 'stats'].forEach(function (s) { $('#nav-' + s).classList.toggle('on', s === screen || (screen === 'play' && s === 'hub')); });
  window.scrollTo(0, 0);
}
function startPuzzle(type, level) {
  if (!S.ready || S.cur) return;
  var track = PT.TYPES[type].track, meta = PUZ[type];
  var seed = type + ':' + level + ':' + Date.now().toString(36) + Math.floor(Math.random() * 1679616).toString(36);
  var sec = $('#s-play'); sec.setAttribute('data-track', track);
  $('#p-name').textContent = meta.name; $('#p-level').textContent = 'Level ' + level;
  $('#board').textContent = ''; $('#pad').textContent = ''; setMsg(''); setGoal(''); $('#timer').textContent = '0:00';
  $('#cooking').hidden = false; $('#paused').hidden = true; $('#leave-bar').hidden = true;
  var rules = $('#p-rules'); rules.textContent = ''; meta.rules.forEach(function (r) { rules.appendChild(h('li', { text: r })); });
  ['undo', 'notes', 'hint', 'check', 'restart'].forEach(function (t) { $('#t-' + t).disabled = true; });
  $('#btn-pause').disabled = true;
  var cur = S.cur = { loading: true, type: type, level: level };
  show('play');
  generateAsync(type, level, seed).then(function (gen) {
    if (S.cur !== cur) return;
    var timer = new Timer(), c = { moves: 0, mistakes: 0, undos: 0, hints: 0, checks: 0, restarts: 0 }, events = [];
    function log(t, payload) { if (events.length < 600) events.push(Math.round(timer.ms()) + '|' + t + '|' + (payload == null ? '' : payload)); }
    var att = {
      attempt_id: 'a' + Date.now().toString(36) + Math.floor(Math.random() * 46656).toString(36),
      player_id: Store.uid || 'local', track: track, puzzle_type: type, puzzle_name: meta.name, level: level, seed: seed,
      generator_version: gen.generator_version, params_json: JSON.stringify(gen.params), puzzle_json: JSON.stringify(gen.puzzle),
      difficulty_score: gen.difficulty, difficulty_label: gen.difficulty_label, optimal_moves: gen.optimal,
      started_at: nowIso(), ended_at: null, active_ms: 0, wall_ms: 0, pause_count: 0, paused_ms: 0, outcome: 'in_progress',
      move_count: 0, mistake_count: 0, undo_count: 0, hints_used: 0, check_count: 0, restart_count: 0,
      final_state_json: null, stars: 0, score: 0, par_ms: null, counts_for_gate: false, player_level_at_start: S.level,
      app_version: APP_VERSION, device: (navigator.userAgent || '').slice(0, 160), events: []
    };
    cur.loading = false; cur.gen = gen; cur.timer = timer; cur.c = c; cur.events = events; cur.attempt = att; cur.wall0 = Date.now(); cur.log = log; cur.done = false;
    var ctx = {
      puzzle: gen.puzzle, optimal: gen.optimal, board: $('#board'), pad: $('#pad'),
      move: function (d) { c.moves++; log('move', d); },
      mistake: function (k) { c.mistakes += (k || 1); log('mistake', k || 1); },
      hintUsed: function (d) { c.hints++; log('hint', d); },
      undoUsed: function (d) { c.undos++; log('undo', d); },
      checked: function (k) { c.checks++; c.mistakes += k; log('check', k + ' wrong'); },
      moves: function () { return c.moves; }, isDone: function () { return cur.done; },
      msg: setMsg, goal: setGoal, log: log,
      solved: function () { finish('solved'); }, failed: function (text) { finish('failed', text); }
    };
    cur.view = VIEWS[type](ctx);
    cur.view.mount();
    var tl = cur.view.tools;
    ['undo', 'notes', 'hint', 'check', 'restart'].forEach(function (t) { var b = $('#t-' + t); b.disabled = !tl[t]; b.hidden = !tl[t]; });
    $('#t-notes').classList.remove('on'); $('#btn-pause').disabled = false; $('#cooking').hidden = true;
    S.attempts.unshift(att); Store.save(att);
    log('start', gen.difficulty_label);
    timer.start();
    tick = setInterval(function () { $('#timer').textContent = fmtTime(timer.ms()); }, 250);
  });
}
function snapshot(cur) {
  var a = cur.attempt, c = cur.c, t = cur.timer;
  a.active_ms = Math.round(t.ms()); a.wall_ms = Date.now() - cur.wall0; a.pause_count = t.pauses; a.paused_ms = Math.round(t.pausedMs());
  a.move_count = c.moves; a.mistake_count = c.mistakes; a.undo_count = c.undos; a.hints_used = c.hints; a.check_count = c.checks; a.restart_count = c.restarts;
  a.final_state_json = JSON.stringify(cur.view.state()); a.events = cur.events.slice();
}
function pauseGame(auto) {
  var cur = S.cur; if (!cur || cur.loading || cur.done || !cur.timer.running()) return;
  cur.timer.pause(); cur.log('pause', auto ? 'tab hidden' : 'button');
  $('#paused').hidden = false; $('#btn-pause').textContent = 'Resume';
  snapshot(cur); Store.save(cur.attempt);
}
function resumeGame() {
  var cur = S.cur; if (!cur || cur.loading || cur.done || cur.timer.running()) return;
  cur.timer.start(); cur.log('resume', ''); $('#paused').hidden = true; $('#btn-pause').textContent = 'Pause';
}
function teardown() {
  var cur = S.cur; if (tick) { clearInterval(tick); tick = null; }
  if (cur && cur.view && cur.view.unmount) cur.view.unmount();
  S.cur = null; $('#btn-pause').textContent = 'Pause';
}
function finish(outcome, text) {
  var cur = S.cur; if (!cur || cur.loading || cur.done) return;
  cur.done = true; cur.timer.pause(false); cur.log('end', outcome);
  var a = cur.attempt, c = cur.c, before = S.level;
  snapshot(cur);
  var ms = a.active_ms, par = parMs(a.puzzle_type, a.level, a.attempt_id), stars = 0;
  if (outcome === 'solved') {
    stars = 1;
    if (c.hints === 0 || (c.hints <= 1 && ms <= par * 2)) stars = 2;
    if (c.hints === 0 && c.mistakes <= 1 && ms <= par * 1.25) stars = 3;
  }
  a.ended_at = nowIso(); a.outcome = outcome; a.stars = stars; a.par_ms = Math.round(par);
  a.counts_for_gate = outcome === 'solved' && c.hints <= 1;
  a.score = outcome === 'solved' ? Math.max(0, a.level * 100 + stars * 50 - c.hints * 25 - c.mistakes * 5) : 0;
  Store.save(a);
  var after = computeLevel(), leveled = after > before;
  if (leveled) {
    S.level = after; S.progress.level = after; S.progress.unlocked[String(after)] = a.ended_at; Store.saveProgress(S.progress);
  }
  if (outcome !== 'abandoned') showResult(cur, text, leveled, before);
  if (tick) { clearInterval(tick); tick = null; }
  $('#timer').textContent = fmtTime(ms);
}
function leave() {
  var cur = S.cur;
  if (cur && !cur.loading && !cur.done) finish('abandoned');
  teardown(); $('#result').hidden = true; renderHub(); show('hub');
}
function starSvg(on) { return '<svg viewBox="0 0 24 24"' + (on ? ' class="on"' : '') + ' aria-hidden="true"><path d="M12 2.6l2.9 6 6.5.9-4.7 4.6 1.1 6.5-5.8-3.1-5.8 3.1 1.1-6.5L2.6 9.5l6.5-.9z"/></svg>'; }
function showResult(cur, text, leveled, before) {
  var a = cur.attempt, meta = PUZ[a.puzzle_type], solved = a.outcome === 'solved', box = $('#result');
  var g = gateFor(before)[a.track], gate;
  if (!solved) gate = 'This attempt is logged as failed and does not move your lane.';
  else if (a.level < before) gate = 'Practice at Level ' + a.level + '. Only solves at Level ' + before + ' move your lanes.';
  else if (!a.counts_for_gate) gate = 'Solved, but with more than one hint, so it does not count toward the next level.';
  else if (leveled) gate = 'That finished the last lane at Level ' + before + '.';
  else if (before >= MAX_LEVEL) gate = 'You are at the top level. Every solve here is for the record.';
  else if (g.n >= NEED && !g.clean) gate = '<strong>' + TRACK[a.track].name + ' lane: ' + NEED + ' of ' + NEED + '</strong>, but it still needs one solve without hints.';
  else gate = '<strong>' + TRACK[a.track].name + ' lane: ' + Math.min(g.n, NEED) + ' of ' + NEED + '</strong> toward Level ' + (before + 1) + '.' + (laneDone(g) ? ' This lane is finished.' : '');
  var cell = function (k, v) { return h('div', null, [h('dt', { text: k }), h('dd', { text: String(v) })]); };
  var card = h('div', { class: 'card', 'data-track': a.track, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'res-title' }, [
    h('div', null, [h('p', { class: 'eyebrow', text: meta.name + ' · Level ' + a.level }), h('h2', { id: 'res-title', text: solved ? 'Solved in ' + fmtTime(a.active_ms) : 'Not this time' })]),
    solved ? h('div', { class: 'stars', role: 'img', 'aria-label': a.stars + ' of 3 stars', html: starSvg(a.stars >= 1) + starSvg(a.stars >= 2) + starSvg(a.stars >= 3) }) : h('p', { text: text || '' }),
    h('dl', { class: 'rgrid', style: 'margin:0' }, [
      cell('Time', fmtTime(a.active_ms)), cell('Moves', a.optimal_moves ? a.move_count + ' / ' + a.optimal_moves : a.move_count), cell('Mistakes', a.mistake_count),
      cell('Hints', a.hints_used), cell('Undos', a.undo_count), cell('Pauses', a.pause_count)
    ]),
    solved ? h('p', { class: 'levelnote', text: 'Three stars need no hints, one mistake at most, and a time within ' + fmtTime(a.par_ms * 1.25) + '.' }) : null,
    leveled ? h('div', { class: 'levelup', text: 'Level ' + S.level + ' unlocked' }) : null,
    h('div', { class: 'gate', html: gate }),
    h('div', { class: 'row' }, [
      h('button', { class: 'btn primary', id: 'res-again', text: leveled ? 'Play Level ' + S.level : 'Another ' + meta.name, onclick: function () {
        var type = a.puzzle_type, lv = a.level; if (leveled) { S.playLevel = S.level; lv = S.level; }
        teardown(); box.hidden = true; renderHub(); startPuzzle(type, lv);
      } }),
      h('button', { class: 'btn', id: 'res-home', text: 'Back to lanes', onclick: function () { if (leveled) S.playLevel = S.level; leave(); } })
    ])
  ]);
  box.textContent = ''; box.appendChild(card); box.hidden = false;
  var f = $('#res-again'); if (f) f.focus();
}

/* ================= hub ================= */
function renderHub() {
  var L = S.level, g = gateFor(L), top = L >= MAX_LEVEL;
  $('#hero-eyebrow').textContent = S.ready ? 'Level ' + L + ' of ' + MAX_LEVEL : 'Loading your progress';
  $('#hero-title').textContent = top ? 'Top level reached. Every lane is open.' : 'Finish two puzzles in every lane to reach Level ' + (L + 1);
  var lanes = $('#lanes'); lanes.textContent = '';
  lanes.setAttribute('role', 'group'); lanes.setAttribute('aria-label', 'Progress toward the next level');
  TRACKS.forEach(function (t) {
    var x = g[t.id], n = Math.min(x.n, NEED), done = laneDone(x), pp = done ? 1 : (n >= NEED ? 0.75 : n / NEED);
    var note = done ? 'lane finished' : n >= NEED ? 'needs a hint-free solve' : 'solved at Level ' + L;
    lanes.appendChild(h('div', { class: 'lane', 'data-track': t.id, style: '--p:' + pp }, [
      h('span', { class: 'lane-no', text: String(t.lane), 'aria-hidden': 'true' }),
      h('span', { class: 'lane-name', text: t.name }),
      h('span', { class: 'lane-run', 'aria-hidden': 'true' }, [h('i', { class: 'lane-fill' }), h('i', { class: 'pip p1' + (n >= 1 ? ' on' : '') }), h('i', { class: 'pip p2' + (done ? ' on' : '') }), h('i', { class: 'runner' })]),
      h('span', { class: 'lane-count' }, [h('b', { text: n + ' of ' + NEED + ' ' }), note])
    ]));
  });
  var lv = $('#levels'); lv.textContent = '';
  for (var k = 1; k <= MAX_LEVEL; k++) (function (k) {
    lv.appendChild(h('button', { class: 'lv' + (k === S.playLevel ? ' on' : '') + (k === L ? ' cur' : ''), text: String(k), disabled: k > L || !S.ready, 'aria-pressed': k === S.playLevel ? 'true' : 'false', 'aria-label': 'Level ' + k + (k > L ? ', locked' : ''), onclick: function () { S.playLevel = k; renderHub(); } }));
  })(k);
  $('#lv-note').textContent = !S.ready ? '' : S.playLevel < L ? 'Practice level. Solves here are logged but do not move the lanes.' : 'Your current level. Solves here move the lanes.';
  var box = $('#tracks'); box.textContent = '';
  TRACKS.forEach(function (t) {
    var col = h('div', { class: 'track', 'data-track': t.id }, [
      h('div', { class: 'track-head' }, [h('h2', { text: t.name }), h('span', { class: 'lane-tag', text: 'Lane ' + t.lane })]),
      h('p', { class: 'track-blurb', text: t.blurb })
    ]);
    TYPE_ORDER[t.id].forEach(function (type) {
      var m = PUZ[type], mine = S.attempts.filter(function (a) { return a.puzzle_type === type && a.level === S.playLevel && a.outcome === 'solved'; });
      var best = mine.length ? Math.min.apply(null, mine.map(function (a) { return a.active_ms; })) : null;
      col.appendChild(h('button', { class: 'pz', disabled: !S.ready, 'data-type': type, onclick: function () { startPuzzle(type, S.playLevel); } }, [
        h('span', { class: 'pz-icon', html: m.icon }),
        h('span', { class: 'pz-name', text: m.name }),
        h('span', { class: 'pz-meta', text: mine.length ? mine.length + ' solved · best ' + fmtTime(best) : 'Not solved at Level ' + S.playLevel + ' yet' }),
        h('span', { class: 'pz-desc', text: m.desc })
      ]));
    });
    box.appendChild(col);
  });
}

/* ================= attempt log ================= */
var LOG_COLS = [
  ['When', function (a) { return new Date(a.started_at).toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }],
  ['Puzzle', null], ['Lvl', function (a) { return a.level; }, 1], ['Result', null],
  ['Time', function (a) { return fmtTime(a.active_ms); }, 1], ['Moves', function (a) { return a.move_count; }, 1], ['Mistakes', function (a) { return a.mistake_count; }, 1],
  ['Hints', function (a) { return a.hints_used; }, 1], ['Undos', function (a) { return a.undo_count; }, 1], ['Pauses', function (a) { return a.pause_count; }, 1],
  ['Stars', function (a) { return a.outcome === 'solved' ? a.stars : '-'; }, 1], ['Counts', function (a) { return a.counts_for_gate ? 'Yes' : 'No'; }]
];
function renderLog() {
  var ft = $('#f-track').value, fo = $('#f-outcome').value, box = $('#log-table'); box.textContent = '';
  var rows = S.attempts.filter(function (a) { return (!ft || a.track === ft) && (!fo || a.outcome === fo); });
  $('#log-sub').textContent = S.attempts.length ? rows.length + ' of ' + S.attempts.length + ' attempts shown. Select a row for the full record.' : 'Every attempt is recorded here, solved or not.';
  if (!rows.length) {
    box.appendChild(h('div', { class: 'empty' }, [h('b', { text: S.attempts.length ? 'No attempts match these filters' : 'No attempts yet' }), S.attempts.length ? 'Change the lane or result filter to see more.' : 'Play a puzzle and it appears here with its time, moves, mistakes, hints and the exact puzzle you were given.']));
    return;
  }
  var tb = h('tbody');
  rows.forEach(function (a) {
    var tr = h('tr', { 'data-track': a.track, tabindex: '0', class: S.openRow === a.attempt_id ? 'open' : '' }, LOG_COLS.map(function (c) {
      if (c[0] === 'Puzzle') return h('td', null, [h('span', { class: 'dot' }), a.puzzle_name || a.puzzle_type]);
      if (c[0] === 'Result') return h('td', null, h('span', { class: 'pill ' + a.outcome, text: a.outcome === 'in_progress' ? 'in progress' : a.outcome }));
      return h('td', { class: c[2] ? 'num' : '', text: String(c[1](a)) });
    }));
    var toggle = function () { S.openRow = S.openRow === a.attempt_id ? null : a.attempt_id; renderLog(); };
    tr.addEventListener('click', toggle); tr.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
    tb.appendChild(tr);
    if (S.openRow === a.attempt_id) {
      var item = function (k, v, cls) { return h('div', { class: cls || '' }, [h('div', { class: 'k', text: k }), h('div', { class: 'v' + (cls === 'full' ? ' scroll' : ''), text: v == null || v === '' ? '-' : String(v) })]); };
      tb.appendChild(h('tr', { class: 'detail' }, h('td', { colspan: String(LOG_COLS.length) }, h('div', { class: 'dl' }, [
        item('Attempt id', a.attempt_id), item('Lane', TRACK[a.track] ? TRACK[a.track].name : a.track), item('Seed', a.seed), item('Generator', a.generator_version),
        item('Difficulty', a.difficulty_label), item('Started', a.started_at), item('Ended', a.ended_at), item('Active time', fmtTime(a.active_ms) + ' (' + a.active_ms + ' ms)'),
        item('Wall time', fmtTime(a.wall_ms)), item('Paused', a.pause_count + (a.pause_count === 1 ? ' time, ' : ' times, ') + fmtTime(a.paused_ms)), item('Par time', fmtTime(a.par_ms)),
        item('Moves / shortest', a.move_count + ' / ' + (a.optimal_moves == null ? 'n/a' : a.optimal_moves)), item('Checks', a.check_count), item('Restarts', a.restart_count),
        item('Score', a.score), item('Level when played', a.player_level_at_start), item('App version', a.app_version),
        item('Generator settings', a.params_json, 'full'), item('Puzzle as dealt', a.puzzle_json, 'full'), item('Final state', a.final_state_json, 'full'),
        item('Event log (ms | event | detail)', (a.events || []).join('\n'), 'full')
      ]))));
    }
  });
  box.appendChild(h('table', null, [h('thead', null, h('tr', null, LOG_COLS.map(function (c) { return h('th', { class: c[2] ? 'num' : '', text: c[0] }); }))), tb]));
}
var CSV_FIELDS = ['attempt_id', 'player_id', 'track', 'puzzle_type', 'puzzle_name', 'level', 'seed', 'generator_version', 'difficulty_score', 'difficulty_label', 'started_at', 'ended_at', 'active_ms', 'wall_ms', 'pause_count', 'paused_ms', 'outcome', 'move_count', 'optimal_moves', 'mistake_count', 'undo_count', 'hints_used', 'check_count', 'restart_count', 'stars', 'score', 'par_ms', 'counts_for_gate', 'player_level_at_start', 'app_version', 'device', 'params_json', 'puzzle_json', 'final_state_json', 'events'];
function toCsv(rows) {
  var esc = function (v) { if (v == null) return ''; if (Array.isArray(v)) v = v.join(' ; '); v = String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  return [CSV_FIELDS.join(',')].concat(rows.map(function (a) { return CSV_FIELDS.map(function (f) { return esc(a[f]); }).join(','); })).join('\n');
}
function exportCsv() {
  if (!S.attempts.length) { setSave('Nothing to export yet. Play a puzzle first.', ''); return; }
  var csv = toCsv(S.attempts), name = 'puzzle-triathlon-attempts.csv';
  var fallback = function () { $('#csv-fallback').hidden = false; var t = $('#csv-text'); t.value = csv; t.focus(); t.select(); };
  if (window.claude && typeof window.claude.use === 'function') {
    window.claude.use('downloads').then(function (dl) {
      if (!dl) return fallback();
      return dl.save({ filename: name, data: csv }).then(function () { setSave('Exported ' + S.attempts.length + ' attempts as CSV', 'ok'); }, function (e) { if (!e || e.code !== 'declined') fallback(); });
    }).catch(fallback);
    return;
  }
  try {
    var a = h('a', { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: name });
    document.body.appendChild(a); a.click(); a.remove();
  } catch (e) { fallback(); }
}

/* ================= stats ================= */
function renderStats() {
  var box = $('#stats-body'); box.textContent = '';
  var all = S.attempts.filter(function (a) { return a.outcome !== 'in_progress'; });
  if (!all.length) { box.appendChild(h('div', { class: 'tablewrap' }, h('div', { class: 'empty' }, [h('b', { text: 'No stats yet' }), 'Finish or leave a puzzle and your solve rate, times and hint use show up here, split by lane and level.']))); return; }
  var solved = all.filter(function (a) { return a.outcome === 'solved'; });
  var atL = solved.filter(function (a) { return a.level === S.level; });
  var tile = function (k, big, hint) { return h('div', { class: 'tilestat' }, [h('span', { class: 'k', text: k }), h('span', { class: 'big', text: big }), h('span', { class: 'hint', text: hint })]); };
  box.appendChild(h('div', { class: 'tiles' }, [
    tile('Attempts', String(all.length), solved.length + ' solved, ' + all.filter(function (a) { return a.outcome === 'abandoned'; }).length + ' abandoned, ' + all.filter(function (a) { return a.outcome === 'failed'; }).length + ' failed'),
    tile('Solve rate', pct(solved.length, all.length), 'Around 85% is a good sign the level fits'),
    tile('Median solve time', atL.length ? fmtTime(median(atL.map(function (a) { return a.active_ms; }))) : '-', 'At your current level, Level ' + S.level),
    tile('Hint-free solves', pct(solved.filter(function (a) { return !a.hints_used; }).length, solved.length), 'Share of solves with no hint')
  ]));
  /* lane x level matrix */
  var levels = range(S.level).map(function (i) { return i + 1; });
  var head = h('tr', null, [h('th', { text: 'Lane' })].concat(levels.map(function (l) { return h('th', { text: 'L' + l }); })));
  var body = h('tbody', null, TRACKS.map(function (t) {
    return h('tr', { 'data-track': t.id }, [h('td', null, [h('span', { class: 'dot' }), t.name])].concat(levels.map(function (l) {
      var xs = all.filter(function (a) { return a.track === t.id && a.level === l; }), sv2 = xs.filter(function (a) { return a.outcome === 'solved'; });
      if (!xs.length) return h('td', { class: 'hc s0', text: '·', title: t.name + ', Level ' + l + ': no attempts' });
      var rate = sv2.length / xs.length, cls = rate >= 0.85 ? 's4' : rate >= 0.6 ? 's3' : rate >= 0.3 ? 's2' : 's1';
      var med = sv2.length ? fmtTime(median(sv2.map(function (a) { return a.active_ms; }))) : 'none solved';
      return h('td', { class: 'hc ' + cls, title: t.name + ', Level ' + l + ': ' + sv2.length + ' solved of ' + xs.length + ' attempts, median ' + med }, [sv2.length + '/' + xs.length, h('small', { text: med })]);
    })));
  }));
  box.appendChild(h('div', { class: 'panel' }, [
    h('h2', { text: 'Solves by lane and level' }),
    h('p', { text: 'Each cell shows solved over attempted, with the median solve time under it. Darker cells have a higher solve rate.' }),
    h('div', { class: 'tablewrap' }, h('table', { class: 'heat' }, [h('thead', null, head), body])),
    h('div', { class: 'legend' }, ['Solve rate', h('i', { class: 'hc s1' }), 'under 30%', h('i', { class: 'hc s2' }), '30–59%', h('i', { class: 'hc s3' }), '60–84%', h('i', { class: 'hc s4' }), '85% and up'])
  ]));
  /* per puzzle table */
  var prow = [];
  TRACKS.forEach(function (t) { TYPE_ORDER[t.id].forEach(function (type) {
    var xs = all.filter(function (a) { return a.puzzle_type === type; }); if (!xs.length) return;
    var s2 = xs.filter(function (a) { return a.outcome === 'solved'; }), times = s2.map(function (a) { return a.active_ms; });
    var hints = s2.reduce(function (acc, a) { return acc + (a.hints_used || 0); }, 0);
    prow.push(h('tr', { 'data-track': t.id }, [
      h('td', null, [h('span', { class: 'dot' }), PUZ[type].name]), h('td', { class: 'num', text: String(xs.length) }), h('td', { class: 'num', text: pct(s2.length, xs.length) }),
      h('td', { class: 'num', text: times.length ? fmtTime(median(times)) : '-' }), h('td', { class: 'num', text: times.length ? fmtTime(Math.min.apply(null, times)) : '-' }),
      h('td', { class: 'num', text: s2.length ? (hints / s2.length).toFixed(1) : '-' }), h('td', { class: 'num', text: pct(xs.filter(function (a) { return a.outcome === 'abandoned'; }).length, xs.length) })
    ]));
  }); });
  box.appendChild(h('div', { class: 'panel' }, [
    h('h2', { text: 'By puzzle' }),
    h('div', { class: 'tablewrap' }, h('table', { class: 'heat' }, [h('thead', null, h('tr', null, ['Puzzle', 'Attempts', 'Solve rate', 'Median time', 'Best time', 'Hints per solve', 'Abandoned'].map(function (x, i) { return h('th', { class: i ? 'num' : '', text: x }); }))), h('tbody', null, prow)]))
  ]));
  /* level timeline */
  var ul = S.progress.unlocked || {}, keys = Object.keys(ul).map(Number).sort(function (a, b) { return a - b; });
  if (keys.length) {
    box.appendChild(h('div', { class: 'panel' }, [
      h('h2', { text: 'Level-ups' }),
      h('div', { class: 'tablewrap' }, h('table', { class: 'heat' }, [h('thead', null, h('tr', null, [h('th', { text: 'Level' }), h('th', { text: 'Unlocked' }), h('th', { class: 'num', text: 'Attempts at the level before' })])), h('tbody', null, keys.map(function (k) {
        return h('tr', null, [h('td', { text: 'Level ' + k }), h('td', { text: new Date(ul[k]).toLocaleString() }), h('td', { class: 'num', text: String(all.filter(function (a) { return a.level === k - 1; }).length) })]);
      }))]))
    ]));
  }
}

/* ================= wiring ================= */
function nav(to) {
  if (S.cur && !S.cur.done && S.screen === 'play' && to !== 'play') { $('#leave-bar').hidden = false; S.pendingNav = to; return; }
  if (S.cur && S.cur.done) { teardown(); $('#result').hidden = true; }
  if (to === 'hub') renderHub(); if (to === 'log') renderLog(); if (to === 'stats') renderStats();
  show(to);
}
document.addEventListener('click', function (e) { var b = e.target.closest('[data-nav]'); if (b) nav(b.getAttribute('data-nav')); });
$('#btn-back').addEventListener('click', function () { if (S.cur && S.cur.loading) { teardown(); show('hub'); return; } S.pendingNav = 'hub'; $('#leave-bar').hidden = false; });
$('#btn-leave-no').addEventListener('click', function () { $('#leave-bar').hidden = true; });
$('#btn-leave-yes').addEventListener('click', function () { var to = S.pendingNav || 'hub'; leave(); if (to !== 'hub') nav(to); });
$('#btn-pause').addEventListener('click', function () { var c = S.cur; if (!c || c.loading) return; if (c.timer.running()) pauseGame(false); else resumeGame(); });
$('#btn-resume').addEventListener('click', resumeGame);
document.addEventListener('visibilitychange', function () { if (document.hidden) pauseGame(true); });
function live() { var c = S.cur; return c && !c.loading && !c.done && c.timer.running() ? c : null; }
$('#t-undo').addEventListener('click', function () { var c = live(); if (c && c.view.undo()) { c.c.undos++; c.log('undo', ''); setMsg(''); } });
$('#t-hint').addEventListener('click', function () { var c = live(); if (c) c.view.hint(); });
$('#t-check').addEventListener('click', function () { var c = live(); if (c) c.view.check(); });
$('#t-notes').addEventListener('click', function () { var c = live(); if (c && c.view.toggleNotes) this.classList.toggle('on', c.view.toggleNotes()); });
$('#t-restart').addEventListener('click', function () { var c = live(); if (c) { c.view.restart(); c.c.restarts++; c.log('restart', ''); setMsg('Board reset. The clock keeps running.'); } });
document.addEventListener('keydown', function (e) {
  var c = live(); if (!c || S.screen !== 'play' || e.metaKey || e.ctrlKey || e.altKey) return;
  var tag = (e.target.tagName || '').toLowerCase(); if (tag === 'select' || tag === 'textarea' || tag === 'input') return;
  if (e.key === 'p' || e.key === 'P') { pauseGame(false); e.preventDefault(); return; }
  if (e.key === 'z' || e.key === 'Z') { $('#t-undo').click(); e.preventDefault(); return; }
  if (e.key === 'h' || e.key === 'H') { $('#t-hint').click(); e.preventDefault(); return; }
  if ((e.key === 'n' || e.key === 'N') && c.view.toggleNotes) { $('#t-notes').click(); e.preventDefault(); return; }
  if (e.key === 'Enter' && tag === 'button' && c.type !== 'mastermind') return;
  if (c.view.key(e)) e.preventDefault();
});
$('#f-track').addEventListener('change', renderLog); $('#f-outcome').addEventListener('change', renderLog);
$('#btn-csv').addEventListener('click', exportCsv);

/* ================= boot ================= */
renderHub();
Store.init().then(function () { return Store.load(); }).then(function (data) {
  S.attempts = data.attempts || [];
  if (data.progress && data.progress.level) S.progress = { level: data.progress.level, unlocked: data.progress.unlocked || {} };
  S.attempts.forEach(function (a) {
    if (a.outcome === 'in_progress') { a.outcome = 'abandoned'; a.ended_at = a.ended_at || a.started_at; a.counts_for_gate = false; if (Store.mode === 'db') Store.save(a); }
  });
  S.level = computeLevel(); S.playLevel = S.level; S.ready = true;
  if (Store.mode === 'db') setSave('Attempts are saved to your own database in Claude', 'ok');
  else { Store.saveLocal(); setSave(Store.broken ? 'The database could not be reached. Attempts are saved in this browser.' : 'Attempts are saved in this browser', Store.broken ? 'warn' : 'ok'); }
  renderHub();
});
window.__pt = { S: S, Store: Store, startPuzzle: startPuzzle, finish: finish };
})();
