// Landmark rail: nine tape reels stand on a rail of 29 white keys (C2 to C6). A carriage with a
// pointer and a step-counting dial slides along the keys; the reel of the nearest landmark pays
// its tape out to the carriage's hook, one tick per step. Run: node figures/landmark-rail/build.mjs
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../vendor/anatomy/kit/iso-kit.mjs";
import { emit } from "../lib/emit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const WIDTH = 720;
const HEIGHT = 300;

// ---- truth: white keys C2..C6 and the nine landmarks --------------------------------------
const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const N = 29;
const KP = 14; // white-key pitch
const X0 = -(N * KP) / 2;
const keyX = (i) => X0 + KP / 2 + KP * i;
const LANDMARKS = [
  { i: 0, name: "Low C" }, { i: 3, name: "Low F" }, { i: 7, name: "Bass C" }, { i: 10, name: "Bass F" },
  { i: 14, name: "Middle C" }, { i: 18, name: "Treble G" }, { i: 21, name: "Treble C" }, { i: 25, name: "High G" }, { i: 28, name: "High C" },
];
const noteName = (i) => LETTERS[i % 7] + (2 + Math.floor(i / 7));
const midiOf = (i) => 36 + [0, 2, 4, 5, 7, 9, 11][i % 7] + 12 * Math.floor(i / 7);
const routeOf = (i) => {
  const d = LANDMARKS.map((l) => Math.abs(l.i - i));
  const least = Math.min(...d);
  return LANDMARKS.map((l, j) => ({ j, d: d[j] })).filter((r) => r.d === least);
};
const FARTHEST = Math.max(...Array.from({ length: N }, (_, i) => routeOf(i)[0].d));
if (FARTHEST !== 2) throw new Error("caption says no key is more than 2 steps from a landmark, model says " + FARTHEST);

// ---- world --------------------------------------------------------------------------------------
const PLATE = { x: -226, y: -52, w: 452, d: 134, r: 9 };
const PLATE_H = 12;
const FOOT_H = 5;
const KEY_Y = 4, KEY_D = 40, KEY_H = 6, KEY_W = 12.4;
const BLACK_W = 7.6, BLACK_D = 24, BLACK_TOP = 11;
const REEL_Y = -33, REEL_R = 7, REEL_H = 12;
const TAPE_Y0 = -22, TAPE_Y1 = -16, TAPE_Z = 2, TAPE_H = 1.2, LEG_FROM = -26.2;
const LEG = TAPE_Y1 - LEG_FROM; // tape that runs along the chute before it turns
const DIAL = [0, 51], DIAL_R = 9.5, DIAL_Z = 20, DIAL_H = 7, DIAL_TOP = DIAL_Z + DIAL_H;
const ARM_Z = 20, ARM_H = 5, POINTER_Y = 24, HOOK_Y = -19;

const P = k.fitProjection(
  [
    ...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0),
    [keyX(0), REEL_Y, 16], [keyX(N - 1), REEL_Y, 16], [0, -24, ARM_Z + ARM_H], [0, 62, DIAL_TOP + 2],
  ],
  WIDTH,
  HEIGHT,
  { pad: 14, azimuth: 62 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

function base() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  const feet = [...k.corners(PLATE, 24), [0, PLATE.y + 24], [0, PLATE.y + PLATE.d - 24]];
  for (const [x, y] of byDepth(feet)) {
    out.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 11);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  return out.join("");
}

function wall() {
  const out = [];
  const bar = { x: -219, y: -50, w: 438, d: 8, r: 2 };
  out.push(S(k.slabOf(bar, 0, 16, P, 3, 0.5), { tone: "mid" }));
  const xs = Array.from({ length: 9 }, (_, n) => -200 + n * 50);
  out.push(D(xs.map((x) => at([x, -46, 16])), { size: 0.45 }));
  out.push(L(k.lineOnTop([bar.x, -46], [bar.x + bar.w, -46], 16, P), { tone: "faint" }));
  return out.join("");
}

// One landmark reel. The cap line is rebuilt while the tape pays out (live code).
function reel(j) {
  const x = keyX(LANDMARKS[j].i);
  const out = [];
  out.push(S(k.slabOf({ x: x - 4.5, y: -42, w: 9, d: 8, r: 1.5 }, 0, 9, P, 3, 0.3), { tone: "mid" }));
  out.push(S(k.cylinder(x, REEL_Y, REEL_R, 0, REEL_H, P, 36, 0.5), { tone: "hi" }));
  out.push(L(k.sideArc(x, REEL_Y, REEL_R, 4.2, P, 24), { tone: "faint" }));
  out.push(L(k.sideArc(x, REEL_Y, REEL_R, 8.4, P, 24), { tone: "faint" }));
  out.push(S(k.cylinder(x, REEL_Y, 5.8, REEL_H, 3, P, 32, 0.3), { tone: "mid" }));
  out.push(L(k.knurl(x, REEL_Y, 5.8, REEL_H, REEL_H + 3, 26, P, 0.3), { tone: "lo" }));
  out.push(L(k.ring(x, REEL_Y, 4.2, REEL_H + 3, P, 28), { tone: "lo" }));
  out.push(`<path data-cap="${j}" class="iso-line" data-tone="hi" d="${capLine(x, 0)}"/>`);
  out.push(D([at([x, REEL_Y, REEL_H + 3])], { size: 0.5, tone: "hi" }));
  return `<g data-reel="${j}">${out.join("")}</g>`;
}
function capLine(x, turn) {
  const a = turn;
  return k.lineOnTop([x, REEL_Y], [x + Math.sin(a) * 4.2, REEL_Y - Math.cos(a) * 4.2], REEL_H + 3.2, P);
}

function track() {
  const out = [];
  const strip = { x: -219, y: -28, w: 438, d: 14, r: 2 };
  out.push(S(k.slabOf(strip, 0, TAPE_Z, P, 3), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(strip, 2), TAPE_Z, P, 3), { tone: "faint" }));
  return out.join("");
}

function keys() {
  const out = [];
  for (let i = 0; i < N; i++) {
    const plan = { x: keyX(i) - KEY_W / 2, y: KEY_Y, w: KEY_W, d: KEY_D, r: 1.4 };
    out.push(S(k.slabOf(plan, 0, KEY_H, P, 3, 0.35), { tone: "mid" }));
  }
  for (let i = 0; i < N - 1; i++) {
    if (![0, 1, 3, 4, 5].includes(i % 7)) continue;
    const plan = { x: keyX(i) + KP / 2 - BLACK_W / 2, y: KEY_Y, w: BLACK_W, d: BLACK_D, r: 1.2 };
    out.push(S(k.slabOf(plan, KEY_H, BLACK_TOP - KEY_H, P, 3, 0.4), { tone: "hi", crease: "lo" }));
  }
  return out.join("");
}

function front() {
  const out = [];
  const rail = { x: -222, y: 46, w: 444, d: 7, r: 1.5 };
  out.push(S(k.slabOf(rail, 0, 3, P, 3, 0.4), { tone: "mid" }));
  for (const x of [-226, 220]) {
    out.push(S(k.slabOf({ x, y: 44, w: 6, d: 11, r: 1.5 }, 0, 7, P, 3, 0.4), { tone: "mid" }));
    out.push(D([at([x + 3, 49.5, 7])], { size: 0.45 }));
  }
  const strip = { x: -208, y: 60, w: 416, d: 7, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(X0, X0 + KP * N, KP, 7, strip.y + 0.8, 0.6, [2, 3.6], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([strip.x + 2, strip.y + 3.5, 0.6]), at([strip.x + strip.w - 2, strip.y + 3.5, 0.6])], { size: 0.45 }));
  const plate = { x: -60, y: 71, w: 120, d: 9, r: 1.5 };
  out.push(S(k.slabOf(plate, 0, 0.8, P, 4), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(plate, 1.2), 0.8, P, 4), { tone: "faint" }));
  out.push(k.faceTextSvg(k.topMatrix([0, 77.1], 0.8, P, "x"), "C2 TO C6, WHITE KEYS", { size: 3, tone: "mid", anchor: "middle" }));
  return out.join("");
}

// Built at x = 0 and moved along the rail with translateAlong.
function carriage() {
  const out = [`<path class="iso-halo" d="${k.haloOf({ x: -17, y: 41, w: 34, d: 20, r: 3.5 }, 3, 0.1, P)}" style="filter:blur(4px)"/>`];
  for (const x of [-13, 3]) out.push(S(k.slabOf({ x, y: 44.5, w: 10, d: 10, r: 1.5 }, 3, 5, P, 3, 0.3), { tone: "mid" }));
  out.push(S(k.slabOf({ x: -16, y: 42, w: 32, d: 18, r: 3 }, 8, 8, P, 5, 0.5), { tone: "mid" }));
  out.push(S(k.slabOf({ x: -17, y: 41, w: 34, d: 20, r: 3.5 }, 16, 4, P, 5, 0.6), { tone: "mid" }));
  out.push(D([[-13, 44], [13, 44], [-13, 58], [13, 58]].map(([x, y]) => at([x, y, 20])), { size: 0.45 }));
  // arm reaching back over the keys to the tape
  out.push(S(k.slabOf({ x: -3.2, y: -24, w: 6.4, d: 66, r: 1.5 }, ARM_Z, ARM_H, P, 3, 0.4), { tone: "mid" }));
  out.push(L(k.lineOnTop([0, -24], [0, 42], ARM_Z + ARM_H, P), { tone: "faint" }));
  // hook pin down to the tape end
  out.push(S(k.cylinder(0, HOOK_Y, 1.4, 3.2, ARM_Z - 3.2, P, 16), { tone: "mid", crease: "none" }));
  out.push(S(k.slabOf({ x: -2.8, y: HOOK_Y - 2.8, w: 5.6, d: 5.6, r: 1 }, TAPE_Z + TAPE_H, 1.4, P, 3, 0.2), { tone: "mid" }));
  // pointer pin to the key
  out.push(S(k.cylinder(0, POINTER_Y, 1.5, 7.2, ARM_Z - 7.2, P, 16), { tone: "hi", crease: "none", lit: true }));
  out.push(S(k.cylinder(0, POINTER_Y, 2.8, ARM_Z - 1.6, 1.6, P, 20), { tone: "mid" }));
  // step dial
  const [x, y] = DIAL;
  out.push(S(k.cylinder(x, y, DIAL_R, DIAL_Z, DIAL_H, P, 48, 0.6), { tone: "hi", crease: "lo" }));
  out.push(L(k.knurl(x, y, DIAL_R, DIAL_TOP - 3, DIAL_TOP, 64, P, 0.3), { tone: "lo" }));
  out.push(L(k.sideArc(x, y, DIAL_R, DIAL_TOP - 3, P, 32), { tone: "faint" }));
  out.push(L(k.ring(x, y, DIAL_R - 2, DIAL_TOP, P, 48), { tone: "lo" }));
  const t = k.radialTicks(x, y, DIAL_R - 2.6, 8, 8, DIAL_TOP, [1.2, 2.6], P);
  out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  out.push(L(k.ring(x, y, 1.2, DIAL_TOP, P, 12), { tone: "mid" }));
  return out.join("");
}
const needleAt = (angle) => {
  const [x, y] = DIAL;
  return k.lineOnTop([x - Math.sin(angle) * 2.6, y + Math.cos(angle) * 2.6], [x + Math.sin(angle) * (DIAL_R - 3), y - Math.cos(angle) * (DIAL_R - 3)], DIAL_TOP + 0.2, P);
};

const startIndex = 14;
const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A measuring rail built like a keyboard. Twenty-nine white keys, C2 to C6, lie between nine tape reels that mark the landmark notes. A carriage slides along the front; its pointer rests on one key and its hook pulls the tape of the nearest reel, one tick per step. A dial on the carriage counts the steps.",
  body: [
    base(),
    wall(),
    LANDMARKS.map((_, j) => reel(j)).join(""),
    track(),
    `<g data-part="tapes">${LANDMARKS.map((_, j) => `<g data-tape="${j}"></g>`).join("")}</g>`,
    keys(),
    front(),
    `<g data-part="carriage" transform="${k.translateAlong(P, [keyX(startIndex), 0, 0])}">${carriage()}<path data-part="needle" class="iso-line" data-tone="lit" data-free="start" d="${needleAt(0)}" style="stroke-width:1.1"/></g>`,
  ],
});

// ---- live ------------------------------------------------------------------------------------------
const live = `
const P = ${JSON.stringify(P)};
const WIDTH = ${WIDTH};
const N = ${N}, KP = ${KP}, X0 = ${X0};
const LANDMARKS = ${JSON.stringify(LANDMARKS)};
const LETTERS = ${JSON.stringify(LETTERS)};
const REEL_Y = ${REEL_Y}, TAPE_Y0 = ${TAPE_Y0}, TAPE_Y1 = ${TAPE_Y1}, TAPE_Z = ${TAPE_Z}, TAPE_H = ${TAPE_H}, LEG_FROM = ${LEG_FROM}, LEG = ${LEG};
const DIAL = ${JSON.stringify(DIAL)}, DIAL_R = ${DIAL_R}, DIAL_TOP = ${DIAL_TOP}, REEL_H = ${REEL_H};
const TOUR = [14, 15, 16, 19, 20, 22, 6, 5, 2, 12, 26, 27];
const keyX = (i) => X0 + KP / 2 + KP * i;
const noteName = (i) => LETTERS[i % 7] + (2 + Math.floor(i / 7));
const midiOf = (i) => 36 + [0, 2, 4, 5, 7, 9, 11][i % 7] + 12 * Math.floor(i / 7);
const routeOf = (i) => {
  const d = LANDMARKS.map((l) => Math.abs(l.i - i));
  const least = Math.min(...d);
  return LANDMARKS.map((l, j) => ({ j, d: d[j] })).filter((r) => r.d === least);
};
const needleAt = ${needleAt.toString().replace(/k\.lineOnTop/g, "lineOnTop")};
const capLine = ${capLine.toString().replace(/k\.lineOnTop/g, "lineOnTop")};
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function mount(root) {
  const stage = root.querySelector(".iso-stage");
  const svg = stage.querySelector("svg");
  const carriage = svg.querySelector('[data-part="carriage"]');
  const needle = svg.querySelector('[data-part="needle"]');
  const tapes = LANDMARKS.map((_, j) => svg.querySelector('[data-tape="' + j + '"]'));
  const caps = LANDMARKS.map((_, j) => svg.querySelector('[data-cap="' + j + '"]'));
  const readout = root.querySelector("[data-readout]");
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  const ax = axisVector(P, [1, 0, 0])[0];
  const sx0 = iso([0, 18, 6], P)[0];
  const tapeHtml = tapes.map(() => "");
  const attach = LANDMARKS.map(() => 0);
  const dial = { at: 0, rate: 0 };
  let ti = ${startIndex}, x = keyX(ti), frame = 0, last = 0, clock = 0, touring = !still.matches, visible = false, idle = 0, said = -1;
  const nearest = (wx) => clamp(Math.round((wx - X0 - KP / 2) / KP), 0, N - 1);

  function words(i) {
    const hits = routeOf(i);
    const parts = hits.map(({ j, d }) => LANDMARKS[j].name + (d === 0 ? "" : (i > LANDMARKS[j].i ? " +" : " −") + d));
    return noteName(i) + " · " + parts.join(" · ");
  }
  function tapeAt(j, extent) {
    const l = LANDMARKS[j], xl = keyX(l.i), W = 2.5;
    if (extent < 0.4) return "";
    const toward = x >= xl ? 1 : -1;
    let ring, bar = 0;
    if (extent <= LEG) ring = [[xl - W, LEG_FROM], [xl + W, LEG_FROM], [xl + W, LEG_FROM + extent], [xl - W, LEG_FROM + extent]];
    else {
      bar = extent - LEG;
      const e = xl + toward * bar;
      ring = toward > 0
        ? [[xl - W, LEG_FROM], [xl + W, LEG_FROM], [xl + W, TAPE_Y0], [e, TAPE_Y0], [e, TAPE_Y1], [xl - W, TAPE_Y1]]
        : [[xl + W, LEG_FROM], [xl - W, LEG_FROM], [xl - W, TAPE_Y0], [e, TAPE_Y0], [e, TAPE_Y1], [xl + W, TAPE_Y1]];
    }
    let html = solidSvg(extrude(ring, TAPE_Z, TAPE_H, P, { convex: false }), { tone: "hi", crease: "lo" });
    if (bar > 0) {
      let d = "";
      const top = TAPE_Z + TAPE_H;
      for (let i = 0; i < N; i++) {
        const kx = keyX(i);
        if (toward > 0 ? kx > xl + 1 && kx < xl + bar - 1 : kx < xl - 1 && kx > xl - bar + 1) d += lineOnTop([kx, TAPE_Y1], [kx, TAPE_Y1 - 2.6], top, P);
      }
      if (d) html += lineSvg(d, { tone: "lo" });
    }
    return html;
  }
  function draw() {
    carriage.setAttribute("transform", translateAlong(P, [x, 0, 0]));
    needle.setAttribute("d", needleAt(dial.at));
    const near = nearest(x);
    LANDMARKS.forEach((l, j) => {
      const dist = Math.abs(x - keyX(l.i));
      const extent = attach[j] * (LEG + dist);
      const html = tapeAt(j, extent);
      if (html !== tapeHtml[j]) { tapes[j].innerHTML = html; tapeHtml[j] = html; }
      caps[j].setAttribute("d", capLine(keyX(l.i), extent / 4));
    });
    if (near !== said) {
      said = near;
      readout.textContent = words(near);
      stage.setAttribute("aria-valuenow", String(near));
      stage.setAttribute("aria-valuetext", words(near));
    }
  }
  function tick(now) {
    const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
    last = now;
    const calm = still.matches;
    if (touring) { clock += dt; ti = TOUR[Math.floor(clock / 2.8) % TOUR.length]; }
    const tx = keyX(ti);
    x = calm ? tx : x + (tx - x) * (1 - Math.exp(-dt / 0.2));
    if (Math.abs(tx - x) < 0.02) x = tx;
    const near = nearest(x);
    const hits = routeOf(near);
    let busy = false;
    LANDMARKS.forEach((_, j) => {
      const want = hits.some((h) => h.j === j) ? 1 : 0;
      attach[j] = calm ? want : attach[j] + (want - attach[j]) * (1 - Math.exp(-dt / 0.09));
      if (Math.abs(want - attach[j]) < 0.004) attach[j] = want; else busy = true;
    });
    const want = hits[0].d * Math.PI / 4;
    const stiff = 260, drag = calm ? 2 * Math.sqrt(260) : 20;
    for (let i = 0; i < 4; i++) { dial.rate += ((want - dial.at) * stiff - dial.rate * drag) * dt / 4; dial.at += dial.rate * dt / 4; }
    if (Math.abs(want - dial.at) < 0.002 && Math.abs(dial.rate) < 0.01) { dial.at = want; dial.rate = 0; } else busy = true;
    draw();
    const settled = !touring && x === tx && !busy;
    frame = visible && !settled ? requestAnimationFrame(tick) : 0;
  }
  const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
  function steer(i, play) {
    touring = false;
    ti = clamp(i, 0, N - 1);
    clearTimeout(idle);
    idle = setTimeout(() => { touring = !still.matches; clock = 0; run(); }, 3600);
    if (play) root.dispatchEvent(new CustomEvent("anatomy:note", { bubbles: true, detail: { midi: midiOf(ti), name: noteName(ti) } }));
    run();
  }
  const keyAt = (event) => {
    const box = svg.getBoundingClientRect();
    return nearest((((event.clientX - box.left) / box.width) * WIDTH - sx0) / ax);
  };
  new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
  stage.addEventListener("pointermove", (event) => { if (event.pointerType !== "touch") steer(keyAt(event), false); });
  stage.addEventListener("pointerdown", (event) => steer(keyAt(event), true));
  stage.addEventListener("keydown", (event) => {
    const big = event.shiftKey ? 7 : 1;
    let to = null;
    if (event.key === "ArrowRight" || event.key === "ArrowUp") to = ti + big;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") to = ti - big;
    if (event.key === "Home") to = 0;
    if (event.key === "End") to = N - 1;
    if (event.key === "Enter" || event.key === " ") to = ti;
    if (to === null) return;
    event.preventDefault();
    steer(to, true);
  });
  draw();
  run();
}
`;

const body = k.plateHtml({
  fig: "Fig 1",
  title: "Landmark rail",
  hint: "Hover or tap a key",
  readout: words(startIndex),
  keys: [
    { mark: "lit", label: "Pointer and needle: the key you are on, and its step count" },
    { mark: "raised", label: "The nine landmark reels" },
    { mark: "edge", label: "Tape: one tick for each step" },
  ],
  caption:
    "Twenty-nine white keys, C2 to C6, with a tape reel at each of the nine landmarks. The hook always pulls the tape of the nearest reel, and the dial counts the ticks. On this rail no key is more than 2 steps from a reel.",
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Landmark rail: arrow keys move the carriage from key to key, Enter plays the note" aria-valuemin="0" aria-valuemax="${N - 1}" aria-valuenow="${startIndex}">${svg}</div>`,
});
function words(i) {
  const hits = routeOf(i);
  return noteName(i) + " · " + hits.map(({ j, d }) => LANDMARKS[j].name + (d === 0 ? "" : (i > LANDMARKS[j].i ? " +" : " −") + d)).join(" · ");
}

const pages = emit({ dir: HERE, name: "landmark-rail", global: "FigLandmarkRail", title: "Landmark rail", cardHtml: body, live });
console.log("wrote", pages.dark, "and", pages.light);
