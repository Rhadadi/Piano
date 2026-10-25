'use strict';
// ---------------------------------------------------------------------------
// Sound: a small additive piano-ish synth on Web Audio, plus optional Web MIDI input.
// ---------------------------------------------------------------------------
const Sound = (() => {
  let ctx = null, master = null, enabled = true, volume = 0.8;
  let voices = 0;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try {
        ctx = new AC();
        const comp = ctx.createDynamicsCompressor();
        master = ctx.createGain();
        master.gain.value = volume * 0.5;
        master.connect(comp);
        comp.connect(ctx.destination);
      } catch (e) { ctx = null; return null; }
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  const PARTIALS = [[1, 1, 1], [2, 0.5, 0.7], [3, 0.26, 0.5], [4, 0.14, 0.38], [5, 0.07, 0.3], [6, 0.04, 0.25]];
  function play(m, o = {}) {
    if (!enabled) return;
    const c = ensure();
    if (!c || voices > 28) return;
    const t = c.currentTime + (o.delay || 0);
    const f = 440 * Math.pow(2, (m - 69) / 12);
    const dur = o.dur || Math.max(0.9, 2.6 - (m - 21) / 45);
    const vel = (o.vel || 0.7) * 0.55;
    const out = c.createGain();
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = Math.min(9000, f * 6 + 700);
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(vel, t + 0.005);
    out.gain.exponentialRampToValueAtTime(vel * 0.4, t + 0.35);
    out.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    out.connect(lp);
    lp.connect(master);
    voices++;
    PARTIALS.forEach(([mult, amp, decay], i) => {
      if (f * mult > 12000) return;
      [0, 1.4].forEach(cents => {
        if (i > 0 && cents) return;
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = 'sine';
        osc.frequency.value = f * mult;
        osc.detune.value = cents;
        g.gain.setValueAtTime(amp * (cents ? 0.6 : 1), t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur * decay);
        osc.connect(g);
        g.connect(out);
        osc.start(t);
        osc.stop(t + dur + 0.05);
        if (i === 0 && cents) osc.onended = () => { voices--; };
      });
    });
  }
  function playSeq(ms, gap = 0.28) { ms.forEach((m, i) => play(m, { delay: i * gap, dur: 1.2 })); }
  function playChord(ms) { ms.forEach(m => play(m, { dur: 1.8, vel: 0.55 })); }

  // --- MIDI input ---
  let midiAccess = null, midiHandler = null, midiNames = [];
  async function connectMIDI(onNote) {
    midiHandler = onNote;
    if (!navigator.requestMIDIAccess) return { ok: false, msg: 'This browser does not support Web MIDI. Try Chrome or Edge.' };
    try {
      midiAccess = midiAccess || await navigator.requestMIDIAccess();
      const attach = () => {
        midiNames = [];
        midiAccess.inputs.forEach(inp => {
          midiNames.push(inp.name);
          inp.onmidimessage = e => {
            const [s, d1, d2] = e.data;
            if ((s & 0xf0) === 0x90 && d2 > 0 && midiHandler) midiHandler(d1);
          };
        });
      };
      attach();
      midiAccess.onstatechange = attach;
      return midiNames.length
        ? { ok: true, msg: 'Connected: ' + midiNames.join(', ') }
        : { ok: true, msg: 'MIDI is on, but no keyboard was found. Plug one in and it will connect.' };
    } catch (e) {
      return { ok: false, msg: 'MIDI access was blocked. You can still use the on-screen keys.' };
    }
  }
  const setMidiHandler = fn => { midiHandler = fn; };

  return {
    play, playSeq, playChord, ensure, connectMIDI, setMidiHandler,
    get enabled() { return enabled; },
    set enabled(v) { enabled = v; },
    setVolume(v) { volume = v; if (master) master.gain.value = v * 0.5; },
  };
})();
