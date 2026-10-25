// The moving parts of the key action, drawn from the model's pose. Used twice: at build time
// for the resting pose, and in the page on every frame. k = iso-kit, G = lathe, M = model.
// Everything lives in lanes along y: lane A (the key, wippen, jack, hammer) is centred on y = 0;
// lane B (damper lever, spoon, wire) sits just in front of it.
export const makeParts = (k, G, M) => {
  const C = M.C;
  const LANE = { key: [-12, 12], wippen: [-6, 6], jack: [-3, 3], lever: [3.4, 6.4], shank: [-3, 3], butt: [-4, 4], head: [-7, 7], damper: [-11.6, -6.8], wire: -9.2 };
  const STRINGS = { x: [-100, 150], y: [-3, 0, 3], r: 0.9 };
  const frame = (y0) => G.frameOf([0, y0, 0], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
  const S = (paths, style) => k.solidSvg(paths, style);
  const L = (d, style) => k.lineSvg(d, style);
  const place = (pts, angle, at) => pts.map((p) => M.add(at, M.rot(angle, p)));
  const box = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  const prism = (P, pts, [y0, y1]) => G.prismOf(frame(y0), pts, 0, y1 - y0, P);
  /** A disc whose axis runs along y, centred at world (x, z). */
  const wheel = (P, [x, z], r, [y0, y1], style = {}) => {
    const F = G.frameAlong([x, y0, z], [0, 1, 0]);
    return { paths: G.disc(0, y1 - y0, r, F, P, style), F, s: y1 - y0 };
  };
  const ringOn = (P, wh, r, steps = 28) => k.lineSvg(G.circleOf(wh.F, wh.s, r, P, steps), { tone: "faint" });

  // ---- key, capstan, spoon ----------------------------------------------------------------
  function key(P, pose) {
    const a = -pose.phi, at = C.pivot;
    const out = [];
    out.push(S(prism(P, place([[-135, 0], [185, 0], [190, 3], [190, 12], [184, 14], [-135, 14]], a, at), LANE.key), { tone: "mid" }));
    out.push(S(prism(P, place(box(20, 14, 189, 15.4), a, at), [-12.4, 12.4]), { tone: "hi", crease: "lo" }));
    // key front weight pocket and rear felt
    out.push(S(prism(P, place(box(-135, -1.2, -116, 0), a, at), [-10, 10]), { tone: "lo", crease: "none" }));
    // capstan screw, tilted with the key
    const o = M.onKey(pose.phi, [C.capstan[0], 14]);
    const up = [Math.sin(pose.phi), 0, Math.cos(pose.phi)];
    const F = G.frameAlong([o[0], 0, o[1]], up);
    out.push(S(G.solidOf([[0, 4.6], [2, 4.6], [2, 2.8], [7.6, 2.8], [8.6, 1.8], [9, 0.8]], F, P), { tone: "hi", crease: "lo" }));
    // damper spoon (lane B)
    out.push(S(prism(P, place(box(-98, 14, -94, 18), a, at), LANE.damper), { tone: "hi", crease: "lo" }));
    return out.join("");
  }

  // ---- wippen with its heel felt, jack cheeks and repetition lever -----------------------------
  const wippenAt = (pose) => ({ origin: C.wippen, angle: pose.psi });
  function leverTilt(pose, theta) {
    // the spring-loaded lever gives way when the roller sits on it
    const hinge = [116, 10], pad = [C.jackAt + C.toe[0] + C.leverAhead, C.wippenHalf + C.toe[1] - C.lever];
    const arm = M.sub(pad, hinge);
    const R = M.rollerAt(theta);
    const padAt = (lambda) => M.add(M.add(C.wippen, M.rot(pose.psi, hinge)), M.rot(pose.psi + lambda, arm));
    const dist = (lambda) => Math.hypot(...M.sub(R, padAt(lambda))) - C.rollerR;
    if (dist(0) >= 0 || R[1] < padAt(0)[1]) return 0;
    let lo = -0.6, hi = 0;
    for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (dist(mid) > 0) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  }
  function wippen(P, pose, theta) {
    const { origin, angle } = wippenAt(pose);
    const out = [];
    out.push(S(prism(P, place(box(0, -5, 150, 5), angle, origin), LANE.wippen), { tone: "mid" }));
    out.push(S(prism(P, place(box(41, -5.8, 49, -5), angle, origin), [-5, 5]), { tone: "lo", crease: "none" }));
    // jack cheeks either side of the jack
    for (const lane of [[-5, -3], [3, 5]]) out.push(S(prism(P, place(box(134, 5, 146, 12), angle, origin), lane), { tone: "mid" }));
    // repetition lever
    const lambda = leverTilt(pose, theta);
    const hinge = [116, 10], pad = [C.jackAt + C.toe[0] + C.leverAhead, C.wippenHalf + C.toe[1] - C.lever];
    const base = M.add(origin, M.rot(angle, hinge));
    const tip = M.add(base, M.rot(angle + lambda, M.sub(pad, hinge)));
    const dir = M.sub(tip, base), n = Math.hypot(...dir), u = [dir[0] / n, dir[1] / n], v = [-u[1], u[0]];
    const poly = [M.add(base, [-v[0] * 2, -v[1] * 2]), M.add(tip, [-v[0] * 1.4, -v[1] * 1.4]), M.add(tip, [v[0] * 1.4, v[1] * 1.4]), M.add(base, [v[0] * 2, v[1] * 2])];
    out.push(S(prism(P, poly, LANE.lever), { tone: "mid" }));
    const padCap = M.add(tip, [u[0] * 0.6, u[1] * 0.6]);
    out.push(S(prism(P, [M.add(padCap, [-2.4, -1.1]), M.add(padCap, [2.4, -1.1]), M.add(padCap, [2.4, 0.3]), M.add(padCap, [-2.4, 0.3])], LANE.lever), { tone: "hi", crease: "none" }));
    return out.join("");
  }

  // ---- jack -------------------------------------------------------------------------------------
  function jack(P, pose) {
    const at = pose.J, a = pose.psi + pose.chi;
    const out = [];
    out.push(S(prism(P, place([[-17, 0], [-3, 0], [-3, 3.5], [-17, 3.5]], a, at), LANE.jack), { tone: "mid" }));
    out.push(S(prism(P, place([[-3, -6], [3, -6], [3, 26], [1.8, 30], [-1, 30], [-3, 26]], a, at), LANE.jack), { tone: "hi", crease: "lo" }));
    const pin = wheel(P, at, 1.9, [-5.5, 5.5]);
    out.push(S(pin.paths, { tone: "mid" }));
    out.push(ringOn(P, pin, 0.8, 12));
    return out.join("");
  }

  // ---- hammer, roller, head -------------------------------------------------------------------------
  function hammer(P, theta) {
    const at = C.flange, out = [];
    out.push(S(prism(P, place([[-12, -6], [16, -6], [16, 6], [-12, 6]], theta, at), LANE.butt), { tone: "mid" }));
    out.push(S(prism(P, place([[0, -3.5], [C.shank, -2], [C.shank, 2], [0, 3.5]], theta, at), LANE.shank), { tone: "hi", crease: "lo" }));
    const roller = wheel(P, M.rollerAt(theta), C.rollerR, [-4, 4]);
    out.push(S(roller.paths, { tone: "mid" }));
    out.push(ringOn(P, roller, 3.6, 24));
    const head = wheel(P, M.headAt(theta), C.head, LANE.head);
    out.push(S(head.paths, { tone: "hi", crease: "lo", lit: true }));
    out.push(ringOn(P, head, 8, 36));
    out.push(ringOn(P, head, 3.6, 24));
    return out.join("");
  }

  // ---- strings, with a standing wave after a strike ------------------------------------------------
  function strings(P, wave) {
    const [x0, x1] = STRINGS.x, z = C.stringZ;
    let d = "";
    for (const y of STRINGS.y) {
      const pts = [];
      for (let i = 0; i <= 28; i++) {
        const t = i / 28, x = x0 + (x1 - x0) * t;
        const dz = wave.amp * Math.sin(Math.PI * t) * Math.sin(wave.phase + y * 0.4);
        pts.push(k.iso([x, y, z + dz], P));
      }
      d += k.pathOf(pts);
    }
    return `<path class="iso-line" data-tone="hi" d="${d}" style="stroke-width:1.15"/>`;
  }

  // ---- damper: lever and wire sit behind the main lane, the felt on the strings ------------------
  function damperLow(P, pose) {
    const out = [];
    const at = C.damperPivot, tip = C.damperWire - at[0];
    out.push(S(prism(P, place(box(0, -3, tip + 8, 3), pose.eta, at), LANE.damper), { tone: "mid" }));
    const top = pose.wire[1] + 3;
    const felt = C.stringZ + STRINGS.r + pose.damperLift;
    out.push(S(k.cylinder(pose.wire[0], LANE.wire, 1.1, top, felt + 12 - top, P, 12), { tone: "mid", crease: "none" }));
    return out.join("");
  }
  function damperHead(P, pose) {
    const felt = C.stringZ + STRINGS.r + pose.damperLift, x = pose.wire[0];
    return S(prism(P, [[x - 13, felt], [x + 13, felt], [x + 10, felt + 11], [x - 10, felt + 11]], [-12.8, 5.4]), { tone: "hi", crease: "lo" });
  }

  return { LANE, STRINGS, key, wippen, jack, hammer, strings, damperLow, damperHead, leverTilt };
};
