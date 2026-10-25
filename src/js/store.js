'use strict';
// ---------------------------------------------------------------------------
// Progress store. Each practised item (a note read in a clef, a key, a key signature...)
// sits in a Leitner-style box 0..5. Boxes drive both what you see next and the mastery bars.
// Persists to localStorage when available, otherwise lives in memory for the session.
// ---------------------------------------------------------------------------
const Store = (() => {
  const KEY = 'landmark-piano:v1';
  const DEFAULTS = {
    sound: true, volume: 0.8, guides: 'auto', hints: true, keyLabels: 'auto', theme: 'auto', length: 20,
  };
  let data = { items: {}, settings: {}, best: {}, days: {}, totals: { q: 0, ok: 0 } };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) data = Object.assign(data, JSON.parse(raw));
  } catch (e) { /* storage unavailable: keep in memory */ }

  let timer = null;
  function save() {
    clearTimeout(timer);
    timer = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* ignore */ } }, 250);
  }

  const MASTERED = 3;
  const get = id => data.items[id] || null;
  const box = id => (data.items[id] ? data.items[id].b : 0);
  const seen = id => !!(data.items[id] && data.items[id].n);

  function rec(id, ok, ms, hinted) {
    const it = data.items[id] || (data.items[id] = { b: 0, n: 0, c: 0, ms: 0, t: 0 });
    it.n++;
    if (ok) it.c++;
    it.ms = it.ms ? Math.round(it.ms * 0.7 + ms * 0.3) : Math.round(ms);
    it.t = Date.now();
    if (ok) { if (!hinted && ms < 12000) it.b = Math.min(5, it.b + 1); }
    else it.b = Math.max(0, it.b - 2);
    data.totals.q++;
    if (ok) data.totals.ok++;
    const day = new Date().toISOString().slice(0, 10);
    data.days[day] = (data.days[day] || 0) + 1;
    save();
  }
  function weight(id) {
    const it = data.items[id];
    if (!it || !it.n) return 3.2;
    const accPenalty = it.n >= 2 ? (1 - it.c / it.n) * 2 : 0;
    return 0.5 + (5 - it.b) * 0.9 + accPenalty;
  }
  /** Share of the given ids that are mastered (box >= 3). */
  function mastery(ids) {
    if (!ids.length) return 0;
    return ids.filter(id => box(id) >= MASTERED).length / ids.length;
  }
  const started = ids => ids.some(seen);
  function setBest(key, v) { if (v > (data.best[key] || 0)) { data.best[key] = v; save(); return true; } return false; }
  const best = key => data.best[key] || 0;

  const setting = k => (data.settings[k] === undefined ? DEFAULTS[k] : data.settings[k]);
  function setSetting(k, v) { data.settings[k] = v; save(); }
  function reset() { data = { items: {}, settings: data.settings, best: {}, days: {}, totals: { q: 0, ok: 0 } }; save(); }
  return { get, box, seen, rec, weight, mastery, started, setBest, best, setting, setSetting, reset, MASTERED, all: () => data };
})();
