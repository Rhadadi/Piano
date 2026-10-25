'use strict';
// ---------------------------------------------------------------------------
// Music theory core. A note is { l: letter 0-6 (C..B), o: octave, a: alteration -2..2 }.
// Optional display flags: hide (accidental comes from the key signature), nat (show a natural sign).
// ---------------------------------------------------------------------------
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const PCS = [0, 2, 4, 5, 7, 9, 11];
const INTERVAL_NAMES = ['unison', '2nd', '3rd', '4th', '5th', '6th', '7th', 'octave'];
const ACC_ASCII = { '-2': 'bb', '-1': 'b', '0': '', '1': '#', '2': 'x' };
const ACC_WORDS = { '-2': 'double flat', '-1': 'flat', '0': '', '1': 'sharp', '2': 'double sharp' };
const ACC_GLYPH = { '-2': 'dflat', '-1': 'flat', '0': 'natural', '1': 'sharp', '2': 'dsharp' };

const mk = (l, o, a = 0, extra) => Object.assign({ l, o, a }, extra);
const stepOf = n => n.o * 7 + n.l;
const midiOf = n => 12 * (n.o + 1) + PCS[n.l] + n.a;
const fromStep = (s, a = 0, extra) => mk(((s % 7) + 7) % 7, Math.floor(s / 7), a, extra);
const isBlackMidi = m => [1, 3, 6, 8, 10].includes(((m % 12) + 12) % 12);

function parseNote(str) {
  const m = /^([A-G])(bb|b|#|x|)(-?\d)$/.exec(str);
  if (!m) throw new Error('bad note ' + str);
  return mk(LETTERS.indexOf(m[1]), +m[3], { bb: -2, b: -1, '': 0, '#': 1, x: 2 }[m[2]]);
}
const ascii = n => LETTERS[n.l] + ACC_ASCII[n.a] + n.o;
const letterName = n => LETTERS[n.l] + (n.a ? ' ' + ACC_WORDS[n.a] : '');
const spoken = n => letterName(n) + ' ' + n.o;

const SHARP_SPELL = { 1: [0, 1], 3: [1, 1], 6: [3, 1], 8: [4, 1], 10: [5, 1] };
const FLAT_SPELL = { 1: [1, -1], 3: [2, -1], 6: [4, -1], 8: [5, -1], 10: [6, -1] };
function noteFromMidi(m, flats = false) {
  const pc = ((m % 12) + 12) % 12, oct = Math.floor(m / 12) - 1;
  const w = PCS.indexOf(pc);
  if (w >= 0) return mk(w, oct, 0);
  const [l, a] = (flats ? FLAT_SPELL : SHARP_SPELL)[pc];
  return mk(l, oct, a);
}

/** Inline SVG for an accidental glyph, sized in em so it sits in running text. */
function accSvg(a) {
  const g = GLYPHS[ACC_GLYPH[a]];
  const y0 = -g.b[3], h = g.b[3] - g.b[1];
  return `<svg class="acc" viewBox="0 ${y0} ${g.w} ${h}" style="width:${(g.w / h * 1.05).toFixed(2)}em" aria-hidden="true"><path transform="scale(1 -1)" d="${g.d}" fill="currentColor"/></svg>`;
}
/** Note name as HTML, e.g. F♯4. withOct=false drops the octave number. */
function nameHTML(n, withOct = true) {
  return `<span class="nm">${LETTERS[n.l]}${n.a ? accSvg(n.a) : ''}${withOct ? n.o : ''}</span>`;
}
const accHTML = a => `<span class="nm">${accSvg(a)}</span>`;

// ---- Clefs ----------------------------------------------------------------
// bottom = diatonic step of the bottom line. pos 0 = bottom line, 2 = second line ... 8 = top line.
const CLEFS = {
  treble: { bottom: stepOf(parseNote('E4')), title: 'Treble clef' },
  bass: { bottom: stepOf(parseNote('G2')), title: 'Bass clef' },
  alto: { bottom: stepOf(parseNote('F3')), title: 'Alto clef' },
  tenor: { bottom: stepOf(parseNote('D3')), title: 'Tenor clef' },
};
const posOf = (n, clef) => stepOf(n) - CLEFS[clef].bottom;
const noteAtPos = (pos, clef, a = 0) => fromStep(CLEFS[clef].bottom + pos, a);

// ---- Key signatures ---------------------------------------------------------
const SHARP_ORDER = [3, 0, 4, 1, 5, 2, 6]; // F C G D A E B
const FLAT_ORDER = [6, 2, 5, 1, 4, 0, 3]; // B E A D G C F
const KEYS = {
  0: 'C major', 1: 'G major', 2: 'D major', 3: 'A major', 4: 'E major', 5: 'B major',
  '-1': 'F major', '-2': 'B♭ major', '-3': 'E♭ major', '-4': 'A♭ major', '-5': 'D♭ major',
};
function keyAccs(n) {
  const m = {};
  if (n > 0) SHARP_ORDER.slice(0, n).forEach(l => (m[l] = 1));
  if (n < 0) FLAT_ORDER.slice(0, -n).forEach(l => (m[l] = -1));
  return m;
}
/** A note as written under a key signature. `explicit` (a number) forces an accidental sign. */
function writtenInKey(l, o, keyN, explicit) {
  const km = keyAccs(keyN);
  if (explicit === undefined || explicit === null) return mk(l, o, km[l] || 0, { hide: true });
  return mk(l, o, explicit, explicit === 0 && (km[l] || 0) !== 0 ? { nat: true } : undefined);
}

// ---- Landmarks --------------------------------------------------------------
// The reference set from the grand-staff chart: every C, plus G (treble side) and F (bass side).
const LANDMARKS = [
  { n: 'C1', name: 'Very Low C', tags: ['bass'] },
  { n: 'C2', name: 'Low C', tags: ['bass'] },
  { n: 'F2', name: 'Low F', tags: ['bass'] },
  { n: 'C3', name: 'Bass C', tags: ['bass'] },
  { n: 'F3', name: 'Bass F', core: true, tags: ['bass'] },
  { n: 'C4', name: 'Middle C', core: true, tags: ['treble', 'bass', 'alto', 'tenor'] },
  { n: 'G4', name: 'Treble G', core: true, tags: ['treble'] },
  { n: 'C5', name: 'Treble C', tags: ['treble'] },
  { n: 'G5', name: 'High G', tags: ['treble'] },
  { n: 'C6', name: 'High C', tags: ['treble'] },
  { n: 'C7', name: 'Very High C', tags: ['treble'] },
].map(l => Object.assign(l, { note: parseNote(l.n), step: stepOf(parseNote(l.n)), midi: midiOf(parseNote(l.n)) }));
const LM = Object.fromEntries(LANDMARKS.map(l => [l.n, l]));

function landmarkFor(n, clef) {
  const s = stepOf(n);
  const cClef = clef === 'alto' || clef === 'tenor';
  const relevant = l => (cClef ? l.n === 'C4' : l.core || (clef && l.tags.includes(clef)));
  let best = null;
  for (const l of LANDMARKS) {
    if (clef && !relevant(l)) continue;
    const d = Math.abs(s - l.step);
    const score = d * 10 + (l.core ? 0 : 1) + (clef && l.tags[0] === clef ? -0.5 : 0);
    if (!best || score < best.score) best = { l, d, score };
  }
  return best.l;
}
/** Describe how to reach note n from its nearest landmark. reveal=false hides the letter. */
function route(n, clef, reveal = true) {
  const lm = landmarkFor(n, clef);
  const d = stepOf(n) - lm.step, k = Math.abs(d);
  const dir = d > 0 ? 'up' : 'down';
  const fromTxt = `<b>${lm.name}</b> (${LETTERS[lm.note.l]}${lm.note.o})`;
  let how;
  if (k === 0) how = `That note <i>is</i> the landmark ${fromTxt}.`;
  else if (k === 1) how = `One step ${dir} from ${fromTxt}: line to the next space (or space to the next line).`;
  else if (k === 2) how = `A skip ${dir} from ${fromTxt}: line to line, or space to space (a 3rd).`;
  else how = `${k} steps ${dir} from ${fromTxt} (a ${INTERVAL_NAMES[k] || k + 1 + 'th'}).`;
  const letter = LETTERS[n.l];
  return { lm, d, k, dir, html: how, answerHTML: reveal ? how + ` Count the letters: that gives <b>${letter}</b>.` : how };
}
function stepPhrase(k, dir) {
  if (k === 1) return `one step ${dir}`;
  if (k === 2) return `a skip ${dir} (a 3rd)`;
  return `${k} steps ${dir} (a ${INTERVAL_NAMES[k] || (k + 1) + 'th'})`;
}

// ---- Misc helpers -----------------------------------------------------------
const rnd = n => Math.floor(Math.random() * n);
const pick = arr => arr[rnd(arr.length)];
function weightedPick(items, weightFn) {
  const ws = items.map(weightFn);
  let r = Math.random() * ws.reduce((a, b) => a + b, 0);
  for (let i = 0; i < items.length; i++) { r -= ws[i]; if (r <= 0) return items[i]; }
  return items[items.length - 1];
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const intervalName = (n1, n2) => INTERVAL_NAMES[clamp(Math.abs(stepOf(n1) - stepOf(n2)), 0, 7)] || (Math.abs(stepOf(n1) - stepOf(n2)) + 1) + 'th';
