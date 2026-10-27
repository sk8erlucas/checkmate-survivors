/* =========================================================================
 * Checkmate Survivors - ui.js
 * Tiny DOM helper, toast/modal, WebAudio sound effects, localStorage.
 * ====================================================================== */
(function (root) {
'use strict';
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) for (const k of Object.keys(props)) {
    const v = props[k];
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') { for (const sk of Object.keys(v)) { if (sk.slice(0, 2) === '--' && el.style.setProperty) el.style.setProperty(sk, v[sk]); else el.style[sk] = v[sk]; } }
    else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.appendChild(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

const UI = { h };
let appEl = null, toastBox = null;
UI.init = function () {
  appEl = document.getElementById('app');
  toastBox = h('div', { class: 'toasts' });
  document.body.appendChild(toastBox);
};
UI.screen = function (el) {
  appEl.innerHTML = ''; appEl.appendChild(el); window.scrollTo(0, 0);
  if (!el.classList.contains('match-screen')) UI.music('menu');   // battles switch to their own track on start
};
UI.modal = function (content) {
  const ov = h('div', { class: 'modal-overlay' }, h('div', { class: 'modal' }, content));
  document.body.appendChild(ov);
  return { close() { ov.remove(); }, el: ov };
};
UI.toast = function (msg, kind) {
  const t = h('div', { class: 'toast ' + (kind || '') }, msg);
  toastBox.appendChild(t);
  setTimeout(() => t.remove(), 2800);
};

// ---- sound ---------------------------------------------------------------
// Everything is synthesized with WebAudio: effects are short tones/noise and
// the music is a tiny step sequencer playing the tracks defined below.
let actx = null, noiseBuf = null;
UI.muted = false; UI.musicOn = true;
function ac() {
  if (actx) return actx;
  const AC = root.AudioContext || root.webkitAudioContext;
  if (!AC) return null;
  try { actx = new AC(); } catch (e) { return null; }
  return actx;
}
function tone(freq, dur, type, vol, at, toFreq) {
  const a = ac(); if (!a) return;
  const t0 = at || a.currentTime, o = a.createOscillator(), g = a.createGain();
  o.type = type || 'square'; o.frequency.setValueAtTime(freq, t0);
  if (toFreq) o.frequency.exponentialRampToValueAtTime(toFreq, t0 + dur);
  g.gain.setValueAtTime(vol || 0.05, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(a.destination); o.start(t0); o.stop(t0 + dur + 0.02);
}
function noise(dur, vol, at, hp) {
  const a = ac(); if (!a) return;
  if (!noiseBuf) {
    noiseBuf = a.createBuffer(1, Math.floor(a.sampleRate * 0.5), a.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t0 = at || a.currentTime, src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  src.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = hp || 800;
  g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f); f.connect(g); g.connect(a.destination); src.start(t0); src.stop(t0 + dur + 0.02);
}
const later = s => (ac() ? actx.currentTime + s : 0);
const SFX = {
  click: () => tone(520, 0.04, 'square', 0.03),
  move: () => { tone(220, 0.06, 'square', 0.05); noise(0.03, 0.03, 0, 3000); },
  capture: () => { tone(150, 0.10, 'sawtooth', 0.06); tone(90, 0.12, 'square', 0.05, later(0.05)); },
  hit: () => { noise(0.09, 0.14, 0, 1200); tone(360, 0.14, 'square', 0.06, 0, 110); },
  death: () => { noise(0.3, 0.16, 0, 500); tone(560, 0.4, 'sawtooth', 0.06, 0, 55); tone(280, 0.35, 'square', 0.05, later(0.06), 45); },
  hurt: () => { tone(210, 0.18, 'sawtooth', 0.07, 0, 80); noise(0.07, 0.09, 0, 2500); },
  check: () => { tone(440, 0.08, 'square', 0.05); tone(660, 0.10, 'square', 0.05, later(0.08)); },
  castle: () => { tone(170, 0.07, 'square', 0.06); noise(0.04, 0.05, 0, 2000); tone(230, 0.07, 'square', 0.06, later(0.1)); noise(0.04, 0.05, later(0.1), 2000); },
  promote: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.12, 'square', 0.045, later(i * 0.06))),
  potion: () => { tone(660, 0.07, 'sine', 0.06); tone(880, 0.09, 'sine', 0.06, later(0.07)); },
  coin: () => { tone(988, 0.05, 'square', 0.04); tone(1319, 0.09, 'square', 0.04, later(0.05)); },
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.14, 'square', 0.05, later(i * 0.1))),
  lose: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.18, 'sawtooth', 0.05, later(i * 0.13))),
  warn: () => tone(300, 0.12, 'sawtooth', 0.05),
};
UI.sfx = function (name) { if (UI.muted || !SFX[name]) return; try { SFX[name](); } catch (e) { /* audio not available */ } };

// ---- music ---------------------------------------------------------------
// A track: tempo, chords per bar ([bass root, ...triad]) and a melody per bar
// as [step, midi note, length in 16ths]. Bars have 16 steps.
const hz = n => 440 * Math.pow(2, (n - 69) / 12);
const TRACKS = {
  menu: { bpm: 96, drums: false,
    chords: [[45, 57, 60, 64], [41, 53, 57, 60], [48, 55, 60, 64], [40, 56, 59, 64], [45, 57, 60, 64], [41, 53, 57, 60], [50, 57, 62, 65], [40, 56, 59, 64]],
    melody: [
      [[0, 69, 4], [4, 72, 2], [6, 71, 2], [8, 69, 4], [12, 64, 4]], [[0, 65, 4], [4, 69, 2], [6, 67, 2], [8, 65, 6], [14, 64, 2]],
      [[0, 64, 4], [4, 67, 2], [6, 72, 2], [8, 71, 4], [12, 67, 4]], [[0, 68, 6], [6, 71, 2], [8, 74, 4], [12, 71, 4]],
      [[0, 76, 4], [4, 74, 2], [6, 72, 2], [8, 71, 2], [10, 72, 2], [12, 69, 4]], [[0, 72, 4], [4, 69, 4], [8, 65, 4], [12, 69, 4]],
      [[0, 74, 4], [4, 72, 2], [6, 71, 2], [8, 69, 4], [12, 65, 4]], [[0, 68, 8], [8, 71, 4], [12, 64, 4]]] },
  battle: { bpm: 132, drums: true,
    chords: [[38, 62, 65, 69], [46, 58, 62, 65], [48, 60, 64, 67], [45, 61, 64, 69]],
    melody: [
      [[0, 74, 2], [2, 74, 2], [4, 77, 2], [6, 74, 2], [8, 72, 2], [10, 74, 4], [14, 69, 2]], [[0, 70, 4], [4, 72, 2], [6, 74, 2], [8, 77, 4], [12, 74, 4]],
      [[0, 72, 2], [2, 72, 2], [4, 76, 2], [6, 72, 2], [8, 79, 4], [12, 76, 4]], [[0, 73, 6], [6, 76, 2], [8, 81, 4], [12, 79, 2], [14, 76, 2]]] },
  boss: { bpm: 148, drums: true, four: true,
    chords: [[40, 64, 67, 71], [41, 65, 69, 72], [40, 64, 67, 71], [47, 63, 66, 71]],
    melody: [
      [[0, 76, 2], [2, 77, 2], [4, 76, 2], [6, 74, 2], [8, 76, 8]], [[0, 77, 2], [2, 79, 2], [4, 77, 2], [6, 76, 2], [8, 72, 8]],
      [[0, 71, 2], [2, 72, 2], [4, 74, 2], [6, 76, 2], [8, 79, 4], [12, 77, 4]], [[0, 75, 4], [4, 78, 4], [8, 83, 4], [12, 78, 4]]] },
};
const mus = { name: null, step: 0, next: 0, timer: null };
function playStep(tr, i, t, sd) {
  const bar = Math.floor(i / 16) % tr.chords.length, st = i % 16, ch = tr.chords[bar];
  if (tr.drums) {
    if (st % 8 === 0 || (tr.four && st % 4 === 0)) tone(150, 0.12, 'sine', 0.16, t, 40);
    if (st === 4 || st === 12) noise(0.1, 0.07, t, 1500);
    if (st % 2 === 1) noise(0.025, 0.025, t, 6000);
    if (st % 2 === 0) tone(hz(ch[0] + (st % 4 ? 12 : 0)), sd * 1.6, 'square', 0.035, t);
    if (st % 4 === 2) for (const n of ch.slice(1)) tone(hz(n), sd * 0.9, 'square', 0.008, t);
  } else {
    if (st === 0 || st === 6 || st === 12) tone(hz(ch[0]), sd * 5, 'triangle', 0.09, t);
    if (st === 8) tone(hz(ch[0] + 7), sd * 3, 'triangle', 0.07, t);
    if (st % 2 === 0) tone(hz(ch[1 + (st / 2) % 3] + 12), sd * 1.5, 'triangle', 0.025, t);
  }
  const mel = tr.melody[bar % tr.melody.length];
  for (const [s, n, len] of mel) if (s === st) tone(hz(n), sd * len * 0.92, 'square', 0.028, t);
}
function pump() {
  const a = actx, tr = TRACKS[mus.name];
  if (!a || !tr) return;
  const sd = 60 / tr.bpm / 4;
  if (mus.next < a.currentTime) mus.next = a.currentTime + 0.05;
  while (mus.next < a.currentTime + 0.15) {
    if (!UI.muted && UI.musicOn && a.state === 'running') playStep(tr, mus.step, mus.next, sd);
    mus.step++; mus.next += sd;
  }
}
// name: 'menu' | 'battle' | 'boss' | null (stop). Browsers only start audio
// after a click, so the first click anywhere unlocks it.
UI.music = function (name) {
  if (name === mus.name) return;
  mus.name = name; mus.step = 0; mus.next = 0;
  if (!name) { clearInterval(mus.timer); mus.timer = null; return; }
  if (!ac()) return;
  if (!mus.timer) mus.timer = setInterval(pump, 40);
};
if (root.document && root.document.addEventListener) {
  root.document.addEventListener('pointerdown', () => { const a = ac(); if (a && a.state === 'suspended') a.resume(); });
}

// ---- storage -------------------------------------------------------------
const KEY = 'checkmate_survivors_v1', RUN_KEY = 'checkmate_survivors_run_v1';
const get = k => { try { return JSON.parse(root.localStorage.getItem(k)); } catch (e) { return null; } };
const set = (k, d) => { try { root.localStorage.setItem(k, d == null ? 'null' : JSON.stringify(d)); } catch (e) { /* ignore */ } };
UI.store = {
  load() { return get(KEY); },
  save(d) { set(KEY, d); },
  loadRun() { return get(RUN_KEY); },     // the run in progress (saved between nodes)
  saveRun(r) { set(RUN_KEY, r); },
};

root.UI = UI;
})(window);
