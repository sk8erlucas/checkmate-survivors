// Validates the move generator against well-known perft node counts.
const C = require('../js/chess.js');
const suites = [
  ['startpos', C.START_FEN, [20, 400, 8902, 197281]],
  ['kiwipete', 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', [48, 2039, 97862]],
  ['position3', '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', [14, 191, 2812, 43238, 674624]],
  ['position4', 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', [6, 264, 9467]],
  ['position5', 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', [44, 1486, 62379]],
  ['position6', 'r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10', [46, 2079, 89890]],
];
let fail = 0;
for (const [name, fen, exp] of suites) {
  const pos = C.Position.fromFEN(fen);
  const t0 = Date.now();
  exp.forEach((e, i) => {
    const got = C.perft(pos, i + 1);
    const ok = got === e;
    if (!ok) fail++;
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${name} depth ${i + 1}: ${got} (expected ${e})`);
  });
  if (pos.toFEN().split(' ')[0] !== fen.split(' ')[0]) { fail++; console.log('FAIL board corrupted after perft in', name); }
  console.log(`     ${name} took ${Date.now() - t0} ms`);
}
// hash consistency: incremental hash must equal recomputed hash after random play
{
  const pos = C.Position.fromFEN(C.START_FEN);
  for (let i = 0; i < 200; i++) {
    const ms = pos.legal(); if (!ms.length) break;
    pos.make(ms[(i * 7919) % ms.length]);
    const a = pos.key(); const c = C.Position.fromFEN(pos.toFEN()); 
    if (c.key() !== a) { 
      // ep hash differs only when ep square is set; compare after clearing ep
      const p2 = C.Position.fromFEN(pos.toFEN()); 
      if (p2.key() !== a) { fail++; console.log('FAIL hash mismatch at ply', i); break; }
    }
  }
  console.log('hash check done');
}
console.log(fail ? `\n${fail} FAILURES` : '\nALL PERFT TESTS PASSED');
process.exit(fail ? 1 : 0);
