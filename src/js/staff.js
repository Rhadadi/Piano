'use strict';
// ---------------------------------------------------------------------------
// Staff renderer. Produces an inline SVG string from a description:
//   clef: 'treble' | 'bass' | 'alto' | 'tenor' | 'grand'
//   cols: [[item, ...], ...]  each column is one beat; several items in a column form a chord
//         item = { n: note, clef?, state?, label?, ghost? }
//   keySig: integer (+sharps / -flats), guides: draw landmark labels, extent: { treble:[lo,hi], ... }
//   ottava: { text:'8va', side:'above'|'below', from, to }, onPick: click handler for empty rows
// ---------------------------------------------------------------------------
const Staff = (() => {
  const S = 12, H = S / 2, K = S / 250;
  const CLEF_GLYPH = { treble: ['gClef', 2], bass: ['fClef', 6], alto: ['cClef', 4], tenor: ['cClef', 6] };
  const KS_POS = {
    treble: { sharp: [8, 5, 9, 6, 3, 7, 4], flat: [4, 7, 3, 6, 2, 5, 1] },
    bass: { sharp: [6, 3, 7, 4, 1, 5, 2], flat: [2, 5, 1, 4, 0, 3, -1] },
  };
  const f = v => Math.round(v * 10) / 10;
  const gp = (name, x, y, cls) =>
    `<path${cls ? ` class="${cls}"` : ''} d="${GLYPHS[name].d}" transform="translate(${f(x)} ${f(y)}) scale(${K} ${-K})"/>`;
  const gw = name => GLYPHS[name].w * K;

  function render(o) {
    const grand = o.clef === 'grand';
    const staves = grand ? ['treble', 'bass'] : [o.clef];
    const cols = (o.cols || []).map(col => col.map(it => Object.assign({}, it)));
    const ks = o.keySig || 0;
    const ext = {};
    staves.forEach(c => (ext[c] = { lo: 0, hi: 8 }));

    // Resolve each item's staff and position; grow the vertical extent to fit.
    cols.forEach(col => {
      const chord = col.length > 1;
      col.forEach(it => {
        it.clef = it.clef || (grand ? (stepOf(it.n) >= 28 ? 'treble' : 'bass') : o.clef);
        it.pos = posOf(it.n, it.clef);
        it.whole = o.whole || chord || it.whole;
        const e = ext[it.clef];
        e.lo = Math.min(e.lo, it.pos - 1);
        e.hi = Math.max(e.hi, it.pos + 1);
        if (!it.whole) {
          const up = it.pos < 4;
          if (up) e.hi = Math.max(e.hi, it.pos + 8); else e.lo = Math.min(e.lo, it.pos - 8);
        }
      });
    });
    staves.forEach(c => {
      const x = (o.extent || {})[c];
      if (x) { ext[c].lo = Math.min(ext[c].lo, x[0]); ext[c].hi = Math.max(ext[c].hi, x[1]); }
      if (o.onPick) { ext[c].lo = Math.min(ext[c].lo, -4); ext[c].hi = Math.max(ext[c].hi, 12); }
    });

    // ----- vertical layout -----
    const ottAbove = o.ottava && o.ottava.side === 'above';
    const ottBelow = o.ottava && o.ottava.side === 'below';
    const topPad = 10 + (ottAbove ? 24 : 0);
    const Y = {}; // per clef: y of bottom line (pos 0)
    if (grand) {
      const t = ext.treble, b = ext.bass;
      const top8 = topPad + Math.max(0, t.hi - 8) * H;
      Y.treble = top8 + 8 * H;
      const gap = Math.max(8, Math.max(0, -t.lo) + Math.max(0, b.hi - 8) + 4);
      Y.bass = Y.treble + gap * H + 8 * H;
    } else {
      const c = staves[0];
      Y[c] = topPad + Math.max(0, ext[c].hi - 8) * H + 8 * H;
    }
    const lastC = staves[staves.length - 1];
    const bottomEdge = Y[lastC] + Math.max(0, -ext[lastC].lo) * H;
    const labelRow = cols.some(col => col.some(it => it.label));
    const height = bottomEdge + 10 + (ottBelow ? 24 : 0) + (labelRow ? 18 : 0);
    const topEdge = Y[staves[0]] - 8 * H;
    const yOf = (c, pos) => Y[c] - pos * H;

    // ----- horizontal layout -----
    const x0 = grand ? 34 : 10;
    let x = x0 + 8;
    const clefW = Math.max(...staves.map(c => gw(CLEF_GLYPH[c][0])));
    const clefX = x;
    x += clefW + 8;
    const ksX = x;
    if (ks && KS_POS[staves[0]]) {
      const g = ks > 0 ? 'sharp' : 'flat';
      x += Math.abs(ks) * (gw(g) + 3.5);
    }
    x += 10;
    const colStart = x;
    const nCol = Math.max(1, cols.length);
    const colW = o.colW || (nCol <= 1 ? 130 : 46);
    const area = nCol * colW;
    let x1 = colStart + area + 6;
    if (x1 < 270) x1 = 270;
    const guideW = o.guides ? 72 : 10;
    const width = x1 + guideW;
    const cxOf = i => colStart + (i + 0.5) * (x1 - 6 - colStart) / nCol;

    let svg = '';
    // staff lines
    staves.forEach(c => {
      for (let i = 0; i < 5; i++) {
        const y = yOf(c, i * 2);
        svg += `<line class="ln" x1="${x0}" x2="${x1}" y1="${f(y)}" y2="${f(y)}"/>`;
      }
    });
    // system barline, brace, end barline
    svg += `<line class="bar" x1="${x0}" x2="${x0}" y1="${f(topEdge)}" y2="${f(Y[lastC])}"/>`;
    svg += `<line class="bar" x1="${x1}" x2="${x1}" y1="${f(topEdge)}" y2="${f(Y[lastC])}"/>`;
    if (grand) {
      const sy = (Y.bass - topEdge) / GLYPHS.brace.b[3];
      svg += `<path class="brace" d="${GLYPHS.brace.d}" transform="translate(${x0 - 17} ${f(Y.bass)}) scale(${f(14 / GLYPHS.brace.w)} ${-sy.toFixed(4)})"/>`;
    }
    // clefs and key signature
    staves.forEach(c => {
      const [g, line] = CLEF_GLYPH[c];
      svg += gp(g, clefX, yOf(c, line), 'clef');
      if (ks && KS_POS[c]) {
        const kind = ks > 0 ? 'sharp' : 'flat';
        const ps = KS_POS[c][kind];
        let kx = ksX;
        for (let i = 0; i < Math.abs(ks); i++) {
          svg += gp(kind, kx, yOf(c, ps[i]), 'ksig');
          kx += gw(kind) + 3.5;
        }
      }
    });

    // landmark guides
    if (o.guides) {
      staves.forEach(c => {
        LANDMARKS.forEach(l => {
          if (!l.tags.includes(c)) return;
          const pos = posOf(l.note, c);
          if (pos < ext[c].lo + 0.5 || pos > ext[c].hi - 0.5) return;
          const y = yOf(c, pos);
          const ledger = pos < 0 || pos > 8;
          const xa = ledger ? x1 - 36 : x0;
          svg += `<line class="guide" x1="${xa}" x2="${x1}" y1="${f(y)}" y2="${f(y)}"/>`;
          svg += `<text class="guide-lbl" x="${x1 + 6}" y="${f(y + 3.5)}">${l.name}</text>`;
        });
      });
    }

    // click targets (under the notes)
    let hits = '';
    if (o.onPick) {
      staves.forEach(c => {
        for (let p = ext[c].lo; p <= ext[c].hi; p++) {
          hits += `<rect class="hit" data-clef="${c}" data-pos="${p}" x="${x0}" y="${f(yOf(c, p) - H)}" width="${f(x1 - x0)}" height="${H * 2}"/>`;
        }
      });
    }

    // notes (ledger lines first so heads sit on top)
    let ledSvg = '', noteSvg = '';
    const labelY = height - 6;
    cols.forEach((col, ci) => {
      const cx = cxOf(ci);
      const byClef = {};
      col.forEach(it => (byClef[it.clef] = byClef[it.clef] || []).push(it));
      Object.keys(byClef).forEach(c => {
        const items = byClef[c].slice().sort((a, b) => a.pos - b.pos);
        // displaced seconds
        items.forEach((it, i) => {
          const prev = items[i - 1];
          it.disp = !!(prev && it.pos - prev.pos === 1 && !prev.disp);
        });
        // ledger lines (union across the chord)
        const lo = items[0].pos, hi = items[items.length - 1].pos;
        const hwMax = Math.max(...items.map(it => gw(it.whole ? 'whole' : 'black')));
        const anyDisp = items.some(it => it.disp);
        const lx1 = cx - hwMax / 2 - 4, lx2 = cx + hwMax / 2 + 4 + (anyDisp ? hwMax : 0);
        let led = '';
        for (let q = -2; q >= lo; q -= 2) led += `<line class="ledger" x1="${f(lx1)}" x2="${f(lx2)}" y1="${f(yOf(c, q))}" y2="${f(yOf(c, q))}"/>`;
        for (let q = 10; q <= hi; q += 2) led += `<line class="ledger" x1="${f(lx1)}" x2="${f(lx2)}" y1="${f(yOf(c, q))}" y2="${f(yOf(c, q))}"/>`;
        // accidental columns (stagger when close vertically)
        const accItems = items.filter(it => (it.n.a !== 0 && !it.n.hide) || it.n.nat).sort((a, b) => b.pos - a.pos);
        const accCols = [];
        accItems.forEach(it => {
          let k = accCols.findIndex(last => last - it.pos >= 6);
          if (k < 0) { k = accCols.length; accCols.push(it.pos); } else accCols[k] = it.pos;
          it.accCol = k;
        });
        // draw each note
        items.forEach(it => {
          const hn = it.whole ? 'whole' : 'black';
          const hw = gw(hn);
          const hx = cx - hwMax / 2 + (it.disp ? hwMax : 0) + (hwMax - hw) / 2;
          const y = yOf(c, it.pos);
          let g = '';
          g += gp(hn, hx, y);
          if (!it.whole) {
            const up = it.pos < 4;
            let end = up ? Math.max(it.pos + 7, 4) : Math.min(it.pos - 7, 4);
            const sx = up ? hx + hw - 0.7 : hx + 0.7;
            g += `<line class="stem" x1="${f(sx)}" x2="${f(sx)}" y1="${f(y)}" y2="${f(yOf(c, end))}"/>`;
          }
          if (it.accCol !== undefined) {
            const a = it.n.a !== 0 ? it.n.a : 0;
            const gname = ACC_GLYPH[a];
            const aw = gw(gname);
            const ax = cx - hwMax / 2 - 4 - aw - it.accCol * 14;
            g += gp(gname, ax, y, 'accg');
          }
          const cls = `note st-${it.state || 'ink'}${it.ghost ? ' ghost' : ''}`;
          noteSvg += `<g class="${cls}">${g}</g>`;
          if (it.label) noteSvg += `<text class="lbl" x="${f(cx)}" y="${f(labelY)}" text-anchor="middle">${it.label}</text>`;
        });
        ledSvg += led;
      });
    });

    svg += hits + ledSvg + noteSvg;

    // ottava bracket
    if (o.ottava) {
      const ot = o.ottava;
      const xa = cxOf(ot.from) - 14, xb = cxOf(ot.to) + 16;
      const y = ottAbove ? topPad - 14 : bottomEdge + 18;
      const hook = ottAbove ? 7 : -7;
      svg += `<text class="ott-lbl" x="${f(xa)}" y="${f(y + (ottAbove ? 4 : 4))}">${ot.text}</text>`;
      svg += `<polyline class="ott" points="${f(xa + 30)},${f(y)} ${f(xb)},${f(y)} ${f(xb)},${f(y + hook)}"/>`;
    }

    const aria = o.aria || 'Music staff';
    const html = `<svg class="staff-svg" viewBox="0 0 ${f(width)} ${f(height)}" role="img" aria-label="${aria}" preserveAspectRatio="xMidYMid meet">${svg}</svg>`;
    return { html, w: width, h: height };
  }

  function mount(el, o) {
    const r = render(o);
    el.innerHTML = `<div class="staff-wrap" style="max-width:${Math.round(r.w * (o.scale || 1.5))}px">${r.html}</div>`;
    if (o.onPick) {
      el.querySelector('svg').addEventListener('click', e => {
        const t = e.target.closest('.hit');
        if (t) o.onPick(+t.dataset.pos, t.dataset.clef);
      });
    }
    return r;
  }
  return { render, mount };
})();
