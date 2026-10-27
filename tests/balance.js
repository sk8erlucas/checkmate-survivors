// Balance simulation: a "proxy player" (same engine, medium depth) vs each enemy tier with generated armies.
// Usage: node tests/balance.js [games-per-cell] [proxyDepth]
const fs = require('fs'), path = require('path'), vm = require('vm');
const ctx = { console, setTimeout, clearTimeout, setInterval, clearInterval, performance, document: { createElement: () => ({ getContext: () => ({}) }), getElementById: () => ({}), body: { appendChild() {} } }, localStorage: { getItem: () => null, setItem() {} }, confirm: () => true };
ctx.window = ctx; vm.createContext(ctx);
for (const f of ['chess', 'ai', 'sprites', 'data', 'i18n', 'ui', 'match', 'run']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', f + '.js'), 'utf8'), ctx);
const { CS, Chess: C, AI, Data: D } = ctx;
CS.meta = { crowns: 0, levels: {}, stats: {} };
const N = +process.argv[2] || 24, DEPTH = +process.argv[3] || 3;
const STYLE = { easy: 'rookie', normal: 'aggressive', hard: 'positional', boss: 'balanced' };
function game(pa, ea, tier) {
  const pos = C.Position.fromFEN(CS._test.setupFEN(pa, ea)), df = D.DIFFS[tier];
  for (let ply = 0; ply < 240; ply++) {
    const st = pos.gameStatus();
    if (st.over) return st.result === 'checkmate' ? (st.winner === 0 ? 'win' : 'loss') : 'draw';
    const r = pos.turn === 0 ? AI.choose(pos, { depth: DEPTH, timeMs: 150, style: 'balanced' }) : AI.choose(pos, { depth: df.depth, timeMs: df.timeMs, style: STYLE[tier], blunder: df.blunder });
    pos.make(r.move);
  }
  return 'draw';
}
const armies = [{ p: 5, n: 0, b: 0, r: 0, q: 0 }, { p: 6, n: 1, b: 0, r: 0, q: 0 }, { p: 6, n: 1, b: 1, r: 1, q: 0 }];
console.log(`proxy player depth ${DEPTH}, ${N} games per cell (win/draw/loss)\n`);
for (const pa of armies.slice(0, +process.env.ARMIES || 3)) {
  const pv = CS._test.armyValue(pa);
  for (const tier of ['easy', 'normal', 'hard', 'boss']) {
    const df = D.DIFFS[tier], budget = Math.max(2, Math.round(pv * df.budget[0] + df.budget[1]));
    const res = { win: 0, draw: 0, loss: 0 };
    for (let i = 0; i < N; i++) res[game(pa, CS._test.buildEnemyArmy(budget, false), tier)]++;
    console.log(`player ${JSON.stringify(pa).replace(/"/g, '')}  vs ${tier.padEnd(6)} (enemy ${budget} pts): ${res.win}/${res.draw}/${res.loss}`);
  }
}
