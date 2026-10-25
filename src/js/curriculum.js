'use strict';
// ---------------------------------------------------------------------------
// Curriculum: 16 levels in four tiers. Each level declares
//   staff  - notes to read from the staff  (entry: { clef, n, id, w?, ott? })
//   keys   - notes to find / name on the keyboard (entry: { n, id })
//   types  - question types and their relative weights
//   pad    - what the "name it" pad asks for ({ letter, acc, oct })
//   steps  - landmark-relative questions ({ from: [landmark names], max })
//   review - earlier levels to blend back in
// Lesson slides live in lessons.js.
// ---------------------------------------------------------------------------
const E = (clef, n, extra) => Object.assign({ clef, n, id: `${clef}:${ascii(n)}${extra && extra.ott ? '*' : ''}` }, extra);
const naturals = (clef, lo, hi) => {
  const out = [];
  for (let s = stepOf(parseNote(lo)); s <= stepOf(parseNote(hi)); s++) out.push(E(clef, fromStep(s)));
  return out;
};
const list = (clef, arr) => arr.map(s => E(clef, parseNote(s)));
const blackSpellings = (loM, hiM) => {
  const out = [];
  for (let m = loM; m <= hiM; m++) if (isBlackMidi(m)) { out.push(noteFromMidi(m, false)); out.push(noteFromMidi(m, true)); }
  return out;
};
const keyEntry = (n, id) => ({ n, id: id || 'k:' + ascii(n) });
const keysOf = (arr, idFn) => arr.map(s => { const n = typeof s === 'string' ? parseNote(s) : s; return keyEntry(n, idFn && idFn(n)); });
const whiteKeys = (lo, hi) => {
  const out = [];
  for (let s = stepOf(parseNote(lo)); s <= stepOf(parseNote(hi)); s++) out.push(fromStep(s));
  return out;
};

const TIERS = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];

const LEVELS = [
  // ------------------------------------------------------------- BEGINNER
  {
    id: 1, tier: 0, title: 'Keyboard Geography', tag: 'Find any white key using the black-key groups.',
    keys: whiteKeys('C3', 'B4').map(n => keyEntry(n, 'pc:' + LETTERS[n.l])), anyOctave: true,
    types: { locate: 3, identify: 3 }, pad: { letter: true }, kb: ['C3', 'B4'],
  },
  {
    id: 2, tier: 0, title: 'Middle C and the Octave Cs', tag: 'Every C is a landmark, numbered by octave.',
    keys: keysOf(['C2', 'C3', 'C4', 'C5', 'C6']),
    types: { locate: 3, identify: 3 }, pad: { fixedLetter: 'C', oct: true }, kb: ['C2', 'C6'],
  },
  {
    id: 3, tier: 0, title: 'Three Core Landmarks', tag: 'Middle C, Treble G and Bass F on the staff.',
    staff: [E('treble', parseNote('G4')), E('bass', parseNote('F3')), E('treble', parseNote('C4')), E('bass', parseNote('C4'))],
    types: { read: 4, readName: 1, place: 2 }, pad: { letter: true }, kb: ['C3', 'C5'],
  },
  {
    id: 4, tier: 0, title: 'Steps: The Neighbors', tag: 'One step away from a landmark: line to space.',
    staff: [...list('treble', ['B3', 'D4', 'F4', 'A4']), ...list('bass', ['E3', 'G3'])],
    steps: { from: ['C4', 'G4', 'F3'], max: 1 }, review: [3],
    types: { read: 4, steps: 3, readName: 1, place: 1 }, pad: { letter: true }, kb: ['C3', 'C5'],
  },
  {
    id: 5, tier: 0, title: 'Skips: Thirds', tag: 'Two steps away: line to line, space to space.',
    staff: [...list('treble', ['E4', 'B4']), ...list('bass', ['D3', 'A3'])],
    steps: { from: ['C4', 'G4', 'F3'], max: 2 }, review: [4],
    types: { read: 4, steps: 3, readName: 1, place: 1 }, pad: { letter: true }, kb: ['C3', 'C5'],
  },
  // --------------------------------------------------------- INTERMEDIATE
  {
    id: 6, tier: 1, title: 'Treble Clef Complete', tag: 'Every line and space, anchored on G and C.',
    staff: naturals('treble', 'D4', 'G5'),
    steps: { from: ['C4', 'G4', 'C5'], max: 3 }, review: [4, 5],
    types: { read: 4, readName: 2, place: 2, steps: 2 }, pad: { letter: true }, kb: ['C4', 'C6'],
  },
  {
    id: 7, tier: 1, title: 'Bass Clef Complete', tag: 'Every line and space, anchored on F and C.',
    staff: naturals('bass', 'F2', 'B3'),
    steps: { from: ['C3', 'F3', 'C4'], max: 3 }, review: [4, 5],
    types: { read: 4, readName: 2, place: 2, steps: 2 }, pad: { letter: true }, kb: ['C2', 'C4'],
  },
  {
    id: 8, tier: 1, title: 'The Grand Staff', tag: 'Both hands: switch clefs and keep your landmarks.',
    staff: [...naturals('treble', 'D4', 'G5'), ...naturals('bass', 'F2', 'B3'), E('treble', parseNote('C4')), E('bass', parseNote('C4'))],
    steps: { from: ['C3', 'F3', 'C4', 'G4', 'C5', 'G5'], max: 3 }, review: [6, 7],
    types: { read: 5, readName: 1, place: 1, steps: 2 }, pad: { letter: true }, kb: ['C2', 'C6'],
  },
  {
    id: 9, tier: 1, title: 'Ledger Lines', tag: 'Reach beyond the staff from High C and Low C.',
    staff: [
      ...list('treble', ['A3', 'B3', 'C4', 'D4', 'G5', 'A5', 'B5', 'C6', 'D6']),
      ...list('bass', ['C2', 'D2', 'E2', 'F2', 'B3', 'C4', 'D4', 'E4']),
    ],
    steps: { from: ['C2', 'F2', 'C4', 'G5', 'C6'], max: 3 }, review: [8],
    types: { read: 5, readName: 2, steps: 2, place: 1 }, pad: { letter: true, oct: true }, kb: ['C2', 'C7'],
  },
  // ------------------------------------------------------------- ADVANCED
  {
    id: 10, tier: 2, title: 'Sharps and Flats', tag: 'Black keys: one key right is sharp, one key left is flat.',
    staff: [
      ...blackSpellings(64, 76).map(n => E('treble', n)),
      ...blackSpellings(43, 55).map(n => E('bass', n)),
    ],
    keys: blackSpellings(60, 71).map(n => keyEntry(n)), anySpelling: true,
    review: [8],
    types: { read: 4, readName: 2, locate: 2, identify: 2 }, pad: { letter: true, acc: [-1, 0, 1] }, kb: ['C2', 'C6'],
  },
  {
    id: 11, tier: 2, title: 'Key Signatures', tag: 'Read the signature first, then every note.',
    keySigs: [1, 2, 3, 4, -1, -2, -3, -4],
    staffClefs: ['treble', 'bass'],
    types: { readKey: 5, readKeyName: 2 }, pad: { letter: true, acc: [-1, 0, 1] }, kb: ['C2', 'C6'],
  },
  {
    id: 12, tier: 2, title: 'Far Ledger Lines and 8va', tag: 'The top and bottom of the keyboard.',
    staff: [
      ...list('treble', ['D6', 'E6', 'F6', 'G6', 'A6']),
      ...list('bass', ['E1', 'F1', 'G1', 'A1', 'B1']),
      ...[['C7', 'C6'], ['D7', 'D6'], ['E7', 'E6'], ['F7', 'F6'], ['G7', 'G6']].map(([s, w]) => E('treble', parseNote(s), { w: parseNote(w), ott: '8va' })),
      ...[['A0', 'A1'], ['B0', 'B1'], ['C1', 'C2'], ['D1', 'D2'], ['E1', 'E2']].map(([s, w]) => E('bass', parseNote(s), { w: parseNote(w), ott: '8vb' })),
    ],
    steps: { from: ['C1', 'C6', 'C7'], max: 3 }, review: [9],
    types: { read: 6, readName: 2, steps: 2 }, pad: { letter: true, oct: true }, kb: ['A0', 'C8'], single: true,
  },
  // --------------------------------------------------------------- EXPERT
  {
    id: 13, tier: 3, title: 'Enharmonic Spellings', tag: 'E♯, C♭ and double accidentals.',
    staff: [
      ...list('treble', ['E#4', 'Fb4', 'B#4', 'Cb5', 'Fx4', 'Gbb4', 'Cx5', 'Dbb5', 'Ax4', 'Bbb4', 'E#5']),
      ...list('bass', ['E#3', 'Fb3', 'B#2', 'Cb3', 'Fx3', 'Gbb3', 'Cx3', 'Dbb3', 'Ax2', 'Bbb2']),
    ],
    keys: keysOf(['E#4', 'Fb4', 'B#4', 'Cb5', 'Fx4', 'Gbb4', 'Cx5', 'Dbb5']),
    review: [10],
    types: { read: 4, readName: 3, locate: 2 }, pad: { letter: true, acc: [-2, -1, 0, 1, 2] }, kb: ['C2', 'C6'],
  },
  {
    id: 14, tier: 3, title: 'Alto and Tenor Clefs', tag: 'C clefs: the clef itself points to Middle C.',
    staff: [...naturals('alto', 'D3', 'B4'), ...naturals('tenor', 'A2', 'G4')],
    types: { read: 4, readName: 3, place: 1 }, pad: { letter: true, oct: true }, kb: ['C2', 'C6'],
  },
  {
    id: 15, tier: 3, title: 'Intervals and Chords', tag: 'Read stacked notes as shapes, not as names.',
    shapes: ['root', '1st', '2nd'],
    types: { interval: 4, chord: 4 }, kb: ['C2', 'C6'], clefs: ['treble', 'bass'],
  },
  {
    id: 16, tier: 3, title: 'Sight-Reading Gauntlet', tag: 'Melodies in both clefs, with key signatures.',
    capstone: [6, 7, 8, 9, 10, 11],
    seqKeys: [0, 0, 1, 2, -1, -2, -3, 3],
    types: { seq: 6, readKey: 2, chord: 1, interval: 1 }, pad: { letter: true, acc: [-1, 0, 1] }, kb: ['C2', 'C7'], clefs: ['treble', 'bass'],
  },
];

// ---- derived data ------------------------------------------------------------
const LEVEL = Object.fromEntries(LEVELS.map(l => [l.id, l]));

function levelClefs(L) {
  if (L.clefs) return L.clefs;
  const s = new Set((L.staff || []).map(e => e.clef));
  if (L.keySigs) L.staffClefs.forEach(c => s.add(c));
  return s.size ? [...s] : ['treble'];
}
/** Staff entries including those blended in from review levels (deduplicated). */
function levelStaff(L, withReview = true) {
  const out = new Map();
  (L.staff || []).forEach(e => out.set(e.id, e));
  if (withReview) (L.review || []).forEach(r => levelStaff(LEVEL[r], true).forEach(e => { if (!out.has(e.id)) out.set(e.id, Object.assign({ review: true }, e)); }));
  if (L.capstone) L.capstone.forEach(r => levelStaff(LEVEL[r], false).forEach(e => { if (!out.has(e.id)) out.set(e.id, Object.assign({ review: true }, e)); }));
  return [...out.values()];
}
function levelPoolIds(L) {
  const ids = new Set();
  (L.staff || []).forEach(e => ids.add(e.id));
  (L.keys || []).forEach(e => ids.add(e.id));
  if (L.keySigs) L.keySigs.forEach(k => L.staffClefs.forEach(c => ids.add(`ks:${k}:${c}`)));
  if (L.shapes) {
    ['2nd', '3rd', '4th', '5th', '6th', '7th', 'octave'].forEach(i => ids.add('int:' + i));
    L.shapes.forEach(s => levelClefs(L).forEach(c => ids.add(`ch:${s}:${c}`)));
  }
  return [...ids];
}
function levelMastery(L) {
  if (L.capstone) {
    const ms = L.capstone.map(i => levelMastery(LEVEL[i]));
    return ms.reduce((a, b) => a + b, 0) / ms.length;
  }
  return Store.mastery(levelPoolIds(L));
}
const levelStarted = L => (L.capstone ? L.capstone.some(i => levelStarted(LEVEL[i])) : Store.started(levelPoolIds(L)));
const starsFor = m => (m >= 0.85 ? 3 : m >= 0.6 ? 2 : m >= 0.3 ? 1 : 0);

/** Keyboard range (MIDI) that contains every answer the level can ask for. */
function levelKbRange(L) {
  let lo = midiOf(parseNote(L.kb[0])), hi = midiOf(parseNote(L.kb[1]));
  const widen = n => { lo = Math.min(lo, n); hi = Math.max(hi, n); };
  levelStaff(L).forEach(e => widen(midiOf(e.n)));
  (L.keys || []).forEach(e => widen(midiOf(e.n)));
  if (L.steps) L.steps.from.forEach(n => { const lm = LM[n]; widen(lm.midi - L.steps.max * 2 - 2); widen(lm.midi + L.steps.max * 2 + 2); });
  return [lo, hi];
}
/** Stable vertical extents per clef so the staff doesn't jump around between questions. */
function levelExtent(L) {
  const ext = {};
  levelStaff(L).forEach(e => {
    const n = e.w || e.n;
    const p = posOf(n, e.clef);
    const x = ext[e.clef] || (ext[e.clef] = [0, 8]);
    x[0] = Math.min(x[0], p - 1); x[1] = Math.max(x[1], p + 1);
  });
  if (L.steps) {
    L.steps.from.forEach(nm => {
      const lm = LM[nm];
      levelClefs(L).forEach(c => {
        if (!lm.tags.includes(c)) return;
        const p = posOf(lm.note, c);
        if (!ext[c]) ext[c] = [0, 8];
        if (p >= -6 && p <= 14) { ext[c][0] = Math.min(ext[c][0], p - 1); ext[c][1] = Math.max(ext[c][1], p + 1); }
      });
    });
  }
  return ext;
}
