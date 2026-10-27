/* =========================================================================
 * Checkmate Survivors - run.js
 * Run controller: roguelite structure (branching map, armies, rewards,
 * shop, events, rest), permanent upgrades (meta) and every non-match screen.
 * ====================================================================== */
(function (root) {
'use strict';
const C = root.Chess, D = root.Data, UI = root.UI, SP = root.Sprites;
const T = (k, v) => root.I18N.t(k, v), h = UI.h;
const CS = root.CS = { meta: null, run: null, match: null };

// ------------------------------------------------------------------ helpers
const rnd = n => Math.floor(Math.random() * n);
const chance = p => Math.random() < p;
const pickOne = a => a[rnd(a.length)];
function weighted(items, wf) {
  let tot = 0; for (const i of items) tot += wf(i);
  let r = Math.random() * tot;
  for (const i of items) { r -= wf(i); if (r <= 0) return i; }
  return items[items.length - 1];
}
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

// ------------------------------------------------------------------ meta (permanent progress)
const META_DEFAULT = { crowns: 0, levels: {}, stats: { runs: 0, wins: 0, bestNodes: 0 }, lang: 'en', muted: false, music: true };
function loadMeta() {
  const d = UI.store.load() || {};
  CS.meta = Object.assign({}, META_DEFAULT, d);
  CS.meta.levels = Object.assign({}, d.levels || {});
  CS.meta.stats = Object.assign({}, META_DEFAULT.stats, d.stats || {});
  root.I18N.setLang(CS.meta.lang || 'en'); UI.muted = !!CS.meta.muted; UI.musicOn = CS.meta.music !== false;
}
function saveMeta() { CS.meta.muted = UI.muted; CS.meta.music = UI.musicOn; CS.meta.lang = root.I18N.getLang(); UI.store.save(CS.meta); }
const lvl = id => (CS.meta.levels[id] || 0);

// ------------------------------------------------------------------ armies
const armyValue = a => D.PIECE_ORDER.reduce((s, k) => s + a[k] * D.VALUE[k], 0);
const armyStr = a => D.PIECE_ORDER.filter(k => a[k] > 0).map(k => a[k] + k.toUpperCase()).join(' ');
function buildEnemyArmy(points, needQueen) {
  const a = { p: 0, n: 0, b: 0, r: 0, q: 0 };
  points = Math.max(1, Math.min(points, 39));
  if (needQueen) { a.q = 1; points = Math.max(0, points - 9); }
  a.p = Math.min(8, Math.max(1, Math.round(points * 0.45)));
  let left = points - a.p, guard = 0;
  while (left >= 3 && guard++ < 20) {
    const opts = [];
    if (a.n < 2) opts.push('n'); if (a.b < 2) opts.push('b');
    if (left >= 5 && a.r < 2) opts.push('r'); if (left >= 9 && a.q < 1) opts.push('q');
    if (!opts.length) break;
    const k = weighted(opts, x => ({ n: 3, b: 3, r: 2, q: 1 })[x]);
    a[k]++; left -= D.VALUE[k];
  }
  while (left > 0 && a.p < 8) { a.p++; left--; }
  return a;
}
const PAWN_FILES = [3, 4, 2, 5, 1, 6, 0, 7];            // d e c f b g a h
const HOME = { n: [6, 1], b: [5, 2], r: [7, 0], q: [3] };
function placeArmy(board, army, color) {
  const base = color === 0 ? 0 : 56, pr = color === 0 ? 8 : 48;
  board[base + 4] = C.mk(C.KING, color);
  for (let i = 0; i < army.p; i++) board[pr + PAWN_FILES[i]] = C.mk(C.PAWN, color);
  for (const k of ['n', 'b', 'r', 'q']) for (let i = 0; i < army[k]; i++) board[base + HOME[k][i]] = C.mk(D.TYPE[k], color);
}
function setupFEN(pa, ea) {
  const b = new Array(64).fill(0);
  placeArmy(b, pa, 0); placeArmy(b, ea, 1);
  let s = '';
  for (let r = 7; r >= 0; r--) {
    let e = 0;
    for (let f = 0; f < 8; f++) {
      const p = b[r * 8 + f];
      if (!p) { e++; continue; }
      if (e) { s += e; e = 0; }
      const ch = C.PIECE_CHARS[(p & 7) - 1];
      s += (p >> 3) === 0 ? ch.toUpperCase() : ch;
    }
    if (e) s += e;
    if (r) s += '/';
  }
  return s + ' w KQkq - 0 1';
}

// ------------------------------------------------------------------ run state
const slotsOf = run => 3 + lvl('slots') + (run.relics.includes('pockets') ? 1 : 0);
function newRun() {
  const army = { p: 5 + lvl('pawn'), n: lvl('knight') ? 1 : 0, b: lvl('bishop') ? 1 : 0, r: lvl('rook') ? 1 : 0, q: 0 };
  const relics = D.META.filter(u => u.amulet && lvl(u.id)).map(u => u.amulet);
  const run = { army, coins: 20, retries: 1 + lvl('lives') + (relics.includes('feather') ? 1 : 0), potions: ['hint'], relics, map: null, cur: null, stats: { nodes: 0, wins: 0 } };
  if (lvl('starter')) run.potions.push('hourglass', 'rewind');
  run.map = genMap();
  return run;
}
function addPotion(id) {
  const run = CS.run;
  if (run.potions.length >= slotsOf(run)) {
    const c = Math.floor(D.POTIONS[id].price / 2);
    run.coins += c; UI.toast(T('toast.bagFull', { c }), 'bad'); return false;
  }
  run.potions.push(id); return true;
}
function addRelic(id) {
  const run = CS.run;
  if (run.relics.includes(id)) return;
  run.relics.push(id);
  if (id === 'feather') run.retries++;
}
const unownedRelics = run => Object.keys(D.RELICS).filter(id => !run.relics.includes(id));
function randomPotion() { return weighted(Object.keys(D.POTIONS), id => D.POTIONS[id].weight); }

// ------------------------------------------------------------------ map generation
const DIFF_W = [[100, 0, 0], [85, 15, 0], [60, 35, 5], [40, 45, 15], [25, 50, 25], [20, 45, 35]];
function pickDiff(layer) {
  const w = DIFF_W[Math.min(layer, 5)];
  return weighted(['easy', 'normal', 'hard'], d => w[['easy', 'normal', 'hard'].indexOf(d)]);
}
const OBJ_W = {
  intro:  { promote: 45, capture: 45, mate: 10 },
  easy:   { mate: 35, promote: 25, capture: 25, survive: 15 },
  normal: { mate: 50, mateIn: 12, survive: 13, captureQueen: 10, capture: 15 },
  hard:   { mate: 55, mateIn: 15, survive: 15, captureQueen: 15 },
};
// the first steps are mostly puzzles: a quick, rewarding way into the game
const PUZZLE_FIRST = [{ duel: 20, scenario: 80 }, { duel: 25, scenario: 40, event: 15, shop: 5, rest: 5, rush: 10 }];
function genMap() {
  const widths = [3, 2 + rnd(2), 3, 3, 2 + rnd(2), 2, 2, 1];
  const layers = widths.map((w, l) => Array.from({ length: w }, (_, i) => ({ id: l + '-' + i, layer: l, idx: i, next: [], done: false })));
  const usedScen = new Set(), usedEvents = new Set();
  layers.forEach((nodes, l) => {
    let types;
    if (l === 7) types = ['boss'];
    else if (l === 6) types = shuffle(['rest', 'shop']);
    else if (l === 3) types = shuffle(['shop', 'rest', 'duel']);
    else types = nodes.map(() => weighted(l === 0 ? ['duel', 'scenario'] : ['duel', 'scenario', 'event', 'shop', 'rest', 'rush'],
      t => (PUZZLE_FIRST[l] || { duel: 50, scenario: 14, event: 16, shop: 6, rest: 6, rush: 8 })[t] || 0));
    if (l === 2 && !types.includes('rush')) types[rnd(types.length)] = 'rush';   // every run gets at least one Mate Rush
    if (l === 4 && !types.includes('arena')) types[rnd(types.length)] = 'arena'; // ...and one Arena before the boss
    nodes.forEach((n, i) => {
      n.type = types[i];
      if (n.type === 'duel') {
        n.diff = pickDiff(l); n.intro = n.diff === 'easy' && l < D.INTRO.layers;
        n.tc = n.intro ? 'rapid' : pickOne(Object.keys(D.TIMECTRL));
        n.enemyId = pickOne(D.ENEMIES.filter(e => e.tier === n.diff)).id;
        n.objType = weighted(Object.keys(OBJ_W[n.intro ? 'intro' : n.diff]), t => OBJ_W[n.intro ? 'intro' : n.diff][t]);
      } else if (n.type === 'scenario') {
        n.diff = pickDiff(l);
        const pool = D.SCENARIOS.filter(s => s.diff === n.diff && !usedScen.has(s.id));
        const sc = pool.length ? pickOne(pool) : pickOne(D.SCENARIOS.filter(s => !usedScen.has(s.id)).concat(D.SCENARIOS));
        usedScen.add(sc.id); n.scenarioId = sc.id; n.diff = sc.diff;
      } else if (n.type === 'event') {
        const ids = Object.keys(EVENTS).filter(e => !usedEvents.has(e));
        n.eventId = pickOne(ids.length ? ids : Object.keys(EVENTS)); usedEvents.add(n.eventId);
      } else if (n.type === 'boss') {
        n.diff = 'boss'; n.tc = 'blitz'; n.enemyId = 'lich'; n.objType = 'mate';
      }
    });
  });
  for (let l = 0; l < 7; l++) {
    const A = layers[l], B = layers[l + 1];
    A.forEach((a, i) => {
      const j0 = Math.round(i * (B.length - 1) / Math.max(1, A.length - 1));
      const s = new Set([j0]);
      if (chance(0.5)) { const j = j0 + (chance(0.5) ? 1 : -1); if (j >= 0 && j < B.length) s.add(j); }
      a.next = [...s];
    });
    B.forEach((b, j) => {
      if (!A.some(a => a.next.includes(j))) { const i0 = Math.round(j * (A.length - 1) / Math.max(1, B.length - 1)); A[i0].next.push(j); }
    });
    A.forEach(a => { a.next = [...new Set(a.next)].sort(); });
  }
  return { layers };
}
function reachable(run) {
  const set = new Set(), L = run.map.layers;
  if (!run.cur) L[0].forEach(n => set.add(n));
  else { const c = L[run.cur.layer][run.cur.idx]; c.next.forEach(j => set.add(L[c.layer + 1][j])); }
  return set;
}

// ------------------------------------------------------------------ rewards
function coinReward(node) {
  const run = CS.run, tc = D.TIMECTRL[node.tc] || { mult: 1 };
  return Math.round((20 + node.layer * 4) * D.DIFFS[node.diff].coin * tc.mult * (1 + 0.1 * lvl('purse')) * (run.relics.includes('lucky') ? 1.25 : 1));
}
function makeRewards(diff) {
  const run = CS.run, opts = [];
  const pks = D.PIECE_ORDER.filter(k => run.army[k] < D.MAX_ARMY[k]);
  const pw = { p: 4, n: 3, b: 3, r: diff === 'easy' ? 1 : 2, q: diff === 'hard' || diff === 'boss' ? 1.2 : (diff === 'normal' ? 0.4 : 0.1) };
  if (pks.length) opts.push({ kind: 'piece', k: weighted(pks, k => pw[k]) });
  opts.push({ kind: 'potion', id: randomPotion() });
  const rl = unownedRelics(run);
  if (rl.length && (diff !== 'easy' || chance(0.4))) opts.push({ kind: 'relic', id: pickOne(rl) });
  if (diff === 'hard' || diff === 'boss') {
    const others = pks.filter(k => !opts.some(o => o.k === k));
    if (others.length) opts.push({ kind: 'piece', k: weighted(others, k => pw[k]) });
  }
  while (opts.length < 3) opts.push({ kind: 'coins', amount: 10 + rnd(10) + (diff === 'hard' ? 15 : 0) });
  return shuffle(opts);
}
function applyReward(o) {
  const run = CS.run;
  if (o.kind === 'piece') run.army[o.k]++;
  else if (o.kind === 'potion') addPotion(o.id);
  else if (o.kind === 'relic') addRelic(o.id);
  else run.coins += o.amount;
}
const PIECE_NAME = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen' };

// ------------------------------------------------------------------ events
const EVENTS = {
  gambler: { choices: [
    { id: 'bet', need: r => r.coins >= 20, apply(r) { if (chance(0.5)) { r.coins += 40; return 'won'; } r.coins -= 20; return 'lost'; } },
    { id: 'leave', apply() { return 'left'; } } ] },
  clockmaker: { choices: [
    { id: 'buy', need: r => r.coins >= 25, apply(r) { r.coins -= 25; addPotion('hourglass'); addPotion('hourglass'); return 'bought'; } },
    { id: 'trade', need: r => r.army.p >= 2 && unownedRelics(r).length > 0, apply(r) { r.army.p--; addRelic(pickOne(unownedRelics(r))); return 'traded'; } },
    { id: 'leave', apply() { return 'left'; } } ] },
  hermit: { choices: [
    { id: 'pay', need: r => r.coins >= 30, apply(r) { r.coins -= 30; r.retries++; return 'paid'; } },
    { id: 'leave', apply() { return 'left'; } } ] },
  well: { choices: [
    { id: 'drink', apply(r) { const x = Math.random(); if (x < 0.6) { addPotion(randomPotion()); return 'potion'; } if (x < 0.85) { r.coins += 20; return 'coins'; } r.coins = Math.max(0, r.coins - 10); return 'bad'; } },
    { id: 'leave', apply() { return 'left'; } } ] },
  broker: { choices: [
    { id: 'sell', need: r => r.potions.length > 0, apply(r) { r.potions.splice(rnd(r.potions.length), 1); r.coins += 20; return 'sold'; } },
    { id: 'buy', need: r => r.coins >= 60 && unownedRelics(r).length > 0, apply(r) { r.coins -= 60; addRelic(pickOne(unownedRelics(r))); return 'bought'; } },
    { id: 'leave', apply() { return 'left'; } } ] },
};

// ------------------------------------------------------------------ small UI pieces
const btn = (label, fn, cls) => h('button', { class: 'btn ' + (cls || ''), onclick: () => { UI.sfx('click'); fn(); } }, label);
const icon = (shape, color, opts, cls) => h('img', { class: 'icon ' + (cls || ''), src: SP.iconURL(shape, color, opts) });
const pieceImg = k => h('img', { class: 'pimg', src: SP.pieceURL(C.mk(D.TYPE[k], 0)) });
const potionIcon = id => icon('potion', D.POTIONS[id].color, { glyph: D.POTIONS[id].glyph }, 'chip');
const relicIcon = id => icon(D.RELICS[id].shape, D.RELICS[id].color, null, 'chip');
const coinIcon = () => icon('coin', '#f0d060', null, 'coin');
const KIND_COLOR = { piece: '#e8b84a', coins: '#f0d060', upgrade: '#b57cff' };
function card(tag, kind, color, ico, title, desc, extra, cls, onclick) {
  return h(tag, { class: 'card ' + (cls || ''), style: { '--kc': color || KIND_COLOR[kind] }, onclick },
    h('div', { class: 'card-kind' }, T('kind.' + kind)), h('div', { class: 'cardicon' }, ico),
    h('div', { class: 'card-title' }, title), desc ? h('div', { class: 'card-desc' }, desc) : null, extra);
}
function priceBtn(price, can, onclick, crowns) {
  return h('button', { class: 'price-btn' + (can ? '' : ' cant'), disabled: !can, onclick },
    h('img', { src: crowns ? SP.iconURL('boss', '#e8b84a') : SP.iconURL('coin', '#f0d060'), alt: '' }), h('b', null, price),
    can ? null : h('span', { class: 'need' }, T('shop.need')));
}
const portrait = (id, cls) => h('img', { class: cls, src: root.Portraits.url(id, 'idle'), alt: '' });
const NODE_COLOR = { arena: '#ffb347', rush: '#ff7a6a', scenario: '#7ac0f0', shop: '#e8b84a', event: '#c58cff', rest: '#ff9f5a', boss: '#b57cff' };
const nodeColor = n => (n.type === 'duel' || n.type === 'scenario') ? D.DIFFS[n.diff].color : NODE_COLOR[n.type];
function objN(type, diff) { return D.OBJ_N[type] ? D.OBJ_N[type][diff] : 0; }

function runHeader() {
  const run = CS.run;
  const army = h('div', { class: 'army' }, h('img', { class: 'pimg', src: SP.pieceURL(C.mk(C.KING, 0)) }),
    D.PIECE_ORDER.filter(k => run.army[k] > 0).map(k => h('span', { class: 'armyitem', title: T('piece.' + PIECE_NAME[k]) }, pieceImg(k), '\u00d7' + run.army[k])));
  const pots = h('div', { class: 'chips' }, run.potions.map(id => h('span', { title: T('item.' + id + '.name') + ': ' + T('item.' + id + '.desc') }, potionIcon(id))),
    h('span', { class: 'muted small' }, '(' + run.potions.length + '/' + slotsOf(run) + ')'));
  const rel = h('div', { class: 'chips' }, run.relics.map(id => h('span', { title: T('relic.' + id + '.name') + ': ' + T('relic.' + id + '.desc') }, relicIcon(id))));
  return h('div', { class: 'run-header panel' },
    h('div', { class: 'stat' }, coinIcon(), h('b', null, run.coins)),
    h('div', { class: 'stat', title: T('hud.retriesTip') }, icon('heart', '#e87aa8', null, 'chip'), h('b', null, run.retries)),
    army, pots, rel,
    h('button', { class: 'btn small', onclick: UI.fullscreen }, T('ui.fullscreen')),
    h('button', { class: 'btn small danger', onclick: () => { if (root.confirm(T('hud.confirmAbandon'))) endRun(false); } }, T('hud.abandon')));
}

// ------------------------------------------------------------------ title / help / permanent shop
function lastRunLine(m) {
  const last = (m.stats.history || []).slice(-1)[0];
  if (!last) return null;
  return h('div', { class: 'muted small' }, last.victory ? T('title.lastWin') :
    last.by ? T('title.lastBy', { step: last.step, foe: T('enemy.' + last.by + '.name') }) : T('title.lastStep', { step: last.step }));
}
function startRunConfirm() {
  if (savedRun() && !root.confirm(T('title.confirmNew'))) return;
  startRun();
}
function showTitle() {
  const m = CS.meta, lang = root.I18N.getLang(), saved = savedRun();
  UI.screen(h('div', { class: 'screen title' },
    h('div', { class: 'logo' }, h('div', { class: 'logo-1' }, 'CHECKMATE'), h('div', { class: 'logo-2' }, 'SURVIVORS')),
    h('div', { class: 'tagline' }, T('title.tagline')),
    h('div', { class: 'row center deco' }, ['slime', 'spider', 'witch', 'lich', 'vampire', 'ghost'].map((id, i) => h('img', { class: 'title-monster', style: { animationDelay: (i * 0.18) + 's' }, src: root.Portraits.url(id, 'idle'), alt: '' }))),
    h('div', { class: 'menu' },
      saved ? btn(T('title.continue'), continueRun, 'primary') : null,
      btn(T('title.start'), startRunConfirm, saved ? '' : 'primary'),
      btn(T('title.shop') + '  (' + m.crowns + ' ' + T('crowns') + ')', showMetaShop),
      btn(T('title.how'), showHelp),
      h('div', { class: 'row center' },
        btn(lang === 'en' ? 'Espa\u00f1ol' : 'English', () => { root.I18N.setLang(lang === 'en' ? 'es' : 'en'); saveMeta(); showTitle(); }, 'small'),
        btn(UI.muted ? T('title.soundOff') : T('title.soundOn'), () => { UI.muted = !UI.muted; saveMeta(); showTitle(); }, 'small'),
        btn(UI.musicOn ? T('title.musicOn') : T('title.musicOff'), () => { UI.musicOn = !UI.musicOn; saveMeta(); showTitle(); }, 'small'),
        btn(T('ui.fullscreen'), UI.fullscreen, 'small'))),
    h('div', { class: 'muted small' }, T('title.stats', { runs: m.stats.runs, wins: m.stats.wins, best: m.stats.bestNodes })),
    lastRunLine(m),
    h('div', { class: 'version' }, T('title.version', { v: D.VERSION }))));
}
function showHelp() {
  const items = []; for (let i = 1; i <= 9; i++) items.push(h('li', null, T('help.' + i)));
  const md = UI.modal(h('div', null, h('h2', null, T('title.how')), h('ul', { class: 'help' }, items), h('div', { class: 'row center' }, btn(T('close'), () => md.close(), 'primary'))));
}
function metaIcon(u) {
  if (u.amulet) return icon(D.RELICS[u.amulet].shape, D.RELICS[u.amulet].color, null, 'big');
  if (['pawn', 'knight', 'bishop', 'rook'].includes(u.id)) return pieceImg({ pawn: 'p', knight: 'n', bishop: 'b', rook: 'r' }[u.id]);
  const colors = { lives: '#e87aa8', slots: '#a07850', bank: '#e8b84a', purse: '#f0d060', starter: '#58c47a' };
  return icon(u.shape, colors[u.id] || '#e8b84a', u.id === 'starter' ? { glyph: 'hourglass' } : null, 'big');
}
function showMetaShop() {
  const m = CS.meta;
  const metaCard = u => {
    const L = lvl(u.id), maxed = L >= u.max, cost = u.cost[L], can = !maxed && m.crowns >= cost;
    const name = u.amulet ? T('relic.' + u.amulet + '.name') : T('meta.' + u.id + '.name');
    const desc = u.amulet === 'feather' ? T('meta.featherDesc') : u.amulet ? T('relic.' + u.amulet + '.desc') + ' ' + T('meta.amuletNote') : T('meta.' + u.id + '.desc');
    return card('div', u.amulet ? 'relic' : 'upgrade', u.amulet ? D.RELICS[u.amulet].color : null, metaIcon(u), name, desc, [
      u.amulet ? null : h('div', { class: 'small lvl' }, T('meta.level', { a: L, n: u.max })),
      maxed ? h('div', { class: 'tag' }, u.amulet ? T('meta.owned') : T('meta.maxed')) :
        priceBtn(cost, can, () => { m.crowns -= cost; m.levels[u.id] = L + 1; saveMeta(); UI.sfx('buy'); showMetaShop(); }, true)], maxed ? (u.amulet ? 'owned' : 'maxed') : (can ? 'buyable' : ''));
  };
  const owned = D.META.filter(u => lvl(u.id) >= u.max).length;
  UI.screen(h('div', { class: 'screen' },
    h('div', { class: 'row between' }, h('h2', null, T('title.shop')), h('div', { class: 'stat' }, icon('boss', '#e8b84a', null, 'chip'), h('b', null, m.crowns + ' ' + T('crowns')))),
    h('p', { class: 'muted' }, T('meta.intro') + ' ' + T('meta.progress', { a: owned, n: D.META.length })),
    h('h3', { class: 'section' }, T('meta.upgrades')), h('div', { class: 'grid' }, D.META.filter(u => !u.amulet).map(metaCard)),
    h('h3', { class: 'section' }, T('meta.amulets')), h('p', { class: 'muted small' }, T('meta.amuletsIntro')), h('div', { class: 'grid' }, D.META.filter(u => u.amulet).map(metaCard)),
    h('div', { class: 'row center' }, btn(T('back'), showTitle))));
}

// ------------------------------------------------------------------ map
function startRun() { CS.run = newRun(); showMap(); }
function nodeTitleText(n) {
  if (n.type === 'duel' || n.type === 'boss') return T('enemy.' + n.enemyId + '.name');
  if (n.type === 'scenario') return T('scenario.' + n.scenarioId + '.name');
  return T('node.' + n.type);
}
function nodeEl(n, reach) {
  const run = CS.run;
  const state = n.done ? 'done' : (reach.has(n) ? 'reach' : 'locked');
  const cur = run.cur && run.cur.layer === n.layer && run.cur.idx === n.idx;
  const jitter = n.layer === 7 ? 0 : ((n.layer * 7 + n.idx * 13) % 5 - 2) * 7;
  return h('button', { class: 'node ' + n.type + ' ' + state + (cur ? ' current' : ''), 'data-id': n.id, disabled: state !== 'reach', onclick: () => openNode(n),
    style: { '--nc': nodeColor(n), top: jitter + 'px' } },
    h('div', { class: 'medal' },
      n.enemyId ? portrait(n.enemyId, 'nodeimg') : icon(n.type, nodeColor(n), null, 'nodeimg'),
      n.done && !cur ? h('div', { class: 'donemark' }, '\u2713') : null,
      cur ? h('img', { class: 'here', src: SP.pieceURL(C.mk(C.KING, 0)), alt: '' }) : null),
    h('div', { class: 'nlabel' }, nodeTitleText(n)),
    (n.diff && n.type !== 'boss') || n.tc ? h('div', { class: 'nmeta' },
      n.diff && n.type !== 'boss' ? h('span', { style: { color: D.DIFFS[n.diff].color } }, T('diff.' + n.diff)) : null,
      n.tc && n.type !== 'boss' ? h('span', { class: 'ntc' }, T('tc.' + n.tc)) : null) : null);
}
function legend() {
  const items = [['duel', '#e8c84a'], ['scenario', NODE_COLOR.scenario], ['rush', NODE_COLOR.rush], ['arena', NODE_COLOR.arena], ['shop', NODE_COLOR.shop], ['event', NODE_COLOR.event], ['rest', NODE_COLOR.rest], ['boss', NODE_COLOR.boss]];
  return h('div', { class: 'legend' }, items.map(([t, c]) => h('span', { class: 'legend-item' }, icon(t, c, null, 'chip'), T('node.' + t))));
}
// "your side of the board": army on its starting squares, potion slots and relics
function sidePanel() {
  const run = CS.run, b = new Array(64).fill(0);
  placeArmy(b, run.army, 0);
  const NAMES = { 1: 'pawn', 2: 'knight', 3: 'bishop', 4: 'rook', 5: 'queen', 6: 'king' };
  const squares = [];
  for (let r = 1; r >= 0; r--) for (let f = 0; f < 8; f++) {
    const p = b[r * 8 + f];
    squares.push(h('div', { class: 'msq ' + ((f + r) & 1 ? 'l' : 'd') }, p ? h('img', { src: SP.pieceURL(p), title: T('piece.' + NAMES[p & 7]) }) : null));
  }
  const slots = [];
  for (let i = 0; i < slotsOf(run); i++) {
    const id = run.potions[i];
    slots.push(id ? h('div', { class: 'slot', title: T('item.' + id + '.desc') }, potionIcon(id), h('span', null, T('item.' + id + '.name')))
      : h('div', { class: 'slot empty' }, h('span', null, T('side.empty'))));
  }
  const rel = run.relics.length ? run.relics.map(id => h('div', { class: 'slot', title: T('relic.' + id + '.desc') }, relicIcon(id), h('span', null, T('relic.' + id + '.name'))))
    : [h('div', { class: 'muted small' }, T('side.none'))];
  return h('div', { class: 'side panel' },
    h('div', { class: 'side-col' }, h('div', { class: 'panel-title' }, T('side.army')), h('div', { class: 'miniboard' }, squares),
      h('div', { class: 'muted small' }, T('side.value', { v: armyValue(run.army) }))),
    h('div', { class: 'side-col' }, h('div', { class: 'panel-title' }, T('side.potions') + ' (' + run.potions.length + '/' + slotsOf(run) + ')'), h('div', { class: 'slots' }, slots)),
    h('div', { class: 'side-col' }, h('div', { class: 'panel-title' }, T('side.relics')), h('div', { class: 'slots' }, rel)));
}
function showMap() {
  const run = CS.run, reach = reachable(run);
  saveRun();
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('class', 'edges');
  const layers = h('div', { class: 'maplayers' }, run.map.layers.map((layer, l) =>
    h('div', { class: 'maplayer' }, h('div', { class: 'layerlabel' }, l === 7 ? T('map.boss') : T('map.step', { n: l + 1 })), layer.map(n => nodeEl(n, reach)))));
  const inner = h('div', { class: 'mapinner' }, svg, layers);
  const wrap = h('div', { class: 'mapwrap' }, inner);
  UI.screen(h('div', { class: 'screen map' }, runHeader(),
    h('div', { class: 'row between' }, h('h2', null, T('map.title')), h('p', { class: 'muted' }, run.cur ? T('map.choose') : T('map.chooseFirst'))),
    wrap, legend(), sidePanel()));
  requestAnimationFrame(() => {
    drawEdges(inner, svg, run, reach);
    const first = inner.querySelector('.node.reach');
    if (first && first.offsetLeft > 0) wrap.scrollLeft = Math.max(0, first.offsetLeft - 140);
  });
}
function drawEdges(inner, svg, run, reach) {
  const ir = inner.getBoundingClientRect();
  svg.setAttribute('width', inner.scrollWidth); svg.setAttribute('height', inner.scrollHeight);
  const NS = 'http://www.w3.org/2000/svg';
  const medal = el => (el.querySelector && el.querySelector('.medal')) || el;
  run.map.layers.forEach((layer, l) => {
    if (l >= 7) return;
    layer.forEach(a => {
      const ea = inner.querySelector('[data-id="' + a.id + '"]'); if (!ea) return;
      for (const j of a.next) {
        const b = run.map.layers[l + 1][j], eb = inner.querySelector('[data-id="' + b.id + '"]'); if (!eb) continue;
        const ra = medal(ea).getBoundingClientRect(), rb = medal(eb).getBoundingClientRect();
        const x1 = ra.right - ir.left + 2, y1 = ra.top + ra.height / 2 - ir.top, x2 = rb.left - ir.left - 2, y2 = rb.top + rb.height / 2 - ir.top, dx = (x2 - x1) / 2;
        const path = document.createElementNS(NS, 'path');
        path.setAttribute('d', 'M' + x1 + ' ' + y1 + ' C' + (x1 + dx) + ' ' + y1 + ' ' + (x2 - dx) + ' ' + y2 + ' ' + x2 + ' ' + y2);
        path.setAttribute('class', a.done ? (b.done ? 'walked' : (reach.has(b) ? 'open' : 'dim')) : 'dim');
        svg.appendChild(path);
      }
    });
  });
}
function openNode(n) {
  UI.sfx('click');
  const rows = [];
  const row = (k, v) => rows.push(h('div', { class: 'drow' }, h('span', { class: 'muted' }, k), h('span', null, v)));
  if (n.type === 'duel' || n.type === 'boss') {
    const tc = D.TIMECTRL[n.tc], e = D.ENEMIES.find(x => x.id === n.enemyId);
    row(T('node.opponent'), T('enemy.' + e.id + '.name') + ' (' + T('style.' + e.style) + ')');
    row(T('node.trait'), h('span', { class: 'trait', title: T('trait.' + e.id + '.desc') }, T('trait.' + e.id + '.name') + ': ' + T('trait.' + e.id + '.desc')));
    row(T('node.difficulty'), h('span', { style: { color: D.DIFFS[n.diff].color } }, T('diff.' + n.diff)));
    row(T('match.objective'), T('obj.' + n.objType, { n: objN(n.objType, n.diff) }));
    row(T('match.time'), tc.base + 's' + (tc.inc ? ' +' + tc.inc + 's' : '') + '  (' + T('tc.' + n.tc) + ')');
    row(T('node.reward'), '~' + coinReward(n) + ' ' + T('coins') + ' + ' + T('node.rewardPick'));
  } else if (n.type === 'arena') {
    row(T('node.rounds'), ARENA.rounds.length);
    row(T('node.reward'), ARENA.rounds.map((_, i) => arenaPrize(n, i)).join(' / ') + ' ' + T('coins'));
  } else if (n.type === 'rush') {
    row(T('node.duration'), Math.round(root.Rush.RUSH.timeMs / 1000) + 's');
    row(T('node.perMate'), '+' + rushPer(n) + ' ' + T('coins'));
  } else if (n.type === 'scenario') {
    const sc = D.SCENARIOS.find(s => s.id === n.scenarioId);
    row(T('node.difficulty'), h('span', { style: { color: D.DIFFS[sc.diff].color } }, T('diff.' + sc.diff)));
    row(T('match.objective'), T('obj.' + sc.obj.type, { n: sc.obj.n }));
    row(T('match.time'), sc.time + 's');
    row(T('node.reward'), '~' + coinReward(Object.assign({ tc: 'rapid' }, n)) + ' ' + T('coins') + ' + ' + T('node.rewardPick'));
  }
  const desc = n.type === 'scenario' ? T('scenario.' + n.scenarioId + '.desc') : T('node.' + n.type + '.desc');
  const md = UI.modal(h('div', null, h('div', { class: 'row center' }, n.enemyId ? portrait(n.enemyId, 'big-portrait') : icon(n.type, nodeColor(n), null, 'big')),
    h('h2', null, nodeTitleText(n)), h('p', { class: 'muted' }, desc), rows,
    h('div', { class: 'row center' }, btn(T('node.go'), () => { md.close(); enterNode(n); }, 'primary'), btn(T('node.cancel'), () => md.close()))));
}
function completeNode(n) { n.done = true; CS.run.pending = null; CS.run.stats.nodes++; showMap(); }
function enterNode(n) {
  CS.run.cur = { layer: n.layer, idx: n.idx };
  setPending('node', n);
  if (n.type === 'duel' || n.type === 'boss') startDuel(n);
  else if (n.type === 'scenario') startScenario(n);
  else if (n.type === 'shop') showShop(n);
  else if (n.type === 'event') showEvent(n);
  else if (n.type === 'rush') startRush(n);
  else if (n.type === 'arena') showArena(n);
  else showRest(n);
}

// ------------------------------------------------------------------ matches
function timeFor(baseSec, incSec) {
  const run = CS.run;
  return {
    playerMs: baseSec * 1000 + 5000 * lvl('bank') + (run.relics.includes('watch') ? 10000 : 0),
    enemyMs: baseSec * 1000,
    playerInc: (incSec + (run.relics.includes('charm') ? 1 : 0)) * 1000, enemyInc: incSec * 1000,
  };
}
// long clocks get calm music; only bullet games get the fast track
const TC_MUSIC = { rapid: 'calm', blitz: 'battle', bullet: 'rush' };
function startDuel(n) {
  const run = CS.run, df = D.DIFFS[n.diff], tc = D.TIMECTRL[n.tc], e = D.ENEMIES.find(x => x.id === n.enemyId);
  const pv = armyValue(run.army);
  const bf = n.intro ? D.INTRO.budget : df.budget;
  const budget = Math.max(2, Math.round(pv * bf[0] + bf[1]));
  const objType = (n.objType === 'captureQueen' && budget < 12) || (n.objType === 'promote' && !run.army.p) ? 'mate' : n.objType;
  const ea = buildEnemyArmy(budget, objType === 'captureQueen');
  if (e.id === 'skeleton' && ea.p < D.MAX_ARMY.p) ea.p++;   // trait: wall of bones
  const pieces = D.PIECE_ORDER.reduce((t, k) => t + ea[k], 0);
  launchMatch({
    fen: setupFEN(run.army, ea), playerColor: 0,
    enemy: Object.assign({ id: e.id, style: e.style, tier: n.diff, thief: e.thief || 0, hourglass: e.hourglass || 0 }, n.intro ? { depth: D.INTRO.depth, blunder: D.INTRO.blunder } : {}),
    objective: { type: objType, n: objType === 'capture' ? Math.min(objN(objType, n.diff), pieces) : objN(objType, n.diff) }, time: timeFor(tc.base, tc.inc),
    note: T('match.armyNote', { you: armyStr(run.army), foe: armyStr(ea) }),
    music: n.diff === 'boss' ? 'boss' : TC_MUSIC[n.tc],
    onSteal: c => { const t = Math.min(c, run.coins); run.coins -= t; return t; },
  }, n);
}
function startScenario(n) {
  const sc = D.SCENARIOS.find(s => s.id === n.scenarioId), pos = C.Position.fromFEN(sc.fen);
  launchMatch({
    fen: sc.fen, playerColor: pos.turn,
    enemy: { id: 'rival', style: sc.style, tier: sc.diff, thief: 0, hourglass: 0 },
    objective: sc.obj, time: timeFor(sc.time, 0), note: T('scenario.' + sc.id + '.desc'), music: 'calm',
  }, n);
}
function launchMatch(cfg, node, itemsOverride) {
  const run = CS.run;
  cfg.items = (itemsOverride || run.potions).slice(); cfg.relics = run.relics.slice();
  const snapshot = (itemsOverride || run.potions).slice();
  cfg.onEnd = (res, m) => onMatchEnd(res, m, cfg, node, snapshot);
  cfg.onBegin = () => setPending('match', node);
  if (CS.match) CS.match.destroy();
  const screen = h('div', { class: 'screen match-screen' });
  UI.screen(screen);
  CS.match = new root.Match(cfg);
  CS.match.mount(screen);
}
function onMatchEnd(res, m, cfg, node, snapshot) {
  const run = CS.run;
  if (res.win) {
    run.potions = m.items.slice();
    const coins = coinReward(node.tc ? node : Object.assign({ tc: 'rapid' }, node));
    run.coins += coins; run.stats.wins++; setPending('rewards', node);
    m.showResult(T('result.win'), T('reason.' + res.reason) + '   +' + coins + ' ' + T('coins'),
      [{ label: T('result.continue'), cls: 'primary', onClick: () => {
        UI.sfx('coin'); CS.match.destroy(); CS.match = null; afterWin(node);
      } }], true);
  } else {
    setPending('lost', node); run.lastFoe = cfg.enemy.id;
    const buttons = [];
    if (run.retries > 0) buttons.push({ label: T('result.retry', { n: run.retries }), cls: 'primary', onClick: () => { run.retries--; setPending('node', node); launchMatch(cfg, node, snapshot); } });
    buttons.push({ label: T('result.endRun'), cls: 'danger', onClick: () => { CS.match.destroy(); CS.match = null; endRun(false); } });
    m.showResult(T('result.lose'), T('reason.' + res.reason) + (run.retries > 0 ? '' : '  ' + T('result.noRetries')), buttons, false);
  }
}

// ------------------------------------------------------------------ Mate Rush bonus node
const rushPer = n => Math.round((4 + n.layer) * (1 + 0.1 * lvl('purse')) * (CS.run.relics.includes('lucky') ? 1.25 : 1));
function startRush(n) {
  const run = CS.run;
  setPending('done', n);   // leaving in the middle forfeits the bonus instead of replaying it
  root.Rush.start({ level: n.layer, perMate: rushPer(n), onDone: (score, coins) => {
    run.coins += coins; saveRun();
    if (coins) UI.sfx('buy');
    UI.screen(h('div', { class: 'screen center-screen' }, runHeader(),
      h('h1', { class: 'rush-title' }, T('rush.title')),
      h('p', null, T('rush.result', { n: score, c: coins })),
      h('div', { class: 'row center' }, btn(T('result.continue'), () => completeNode(n), 'primary'))));
  } });
}

// ------------------------------------------------------------------ Arena node
// Three short duels in a row against weak monsters. Each win pays coins at
// once; you may retire between rounds, and losing only ends the Arena.
const ARENA = { rounds: [{ diff: 'easy', pay: 1 }, { diff: 'easy', pay: 1.5 }, { diff: 'normal', pay: 2.2 }], tc: 'blitz' };
const arenaPrize = (n, i) => Math.round((8 + n.layer * 2) * ARENA.rounds[i].pay * (1 + 0.1 * lvl('purse')) * (CS.run.relics.includes('lucky') ? 1.25 : 1));
function showArena(n) {
  const run = CS.run;
  setPending('done', n);   // leaving mid-arena keeps what you won but ends it
  const A = n.arena = n.arena || { round: 0, won: 0 };
  if (!A.foes) A.foes = ARENA.rounds.map(r => pickOne(D.ENEMIES.filter(e => e.tier === r.diff)).id);
  saveRun();
  const steps = ARENA.rounds.map((r, i) => h('div', { class: 'arena-step' + (i < A.round ? ' won' : i === A.round ? ' next' : '') },
    h('img', { class: 'nodeimg', src: root.Portraits.url(A.foes[i], i < A.round ? 'ko' : 'idle'), alt: '' }),
    h('div', { class: 'small' }, T('arena.round', { n: i + 1 })), h('b', { class: 'gold' }, '+' + arenaPrize(n, i))));
  const left = A.round < ARENA.rounds.length;
  UI.screen(h('div', { class: 'screen center-screen' }, runHeader(), icon('arena', NODE_COLOR.arena, null, 'big'),
    h('h2', null, T('node.arena')), h('p', { class: 'muted' }, left ? T('arena.intro') : T('arena.cleared')),
    h('div', { class: 'row center arena-steps' }, steps),
    A.won ? h('p', null, T('arena.won', { c: A.won })) : null,
    h('div', { class: 'row center' },
      left ? btn(T('arena.fight', { n: A.round + 1 }), () => arenaRound(n), 'primary') : null,
      btn(left ? (A.round ? T('arena.retire') : T('arena.skip')) : T('result.continue'), () => completeNode(n), left ? '' : 'primary'))));
}
function arenaRound(n) {
  const run = CS.run, A = n.arena, r = ARENA.rounds[A.round], e = D.ENEMIES.find(x => x.id === A.foes[A.round]), tc = D.TIMECTRL[ARENA.tc];
  const ea = buildEnemyArmy(Math.max(2, Math.round(armyValue(run.army) * D.DIFFS[r.diff].budget[0])), false);
  const pieces = D.PIECE_ORDER.reduce((t, k) => t + ea[k], 0);
  const cfg = {
    fen: setupFEN(run.army, ea), playerColor: 0, enemy: { id: e.id, style: e.style, tier: r.diff, thief: 0, hourglass: 0 },
    objective: { type: 'capture', n: Math.min(2, pieces) }, time: timeFor(tc.base, tc.inc), music: TC_MUSIC[ARENA.tc],
    items: run.potions.slice(), relics: run.relics.slice(), note: T('arena.note'),
    onSteal: c => { const t = Math.min(c, run.coins); run.coins -= t; return t; },
  };
  cfg.onEnd = (res, m) => {
    run.potions = m.items.slice();
    const prize = arenaPrize(n, A.round);
    if (res.win) { A.round++; A.won += prize; run.coins += prize; run.stats.wins++; saveRun(); }
    m.showResult(res.win ? T('arena.roundWon', { c: prize }) : T('arena.out'), T('reason.' + res.reason),
      [{ label: T('result.continue'), cls: 'primary', onClick: () => { UI.sfx(res.win ? 'buy' : 'click'); CS.match.destroy(); CS.match = null; if (res.win) showArena(n); else completeNode(n); } }], res.win);
  };
  if (CS.match) CS.match.destroy();
  const screen = h('div', { class: 'screen match-screen' });
  UI.screen(screen);
  CS.match = new root.Match(cfg);
  CS.match.mount(screen);
}

function afterWin(node) {
  if (node.type === 'boss') { node.done = true; CS.run.stats.nodes++; endRun(true); } else showRewards(node);
}

// ------------------------------------------------------------------ save / continue
// The run is saved between nodes. Leaving during a battle counts as losing it
// (a Retry is spent if there is one), so reloading can't undo a bad game.
function saveRun() { if (CS.run) UI.store.saveRun(CS.run); }
const savedRun = () => { const r = UI.store.loadRun(); return r && r.map ? r : null; };
function setPending(stage, n) { CS.run.pending = { id: n.id, stage }; saveRun(); }
function continueRun() {
  const run = savedRun();
  if (!run) { showTitle(); return; }
  CS.run = run;
  const p = run.pending, n = p && run.map.layers.flat().find(x => x.id === p.id);
  if (!n) { run.pending = null; showMap(); return; }
  if (p.stage === 'match' || p.stage === 'lost') {
    if (run.retries > 0) { run.retries--; UI.toast(T('toast.resumeRetry'), 'bad'); enterNode(n); }
    else { UI.toast(T('toast.resumeLost'), 'bad'); endRun(false); }
  } else if (p.stage === 'rewards') afterWin(n);
  else if (p.stage === 'done') completeNode(n);
  else enterNode(n);
}

// ------------------------------------------------------------------ rewards / shop / event / rest
function rewardCard(o, onPick) {
  let ico, title, desc;
  if (o.kind === 'piece') { ico = pieceImg(o.k); title = T('piece.' + PIECE_NAME[o.k]); desc = T('reward.piece'); }
  else if (o.kind === 'potion') { ico = potionIcon(o.id); title = T('item.' + o.id + '.name'); desc = T('item.' + o.id + '.desc'); }
  else if (o.kind === 'relic') { ico = relicIcon(o.id); title = T('relic.' + o.id + '.name'); desc = T('relic.' + o.id + '.desc'); }
  else { ico = h('img', { class: 'icon', src: SP.iconURL('coin', '#f0d060') }); title = '+' + o.amount + ' ' + T('coins'); desc = ''; }
  const color = o.kind === 'potion' ? D.POTIONS[o.id].color : o.kind === 'relic' ? D.RELICS[o.id].color : null;
  const el = card('button', o.kind, color, ico, title, desc, null, 'pick' + (o.taken ? ' taken' : ''),
    () => { if (!el.disabled && !o.taken) { el.disabled = true; el.classList.add('taken'); onPick(); } });
  if (o.taken) el.disabled = true;
  return el;
}
function showRewards(node) {
  const run = CS.run;
  if (!run.pending || run.pending.id !== node.id) run.pending = { id: node.id, stage: 'rewards' };
  const p = run.pending;
  if (!p.rewards) { p.rewards = makeRewards(node.diff); p.left = node.diff === 'hard' ? 2 : 1; saveRun(); }
  const info = h('p', { class: 'muted' }, T('reward.pick', { n: p.left }));
  p.rerolls = p.rerolls || 0;
  const rc = rerollCost(p.rerolls), canReroll = run.coins >= rc && !p.rewards.some(o => o.taken);
  const reroll = h('button', { class: 'btn reroll' + (canReroll ? '' : ' disabled'), disabled: !canReroll, onclick: () => {
    run.coins -= rc; p.rerolls++; p.rewards = makeRewards(node.diff); saveRun(); UI.sfx('reroll'); showRewards(node);
  } }, rc ? T('shop.reroll', { c: rc }) : T('shop.rerollFree'));
  const cards = h('div', { class: 'grid' }, p.rewards.map(o => rewardCard(o, () => {
    if (p.left <= 0) return;
    o.taken = true; applyReward(o); UI.sfx('buy'); p.left--; info.textContent = T('reward.pick', { n: p.left }); saveRun();
    if (p.left <= 0) setTimeout(() => completeNode(node), 450);
  })));
  UI.screen(h('div', { class: 'screen' }, runHeader(), h('div', { class: 'row between' }, h('h2', null, T('reward.title')), reroll), info, cards,
    h('div', { class: 'row center' }, btn(T('reward.skip'), () => { run.coins += 5; completeNode(node); }, 'small'))));
}
function makeStock(run) {
  const pieces = [];
  if (run.army.p < D.MAX_ARMY.p) pieces.push('p');
  const other = ['n', 'b', 'r'].filter(k => run.army[k] < D.MAX_ARMY[k]);
  if (other.length) pieces.push(pickOne(other));
  if (run.army.q < 1 && chance(0.35)) pieces.push('q');
  const rl = unownedRelics(run);
  return { potions: [0, 1, 2].map(() => ({ id: randomPotion() })), relic: rl.length ? { id: pickOne(rl) } : null, pieces: pieces.map(k => ({ k })) };
}
const rerollCost = k => (k ? 10 * k : 0);       // 1st reroll free, then 10, 20, 30...
function showShop(n) {
  const run = CS.run;
  if (!n.stock) { n.stock = makeStock(run); n.rerolls = n.rerolls || 0; }
  const S = n.stock;
  const buy = (entry, price, apply) => {
    if (entry.sold || run.coins < price || !apply()) return;
    run.coins -= price; entry.sold = true; UI.sfx('buy'); showShop(n);
  };
  const shopCard = (entry, kind, color, ico, title, desc, price, apply) => card('div', kind, color, ico, title, desc,
    entry.sold ? h('div', { class: 'tag' }, T('shop.sold')) : priceBtn(price, run.coins >= price, () => buy(entry, price, apply)),
    entry.sold ? 'maxed' : (run.coins >= price ? 'buyable' : ''));
  const cards = [];
  for (const e of S.potions) cards.push(shopCard(e, 'potion', D.POTIONS[e.id].color, potionIcon(e.id), T('item.' + e.id + '.name'), T('item.' + e.id + '.desc'), D.POTIONS[e.id].price,
    () => { if (run.potions.length >= slotsOf(run)) { UI.toast(T('shop.bagFull'), 'bad'); return false; } run.potions.push(e.id); return true; }));
  if (S.relic) cards.push(shopCard(S.relic, 'relic', D.RELICS[S.relic.id].color, relicIcon(S.relic.id), T('relic.' + S.relic.id + '.name'), T('relic.' + S.relic.id + '.desc'), D.RELICS[S.relic.id].price, () => { addRelic(S.relic.id); return true; }));
  for (const e of S.pieces) cards.push(shopCard(e, 'piece', null, pieceImg(e.k), T('piece.' + PIECE_NAME[e.k]), T('reward.piece'), D.PRICE[e.k], () => { run.army[e.k]++; return true; }));
  const rc = rerollCost(n.rerolls), canReroll = run.coins >= rc;
  const reroll = h('button', { class: 'btn reroll' + (canReroll ? '' : ' disabled'), disabled: !canReroll, onclick: () => {
    run.coins -= rc; n.rerolls++; n.stock = makeStock(run); UI.sfx('reroll'); showShop(n);
  } }, rc ? T('shop.reroll', { c: rc }) : T('shop.rerollFree'));
  saveRun();
  UI.screen(h('div', { class: 'screen' }, runHeader(), h('div', { class: 'row between' }, h('div', null, h('h2', null, T('node.shop')), h('p', { class: 'muted' }, T('shop.intro'))), reroll),
    h('div', { class: 'grid' }, cards), h('div', { class: 'row center' }, btn(T('shop.leave'), () => completeNode(n), 'primary')), sidePanel()));
}
function showEvent(n) {
  const run = CS.run, ev = EVENTS[n.eventId];
  const choices = ev.choices.map(c => {
    const ok = !c.need || c.need(run);
    return h('button', { class: 'btn ' + (ok ? '' : 'disabled'), disabled: !ok, onclick: () => {
      UI.sfx('click');
      const r = c.apply(run), msg = r === 'left' ? T('event.res.left') : T('event.' + n.eventId + '.res.' + r);
      setPending('done', n);
      UI.screen(h('div', { class: 'screen center-screen' }, runHeader(), h('h2', null, T('event.' + n.eventId + '.title')), h('p', null, msg),
        h('div', { class: 'row center' }, btn(T('result.continue'), () => completeNode(n), 'primary'))));
    } }, T('event.' + n.eventId + '.' + c.id));
  });
  UI.screen(h('div', { class: 'screen center-screen' }, runHeader(), h('h2', null, T('event.' + n.eventId + '.title')),
    h('p', null, T('event.' + n.eventId + '.desc')), h('div', { class: 'column' }, choices)));
}
function showRest(n) {
  const run = CS.run;
  const options = [
    { id: 'heal', ok: run.retries < 3, run: () => { run.retries++; } },
    { id: 'train', ok: run.army.p < D.MAX_ARMY.p, run: () => { run.army.p++; } },
    { id: 'brew', ok: true, run: () => { addPotion(randomPotion()); } },
  ];
  UI.screen(h('div', { class: 'screen center-screen' }, runHeader(), icon('rest', '#ff9f5a', null, 'big'), h('h2', null, T('node.rest')), h('p', { class: 'muted' }, T('rest.intro')),
    h('div', { class: 'column' }, options.map(o => h('button', { class: 'btn ' + (o.ok ? '' : 'disabled'), disabled: !o.ok, onclick: () => { UI.sfx('potion'); o.run(); completeNode(n); } }, T('rest.' + o.id))))));
}

// ------------------------------------------------------------------ end of run
function endRun(victory) {
  const run = CS.run, m = CS.meta;
  if (CS.match) { CS.match.destroy(); CS.match = null; }
  const crowns = 5 + run.stats.wins * 5 + (run.stats.nodes - run.stats.wins) * 2 + (victory ? 40 : 0) + Math.floor(run.coins / 10);
  const cheapest = Math.min(...D.META.filter(u => lvl(u.id) < u.max).map(u => u.cost[lvl(u.id)]));
  m.crowns += crowns; m.stats.runs++; if (victory) m.stats.wins++;
  m.stats.bestNodes = Math.max(m.stats.bestNodes, run.stats.nodes);
  const step = run.cur ? run.cur.layer + 1 : 0;   // where the run ended, for balancing (last 30 runs)
  m.stats.history = (m.stats.history || []).concat({ step, nodes: run.stats.nodes, wins: run.stats.wins, victory: !!victory, by: victory ? null : run.lastFoe || null }).slice(-30);
  saveMeta(); CS.run = null; UI.store.saveRun(null);
  UI.sfx(victory ? 'win' : 'lose');
  UI.screen(h('div', { class: 'screen center-screen' },
    h('h1', { class: victory ? 'good' : 'bad' }, T(victory ? 'end.victory' : 'end.defeat')),
    h('p', null, T(victory ? 'end.victoryText' : 'end.defeatText')),
    h('div', { class: 'panel' },
      h('div', { class: 'drow' }, h('span', { class: 'muted' }, T('end.nodes')), h('b', null, run.stats.nodes)),
      h('div', { class: 'drow' }, h('span', { class: 'muted' }, T('end.wins')), h('b', null, run.stats.wins)),
      h('div', { class: 'drow' }, h('span', { class: 'muted' }, T('end.crowns')), h('b', null, '+' + crowns))),
    m.crowns >= cheapest ? h('p', { class: 'tip' }, T('end.canBuy')) : null,
    h('div', { class: 'menu' }, btn(T('title.shop') + '  (' + m.crowns + ' ' + T('crowns') + ')', showMetaShop, 'primary'), btn(T('end.again'), startRun), btn(T('end.title'), showTitle))));
}

// Browsers only allow audio after a user gesture: a "click to start" screen
// unlocks it so the menu music is already playing on the title screen.
function showSplash() {
  let done = false;
  const go = () => { if (done) return; done = true; document.removeEventListener('keydown', go); UI.sfx('click'); showTitle(); };
  document.addEventListener('keydown', go);
  UI.screen(h('div', { class: 'screen title splash', onclick: go },
    h('div', { class: 'logo' }, h('div', { class: 'logo-1' }, 'CHECKMATE'), h('div', { class: 'logo-2' }, 'SURVIVORS')),
    h('div', { class: 'row center deco' }, ['goblin', 'werewolf', 'medusa', 'skeleton'].map((id, i) => h('img', { class: 'title-monster', style: { animationDelay: (i * 0.2) + 's' }, src: root.Portraits.url(id, 'idle'), alt: '' }))),
    h('div', { class: 'blink' }, T('title.clickToStart')),
    h('div', { class: 'version' }, T('title.version', { v: D.VERSION }))));
}
CS.init = function () { loadMeta(); if (UI.audioAvailable()) showSplash(); else showTitle(); };
CS._test = { continueRun, savedRun, genMap, buildEnemyArmy, setupFEN, newRun, armyValue, makeRewards, EVENTS, reachable };
})(window);
