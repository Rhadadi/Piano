// Truth model for the key-action figure: a planar linkage in the x-z plane (x toward the player,
// z up, millimetres, seconds). Everything the figure draws and every number it reads comes from
// here. Angles are counter-clockwise in (x, z). Inlined into the page, so it exports one object.
export const MODEL = (() => {
  const C = {
    // key: a see-saw on the balance rail
    pivot: [0, 15], front: 190, rear: 135, dip: 10, keyTop: 14,
    capstan: [-105, 23], // contact point, key frame relative to the pivot
    spoon: [-96, 18], // damper spoon top, key frame
    // wippen: hinged at the rear, rests on the capstan
    wippen: [-150, 40], wippenHalf: 5, jackAt: 140,
    // jack: pivots on the wippen; toe under the hammer roller, tail under the let-off button
    toe: [1.5, 30], tail: [-17, 3.5], contactDip: 5.8, toeOffset: 0,
    // hammer: pivots on its flange; roller under the shank; felt head at the end
    flange: [0, 0], shank: 100, head: 12, roller: [16, -5], rollerR: 6, rest: (-5 * Math.PI) / 180, strike: (22.5 * Math.PI) / 180,
    // repetition lever: a pad on the wippen at the toe, just under it, that the roller falls back onto
    lever: 0.3, leverAhead: 4, holdBelow: 0.055,
    // damper: lever lifted by the spoon, wire up to a felt on the strings
    damperPivot: [-150, 37], damperWire: -68, damperHalf: 3, spoonGap: 1.6, damperLift: 0,
    stringZ: 0,
    gravity: 70, // rad/s^2 on the hammer, about g over 0.14 m
    bounce: 0.38, // share of the speed kept at the string
  };
  const rot = (a, [x, z]) => [x * Math.cos(a) - z * Math.sin(a), x * Math.sin(a) + z * Math.cos(a)];
  const add = (p, q) => [p[0] + q[0], p[1] + q[1]];
  const sub = (p, q) => [p[0] - q[0], p[1] - q[1]];
  const dot = (p, q) => p[0] * q[0] + p[1] * q[1];
  const bisect = (f, lo, hi, n = 40) => {
    let a = lo, b = hi, fa = f(a);
    for (let i = 0; i < n; i++) {
      const m = (a + b) / 2, fm = f(m);
      if ((fm > 0) === (fa > 0)) { a = m; fa = fm; } else b = m;
    }
    return (a + b) / 2;
  };

  /** Where the key-frame point lies once the key has dipped. */
  const onKey = (phi, local) => add(C.pivot, rot(-phi, local));
  const phiOf = (dip) => Math.asin(Math.min(Math.max(dip, 0), C.dip) / C.front);

  // wippen angle that keeps its underside on the capstan top
  const wippenAngle = (cap) => {
    const v = sub(cap, C.wippen);
    return bisect((psi) => -Math.sin(psi) * v[0] + Math.cos(psi) * v[1] + C.wippenHalf, -0.3, 0.4);
  };
  const jackPivot = (psi) => add(add(C.wippen, rot(psi, [C.jackAt, 0])), rot(psi, [0, C.wippenHalf]));

  const rest = (() => {
    const cap = onKey(0, C.capstan), psi = wippenAngle(cap);
    return { psi, J: jackPivot(psi) };
  })();
  // the let-off button hangs where the jack's tail first touches, at `contactDip`
  C.buttonZ = (() => {
    const psi = wippenAngle(onKey(phiOf(C.contactDip), C.capstan));
    return add(jackPivot(psi), rot(psi, C.tail))[1];
  })();
  // the hammer flange is placed so the roller sits exactly on the resting toe
  C.flange = (() => {
    const toe = add(rest.J, rot(rest.psi, C.toe));
    const R0 = [toe[0] - C.toeOffset, toe[1] + Math.sqrt(C.rollerR ** 2 - C.toeOffset ** 2)];
    return sub(R0, rot(C.rest, C.roller));
  })();
  C.stringZ = add(C.flange, rot(C.strike, [C.shank, 0]))[1] + C.head + 1;
  const jackTurn = (psi) => {
    const J = jackPivot(psi);
    const z = (chi) => add(J, rot(psi + chi, C.tail))[1] - C.buttonZ;
    return z(0) <= 0 ? 0 : bisect((chi) => -z(chi), 0, 0.6);
  };

  const rollerAt = (theta) => add(C.flange, rot(theta, C.roller));
  const headAt = (theta) => add(C.flange, rot(theta, [C.shank, 0]));

  // the hammer's lowest angle for each thing that can hold it up
  const floorOn = (T) => {
    // come down from above: the first angle at which the roller touches the point from above
    const g = (th) => Math.hypot(...sub(rollerAt(th), T)) - C.rollerR;
    const lo = C.rest - 0.02, hi = C.strike + 0.3, n = 80;
    let prev = hi;
    if (g(prev) <= 0) return -Infinity;
    for (let i = 1; i <= n; i++) {
      const th = hi + ((lo - hi) * i) / n;
      if (g(th) <= 0) {
        const root = bisect((t) => g(t), th, prev);
        const R = rollerAt(root);
        return Math.abs(R[0] - T[0]) < C.rollerR * 0.95 && R[1] > T[1] ? root : -Infinity;
      }
      prev = th;
    }
    return -Infinity;
  };
  // the spring-loaded lever gives way once the roller would carry it past the hold height
  const leverFloor = (P) => {
    const cap = C.strike - C.holdBelow;
    const th = floorOn(P);
    if (th > -Infinity) return Math.min(th, cap);
    const R = rollerAt(C.strike + 0.3);
    if (Math.hypot(...sub(R, P)) - C.rollerR <= 0 && Math.abs(R[0] - P[0]) < C.rollerR * 0.95) return cap;
    return -Infinity;
  };
  function floors(pose) {
    const pad = add(pose.J0, rot(pose.psi, [C.toe[0] + C.leverAhead, C.toe[1] - C.lever]));
    const jack = floorOn(pose.toe);
    let lever = leverFloor(pad);
    if (jack > -Infinity) lever = Math.min(lever, jack - 0.002); // while the jack pushes, the lever gives way under the roller
    return { rest: C.rest, jack, lever };
  }

  /** Pose of every driven part for a key dip (mm). */
  function pose(dip) {
    const phi = phiOf(dip);
    const cap = onKey(phi, C.capstan);
    const psi = wippenAngle(cap);
    const chi = jackTurn(psi);
    const J = jackPivot(psi);
    const toe = add(J, rot(psi + chi, C.toe));
    // damper lever: rests on its stop, or rides the spoon
    const spoon = onKey(phi, C.spoon);
    const lever = (eta) => rot(eta, [C.damperWire - C.damperPivot[0], 0]);
    const restSpoon = onKey(0, C.spoon);
    const eta0 = etaFor(restSpoon, C.spoonGap);
    const etaS = etaFor(spoon, 0);
    const eta = Math.max(eta0, etaS);
    const wire = add(C.damperPivot, lever(eta));
    const wire0 = add(C.damperPivot, lever(eta0));
    return { dip, phi, psi, chi, J, J0: J, toe, eta, eta0, damperLift: wire[1] - wire0[1], wire, spoon };
  }
  // lever angle whose underside passes through the point (with a clearance below it)
  function etaFor(point, clearance) {
    const v = sub(point, C.damperPivot);
    return bisect((e) => -Math.sin(e) * v[0] + Math.cos(e) * v[1] + C.damperHalf + clearance, -0.3, 0.4);
  }

  /** Hammer state: a free body with gravity, held up by whatever floor is highest. */
  const hammer = () => ({ theta: C.rest, omega: 0, struck: 0, speed: 0, phase: "rest", t: 0, floor: "rest" });
  function step(h, pose, dt) {
    const f = floors(pose);
    const levels = [["jack", f.jack], ["lever", f.lever], ["rest", f.rest]].sort((a, b) => b[1] - a[1]);
    const [name, level] = levels[0];
    let theta = h.theta + h.omega * dt;
    let omega = h.omega - C.gravity * Math.cos(Math.max(-0.5, Math.min(0.5, theta))) * dt;
    const releasing = h.dip !== undefined && pose.dip < h.dip - 1e-9;
    h.dip = pose.dip;
    let struck = false;
    if (theta >= C.strike) {
      if (omega > 0) { h.speed = omega * (C.shank / 1000); struck = true; omega = -C.bounce * omega; }
      theta = C.strike;
    }
    if (theta <= level + 1e-4) {
      // carried by a rising floor: take up its speed (never the size of a jump between floors)
      const before = h.levels && h.levels[name];
      const rate = before !== undefined && isFinite(before) && isFinite(level) ? (level - before) / dt : 0;
      omega = rate > 0 && !releasing ? rate : 0; // a rising floor on the way up lifts the hammer; on the way down it only resets under it
      theta = level;
      h.floor = name;
    } else h.floor = "air";
    h.levels = { jack: f.jack, lever: f.lever, rest: f.rest };
    h.theta = theta; h.omega = omega; h.t += dt;
    h.phase = h.floor === "air" ? (omega > 0 ? "flying" : "falling") : h.floor === "jack" ? "pushed" : h.floor === "lever" ? "held" : "rest";
    return { struck, floors: f };
  }
  const settleDip = (dip) => pose(dip);
  return { C, rot, add, sub, onKey, phiOf, pose, rollerAt, headAt, hammer, step, floors, jackPivot, wippenAngle, settleDip, rest };
})();
