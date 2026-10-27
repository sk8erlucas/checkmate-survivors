/* =========================================================================
 * Checkmate Survivors - ai.js
 * Hand-written chess AI (NO external engine, NO machine learning):
 * iterative-deepening alpha-beta + quiescence + hand-tuned evaluation.
 * Each opponent "personality" is just a different set of evaluation weights
 * plus a depth / blunder-rate, so difficulty is fully controllable.
 * ====================================================================== */
(function (root) {
'use strict';
const C = (typeof module !== 'undefined' && module.exports) ? require('./chess.js') : root.Chess;
const { WHITE, BLACK, PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING, F_CAP, F_EP, F_PROMO } = C;

const MATE = 100000, INF = 1000000;
const VAL = [0, 100, 320, 330, 500, 900, 0];
const VICT = [0, 1, 3, 3, 5, 9, 10];
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

// piece-square tables, written from White's point of view (rank 8 first)
const T_PAWN = [0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10, 5,5,10,25,25,10,5,5, 0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5, 5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0];
const T_KNIGHT = [-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30, -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30, -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50];
const T_BISHOP = [-20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10, -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10, -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20];
const T_ROOK = [0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0];
const T_QUEEN = [-20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5, 0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20];
const T_KMID = [-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10, 20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20];
const T_KEND = [-50,-40,-30,-20,-20,-30,-40,-50, -30,-20,-10,0,0,-10,-20,-30, -30,-10,20,30,30,20,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,20,30,30,20,-10,-30, -30,-30,0,0,0,0,-30,-30, -50,-30,-30,-30,-30,-30,-30,-50];
function mkTables(t) {
  const w = new Int16Array(64), b = new Int16Array(64);
  for (let s = 0; s < 64; s++) { const f = s & 7, r = s >> 3; w[s] = t[(7 - r) * 8 + f]; b[s] = t[r * 8 + f]; }
  return [w, b];
}
const PSTW = [null], PSTB = [null];
for (const t of [T_PAWN, T_KNIGHT, T_BISHOP, T_ROOK, T_QUEEN]) { const [w, b] = mkTables(t); PSTW.push(w); PSTB.push(b); }
const [KMW, KMB] = mkTables(T_KMID), [KEW, KEB] = mkTables(T_KEND);
const CD = new Int8Array(64); // distance from the centre (0..6)
for (let s = 0; s < 64; s++) { const f = s & 7, r = s >> 3; CD[s] = (3 - Math.min(f, 7 - f)) + (3 - Math.min(r, 7 - r)); }
const PASS = [0, 5, 10, 20, 35, 60, 100, 0];
const ATKW = [0, 0, 4, 3, 3, 6, 0];

// ---- personalities -------------------------------------------------------
const STYLES = {
  balanced:   { mat: 1.00, pst: 1.00, kingAtk: 0.5, kingSafe: 0.6, passed: 1.0, advance: 0.0 },
  aggressive: { mat: 0.95, pst: 0.80, kingAtk: 2.4, kingSafe: 0.1, passed: 1.0, advance: 1.5 },
  defensive:  { mat: 1.05, pst: 0.80, kingAtk: 0.1, kingSafe: 2.2, passed: 0.7, advance: 0.0 },
  greedy:     { mat: 1.60, pst: 0.30, kingAtk: 0.0, kingSafe: 0.0, passed: 0.5, advance: 0.0 },
  positional: { mat: 1.00, pst: 1.70, kingAtk: 0.3, kingSafe: 0.8, passed: 1.5, advance: 0.3 },
  rookie:     { mat: 1.00, pst: 0.40, kingAtk: 0.2, kingSafe: 0.2, passed: 0.5, advance: 0.5 },
};

const bMax = new Int8Array(8), wMin = new Int8Array(8);
function mopUp(loser, winner) {
  const d = Math.abs((loser & 7) - (winner & 7)) + Math.abs((loser >> 3) - (winner >> 3));
  return 10 * CD[loser] + 4 * (14 - d);
}
function shield(b, ks, c) {
  const kf = ks & 7, kr = ks >> 3, dir = c === WHITE ? 1 : -1, pawn = C.mk(PAWN, c);
  let n = 0;
  for (let df = -1; df <= 1; df++) {
    const f = kf + df; if (f < 0 || f > 7) continue;
    for (let k = 1; k <= 2; k++) { const r = kr + dir * k; if (r < 0 || r > 7) continue; if (b[r * 8 + f] === pawn) n += (k === 1 ? 2 : 1); }
  }
  return n * 6;
}

// score from the point of view of the side to move
function evaluate(pos, w) {
  const b = pos.board;
  bMax.fill(-1); wMin.fill(8);
  let npm0 = 0, npm1 = 0, pawns = 0;
  for (let s = 0; s < 64; s++) {
    const p = b[s]; if (!p) continue;
    const t = p & 7;
    if (t === PAWN) {
      pawns++; const f = s & 7, r = s >> 3;
      if ((p >> 3) === WHITE) { if (r < wMin[f]) wMin[f] = r; } else if (r > bMax[f]) bMax[f] = r;
    } else if (t !== KING) { if ((p >> 3) === WHITE) npm0 += VAL[t]; else npm1 += VAL[t]; }
  }
  if (pawns === 0 && npm0 <= 330 && npm1 <= 330) return 0; // dead draw
  const eg = (npm0 + npm1) <= 1400;
  let mat = 0, pst = 0, passed = 0, katk = 0, adv = 0;
  const wk = pos.kingSq[0], bk = pos.kingSq[1];
  const wkf = wk & 7, wkr = wk >> 3, bkf = bk & 7, bkr = bk >> 3;
  for (let s = 0; s < 64; s++) {
    const p = b[s]; if (!p) continue;
    const t = p & 7, f = s & 7, r = s >> 3;
    if ((p >> 3) === WHITE) {
      mat += VAL[t];
      pst += t === KING ? (eg ? KEW[s] : KMW[s]) : PSTW[t][s];
      if (t === PAWN) {
        if (bMax[f] <= r && (f === 0 || bMax[f - 1] <= r) && (f === 7 || bMax[f + 1] <= r)) passed += PASS[r];
        adv += r - 1;
      } else if (t !== KING) katk += (7 - Math.max(Math.abs(f - bkf), Math.abs(r - bkr))) * ATKW[t];
    } else {
      mat -= VAL[t];
      pst -= t === KING ? (eg ? KEB[s] : KMB[s]) : PSTB[t][s];
      if (t === PAWN) {
        if (wMin[f] >= r && (f === 0 || wMin[f - 1] >= r) && (f === 7 || wMin[f + 1] >= r)) passed -= PASS[7 - r];
        adv -= 6 - r;
      } else if (t !== KING) katk -= (7 - Math.max(Math.abs(f - wkf), Math.abs(r - wkr))) * ATKW[t];
    }
  }
  let score = mat * w.mat + pst * w.pst + passed * w.passed * (eg ? 1.5 : 1) + katk * w.kingAtk * (eg ? 0.3 : 1) + adv * w.advance * 3;
  if (!eg && w.kingSafe > 0) score += (shield(b, wk, WHITE) - shield(b, bk, BLACK)) * w.kingSafe;
  if (eg) {
    if (mat > 250 && npm1 <= 400) score += mopUp(bk, wk);
    else if (mat < -250 && npm0 <= 400) score -= mopUp(wk, bk);
  }
  score += pos.turn === WHITE ? 8 : -8;
  return Math.round(pos.turn === WHITE ? score : -score);
}

// ---- search --------------------------------------------------------------
const tt = new Map();
let nodes = 0, deadline = 0, stopped = false, W = STYLES.balanced;
const killers = []; for (let i = 0; i < 64; i++) killers.push([0, 0]);
const history = new Int32Array(2 * 64 * 64);

function scoreMoves(pos, moves, ttMove, ply) {
  const n = moves.length, sc = new Array(n), b = pos.board, turn = pos.turn, k = killers[ply > 63 ? 63 : ply];
  for (let i = 0; i < n; i++) {
    const m = moves[i]; let s;
    if (m === ttMove) s = 10000000;
    else {
      const fl = m >> 15;
      if (fl & F_CAP) { const victim = (fl & F_EP) ? PAWN : (b[(m >> 6) & 63] & 7); s = 1000000 + VICT[victim] * 16 - (b[m & 63] & 7); }
      else if (m === k[0]) s = 900000;
      else if (m === k[1]) s = 800000;
      else s = history[(turn * 64 + (m & 63)) * 64 + ((m >> 6) & 63)];
      if (fl & F_PROMO) s += ((m >> 12) & 7) === QUEEN ? 950000 : -50000;
    }
    sc[i] = s;
  }
  return sc;
}
function pick(moves, sc, i) {
  let bi = i, bs = sc[i];
  for (let j = i + 1; j < moves.length; j++) if (sc[j] > bs) { bs = sc[j]; bi = j; }
  if (bi !== i) { const tm = moves[i]; moves[i] = moves[bi]; moves[bi] = tm; const ts = sc[i]; sc[i] = sc[bi]; sc[bi] = ts; }
  return moves[i];
}

function qsearch(pos, alpha, beta, ply, qd) {
  if ((++nodes & 2047) === 0 && now() > deadline) stopped = true;
  if (stopped) return 0;
  const stand = evaluate(pos, W);
  if (stand >= beta) return stand;
  if (stand > alpha) alpha = stand;
  if (qd >= 6) return alpha;
  const us = pos.turn, b = pos.board;
  const moves = pos.gen(true), sc = scoreMoves(pos, moves, 0, ply);
  for (let i = 0; i < moves.length; i++) {
    const m = pick(moves, sc, i), fl = m >> 15;
    if (!(fl & F_PROMO)) { const victim = (fl & F_EP) ? PAWN : (b[(m >> 6) & 63] & 7); if (stand + VAL[victim] + 200 < alpha) continue; }
    pos.make(m);
    if (pos.isAttacked(pos.kingSq[us], us ^ 1)) { pos.unmake(); continue; }
    const score = -qsearch(pos, -beta, -alpha, ply + 1, qd + 1);
    pos.unmake();
    if (stopped) return 0;
    if (score >= beta) return score;
    if (score > alpha) alpha = score;
  }
  return alpha;
}

function negamax(pos, depth, alpha, beta, ply) {
  if ((++nodes & 2047) === 0 && now() > deadline) stopped = true;
  if (stopped) return 0;
  if (ply > 0) { if (pos.halfmove >= 100) return 0; if (pos.repCount() >= 2) return 0; }
  const us = pos.turn;
  const inChk = pos.isAttacked(pos.kingSq[us], us ^ 1);
  if (inChk && ply < 40) depth++;
  if (depth <= 0) return qsearch(pos, alpha, beta, ply, 0);
  const key = pos.key(), alpha0 = alpha;
  let ttMove = 0;
  const e = tt.get(key);
  if (e) {
    ttMove = e.m;
    if (e.d >= depth && ply > 0 && Math.abs(e.s) < MATE - 200) {
      if (e.f === 0) return e.s;
      if (e.f === 1 && e.s >= beta) return e.s;
      if (e.f === 2 && e.s <= alpha) return e.s;
    }
  }
  const moves = pos.gen(false), sc = scoreMoves(pos, moves, ttMove, ply);
  let best = -INF, bestMove = 0, legal = 0;
  for (let i = 0; i < moves.length; i++) {
    const m = pick(moves, sc, i), fl = m >> 15;
    pos.make(m);
    if (pos.isAttacked(pos.kingSq[us], us ^ 1)) { pos.unmake(); continue; }
    legal++;
    const quiet = !(fl & (F_CAP | F_PROMO));
    let score;
    if (legal > 4 && depth >= 3 && quiet && !inChk) {
      score = -negamax(pos, depth - 2, -alpha - 1, -alpha, ply + 1);
      if (score > alpha && !stopped) score = -negamax(pos, depth - 1, -beta, -alpha, ply + 1);
    } else score = -negamax(pos, depth - 1, -beta, -alpha, ply + 1);
    pos.unmake();
    if (stopped) return 0;
    if (score > best) {
      best = score; bestMove = m;
      if (score > alpha) {
        alpha = score;
        if (alpha >= beta) {
          if (quiet) {
            const k = killers[ply > 63 ? 63 : ply];
            if (k[0] !== m) { k[1] = k[0]; k[0] = m; }
            history[(us * 64 + (m & 63)) * 64 + ((m >> 6) & 63)] += depth * depth;
          }
          break;
        }
      }
    }
  }
  if (legal === 0) return inChk ? -(MATE - ply) : 0;
  tt.set(key, { d: depth, s: best, f: best <= alpha0 ? 2 : (best >= beta ? 1 : 0), m: bestMove });
  return best;
}

function searchRoot(pos, depth, rootMoves) {
  let alpha = -INF, best = 0, bestScore = -INF;
  for (let i = 0; i < rootMoves.length; i++) {
    const m = rootMoves[i];
    pos.make(m);
    let score;
    if (i === 0) score = -negamax(pos, depth - 1, -INF, -alpha, 1);
    else {
      score = -negamax(pos, depth - 1, -alpha - 1, -alpha, 1);
      if (!stopped && score > alpha) score = -negamax(pos, depth - 1, -INF, -alpha, 1);
    }
    pos.unmake();
    if (stopped) return null;
    if (score > bestScore) { bestScore = score; best = m; if (score > alpha) alpha = score; }
  }
  return { best, bestScore };
}

function hasMateInOne(pos) {
  const us = pos.turn;
  for (const m of pos.legal()) {
    pos.make(m);
    const mate = pos.inCheck() && pos.legal().length === 0;
    pos.unmake();
    if (mate) return true;
  }
  return false;
}

/* opts: { depth, timeMs, weights | style, blunder (0..1), rng } -> { move, score, depth, nodes, blundered } */
function choose(position, opts) {
  opts = opts || {};
  const pos = position.clone();
  W = opts.weights || STYLES[opts.style] || STYLES.balanced;
  const rng = opts.rng || Math.random;
  const legal = pos.legal();
  if (!legal.length) return null;
  if (legal.length === 1) return { move: legal[0], score: 0, depth: 0, nodes: 0, blundered: false };
  if (tt.size > 250000) tt.clear();
  history.fill(0);
  for (const k of killers) { k[0] = 0; k[1] = 0; }
  nodes = 0; stopped = false; deadline = now() + (opts.timeMs || 400);
  const pieces = pos.countPieces();
  const bonus = (opts.depth || 3) >= 3 ? (pieces <= 4 ? 2 : (pieces <= 8 ? 1 : 0)) : 0;
  const maxD = Math.min((opts.depth || 3) + bonus, 14);
  let ordered = legal.slice();
  { const sc = scoreMoves(pos, ordered, 0, 0); for (let i = 0; i < ordered.length; i++) pick(ordered, sc, i); }
  let best = ordered[0], bestScore = 0, done = 0;
  for (let d = 1; d <= maxD; d++) {
    const r = searchRoot(pos, d, ordered);
    if (!r) break;
    best = r.best; bestScore = r.bestScore; done = d;
    ordered = [best].concat(ordered.filter(m => m !== best));
    if (Math.abs(bestScore) > MATE - 100) break;
    if (now() > deadline) break;
  }
  let blundered = false;
  if (opts.blunder && rng() < opts.blunder) {
    deadline = Infinity; stopped = false;
    const q = legal.map(m => { pos.make(m); const s = -qsearch(pos, -INF, INF, 1, 0); pos.unmake(); return { m, s }; });
    q.sort((a, c) => c.s - a.s);
    const top = q.slice(0, 5).filter(x => x.s >= q[0].s - 250);
    const cand = top[Math.floor(rng() * top.length)];
    if (cand && cand.m !== best) {
      pos.make(cand.m);
      const bad = hasMateInOne(pos);
      pos.unmake();
      if (!bad) { best = cand.m; blundered = true; }
    }
  }
  return { move: best, score: bestScore, depth: done, nodes, blundered };
}

function hint(pos) { return choose(pos, { depth: 6, timeMs: 700, style: 'balanced', blunder: 0 }); }

// exhaustive forced-mate solver (used by tests and to validate scenarios)
function findMate(pos, n) {
  for (const m of pos.legal()) {
    pos.make(m);
    let ok = false;
    const replies = pos.legal();
    if (replies.length === 0) ok = pos.inCheck();
    else if (n > 1) {
      ok = true;
      for (const r of replies) { pos.make(r); const sub = findMate(pos, n - 1); pos.unmake(); if (!sub) { ok = false; break; } }
    }
    pos.unmake();
    if (ok) return m;
  }
  return 0;
}

const api = { STYLES, evaluate, choose, hint, findMate, clearTT: () => tt.clear(), MATE };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.AI = api;
})(typeof window !== 'undefined' ? window : globalThis);
