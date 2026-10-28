/* =========================================================================
 * Checkmate Survivors - data.js
 * Static game data: items, relics, opponents, scenarios, permanent upgrades.
 * Display texts live in i18n.js (keys: item.<id>.name, relic.<id>.desc, ...)
 * ====================================================================== */
(function (root) {
'use strict';
const D = {};

D.VERSION = '0.10.1';        // shown on the title screen (early alpha)

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
  easy:   { coin: 1.0, depth: 1, blunder: 0.50, timeMs: 120, budget: [0.50, 0], color: '#6fcf7a' },
  normal: { coin: 1.5, depth: 2, blunder: 0.30, timeMs: 200, budget: [0.70, 0], color: '#e8c84a' },
  hard:   { coin: 2.2, depth: 3, blunder: 0.15, timeMs: 300, budget: [0.90, 1], color: '#e0524f' },
  boss:   { coin: 4.0, depth: 4, blunder: 0.03, timeMs: 500, budget: [1.1, 2],  color: '#b57cff' },
};
// the first steps of a run are warm-ups: weaker AI, smaller army, gentle objectives
D.INTRO = { layers: 3, depth: 1, blunder: 0.6, budget: [0.4, 0] };
D.TIMECTRL = {
  bullet: { base: 50,  inc: 1, mult: 1.4 },
  blitz:  { base: 90,  inc: 2, mult: 1.15 },
  rapid:  { base: 150, inc: 3, mult: 1.0 },
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
  // act 2: the Catacombs (act 1 hard monsters also roam here)
  { id: 'mummy',       style: 'defensive',  tier: 'normal', act: 2 },
  { id: 'banshee',     style: 'aggressive', tier: 'normal', act: 2 },
  { id: 'golem',       style: 'positional', tier: 'normal', act: 2 },
  { id: 'gargoyle',    style: 'balanced',   tier: 'hard',   act: 2, thief: 1 },
  { id: 'necromancer', style: 'balanced',   tier: 'boss',   act: 2, thief: 2, hourglass: 1 },
];
D.ACTS = 2;

// ready-made positions, all validated by tests/scenarios.js (exhaustive mate solver)
D.SCENARIOS = [
  { id: 'queenkiss',  diff: 'easy',   fen: '6k1/5ppp/8/8/8/8/5PPP/4Q1K1 w - - 0 1',          obj: { type: 'mateIn', n: 1 },        time: 60,  style: 'balanced' },
  { id: 'rookedge',   diff: 'easy',   fen: 'k7/8/1K6/8/8/8/8/7R w - - 0 1',                  obj: { type: 'mateIn', n: 1 },        time: 60,  style: 'balanced' },
  { id: 'arabian',    diff: 'easy',   fen: '7k/7p/5N2/8/8/8/8/6RK w - - 0 1',                obj: { type: 'mateIn', n: 1 },        time: 60,  style: 'balanced' },
  { id: 'rookroller', diff: 'easy',   fen: '6k1/8/8/8/8/8/R7/1R4K1 w - - 0 1',               obj: { type: 'mateIn', n: 2 },        time: 60,  style: 'balanced' },
  { id: 'knightfork', diff: 'easy',   fen: 'q3k3/8/8/1N6/8/8/8/4K3 w - - 0 1',               obj: { type: 'captureQueen', n: 2 }, time: 60,  style: 'balanced' },
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

// achievements: unlocked once, each pays Crowns (local: itch.io has no achievements API for HTML games)
D.ACHIEVEMENTS = [
  { id: 'firstWin',    crowns: 5,  shape: 'duel',    color: '#e8c84a' },
  { id: 'promote',     crowns: 5,  shape: 'gem',     color: '#ffe066' },
  { id: 'bullet',      crowns: 5,  shape: 'watch',   color: '#ff7a6a' },
  { id: 'step5',       crowns: 5,  shape: 'scenario', color: '#7ac0f0' },
  { id: 'puzzles',     crowns: 10, shape: 'scenario', color: '#58c47a' },
  { id: 'queenHunter', crowns: 10, shape: 'boss',    color: '#e87aa8' },
  { id: 'rush10',      crowns: 10, shape: 'rush',    color: '#ff7a6a' },
  { id: 'rich',        crowns: 10, shape: 'coin',    color: '#f0d060' },
  { id: 'daily',       crowns: 10, shape: 'watch',   color: '#7fe0e8' },
  { id: 'arena',       crowns: 15, shape: 'arena',   color: '#ffb347' },
  { id: 'elite',       crowns: 15, shape: 'shield',  color: '#e0524f' },
  { id: 'fullArmy',    crowns: 20, shape: 'gem',     color: '#b57cff' },
  { id: 'noPotions',   crowns: 20, shape: 'potion',  color: '#9aa0b0' },
  { id: 'collector',   crowns: 25, shape: 'bag',     color: '#a07850' },
  { id: 'boss',        crowns: 30, shape: 'boss',    color: '#b57cff' },
  { id: 'act2',        crowns: 15, shape: 'rest',    color: '#9aff7a' },
  { id: 'necromancer', crowns: 40, shape: 'elite',   color: '#9aff7a' },
  { id: 'bestiary',    crowns: 30, shape: 'eye',     color: '#7ac0f0' },
];

// permanent upgrades bought with Crowns after a run ends
D.META = [
  { id: 'lives',   max: 3, cost: [20, 60, 140],  shape: 'heart' },
  { id: 'pawn',    max: 3, cost: [15, 40, 80],   shape: 'shield' },
  { id: 'knight',  max: 1, cost: [60],           shape: 'gem' },
  { id: 'bishop',  max: 1, cost: [60],           shape: 'gem' },
  { id: 'rook',    max: 1, cost: [150],          shape: 'gem' },
  { id: 'slots',   max: 2, cost: [30, 90],       shape: 'bag' },
  { id: 'bank',    max: 3, cost: [15, 45, 110],  shape: 'watch' },
  { id: 'purse',   max: 3, cost: [20, 50, 110],  shape: 'coin' },
  { id: 'starter', max: 1, cost: [25],           shape: 'potion' },
  // amulets: buy a relic once and start every run with it (owning all = full collection)
  { id: 'am_iron',    amulet: 'iron',    max: 1, cost: [40] },
  { id: 'am_watch',   amulet: 'watch',   max: 1, cost: [50] },
  { id: 'am_charm',   amulet: 'charm',   max: 1, cost: [60] },
  { id: 'am_pockets', amulet: 'pockets', max: 1, cost: [70] },
  { id: 'am_lucky',   amulet: 'lucky',   max: 1, cost: [80] },
  { id: 'am_eye',     amulet: 'eye',     max: 1, cost: [90] },
  { id: 'am_feather', amulet: 'feather', max: 1, cost: [120] },
];

const api = D;
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Data = api;
})(typeof window !== 'undefined' ? window : globalThis);
