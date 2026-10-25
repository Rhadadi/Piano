'use strict';
// ---------------------------------------------------------------------------
// UI core: helpers, navigation, settings, Learn path, lessons, drill setup.
// ---------------------------------------------------------------------------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const VIEW = $('#view');
const pad2 = n => String(n).padStart(2, '0');
const mm = ms => Math.round(ms / 100) / 10;

let S = null; // active drill session (see ui-drill.js)
let tab = 'learn';

const star = on => `<svg class="star${on ? ' on' : ''}" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 1.8l2.4 5.3 5.8.6-4.3 3.9 1.2 5.7L10 14.4 4.9 17.3l1.2-5.7L1.8 7.7l5.8-.6z"/></svg>`;
const stars = n => `<span class="stars" role="img" aria-label="${n} of 3 stars">${[0, 1, 2].map(i => star(i < n)).join('')}</span>`;
const pct = v => Math.round(v * 100);

// ---- interactive machines (Anatomy figures) -----------------------------------------
const FIGURE = { rail: FigLandmarkRail, action: FigKeyAction };
function isoTheme() {
  const t = Store.setting('theme');
  return t === 'auto' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : t;
}
function syncIso() { $$('.iso').forEach(el => el.setAttribute('data-theme', isoTheme())); }
function mountFigure(host, name) {
  const fig = FIGURE[name];
  host.innerHTML = `<div class="iso fig" data-theme="${isoTheme()}">${fig.card}</div>`;
  fig.mount($('.iso-figure', host));
}

// ---- viz helpers (lessons and hero) -------------------------------------------
function parseShort(s) {
  const m = /^([A-G](?:bb|b|#|x|)-?\d)(n?)(?:@(\w+))?(?:!(\w+))?(?:\|(.*))?$/.exec(s);
  if (!m) throw new Error('bad viz note ' + s);
  const n = parseNote(m[1]);
  if (m[2]) n.nat = true;
  return { n, clef: m[3], state: m[4], label: m[5] };
}
function vizCols(notes) {
  return notes.map(x => (Array.isArray(x) ? x : [x]).map(parseShort));
}
function renderViz(host, viz) {
  host.innerHTML = '';
  if (viz.figure) {
    const d = document.createElement('div');
    host.appendChild(d);
    mountFigure(d, viz.figure);
  }
  if (viz.staff) {
    const d = document.createElement('div');
    host.appendChild(d);
    const o = viz.staff;
    Staff.mount(d, {
      clef: o.clef, cols: vizCols(o.notes || []), guides: o.guides, keySig: o.keySig, ottava: o.ottava,
      colW: (o.notes || []).length > 3 ? 48 : 60, scale: 1.45, aria: 'Lesson diagram',
    });
  }
  if (viz.kb) {
    const d = document.createElement('div');
    d.className = 'viz-kb';
    host.appendChild(d);
    const k = viz.kb;
    const kb = Keyboard.mount(d, {
      lo: midiOf(parseNote(k.lo)), hi: midiOf(parseNote(k.hi)), labels: k.labels, groups: k.groups,
      onPress: m => Sound.play(m), minKey: 26, maxKey: 52,
    });
    Object.entries(k.marks || {}).forEach(([nm, st]) => kb.mark(midiOf(parseNote(nm)), st));
    if (midiOf(parseNote(k.hi)) - midiOf(parseNote(k.lo)) > 40) kb.scrollTo(60);
  }
}

// ---- navigation ------------------------------------------------------------------
const TABS = ['learn', 'drill', 'explore', 'progress'];
function setNav() {
  $$('#nav button').forEach(b => b.setAttribute('aria-current', b.dataset.tab === tab ? 'page' : 'false'));
}
function go(t) {
  stopSession(true);
  tab = t;
  setNav();
  if (location.hash.slice(1) !== t) history.replaceState(null, '', '#' + t);
  window.scrollTo(0, 0);
  ({ learn: viewLearn, drill: viewDrillSetup, explore: viewExplore, progress: viewProgress })[t]();
}

// ---- settings ----------------------------------------------------------------------
function applyTheme() {
  const t = Store.setting('theme');
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
  syncIso();
}
function seg(name, opts, cur) {
  return `<div class="seg" role="radiogroup" aria-label="${name}">${opts.map(([v, l]) =>
    `<button type="button" role="radio" aria-checked="${String(v) === String(cur)}" data-set="${name}" data-v="${v}">${l}</button>`).join('')}</div>`;
}
function renderSettings() {
  const st = Store.setting.bind(Store);
  $('#sheet-body').innerHTML = `
    <div class="set-row"><div><b>Sound</b><small>Play the note when you press a key.</small></div>${seg('sound', [[true, 'On'], [false, 'Off']], st('sound'))}</div>
    <div class="set-row"><label for="vol"><b>Volume</b></label><input id="vol" type="range" min="0.1" max="1" step="0.05" value="${st('volume')}"></div>
    <div class="set-row"><div><b>Landmark guides</b><small>Dashed lines and labels at landmark notes. Auto shows them in Levels 1 to 5.</small></div>${seg('guides', [['auto', 'Auto'], ['on', 'On'], ['off', 'Off']], st('guides'))}</div>
    <div class="set-row"><div><b>Keyboard labels</b><small>Auto marks landmark keys when guides are on.</small></div>${seg('keyLabels', [['auto', 'Auto'], ['none', 'None'], ['landmarks', 'Landmarks'], ['all', 'All']], st('keyLabels'))}</div>
    <div class="set-row"><div><b>Hints</b><small>Show a Hint button. Hinted answers do not raise mastery.</small></div>${seg('hints', [[true, 'On'], [false, 'Off']], st('hints'))}</div>
    <div class="set-row"><div><b>Questions per round</b></div>${seg('length', [[10, '10'], [20, '20'], [40, '40']], st('length'))}</div>
    <div class="set-row"><div><b>Theme</b></div>${seg('theme', [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']], st('theme'))}</div>
    <div class="set-row"><div><b>MIDI keyboard</b><small id="midi-msg">Play the drills on a real keyboard. Needs Chrome or Edge.</small></div><button type="button" class="btn small" id="midi-btn">Connect</button></div>`;
}
function openSheet() { renderSettings(); $('#sheet').hidden = false; $('#sheet .sheet-x').focus(); }
function closeSheet() { $('#sheet').hidden = true; }
function initSettings() {
  $('#btn-settings').addEventListener('click', openSheet);
  $('#sheet').addEventListener('click', e => {
    if (e.target.id === 'sheet' || e.target.closest('.sheet-x')) return closeSheet();
    const b = e.target.closest('[data-set]');
    if (b) {
      let v = b.dataset.v;
      if (v === 'true') v = true; else if (v === 'false') v = false; else if (/^\d+$/.test(v)) v = +v;
      Store.setSetting(b.dataset.set, v);
      applySettings();
      renderSettings();
      return;
    }
    if (e.target.id === 'midi-btn') {
      Sound.connectMIDI(m => App.onKey(m, true)).then(r => { $('#midi-msg').textContent = r.msg; });
    }
  });
  $('#sheet').addEventListener('input', e => { if (e.target.id === 'vol') { Store.setSetting('volume', +e.target.value); Sound.setVolume(+e.target.value); } });
  $('#btn-sound').addEventListener('click', () => { Store.setSetting('sound', !Store.setting('sound')); applySettings(); });
}
function applySettings() {
  Sound.enabled = Store.setting('sound');
  Sound.setVolume(Store.setting('volume'));
  const on = Sound.enabled;
  const b = $('#btn-sound');
  b.setAttribute('aria-pressed', String(on));
  b.setAttribute('aria-label', on ? 'Sound on' : 'Sound off');
  b.innerHTML = on
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 8.5a5 5 0 010 7M18.5 6a8.5 8.5 0 010 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9l5 6M22 9l-5 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  applyTheme();
  if (S) refreshStage();
}

// ---- Learn path ----------------------------------------------------------------------
const TIER_BLURB = [
  'Keys, octaves, and the three core landmarks.',
  'Each clef in full, the grand staff, and ledger lines.',
  'Black keys, key signatures, and the far ends of the keyboard.',
  'Enharmonics, C clefs, intervals, chords and sight-reading.',
];
const HERO_NOTES = [['C2', 'bass'], ['F2', 'bass'], ['C3', 'bass'], ['F3', 'bass'], ['C4', 'treble'], ['G4', 'treble'], ['C5', 'treble'], ['G5', 'treble'], ['C6', 'treble']];

function heroStaff(active) {
  const cols = HERO_NOTES.map(([n, clef]) => [{ n: parseNote(n), clef, state: n === active ? 'target' : 'lm', label: n }]);
  Staff.mount($('#hero-staff'), { clef: 'grand', cols, colW: 50, scale: 1.3, aria: 'The nine landmark notes on the grand staff' });
}
function levelCard(L, rec) {
  const m = levelMastery(L), started = levelStarted(L);
  const upNext = L === rec;
  return `<article class="lvl${upNext ? ' next' : ''}" data-id="${L.id}">
    <div class="lvl-top"><span class="lvl-n">${pad2(L.id)}</span>${upNext ? '<span class="badge">Up next</span>' : ''}${stars(starsFor(m))}</div>
    <h3>${L.title}</h3><p>${L.tag}</p>
    <div class="meter" role="img" aria-label="${pct(m)} percent mastered"><i style="width:${pct(m)}%"></i></div>
    <small class="muted">${started ? pct(m) + '% mastered' : 'Not started'}</small>
    <div class="lvl-actions"><button class="btn small" data-act="lesson">Lesson</button><button class="btn small primary" data-act="practice">Practice</button></div>
  </article>`;
}
function viewLearn() {
  tab = 'learn'; setNav();
  const rec = LEVELS.find(L => levelMastery(L) < 0.6) || LEVELS[LEVELS.length - 1];
  const chips = HERO_NOTES.map(([n]) => LM[n]).map(l => `<button class="chip" data-lm="${l.n}"><b>${l.name}</b><span>${l.n}</span></button>`).join('');
  let html = `<section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">The landmark method</p>
        <h1>Find a landmark. Count one or two steps. Name the note.</h1>
        <p>Instead of memorizing every line and space, learn nine anchor notes and read everything else from the nearest one. Tap a landmark to hear it.</p>
      </div>
      <div class="hero-chart"><div id="hero-staff"></div><div class="chips">${chips}</div></div>
    </section>`;
  TIERS.forEach((t, ti) => {
    html += `<section class="tier"><h2>${t}<small>${TIER_BLURB[ti]}</small></h2><div class="lvl-grid">${LEVELS.filter(L => L.tier === ti).map(L => levelCard(L, rec)).join('')}</div></section>`;
  });
  html = html.replace('</section><section class="tier">', `</section>
    <section class="machine"><div class="machine-copy"><p class="eyebrow">See it work</p><h2>The landmark rail</h2>
      <p>Slide along the keys. The reel of the nearest landmark pays out its tape, one tick per step, and the dial counts them. On this rail no key is ever more than two steps from a landmark. Tap a key to hear it.</p></div><div id="fig-rail"></div></section>
    <section class="tier">`);
  html += `<section class="machine"><div class="machine-copy"><p class="eyebrow">Inside the piano</p><h2>What one key sets in motion</h2>
      <p>A key is a lever. Press it and a chain of levers throws a felt hammer at the strings, then lets it fly free. Hold the key, drag it down slowly, or let the demo run.</p></div><div id="fig-action"></div></section>`;
  VIEW.innerHTML = `<div class="wrap">${html}</div>`;
  heroStaff(null);
  mountFigure($('#fig-rail'), 'rail');
  mountFigure($('#fig-action'), 'action');
  VIEW.onclick = e => {
    const chip = e.target.closest('.chip');
    if (chip) { const l = LM[chip.dataset.lm]; Sound.play(l.midi); heroStaff(l.n); return; }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const id = +b.closest('.lvl').dataset.id;
    if (b.dataset.act === 'lesson') openLesson(id, 0); else startSession({ level: id });
  };
}

// ---- Lessons ---------------------------------------------------------------------------
let lessonState = null;
function openLesson(id, i) {
  stopSession(true);
  lessonState = { id, i };
  tab = 'learn'; setNav();
  renderLesson();
  window.scrollTo(0, 0);
}
function renderLesson() {
  const { id, i } = lessonState;
  const L = LEVEL[id], slides = LESSONS[id] || [], s = slides[i];
  const last = i === slides.length - 1;
  VIEW.innerHTML = `<div class="wrap narrow">
    <div class="crumbs"><button class="btn ghost small" id="les-back">‹ All levels</button><span class="muted">Level ${pad2(id)} · ${L.title}</span></div>
    <article class="card lesson">
      <p class="eyebrow">Lesson ${i + 1} of ${slides.length}</p>
      <h2>${s.h}</h2>
      <div class="prose">${s.p}</div>
      <div class="viz" id="viz"></div>
      <div class="dots" aria-hidden="true">${slides.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
      <div class="les-nav">
        <button class="btn" id="les-prev" ${i === 0 ? 'disabled' : ''}>Back</button>
        ${last ? '<button class="btn primary" id="les-go">Start practice</button>' : '<button class="btn primary" id="les-next">Next</button>'}
      </div>
    </article></div>`;
  if (s.viz) renderViz($('#viz'), s.viz); else $('#viz').hidden = true;
  $('#les-back').onclick = () => go('learn');
  $('#les-prev').onclick = () => { lessonState.i--; renderLesson(); window.scrollTo(0, 0); };
  const nx = $('#les-next'); if (nx) nx.onclick = () => { lessonState.i++; renderLesson(); window.scrollTo(0, 0); };
  const gp = $('#les-go'); if (gp) gp.onclick = () => startSession({ level: id });
}

// ---- Drill setup -------------------------------------------------------------------------
function viewDrillSetup() {
  tab = 'drill'; setNav();
  const opts = LEVELS.map(L => `<option value="${L.id}">${pad2(L.id)} · ${L.title}</option>`).join('');
  const len = Store.setting('length');
  VIEW.innerHTML = `<div class="wrap narrow">
    <h1 class="page-h">Drill</h1>
    <form class="card setup" id="setup">
      <div class="field"><label for="selLevel">What to practice</label>
        <select id="selLevel"><option value="smart">Smart review: weakest notes first</option>${opts}</select></div>
      <div class="field"><label for="selFocus">Question type</label><select id="selFocus"></select></div>
      <fieldset class="field"><legend>Round</legend>
        <div class="seg" id="mode">
          <button type="button" role="radio" aria-checked="true" data-v="steady">${len} questions</button>
          <button type="button" role="radio" aria-checked="false" data-v="speed">Speed round, 60 s</button>
        </div></fieldset>
      <p class="muted" id="setup-note"></p>
      <button class="btn primary big" type="submit">Start</button>
    </form>
    <div class="card" id="bests"></div></div>`;
  const sel = $('#selLevel'), foc = $('#selFocus');
  const refresh = () => {
    const L = sel.value === 'smart' ? null : LEVEL[+sel.value];
    const types = L ? Questions.typesFor(L) : null;
    foc.innerHTML = `<option value="mixed">Mixed</option>` + (types || []).map(t => `<option value="${t}">${TYPE_LABELS[t]}</option>`).join('');
    foc.disabled = !L;
    $('#setup-note').textContent = L ? L.tag : 'Draws from every level you have started, favoring notes you miss or answer slowly.';
    $('#bests').innerHTML = `<h3>Speed round best scores</h3>` + (LEVELS.filter(x => Store.best('speed:' + x.id)).map(x => `<div class="row"><span>${pad2(x.id)} · ${x.title}</span><b>${Store.best('speed:' + x.id)}</b></div>`).join('') || '<p class="muted">No speed rounds played yet. Answer as many as you can in 60 seconds.</p>');
  };
  sel.onchange = refresh; refresh();
  $('#mode').onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    $$('#mode button').forEach(x => x.setAttribute('aria-checked', String(x === b)));
  };
  $('#setup').onsubmit = e => {
    e.preventDefault();
    startSession({
      level: sel.value === 'smart' ? 'smart' : +sel.value, filter: foc.value,
      mode: $('#mode [aria-checked=true]').dataset.v,
    });
  };
}
