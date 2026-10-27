/* =========================================================================
 * Checkmate Survivors - data.js
 * Static game data: items, relics, opponents, scenarios, permanent upgrades.
 * Display texts live in i18n.js (keys: item.<id>.name, relic.<id>.desc, ...)
 * ====================================================================== */
(function (root) {
'use strict';
const D = {};

D.VERSION = '0.3.0';        // shown on the title screen (early alpha)

D.TYPE = { p: 1, n: 2, b: 3, r: 4, q: 5 };            // chess.js piece types
D.MAX_ARMY = { p: 8, n: 2, b: 2, r: 2, q: 1 };         // never exceed a standard army
D.VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9 };
D.PRICE = { p: 20, n: 45, b: 45, r: 70, q: 130 };
D.PIECE_ORDER = ['p', 'n', 'b', 'r', 'q'];

// consumables (potions): used during a match, they do not cost a move
D.POTIONS = {
  rewind:    { color: '#4fa3e0', glyph: 'rewind',    price: 30, weight: 3 },
  hint:      { color: '#e8c84a', glyph: 'plus',      price: 25, weight: 4 },
  threats:   { color: '#e0524f', glyph: 'bang',      price: 20, weight: 4 },
  hourglass: { color: '#58c47a', glyph: 'hourglass', price: 20, weight: 5 },
  thief:     { color: '#9a5fd6', glyph: 'cross',     price: 35, weight: 3 },
  freeze:    { color: '#7fe0e8', glyph: 'snow',      price: 30, weight: 2 },
};

// relics: passive for the rest of the run
D.RELICS = {
  watch:   { color: '#e8b84a', shape: 'watch',  price: 70 },
  lucky:   { color: '#f0d060', shape: 'coin',   price: 70 },
  pockets: { color: '#a07850', shape: 'bag',    price: 70 },
  eye:     { color: '#7ac0f0', shape: 'eye',    price: 70 },
  charm:   { color: '#e87aa8', shape: 'heart',  price: 70 },
  iron:    { color: '#9aa0b0', shape: 'shield', price: 70 },
  feather: { color: '#f09050', shape: 'feather', price: 70 },
};

// difficulty tiers (AI strength, pieces budget relative to the player, reward)
D.DIFFS = {
  easy:   { coin: 1.0, depth: 2, blunder: 0.35, timeMs: 150, budget: [0.60, 0], color: '#6fcf7a' },
  normal: { coin: 1.5, depth: 3, blunder: 0.12, timeMs: 250, budget: [0.9, 1],  color: '#e8c84a' },
  hard:   { coin: 2.2, depth: 4, blunder: 0.05, timeMs: 350, budget: [1.15, 1], color: '#e0524f' },
  boss:   { coin: 4.0, depth: 6, blunder: 0.00, timeMs: 700, budget: [1.3, 3],  color: '#b57cff' },
};
// the first steps of a run are warm-ups: weaker AI, smaller army, gentle objectives
D.INTRO = { layers: 2, depth: 1, blunder: 0.5, budget: [0.45, 0] };
D.TIMECTRL = {
  bullet: { base: 40,  inc: 0, mult: 1.4 },
  blitz:  { base: 75,  inc: 1, mult: 1.15 },
  rapid:  { base: 130, inc: 2, mult: 1.0 },
};
D.OBJ_N = {   // objective limits by difficulty
  mateIn:       { easy: 30, normal: 24, hard: 20, boss: 24 },
  survive:      { easy: 12, normal: 15, hard: 18, boss: 20 },
  captureQueen: { easy: 12, normal: 10, hard: 8,  boss: 10 },
  capture:      { easy: 2,  normal: 3,  hard: 4,  boss: 5 },
};

// opponents are monsters; each one's pieces are drawn in its own theme (sprites.js FACTIONS)
D.ENEMIES = [
  { id: 'slime',    style: 'rookie',     tier: 'easy' },
  { id: 'goblin',   style: 'greedy',     tier: 'easy' },
  { id: 'ghost',    style: 'defensive',  tier: 'easy' },
  { id: 'spider',   style: 'aggressive', tier: 'normal' },
  { id: 'skeleton', style: 'defensive',  tier: 'normal' },
  { id: 'witch',    style: 'positional', tier: 'normal' },
  { id: 'werewolf', style: 'aggressive', tier: 'hard', thief: 1 },
  { id: 'medusa',   style: 'positional', tier: 'hard' },
  { id: 'vampire',  style: 'balanced',   tier: 'hard', thief: 1 },
  { id: 'lich',     style: 'balanced',   tier: 'boss', thief: 2, hourglass: 1 },
];

// ready-made positions, all validated by tests/scenarios.js (exhaustive mate solver)
D.SCENARIOS = [
  { id: 'smothered', diff: 'easy',   fen: '6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1',            obj: { type: 'mateIn', n: 2 },        time: 40,  style: 'balanced' },
  { id: 'backrank',  diff: 'easy',   fen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1',         obj: { type: 'mateIn', n: 2 },        time: 40,  style: 'balanced' },
  { id: 'fork',      diff: 'easy',   fen: '3q3k/6pp/8/4N3/8/8/8/6K1 w - - 0 1',            obj: { type: 'captureQueen', n: 2 }, time: 45,  style: 'balanced' },
  { id: 'ladder',    diff: 'normal', fen: '7k/8/R7/1R6/8/8/8/6K1 w - - 0 1',               obj: { type: 'mateIn', n: 3 },        time: 60,  style: 'balanced' },
  { id: 'queenhunt', diff: 'normal', fen: 'k7/8/2K5/8/8/8/8/7Q w - - 0 1',                 obj: { type: 'mateIn', n: 3 },        time: 60,  style: 'balanced' },
  { id: 'holdline',  diff: 'normal', fen: '6k1/5pp1/7p/3q4/8/8/5PPP/5RK1 w - - 0 1',      obj: { type: 'survive', n: 10 },      time: 90,  style: 'aggressive' },
  { id: 'rookmate',  diff: 'normal', fen: '8/8/8/4k3/8/8/8/R3K3 w - - 0 1',                obj: { type: 'mateIn', n: 25 },       time: 120, style: 'balanced' },
  { id: 'deepmateq', diff: 'hard',   fen: '8/4K3/7k/8/8/5Q2/8/8 w - - 0 1',                obj: { type: 'mateIn', n: 3 },        time: 75,  style: 'balanced' },
  { id: 'deepmater', diff: 'hard',   fen: '8/R7/8/8/8/4K3/7k/8 w - - 0 1',                 obj: { type: 'mateIn', n: 3 },        time: 75,  style: 'balanced' },
  { id: 'lastwall',  diff: 'hard',   fen: '6k1/5ppp/8/4q3/8/8/5PPP/3R2K1 w - - 0 1',       obj: { type: 'survive', n: 12 },      time: 90,  style: 'aggressive' },
];

// permanent upgrades bought with Crowns after a run ends
D.META = [
  { id: 'lives',   max: 3, cost: [40, 90, 180],  shape: 'heart' },
  { id: 'pawn',    max: 3, cost: [30, 60, 100],  shape: 'shield' },
  { id: 'knight',  max: 1, cost: [120],          shape: 'gem' },
  { id: 'bishop',  max: 1, cost: [120],          shape: 'gem' },
  { id: 'rook',    max: 1, cost: [260],          shape: 'gem' },
  { id: 'slots',   max: 2, cost: [60, 140],      shape: 'bag' },
  { id: 'bank',    max: 3, cost: [50, 100, 200], shape: 'watch' },
  { id: 'purse',   max: 3, cost: [40, 90, 160],  shape: 'coin' },
  { id: 'starter', max: 1, cost: [70],           shape: 'potion' },
];

const api = D;
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Data = api;
})(typeof window !== 'undefined' ? window : globalThis);
