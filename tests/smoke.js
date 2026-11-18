// Headless smoke test: loads the real game scripts in a fake browser (minimal DOM stub) and plays through a run.
const fs = require('fs'), path = require('path'), vm = require('vm');
const rootDir = path.join(__dirname, '..');
const realST = setTimeout;
const sleep = ms => new Promise(r => realST(r, ms));

class N {
  constructor(tag, text) { this.tagName = String(tag).toUpperCase(); this.nodeType = text !== undefined ? 3 : 1; this.children = []; this.attrs = {}; this.listeners = {}; this.style = {}; this.parent = null; this._text = text || ''; this.className = ''; this.disabled = false; this.width = 0; this.height = 0; this.scrollTop = 0;
    const self = this;
    this.classList = {
      add: c => { const s = new Set(self.className.split(/\s+/).filter(Boolean)); s.add(c); self.className = [...s].join(' '); },
      remove: c => { self.className = self.className.split(/\s+/).filter(x => x && x !== c).join(' '); },
      toggle: (c, f) => { const has = self.className.split(/\s+/).includes(c); if (f === undefined ? !has : f) self.classList.add(c); else self.classList.remove(c); },
      contains: c => self.className.split(/\s+/).includes(c) };
  }
  appendChild(c) { if (c.parent) c.parent.removeChild(c); c.parent = this; this.children.push(c); return c; }
  append(...cs) { cs.forEach(c => this.appendChild(c)); }
  removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); c.parent = null; }
  remove() { if (this.parent) this.parent.removeChild(this); }
  setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'class') this.className = String(v); if (k === 'disabled') this.disabled = true; if (k === 'width') this.width = +v; if (k === 'height') this.height = +v; }
  getAttribute(k) { return this.attrs[k]; }
  addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); }
  click() { if (this.disabled) return; for (const fn of (this.listeners.click || [])) fn({ clientX: 0, clientY: 0 }); }
  set innerHTML(v) { this.children.forEach(c => c.parent = null); this.children = []; this._text = ''; }
  get innerHTML() { return ''; }
  set textContent(v) { this.children.forEach(c => c.parent = null); this.children = []; this._text = String(v); }
  get textContent() { return this._text + this.children.map(c => c.textContent).join(''); }
  querySelector(sel) { const m = sel.match(/\[data-id="([^"]+)"\]/); const id = m && m[1]; let found = null; (function w(n) { if (found) return; if (n.attrs && n.attrs['data-id'] === id) { found = n; return; } n.children.forEach(w); })(this); return found; }
  getBoundingClientRect() { return { left: 0, top: 0, right: 100, bottom: 30, width: 512, height: 512 }; }
  get scrollWidth() { return 1000; } get scrollHeight() { return 500; }
  getContext() { return new Proxy({}, { get: (t, k) => (k in t ? t[k] : (k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {})), set: (t, k, v) => { t[k] = v; return true; } }); }
  toDataURL() { return 'data:,x'; }
}
const body = new N('body'), app = new N('div'); body.appendChild(app);
const store = {};
const ctx = {
  console, setTimeout: (fn, ms) => realST(fn, Math.min(ms || 0, 6)), clearTimeout, setInterval, clearInterval, performance,
  document: { createElement: t => new N(t), createElementNS: (ns, t) => new N(t), createTextNode: s => new N('#text', String(s)), getElementById: () => app, body },
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
  confirm: () => true, scrollTo() {}, requestAnimationFrame: fn => realST(fn, 16), cancelAnimationFrame: clearTimeout,
};
ctx.window = ctx; vm.createContext(ctx);
for (const f of ['chess', 'ai', 'sprites', 'portraits', 'data', 'i18n', 'ui', 'match', 'run', 'rush', 'main']) vm.runInContext(fs.readFileSync(path.join(rootDir, 'js', f + '.js'), 'utf8'), ctx, { filename: f + '.js' });
const { CS, Chess: C, AI, Data: D, I18N } = ctx;

let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } else console.log('OK  ', m); };
const all = (n, out = []) => { out.push(n); n.children.forEach(c => all(c, out)); return out; };
const buttons = () => all(body).filter(n => n.tagName === 'BUTTON');
const findBtn = text => buttons().find(b => b.textContent.includes(text) && !b.disabled);
const pageText = () => body.textContent;
async function waitFor(cond, ms = 15000, what = '') { const t0 = Date.now(); while (!cond()) { if (Date.now() - t0 > ms) throw new Error('timeout waiting for ' + what); await sleep(8); } }

// ---------- structural checks (maps, armies, FEN) ----------
function structural() {
  for (let i = 0; i < 300; i++) {
    const m = CS._test.genMap(), L = m.layers;
    for (let l = 0; l < 7; l++) for (const a of L[l]) if (!a.next.length) { fail++; console.log('FAIL node without exit', a.id); return; }
    for (let l = 1; l < 8; l++) for (let j = 0; j < L[l].length; j++) if (!L[l - 1].some(a => a.next.includes(j))) { fail++; console.log('FAIL node without entrance', l, j); return; }
    if (!L[3].some(n => n.type === 'shop') || !L[3].some(n => n.type === 'rest')) { fail++; console.log('FAIL layer 3 needs shop+rest'); return; }
    if (L[7][0].type !== 'boss') { fail++; console.log('FAIL boss'); return; }
    if (!L[2].some(n => n.type === 'rush')) { fail++; console.log('FAIL step 3 needs a Mate Rush'); return; }
    if (!L[4].some(n => n.type === 'arena')) { fail++; console.log('FAIL step 5 needs an Arena'); return; }
    for (let l = 0; l < 7; l++) for (const a of L[l]) for (const j of a.next) if ((a.type === L[l + 1][j].type && ['shop', 'rest', 'event', 'rush', 'arena', 'elite'].includes(a.type)) || (a.enemyId && a.enemyId === L[l + 1][j].enemyId)) { fail++; console.log('FAIL repeated node along a path', a.id, a.type); return; }
  }
  ok(true, '300 random maps: every node has entrance/exit, a Mate Rush at step 3, shop+rest at step 4, an Arena at step 5, no shop->shop or same-monster repeats, boss at the end');
  let bad = 0;
  for (let pts = 1; pts <= 60; pts++) for (let q = 0; q < 2; q++) {
    const a = CS._test.buildEnemyArmy(pts, !!q);
    for (const k of ['p', 'n', 'b', 'r', 'q']) if (a[k] > D.MAX_ARMY[k]) bad++;
    const fen = CS._test.setupFEN({ p: 4, n: 0, b: 0, r: 0, q: 0 }, a), pos = C.Position.fromFEN(fen);
    if (pos.kingSq[0] < 0 || pos.kingSq[1] < 0 || pos.inCheck(0) || pos.inCheck(1) || pos.gameStatus().over) bad++;
  }
  ok(bad === 0, 'enemy armies never exceed a standard army and always produce legal starting positions');
  const full = CS._test.setupFEN({ p: 8, n: 2, b: 2, r: 2, q: 1 }, { p: 8, n: 2, b: 2, r: 2, q: 1 });
  ok(full.split(' ')[0] === C.START_FEN.split(' ')[0], 'a full army reproduces the standard start position');
  CS.meta = { crowns: 0, levels: {}, stats: { runs: 0, wins: 0, bestNodes: 0 } };
  CS.run = CS._test.newRun();
  {   // potions of the same kind stack in one slot, up to their stack size
    const st = CS._test.potionStacks(['hint', 'hint', 'rewind', 'hint', 'rewind', 'hint', 'hint', 'hint', 'hint']);
    ok(st.length === 2 && st[0].n === 7 && st[1].n === 2, 'potions of the same kind stack in one slot without a practical limit');
    const r = { potions: ['hint', 'hint', 'hint', 'hint', 'thief', 'freeze'], relics: [] };
    ok(CS._test.canAddPotion(r, 'hint') && !CS._test.canAddPotion(r, 'rewind'), 'a full bag still takes a potion that fits an open stack');
    ok(CS._test.shopPrice({ relics: ['merchant'] }, 100) === 80 && CS._test.shopPrice({ relics: [] }, 100) === 100, "merchant's ring: shop prices -20%");
  }
  {   // veteran pieces: a named roster mirrors the army; survivors of won battles earn medals that pay coins
    const r = CS._test.newRun(); r.army = { p: 3, n: 1, b: 0, r: 0, q: 0 }; CS._test.syncRoster(r);
    ok(r.roster.p.length === 3 && r.roster.n.length === 1 && new Set(r.roster.p.map(v => v.name)).size === 3, 'veterans: every piece gets its own name');
    const ids = CS._test.vetIds(r, 0);
    ok(ids.filter(Boolean).length === 4 && ids[8 + 3] && ids[8 + 3].k === 'p', 'veterans: each piece is placed on its starting square');
    let pay = 0; for (let i = 0; i < 3; i++) pay = CS._test.rewardVets(r, { ids: CS._test.vetIds(r, 0) });
    ok(r.roster.p[0].b === 3 && pay === 4, 'veterans: after 3 won battles every survivor wears a bronze medal and pays a coin');
    r.army.p = 2; CS._test.syncRoster(r); ok(r.roster.p.length === 2, 'veterans: the roster shrinks when the army does');
  }
  let badR = 0;
  for (let i = 0; i < 200; i++) for (const d of ['easy', 'normal', 'hard']) { const rs = CS._test.makeRewards(d); for (const o of rs) if (o.kind === 'piece' && CS.run.army[o.k] >= D.MAX_ARMY[o.k]) badR++; }
  ok(badR === 0, 'rewards never offer a piece beyond the standard army');
  let evErr = 0;
  for (const [id, ev] of Object.entries(CS._test.EVENTS)) for (const c of ev.choices) for (let t = 0; t < 30; t++) {
    CS.run = CS._test.newRun(); CS.run.coins = [0, 25, 100][t % 3]; CS.run.potions = t % 2 ? ['hint'] : [];
    try { if (!c.need || c.need(CS.run)) { const r = c.apply(CS.run); if (typeof r !== 'string' || CS.run.coins < 0 || CS.run.army.p < 1) evErr++; } } catch (e) { evErr++; console.log(e.stack); }
  }
  ok(evErr === 0, 'every event choice applies cleanly (no negative coins, always keeps a pawn)');
}

// ---------- full run through the UI ----------
async function playMatch(m, opts) {
  await waitFor(() => findBtn('Begin battle'), 3000, 'begin button'); findBtn('Begin battle').click();
  const fens = {};
  let usedItems = false, rewound = false;
  while (!m.over) {
    await sleep(6);
    if (m.over || m.thinking || m.paused || !m.started || m.pos.turn !== m.pc) continue;
    if (opts.cheat) { m.finish({ win: true, reason: 'mate' }); break; }
    if (opts.items && !usedItems) {
      usedItems = true;
      const before = m.clock[m.pc];
      for (const id of ['threats', 'hourglass', 'thief', 'freeze']) m.useItem(id);
      ok(m.threatSqs !== null && m.clock[m.pc] > before && m.frozen, 'potions threats/hourglass/thief/freeze applied');
      m.useItem('hint'); await waitFor(() => !m.paused, 5000, 'hint');
      ok(!!m.hintMove, 'hint potion produced a move');
      m.useItem('rewind'); ok(m.log.length === 0 && m.items.includes('rewind'), 'rewind refuses when there is nothing to undo');
    }
    if (opts.items && m.playerMoves === 2 && !rewound) {
      rewound = true; const n = m.playerMoves;
      m.useItem('rewind');
      ok(m.playerMoves === n - 1 && m.pos.toFEN() === fens[n - 1], 'rewind restores the exact earlier position');
      continue;
    }
    fens[m.playerMoves] = m.pos.toFEN();
    const r = AI.choose(m.pos, { depth: 2, timeMs: 40, style: 'balanced' });
    if (!r) break;
    m.onSquare(C.mFrom(r.move)); m.onSquare(C.mTo(r.move));
    const promo = buttons().find(b => b.className.includes('promo')); if (promo) promo.click();
    await sleep(4);
  }
  await waitFor(() => findBtn('Continue') || findBtn('End run') || findBtn('Retry battle'), 5000, 'result buttons');
}
async function claimRewards() {
  await waitFor(() => pageText().includes('Spoils of victory'), 3000, 'reward screen');
  for (let i = 0; i < 3 && pageText().includes('Spoils of victory'); i++) {
    const card = buttons().find(b => b.className.includes('card pick') && !b.disabled); if (!card) break;
    card.click(); await sleep(60);
  }
  await waitFor(() => pageText().includes('Choose your path'), 3000, 'map after rewards');
}
const kinds = new Set();
let actTwoDone = false, blackDone = false;
// after the Act 1 boss: the first time descend into Act 2 and check it, afterwards retire victorious
async function actTwo() {
  ok(pageText().includes('Act 1 cleared'), 'beating the Act 1 boss opens the great campfire between acts');
  const am = buttons().find(b => b.className.includes('card pick') && !b.disabled); if (am) am.click();
  if (actTwoDone) { findBtn('Retire victorious').click(); ok(pageText().includes('VICTORY') || pageText().includes('Crowns earned'), 'retiring after Act 1 ends the run as a victory'); return; }
  actTwoDone = true; findBtn('Continue to Act 2').click();
  const L = CS.run.map.layers, foes = L.flat().filter(n => n.enemyId).map(n => n.enemyId);
  ok(CS.run.act === 2 && L[7][0].enemyId === 'necromancer' && pageText().includes('Catacombs'), 'Act 2 map: the Catacombs with the Necromancer as boss');
  ok(foes.every(id => { const e = D.ENEMIES.find(x => x.id === id); return (e.act || 1) === 2 || e.tier === 'hard'; }), 'Act 2 only fields Catacomb monsters (plus act 1 hard ones)');
  for (let i = 0; i < 40; i++) { const m = CS._test.genMap(2); if (m.layers.flat().some(n => n.enemyId && !D.ENEMIES.some(e => e.id === n.enemyId))) { fail++; console.log('FAIL act 2 map with an unknown monster'); break; } }
  // Act 2 cleared: the campfire leads up to the Castle
  const boss2 = CS.run.map.layers[7][0]; CS._test.showActClear(boss2);
  ok(pageText().includes('Act 2 cleared') && !!findBtn('Continue to Act 3'), 'beating the Act 2 boss opens the campfire towards Act 3');
  findBtn('Continue to Act 3').click();
  const L3 = CS.run.map.layers, foes3 = L3.flat().filter(n => n.enemyId).map(n => D.ENEMIES.find(e => e.id === n.enemyId));
  ok(CS.run.act === 3 && L3[7][0].enemyId === 'shadowking' && pageText().includes('The Castle') && CS.meta.ach.act3, 'Act 3 map: the Castle with the Shadow King as boss (achievement unlocked)');
  ok(foes3.every(e => (e.act || 1) === 3 || (e.tier === 'hard' && e.act === 2)), 'Act 3 only fields Castle monsters (plus the act 2 hard one)');
  ok(!L3.flat().some(n => n.diff === 'easy'), 'Act 3 has no easy fights');
  findBtn('Abandon').click();
}
async function fullRun(first) {
  if (first) {
    CS.init(); await sleep(10);
    ok(pageText().includes('CHECKMATE') && pageText().includes('Start Run'), 'title screen renders');
    findBtn('Start Run').click();
    ok(pageText().includes('Choose your path'), 'map screen renders');
    CS.run.potions = ['rewind', 'hint', 'threats', 'hourglass', 'thief', 'freeze'];
  } else {
    if (CS.run) findBtn('Abandon').click();
    await sleep(5); findBtn('New run').click();
  }
  let ended = false, played = first ? 0 : 1;
  for (let step = 0; step < 12 && !ended; step++) {
    const reach = [...CS._test.reachable(CS.run)];
    if (!reach.length) break;
    const node = reach.find(n => !kinds.has(n.type)) || reach[(step * 5) % reach.length];
    kinds.add(node.type);
    const blackNow = node.type === 'duel' && !blackDone && played >= 1; if (blackNow) { node.black = true; blackDone = true; }   // not the potion-test battle
    const el = all(body).find(n => n.attrs && n.attrs['data-id'] === node.id);
    el.click(); findBtn('Go!').click();
    if (node.type === 'duel' || node.type === 'boss' || node.type === 'scenario' || node.type === 'elite') {
      const m = CS.match; ok(!!m, 'match mounted for ' + node.type + ' ' + node.id);
      if (blackNow) ok(m.pc === C.BLACK && m.flip && m.pos.board[60] === C.mk(C.KING, C.BLACK) && m.pos.turn === C.WHITE, 'a duel with Black: your king on e8, the board flipped and the monster moves first');
      if (node.type === 'boss') m.enemy.thief = 3;
      await playMatch(m, { cheat: played >= 1 && node.type !== 'scenario', items: played === 0 }); played++;
      if (m.result.win) { findBtn('Continue').click(); if (node.type === 'boss') { await sleep(10); await actTwo(); ended = true; break; } await claimRewards(); }
      else if (findBtn('Retry battle')) { findBtn('Retry battle').click(); await sleep(20); m.destroy(); const m2 = CS.match; ok(m2 && m2 !== m, 'retry restarts the battle'); m2.begin(); m2.finish({ win: true, reason: 'mate' }); await waitFor(() => findBtn('Continue'), 3000); findBtn('Continue').click(); await claimRewards(); }
      else { findBtn('End run').click(); ended = true; }
    } else if (node.type === 'arena') {
      const c0 = CS.run.coins; findBtn('Fight round 1').click(); const am = CS.match; ok(!!am, 'Arena round 1 starts a duel');
      am.begin(); am.finish({ win: true, reason: 'captured' }); await waitFor(() => findBtn('Continue'), 3000, 'arena result'); findBtn('Continue').click();
      ok(CS.run.coins > c0 && pageText().includes('Round 2'), 'winning an Arena round pays coins and offers the next one');
      findBtn('Fight round 2').click(); const am2 = CS.match; am2.begin(); am2.finish({ win: false, reason: 'mated' });
      await waitFor(() => findBtn('Continue'), 3000, 'arena loss'); const r0 = CS.run.retries; findBtn('Continue').click();
      ok(!!CS.run && CS.run.retries === r0 && pageText().includes('Choose your path'), 'losing in the Arena only ends the Arena, not the run');
    } else if (node.type === 'rush') {
      const R = ctx.Rush; await waitFor(() => R.state.match, 3000, 'rush match'); const rm = R.state.match;
      rm.playerMove(rm.legalMoves.find(x => { rm.pos.make(x); const st = rm.pos.gameStatus(); rm.pos.unmake(); return st.result === 'checkmate'; }));
      await waitFor(() => R.state.score === 1, 3000, 'rush mate'); const c0 = CS.run.coins; findBtn('Stop').click();
      ok(CS.run.coins > c0 && pageText().includes('MATE RUSH'), 'Mate Rush node pays coins in the run'); findBtn('Continue').click();
    } else if (node.type === 'shop') {
      CS.run.coins = 400;
      const r0 = buttons().find(b => b.className.includes('reroll')); const c0 = CS.run.coins; r0.click();
      ok(CS.run.coins === c0 && buttons().find(b => b.className.includes('reroll')).textContent.includes('10'), 'shop reroll: first one free, the next costs coins');
      const buy = buttons().filter(b => b.className.includes('price-btn') && !b.disabled);
      buy.slice(0, 2).forEach(b => b.click());
      findBtn('Leave').click();
    } else if (node.type === 'event') {
      const c = buttons().find(b => b.className.includes('btn') && !b.disabled && !b.textContent.includes('Abandon') && !b.textContent.includes('Fullscreen')); c.click();
      findBtn('Continue').click();
    } else if (node.type === 'rest') {
      const c = buttons().find(b => b.className.includes('btn') && !b.disabled && !b.textContent.includes('Abandon') && !b.textContent.includes('Fullscreen')); c.click();
    }
    if (!ended) ok(pageText().includes('Choose your path') || pageText().includes('RUN OVER'), 'back on the map after ' + node.type);
    if (pageText().includes('RUN OVER')) ended = true;
  }
}
async function endAndLanguage() {
  if (CS.run) { findBtn('Abandon').click(); }
  await sleep(10);
  ok(pageText().includes('Crowns earned'), 'run-over screen shows Crowns earned');
  ok(CS.meta.crowns > 0, 'Crowns were added to permanent progress (' + CS.meta.crowns + ')');
  findBtn('Permanent Shop').click();
  ok(pageText().includes('Extra Life'), 'permanent shop renders');
  const before = CS.meta.crowns; CS.meta.crowns += 500;
  const buy = buttons().find(b => b.className.includes('price-btn') && !b.disabled); buy.click();
  ok(Object.keys(CS.meta.levels).length === 1 && CS.meta.crowns < before + 500, 'buying a permanent upgrade works and persists');
  ok(Array.isArray(CS.meta.stats.history) && CS.meta.stats.history.length > 0 && 'step' in CS.meta.stats.history[0], 'run history (step reached, who won) is saved for balancing');
  ok(JSON.parse(ctx.localStorage.getItem('checkmate_survivors_v1')).levels, 'progress saved to localStorage');
  findBtn('Back').click(); findBtn('Espa').click();
  ok(I18N.getLang() === 'es' && pageText().includes('Comenzar partida'), 'language switches to Spanish');
  findBtn('Comenzar partida').click();
  ok(pageText().includes('Elegí tu camino'), 'run starts in Spanish with the upgrade applied (extra start army/retries)');
  ok(CS.run.retries + CS.run.army.p + CS.run.army.n + CS.run.army.b + CS.run.army.r > 4, 'permanent upgrade affects the new run');
  CS.meta.levels.am_iron = 1; CS.meta.levels.am_feather = 1;
  const rr = CS._test.newRun(); ok(rr.relics.includes('iron') && rr.relics.includes('feather') && rr.retries >= 2, 'permanent amulets start every run (feather also adds a Retry)');
  delete CS.meta.levels.am_iron; delete CS.meta.levels.am_feather;
  // save / continue: a "reload" brings the run back; leaving mid-battle costs a Retry
  const coins = CS.run.coins + 7; CS.run.coins = coins;
  const n0 = CS.run.map.layers[0][0];
  CS.run.cur = null; CS.run.retries = 1; CS.run.pending = { id: n0.id, stage: 'match' };
  ctx.localStorage.setItem('checkmate_survivors_run_v1', JSON.stringify(CS.run));
  CS.run = null; CS.init();
  ok(!!findBtn('Continuar run'), 'title offers to continue the saved run');
  findBtn('Continuar run').click(); await sleep(10);
  ok(CS.run && CS.run.coins === coins && CS.run.retries === 0 && !!CS.match, 'continuing a run left mid-battle restarts it and spends a Retry');
  CS.match.destroy(); CS.match = null;
  CS.run.pending = { id: n0.id, stage: 'match' }; ctx.localStorage.setItem('checkmate_survivors_run_v1', JSON.stringify(CS.run));
  CS.run = null; CS.init(); findBtn('Continuar run').click(); await sleep(10);
  ok(!CS.run && !CS._test.savedRun() && pageText().includes('Coronas'), 'leaving mid-battle without Retries ends the run and clears the save');
}
async function objectives() {
  const mk = (fen, objective) => {
    const m = new ctx.Match({ fen, playerColor: 0, enemy: { id: 'spider', style: 'balanced', tier: 'easy', depth: 1, blunder: 0 }, objective,
      time: { playerMs: 60000, enemyMs: 60000, playerInc: 0, enemyInc: 0 }, items: [], relics: [], onEnd() {} });
    m.mount(new N('div')); m.begin(); return m;
  };
  const play = (m, uci) => m.playerMove(m.legalMoves.find(x => C.sqName(C.mFrom(x)) + C.sqName(C.mTo(x)) === uci && (!C.mPromo(x) || C.mPromo(x) === C.QUEEN)));
  let m = mk('4k3/1P6/8/8/8/8/8/4K3 w - - 0 1', { type: 'promote', n: 0 });
  play(m, 'b7b8'); ok(m.over && m.result.win && m.result.reason === 'promoted', 'promote objective: promoting a pawn wins');
  ok(m.faction === 'spider' && m.fx.length > 0, 'enemy pieces use the opponent faction and promotion spawns board effects');
  m.destroy();
  m.destroy();
  let stolen = 0;
  const mk2 = (id, fen, items) => { const x = new ctx.Match({ fen, playerColor: 0, enemy: { id, style: 'balanced', tier: 'easy', depth: 1, blunder: 0 }, objective: { type: 'mate', n: 0 },
    time: { playerMs: 60000, enemyMs: 60000, playerInc: 0, enemyInc: 0 }, items: items || [], relics: [], onEnd() {}, onSteal: c => (stolen += c, c) }); x.mount(new N('div')); x.begin(); return x; };
  m = mk2('witch', '4k3/8/8/8/8/8/8/4K3 w - - 0 1', ['hourglass']);
  ok(m.hexed === 'hourglass', 'witch trait hexes one of your potions');
  m.useItem('hourglass'); ok(m.items.includes('hourglass'), 'a hexed potion cannot be used'); m.destroy();
  m = mk2('goblin', '4k3/8/8/8/8/2p5/1P6/4K3 b - - 0 1'); m.scheduleAI = () => {};
  m.doMove(m.legalMoves.find(x => C.sqName(C.mTo(x)) === 'b2'), false); ok(stolen === 2, 'goblin trait steals coins when it captures'); m.destroy();
  m = mk2('kraken', '4k3/8/8/8/8/8/8/4K3 w - - 0 1'); ok(m.inc[1] === 2000, 'kraken trait: +2 s increment for the monster'); m.destroy();
  m = mk2('succubus', '4k3/8/8/8/8/2b5/1N6/4K3 b - - 0 1', ['hourglass', 'thief']); m.scheduleAI = () => {};
  m.doMove(m.legalMoves.find(x => C.sqName(C.mTo(x)) === 'b2'), false); ok(m.items.length === 1, 'succubus trait: capturing your knight steals a potion'); m.destroy();
  m = mk2('dragon', '4k3/8/8/8/8/8/p7/4K3 b - - 0 1'); m.scheduleAI = () => {}; m.enemyMoves = 4; const c0 = m.clock[0];
  m.doMove(m.legalMoves.find(x => C.sqName(C.mFrom(x)) === 'e8'), false); ok(m.clock[0] <= c0 - 4000, 'dragon trait: every 5th move burns 4 s of your clock'); m.destroy();
  m = mk2('shadowking', '4k3/8/8/8/8/8/3r4/3QK3 w - - 0 1'); m.scheduleAI = () => {};
  play(m, 'd1d2'); ok(m.phase2, 'Shadow King trait: below half health the eclipse begins'); m.destroy();
  m = mk2('slime', '4k3/p3p3/8/8/8/8/8/4RK2 w - - 0 1', ['banish']); m.scheduleAI = () => {};
  m.useItem('banish'); ok(m.banish && m.banish.length === 1 && m.banish[0] === 48, 'banishment: only pawns whose removal keeps the monster out of check');
  m.onSquare(48); ok(!m.pos.board[48] && !m.items.length && m.log[m.log.length - 1].mover === 'x' && m.pos.turn === m.pc, 'banishment: the pawn vanishes and it is still your turn'); m.destroy();
  m = mk2('slime', '4k3/8/8/8/8/8/8/4K3 w - - 0 1', ['haste', 'midas', 'midas']);
  m.useItem('haste'); m.useItem('midas'); m.useItem('midas');
  ok(m.inc[0] === 3000 && m.midas && m.items.length === 1, 'haste adds increment, one gold potion per battle'); m.destroy();
  m = mk2('slime', '4k3/8/8/1q6/8/8/8/R3K3 w - - 0 1', ['foresight']); m.scheduleAI = () => {};
  m.useItem('foresight'); await sleep(1500); ok(!!m.threatMove && !m.items.length, "foresight shows the monster's threat"); m.destroy();
  m = mk2('spider', '4k3/8/8/8/2b5/8/4P3/4K3 w - - 0 1'); m.scheduleAI = () => {}; const before = m.clock[0];
  play(m, 'e2e3'); ok(m.clock[0] <= before - 1000, 'spider trait: moving an attacked piece costs a second'); m.destroy();
  m = mk('4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1', { type: 'capture', n: 1 });
  play(m, 'e4d5'); ok(m.over && m.result.reason === 'captured', 'capture objective: capturing N pieces wins');
  m.destroy();
}
async function extras() {
  const t = CS._test, sig = m => m.layers.map(L => L.map(n => n.type + (n.enemyId || n.scenarioId || n.eventId || '')).join(',')).join('|');
  t.setRand(t.seeded(20261027)); const m1 = t.genMap(); t.setRand(t.seeded(20261027)); const m2 = t.genMap(); t.setRand(t.seeded(20261028)); const m3 = t.genMap(); t.setRand(Math.random);
  ok(sig(m1) === sig(m2) && sig(m1) !== sig(m3), 'daily run: the same date always builds the same map');
  CS.meta = { crowns: 0, levels: {}, stats: { runs: 0, wins: 0, bestNodes: 0 }, opts: {}, ach: {}, counts: { puzzles: 0, queens: 0, beaten: {} }, daily: {} };
  t.unlock('firstWin'); t.unlock('firstWin');
  ok(CS.meta.crowns === 5 && CS.meta.ach.firstWin, 'an achievement unlocks once and pays its Crowns once');
  CS.meta.opts.classic = true; ctx.UI.classic = true;
  const mc = new ctx.Match({ fen: '4k3/8/8/8/8/8/8/4K3 w - - 0 1', playerColor: 0, enemy: { id: 'spider', style: 'balanced', tier: 'easy' }, objective: { type: 'mate', n: 0 },
    time: { playerMs: 60000, enemyMs: 60000, playerInc: 0, enemyInc: 0 }, items: [], relics: [], onEnd() {} });
  ok(mc.faction === null && mc.trait === 'spider', 'option: classic enemy pieces keeps the trait but drops the themed pieces');
  ctx.UI.classic = false;
}
async function newStuff() {
  // post-battle review finds the hanging queen you did not take
  const m = new ctx.Match({ fen: '4k3/8/8/3q4/4P3/8/8/4K3 w - - 0 1', playerColor: 0, enemy: { id: 'slime', style: 'balanced', tier: 'easy', depth: 1, blunder: 0 }, objective: { type: 'mate', n: 0 },
    time: { playerMs: 60000, enemyMs: 60000, playerInc: 0, enemyInc: 0 }, items: [], relics: [], onEnd() {} });
  m.mount(new N('div')); m.begin(); m.scheduleAI = () => {};
  const mv = uci => m.legalMoves.find(x => C.sqName(C.mFrom(x)) + C.sqName(C.mTo(x)) === uci);
  m.doMove(mv('e1f1'), true); m.doMove(m.legalMoves.find(x => C.sqName(C.mTo(x)) === 'd7' || C.sqName(C.mTo(x)) === 'e7'), false); m.doMove(m.legalMoves[0], true);
  m.showResult('x', 'y', [], true);
  ok(m.el.overlay.textContent.includes('Review the game'), 'result card offers a review');
  m.review(); await waitFor(() => m.reviewed, 8000, 'review');
  ok(m.reviewed.played && m.reviewed.num === 1 && m.reviewed.bestSan === 'exd5' && m.reviewPos, 'review: finds the free queen you missed (exd5) and shows that position');
  m.destroy();
  ok(JSON.stringify(CS._test.cavalry({ p: 3, n: 1, b: 2, r: 0, q: 1 })) === JSON.stringify({ p: 3, n: 2, b: 0, r: 2, q: 0 }), 'Headless Knight trait: bishops become knights, the queen a rook');
  CS.meta.counts.record = { slime: [2, 1] };
  CS._test.showBestiary();
  ok(pageText().includes('Bestiary') && pageText().includes('Gloop the Slime') && pageText().includes('Won 2') && pageText().includes('Not met yet'), 'bestiary shows met monsters with their record and hides the rest');
  // volume sliders in the options
  CS.init(); await sleep(5); findBtn('Options').click();
  const inputs = all(body).filter(n => n.tagName === 'INPUT');
  ok(inputs.length === 2, 'options have two volume sliders');
  inputs[0].listeners.input[0]({ target: { value: '0' } }); inputs[0].listeners.change[0]();
  ok(ctx.UI.sfxVol === 0 && ctx.UI.muted && CS.meta.opts.sfxVol === 0, 'sound slider at 0 mutes effects and is saved');
  inputs[0].listeners.input[0]({ target: { value: '70' } }); inputs[0].listeners.change[0]();
  ok(Math.abs(ctx.UI.sfxVol - 0.7) < 1e-9 && !ctx.UI.muted, 'moving the slider up unmutes');
  findBtn('Close').click();
  // Mate Rush in Act 3: mates in two
  const R = ctx.Rush; let done = null;
  R.start({ level: 0, perMate: 10, mate2: true, timeMs: 90000, onDone: (sc, c) => { done = { sc, c }; } }); await sleep(10);
  const rm = R.state.match;
  ok(rm && rm.obj.n === 2 && D.RUSH2.includes(rm.cfg.fen), 'Act 3 Mate Rush serves a mate in two');
  rm.playerMove(AI.findMate(rm.pos, 2)); await waitFor(() => rm.pos.turn === rm.pc || rm.over, 3000, 'rush reply');
  const mate = rm.legalMoves.find(x => { rm.pos.make(x); const st = rm.pos.gameStatus(); rm.pos.unmake(); return st.result === 'checkmate'; });
  rm.playerMove(mate); await waitFor(() => R.state.score === 1, 3000, 'rush mate in two');
  R.finish(); ok(done && done.sc === 1 && done.c === 10, 'solving a mate in two scores and pays');
}
async function rushMode() {
  const R = ctx.Rush;
  let bad = 0;
  for (let lv = 0; lv < 16; lv++) for (let i = 0; i < 3; i++) {
    const pz = R.generate(lv), pos = C.Position.fromFEN(pz.fen);
    const mates = pos.legal().filter(m => { pos.make(m); const st = pos.gameStatus(); pos.unmake(); return st.result === 'checkmate'; });
    if (!mates.length || pos.inCheck(1) || pos.inCheck(0)) bad++;
  }
  ok(bad === 0, 'Mate Rush generator: 48 random puzzles, all legal with a mate in one');
  let done = null;
  R.start({ level: 0, perMate: 5, onDone: (score, coins) => { done = { score, coins }; } }); await sleep(10);
  let m = R.state.match; ok(!!m && pageText().includes('MATE RUSH'), 'Mate Rush bonus starts with a puzzle on the board');
  const mate = m.legalMoves.find(x => { m.pos.make(x); const st = m.pos.gameStatus(); m.pos.unmake(); return st.result === 'checkmate'; });
  m.playerMove(mate); await waitFor(() => R.state.score === 1, 3000, 'rush score');
  ok(R.state.score === 1, 'solving a mate scores a point and loads the next puzzle');
  m = R.state.match; const left = R.state.left;
  const wrong = m.legalMoves.find(x => { m.pos.make(x); const st = m.pos.gameStatus(); m.pos.unmake(); return !st.over; });
  m.playerMove(wrong); await waitFor(() => R.state.left < left - 9000, 3000, 'rush penalty');
  ok(R.state.score === 1, 'a wrong move costs 10 seconds');
  R.finish(); ok(done && done.score === 1 && done.coins === 5, 'finishing Mate Rush pays coins per mate');
}
(async () => {
  try { structural(); await extras(); await newStuff(); await objectives(); await rushMode(); await fullRun(true); for (let i = 0; i < 8 && !['duel', 'scenario', 'shop', 'event', 'rest', 'boss', 'rush', 'arena'].every(k => kinds.has(k)); i++) await fullRun(false); console.log('     node types visited:', [...kinds].join(', ')); ok(['duel', 'scenario', 'shop', 'event', 'rest', 'boss', 'rush', 'arena'].every(k => kinds.has(k)), 'all node types were played through the UI'); await endAndLanguage(); } catch (e) { fail++; console.log('EXCEPTION', e && e.stack || e); }
  console.log(fail ? `\n${fail} FAILURES` : '\nALL SMOKE TESTS PASSED');
  process.exit(fail ? 1 : 0);
})();
