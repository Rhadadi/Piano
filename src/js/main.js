'use strict';
// ---------------------------------------------------------------------------
// Boot: wire navigation, keyboard shortcuts, MIDI routing and the first view.
// ---------------------------------------------------------------------------
const App = {
  /** A piano key was pressed on screen or on a MIDI keyboard. */
  onKey(m, fromMidi) {
    if (S && S.q) {
      if (fromMidi && S.kb) S.kb.flash(m);
      handleKey(m);
    } else {
      Sound.play(m);
      if (tab === 'explore' && fromMidi) explorePick(m);
    }
  },
};

(function boot() {
  applySettings();
  initSettings();
  Sound.setMidiHandler(m => App.onKey(m, true));
  // the interactive machines announce notes (a tapped key, a hammer striking)
  document.addEventListener('anatomy:note', e => Sound.play(e.detail.midi, { vel: e.detail.velocity || 0.7 }));
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', syncIso);
  $('#nav').addEventListener('click', e => { const b = e.target.closest('button'); if (b) go(b.dataset.tab); });
  $('.brand').addEventListener('click', e => { e.preventDefault(); go('learn'); });
  document.addEventListener('pointerdown', () => Sound.ensure(), { once: true });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (!$('#sheet').hidden) return closeSheet();
      if (S) return go('drill');
    }
    if (!$('#sheet').hidden) return;
    if (drillKeydown(e)) return;
    if (lessonState && tab === 'learn' && $('.lesson')) {
      if (e.key === 'ArrowRight' && $('#les-next')) $('#les-next').click();
      if (e.key === 'ArrowLeft' && !$('#les-prev').disabled) $('#les-prev').click();
    }
  });
  window.addEventListener('hashchange', () => { const t = location.hash.slice(1); if (TABS.includes(t) && t !== tab) go(t); });
  const first = location.hash.slice(1);
  go(TABS.includes(first) ? first : 'learn');
})();
