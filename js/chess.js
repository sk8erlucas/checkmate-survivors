/* =========================================================================
 * Checkmate Survivors - chess.js
 * Chess rules engine: move generation, make/unmake, check/mate/draw
 * detection, SAN output. Pure JS, no dependencies (browser + Node).
 * ====================================================================== */
(function (root) {
'use strict';

const WHITE = 0, BLACK = 1;
const PAWN = 1, KNIGHT = 2, BISHOP = 3, ROOK = 4, QUEEN = 5, KING = 6;
const PIECE_CHARS = 'pnbrqk';
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const PROMOS = [QUEEN, ROOK, BISHOP, KNIGHT];

// move flags
const F_CAP = 1, F_EP = 2, F_CASTLE = 4, F_DPP = 8, F_PROMO = 16;

const mk = (t, c) => t | (c << 3);
const enc = (from, to, promo, flags) => from | (to << 6) | (promo << 12) | (flags << 15);
const mFrom = m => m & 63;
const mTo = m => (m >> 6) & 63;
const mPromo = m => (m >> 12) & 7;
const mFlags = m => m >> 15;
const sqName = s => 'abcdefgh'[s & 7] + (1 + (s >> 3));
const nameSq = n => (n.charCodeAt(0) - 97) + (n.charCodeAt(1) - 49) * 8;

// ---- precomputed tables --------------------------------------------------
const KNIGHT_T = [], KING_T = [], RAYS = [], PAWN_ATT = [[], []];
const DIRS = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]]; // 0-3 rook, 4-7 bishop
(function init() {
  const KN = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
  for (let s = 0; s < 64; s++) {
    const f = s & 7, r = s >> 3;
    KNIGHT_T[s] = []; KING_T[s] = []; RAYS[s] = [];
    for (const [df, dr] of KN) { const nf = f + df, nr = r + dr; if (nf >= 0 && nf < 8 && nr >= 0 && nr < 8) KNIGHT_T[s].push(nr * 8 + nf); }
    for (let df = -1; df <= 1; df++) for (let dr = -1; dr <= 1; dr++) {
      if (!df && !dr) continue;
      const nf = f + df, nr = r + dr;
      if (nf >= 0 && nf < 8 && nr >= 0 && nr < 8) KING_T[s].push(nr * 8 + nf);
    }
    DIRS.forEach(([df, dr], i) => {
      const ray = []; let nf = f + df, nr = r + dr;
      while (nf >= 0 && nf < 8 && nr >= 0 && nr < 8) { ray.push(nr * 8 + nf); nf += df; nr += dr; }
      RAYS[s][i] = ray;
    });
    PAWN_ATT[0][s] = []; PAWN_ATT[1][s] = [];
    for (const df of [-1, 1]) {
      if (f + df < 0 || f + df > 7) continue;
      if (r < 7) PAWN_ATT[0][s].push((r + 1) * 8 + f + df);
      if (r > 0) PAWN_ATT[1][s].push((r - 1) * 8 + f + df);
    }
  }
})();

const CASTLE_MASK = new Array(64).fill(15);
CASTLE_MASK[0] = 13; CASTLE_MASK[7] = 14; CASTLE_MASK[4] = 12;
CASTLE_MASK[56] = 7; CASTLE_MASK[63] = 11; CASTLE_MASK[60] = 3;

// ---- zobrist -------------------------------------------------------------
let _seed = 0x1234ABCD;
function rnd32() { _seed ^= _seed << 13; _seed ^= _seed >>> 17; _seed ^= _seed << 5; return _seed | 0; }
const ZHI = new Int32Array(16 * 64), ZLO = new Int32Array(16 * 64);
const CHI = new Int32Array(16), CLO = new Int32Array(16), EHI = new Int32Array(8), ELO = new Int32Array(8);
for (let i = 0; i < ZHI.length; i++) { ZHI[i] = rnd32(); ZLO[i] = rnd32(); }
for (let i = 0; i < 16; i++) { CHI[i] = rnd32(); CLO[i] = rnd32(); }
for (let i = 0; i < 8; i++) { EHI[i] = rnd32(); ELO[i] = rnd32(); }
const SIDE_HI = rnd32(), SIDE_LO = rnd32();

// ---- position ------------------------------------------------------------
class Position {
  constructor() {
    this.board = new Uint8Array(64);
    this.turn = WHITE; this.castling = 0; this.ep = -1;
    this.halfmove = 0; this.fullmove = 1;
    this.kingSq = [-1, -1];
    this.stack = []; this.keys = [];
    this.hi = 0; this.lo = 0;
  }

  static fromFEN(fen) {
    const p = new Position();
    const parts = fen.trim().split(/\s+/);
    let r = 7, f = 0;
    for (const ch of parts[0]) {
      if (ch === '/') { r--; f = 0; }
      else if (ch >= '1' && ch <= '8') f += ch.charCodeAt(0) - 48;
      else {
        const lower = ch.toLowerCase();
        const t = PIECE_CHARS.indexOf(lower) + 1;
        const c = ch === lower ? BLACK : WHITE;
        const s = r * 8 + f;
        p.board[s] = mk(t, c);
        if (t === KING) p.kingSq[c] = s;
        f++;
      }
    }
    p.turn = parts[1] === 'b' ? BLACK : WHITE;
    const cs = parts[2] || '-';
    p.castling = (cs.includes('K') ? 1 : 0) | (cs.includes('Q') ? 2 : 0) | (cs.includes('k') ? 4 : 0) | (cs.includes('q') ? 8 : 0);
    p.ep = parts[3] && parts[3] !== '-' ? nameSq(parts[3]) : -1;
    p.halfmove = parseInt(parts[4] || '0', 10) || 0;
    p.fullmove = parseInt(parts[5] || '1', 10) || 1;
    p._fixCastling();
    p._computeHash();
    p.keys = [p.key()];
    return p;
  }

  _fixCastling() {
    const b = this.board; let c = this.castling;
    if (b[4] !== mk(KING, WHITE)) c &= ~3; else { if (b[7] !== mk(ROOK, WHITE)) c &= ~1; if (b[0] !== mk(ROOK, WHITE)) c &= ~2; }
    if (b[60] !== mk(KING, BLACK)) c &= ~12; else { if (b[63] !== mk(ROOK, BLACK)) c &= ~4; if (b[56] !== mk(ROOK, BLACK)) c &= ~8; }
    this.castling = c;
  }

  _computeHash() {
    let hi = 0, lo = 0;
    for (let s = 0; s < 64; s++) { const p = this.board[s]; if (p) { hi ^= ZHI[p * 64 + s]; lo ^= ZLO[p * 64 + s]; } }
    if (this.turn === BLACK) { hi ^= SIDE_HI; lo ^= SIDE_LO; }
    hi ^= CHI[this.castling]; lo ^= CLO[this.castling];
    if (this.ep >= 0) { hi ^= EHI[this.ep & 7]; lo ^= ELO[this.ep & 7]; }
    this.hi = hi; this.lo = lo;
  }

  key() { return (this.hi & 0x1FFFFF) * 4294967296 + (this.lo >>> 0); }

  toFEN() {
    let s = '';
    for (let r = 7; r >= 0; r--) {
      let e = 0;
      for (let f = 0; f < 8; f++) {
        const p = this.board[r * 8 + f];
        if (!p) { e++; continue; }
        if (e) { s += e; e = 0; }
        const ch = PIECE_CHARS[(p & 7) - 1];
        s += (p >> 3) === WHITE ? ch.toUpperCase() : ch;
      }
      if (e) s += e;
      if (r) s += '/';
    }
    const cs = ((this.castling & 1) ? 'K' : '') + ((this.castling & 2) ? 'Q' : '') + ((this.castling & 4) ? 'k' : '') + ((this.castling & 8) ? 'q' : '');
    return `${s} ${this.turn === WHITE ? 'w' : 'b'} ${cs || '-'} ${this.ep >= 0 ? sqName(this.ep) : '-'} ${this.halfmove} ${this.fullmove}`;
  }

  clone() { const p = Position.fromFEN(this.toFEN()); p.keys = this.keys.slice(); return p; }

  isAttacked(sq, by) {
    const b = this.board;
    const pawn = mk(PAWN, by);
    const pa = PAWN_ATT[by ^ 1][sq];
    for (let i = 0; i < pa.length; i++) if (b[pa[i]] === pawn) return true;
    const kn = mk(KNIGHT, by), kt = KNIGHT_T[sq];
    for (let i = 0; i < kt.length; i++) if (b[kt[i]] === kn) return true;
    const kg = mk(KING, by), gt = KING_T[sq];
    for (let i = 0; i < gt.length; i++) if (b[gt[i]] === kg) return true;
    const rk = mk(ROOK, by), qn = mk(QUEEN, by), bs = mk(BISHOP, by);
    for (let d = 0; d < 4; d++) {
      const ray = RAYS[sq][d];
      for (let i = 0; i < ray.length; i++) { const p = b[ray[i]]; if (p) { if (p === rk || p === qn) return true; break; } }
    }
    for (let d = 4; d < 8; d++) {
      const ray = RAYS[sq][d];
      for (let i = 0; i < ray.length; i++) { const p = b[ray[i]]; if (p) { if (p === bs || p === qn) return true; break; } }
    }
    return false;
  }

  inCheck(color) { const c = color === undefined ? this.turn : color; return this.isAttacked(this.kingSq[c], c ^ 1); }

  // pseudo-legal move generation (capsOnly: captures + queen promotions)
  gen(capsOnly) {
    const moves = [];
    const b = this.board, us = this.turn, them = us ^ 1;
    const promoRank = us === WHITE ? 6 : 1, startRank = us === WHITE ? 1 : 6, dir = us === WHITE ? 8 : -8;
    for (let s = 0; s < 64; s++) {
      const p = b[s];
      if (!p || (p >> 3) !== us) continue;
      const t = p & 7;
      if (t === PAWN) {
        const r = s >> 3, one = s + dir;
        if (b[one] === 0) {
          if (r === promoRank) {
            moves.push(enc(s, one, QUEEN, F_PROMO));
            if (!capsOnly) moves.push(enc(s, one, ROOK, F_PROMO), enc(s, one, BISHOP, F_PROMO), enc(s, one, KNIGHT, F_PROMO));
          } else if (!capsOnly) {
            moves.push(enc(s, one, 0, 0));
            if (r === startRank && b[one + dir] === 0) moves.push(enc(s, one + dir, 0, F_DPP));
          }
        }
        const att = PAWN_ATT[us][s];
        for (let i = 0; i < att.length; i++) {
          const to = att[i], q = b[to];
          if (q && (q >> 3) === them) {
            if (r === promoRank) { for (let k = 0; k < 4; k++) moves.push(enc(s, to, PROMOS[k], F_CAP | F_PROMO)); }
            else moves.push(enc(s, to, 0, F_CAP));
          } else if (!q && to === this.ep) moves.push(enc(s, to, 0, F_CAP | F_EP));
        }
      } else if (t === KNIGHT || t === KING) {
        const tg = t === KNIGHT ? KNIGHT_T[s] : KING_T[s];
        for (let i = 0; i < tg.length; i++) {
          const to = tg[i], q = b[to];
          if (!q) { if (!capsOnly) moves.push(enc(s, to, 0, 0)); }
          else if ((q >> 3) === them) moves.push(enc(s, to, 0, F_CAP));
        }
      } else {
        const d0 = t === BISHOP ? 4 : 0, d1 = t === ROOK ? 4 : 8;
        for (let d = d0; d < d1; d++) {
          const ray = RAYS[s][d];
          for (let i = 0; i < ray.length; i++) {
            const to = ray[i], q = b[to];
            if (!q) { if (!capsOnly) moves.push(enc(s, to, 0, 0)); }
            else { if ((q >> 3) === them) moves.push(enc(s, to, 0, F_CAP)); break; }
          }
        }
      }
    }
    if (!capsOnly) {
      if (us === WHITE) {
        if ((this.castling & 1) && !b[5] && !b[6] && !this.isAttacked(4, BLACK) && !this.isAttacked(5, BLACK)) moves.push(enc(4, 6, 0, F_CASTLE));
        if ((this.castling & 2) && !b[1] && !b[2] && !b[3] && !this.isAttacked(4, BLACK) && !this.isAttacked(3, BLACK)) moves.push(enc(4, 2, 0, F_CASTLE));
      } else {
        if ((this.castling & 4) && !b[61] && !b[62] && !this.isAttacked(60, WHITE) && !this.isAttacked(61, WHITE)) moves.push(enc(60, 62, 0, F_CASTLE));
        if ((this.castling & 8) && !b[57] && !b[58] && !b[59] && !this.isAttacked(60, WHITE) && !this.isAttacked(59, WHITE)) moves.push(enc(60, 58, 0, F_CASTLE));
      }
    }
    return moves;
  }

  legal() {
    const ps = this.gen(false), out = [], us = this.turn;
    for (let i = 0; i < ps.length; i++) {
      const m = ps[i];
      this.make(m);
      if (!this.isAttacked(this.kingSq[us], us ^ 1)) out.push(m);
      this.unmake();
    }
    return out;
  }

  make(m) {
    const b = this.board, from = m & 63, to = (m >> 6) & 63, pr = (m >> 12) & 7, fl = m >> 15;
    const us = this.turn, them = us ^ 1;
    const p = b[from];
    let cap = b[to], capSq = to;
    const u = { m, cap: 0, capSq: -1, castling: this.castling, ep: this.ep, half: this.halfmove, hi: this.hi, lo: this.lo };
    let hi = this.hi, lo = this.lo;
    hi ^= ZHI[p * 64 + from]; lo ^= ZLO[p * 64 + from];
    if (fl & F_EP) { capSq = us === WHITE ? to - 8 : to + 8; cap = b[capSq]; }
    if (cap) { hi ^= ZHI[cap * 64 + capSq]; lo ^= ZLO[cap * 64 + capSq]; b[capSq] = 0; u.cap = cap; u.capSq = capSq; }
    b[from] = 0;
    const np = pr ? mk(pr, us) : p;
    b[to] = np; hi ^= ZHI[np * 64 + to]; lo ^= ZLO[np * 64 + to];
    if (fl & F_CASTLE) {
      let rf, rt;
      if (to === 6) { rf = 7; rt = 5; } else if (to === 2) { rf = 0; rt = 3; } else if (to === 62) { rf = 63; rt = 61; } else { rf = 56; rt = 59; }
      const rook = b[rf]; b[rf] = 0; b[rt] = rook;
      hi ^= ZHI[rook * 64 + rf] ^ ZHI[rook * 64 + rt]; lo ^= ZLO[rook * 64 + rf] ^ ZLO[rook * 64 + rt];
    }
    if ((p & 7) === KING) this.kingSq[us] = to;
    hi ^= CHI[this.castling]; lo ^= CLO[this.castling];
    this.castling &= CASTLE_MASK[from] & CASTLE_MASK[to];
    hi ^= CHI[this.castling]; lo ^= CLO[this.castling];
    if (this.ep >= 0) { hi ^= EHI[this.ep & 7]; lo ^= ELO[this.ep & 7]; }
    this.ep = (fl & F_DPP) ? (from + to) >> 1 : -1;
    if (this.ep >= 0) { hi ^= EHI[this.ep & 7]; lo ^= ELO[this.ep & 7]; }
    this.halfmove = ((p & 7) === PAWN || cap) ? 0 : this.halfmove + 1;
    if (us === BLACK) this.fullmove++;
    this.turn = them; hi ^= SIDE_HI; lo ^= SIDE_LO;
    this.hi = hi; this.lo = lo;
    this.stack.push(u);
    this.keys.push(this.key());
  }

  unmake() {
    const u = this.stack.pop(); this.keys.pop();
    const m = u.m, from = m & 63, to = (m >> 6) & 63, pr = (m >> 12) & 7, fl = m >> 15;
    const them = this.turn, us = them ^ 1;
    this.turn = us;
    const b = this.board;
    const moved = pr ? mk(PAWN, us) : b[to];
    b[from] = moved; b[to] = 0;
    if (u.cap) b[u.capSq] = u.cap;
    if (fl & F_CASTLE) {
      let rf, rt;
      if (to === 6) { rf = 7; rt = 5; } else if (to === 2) { rf = 0; rt = 3; } else if (to === 62) { rf = 63; rt = 61; } else { rf = 56; rt = 59; }
      b[rf] = b[rt]; b[rt] = 0;
    }
    if ((moved & 7) === KING) this.kingSq[us] = from;
    this.castling = u.castling; this.ep = u.ep; this.halfmove = u.half; this.hi = u.hi; this.lo = u.lo;
    if (us === BLACK) this.fullmove--;
  }

  // find the legal move for from/to (+ promotion piece type)
  findMove(from, to, promo) {
    const ms = this.legal();
    for (const m of ms) if (mFrom(m) === from && mTo(m) === to && (!mPromo(m) || mPromo(m) === (promo || QUEEN))) return m;
    return 0;
  }

  san(m) {
    const b = this.board, from = mFrom(m), to = mTo(m), fl = mFlags(m), p = b[from], t = p & 7;
    let s;
    if (fl & F_CASTLE) s = to > from ? 'O-O' : 'O-O-O';
    else {
      s = '';
      if (t !== PAWN) {
        s += 'PNBRQK'[t - 1];
        const others = this.legal().filter(x => x !== m && mTo(x) === to && b[mFrom(x)] === p);
        if (others.length) {
          const sameFile = others.some(x => (mFrom(x) & 7) === (from & 7));
          const sameRank = others.some(x => (mFrom(x) >> 3) === (from >> 3));
          if (!sameFile) s += 'abcdefgh'[from & 7];
          else if (!sameRank) s += (1 + (from >> 3));
          else s += sqName(from);
        }
      } else if (fl & F_CAP) s += 'abcdefgh'[from & 7];
      if (fl & F_CAP) s += 'x';
      s += sqName(to);
      if (fl & F_PROMO) s += '=' + 'PNBRQK'[mPromo(m) - 1];
    }
    this.make(m);
    let suffix = '';
    if (this.inCheck()) suffix = this.legal().length ? '+' : '#';
    this.unmake();
    return s + suffix;
  }

  // ---- game status -------------------------------------------------------
  insufficient() {
    const minors = [];
    for (let s = 0; s < 64; s++) {
      const p = this.board[s]; if (!p) continue;
      const t = p & 7;
      if (t === KING) continue;
      if (t === PAWN || t === ROOK || t === QUEEN) return false;
      minors.push([t, s]);
    }
    if (minors.length <= 1) return true;
    if (minors.every(x => x[0] === BISHOP)) {
      const c = minors.map(x => ((x[1] & 7) + (x[1] >> 3)) & 1);
      return c.every(x => x === c[0]);
    }
    return false;
  }

  hasMatingMaterial(color) {
    let minors = 0;
    for (let s = 0; s < 64; s++) {
      const p = this.board[s];
      if (!p || (p >> 3) !== color) continue;
      const t = p & 7;
      if (t === PAWN || t === ROOK || t === QUEEN) return true;
      if (t === KNIGHT || t === BISHOP) minors++;
    }
    return minors >= 2;
  }

  repCount() {
    const k = this.keys[this.keys.length - 1], n = this.keys.length;
    let c = 1;
    for (let i = n - 3; i >= 0 && i >= n - 1 - this.halfmove; i -= 2) if (this.keys[i] === k) c++;
    return c;
  }

  countPieces() { let n = 0; for (let s = 0; s < 64; s++) { const p = this.board[s]; if (p && (p & 7) !== KING) n++; } return n; }

  gameStatus() {
    if (!this.legal().length) {
      return this.inCheck() ? { over: true, result: 'checkmate', winner: this.turn ^ 1 } : { over: true, result: 'stalemate' };
    }
    if (this.insufficient()) return { over: true, result: 'insufficient' };
    if (this.repCount() >= 3) return { over: true, result: 'threefold' };
    if (this.halfmove >= 100) return { over: true, result: 'fifty' };
    return { over: false };
  }
}

function perft(pos, depth) {
  if (depth === 0) return 1;
  const ms = pos.legal();
  if (depth === 1) return ms.length;
  let n = 0;
  for (const m of ms) { pos.make(m); n += perft(pos, depth - 1); pos.unmake(); }
  return n;
}

const api = {
  WHITE, BLACK, PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING, START_FEN, PIECE_CHARS,
  F_CAP, F_EP, F_CASTLE, F_DPP, F_PROMO,
  mk, enc, mFrom, mTo, mPromo, mFlags, sqName, nameSq,
  KNIGHT_T, KING_T, RAYS, PAWN_ATT,
  Position, perft
};
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Chess = api;
})(typeof window !== 'undefined' ? window : globalThis);
