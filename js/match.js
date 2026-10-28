/* =========================================================================
 * Checkmate Survivors - match.js
 * One chess match: board rendering (canvas), input, clocks, objectives,
 * potions (rewind / hint / threats / hourglass / time thief / freeze) and
 * the opponent's turn (hand-written AI + enemy time-stealing items).
 * ====================================================================== */
(function (root) {
'use strict';
const C = root.Chess, AI = root.AI, SP = root.Sprites, D = root.Data, UI = root.UI;
const T = (k, v) => root.I18N.t(k, v), h = UI.h;
const SQ = 64;
const COL = {
  light: '#8a7a9e', dark: '#4d3f63',
  last: 'rgba(232,184,74,0.38)', sel: 'rgba(255,255,255,0.38)',
  threatMine: 'rgba(224,82,79,0.50)', threatTheirs: 'rgba(111,207,122,0.45)',
};
function fmt(ms) {
  ms = Math.max(0, ms);
  if (ms < 10000) return (ms / 1000).toFixed(1);
  const s = Math.ceil(ms / 1000);
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

// ---------------------------------------------------------------- opponent avatar
// Animated portrait beside the board: idle motion by playing style, blinks,
// reacts to captures/checks, speaks, and shows the enemy material as HP.
const PVAL = [0, 1, 3, 3, 5, 9, 0];
const IDLE = { rookie: 'fidget', greedy: 'sway', defensive: 'breathe', aggressive: 'bounce', positional: 'bob', balanced: 'bob' };
const restartAnim = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
function line(id, kind) { const opts = T('say.' + id + '.' + kind).split('|'); return opts[Math.floor(Math.random() * opts.length)]; }

class Avatar {
  constructor(enemy, color) {
    this.id = enemy.id; this.mood = 'idle'; this.shown = null; this.timers = new Set(); this.lastSay = 0;
    this.img = h('img', { class: 'portrait', alt: '' });
    this.wrap = h('div', { class: 'pwrap' }, this.img);
    this.fx = h('div', { class: 'avatar-fx' });
    this.bubble = h('div', { class: 'bubble hidden' });
    this.dots = h('div', { class: 'tdots' }, h('span'), h('span'), h('span'));
    this.stage = h('div', { class: 'avatar-stage idle-' + (enemy.tier === 'boss' ? 'float boss' : IDLE[enemy.style] || 'bob'), style: { '--tc': color } },
      this.wrap, this.dots, this.fx, this.bubble);
    this.hpFill = h('div', { class: 'hp-fill' }); this.hpGhost = h('div', { class: 'hp-ghost' }); this.hpText = h('span', { class: 'hp-text' });
    this.el = h('div', { class: 'avatar' }, this.stage, h('div', { class: 'hpbar', title: T('match.hpTip') }, this.hpGhost, this.hpFill, this.hpText));
    this.show('idle');
    this.blink();
  }
  later(fn, ms) { const t = setTimeout(() => { this.timers.delete(t); fn(); }, ms); this.timers.add(t); return t; }
  destroy() { for (const t of this.timers) clearTimeout(t); this.timers.clear(); this.dead = true; }
  show(e) { if (e !== this.shown) { this.shown = e; this.img.src = root.Portraits.url(this.id, e); } }
  rest() { this.show(this.mood); }
  flash(e, ms) { this.show(e); clearTimeout(this.flashT); this.flashT = this.later(() => { this.flashT = null; this.rest(); }, ms); }
  blink() {
    if (this.dead) return;
    this.later(() => {
      if (!this.flashT && this.shown === 'idle') { this.show('blink'); this.later(() => { if (this.shown === 'blink') this.rest(); }, 140); }
      this.blink();
    }, 1800 + Math.random() * 3200);
  }
  setThinking(on) {
    if (this.mood === 'ko' || this.mood === 'happy') return;
    this.mood = on ? 'think' : 'idle';
    this.stage.classList.toggle('thinking', on);
    if (!this.flashT) this.rest();
  }
  setHP(cur, max) {
    this.el.classList.toggle('no-hp', !max);
    if (!max) return;
    const pct = Math.max(0, Math.min(100, 100 * cur / max)) + '%';
    this.hpFill.style.width = pct; this.hpGhost.style.width = pct;
    this.hpFill.className = 'hp-fill ' + (cur / max > 0.6 ? 'hi' : cur / max > 0.3 ? 'mid' : 'lo');
    this.hpText.textContent = cur + ' / ' + max;
  }
  say(text, ms) {
    if (!text) return;
    this.lastSay = performance.now();
    this.bubble.textContent = text; this.bubble.classList.remove('hidden'); restartAnim(this.bubble, 'pop');
    clearTimeout(this.sayT); this.sayT = this.later(() => this.bubble.classList.add('hidden'), ms || 2600);
  }
  chatty(kind, p) { if (Math.random() < p && performance.now() - this.lastSay > 1500) this.say(line(this.id, kind)); }
  hurt(dmg, pieceSrc) {
    this.flash('hurt', 750); restartAnim(this.wrap, dmg >= 5 ? 'hit-big' : 'hit');
    const n = h('div', { class: 'dmg' + (dmg >= 5 ? ' big' : ''), style: { left: (38 + Math.random() * 24) + '%' } }, pieceSrc ? h('img', { src: pieceSrc }) : null, '-' + dmg);
    this.fx.appendChild(n); this.later(() => n.remove(), 1100);
    this.chatty('hurt', dmg >= 5 ? 0.9 : 0.4);
  }
  shock() { this.flash('hurt', 450); restartAnim(this.wrap, 'flinch'); }
  taunt(talk) { this.flash('happy', 900); restartAnim(this.wrap, 'hop'); if (talk) this.chatty('taunt', 0.45); }
  end(enemyWon, draw) {
    this.stage.classList.remove('thinking'); clearTimeout(this.flashT); this.flashT = null;
    if (draw) { this.mood = 'think'; this.rest(); return; }
    this.mood = enemyWon ? 'happy' : 'ko'; this.rest();
    this.wrap.classList.add(enemyWon ? 'gloat' : 'ko');
    this.say(line(this.id, enemyWon ? 'win' : 'lose'), 4000);
  }
}

class Match {
  /* cfg: { fen, playerColor, enemy:{id,style,tier,thief,hourglass}, objective:{type,n},
            time:{playerMs,enemyMs,playerInc,enemyInc}, items:[ids], relics:[ids],
            note, onEnd(result, match) } */
  constructor(cfg) {
    this.cfg = cfg;
    this.pos = C.Position.fromFEN(cfg.fen);
    this.pc = cfg.playerColor; this.ec = 1 - cfg.playerColor;
    this.enemy = Object.assign({}, cfg.enemy);
    this.tier = D.DIFFS[this.enemy.tier] || D.DIFFS.normal;
    this.obj = cfg.objective;
    this.clock = [0, 0]; this.clock[this.pc] = cfg.time.playerMs; this.clock[this.ec] = cfg.time.enemyMs;
    this.inc = [0, 0]; this.inc[this.pc] = cfg.time.playerInc; this.inc[this.ec] = cfg.time.enemyInc;
    this.items = cfg.items.slice();
    this.relics = cfg.relics || [];
    this.freeHints = this.relics.includes('eye') ? 1 : 0;
    this.log = []; this.playerMoves = 0; this.enemyMoves = 0;
    this.selected = -1; this.targets = null; this.lastMove = null; this.hintMove = null; this.threatSqs = null;
    this.started = false; this.over = false; this.thinking = false; this.paused = false; this.frozen = false; this.destroyed = false;
    this.anim = null; this.anim2 = null; this.fx = []; this.fall = null; this.flip = (this.pc === C.BLACK);
    this.faction = UI.classic ? null : SP.FACTIONS[this.enemy.id] ? this.enemy.id : 'rival';   // option: classic crimson pieces
    this.trait = D.ENEMIES.some(e => e.id === this.enemy.id) ? this.enemy.id : null;   // see TRAITS in docs
    this.hexed = null; this.petrified = false; this.howled = false; this.phase2 = false;
    this.legalMoves = this.pos.legal();
    this.result = null;
  }

  // ---------------------------------------------------------------- mount
  mount(parent) {
    const e = this.el = {};
    const en = this.enemy;
    e.canvas = h('canvas', { width: 512, height: 512, class: 'board' });
    this.ctx = e.canvas.getContext('2d');
    if (this.ctx) this.ctx.imageSmoothingEnabled = false;
    e.canvas.addEventListener('click', ev => this.onClick(ev));
    e.enemyClock = h('div', { class: 'clock' }); e.playerClock = h('div', { class: 'clock' });
    e.capTop = h('div', { class: 'captured' }); e.capBottom = h('div', { class: 'captured' });
    e.think = h('span', { class: 'think' });
    e.objText = h('div', { class: 'objective' }); e.objProg = h('div', { class: 'muted' });
    e.log = h('div', { class: 'movelog' });
    e.status = h('div', { class: 'status' });
    e.items = h('div', { class: 'items' });
    e.overlay = h('div', { class: 'match-overlay hidden' });

    this.avatar = new Avatar(en, this.tier.color);
    this.hpMax = this.material(this.ec);
    const left = h('div', { class: 'col left' },
      h('div', { class: 'panel enemy-panel' }, this.avatar.el,
        h('div', { class: 'enemy-name' }, T('enemy.' + en.id + '.name')),
        h('div', { class: 'muted' }, T('style.' + en.style), ' · ', h('span', { style: { color: this.tier.color } }, T('diff.' + en.tier))),
        en.thief ? h('div', { class: 'muted small' }, T('match.canSteal')) : null,
        this.trait ? h('div', { class: 'trait small', title: T('trait.' + this.trait + '.desc') }, '\u2605 ' + T('trait.' + this.trait + '.name')) : null),
      h('div', { class: 'panel' }, h('div', { class: 'panel-title' }, T('match.objective')), e.objText, e.objProg),
      h('div', { class: 'panel grow' }, h('div', { class: 'panel-title' }, T('match.moves')), e.log));
    const center = h('div', { class: 'col center' },
      h('div', { class: 'bar' }, h('div', { class: 'bar-name' }, T('enemy.' + en.id + '.name'), e.think), e.capTop, e.enemyClock),
      e.boardwrap = h('div', { class: 'boardwrap' }, e.canvas, e.overlay),
      h('div', { class: 'bar' }, h('div', { class: 'bar-name' }, T('match.you')), e.capBottom, e.playerClock));
    const relicBox = h('div', { class: 'relics' });
    for (const id of this.relics) relicBox.appendChild(h('img', { class: 'relic', src: SP.iconURL(D.RELICS[id].shape, D.RELICS[id].color), title: T('relic.' + id + '.name') + ': ' + T('relic.' + id + '.desc') }));
    const right = h('div', { class: 'col right' },
      h('div', { class: 'panel' }, e.status),
      h('div', { class: 'panel' }, h('div', { class: 'panel-title' }, T('match.potions')), e.items),
      this.relics.length ? h('div', { class: 'panel' }, h('div', { class: 'panel-title' }, T('match.relics')), relicBox) : null,
      h('div', { class: 'panel row' },
        h('button', { class: 'btn small danger', onclick: () => this.resign() }, T('match.resign')),
        h('button', { class: 'btn small', onclick: () => { UI.muted = !UI.muted; UI.sfx('click'); } }, T('match.mute'))));
    e.root = h('div', { class: 'match' }, left, center, right);
    parent.appendChild(e.root);

    this.updateHud();
    this.showIntro();
    this.interval = setInterval(() => this.tick(), 100);
    this.drawLoop();
  }

  showIntro() {
    const o = this.obj;
    this.setOverlay(h('div', { class: 'overlay-card' },
      h('img', { class: 'intro-portrait', src: root.Portraits.url(this.enemy.id, 'idle'), alt: '' }),
      h('h2', null, T('enemy.' + this.enemy.id + '.name')),
      h('div', { class: 'muted' }, T('enemy.' + this.enemy.id + '.desc')),
      h('div', { class: 'intro-obj' }, h('div', { class: 'intro-label' }, T('match.objective')), h('div', { class: 'intro-goal' }, T('obj.' + o.type, { n: o.n }))),
      h('p', { class: 'intro-time' }, T('match.time') + ': ', h('b', null, fmt(this.clock[this.pc]) + (this.inc[this.pc] ? ' +' + this.inc[this.pc] / 1000 + 's' : ''))),
      this.trait ? h('p', { class: 'intro-trait' }, '\u2605 ', h('b', null, T('trait.' + this.trait + '.name')), ': ' + T('trait.' + this.trait + '.desc')) : null,
      this.cfg.note ? h('p', { class: 'note' }, this.cfg.note) : null,
      h('button', { class: 'btn primary', onclick: () => this.begin() }, T('match.begin'))));
  }
  setOverlay(el) { this.el.overlay.innerHTML = ''; this.el.overlay.appendChild(el); this.el.overlay.classList.remove('hidden'); }
  hideOverlay() { this.el.overlay.classList.add('hidden'); this.el.overlay.innerHTML = ''; }

  begin() {
    if (this.started) return;
    UI.sfx('click');
    this.started = true; this.last = performance.now(); this.hideOverlay();
    if (this.cfg.onBegin) this.cfg.onBegin();
    this.avatar.say(line(this.enemy.id, 'intro'), 3200);
    UI.music(this.cfg.music || (this.enemy.tier === 'boss' ? 'boss' : 'battle'));
    if (this.trait === 'mummy') { this.clock[this.ec] += 20000; UI.toast(T('toast.trait.mummy'), 'bad'); }
    if (this.trait === 'golem') { this.clock[this.ec] += 30000; this.inc[this.ec] = 0; UI.toast(T('toast.trait.golem'), 'bad'); }
    if (this.trait === 'witch' && this.items.length) {
      this.hexed = this.items[Math.floor(Math.random() * this.items.length)];
      UI.toast(T('toast.trait.witch', { p: T('item.' + this.hexed + '.name') }), 'bad'); UI.sfx('hex'); this.avatar.taunt(false);
    }
    this.updateHud();
    if (this.pos.turn === this.ec) this.scheduleAI();
  }

  destroy() {
    this.destroyed = true;
    clearInterval(this.interval);
    if (this.avatar) this.avatar.destroy();
    if (this.raf) cancelAnimationFrame(this.raf);
    if (this.el && this.el.root) this.el.root.remove();
  }

  // ---------------------------------------------------------------- clocks
  tick() {
    if (this.destroyed) return;
    const now = performance.now();
    const dt = now - (this.last || now);
    this.last = now;
    if (!this.started || this.over || this.paused) return;
    const side = this.pos.turn;
    const ghostly = side === this.ec && this.trait === 'ghost' && this.enemyMoves < 3;
    if (!(side === this.ec && this.frozen) && !ghostly) this.clock[side] -= dt * (side === this.pc && this.petrified ? 2 : 1);
    if (this.clock[side] <= 0) {
      this.clock[side] = 0;
      if (side === this.pc) this.finish(this.pos.hasMatingMaterial(this.ec) ? { win: false, reason: 'timeout' } : { win: false, reason: 'draw', draw: true });
      else this.finish(this.pos.hasMatingMaterial(this.pc) ? { win: true, reason: 'timeoutEnemy' } : { win: false, reason: 'draw', draw: true });
    }
    this.updateClocks();
  }
  updateClocks() {
    const e = this.el; if (!e) return;
    e.playerClock.textContent = fmt(this.clock[this.pc]);
    e.enemyClock.textContent = (this.frozen && this.pos.turn === this.ec ? '* ' : '') + fmt(this.clock[this.ec]);
    e.playerClock.classList.toggle('low', this.clock[this.pc] < 10000);
    e.enemyClock.classList.toggle('low', this.clock[this.ec] < 10000);
    e.playerClock.classList.toggle('active', this.started && !this.over && this.pos.turn === this.pc);
    e.enemyClock.classList.toggle('active', this.started && !this.over && this.pos.turn === this.ec);
  }

  // ---------------------------------------------------------------- input
  onClick(ev) {
    if (!this.started || this.over || this.thinking || this.paused || this.pos.turn !== this.pc) return;
    const rect = this.el.canvas.getBoundingClientRect();
    const x = (ev.clientX - rect.left) * (512 / rect.width), y = (ev.clientY - rect.top) * (512 / rect.height);
    const col = Math.floor(x / SQ), row = Math.floor(y / SQ);
    if (col < 0 || col > 7 || row < 0 || row > 7) return;
    const f = this.flip ? 7 - col : col, r = this.flip ? row : 7 - row;
    this.onSquare(r * 8 + f);
  }
  onSquare(sq) {
    const p = this.pos.board[sq];
    if (this.selected >= 0 && this.targets && this.targets.has(sq)) {
      const ms = this.targets.get(sq);
      if (ms.length > 1) this.askPromo(ms); else this.playerMove(ms[0]);
      return;
    }
    if (p && (p >> 3) === this.pc && sq !== this.selected) this.select(sq);
    else { this.selected = -1; this.targets = null; }
  }
  select(sq) {
    const t = new Map();
    for (const m of this.legalMoves) if (C.mFrom(m) === sq) { const to = C.mTo(m); if (!t.has(to)) t.set(to, []); t.get(to).push(m); }
    if (!t.size) { this.selected = -1; this.targets = null; return; }
    this.selected = sq; this.targets = t; UI.sfx('click');
  }
  askPromo(ms) {
    const order = [C.QUEEN, C.ROOK, C.BISHOP, C.KNIGHT];
    const btns = order.map(pt => {
      const m = ms.find(x => C.mPromo(x) === pt);
      return h('button', { class: 'btn promo', onclick: () => { this.hideOverlay(); this.playerMove(m); } }, h('img', { src: SP.pieceURL(C.mk(pt, this.pc)) }));
    });
    this.setOverlay(h('div', { class: 'overlay-card' }, h('h3', null, T('match.promote')), h('div', { class: 'row center' }, btns)));
  }
  playerMove(m) { this.hintMove = null; this.threatSqs = null; this.doMove(m, true); }
  resign() {
    if (this.over || !this.started) return;
    if (!root.confirm(T('match.confirmResign'))) return;
    this.finish({ win: false, reason: 'resign' });
  }

  // ---------------------------------------------------------------- moves
  doMove(m, byPlayer) {
    this.tick();
    if (this.over) return;
    const from = C.mFrom(m), to = C.mTo(m), fl = C.mFlags(m), piece = this.pos.board[from];
    const capSq = (fl & C.F_CAP) ? ((fl & C.F_EP) ? to + ((piece >> 3) === C.WHITE ? -8 : 8) : to) : -1;
    const captured = capSq >= 0 ? this.pos.board[capSq] : 0, capType = captured & 7;
    const san = this.pos.san(m);
    const webbed = byPlayer && this.trait === 'spider' && this.pos.isAttacked(from, this.ec);
    this.pos.make(m);
    this.log.push({ san, mover: byPlayer ? 'p' : 'e', cap: capType, from, to });
    const who = byPlayer ? this.pc : this.ec;
    this.clock[who] += this.inc[who];
    if (byPlayer) { this.playerMoves++; this.petrified = false; } else { this.enemyMoves++; this.frozen = false; }
    if (webbed) { this.clock[this.pc] = Math.max(1000, this.clock[this.pc] - 1000); this.floatText(to, '-1s', '#c8a0ff'); if (!this.webTold) { this.webTold = true; UI.toast(T('toast.trait.spider'), 'bad'); } }
    this.lastMove = { from, to };
    const t0 = performance.now();
    this.anim = { from, to, piece, t0, dur: 160 };
    this.anim2 = null;
    if (fl & C.F_CASTLE) { const r = to & 56, kside = (to & 7) === 6; this.anim2 = { from: r + (kside ? 7 : 0), to: r + (kside ? 5 : 3), t0, dur: 220 }; }
    this.selected = -1; this.targets = null;
    this.legalMoves = this.pos.legal();
    this.react({ byPlayer, captured, capSq, to, promo: !!(fl & C.F_PROMO), castle: !!(fl & C.F_CASTLE), check: this.pos.inCheck() });
    this.afterMove(byPlayer, capType, !!(fl & C.F_PROMO));
  }
  // sounds, board effects and the opponent's reaction to a move
  react(e) {
    const id = this.enemy.id, av = this.avatar;
    if (e.captured) {
      const val = PVAL[e.captured & 7], enemyLost = (e.captured >> 3) === this.ec;
      this.boom(e.capSq, e.captured, val);
      this.floatText(e.capSq, (enemyLost ? '+' : '-') + val, enemyLost ? '#ffd84a' : '#ff6a6a');
      if (enemyLost) {
        av.hurt(val, SP.pieceURL(e.captured, this.faction)); UI.sfx(val >= 5 ? 'death' : 'hit');
        if ((e.captured & 7) === C.QUEEN) av.say(line(id, 'queen'), 3200);
        if ((e.captured & 7) === C.QUEEN && this.trait === 'lich' && !this.phase2) this.lichPhase2();
        if (this.trait === 'necromancer' && !this.howled && this.material(this.ec) * 2 < this.hpMax) {
          this.howled = true; UI.toast(T('toast.trait.necromancer'), 'bad'); UI.sfx('warn'); av.taunt(false);
          if (!this.relics.includes('iron')) { const amt = Math.min(10000, Math.max(0, this.clock[this.pc] - 2000)); this.clock[this.pc] -= amt; this.clock[this.ec] += amt; }
        }
        if (this.trait === 'werewolf' && !this.howled && this.material(this.ec) * 2 < this.hpMax) {
          this.howled = true; this.clock[this.ec] += 10000; UI.toast(T('toast.trait.werewolf'), 'bad'); av.taunt(false);
        }
      } else {
        av.taunt(true); UI.sfx('hurt');
        if (this.trait === 'necromancer') { this.clock[this.ec] += 4000; this.floatText(e.capSq, '+4s', '#9aff7a'); }
        if (this.trait === 'goblin' && this.cfg.onSteal) { const c = this.cfg.onSteal(2); if (c) UI.toast(T('toast.trait.goblin', { c }), 'bad'); }
        if (this.trait === 'vampire' && !this.relics.includes('iron')) { this.clock[this.pc] = Math.max(1000, this.clock[this.pc] - 2000); this.clock[this.ec] += 2000; this.floatText(e.capSq, '-2s', '#ff5a5a'); }
      }
    } else UI.sfx('move');
    if (e.castle) { this.floatText(e.to, T('fx.castle'), '#7ac0f0'); UI.sfx('castle'); }
    if (e.promo) {
      const [x, y] = this.xy(e.to);
      this.fx.push(this.burst(x + 32, y + 32, ['#ffe066', '#e8b84a', '#fffaf0', '#b57cff'], 26, 160));
      this.floatText(e.to, T('fx.promo'), '#ffd84a'); UI.sfx('promote');
      if (e.byPlayer) { av.shock(); av.say(line(id, 'promo'), 2800); } else av.taunt(true);
    }
    if (e.check) {
      const k = this.pos.kingSq[this.pos.turn], [x, y] = this.xy(k);
      this.fx.push({ kind: 'ring', cx: x + 32, cy: y + 32, r: 46, c: '#ff5a5a', t0: performance.now(), dur: 450 });
      UI.sfx('check');
      if (!e.captured && !e.promo) { if (e.byPlayer) { av.shock(); av.chatty('check', 0.4); } else av.taunt(false); }
      if (!e.byPlayer && this.trait === 'banshee') { this.clock[this.pc] = Math.max(1000, this.clock[this.pc] - 3000); this.floatText(k, '-3s', '#8fd0d8'); }
    }
  }
  lichPhase2() {
    this.phase2 = true; this.avatar.stage.classList.add('phase2'); UI.music('boss2');
    if (!this.relics.includes('iron')) { const amt = Math.min(8000, Math.max(0, this.clock[this.pc] - 2000)); this.clock[this.pc] -= amt; this.clock[this.ec] += amt; }
    UI.toast(T('toast.trait.lich'), 'bad'); UI.sfx('warn');
  }
  afterMove(byPlayer, capType, promoted) {
    const st = this.pos.gameStatus(), o = this.obj;
    if (!byPlayer && this.trait === 'medusa' && this.enemyMoves === 6) { this.petrified = true; UI.toast(T('toast.trait.medusa'), 'bad'); this.avatar.taunt(false); }
    let res = null;
    if (st.over) {
      if (st.result === 'checkmate') res = st.winner === this.pc ? { win: true, reason: 'mate' } : { win: false, reason: 'mated' };
      else if (o.type === 'survive') res = { win: true, reason: 'survivedDraw' };
      else res = { win: false, reason: 'draw', draw: true, detail: st.result };
    } else if (byPlayer) {
      if (o.type === 'captureQueen' && capType === C.QUEEN) res = { win: true, reason: 'queen' };
      else if (o.type === 'promote' && promoted) res = { win: true, reason: 'promoted' };
      else if (o.type === 'capture' && this.captures() >= o.n) res = { win: true, reason: 'captured' };
      else if ((o.type === 'captureQueen' || o.type === 'mateIn') && this.playerMoves >= o.n) res = { win: false, reason: 'limit' };
    } else if (o.type === 'survive' && this.playerMoves >= o.n) res = { win: true, reason: 'survived' };
    this.updateHud();
    if (res) { this.finish(res); return; }
    if (this.pos.turn === this.ec) this.scheduleAI();
  }
  captures() { return this.log.filter(l => l.mover === 'p' && l.cap).length; }

  scheduleAI() {
    if (this.over || this.destroyed) return;
    this.thinking = true; this.updateHud();
    setTimeout(() => this.aiMove(), 240);
  }
  maybeEnemyItems() {
    const en = this.enemy;
    if (en.thief > 0 && !this.relics.includes('iron') && Math.random() < 0.28 && this.clock[this.pc] > 20000) {
      en.thief--; const amt = 8000;
      this.clock[this.pc] -= amt; this.clock[this.ec] += amt;
      UI.toast(T('toast.enemyThief', { s: 8 }), 'bad'); UI.sfx('warn'); this.avatar.taunt(false);
    }
    if (en.hourglass > 0 && this.clock[this.ec] < 25000) {
      en.hourglass--; this.clock[this.ec] += 15000;
      UI.toast(T('toast.enemyHourglass'), 'bad');
    }
  }
  aiMove() {
    if (this.over || this.destroyed) return;
    this.maybeEnemyItems();
    const budget = Math.max(50, Math.min(this.tier.timeMs, this.clock[this.ec] * 0.05));
    const r = AI.choose(this.pos, { depth: this.enemy.depth || this.tier.depth, timeMs: budget, style: this.enemy.style, blunder: this.enemy.blunder != null ? this.enemy.blunder : this.tier.blunder });
    this.thinking = false;
    if (!r) { this.afterMove(false, 0); return; }
    this.doMove(r.move, false);
  }

  // ---------------------------------------------------------------- potions
  canUseItems() { return this.started && !this.over && !this.thinking && !this.paused && this.pos.turn === this.pc; }
  useItem(id, free) {
    if (!this.canUseItems()) return;
    const idx = this.items.indexOf(id);
    const useFree = id === 'hint' && free && this.freeHints > 0;
    if (!useFree && idx < 0) return;
    if (id === this.hexed && !useFree) { UI.toast(T('toast.hexed'), 'bad'); UI.sfx('hex'); return; }
    if (this.trait === 'gargoyle' && !this.taxed) { this.taxed = true; this.clock[this.pc] = Math.max(1000, this.clock[this.pc] - 5000); UI.toast(T('toast.trait.gargoyle'), 'bad'); }
    const consume = () => { if (useFree) this.freeHints--; else this.items.splice(this.items.indexOf(id), 1); };
    switch (id) {
      case 'rewind': {
        const n = this.log.length;
        if (n < 2 || this.log[n - 1].mover !== 'e' || this.log[n - 2].mover !== 'p') { UI.toast(T('toast.noRewind'), 'bad'); return; }
        this.pos.unmake(); this.pos.unmake(); this.log.pop(); this.log.pop();
        this.playerMoves--; this.enemyMoves--;
        const prev = this.log[this.log.length - 1];
        this.lastMove = prev ? { from: prev.from, to: prev.to } : null;
        this.legalMoves = this.pos.legal(); this.selected = -1; this.targets = null; this.hintMove = null; this.threatSqs = null; this.anim = null; this.anim2 = null; this.fx = [];
        break;
      }
      case 'hint': {
        consume();
        this.paused = true; this.updateHud();
        setTimeout(() => {
          if (this.destroyed) return;
          const r = AI.hint(this.pos);
          this.hintMove = r ? r.move : null;
          this.paused = false; this.last = performance.now(); this.updateHud();
        }, 30);
        UI.sfx('potion'); UI.toast(T('toast.potion.hint'));
        return;
      }
      case 'threats': {
        const mine = [], theirs = [], b = this.pos.board;
        for (let s = 0; s < 64; s++) {
          const p = b[s]; if (!p) continue;
          if ((p >> 3) === this.pc) { if (this.pos.isAttacked(s, this.ec)) mine.push(s); } else if (this.pos.isAttacked(s, this.pc)) theirs.push(s);
        }
        this.threatSqs = { mine, theirs };
        break;
      }
      case 'hourglass': this.clock[this.pc] += 15000; break;
      case 'thief': { const amt = Math.min(10000, Math.max(0, this.clock[this.ec] - 1000)); this.clock[this.ec] -= amt; this.clock[this.pc] += amt; break; }
      case 'freeze': this.frozen = true; break;
      default: return;
    }
    consume();
    UI.sfx('potion'); UI.toast(T('toast.potion.' + id));
    this.updateHud();
  }

  // ---------------------------------------------------------------- end
  finish(res) {
    if (this.over) return;
    this.over = true; this.thinking = false; this.result = res;
    this.hintMove = null; this.threatSqs = null;
    UI.music(null); UI.sfx(res.win ? 'win' : 'lose');
    if (res.reason === 'mate' || res.reason === 'mated') {
      const k = this.pos.kingSq[res.win ? this.ec : this.pc];
      this.fall = { sq: k, t0: performance.now() }; this.boom(k, C.mk(C.KING, res.win ? this.ec : this.pc), 9, true);
      if (res.win) UI.sfx('death');
    }
    this.updateHud();
    this.avatar.end(!res.win && !res.draw, !!res.draw && res.reason !== 'survivedDraw');
    setTimeout(() => { if (!this.destroyed) this.cfg.onEnd(res, this); }, 700);
  }
  showResult(title, text, buttons, good) {
    this.setOverlay(h('div', { class: 'overlay-card ' + (good ? 'good' : 'bad') },
      h('h2', null, title), h('p', null, text),
      h('div', { class: 'row center' }, buttons.map(b => h('button', { class: 'btn ' + (b.cls || ''), onclick: b.onClick }, b.label)))));
  }

  // ---------------------------------------------------------------- hud
  updateHud() {
    const e = this.el; if (!e) return;
    const o = this.obj;
    e.objText.textContent = T('obj.' + o.type, { n: o.n });
    e.objProg.textContent = o.type === 'capture' ? T('obj.captureProgress', { a: this.captures(), n: o.n })
      : (o.type === 'mate' || o.type === 'promote') ? '' : T('obj.progress', { a: this.playerMoves, n: o.n });
    e.log.innerHTML = '';
    for (const l of this.log) e.log.appendChild(h('span', { class: 'mv ' + l.mover }, l.san));
    e.log.scrollTop = e.log.scrollHeight;
    e.capTop.innerHTML = ''; e.capBottom.innerHTML = '';
    for (const l of this.log) {
      if (!l.cap) continue;
      if (l.mover === 'e') e.capTop.appendChild(h('img', { src: SP.pieceURL(C.mk(l.cap, this.pc)) }));
      else e.capBottom.appendChild(h('img', { src: SP.pieceURL(C.mk(l.cap, this.ec), this.faction) }));
    }
    let st;
    if (!this.started) st = T('match.ready');
    else if (this.over) st = T('match.over');
    else if (this.paused) st = T('match.thinkingHint');
    else if (this.pos.turn === this.pc) st = this.pos.inCheck() ? T('match.yourTurnCheck') : T('match.yourTurn');
    else st = T('match.enemyTurn');
    e.status.textContent = st;
    e.think.textContent = this.thinking ? ' ...' : '';
    if (!this.over) this.avatar.setThinking(this.thinking);
    const hp = this.material(this.ec); this.hpMax = Math.max(this.hpMax, hp); this.avatar.setHP(hp, this.hpMax);
    e.items.innerHTML = '';
    const counts = {};
    for (const it of this.items) counts[it] = (counts[it] || 0) + 1;
    const list = Object.keys(counts).map(id => ({ id, n: counts[id], free: false }));
    if (this.freeHints > 0) list.unshift({ id: 'hint', n: this.freeHints, free: true });
    if (!list.length) e.items.appendChild(h('div', { class: 'muted small' }, T('match.noPotions')));
    const can = this.canUseItems();
    for (const it of list) {
      const P = D.POTIONS[it.id];
      e.items.appendChild(h('button', {
        class: 'item' + (can ? '' : ' disabled') + (it.id === this.hexed && !it.free ? ' hexed' : ''), title: T('item.' + it.id + '.name') + ': ' + T('item.' + it.id + '.desc'),
        onclick: () => this.useItem(it.id, it.free),
      }, h('img', { src: SP.iconURL('potion', P.color, { glyph: P.glyph }) }),
        h('span', { class: 'item-name' }, T('item.' + it.id + '.name')),
        it.id === this.hexed && !it.free ? h('span', { class: 'badge hex' }, T('match.hexed')) : it.n > 1 ? h('span', { class: 'badge' }, it.n) : null, it.free ? h('span', { class: 'badge free' }, T('match.free')) : null));
    }
    this.updateClocks();
  }

  material(color) { let v = 0; for (const p of this.pos.board) if (p && (p >> 3) === color) v += PVAL[p & 7]; return v; }

  // ---------------------------------------------------------------- draw
  xy(sq) {
    const f = sq & 7, r = sq >> 3;
    return [(this.flip ? 7 - f : f) * SQ, (this.flip ? r : 7 - r) * SQ];
  }
  drawLoop() {
    if (this.destroyed) return;
    this.draw();
    this.raf = requestAnimationFrame(() => this.drawLoop());
  }
  pieceImg(p) { return SP.pieceCanvas(p, (p >> 3) === this.ec ? this.faction : null); }
  drawPiece(ctx, p, x, y) {
    const glow = (p >> 3) === this.ec && this.faction && SP.FACTIONS[this.faction].glow;
    if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 10; }
    ctx.drawImage(this.pieceImg(p), x, y, SQ, SQ);
    if (glow) ctx.shadowBlur = 0;
  }

  // ---------------------------------------------------------------- board effects
  burst(cx, cy, colors, n, power) {
    const parts = [];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, sp = 50 + Math.random() * power;
      parts.push({ vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 90, s: 3 + Math.floor(Math.random() * 4), c: colors[i % colors.length] });
    }
    return { kind: 'burst', cx, cy, parts, t0: performance.now(), dur: 750 };
  }
  boom(sq, piece, val, big) {
    const [x, y] = this.xy(sq), t0 = performance.now();
    if (UI.reduced) return;   // option: no particles, flashes or shake
    const enemy = (piece >> 3) === this.ec, pal = enemy && this.faction ? SP.factionPal(SP.FACTIONS[this.faction]) : null;
    const colors = pal ? [pal[2], pal[3], pal[4], pal[9]] : enemy ? ['#e5808c', '#b8384a', '#7e2331', '#561823'] : ['#fffaf0', '#eadfc4', '#b5a07a', '#8a7650'];
    this.fx.push(this.burst(x + 32, y + 32, colors, 10 + val * 3 + (big ? 20 : 0), 110 + val * 18));
    if (!big) this.fx.push({ kind: 'ghost', x, y, piece, t0, dur: 650 });
    this.fx.push({ kind: 'ring', cx: x + 32, cy: y + 32, r: 34 + val * 5, c: 'rgba(255,255,255,0.9)', t0, dur: 420 });
    if (this.el && this.el.boardwrap) restartAnim(this.el.boardwrap, val >= 5 ? 'shake-lg' : 'shake');
  }
  floatText(sq, text, color) {
    const [x, y] = this.xy(sq);
    this.fx.push({ kind: 'text', cx: Math.max(56, Math.min(456, x + 32)), cy: y + 18, text, color, t0: performance.now(), dur: 1100 });
  }
  drawFx(ctx, now) {
    this.fx = this.fx.filter(f => now - f.t0 < f.dur);
    for (const f of this.fx) {
      const t = (now - f.t0) / f.dur, sec = (now - f.t0) / 1000;
      ctx.globalAlpha = Math.max(0, 1 - t);
      if (f.kind === 'burst') {
        for (const q of f.parts) { ctx.fillStyle = q.c; ctx.fillRect(Math.round(f.cx + q.vx * sec), Math.round(f.cy + q.vy * sec + 320 * sec * sec), q.s, q.s); }
      } else if (f.kind === 'ghost') {
        ctx.save(); ctx.translate(f.x + 32, f.y + 32 - 46 * t); ctx.rotate(t * 1.4 * (f.x > 256 ? -1 : 1)); ctx.scale(1 + 0.5 * t, 1 + 0.5 * t);
        ctx.drawImage(this.pieceImg(f.piece), -32, -32, SQ, SQ); ctx.restore();
      } else if (f.kind === 'ring') {
        ctx.strokeStyle = f.c; ctx.lineWidth = 5 * (1 - t) + 1;
        ctx.beginPath(); ctx.arc(f.cx, f.cy, 8 + f.r * t, 0, 6.3); ctx.stroke();
      } else if (f.kind === 'text') {
        ctx.globalAlpha = t < 0.7 ? 1 : (1 - t) / 0.3;
        const yy = f.cy - 34 * Math.min(1, t * 2);
        ctx.font = 'bold 22px "Trebuchet MS", sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 5; ctx.strokeStyle = '#1a1022';
        ctx.strokeText(f.text, f.cx, yy); ctx.fillStyle = f.color; ctx.fillText(f.text, f.cx, yy); ctx.textAlign = 'left';
      }
    }
    ctx.globalAlpha = 1;
  }

  draw() {
    const ctx = this.ctx; if (!ctx) return;
    const b = this.pos.board, now = performance.now();
    for (let sq = 0; sq < 64; sq++) {
      const [x, y] = this.xy(sq);
      ctx.fillStyle = (((sq & 7) + (sq >> 3)) & 1) ? COL.light : COL.dark;
      ctx.fillRect(x, y, SQ, SQ);
    }
    ctx.font = 'bold 11px monospace'; ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let i = 0; i < 8; i++) {
      ctx.fillText('abcdefgh'[this.flip ? 7 - i : i], i * SQ + SQ - 11, 8 * SQ - 4);
      ctx.fillText(String((this.flip ? i : 7 - i) + 1), 3, i * SQ + 12);
    }
    const fillSq = (sq, color) => { const p = this.xy(sq); ctx.fillStyle = color; ctx.fillRect(p[0], p[1], SQ, SQ); };
    if (this.lastMove) { fillSq(this.lastMove.from, COL.last); fillSq(this.lastMove.to, COL.last); }
    if (this.threatSqs) { this.threatSqs.mine.forEach(s => fillSq(s, COL.threatMine)); this.threatSqs.theirs.forEach(s => fillSq(s, COL.threatTheirs)); }
    if (this.selected >= 0) fillSq(this.selected, COL.sel);
    if (!this.over && this.pos.inCheck()) {
      const [x, y] = this.xy(this.pos.kingSq[this.pos.turn]);
      const g = ctx.createRadialGradient(x + 32, y + 32, 4, x + 32, y + 32, 34);
      g.addColorStop(0, 'rgba(224,82,79,0.95)'); g.addColorStop(1, 'rgba(224,82,79,0)');
      ctx.fillStyle = g; ctx.fillRect(x, y, SQ, SQ);
    }
    const live = a => a && now - a.t0 < a.dur && b[a.to] ? a : null;
    const anim = this.anim = live(this.anim), anim2 = this.anim2 = live(this.anim2);
    for (let sq = 0; sq < 64; sq++) {
      const p = b[sq]; if (!p) continue;
      if ((anim && sq === anim.to) || (anim2 && sq === anim2.to)) continue;
      const [x, y] = this.xy(sq);
      ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(x + 32, y + 56, 20, 5, 0, 0, 6.3); ctx.fill();
      if (this.fall && this.fall.sq === sq) {
        const k = Math.min(1, (now - this.fall.t0) / 500), ease = 1 - (1 - k) * (1 - k);
        ctx.save(); ctx.translate(x + 50, y + 58); ctx.rotate(ease * 1.45); this.drawPiece(ctx, p, -50, -58); ctx.restore();
      } else this.drawPiece(ctx, p, x, y);
    }
    for (const a of [anim, anim2]) {
      if (!a) continue;
      const t = (now - a.t0) / a.dur, k = t * t * (3 - 2 * t);
      const [x0, y0] = this.xy(a.from), [x1, y1] = this.xy(a.to);
      this.drawPiece(ctx, b[a.to], x0 + (x1 - x0) * k, y0 + (y1 - y0) * k - Math.sin(k * Math.PI) * 10);
    }
    if (this.targets) {
      for (const sq of this.targets.keys()) {
        const [x, y] = this.xy(sq);
        if (b[sq]) { ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x + 32, y + 32, 27, 0, 6.3); ctx.stroke(); }
        else { ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.arc(x + 32, y + 32, 9, 0, 6.3); ctx.fill(); }
      }
    }
    if (this.hintMove) {
      const [x0, y0] = this.xy(C.mFrom(this.hintMove)), [x1, y1] = this.xy(C.mTo(this.hintMove));
      const ax = x0 + 32, ay = y0 + 32, bx = x1 + 32, by = y1 + 32, ang = Math.atan2(by - ay, bx - ax);
      ctx.strokeStyle = 'rgba(232,184,74,0.9)'; ctx.fillStyle = 'rgba(232,184,74,0.9)'; ctx.lineWidth = 8; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx - Math.cos(ang) * 14, by - Math.sin(ang) * 14); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx, by);
      ctx.lineTo(bx - Math.cos(ang - 0.5) * 22, by - Math.sin(ang - 0.5) * 22);
      ctx.lineTo(bx - Math.cos(ang + 0.5) * 22, by - Math.sin(ang + 0.5) * 22);
      ctx.closePath(); ctx.fill();
    }
    this.drawFx(ctx, now);
  }
}

root.Match = Match;
})(window);
