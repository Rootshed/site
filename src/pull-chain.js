// Theme switch: a bulb on a wire with a pull chain. The bulb is a heavy pendulum and
// the chain a verlet rope hanging from its socket. It runs whenever it is on screen,
// the pointer pushes the chain or, held down, drags it about, and moving or resizing
// the window shakes the fixture.
(function () {
  var lamp = document.querySelector(".lamp");
  if (!lamp) return;
  var root = document.documentElement;
  var NS = "http://www.w3.org/2000/svg";
  var svg = lamp.querySelector("svg");
  var chainEl = lamp.querySelector(".lamp__chain");
  var bulbEl = lamp.querySelector(".lamp__bulb");
  var dark = window.matchMedia("(prefers-color-scheme: dark)");
  var still = window.matchMedia("(prefers-reduced-motion: reduce)");

  var LINKS = 8, GAP = 20, STRING = 8, STEP = 1000 / 60, GRAVITY = 0.6, ITER = 32;
  var PIVOT = { x: 60, y: 8 }, BOB = { x: 60, y: 110 }, ARM = { x: 26, y: -16 };
  var WIRE = BOB.y - PIVOT.y;
  var BULB_GIVE = 0.03; // inverse mass of the bulb next to a chain link: about 30x heavier
  var PULL = 24, PULL_MS = 130, RELEASE_MS = 70, MAX_PULL = 40;
  // Share of the window's motion passed on to the hanging parts, and the cap per step.
  // Gravity here is gentle, so the whole of an ordinary drag would loop the chain over.
  var SHAKE = 0.1, SCROLL_SHAKE = 0.25, SHAKE_MAX = 20;

  var bulb = { x: BOB.x, y: BOB.y, px: BOB.x, py: BOB.y };
  var pts = [], links = [], knob, string, hit, hitKnob;
  var tilt = 0, hole = { x: BOB.x + ARM.x, y: BOB.y + ARM.y };
  var pullStart = null, flipped = false;
  var grab = null, held = { x: 0, y: 0 }, extend = 0;
  var raf = 0, last = 0, acc = 0, onScreen = true, origin = null, jolt = { x: 0, y: 0 };

  function isDark() {
    var set = root.dataset.theme;
    return set ? set === "dark" : dark.matches;
  }
  function sync() { lamp.setAttribute("aria-checked", String(isDark())); }

  function flip() {
    var next = isDark() ? "light" : "dark";
    root.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch (e) {}
    sync();
  }

  function make(tag, cls) {
    var e = document.createElementNS(NS, tag);
    e.setAttribute("class", cls);
    return e;
  }

  function build() {
    for (var i = 0; i <= LINKS; i++) pts.push({ x: 0, y: 0, px: 0, py: 0 });
    string = make("line", "lamp__wire");
    chainEl.appendChild(string);
    for (var j = 0; j < LINKS; j++) {
      var e = make("ellipse", "lamp__link");
      e.setAttribute("rx", j % 2 ? "2.2" : "4.5");
      e.setAttribute("ry", "9");
      chainEl.appendChild(e);
      links.push(e);
    }
    hit = make("path", "lamp__hit");
    chainEl.appendChild(hit);
    knob = document.createElementNS(NS, "g");
    var body = make("path", "lamp__knob");
    body.setAttribute("d", "M-8 3 Q-13 26 0 33 Q13 26 8 3 Z");
    hitKnob = make("circle", "lamp__hit lamp__hit--knob");
    hitKnob.setAttribute("cy", "18");
    hitKnob.setAttribute("r", "16");
    knob.appendChild(body);
    knob.appendChild(hitKnob);
    chainEl.appendChild(knob);
  }

  function rest() {
    bulb.x = bulb.px = BOB.x; bulb.y = bulb.py = BOB.y;
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      p.x = p.px = BOB.x + ARM.x;
      p.y = p.py = BOB.y + ARM.y + STRING + i * GAP;
    }
    holeOf();
  }

  // The socket's chain hole rides on the bulb and turns with it.
  function holeOf() {
    tilt = Math.atan2(-(bulb.x - PIVOT.x), bulb.y - PIVOT.y);
    var c = Math.cos(tilt), s = Math.sin(tilt);
    hole.x = bulb.x + ARM.x * c - ARM.y * s;
    hole.y = bulb.y + ARM.x * s + ARM.y * c;
  }

  function pullDown(now) {
    if (pullStart === null) return 0;
    var t = now - pullStart, down = 0;
    if (t < PULL_MS) down = PULL * (1 - Math.pow(1 - t / PULL_MS, 3));
    else if (t < PULL_MS + RELEASE_MS) down = PULL * (1 - (t - PULL_MS) / RELEASE_MS);
    else pullStart = null;
    if (!flipped && t >= PULL_MS) { flipped = true; flip(); }
    return down;
  }

  function integrate(p, damping) {
    var vx = (p.x - p.px) * damping, vy = (p.y - p.py) * damping;
    p.px = p.x; p.py = p.y;
    p.x += vx; p.y += vy + GRAVITY;
  }

  // Pull two equal points to their rest distance.
  function link(u, v, rest) {
    var ex = v.x - u.x, ey = v.y - u.y, d = Math.sqrt(ex * ex + ey * ey) || 1;
    var f = (d - rest) / d / 2;
    u.x += ex * f; u.y += ey * f;
    v.x -= ex * f; v.y -= ey * f;
  }

  // The hole is a point on the lamp, which hangs rigid from PIVOT, so a displacement
  // there can only turn the lamp about the pivot, and the bulb swings with it.
  function turn(dx, dy) {
    var hx = hole.x - PIVOT.x, hy = hole.y - PIVOT.y;
    var a = (dy * hx - dx * hy) / (hx * hx + hy * hy);
    var bx = bulb.x - PIVOT.x, by = bulb.y - PIVOT.y;
    bulb.x -= a * by; bulb.y += a * bx;
  }

  // The string from the socket hole to the chain top: the chain takes most of the
  // correction and the heavy lamp feels the rest as a tug on its hole.
  function tether(rest) {
    var p = pts[0], ex = p.x - hole.x, ey = p.y - hole.y, d = Math.sqrt(ex * ex + ey * ey) || 1;
    var f = (d - rest) / d / (1 + BULB_GIVE);
    p.x -= ex * f; p.y -= ey * f;
    turn(ex * f * BULB_GIVE, ey * f * BULB_GIVE);
  }

  function wire() {
    var dx = bulb.x - PIVOT.x, dy = bulb.y - PIVOT.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
    bulb.x = PIVOT.x + dx * WIRE / d;
    bulb.y = PIVOT.y + dy * WIRE / d;
  }

  // While held, the knob follows the pointer, as far as the chain and the string
  // paying out of the socket reach.
  function holdTarget(now) {
    var ease = Math.min(1, (now - grab.t0) / PULL_MS);
    var tx = grab.base.x + (grab.cur.x - grab.at.x);
    var ty = grab.base.y + PULL * (1 - Math.pow(1 - ease, 3)) + (grab.cur.y - grab.at.y);
    var vx = tx - hole.x, vy = ty - hole.y, d = Math.sqrt(vx * vx + vy * vy) || 1;
    var reach = LINKS * GAP + STRING + MAX_PULL;
    if (d > reach) { vx *= reach / d; vy *= reach / d; d = reach; }
    extend = Math.max(0, Math.min(MAX_PULL, d - LINKS * GAP - STRING));
    // A hand is not instant, so the knob eases to the target.
    var dx = hole.x + vx - held.x, dy = hole.y + vy - held.y;
    var m = Math.min(1, 15 / (Math.sqrt(dx * dx + dy * dy) || 1)) * 0.5;
    held.x += dx * m; held.y += dy * m;
  }

  function step(now) {
    if (grab) holdTarget(now);
    else extend = extend < 0.01 ? 0 : extend * 0.65;
    var stringRest = STRING + Math.max(pullDown(now), extend);
    var end = pts[LINKS];
    integrate(bulb, 0.995);
    for (var i = 0; i < pts.length; i++) integrate(pts[i], 0.985);
    if (grab) { end.x = held.x; end.y = held.y; }
    // The chain's weight hangs off-centre on the hole every step; the lamp is drawn
    // hanging straight with it, so that much is held up for free.
    wire();
    holeOf();
    turn(0, -(LINKS + 1) * GRAVITY * BULB_GIVE);
    for (var k = 0; k < ITER; k++) {
      wire();
      holeOf();
      tether(stringRest);
      for (var m = 1; m < pts.length; m++) link(pts[m - 1], pts[m], GAP);
      if (grab) { end.x = held.x; end.y = held.y; }
    }
    wire();
    holeOf();
  }

  // Moving the fixture (window dragged or resized) leaves everything hanging where it
  // was in the world, so in the fixture's own frame it all shifts the other way.
  function shake(dx, dy) {
    var all = pts.concat(bulb);
    for (var i = 0; i < all.length; i++) {
      all[i].x -= dx; all[i].px -= dx;
      all[i].y -= dy; all[i].py -= dy;
    }
  }
  function cap(v) { return Math.max(-SHAKE_MAX, Math.min(SHAKE_MAX, v)); }
  // Where the fixture sits: window drags, resizes and page scrolling all move it.
  function fixtureMoved() {
    var r = lamp.getBoundingClientRect();
    if (!r.width) return;
    // Window motion is gentle; scrolling is the only motion a phone has, so it hits harder.
    var wx = window.screenX + window.scrollX + r.left, wy = window.screenY + window.scrollY + r.top;
    var sx = -window.scrollX, sy = -window.scrollY;
    if (origin) {
      var k = 120 / r.width;
      jolt.x = cap(jolt.x + ((wx - origin.wx) * SHAKE + (sx - origin.sx) * SCROLL_SHAKE) * k);
      jolt.y = cap(jolt.y + ((wy - origin.wy) * SHAKE + (sy - origin.sy) * SCROLL_SHAKE) * k);
    }
    origin = { wx: wx, wy: wy, sx: sx, sy: sy };
  }

  function transform(el, x, y, deg) {
    el.setAttribute("transform", "translate(" + x.toFixed(2) + " " + y.toFixed(2) + ") rotate(" + deg.toFixed(1) + ")");
  }

  function draw() {
    string.setAttribute("x1", hole.x.toFixed(2));
    string.setAttribute("y1", hole.y.toFixed(2));
    string.setAttribute("x2", pts[0].x.toFixed(2));
    string.setAttribute("y2", pts[0].y.toFixed(2));
    var d = "M" + hole.x.toFixed(1) + " " + hole.y.toFixed(1);
    for (var n = 0; n < pts.length; n++) d += " L" + pts[n].x.toFixed(1) + " " + pts[n].y.toFixed(1);
    hit.setAttribute("d", d);
    for (var i = 0; i < LINKS; i++) {
      var u = pts[i], v = pts[i + 1];
      transform(links[i], (u.x + v.x) / 2, (u.y + v.y) / 2, Math.atan2(v.y - u.y, v.x - u.x) * 180 / Math.PI - 90);
    }
    var e = pts[LINKS], f = pts[LINKS - 1];
    transform(knob, e.x, e.y, Math.atan2(e.y - f.y, e.x - f.x) * 180 / Math.PI - 90);
    bulbEl.setAttribute("transform", "rotate(" + (tilt * 180 / Math.PI).toFixed(2) + " " + PIVOT.x + " " + PIVOT.y + ")");
  }

  function running() { return onScreen && !document.hidden && !still.matches; }

  function frame(now) {
    acc += Math.min(now - last, 100);
    last = now;
    fixtureMoved();
    // The frame's window motion is spread over its steps; with none it waits for the next.
    var n = Math.floor(acc / STEP);
    for (var i = 0; i < n; i++) {
      if (jolt.x || jolt.y) shake(jolt.x / n, jolt.y / n);
      step(now);
    }
    if (n) { acc -= n * STEP; jolt.x = jolt.y = 0; }
    draw();
    if (running()) raf = requestAnimationFrame(frame);
    else { raf = 0; grab = null; pullDown(Infinity); } // a pull cut short off screen still switches
  }

  function run() {
    if (raf || !running()) return;
    last = performance.now();
    acc = 0;
    origin = null;
    jolt.x = jolt.y = 0;
    raf = requestAnimationFrame(frame);
  }

  // The pointer (mouse, finger or pen) drives the chain: its position picks which links it touches and
  // its movement is the push, so a slow drag nudges and a fast swipe whips.
  function toSvg(ev) {
    var m = svg.getScreenCTM();
    if (!m) return null;
    var at = svg.createSVGPoint();
    at.x = ev.clientX;
    at.y = ev.clientY;
    return at.matrixTransform(m.inverse());
  }
  var lastX = null, lastY = null;
  function forget() { lastX = lastY = null; }
  function push(ev) {
    if (still.matches || pullStart !== null || grab) return;
    var at = toSvg(ev);
    if (!at) return;
    var k = 120 / lamp.getBoundingClientRect().width;
    // Not every browser reports movement for touch, so fall back to the last position.
    var mx = ev.movementX, my = ev.movementY;
    if (!mx && !my && lastX !== null) { mx = ev.clientX - lastX; my = ev.clientY - lastY; }
    lastX = ev.clientX; lastY = ev.clientY;
    var vx = Math.max(-8, Math.min(8, mx * k));
    var vy = Math.max(-8, Math.min(8, my * k));
    if (!vx && !vy) return;
    for (var i = 0; i < pts.length; i++) {
      var cy = i === LINKS ? pts[i].y + 16 : pts[i].y;
      var w = Math.max(0, 1 - Math.hypot(pts[i].x - at.x, cy - at.y) / 28);
      pts[i].x += vx * w * 0.7;
      pts[i].y += vy * w * 0.7;
    }
  }

  build();
  rest();
  draw();
  sync();
  lamp.hidden = false;

  ["pointerup", "pointercancel", "pointerleave"].forEach(function (name) { lamp.addEventListener(name, forget); });
  hit.addEventListener("pointermove", push);
  hitKnob.addEventListener("pointermove", push);
  // Press pulls the cord and holds it; letting go releases it and switches the theme.
  function release(commit) {
    if (!grab) return;
    grab = null;
    if (commit) flip();
  }
  lamp.addEventListener("pointerdown", function (ev) {
    if (!raf || ev.button > 0 || grab || pullStart !== null) return;
    var at = toSvg(ev);
    if (!at) return;
    var end = pts[LINKS];
    grab = { id: ev.pointerId, at: at, cur: at, base: { x: end.x, y: end.y }, t0: performance.now() };
    held.x = end.x; held.y = end.y;
    try { lamp.setPointerCapture(ev.pointerId); } catch (e) {}
  });
  lamp.addEventListener("pointermove", function (ev) {
    if (grab && ev.pointerId === grab.id) grab.cur = toSvg(ev) || grab.cur;
  });
  lamp.addEventListener("pointerup", function (ev) { if (grab && ev.pointerId === grab.id) release(true); });
  lamp.addEventListener("pointercancel", function (ev) { if (grab && ev.pointerId === grab.id) release(false); });
  lamp.addEventListener("click", function (ev) {
    // A pointer press is handled on release; this is the keyboard, or no animation to grab.
    if (ev.detail > 0 && raf) return;
    if (!raf) { flip(); return; } // not animating (reduced motion, off screen): just switch
    if (pullStart !== null || grab) return;
    pullStart = performance.now();
    flipped = false;
  });
  dark.addEventListener("change", sync);
  still.addEventListener("change", function () {
    if (still.matches) { rest(); draw(); } else run();
  });
  // A hidden tab pauses frames rather than stopping them, so the one still pending
  // must not see where the window went in the meantime.
  document.addEventListener("visibilitychange", function () { origin = null; run(); });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      onScreen = entries[entries.length - 1].isIntersecting;
      run();
    }).observe(lamp);
  }
  run();
})();
