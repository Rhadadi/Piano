'use strict';
// ---------------------------------------------------------------------------
// On-screen piano keyboard (SVG). Keys carry data-m = MIDI number.
//   mount(el, { lo, hi, labels: 'none'|'c'|'landmarks'|'all', groups, onPress, minKey, maxKey })
// Returns { mark(m, state), clear(), flash(m), scrollTo(m), range }.
// ---------------------------------------------------------------------------
const Keyboard = (() => {
  const WK = 36, KH = 150, BH = 94, BW = 22;
  const BLACK_OFFSET = { 1: -0.08, 3: 0.08, 6: -0.1, 8: 0, 10: 0.1 };
  const LM_BY_MIDI = Object.fromEntries(LANDMARKS.map(l => [l.midi, l]));

  function mount(el, o) {
    let lo = o.lo, hi = o.hi;
    while (isBlackMidi(lo)) lo--;
    while (isBlackMidi(hi)) hi++;
    const whites = [], blacks = [];
    for (let m = lo; m <= hi; m++) (isBlackMidi(m) ? blacks : whites).push(m);
    const widx = {};
    whites.forEach((m, i) => (widx[m] = i));
    const W = whites.length * WK;
    const labels = o.labels || 'none';
    let svg = '';
    whites.forEach(m => {
      const pc = ((m % 12) + 12) % 12;
      const grp = o.groups ? (pc <= 4 ? ' g2' : ' g3') : '';
      svg += `<rect class="wk${grp}" data-m="${m}" x="${widx[m] * WK}" y="0" width="${WK}" height="${KH}" rx="3"/>`;
    });
    // labels and landmark dots
    whites.forEach(m => {
      const pc = ((m % 12) + 12) % 12, l = PCS.indexOf(pc), oct = Math.floor(m / 12) - 1;
      const cx = widx[m] * WK + WK / 2;
      const lm = LM_BY_MIDI[m];
      let txt = '';
      if (labels === 'all') txt = LETTERS[l] + (l === 0 ? oct : '');
      else if (labels === 'c' && l === 0) txt = 'C' + oct;
      else if (labels === 'landmarks' && lm) txt = LETTERS[l] + oct;
      if (labels === 'landmarks' && lm) svg += `<circle class="lm-dot" cx="${cx}" cy="${KH - 38}" r="5"/>`;
      if (txt) svg += `<text class="kl${lm && labels !== 'all' ? ' lm' : ''}" x="${cx}" y="${KH - 10}" text-anchor="middle" data-m="${m}">${txt}</text>`;
    });
    blacks.forEach(m => {
      const pc = ((m % 12) + 12) % 12;
      const below = widx[m - 1];
      const cx = (below + 1) * WK + BLACK_OFFSET[pc] * WK;
      svg += `<rect class="bk" data-m="${m}" x="${cx - BW / 2}" y="0" width="${BW}" height="${BH}" rx="2.5"/>`;
    });

    const minKey = o.minKey || 32, maxKey = o.maxKey || 50;
    el.innerHTML =
      `<div class="kb-scroll"><div class="kb-inner" style="min-width:${whites.length * minKey}px;max-width:${whites.length * maxKey}px">` +
      `<svg class="kb-svg" viewBox="0 0 ${W} ${KH}" role="group" aria-label="Piano keyboard">${svg}</svg></div></div>`;
    const root = el.querySelector('svg');
    const scroller = el.querySelector('.kb-scroll');
    const keyEl = {}, lblEl = {};
    root.querySelectorAll('[data-m]').forEach(k => { if (k.tagName === 'rect') keyEl[k.dataset.m] = k; else lblEl[k.dataset.m] = k; });

    root.addEventListener('pointerdown', e => {
      const t = e.target.closest('[data-m]');
      if (!t) return;
      e.preventDefault();
      const m = +t.dataset.m;
      flash(m);
      if (o.onPress) o.onPress(m);
    });

    function mark(m, state) {
      const k = keyEl[m];
      if (!k) return;
      const l = lblEl[m];
      if (state) { k.setAttribute('data-s', state); if (l) l.setAttribute('data-s', state); }
      else { k.removeAttribute('data-s'); if (l) l.removeAttribute('data-s'); }
    }
    function clear() { Object.values(keyEl).forEach(k => k.removeAttribute('data-s')); Object.values(lblEl).forEach(k => k.removeAttribute('data-s')); }
    function flash(m) {
      const k = keyEl[m];
      if (!k) return;
      k.classList.add('down');
      setTimeout(() => k.classList.remove('down'), 160);
    }
    function scrollTo(m) {
      const k = keyEl[m];
      if (!k) return;
      const inner = el.querySelector('.kb-inner');
      const frac = (+k.getAttribute('x') + WK / 2) / W;
      scroller.scrollLeft = frac * inner.scrollWidth - scroller.clientWidth / 2;
    }
    function scrollBy(dir) { scroller.scrollBy({ left: dir * scroller.clientWidth * 0.7, behavior: 'smooth' }); }
    return { mark, clear, flash, scrollTo, scrollBy, range: [lo, hi], el, scroller };
  }
  return { mount };
})();
