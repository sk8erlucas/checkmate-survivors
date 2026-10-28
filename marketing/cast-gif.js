// Renders the monster cast as the README's animated GIF: node marketing/cast-gif.js
const path = require('path'), fs = require('fs');
const repo = path.join(__dirname, '..'), out = path.join(__dirname, 'readme', 'cast.gif');
const P = require(path.join(repo, 'js/portraits.js'));
const IDS = ['slime', 'goblin', 'ghost', 'spider', 'skeleton', 'witch', 'werewolf', 'medusa', 'vampire', 'lich', 'mummy', 'banshee', 'golem', 'gargoyle', 'necromancer'];
const COLS = 5, ROWS = 3, S = 4, CELL = 32 * S, PAD = 16;
const W = COLS * CELL + (COLS + 1) * PAD, H = ROWS * CELL + (ROWS + 1) * PAD;
const BG = '#1a1322', CARD = '#2a1f38';

// each monster runs its own little script, offset so they don't move in sync
const SCRIPT = ['idle', 'idle', 'idle', 'blink', 'idle', 'idle', 'think', 'think', 'idle', 'happy', 'happy', 'idle', 'idle', 'blink', 'idle', 'hurt', 'hurt', 'idle', 'idle', 'idle', 'ko', 'ko', 'ko', 'idle'];
const FRAMES = SCRIPT.length, cache = {};
const portrait = (id, e) => cache[id + e] || (cache[id + e] = P.render(id, e));

const palette = [BG, CARD], pidx = { [BG]: 0, [CARD]: 1 };
const idx = c => { if (!(c in pidx)) { pidx[c] = palette.length; palette.push(c); } return pidx[c]; };
const frames = [];
for (let f = 0; f < FRAMES; f++) {
  const px = new Uint8Array(W * H);
  IDS.forEach((id, i) => {
    const cx = PAD + (i % COLS) * (CELL + PAD), cy = PAD + Math.floor(i / COLS) * (CELL + PAD);
    for (let y = 0; y < CELL; y++) px.fill(1, (cy + y) * W + cx, (cy + y) * W + cx + CELL);
    const p = portrait(id, SCRIPT[(f + i * 7) % FRAMES]);
    for (let k = 0; k < 32 * 32; k++) if (p[k]) {
      const c = idx(p[k]), x0 = cx + (k % 32) * S, y0 = cy + Math.floor(k / 32) * S;
      for (let y = 0; y < S; y++) px.fill(c, (y0 + y) * W + x0, (y0 + y) * W + x0 + S);
    }
  });
  frames.push(px);
}
if (palette.length > 256) throw new Error('too many colors: ' + palette.length);

// ---------------------------------------------------------------- GIF89a encoder (LZW, 8-bit codes)
function lzw(data) {
  const MIN = 8, CLEAR = 256, EOI = 257, outB = [];
  let cur = 0, bits = 0, size = MIN + 1, next = EOI + 1, dict = new Map();
  const emit = c => { cur |= c << bits; bits += size; while (bits >= 8) { outB.push(cur & 255); cur >>= 8; bits -= 8; } };
  emit(CLEAR);
  let w = data[0];
  for (let i = 1; i < data.length; i++) {
    const k = data[i], key = w * 4096 + k;
    if (dict.has(key)) { w = dict.get(key); continue; }
    emit(w);
    if (next < 4096) { dict.set(key, next++); if (next > (1 << size) && size < 12) size++; }
    else { emit(CLEAR); dict = new Map(); next = EOI + 1; size = MIN + 1; }
    w = k;
  }
  emit(w); emit(EOI);
  if (bits) outB.push(cur & 255);
  return outB;
}
const b = [];
const u16 = v => b.push(v & 255, v >> 8);
b.push(...Buffer.from('GIF89a')); u16(W); u16(H); b.push(0xf7, 0, 0);
for (let i = 0; i < 256; i++) { const c = palette[i] || '#000000'; b.push(parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)); }
b.push(0x21, 0xff, 11, ...Buffer.from('NETSCAPE2.0'), 3, 1, 0, 0, 0);
for (const px of frames) {
  b.push(0x21, 0xf9, 4, 0x04); u16(18); b.push(0, 0);
  b.push(0x2c); u16(0); u16(0); u16(W); u16(H); b.push(0, 8);
  const d = lzw(px);
  for (let i = 0; i < d.length; i += 255) { const ch = d.slice(i, i + 255); b.push(ch.length, ...ch); }
  b.push(0);
}
b.push(0x3b);
fs.writeFileSync(out, Buffer.from(b));
console.log(out, W + 'x' + H, palette.length, 'colors', b.length, 'bytes');
