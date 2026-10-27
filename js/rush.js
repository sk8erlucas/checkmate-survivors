/* =========================================================================
 * Checkmate Survivors - rush.js
 * Mate Rush: a bonus node of the run map. Solve as many mate-in-one puzzles
 * as you can before the timer runs out; every mate pays coins and a wrong
 * move costs 10 seconds. Positions are generated at random and verified by
 * the engine, so they never run out.
 * ====================================================================== */
(function (root) {
'use strict';
const C = root.Chess, UI = root.UI;
const T = (k, v) => root.I18N.t(k, v), h = UI.h;
const RUSH = { timeMs: 60000, penaltyMs: 10000 };
const rnd = n => Math.floor(Math.random() * n);

// ---------------------------------------------------------------- generator
// Attacking sets grow with the level; defenders add noise and false leads.
const SETS = [['q'], ['r', 'r'], ['q', 'n'], ['r', 'b'], ['q', 'b'], ['r', 'n'], ['r', 'b', 'n'], ['q', 'r'], ['b', 'b', 'n', 'r']];
function fenOf(board) {
  let s = '';
  for (let r = 7; r >= 0; r--) {
    let e = 0;
    for (let f = 0; f < 8; f++) {
      const p = board[r * 8 + f];
      if (!p) { e++; continue; }
      if (e) { s += e; e = 0; }
      const ch = C.PIECE_CHARS[(p & 7) - 1];
      s += (p >> 3) === C.WHITE ? ch.toUpperCase() : ch;
    }
    if (e) s += e;
    if (r) s += '/';
  }
  return s + ' w - - 0 1';
}
const TYPE = { p: C.PAWN, n: C.KNIGHT, b: C.BISHOP, r: C.ROOK, q: C.QUEEN };
function mates(pos) {
  const out = [];
  for (const m of pos.legal()) { pos.make(m); const st = pos.gameStatus(); pos.unmake(); if (st.over && st.result === 'checkmate') out.push(m); }
  return out;
}
function generate(level) {
  const set = SETS[Math.min(SETS.length - 1, Math.floor(level / 2) + rnd(3))];
  const defenders = Math.min(5, Math.floor(level / 3) + rnd(2));
  for (let tries = 0; tries < 4000; tries++) {
    const b = new Array(64).fill(0), free = () => { let s; do s = rnd(64); while (b[s]); return s; };
    // the black king usually sits near an edge, where mates exist
    const bk = rnd(10) < 7 ? [rnd(8) + 56, rnd(8) * 8, rnd(8) * 8 + 7, rnd(8)][rnd(4)] : free();
    b[bk] = C.mk(C.KING, C.BLACK);
    let wk; do wk = free(); while (Math.abs((wk & 7) - (bk & 7)) <= 1 && Math.abs((wk >> 3) - (bk >> 3)) <= 1);
    b[wk] = C.mk(C.KING, C.WHITE);
    for (const k of set) b[free()] = C.mk(TYPE[k], C.WHITE);
    for (let i = 0; i < defenders; i++) {
      const k = 'ppnbr'[rnd(5)], sq = free();
      if (k === 'p' && ((sq >> 3) === 0 || (sq >> 3) === 7)) continue;
      b[sq] = C.mk(TYPE[k], C.BLACK);
    }
    const pos = C.Position.fromFEN(fenOf(b));
    if (pos.inCheck(C.BLACK) || pos.inCheck(C.WHITE) || pos.gameStatus().over) continue;
    const ms = mates(pos);
    if (ms.length >= 1 && ms.length <= (level < 6 ? 3 : 1)) return { fen: fenOf(b), solutions: ms.length };
  }
  return { fen: '6k1/5ppp/8/8/8/8/5PPP/4Q1K1 w - - 0 1', solutions: 1 };   // fallback: a known mate in one
}

// ---------------------------------------------------------------- bonus round
// opts: { level, perMate (coins), timeMs, header (element shown above the board), onDone(score, coins) }
const state = { score: 0, left: 0, last: 0, timer: null, match: null, over: true, opts: null };
const coins = () => state.score * state.opts.perMate;
function fmt(ms) { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
function bar() {
  return h('div', { class: 'rush-bar panel' },
    h('div', { class: 'rush-title' }, T('rush.title')),
    state.elTime = h('div', { class: 'clock rush-clock' }, fmt(state.left)),
    h('div', { class: 'rush-score' }, T('rush.score') + ' ', h('b', null, state.score)),
    h('div', { class: 'rush-score' }, h('img', { class: 'icon coin', src: root.Sprites.iconURL('coin', '#f0d060'), alt: '' }), ' ', h('b', null, '+' + coins())),
    h('div', { class: 'muted small' }, T('rush.per', { c: state.opts.perMate })),
    h('button', { class: 'btn small danger', onclick: () => finish() }, T('rush.stop')));
}
function tick() {
  const now = performance.now();
  state.left -= now - state.last; state.last = now;
  if (state.elTime) { state.elTime.textContent = fmt(state.left); state.elTime.classList.toggle('low', state.left < 15000); }
  if (state.left <= 0) finish();
}
function next() {
  if (state.over) return;
  if (state.match) { state.match.destroy(); state.match = null; }
  const pz = generate(state.opts.level + state.score);
  const screen = h('div', { class: 'screen match-screen rush' }, state.opts.header ? state.opts.header() : null, bar());
  UI.screen(screen);
  const m = state.match = new root.Match({
    fen: pz.fen, playerColor: C.WHITE, enemy: { id: 'rival', style: 'balanced', tier: 'easy' },
    objective: { type: 'mateIn', n: 1 }, time: { playerMs: 36e5, enemyMs: 36e5, playerInc: 0, enemyInc: 0 },
    items: [], relics: [], music: 'rush', note: T('rush.note'),
    onEnd: res => {
      if (state.over) return;
      if (res.win) { state.score++; UI.sfx('coin'); }
      else { state.left -= RUSH.penaltyMs; UI.toast(T('rush.miss'), 'bad'); }
      next();
    },
  });
  m.mount(screen);
  m.begin();
}
function start(opts) {
  Object.assign(state, { opts: Object.assign({ level: 0, perMate: 5, timeMs: RUSH.timeMs }, opts), score: 0, over: false, last: performance.now() });
  state.left = state.opts.timeMs;
  clearInterval(state.timer); state.timer = setInterval(tick, 100);
  UI.sfx('click');
  next();
}
function finish() {
  if (state.over) return;
  state.over = true; clearInterval(state.timer);
  if (state.match) { state.match.destroy(); state.match = null; }
  UI.music(null); UI.sfx(state.score ? 'win' : 'lose');
  state.opts.onDone(state.score, coins());
}

const api = { start, finish, generate, state, RUSH };
root.Rush = api;
})(window);
