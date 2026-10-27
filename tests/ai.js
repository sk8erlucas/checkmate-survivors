const C = require('../js/chess.js');
const AI = require('../js/ai.js');
let fail = 0;
const ok = (c, msg) => { if (!c) { fail++; console.log('FAIL', msg); } else console.log('OK  ', msg); };

// 1. finds mate in one, FEN unchanged by the search
{
  const pos = C.Position.fromFEN('6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1');
  const before = pos.toFEN();
  const r = AI.choose(pos, { depth: 3, timeMs: 500 });
  ok(C.sqName(C.mFrom(r.move)) + C.sqName(C.mTo(r.move)) === 'd1d8', 'finds back-rank mate Rd8# (got ' + C.sqName(C.mFrom(r.move)) + C.sqName(C.mTo(r.move)) + ')');
  ok(pos.toFEN() === before, 'search does not modify the position');
}
// 2. avoids hanging the queen / takes a free queen
{
  const pos = C.Position.fromFEN('4k3/8/8/3q4/8/4N3/8/4K3 w - - 0 1');
  const r = AI.choose(pos, { depth: 3, timeMs: 500 });
  ok(C.sqName(C.mTo(r.move)) === 'd5', 'captures free queen with the knight');
}
// 3. depth / speed from the start position
for (const d of [2, 3, 4, 5]) {
  const pos = C.Position.fromFEN(C.START_FEN);
  const t0 = Date.now();
  const r = AI.choose(pos, { depth: d, timeMs: 5000 });
  console.log(`     start position depth ${d}: ${Date.now() - t0} ms, ${r.nodes} nodes, reached depth ${r.depth}`);
}
// 4. self-play: strong vs weak, every move must be legal and the game must finish cleanly
{
  const pos = C.Position.fromFEN('4k3/pppp4/8/8/8/8/4PPPP/4K3 w - - 0 1');
  let plies = 0, status;
  const t0 = Date.now();
  while (plies < 300) {
    status = pos.gameStatus(); if (status.over) break;
    const strong = pos.turn === C.WHITE;
    const r = AI.choose(pos, strong ? { depth: 4, timeMs: 300, style: 'balanced' } : { depth: 1, timeMs: 100, style: 'rookie', blunder: 0.3 });
    const legal = pos.legal();
    if (!legal.includes(r.move)) { fail++; console.log('FAIL illegal move chosen'); break; }
    pos.make(r.move); plies++;
  }
  console.log('     K+4P vs K+4P self-play finished:', JSON.stringify(status), 'in', plies, 'plies,', Date.now() - t0, 'ms');
  ok(plies > 0, 'self-play ran');
}
// 5. KQ vs K is converted by the AI (mop-up evaluation)
{
  const pos = C.Position.fromFEN('4k3/8/8/8/8/8/8/3QK3 w - - 0 1');
  let plies = 0, status;
  while (plies < 120) {
    status = pos.gameStatus(); if (status.over) break;
    const r = AI.choose(pos, pos.turn === C.WHITE ? { depth: 4, timeMs: 300 } : { depth: 2, timeMs: 100, style: 'rookie' });
    pos.make(r.move); plies++;
  }
  ok(status.over && status.result === 'checkmate' && status.winner === C.WHITE, 'AI mates with KQ vs K (' + JSON.stringify(status) + ' in ' + plies + ' plies)');
}
console.log(fail ? `\n${fail} FAILURES` : '\nALL AI TESTS PASSED');
process.exit(fail ? 1 : 0);
