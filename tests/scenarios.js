// Validates every scenario: legal position, side to move not giving check, objective achievable.
const C = require('../js/chess.js'), AI = require('../js/ai.js'), D = require('../js/data.js');
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } else console.log('OK  ', m); };
function canCapQ(pos, n) {
  for (const m of pos.legal()) {
    if ((C.mFlags(m) & C.F_CAP) && (pos.board[C.mTo(m)] & 7) === C.QUEEN) return true;
    if (n > 1) {
      pos.make(m); let all = pos.legal().length > 0;
      for (const r of pos.legal()) { pos.make(r); const sub = canCapQ(pos, n - 1); pos.unmake(); if (!sub) { all = false; break; } }
      pos.unmake(); if (all) return true;
    }
  }
  return false;
}
for (const s of D.SCENARIOS) {
  const pos = C.Position.fromFEN(s.fen);
  const legal = pos.legal().length;
  ok(legal > 0 && !pos.inCheck(pos.turn ^ 1) && pos.kingSq[0] >= 0 && pos.kingSq[1] >= 0, `${s.id}: legal start position`);
  if (s.obj.type === 'mateIn' && s.obj.n <= 3) ok(!!AI.findMate(pos, s.obj.n), `${s.id}: forced mate within ${s.obj.n} exists`);
  if (s.obj.type === 'captureQueen') ok(canCapQ(pos, s.obj.n), `${s.id}: queen capture forced within ${s.obj.n}`);
  if (s.obj.type === 'mateIn' && s.obj.n > 3) { // long endgame: the AI itself must be able to convert it
    let p = C.Position.fromFEN(s.fen), plies = 0, st;
    while (plies < 2 * s.obj.n) { st = p.gameStatus(); if (st.over) break; const r = AI.choose(p, p.turn === pos.turn ? { depth: 5, timeMs: 300 } : { depth: 3, timeMs: 100, style: 'balanced' }); p.make(r.move); plies++; }
    ok(st.over && st.result === 'checkmate' && plies <= 2 * s.obj.n, `${s.id}: AI converts within ${s.obj.n} moves (took ${Math.ceil(plies / 2)})`);
  }
}
console.log(fail ? `\n${fail} FAILURES` : '\nALL SCENARIO TESTS PASSED');
process.exit(fail ? 1 : 0);
