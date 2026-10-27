/* =========================================================================
 * Checkmate Survivors - rush.js
 * Mate Rush: a quick mode. Solve as many mate-in-one puzzles as you can in
 * 3 minutes. Positions are generated at random and verified by the engine;
 * a wrong move costs 10 seconds. The score turns into Crowns.
 * ====================================================================== */
(function (root) {
'use strict';
const C = root.Chess, UI = root.UI, D = root.Data, SP = root.Sprites;
const T = (k, v) => root.I18N.t(k, v), h = UI.h;
const RUSH = { timeMs: 180000, penaltyMs: 10000 };
const rnd = n => Math.floor(Math.random() * n);

// ---------------------------------------------------------------- generator
// Attacking sets grow with the score; defenders add noise and false leads.
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

// ---------------------------------------------------------------- mode
const state = { score: 0, left: 0, last: 0, timer: null, match: null, over: false };
function header() {
  return h('div', { class: 'rush-bar panel' },
    h('div', { class: 'rush-title' }, T('rush.title')),
    state.elTime = h('div', { class: 'clock rush-clock' }),
    h('div', { class: 'rush-score' }, T('rush.score') + ' ', state.elScore = h('b', null, state.score)),
    h('div', { class: 'muted small' }, T('rush.best', { n: (root.CS.meta.stats.rushBest || 0) })),
    h('button', { class: 'btn small', onclick: UI.fullscreen }, T('ui.fullscreen')),
    h('button', { class: 'btn small danger', onclick: () => finish() }, T('rush.stop')));
}
function fmt(ms) { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
function tick() {
  const now = performance.now();
  if (!state.match || !state.match.paused) state.left -= now - state.last;
  state.last = now;
  if (state.elTime) { state.elTime.textContent = fmt(state.left); state.elTime.classList.toggle('low', state.left < 20000); }
  if (state.left <= 0) finish();
}
function next() {
  if (state.over) return;
  if (state.match) { state.match.destroy(); state.match = null; }
  const pz = generate(state.score);
  const screen = h('div', { class: 'screen match-screen rush' }, header());
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
function start() {
  UI.sfx('click');
  Object.assign(state, { score: 0, left: RUSH.timeMs, last: performance.now(), over: false });
  clearInterval(state.timer); state.timer = setInterval(tick, 100);
  next();
}
// 1 Crown per solved mate, +5 for a new personal best
function finish() {
  if (state.over) return;
  state.over = true; clearInterval(state.timer);
  if (state.match) { state.match.destroy(); state.match = null; }
  const meta = root.CS.meta, best = meta.stats.rushBest || 0, record = state.score > best;
  const crowns = state.score + (record && state.score > 0 ? 5 : 0);
  meta.crowns += crowns; if (record) meta.stats.rushBest = state.score;
  root.CS.saveMeta(); UI.music(null); UI.sfx(state.score ? 'win' : 'lose');
  UI.screen(h('div', { class: 'screen center-screen' },
    h('h1', { class: 'good' }, T('rush.over')),
    h('p', null, T('rush.result', { n: state.score })),
    record && state.score ? h('p', { class: 'tip' }, T('rush.record')) : null,
    h('div', { class: 'panel' },
      h('div', { class: 'drow' }, h('span', { class: 'muted' }, T('rush.solved')), h('b', null, state.score)),
      h('div', { class: 'drow' }, h('span', { class: 'muted' }, T('rush.bestLabel')), h('b', null, meta.stats.rushBest || 0)),
      h('div', { class: 'drow' }, h('span', { class: 'muted' }, T('end.crowns')), h('b', null, '+' + crowns))),
    h('div', { class: 'menu' },
      h('button', { class: 'btn primary', onclick: start }, T('rush.again')),
      h('button', { class: 'btn', onclick: () => root.CS.showTitle() }, T('end.title')))));
}

const api = { start, finish, generate, state, RUSH };
root.Rush = api;
})(window);
