'use strict';
// ---------------------------------------------------------------------------
// Explore (interactive landmark map) and Progress views.
// ---------------------------------------------------------------------------
const ex = { clef: 'grand', n: parseNote('C4'), nClef: 'treble', acc: 0, guides: true, labels: 'landmarks', kb: null };

function exClefFor(n) { return ex.clef === 'grand' ? (stepOf(n) >= 28 ? 'treble' : 'bass') : ex.clef; }
function exSet(n, clef, play = true) {
  ex.n = n; ex.nClef = clef || exClefFor(n);
  if (play) Sound.play(midiOf(n));
  exRender(false);
}
function explorePick(m) { exSet(noteFromMidi(m, ex.acc < 0)); }

function exInfo() {
  const n = ex.n, m = midiOf(n);
  const hz = 440 * Math.pow(2, (m - 69) / 12);
  const black = isBlackMidi(m);
  const alt = black ? noteFromMidi(m, n.a > 0) : null;
  const r = route(n, ex.nClef, true);
  const toC = Math.abs(stepOf(n) - 28);
  return `<div class="info-main"><div class="info-name">${nameHTML(n)}</div>
      <div class="info-meta">${black && alt && ascii(alt) !== ascii(n) ? `also ${nameHTML(alt)} · ` : ''}MIDI ${m} · ${hz.toFixed(hz < 100 ? 1 : 0)} Hz</div></div>
    <div class="info-route"><b>Landmark route.</b> ${r.answerHTML}${n.a ? ' The accidental moves it one key ' + (n.a > 0 ? 'right' : 'left') + ' of the written line or space.' : ''}
      <span class="muted"> ${toC === 0 ? 'This is Middle C.' : `${toC} ${toC === 1 ? 'letter' : 'letters'} ${stepOf(n) > 28 ? 'above' : 'below'} Middle C.`}</span></div>`;
}
function exRender(full = true) {
  const n = ex.n, clef = ex.nClef;
  const staffMode = ex.clef;
  const extent = staffMode === 'grand' ? { treble: [-4, 13], bass: [-4, 13] } : { [staffMode]: [-6, 14] };
  const item = { n, clef: staffMode === 'grand' ? clef : undefined, state: 'lm', label: plainName(n) };
  Staff.mount($('#ex-staff'), {
    clef: staffMode, cols: [[item]], extent, guides: ex.guides, scale: 1.5, aria: 'Selected note on the staff',
    onPick: (pos, c) => exSet(noteAtPos(pos, c, ex.acc), c),
  });
  $('#ex-info').innerHTML = exInfo();
  if (!ex.kb || full) return;
  ex.kb.clear();
  ex.kb.mark(midiOf(n), 'target');
}
function exKeyboard() {
  const lab = ex.labels;
  ex.kb = Keyboard.mount($('#ex-kb'), { lo: 21, hi: 108, labels: lab, onPress: m => explorePick(m), minKey: 30, maxKey: 44 });
  ex.kb.mark(midiOf(ex.n), 'target');
  ex.kb.scrollTo(midiOf(ex.n));
}
function viewExplore() {
  tab = 'explore'; setNav();
  const chips = LANDMARKS.slice().sort((a, b) => a.midi - b.midi).map(l => `<button class="chip" data-lm="${l.n}"><b>${l.name}</b><span>${l.n}</span></button>`).join('');
  VIEW.innerHTML = `<div class="wrap">
    <h1 class="page-h">Explore</h1>
    <p class="lead">Tap a key, or tap a line or space on the staff. You get the name and the shortest route from a landmark.</p>
    <section class="card ex">
      <div class="toolbar">
        <div class="tb"><span>Clef</span>${seg('exclef', [['grand', 'Grand'], ['treble', 'Treble'], ['bass', 'Bass'], ['alto', 'Alto'], ['tenor', 'Tenor']], ex.clef)}</div>
        <div class="tb"><span>Accidental</span>${seg('exacc', [[-1, '♭'], [0, '♮'], [1, '♯']], ex.acc)}</div>
        <div class="tb"><span>Guides</span>${seg('exguides', [[true, 'On'], [false, 'Off']], ex.guides)}</div>
        <div class="tb"><span>Key labels</span>${seg('exlabels', [['none', 'None'], ['landmarks', 'Landmarks'], ['all', 'All']], ex.labels)}</div>
      </div>
      <div id="ex-staff"></div>
      <div class="info" id="ex-info"></div>
      <div id="ex-kb"></div>
      <div class="kb-nav"><button class="btn small ghost" data-kbnav="-1">‹ Lower keys</button><button class="btn small ghost" data-kbnav="1">Higher keys ›</button></div>
    </section>
    <section class="card"><h3>Landmarks</h3><div class="chips">${chips}</div></section>
  </div>`;
  exKeyboard(); exRender(true);
  VIEW.onclick = e => {
    const chip = e.target.closest('.chip');
    if (chip) { const l = LM[chip.dataset.lm]; exSet(l.note, undefined); return; }
    const nav = e.target.closest('[data-kbnav]');
    if (nav) return ex.kb.scrollBy(+nav.dataset.kbnav);
    const b = e.target.closest('[data-set]');
    if (!b) return;
    const k = b.dataset.set, v = b.dataset.v;
    if (k === 'exclef') { ex.clef = v; ex.nClef = exClefFor(ex.n); }
    if (k === 'exacc') { ex.acc = +v; ex.n = fromStep(stepOf(ex.n), ex.acc); }
    if (k === 'exguides') ex.guides = v === 'true';
    if (k === 'exlabels') ex.labels = v;
    $$('[data-set="' + k + '"]', VIEW).forEach(x => x.setAttribute('aria-checked', String(x === b)));
    if (k === 'exlabels') exKeyboard();
    if (k === 'exacc') Sound.play(midiOf(ex.n));
    exRender(false);
  };
}

// ---- Progress -----------------------------------------------------------------------------------
function idNote(id) {
  const m = /^(treble|bass|alto|tenor):([A-G](?:bb|b|#|x|)-?\d)\*?$/.exec(id);
  if (!m) return null;
  try { return { clef: m[1], n: parseNote(m[2]) }; } catch (e) { return null; }
}
function viewProgress() {
  tab = 'progress'; setNav();
  const d = Store.all();
  const items = d.items;
  const heat = {};
  Object.entries(items).forEach(([id, it]) => {
    const p = idNote(id);
    if (!p || !it.n) return;
    const m = midiOf(p.n);
    heat[m] = Math.max(heat[m] === undefined ? -1 : heat[m], it.b);
  });
  const total = d.totals.q, acc = total ? d.totals.ok / total : 0;
  const days = Object.keys(d.days).length;
  const allStaff = new Map();
  LEVELS.forEach(L => (L.staff || []).forEach(e => allStaff.set(e.id, e)));
  const masteredN = [...allStaff.keys()].filter(id => Store.box(id) >= Store.MASTERED).length;
  const weak = Object.entries(items).map(([id, it]) => ({ id, it, p: idNote(id) }))
    .filter(x => x.p && x.it.n && x.it.b < Store.MASTERED)
    .sort((a, b) => a.it.b - b.it.b || (a.it.c / a.it.n) - (b.it.c / b.it.n) || b.it.ms - a.it.ms).slice(0, 8);
  const lvl = LEVELS.map(L => { const m = levelMastery(L); return `<div class="row lv"><span>${pad2(L.id)} · ${L.title}</span><span class="meter sm"><i style="width:${pct(m)}%"></i></span><b>${pct(m)}%</b></div>`; }).join('');
  VIEW.innerHTML = `<div class="wrap">
    <h1 class="page-h">Progress</h1>
    <div class="tiles big">
      <div><b>${total}</b><span>answers</span></div>
      <div><b>${total ? pct(acc) + '%' : '–'}</b><span>accuracy</span></div>
      <div><b>${masteredN}<small> / ${allStaff.size}</small></b><span>staff notes mastered</span></div>
      <div><b>${days}</b><span>days practiced</span></div>
    </div>
    <section class="card"><h3>Keyboard map</h3><p class="muted">Each key shows how well you read it from the staff. Unplayed keys stay plain.</p>
      <div id="heat"></div>
      <div class="legend"><span><i class="sw h0"></i>shaky</span><span><i class="sw h2"></i>learning</span><span><i class="sw h3"></i>solid</span><span><i class="sw h5"></i>automatic</span></div>
      <div class="kb-nav"><button class="btn small ghost" data-kbnav="-1">‹ Lower keys</button><button class="btn small ghost" data-kbnav="1">Higher keys ›</button></div>
    </section>
    <div class="two">
      <section class="card"><h3>Needs work</h3>${weak.length ? `<ul class="missed">${weak.map(w => `<li>${nameHTML(w.p.n)} <span class="muted">${CLEFS[w.p.clef].title.toLowerCase()} · ${Math.round(100 * w.it.c / w.it.n)}% right</span></li>`).join('')}</ul>` : '<p class="muted">Nothing flagged yet. Do a few drills and your weakest notes will show up here.</p>'}
        ${weak.length ? '<button class="btn small primary" id="p-smart">Practice these</button>' : ''}</section>
      <section class="card"><h3>Levels</h3>${lvl}</section>
    </div>
    <section class="card"><h3>Reset</h3><p class="muted">Erase all progress stored in this browser.</p><div id="reset-zone"><button class="btn small" id="p-reset">Reset progress</button></div></section>
  </div>`;
  const kb = Keyboard.mount($('#heat'), { lo: 21, hi: 108, labels: 'c', minKey: 28, maxKey: 44 });
  Object.entries(heat).forEach(([m, b]) => kb.mark(+m, 'h' + b));
  kb.scrollTo(60);
  VIEW.onclick = e => {
    const nav = e.target.closest('[data-kbnav]');
    if (nav) return kb.scrollBy(+nav.dataset.kbnav);
    if (e.target.id === 'p-smart') return startSession({ level: 'smart' });
    if (e.target.id === 'p-reset') {
      $('#reset-zone').innerHTML = '<p>This cannot be undone.</p><button class="btn small danger" id="p-reset-yes">Erase everything</button> <button class="btn small ghost" id="p-reset-no">Cancel</button>';
    } else if (e.target.id === 'p-reset-no') $('#reset-zone').innerHTML = '<button class="btn small" id="p-reset">Reset progress</button>';
    else if (e.target.id === 'p-reset-yes') { Store.reset(); Questions.reset(); viewProgress(); }
  };
}
