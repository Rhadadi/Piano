'use strict';
// ---------------------------------------------------------------------------
// Question generators. make(level, typeFilter) returns a question:
//   { type, ids[], text, staff?, kbPrompt?, answer, hint, explain(), shown, level }
// answer.kind: key | name | place | interval | chord | seq
// ---------------------------------------------------------------------------
const TYPE_LABELS = {
  read: 'Read and play', readName: 'Name the note', locate: 'Find the key', identify: 'Name the key',
  place: 'Place on the staff', steps: 'Landmark steps', seq: 'Sight-reading lines', chord: 'Chords',
  interval: 'Intervals', readKey: 'Key signatures', readKeyName: 'Key signatures: name it',
};

const Questions = (() => {
  const ctxCache = {};
  function ctxFor(L) {
    if (ctxCache[L.id]) return ctxCache[L.id];
    const clefs = levelClefs(L);
    const staff = levelStaff(L);
    const c = {
      L, clefs, staff, keys: L.keys || [],
      grand: clefs.includes('treble') && clefs.includes('bass') && !L.single,
      kb: levelKbRange(L), extent: levelExtent(L), recent: [],
    };
    ctxCache[L.id] = c;
    return c;
  }

  const wpick = (pool, c) => {
    const cand = pool.length > 4 ? pool.filter(e => !c.recent.includes(e.id)) : pool;
    const e = weightedPick(cand.length ? cand : pool, x => Store.weight(x.id) * (x.review ? 0.35 : 1));
    c.recent.push(e.id);
    if (c.recent.length > 3) c.recent.shift();
    return e;
  };

  function staffOpts(c, clefMode, cols, extra) {
    const clefs = clefMode === 'grand' ? ['treble', 'bass'] : [clefMode];
    const extent = {};
    clefs.forEach(k => { if (c.extent[k]) extent[k] = c.extent[k].slice(); });
    return Object.assign({ clef: clefMode, cols, extent }, extra);
  }
  const NAME = n => nameHTML(n);

  // ---- read / readName ----------------------------------------------------------
  function readBase(c, e) {
    const written = e.w || e.n;
    const mode = c.grand ? 'grand' : e.clef;
    const staff = staffOpts(c, mode, [[{ n: written, clef: e.clef }]], e.ott ? { ottava: { text: e.ott, side: e.ott === '8va' ? 'above' : 'below', from: 0, to: 0 } } : {});
    const r = route(written, e.clef, true);
    const rh = route(written, e.clef, false);
    let ex = `The note is ${NAME(e.n)}. ${r.answerHTML}`;
    if (e.ott) ex = `Written ${NAME(written)} with <b>${e.ott}</b>: play it an octave ${e.ott === '8va' ? 'higher' : 'lower'}, which is ${NAME(e.n)}. ` + r.html;
    return { staff, hint: rh.html + (e.ott ? ` The <b>${e.ott}</b> sign moves it an octave ${e.ott === '8va' ? 'up' : 'down'}.` : ''), explain: ex, written, clef: e.clef };
  }
  function qRead(c) {
    const e = wpick(c.staff, c);
    const b = readBase(c, e);
    return {
      type: 'read', ids: [e.id], text: e.ott ? `Play this note. Mind the <b>${e.ott}</b>.` : 'Play this note.',
      staff: b.staff, answer: { kind: 'key', targets: [midiOf(e.n)] }, hint: b.hint, explain: b.explain, shown: e.n, clef: e.clef,
    };
  }
  function qReadName(c) {
    const e = wpick(c.staff, c);
    const b = readBase(c, e);
    const parts = c.L.pad || { letter: true };
    return {
      type: 'readName', ids: [e.id], text: parts.oct ? 'Name this note, with its octave number.' : 'Name this note.',
      staff: b.staff, answer: { kind: 'name', parts, target: e.n, strict: true }, hint: b.hint, explain: b.explain, shown: e.n, clef: e.clef,
    };
  }

  // ---- locate / identify --------------------------------------------------------
  const KEY_TIPS = {
    0: 'C is the white key just <b>left of a pair</b> of black keys.',
    1: 'D sits <b>between the two black keys</b> of a pair.',
    2: 'E is the white key just <b>right of a pair</b>.',
    3: 'F is the white key just <b>left of a triple</b>.',
    4: 'G sits under the gap between the <b>first and second</b> black keys of a triple.',
    5: 'A sits under the gap between the <b>second and third</b> black keys of a triple.',
    6: 'B is the white key just <b>right of a triple</b>.',
  };
  function keyExplain(L, n) {
    if (n.a !== 0) {
      const base = fromStep(stepOf(n), 0);
      return `${NAME(n)} is one key ${n.a > 0 ? 'right' : 'left'} of ${NAME(base)}${Math.abs(n.a) > 1 ? ' (twice)' : ''}.`;
    }
    if (L.id === 2) return `${NAME(n)} is a C. Count the Cs from the left: the number goes up at every C. Middle C is C4.`;
    return KEY_TIPS[n.l];
  }
  function qLocate(c) {
    const L = c.L;
    const e = wpick(c.keys, c);
    const any = !!L.anyOctave;
    const target = e.n;
    const text = any
      ? `Find any <b>${LETTERS[target.l]}</b> on the keyboard.`
      : `Find <b>${NAME(target)}</b>${target.a === 0 && stepOf(target) === 28 ? ' (Middle C)' : ''}.`;
    const pcOf = n => ((midiOf(n) % 12) + 12) % 12;
    return {
      type: 'locate', ids: [e.id], text,
      answer: { kind: 'key', targets: any ? null : [midiOf(target)], accept: any ? (m => ((m % 12) + 12) % 12 === pcOf(target)) : null, anyTarget: midiOf(target) },
      hint: any ? KEY_TIPS[target.l] : keyExplain(L, target), explain: keyExplain(L, target), shown: target,
    };
  }
  function qIdentify(c) {
    const L = c.L;
    const e = wpick(c.keys, c);
    const parts = L.pad || { letter: true };
    return {
      type: 'identify', ids: [e.id], text: parts.fixedLetter ? 'Which octave is this C?' : 'What is the name of the highlighted key?',
      kbPrompt: { target: midiOf(e.n) },
      answer: { kind: 'name', parts, target: e.n, strict: !L.anySpelling && !L.anyOctave, anyOctave: !!L.anyOctave, anySpelling: !!L.anySpelling },
      hint: keyExplain(L, e.n), explain: `The key is ${NAME(e.n)}. ` + keyExplain(L, e.n), shown: e.n,
    };
  }

  // ---- place on staff -----------------------------------------------------------
  function qPlace(c) {
    const nat = c.staff.filter(e => e.n.a === 0 && !e.ott);
    if (!nat.length) return null;
    const e = wpick(nat, c);
    const clef = e.clef;
    const r = route(e.n, clef, true);
    return {
      type: 'place', ids: [e.id], text: `Where does this key go on the <b>${CLEFS[clef].title.toLowerCase()}</b>? Tap the line or space.`,
      kbPrompt: { target: midiOf(e.n) },
      staff: staffOpts(c, clef, [], {}),
      answer: { kind: 'place', clef, targetPos: posOf(e.n, clef), n: e.n },
      hint: r.html, explain: `The key is ${NAME(e.n)}. ${r.answerHTML}`, shown: e.n, clef,
    };
  }

  // ---- landmark steps -----------------------------------------------------------
  function qSteps(c) {
    const L = c.L;
    if (!L.steps) return null;
    const lmName = wpick(L.steps.from.map(n => ({ id: 'lm:' + n, n })), c).n;
    const lm = LM[lmName];
    const homes = lm.tags.filter(t => c.clefs.includes(t));
    const clef = homes.length ? pick(homes) : lm.tags[0];
    let k = 1 + rnd(L.steps.max), dir = Math.random() < 0.5 ? 1 : -1;
    const inRange = d => { const m = midiOf(fromStep(lm.step + d * k)); return m >= c.kb[0] && m <= c.kb[1]; };
    if (!inRange(dir)) dir = -dir;
    if (!inRange(dir)) k = 1;
    const target = fromStep(lm.step + dir * k);
    const dirTxt = dir > 0 ? 'up' : 'down';
    const letters = [];
    for (let i = 0; i <= k; i++) letters.push(LETTERS[fromStep(lm.step + dir * i).l]);
    const ext = {};
    ext[clef] = (c.extent[clef] || [0, 8]).slice();
    const tp = posOf(target, clef);
    ext[clef][0] = Math.min(ext[clef][0], tp - 1); ext[clef][1] = Math.max(ext[clef][1], tp + 1);
    return {
      type: 'steps', ids: ['st:' + lm.n + (dir > 0 ? '+' : '-') + k], text: `Start on <b>${lm.name}</b> and go <b>${stepPhrase(k, dirTxt)}</b>. Which key is that?`,
      staff: { clef, cols: [[{ n: lm.note, clef, state: 'lm', label: lm.name }]], extent: ext, targetNote: target },
      answer: { kind: 'key', targets: [midiOf(target)] },
      hint: `Say the letters as you move ${dirTxt}: ${letters.join(', ')}...`,
      explain: `${lm.name} (${NAME(lm.note)}), ${stepPhrase(k, dirTxt)}: ${letters.join(' → ')}. That is ${NAME(target)}.`,
      shown: target, clef,
    };
  }

  // ---- key signatures -----------------------------------------------------------
  const KS_RANGE = { treble: ['D4', 'G5'], bass: ['F2', 'B3'] };
  const keyWords = n => {
    const ls = n > 0 ? SHARP_ORDER.slice(0, n) : FLAT_ORDER.slice(0, -n);
    return ls.map(l => LETTERS[l] + (n > 0 ? '♯' : '♭')).join(', ');
  };
  function qReadKey(c, nameIt) {
    const L = c.L;
    const keys = L.keySigs || [1, 2, 3, -1, -2, -3];
    const clefs = (L.staffClefs || c.clefs).filter(x => KS_RANGE[x]);
    const clef = pick(clefs);
    const items = [];
    keys.forEach(k => items.push({ id: `ks:${k}:${clef}`, k }));
    const it = wpick(items, c);
    const km = keyAccs(it.k);
    const altered = Object.keys(km).map(Number);
    const [lo, hi] = KS_RANGE[clef].map(s => stepOf(parseNote(s)));
    let step;
    if (altered.length && Math.random() < 0.7) {
      const cand = [];
      for (let s = lo; s <= hi; s++) if (altered.includes(((s % 7) + 7) % 7)) cand.push(s);
      step = pick(cand);
    } else step = lo + rnd(hi - lo + 1);
    const base = fromStep(step);
    const n = writtenInKey(base.l, base.o, it.k);
    const sound = mk(n.l, n.o, n.a);
    const changed = n.a !== 0;
    const ex = `${KEYS[it.k]} has ${keyWords(it.k)}. ` + (changed ? `Every ${LETTERS[n.l]} is altered, so this is ${NAME(sound)}.` : `${LETTERS[n.l]} is not in the signature, so it stays natural: ${NAME(sound)}.`);
    return {
      type: nameIt ? 'readKeyName' : 'readKey', ids: [it.id], text: nameIt ? 'Name the note that sounds. Check the key signature first.' : 'Play this note. Check the key signature first.',
      staff: staffOpts(c, clef, [[{ n, clef }]], { keySig: it.k }),
      answer: nameIt ? { kind: 'name', parts: L.pad || { letter: true, acc: [-1, 0, 1] }, target: sound, strict: true, ignoreOct: true } : { kind: 'key', targets: [midiOf(sound)] },
      hint: `Key signature: ${keyWords(it.k) || 'none'}. Say these letters before you play.`, explain: ex, shown: sound, clef,
    };
  }

  // ---- sight-reading line -------------------------------------------------------
  function qSeq(c) {
    const L = c.L;
    const clef = pick(c.clefs);
    const keyN = L.seqKeys ? pick(L.seqKeys) : 0;
    let base = c.staff.filter(e => e.clef === clef && !e.ott);
    if (L.seqKeys) base = base.filter(e => e.n.a === 0);
    const seen = new Set();
    base = base.filter(e => { const k = stepOf(e.n) * 10 + e.n.a; if (seen.has(k)) return false; seen.add(k); return true; })
      .sort((a, b) => stepOf(a.n) - stepOf(b.n) || a.n.a - b.n.a);
    if (base.length < 4) return null;
    const len = L.seqLen || 5;
    const win = Math.min(base.length, 10);
    const w0 = rnd(base.length - win + 1);
    let idx = w0 + rnd(win);
    const picks = [];
    for (let i = 0; i < len; i++) {
      picks.push(base[idx]);
      let d = pick([-2, -1, -1, 1, 1, 2, 0 + (Math.random() < 0.15 ? 3 : 1), -1]);
      let ni = idx + d;
      if (ni < w0 || ni >= w0 + win || ni === idx) ni = idx + (idx - w0 > win / 2 ? -1 : 1);
      idx = clamp(ni, w0, w0 + win - 1);
    }
    const notes = picks.map(e => (L.seqKeys ? writtenInKey(e.n.l, e.n.o, keyN) : e.n));
    const sounding = notes.map(n => mk(n.l, n.o, n.a));
    return {
      type: 'seq', ids: sounding.map(n => `${clef}:${ascii(n)}`), text: `Play this line, one note at a time${keyN ? '. Check the key signature first' : ''}.`,
      staff: staffOpts(c, clef, notes.map(n => [{ n, clef }]), { keySig: keyN, colW: 46 }),
      answer: { kind: 'seq', targets: sounding.map(midiOf), notes: sounding },
      hint: `Find a landmark in the first bar, then follow the steps and skips.${keyN ? ' Key: ' + keyWords(keyN) + '.' : ''}`,
      explain: sounding.map(NAME).join(' '), shown: sounding[0], clef,
    };
  }

  // ---- intervals ----------------------------------------------------------------
  const IV = ['2nd', '3rd', '4th', '5th', '6th', '7th', 'octave'];
  function qInterval(c) {
    const clef = pick(c.clefs.filter(x => x === 'treble' || x === 'bass'));
    const item = wpick(IV.map(n => ({ id: 'int:' + n, k: IV.indexOf(n) + 1 })), c);
    const k = item.k;
    const lowPos = -1 + rnd(12 - k);
    const lo = noteAtPos(lowPos, clef), hi = noteAtPos(lowPos + k, clef);
    const letters = []; for (let i = 0; i <= k; i++) letters.push(LETTERS[fromStep(stepOf(lo) + i).l]);
    return {
      type: 'interval', ids: [item.id], text: 'What is the interval between these two notes?',
      staff: staffOpts(c, clef, [[{ n: lo, clef }, { n: hi, clef }]], {}),
      answer: { kind: 'interval', correct: k, options: IV },
      hint: 'Count every line and space from the lower note to the upper note, counting both ends.',
      explain: `${letters.join(' ')}: ${k + 1} letters, so it is ${k === 7 ? 'an' : 'a'} <b>${IV[k - 1]}</b>.`, shown: hi, clef,
    };
  }

  // ---- chords -------------------------------------------------------------------
  const SHAPES = { root: [0, 2, 4], '1st': [2, 4, 7], '2nd': [4, 7, 9] };
  const SHAPE_NAME = { root: 'root position', '1st': 'first inversion', '2nd': 'second inversion' };
  function qChord(c) {
    const L = c.L;
    const clefs = c.clefs.filter(x => x === 'treble' || x === 'bass');
    const clef = pick(clefs);
    const shapes = L.shapes || ['root', '1st', '2nd'];
    const item = wpick(shapes.flatMap(s => clefs.map(cl => ({ id: `ch:${s}:${cl}`, s, cl }))).filter(x => x.cl === clef), c);
    const offs = SHAPES[item.s];
    const r = -1 - Math.min(...offs) + rnd(13 - Math.max(...offs) + Math.min(...offs));
    const keyN = L.seqKeys && Math.random() < 0.4 ? pick(L.seqKeys) : 0;
    const notes = offs.map(o => { const base = noteAtPos(r + o, clef); return writtenInKey(base.l, base.o, keyN); });
    const snd = notes.map(n => mk(n.l, n.o, n.a));
    const rootNote = snd[item.s === 'root' ? 0 : item.s === '1st' ? 2 : 1];
    return {
      type: 'chord', ids: [item.id], text: `Play all the notes of this chord (${SHAPE_NAME[item.s]}). Tap each key.`,
      staff: staffOpts(c, clef, [notes.map(n => ({ n, clef }))], { keySig: keyN }),
      answer: { kind: 'chord', targets: snd.map(midiOf), notes: snd },
      hint: item.s === 'root' ? 'Three lines or three spaces stacked: the bottom note is the root.' : 'Find the biggest gap (a 4th). The upper note of that gap is the root.',
      explain: `${snd.map(NAME).join(' ')}. Root: ${NAME(rootNote)}, ${SHAPE_NAME[item.s]}.`, shown: snd[0], clef,
    };
  }

  const BUILDERS = {
    read: qRead, readName: qReadName, locate: qLocate, identify: qIdentify, place: qPlace, steps: qSteps,
    seq: qSeq, interval: qInterval, chord: qChord, readKey: c => qReadKey(c, false), readKeyName: c => qReadKey(c, true),
  };

  function typesFor(L) { return Object.keys(L.types).filter(t => !(t === 'steps' && !L.steps)); }

  function make(L, filter) {
    const c = ctxFor(L);
    const avail = typesFor(L).filter(t => !filter || filter === 'mixed' || t === filter);
    const types = avail.length ? avail : typesFor(L);
    for (let tries = 0; tries < 8; tries++) {
      const t = weightedPick(types, x => L.types[x]);
      const q = BUILDERS[t](c);
      if (q) { q.level = L; q.ctx = c; return q; }
    }
    const q = BUILDERS[types[0]](c);
    q.level = L; q.ctx = c;
    return q;
  }
  const reset = () => Object.keys(ctxCache).forEach(k => delete ctxCache[k]);
  return { make, typesFor, ctxFor, reset };
})();
