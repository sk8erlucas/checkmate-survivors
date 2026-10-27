// Every text key used by the code (static + dynamic) must exist in BOTH languages.
const fs = require('fs'), path = require('path');
const I = require('../js/i18n.js'), D = require('../js/data.js');
const keys = new Set();
for (const f of ['run.js', 'match.js', 'rush.js']) {
  const src = fs.readFileSync(path.join(__dirname, '../js', f), 'utf8');
  for (const m of src.matchAll(/\bT\('([^']+)'/g)) if (!m[1].endsWith('.')) keys.add(m[1]);
}
const add = k => keys.add(k);
const styles = ['balanced', 'aggressive', 'defensive', 'greedy', 'positional', 'rookie'];
styles.forEach(s => add('style.' + s));
['easy', 'normal', 'hard', 'boss'].forEach(d => add('diff.' + d));
Object.keys(D.TIMECTRL).forEach(t => add('tc.' + t));
['mate', 'mateIn', 'survive', 'captureQueen', 'promote', 'capture'].forEach(o => add('obj.' + o));
Object.keys(D.POTIONS).forEach(p => { add('item.' + p + '.name'); add('item.' + p + '.desc'); add('toast.potion.' + p); });
Object.keys(D.RELICS).forEach(r => { add('relic.' + r + '.name'); add('relic.' + r + '.desc'); });
D.ENEMIES.forEach(e => { add('enemy.' + e.id + '.name'); add('enemy.' + e.id + '.desc'); });
add('enemy.rival.name'); add('enemy.rival.desc');
for (const id of D.ENEMIES.map(e => e.id).concat('rival')) for (const k of ['intro', 'hurt', 'taunt', 'win', 'lose', 'queen', 'promo', 'check']) add('say.' + id + '.' + k);
['piece', 'potion', 'relic', 'coins', 'upgrade'].forEach(k => add('kind.' + k));
D.SCENARIOS.forEach(s => { add('scenario.' + s.id + '.name'); add('scenario.' + s.id + '.desc'); });
D.META.filter(u => !u.amulet).forEach(u => { add('meta.' + u.id + '.name'); add('meta.' + u.id + '.desc'); });
D.ENEMIES.forEach(e => { add('trait.' + e.id + '.name'); add('trait.' + e.id + '.desc'); });
['witch', 'spider', 'werewolf', 'goblin', 'lich', 'medusa'].forEach(t => add('toast.trait.' + t));
['pawn', 'knight', 'bishop', 'rook', 'queen'].forEach(p => add('piece.' + p));
['mate', 'mated', 'timeout', 'timeoutEnemy', 'queen', 'survived', 'survivedDraw', 'limit', 'resign', 'draw', 'promoted', 'captured'].forEach(r => add('reason.' + r));
['duel', 'scenario', 'boss', 'shop', 'event', 'rest'].forEach(n => add('node.' + n));
['duel', 'boss', 'shop', 'event', 'rest'].forEach(n => add('node.' + n + '.desc'));
['heal', 'train', 'brew'].forEach(r => add('rest.' + r));
for (let i = 1; i <= 9; i++) add('help.' + i);
const evs = { gambler: ['bet', 'leave', 'won', 'lost'], clockmaker: ['buy', 'trade', 'leave', 'bought', 'traded'], hermit: ['pay', 'leave', 'paid'], well: ['drink', 'leave', 'potion', 'coins', 'bad'], broker: ['sell', 'buy', 'leave', 'sold', 'bought'] };
for (const [id, parts] of Object.entries(evs)) { add('event.' + id + '.title'); add('event.' + id + '.desc'); for (const p of parts) add('event.' + id + (['won','lost','bought','traded','paid','potion','coins','bad','sold'].includes(p) && !(id==='clockmaker'&&p==='buy'||id==='broker'&&p==='buy') ? '.res.' : '.') + p); }
add('event.res.left');
let miss = 0;
for (const lang of ['en', 'es']) for (const k of keys) if (I.DICT[lang][k] === undefined) { miss++; console.log('MISSING', lang, k); }
// placeholders must match between languages
for (const k of Object.keys(I.DICT.en)) {
  const a = (I.DICT.en[k].match(/\{\w+\}/g) || []).sort().join(), b = ((I.DICT.es[k] || '').match(/\{\w+\}/g) || []).sort().join();
  if (a !== b) { miss++; console.log('PLACEHOLDER MISMATCH', k, a, b); }
}
console.log(`${keys.size} keys checked, EN entries ${Object.keys(I.DICT.en).length}, ES entries ${Object.keys(I.DICT.es).length}`);
console.log(miss ? `${miss} PROBLEMS` : 'I18N OK');
process.exit(miss ? 1 : 0);
