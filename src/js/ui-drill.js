'use strict';
// ---------------------------------------------------------------------------
// Drill sessions: question rendering, answer handling, feedback and summary.
// ---------------------------------------------------------------------------
const ACC_PLAIN = { '-2': '♭♭', '-1': '♭', '0': '', '1': '♯', '2': '×' };
const plainName = n => LETTERS[n.l] + ACC_PLAIN[n.a] + n.o;
const NM = n => nameHTML(n);

function pickSmartLevel() {
  const started = LEVELS.filter(L => !L.capstone && levelStarted(L) && levelMastery(L) < 0.98);
  const rec = LEVELS.find(L => !L.capstone && levelMastery(L) < 0.6);
  if (rec && !started.includes(rec)) started.push(rec);
  if (!started.length) return LEVELS[0];
  return weightedPick(started, L => 1.1 - levelMastery(L));
}

function stopSession() {
  if (S) { clearInterval(S.timer); clearTimeout(S.adv); }
  S = null;
}

function startSession(o) {
  stopSession();
  const smart = o.level === 'smart';
  S = {
    smart, L: smart ? null : LEVEL[o.level], mode: o.mode || 'steady', filter: o.filter || 'mixed',
    total: Store.setting('length'), i: 0, correct: 0, streak: 0, best: 0, times: [], missed: [],
    answered: false, hinted: false, q: null, guideUser: null, kbMarks: {}, cols: null, sel: null, seq: null,
    timer: null, left: 60, kb: null,
  };
  tab = 'drill'; setNav();
  renderShell();
  if (S.mode === 'speed') {
    S.timer = setInterval(() => {
      if (!S) return;
      S.left -= 0.25;
      updateHead();
      if (S.left <= 0) endSession();
    }, 250);
  }
  nextQuestion();
  window.scrollTo(0, 0);
}

function renderShell() {
  VIEW.innerHTML = `<div class="wrap narrow drill">
    <div class="d-head">
      <button class="btn ghost small" id="d-exit">‹ Exit</button>
      <div class="d-title" id="d-title"></div>
      <div class="d-stats"><span id="d-count"></span><span id="d-streak"></span></div>
    </div>
    <div class="progress" role="progressbar" aria-label="Round progress"><i id="d-bar"></i></div>
    <section class="card prompt">
      <div class="q-top">
        <p id="q-text" class="q-text"></p>
        <div class="q-tools"><button class="btn small ghost" id="b-hint" title="Shortcut: H">Hint</button><button class="btn small ghost" id="b-guides" aria-pressed="false" title="Shortcut: L">Guides</button></div>
      </div>
      <div id="stage" class="stage"></div>
      <div id="fb" class="fb" aria-live="polite"></div>
    </section>
    <section class="card answer" id="ans"></section>
    <div class="d-foot"><button class="btn primary" id="b-next" hidden>Next</button></div>
  </div>`;
  $('#d-exit').onclick = () => go('drill');
  $('#b-hint').onclick = showHint;
  $('#b-guides').onclick = () => { S.guideUser = !S.guides; S.guides = S.guideUser; refreshStage(); updateTools(); };
  $('#b-next').onclick = nextQuestion;
  $('#ans').onclick = ansClick;
}

function updateHead() {
  if (!S) return;
  const L = S.q ? S.q.level : S.L;
  $('#d-title').textContent = (S.smart ? 'Smart review · ' : '') + (L ? `Level ${pad2(L.id)} · ${L.title}` : '');
  if (S.mode === 'speed') {
    $('#d-count').textContent = `${Math.max(0, Math.ceil(S.left))}s · ${S.correct} right`;
    $('#d-bar').style.width = Math.max(0, S.left / 60 * 100) + '%';
  } else {
    $('#d-count').textContent = `${Math.min(S.i + (S.answered ? 0 : 1), S.total)} of ${S.total}`;
    $('#d-bar').style.width = (S.i / S.total * 100) + '%';
  }
  $('#d-streak').textContent = S.streak > 1 ? `Streak ${S.streak}` : '';
}
function updateTools() {
  const q = S.q;
  const hint = $('#b-hint'), g = $('#b-guides');
  hint.hidden = !Store.setting('hints') || S.answered;
  const hasStaff = !!q.staff;
  g.hidden = !hasStaff;
  g.setAttribute('aria-pressed', String(!!S.guides));
  g.textContent = S.guides ? 'Guides on' : 'Guides off';
}

function guidesFor(L) {
  if (S.guideUser !== null) return S.guideUser;
  const g = Store.setting('guides');
  return g === 'on' ? true : g === 'off' ? false : L.tier === 0;
}
function kbLabelMode(q) {
  const k = Store.setting('keyLabels');
  if (k !== 'auto') return k;
  if (q.type === 'locate' || q.type === 'identify') return 'none';
  return S.guides ? 'landmarks' : 'none';
}

// ---- question flow ----------------------------------------------------------------------
function nextQuestion() {
  if (!S) return;
  clearTimeout(S.adv);
  if (S.mode === 'steady' && S.i >= S.total) return endSession();
  const L = S.smart ? pickSmartLevel() : S.L;
  S.q = Questions.make(L, S.filter);
  S.answered = false; S.hinted = false; S.kbMarks = {}; S.cols = null; S.seq = null; S.placeCols = null;
  S.sel = { letter: null, acc: 0, oct: null, chord: new Set() };
  S.guides = guidesFor(L);
  $('#fb').className = 'fb'; $('#fb').innerHTML = '';
  $('#b-next').hidden = true;
  $('#q-text').innerHTML = S.q.text;
  $('#q-text').classList.toggle('big', S.q.type === 'locate');
  if (S.q.answer.kind === 'seq') { S.seq = { i: 0, mistakes: 0, bad: S.q.answer.targets.map(() => false), wrongOn: 0 }; setSeqCols(0); }
  mountStage();
  mountAnswer();
  updateHead(); updateTools();
  S.t0 = performance.now();
}

function stageStaffOpts() {
  const q = S.q;
  const o = Object.assign({}, q.staff, { guides: S.guides, scale: 1.55, aria: 'Notation for this question' });
  if (S.cols) o.cols = S.cols;
  return o;
}
function mountKbPrompt(host) {
  const q = S.q;
  const kb = Keyboard.mount(host, { lo: q.ctx.kb[0], hi: q.ctx.kb[1], labels: kbLabelMode(q), onPress: m => App.onKey(m) });
  kb.mark(q.kbPrompt.target, S.answered ? 'good' : 'target');
  kb.scrollTo(q.kbPrompt.target);
  return kb;
}
function mountStage() {
  const q = S.q, stage = $('#stage');
  stage.innerHTML = '';
  stage.hidden = false;
  if (q.kbPrompt) { mountKbPrompt(stage); return; }
  if (q.staff && q.answer.kind !== 'place') { Staff.mount(stage, stageStaffOpts()); return; }
  stage.hidden = true;
}
function applyMarks() {
  if (!S.kb) return;
  S.kb.clear();
  Object.entries(S.kbMarks).forEach(([m, st]) => S.kb.mark(+m, st));
}
function mountAnswer() {
  const q = S.q, a = q.answer, ans = $('#ans');
  S.kb = null;
  if (a.kind === 'key' || a.kind === 'seq' || a.kind === 'chord') {
    const [lo, hi] = q.ctx.kb;
    ans.innerHTML = '<div id="kbhost"></div>';
    S.kb = Keyboard.mount($('#kbhost'), { lo, hi, labels: kbLabelMode(q), onPress: m => App.onKey(m) });
    const mid = Math.round((lo + hi) / 2);
    if (hi - lo > 40) {
      ans.insertAdjacentHTML('beforeend', '<div class="kb-nav"><button class="btn small ghost" data-kbnav="-1">‹ Lower keys</button><button class="btn small ghost" data-kbnav="1">Higher keys ›</button></div>');
      S.kb.scrollTo(60);
    } else S.kb.scrollTo(mid);
    applyMarks();
  } else if (a.kind === 'name') mountPad();
  else if (a.kind === 'interval') {
    ans.innerHTML = `<div class="pad"><div class="pad-row opts">${a.options.map((o, i) => `<button class="pbtn wide" data-iv="${i + 1}">${o}</button>`).join('')}</div></div>`;
  } else if (a.kind === 'place') mountPlace();
}
function mountPlace(cols) {
  const q = S.q;
  const o = Object.assign({}, q.staff, { guides: S.guides, scale: 1.55, aria: 'Tap the line or space' });
  if (cols) o.cols = cols; else o.onPick = onPlace;
  Staff.mount($('#ans'), o);
}
function refreshStage() {
  if (!S || !S.q) return;
  mountStage();
  if (S.q.answer.kind === 'place') mountPlace(S.placeCols);
  else if (S.kb) { const sc = S.kb.scroller.scrollLeft; mountAnswer(); S.kb.scroller.scrollLeft = sc; }
  updateTools();
}

// ---- name pad ---------------------------------------------------------------------------
function mountPad() {
  const q = S.q, a = q.answer, p = a.parts;
  const lo = Math.floor(q.ctx.kb[0] / 12) - 1, hi = Math.floor(q.ctx.kb[1] / 12) - 1;
  let html = '<div class="pad">';
  if (p.fixedLetter) html += `<p class="pad-note">This key is a <b>${p.fixedLetter}</b>.</p>`;
  else html += `<div class="pad-row" role="group" aria-label="Letter">${LETTERS.map((l, i) => `<button class="pbtn" data-l="${i}" aria-pressed="false">${l}</button>`).join('')}</div>`;
  if (p.acc) html += `<div class="pad-row" role="group" aria-label="Accidental">${p.acc.map(x => `<button class="pbtn acc${x === 0 ? ' on' : ''}" data-a="${x}" aria-pressed="${x === 0}" aria-label="${x === 0 ? 'natural' : ACC_WORDS[x]}">${accSvg(x)}</button>`).join('')}</div>`;
  if (p.oct) {
    let os = ''; for (let o = lo; o <= hi; o++) os += `<button class="pbtn" data-o="${o}" aria-pressed="false">${o}</button>`;
    html += `<div class="pad-row" role="group" aria-label="Octave number"><span class="pad-lbl">Octave</span>${os}</div>`;
  }
  const needCheck = !((p.fixedLetter ? 0 : 1) + (p.acc ? 1 : 0) + (p.oct ? 1 : 0) === 1);
  if (needCheck) html += '<div class="pad-row"><button class="btn primary" id="pad-check" disabled>Check</button><span class="pad-sel muted" id="pad-sel"></span></div>';
  html += '</div>';
  $('#ans').innerHTML = html;
}
function padSummary() {
  const p = S.q.answer.parts, s = S.sel;
  const l = p.fixedLetter ? LETTERS.indexOf(p.fixedLetter) : s.letter;
  const txt = (l === null ? '?' : LETTERS[l]) + (p.acc && s.acc ? ACC_PLAIN[s.acc] : '') + (p.oct ? (s.oct === null ? '?' : s.oct) : '');
  const sel = $('#pad-sel'), chk = $('#pad-check');
  if (sel) sel.textContent = txt;
  if (chk) chk.disabled = l === null || (p.oct && s.oct === null);
}
function setPad(kind, v) {
  if (S.answered) return;
  const p = S.q.answer.parts;
  if (kind === 'l') S.sel.letter = v; if (kind === 'a') S.sel.acc = v; if (kind === 'o') S.sel.oct = v;
  $$('#ans [data-' + kind + ']').forEach(b => { const on = +b.dataset[kind] === v; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
  const only = (p.fixedLetter ? 0 : 1) + (p.acc ? 1 : 0) + (p.oct ? 1 : 0) === 1;
  if (only && (kind === 'l' || kind === 'o')) return checkName();
  padSummary();
}
function checkName() {
  if (S.answered) return;
  const a = S.q.answer, p = a.parts, s = S.sel, t = a.target;
  const letter = p.fixedLetter ? LETTERS.indexOf(p.fixedLetter) : s.letter;
  if (letter === null || (p.oct && s.oct === null)) return;
  const acc = p.acc ? s.acc : 0;
  let ok;
  if (a.anyOctave) ok = letter === t.l;
  else if (a.anySpelling) {
    ok = p.oct ? midiOf(mk(letter, s.oct, acc)) === midiOf(t) : ((PCS[letter] + acc + 120) % 12) === ((midiOf(t) % 12) + 12) % 12;
  } else ok = letter === t.l && acc === t.a && (!p.oct || a.ignoreOct || s.oct === t.o);
  const said = LETTERS[letter] + ACC_PLAIN[acc] + (p.oct ? s.oct : '');
  revealStaff(ok);
  finish(ok, ok ? '' : `You answered ${said}.`);
}

// ---- other answers -----------------------------------------------------------------------
function ansClick(e) {
  if (!S) return;
  const t = e.target.closest('button');
  if (!t) return;
  if (t.dataset.kbnav) return S.kb.scrollBy(+t.dataset.kbnav);
  if (t.dataset.l !== undefined) return setPad('l', +t.dataset.l);
  if (t.dataset.a !== undefined) return setPad('a', +t.dataset.a);
  if (t.dataset.o !== undefined) return setPad('o', +t.dataset.o);
  if (t.id === 'pad-check') return checkName();
  if (t.dataset.iv) {
    if (S.answered) return;
    const k = +t.dataset.iv, ok = k === S.q.answer.correct;
    t.classList.add(ok ? 'good' : 'bad');
    if (!ok) $$('#ans [data-iv]')[S.q.answer.correct - 1].classList.add('good');
    revealStaff(ok);
    finish(ok, ok ? '' : `You answered ${S.q.answer.options[k - 1]}.`);
  }
}
function onPlace(pos, clef) {
  if (S.answered || clef !== S.q.answer.clef) return;
  const a = S.q.answer, ok = pos === a.targetPos;
  const picked = noteAtPos(pos, clef);
  Sound.play(midiOf(picked));
  S.placeCols = ok
    ? [[{ n: a.n, clef, state: 'good', label: plainName(a.n) }]]
    : [[{ n: picked, clef, state: 'bad', label: plainName(picked) }], [{ n: a.n, clef, state: 'lm', label: plainName(a.n) }]];
  mountPlace(S.placeCols);
  finish(ok, ok ? '' : `You placed ${NM(picked)}.`);
}
function keyOk(m) { const a = S.q.answer; return a.accept ? a.accept(m) : a.targets.includes(m); }
function handleKey(m) {
  Sound.play(m);
  if (S.answered) return;
  const a = S.q.answer;
  if (a.kind === 'key') {
    const ok = keyOk(m);
    S.kbMarks[m] = ok ? 'good' : 'bad';
    if (!ok) (a.targets || [a.anyTarget]).forEach(t => (S.kbMarks[t] = 'good'));
    applyMarks();
    revealStaff(ok);
    finish(ok, ok ? '' : `You played ${NM(noteFromMidi(m))}.`);
  } else if (a.kind === 'seq') seqPress(m);
  else if (a.kind === 'chord') chordPress(m);
}
function seqPress(m) {
  const q = S.q, a = q.answer;
  if (!S.seq) S.seq = { i: 0, mistakes: 0, bad: a.targets.map(() => false), wrongOn: 0 };
  const sq = S.seq, exp = a.targets[sq.i];
  if (m === exp) {
    sq.i++; sq.wrongOn = 0;
    S.kbMarks = {};
    if (sq.i >= a.targets.length) {
      setSeqCols(-1);
      applyMarks();
      const ms = performance.now() - S.t0;
      q.ids.forEach((id, k) => Store.rec(id, !sq.bad[k], ms / q.ids.length, S.hinted));
      return finish(sq.mistakes === 0, sq.mistakes ? `You had ${sq.mistakes} wrong ${sq.mistakes === 1 ? 'note' : 'notes'}. The line was ${q.explain}.` : '', true);
    }
    setSeqCols(sq.i);
  } else {
    sq.mistakes++; sq.bad[sq.i] = true; sq.wrongOn++;
    S.kbMarks = { [m]: 'bad' };
    if (sq.wrongOn >= 2) S.kbMarks[exp] = 'target';
    setSeqCols(sq.i);
    setTimeout(() => { if (S && S.seq === sq && S.kbMarks[m] === 'bad') { delete S.kbMarks[m]; applyMarks(); } }, 450);
  }
  applyMarks();
}
function setSeqCols(cur) {
  const q = S.q, notes = q.staff.cols.map(c => c[0].n);
  S.cols = notes.map((n, i) => [{ n, clef: q.staff.cols[i][0].clef, state: i < (cur < 0 ? 99 : cur) ? (S.seq.bad[i] ? 'bad' : 'good') : i === cur ? 'target' : 'ink', label: i < (cur < 0 ? 99 : cur) ? plainName(q.answer.notes[i]) : '' }]);
  mountStage();
}
function chordPress(m) {
  const a = S.q.answer, set = S.sel.chord;
  if (set.has(m)) set.delete(m); else set.add(m);
  S.kbMarks = {};
  set.forEach(x => (S.kbMarks[x] = 'sel'));
  applyMarks();
  if (set.size < a.targets.length) return;
  const ok = [...set].sort().join() === a.targets.slice().sort((x, y) => x - y).join();
  S.kbMarks = {};
  a.targets.forEach(t => (S.kbMarks[t] = 'good'));
  set.forEach(x => { if (!a.targets.includes(x)) S.kbMarks[x] = 'bad'; });
  applyMarks();
  revealStaff(ok);
  finish(ok, ok ? '' : `You played ${[...set].sort((x, y) => x - y).map(x => NM(noteFromMidi(x))).join(' ')}.`);
}
/** Recolour the staff note(s) once the answer is known and name them underneath. */
function revealStaff(ok) {
  const q = S.q;
  if (!q.staff || q.answer.kind === 'place') return;
  const cols = q.staff.cols.map(c => c.map(it => Object.assign({}, it, q.type === 'steps' ? {} : { state: ok ? 'good' : 'lm' })));
  if (q.type === 'steps') {
    cols.push([{ n: q.staff.targetNote, clef: q.staff.cols[0][0].clef, state: ok ? 'good' : 'target', label: plainName(q.staff.targetNote) }]);
  } else if (q.type === 'chord') {
    cols[0].forEach((it, i) => (it.label = ''));
  } else if (q.type !== 'interval' && cols.length === 1 && cols[0].length === 1) {
    cols[0][0].label = plainName(q.shown);
  }
  S.cols = cols;
  mountStage();
}

// ---- feedback -------------------------------------------------------------------------------
function showHint() {
  if (!S || S.answered || !Store.setting('hints')) return;
  S.hinted = true;
  const fb = $('#fb');
  fb.className = 'fb hint';
  fb.innerHTML = `<b>Hint.</b> ${S.q.hint}`;
}
function replay() {
  const a = S.q.answer;
  if (a.targets) { if (a.kind === 'seq') Sound.playSeq(a.targets); else if (a.kind === 'chord') Sound.playChord(a.targets); else Sound.play(a.targets[0]); }
  else if (S.q.shown) Sound.play(midiOf(S.q.shown));
}
function finish(ok, extra, noRec) {
  if (!S || S.answered) return;
  S.answered = true;
  const q = S.q, ms = performance.now() - S.t0;
  if (!noRec && q.type !== 'seq') q.ids.forEach(id => Store.rec(id, ok, ms, S.hinted));
  S.i++; S.times.push(ms);
  if (q.kbPrompt) mountStage();
  if (ok) { S.correct++; S.streak++; S.best = Math.max(S.best, S.streak); } else { S.streak = 0; S.missed.push(q); }
  const fb = $('#fb');
  fb.className = 'fb ' + (ok ? 'ok' : 'bad');
  const play = q.answer.targets || q.shown ? '<button class="btn small ghost" id="b-hear">Hear it</button>' : '';
  if (ok) {
    fb.innerHTML = `<span><b>Correct.</b> ${q.type === 'seq' || q.type === 'chord' ? q.explain : q.type === 'interval' ? '<b>' + q.answer.options[q.answer.correct - 1] + '</b>' : NM(q.shown)}${S.hinted ? ' <span class="muted">(hint used)</span>' : ''}</span>${play}`;
  } else {
    fb.innerHTML = `<span><b>Not quite.</b> ${extra ? extra + ' ' : ''}${q.type === 'seq' ? '' : q.explain}</span>${play}`;
  }
  const hear = $('#b-hear'); if (hear) hear.onclick = replay;
  updateHead(); updateTools();
  const fast = S.mode === 'speed';
  if (ok) S.adv = setTimeout(nextQuestion, fast ? 350 : 800);
  else if (fast) S.adv = setTimeout(nextQuestion, 1600);
  else { $('#b-next').hidden = false; $('#b-next').focus({ preventScroll: true }); }
}

// ---- end of round ------------------------------------------------------------------------------
function endSession() {
  const s = S;
  if (!s) return;
  clearInterval(s.timer); clearTimeout(s.adv);
  const n = s.i, acc = n ? s.correct / n : 0;
  const avg = n ? s.times.reduce((a, b) => a + b, 0) / n : 0;
  let newBest = false;
  if (s.mode === 'speed' && !s.smart) newBest = Store.setBest('speed:' + s.L.id, s.correct);
  if (s.mode === 'speed' && s.smart) newBest = Store.setBest('speed:smart', s.correct);
  const L = s.L, next = L && LEVEL[L.id + 1];
  const missed = new Map();
  s.missed.forEach(q => { const k = q.type === 'seq' ? 'line' + Math.random() : q.ids[0]; if (!missed.has(k)) missed.set(k, q); });
  const rows = [...missed.values()].slice(0, 8).map(q => `<li>${q.type === 'seq' ? 'Line: ' + q.explain : NM(q.shown) + (q.clef ? ` <span class="muted">${CLEFS[q.clef].title.toLowerCase()}</span>` : '')}</li>`).join('');
  const ready = L && levelMastery(L) >= 0.6 && next;
  VIEW.innerHTML = `<div class="wrap narrow"><section class="card summary">
    <p class="eyebrow">${s.mode === 'speed' ? 'Speed round' : 'Round'} complete</p>
    <h2>${s.correct} of ${n} correct${newBest ? ' · new best' : ''}</h2>
    <div class="tiles">
      <div><b>${pct(acc)}%</b><span>accuracy</span></div>
      <div><b>${mm(avg) || 0}s</b><span>average time</span></div>
      <div><b>${s.best}</b><span>best streak</span></div>
    </div>
    ${rows ? `<h3>Review these</h3><ul class="missed">${rows}</ul>` : '<p>Clean round. Nothing to review.</p>'}
    ${L ? `<div class="meter"><i style="width:${pct(levelMastery(L))}%"></i></div><small class="muted">Level ${pad2(L.id)} is ${pct(levelMastery(L))}% mastered</small>` : ''}
    <div class="les-nav">
      <button class="btn" id="s-back">All levels</button>
      <button class="btn${ready ? '' : ' primary'}" id="s-again">Go again</button>
      ${ready ? `<button class="btn primary" id="s-next">Level ${pad2(next.id)}: ${next.title}</button>` : ''}
    </div></section></div>`;
  const o = { level: s.smart ? 'smart' : s.L.id, mode: s.mode, filter: s.filter };
  stopSession();
  $('#s-back').onclick = () => go('learn');
  $('#s-again').onclick = () => startSession(o);
  if (ready) $('#s-next').onclick = () => startSession({ level: next.id });
  window.scrollTo(0, 0);
}

// ---- keyboard shortcuts ---------------------------------------------------------------------------
function drillKeydown(e) {
  if (!S || !S.q || e.ctrlKey || e.metaKey || e.altKey) return false;
  if (e.target.closest && e.target.closest('input,select,textarea')) return false;
  const k = e.key, a = S.q.answer;
  if (S.answered) {
    if (k === 'Enter' || k === ' ') { if (S.mode !== 'speed' && !$('#b-next').hidden) { e.preventDefault(); nextQuestion(); return true; } }
    return false;
  }
  if (k === 'h' || k === 'H') { showHint(); return true; }
  if (k === 'l' || k === 'L') { if (S.q.staff) $('#b-guides').click(); return true; }
  if (a.kind !== 'name') return false;
  const p = a.parts;
  if (/^[a-gA-G]$/.test(k) && !p.fixedLetter) { setPad('l', LETTERS.indexOf(k.toUpperCase())); return true; }
  if (p.acc && (k === 'ArrowUp' || k === 'ArrowDown')) {
    const i = p.acc.indexOf(S.sel.acc), j = clamp(i + (k === 'ArrowUp' ? 1 : -1), 0, p.acc.length - 1);
    setPad('a', p.acc[j]); e.preventDefault(); return true;
  }
  if (p.oct && /^\d$/.test(k)) { if ($(`#ans [data-o="${k}"]`)) setPad('o', +k); return true; }
  if (k === 'Enter') { checkName(); return true; }
  return false;
}
