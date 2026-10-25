// Key action: a cutaway of one piano key and the grand-action linkage behind it. Press the key
// and it lifts the wippen, the jack pushes the hammer's roller, the jack slips out (let-off), the
// hammer flies to the strings, and the damper lifts off them. Run: node figures/key-action/build.mjs
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../vendor/anatomy/kit/iso-kit.mjs";
import * as G from "../vendor/anatomy/kit/lathe.mjs";
import { emit } from "../lib/emit.mjs";
import { MODEL as M } from "./model.mjs";
import { makeParts } from "./parts.mjs";
import { readFileSync } from "node:fs";

const HERE = dirname(fileURLToPath(import.meta.url));
const WIDTH = 700;
const HEIGHT = 470;
const C = M.C;

// ---- world --------------------------------------------------------------------------------------
const WALL_Y = -38;
const BED = { x: -176, y: WALL_Y, w: 404, d: 72, r: 6 };
const BED_Z = -12;
const WALL = { x: -176, y: WALL_Y - 7, w: 404, d: 7, r: 3 };
const WALL_H = 166;
const pose0 = M.pose(0);
const poseContact = M.pose(C.contactDip);
const tailAt = M.add(poseContact.J, M.rot(poseContact.psi, C.tail));
const BUTTON = { x: tailAt[0], z: tailAt[1] };

const P = k.fitProjection(
  [
    ...k.boxCorners(BED, BED_Z - 5, 0),
    [WALL.x, WALL.y, WALL_H], [WALL.x + WALL.w, WALL.y, WALL_H],
    [190, 10, 30],
  ],
  WIDTH,
  HEIGHT,
  { pad: 14, azimuth: 79, elevation: 22 },
);
const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const byDepth = (items, key) => [...items].sort((a, b) => k.depthOf(key(a), P) - k.depthOf(key(b), P));
const PARTS = makeParts(k, G, M);
const rail = (x0, z0, x1, z1, y1, style = {}) =>
  S(k.slabOf({ x: x0, y: WALL_Y, w: x1 - x0, d: y1 - WALL_Y, r: 1.2 }, z0, z1 - z0, P, 3, 0.4), { tone: "mid", ...style });
const pinAlongY = (x, z, r, y0, y1, style = { tone: "mid" }) => {
  const F = G.frameAlong([x, y0, z], [0, 1, 0]);
  return S(G.disc(0, y1 - y0, r, F, P, {}), style) + L(G.circleOf(F, y1 - y0, r * 0.45, P, 12), { tone: "faint" });
};
const cheek = (pts, y0, y1) => S(G.prismOf(G.frameOf([0, y0, 0], [0, 1, 0], [1, 0, 0], [0, 0, 1]), pts, 0, y1 - y0, P), { tone: "mid" });

function base() {
  const out = [`<path class="iso-halo" d="${k.haloOf(BED, BED_Z - 5, 12, P)}"/>`];
  const feet = [...k.corners(BED, 24), [BED.x + BED.w / 2, BED.y + 24], [BED.x + BED.w / 2, BED.y + BED.d - 24]];
  for (const [x, y] of byDepth(feet, (f) => [f[0], f[1], 0])) {
    out.push(S(k.cylinder(x, y, 7, BED_Z - 5, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, BED_Z - 3.4, 3.4, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(BED, BED_Z, -BED_Z, P, 8, 1.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(BED, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(BED, 11);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // label plate with the one engraved word
  const plate = { x: -22, y: 24, w: 44, d: 8, r: 1.5 };
  out.push(S(k.slabOf(plate, 0, 0.8, P, 4), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(plate, 1.1), 0.8, P, 4), { tone: "faint" }));
  out.push(k.faceTextSvg(k.topMatrix([0, 29.4], 0.8, P, "x"), "KEY C4", { size: 3.2, tone: "mid", anchor: "middle" }));
  // balance rail and front rail
  out.push(S(k.slabOf({ x: -9, y: -16, w: 18, d: 32, r: 1.5 }, 0, 15, P, 3, 0.5), { tone: "mid" }));
  out.push(D([at([0, -12, 15]), at([0, 12, 15])], { size: 0.45 }));
  out.push(S(k.slabOf({ x: 168, y: -14, w: 28, d: 28, r: 1.5 }, 0, 5, P, 3, 0.4), { tone: "mid" }));
  out.push(S(k.slabOf({ x: 170, y: -9, w: 24, d: 18, r: 1 }, 5, 0.9, P, 3), { tone: "lo", crease: "none" }));
  out.push(D([at([174, -11.5, 5]), at([190, -11.5, 5]), at([174, 11.5, 5]), at([190, 11.5, 5])], { size: 0.4 }));
  return out.join("");
}

function standard() {
  const out = [];
  out.push(`<g class="ka-backdrop">${S(k.slabOf(WALL, 0, WALL_H, P, 5, 0.8), { tone: "mid" })}</g>`);
  out.push(L(k.planOutline(k.insetPlan(WALL, 1.2), WALL_H, P, 3), { tone: "faint" }));
  const face = WALL_Y;
  const ticks = k.sideTicks(WALL.x + 6, WALL.x + WALL.w - 6, 10, 5, face, WALL_H - 0.2, [2.2, 4.2], P, "x");
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  // rail seats on the front face
  const seats = [
    [-158, 40], [-44, 100], [BUTTON.x - 1, BUTTON.z + 14], [-100, 141], [150, 141],
  ];
  for (const [x, z] of seats) out.push(D([at([x - 5, face, z + 12]), at([x + 5, face, z + 12]), at([x - 5, face, z - 12]), at([x + 5, face, z - 12])], { size: 0.45 }));
  return out.join("");
}

function rails() {
  const items = [
    { at: [-158, 0, 40], svg: rail(-164, 31, -152, 50, 14) },
    { at: [-44, 0, 100], svg: rail(-51, 93, -37, 107, 8) },
    { at: [BUTTON.x, 0, BUTTON.z + 14], svg: rail(BUTTON.x - 6, BUTTON.z + 8, BUTTON.x + 4, BUTTON.z + 19, 6) },
    { at: [-100, 0, 141], svg: rail(-106, 136, -94, STRINGS_TOP, 8, { tone: "mid" }) },
    { at: [150, 0, 141], svg: rail(144, 136, 156, STRINGS_TOP, 8, { tone: "mid" }) },
  ];
  const out = byDepth(items, (i) => i.at).map((i) => i.svg);
  // let-off button hanging over the jack's tail
  out.push(S(k.cylinder(BUTTON.x, 0, 3.2, BUTTON.z, 8, P, 20), { tone: "mid" }));
  out.push(L(k.knurl(BUTTON.x, 0, 3.2, BUTTON.z + 4, BUTTON.z + 8, 14, P, 0.3), { tone: "lo" }));
  // string pins on the two supports
  for (const x of [-100, 150]) for (const y of [-3, 0, 3]) out.push(D([at([x, y, STRINGS_TOP])], { size: 0.5, tone: "hi" }));
  return out.join("");
}
const STRINGS_TOP = C.stringZ - PARTS.STRINGS.r;

// static pins, cheeks and brackets that belong to the moving groups
function flangesBehind() {
  return [
    cheek([[-152, 31], [-146, 31], [-146, 43], [-152, 43]], -13.8, -11.8),
    cheek([[-37, 90], [-21, 90], [-21, 103], [-37, 103]], -6.4, -4.4),
  ].join("");
}
function flangesFront() {
  return [
    pinAlongY(C.wippen[0], C.wippen[1], 2, -6.2, 8.4),
    cheek([[-152, 34], [-146, 34], [-146, 46], [-152, 46]], 6.2, 8.4),
    pinAlongY(C.flange[0], C.flange[1], 2.2, -6.4, 5),
  ].join("");
}
function balancePin() {
  const out = [];
  out.push(S(k.cylinder(0, 0, 1.7, 15, 17, P, 14), { tone: "hi", crease: "none" }));
  out.push(S(k.cylinder(0, 0, 2.6, 31.2, 1.4, P, 16), { tone: "mid" }));
  return out.join("");
}

// ---- assemble ------------------------------------------------------------------------------------------
const rest = { pose: pose0, theta: C.rest };
const group = (name, inner) => `<g data-part="${name}">${inner}</g>`;
const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A cutaway of one piano key and the action behind it. The key is a see-saw on a balance rail. Its rear end lifts a wippen, the wippen lifts a jack, and the jack pushes a roller under the hammer until the jack slips out from under it. The hammer then flies free to three strings and is held just under them. A damper lever lifted by a spoon on the key raises the damper felt off the strings.",
  body: [
    base(),
    standard(),
    rails(),
    flangesBehind(),
    group("key", PARTS.key(P, pose0)),
    group("damperLow", PARTS.damperLow(P, pose0)),
    pinAlongY(C.damperPivot[0], C.damperPivot[1], 1.6, -13.8, -6.8),
    balancePin(),
    group("wippen", PARTS.wippen(P, pose0, C.rest)),
    group("jack", PARTS.jack(P, pose0)),
    group("hammer", PARTS.hammer(P, C.rest)),
    group("strings", PARTS.strings(P, { amp: 0, phase: 0 })),
    group("damperHead", PARTS.damperHead(P, pose0)),
    flangesFront(),
  ],
});

// ---- live ------------------------------------------------------------------------------------------------
const stripExport = (src) => src.replace(/^export /gm, "");
const live = `
${stripExport(readFileSync(new URL("./model.mjs", import.meta.url), "utf8"))}
${stripExport(readFileSync(new URL("./parts.mjs", import.meta.url), "utf8"))}
const P = ${JSON.stringify(P)};
const PARTS = makeParts(k, G, MODEL);
const M = MODEL, C = M.C;
const DIP = C.dip;
const midi = 60;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const SPEEDS = [0.4, 0.08, 1];

function mount(root) {
  const stage = root.querySelector(".iso-stage");
  const svg = stage.querySelector("svg");
  const slots = {};
  ["key", "damperLow", "wippen", "jack", "hammer", "strings", "damperHead"].forEach((n) => (slots[n] = svg.querySelector('[data-part="' + n + '"]')));
  const readout = root.querySelector("[data-readout]");
  const hint = root.querySelector('[data-corner="hint"]');
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  const hammer = M.hammer();
  const st = { dip: 0, target: 0, tau: 0.035, speedIdx: 0, drag: false, held: false, wave: { amp: 0, phase: 0 }, status: "", statusAt: 0, sim: 0 };
  let frame = 0, last = 0, visible = false, touring = !still.matches, clock = 0, idle = 0, lastText = "";
  const slow = () => SPEEDS[st.speedIdx];

  const TOUR = [
    { t: 0.5, target: DIP, tau: 0.035 }, { t: 3.1, target: 0, tau: 0.06 },
    { t: 4.6, target: DIP, tau: 0.16 }, { t: 6.6, target: 0, tau: 0.06 },
    { t: 8.0, target: 5.4, tau: 0.05 }, { t: 9.6, target: 0, tau: 0.06 },
    { t: 11.0, target: DIP, tau: 0.012 }, { t: 12.4, target: 5.2, tau: 0.05 }, { t: 12.9, target: DIP, tau: 0.012 }, { t: 14.8, target: 0, tau: 0.06 },
  ];
  const LOOP = 17;

  function status(text) { st.status = text; st.statusAt = st.sim; }
  function advance(dt) {
    // dt is model seconds; the key follows its target, the hammer flies by its own physics
    const n = Math.max(1, Math.ceil(dt / 0.0004)), h = dt / n;
    for (let i = 0; i < n; i++) {
      st.dip += (st.target - st.dip) * (1 - Math.exp(-h / st.tau));
      const pose = M.pose(clamp(st.dip, 0, DIP));
      const before = hammer.phase;
      const r = M.step(hammer, pose, h);
      st.pose = pose;
      st.sim += h;
      if (r.struck) {
        const v = hammer.speed;
        st.struck = v;
        st.wave.amp = Math.min(2.2, 0.5 + v * 0.6);
        status("struck at " + v.toFixed(1) + " m/s");
        if (v > 0.15) root.dispatchEvent(new CustomEvent("anatomy:note", { bubbles: true, detail: { midi, velocity: clamp(v / 3, 0.15, 1) } }));
      } else if (before === "flying" && hammer.phase === "falling" && hammer.theta < C.strike - 0.01) {
        status("fell short, no sound");
      }
      st.wave.amp *= Math.exp(-h / (pose.damperLift > 0.3 ? 2.6 : 0.09));
      st.wave.phase += h * 2 * Math.PI * 9;
    }
  }
  function words() {
    const p = st.pose || M.pose(0);
    const parts = [clamp(st.dip, 0, DIP).toFixed(1) + " mm"];
    if (st.dip > 0.3 && st.sim - st.statusAt < 1.6 && st.statusAt > 0) parts.push(st.status);
    else if (hammer.phase === "held") parts.push("hammer held");
    parts.push(p.damperLift > 0.3 ? "damper off" : "damper on");
    return parts.join(" · ");
  }
  function draw() {
    const pose = st.pose || M.pose(0);
    slots.key.innerHTML = PARTS.key(P, pose);
    slots.wippen.innerHTML = PARTS.wippen(P, pose, hammer.theta);
    slots.jack.innerHTML = PARTS.jack(P, pose);
    slots.hammer.innerHTML = PARTS.hammer(P, hammer.theta);
    slots.strings.innerHTML = PARTS.strings(P, st.wave);
    slots.damperLow.innerHTML = PARTS.damperLow(P, pose);
    slots.damperHead.innerHTML = PARTS.damperHead(P, pose);
    const text = words();
    if (text !== lastText) { readout.textContent = text; lastText = text; }
  }
  function tick(now) {
    const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
    last = now;
    const calm = still.matches;
    if (touring) {
      clock += dt * slow();
      const t = clock % LOOP;
      let cue = null;
      for (const c of TOUR) if (t >= c.t) cue = c;
      if (t < TOUR[0].t) { st.target = 0; st.tau = 0.06; }
      else if (cue) { st.target = cue.target; st.tau = cue.tau; }
    }
    advance(dt * (calm ? 0.25 : slow()));
    draw();
    const resting = !touring && Math.abs(st.dip - st.target) < 0.005 && hammer.phase === "rest" && st.wave.amp < 0.01 && st.target === 0;
    frame = visible && !resting ? requestAnimationFrame(tick) : 0;
  }
  const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
  const takeOver = () => { touring = false; clearTimeout(idle); };
  const handBack = () => { clearTimeout(idle); idle = setTimeout(() => { if (!st.drag && !st.held) { touring = !still.matches; clock = 0; st.target = 0; run(); } }, 4200); };
  function press(tau) { takeOver(); st.held = true; st.target = DIP; st.tau = tau; run(); }
  function release() { st.held = false; st.drag = false; st.target = 0; st.tau = 0.07; handBack(); run(); }

  new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
  let down = null;
  stage.addEventListener("pointerdown", (event) => {
    try { stage.setPointerCapture(event.pointerId); } catch (error) { /* synthetic events have no active pointer */ }
    down = { y: event.clientY, moved: false };
    press(0.032);
  });
  stage.addEventListener("pointermove", (event) => {
    if (!down) return;
    const dy = event.clientY - down.y;
    if (Math.abs(dy) > 5) down.moved = true;
    if (down.moved) {
      const box = svg.getBoundingClientRect();
      const perMm = (box.height / ${HEIGHT}) * 2.3;
      st.drag = true; st.tau = 0.012;
      st.target = clamp(dy / perMm, 0, DIP);
    }
  });
  const up = () => { if (down) { down = null; release(); } };
  stage.addEventListener("pointerup", up);
  stage.addEventListener("pointercancel", up);
  stage.addEventListener("keydown", (event) => {
    if (event.repeat) return;
    if (event.key === " " || event.key === "Enter" || event.key === "ArrowDown") { event.preventDefault(); press(event.shiftKey ? 0.2 : 0.032); }
    if (event.key === "s" || event.key === "S") { st.speedIdx = (st.speedIdx + 1) % SPEEDS.length; hint.textContent = hintText(); run(); }
  });
  stage.addEventListener("keyup", (event) => { if (event.key === " " || event.key === "Enter" || event.key === "ArrowDown") release(); });
  stage.addEventListener("blur", () => { if (st.held) release(); });
  const hintText = () => "Hold the key · S: speed " + (SPEEDS[st.speedIdx] === 1 ? "real time" : SPEEDS[st.speedIdx] + "×");
  hint.textContent = hintText();
  stage.setAttribute("aria-valuetext", "Key up. Press Space to press the key.");
  draw();
  run();
}
`;

const body = k.plateHtml({
  fig: "Fig 2",
  title: "Key action",
  hint: "Hold the key · S: speed 0.4×",
  readout: "0.0 mm · damper on",
  keys: [
    { mark: "lit", label: "The hammer: what the key finally throws at the strings" },
    { mark: "raised", label: "Key, jack and damper: the parts you can watch move" },
  ],
  caption:
    "One key of a grand piano, cut away and drawn to scale in millimetres with simplified proportions. The key is a see-saw: its rear end lifts the wippen, the wippen lifts the jack, and the jack pushes the hammer's roller until it slips out, here when the key is about 6 mm down of its 10 mm. The hammer flies free to the strings and a repetition lever holds it just under them while the damper is lifted off. A key pressed too slowly makes no sound: the hammer falls short.",
  body: `<style>.ka-backdrop .iso-shade,.ka-backdrop .iso-top{fill:var(--anatomy-shade-1)}.ka-backdrop .iso-fill{fill:var(--anatomy-shade-2)}</style><div class="iso-stage" tabindex="0" role="slider" aria-label="Key action: hold Space or press the key to play it, S changes the time scale" aria-valuemin="0" aria-valuemax="10" aria-valuenow="0">${svg}</div>`,
});

const pages = emit({ dir: HERE, name: "key-action", global: "FigKeyAction", title: "Key action", cardHtml: body, live, withLathe: true });
console.log("wrote", pages.dark, "and", pages.light);
