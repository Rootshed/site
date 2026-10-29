// Theme switch: a bulb on a wire with a pull chain. The chain is a small verlet
// rope; hover sways it, a click yanks it and flips the theme.
(function () {
  var lamp = document.querySelector(".lamp");
  if (!lamp) return;
  var root = document.documentElement;
  var NS = "http://www.w3.org/2000/svg";
  var chainEl = lamp.querySelector(".lamp__chain");
  var bulbEl = lamp.querySelector(".lamp__bulb");
  var dark = window.matchMedia("(prefers-color-scheme: dark)");
  var still = window.matchMedia("(prefers-reduced-motion: reduce)");

  var LINKS = 8, GAP = 20, STEP = 1000 / 60;
  var PIVOT = { x: 60, y: 8 }, HOLE = { x: 86, y: 94 }, STRING = 8;
  var PULL = 24, PULL_MS = 130, RELEASE_MS = 70;

  var pts = [], links = [], knob, string, hit, hitKnob;
  var angle = 0, angleVel = 0;
  var pullStart = null, flipped = false;
  var raf = 0, last = 0, acc = 0, holeNow = { x: HOLE.x, y: HOLE.y };

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

  function build() {
    for (var i = 0; i <= LINKS; i++) {
      var y = HOLE.y + STRING + i * GAP;
      pts.push({ x: HOLE.x, y: y, px: HOLE.x, py: y });
    }
    string = document.createElementNS(NS, "line");
    string.setAttribute("class", "lamp__wire");
    chainEl.appendChild(string);
    for (var j = 0; j < LINKS; j++) {
      var e = document.createElementNS(NS, "ellipse");
      e.setAttribute("class", "lamp__link");
      e.setAttribute("rx", j % 2 ? "2.2" : "4.5");
      e.setAttribute("ry", "9");
      chainEl.appendChild(e);
      links.push(e);
    }
    knob = document.createElementNS(NS, "g");
    var body = document.createElementNS(NS, "path");
    body.setAttribute("class", "lamp__knob");
    body.setAttribute("d", "M-8 3 Q-13 26 0 33 Q13 26 8 3 Z");
    hitKnob = document.createElementNS(NS, "circle");
    hitKnob.setAttribute("class", "lamp__hit lamp__hit--knob");
    hitKnob.setAttribute("cy", "18");
    hitKnob.setAttribute("r", "16");
    knob.appendChild(body);
    knob.appendChild(hitKnob);
    hit = document.createElementNS(NS, "path");
    hit.setAttribute("class", "lamp__hit");
    chainEl.appendChild(hit);
    chainEl.appendChild(knob);
  }

  function anchor(now) {
    var down = 0;
    if (pullStart !== null) {
      var t = now - pullStart;
      if (t < PULL_MS) down = PULL * (1 - Math.pow(1 - t / PULL_MS, 3));
      else if (t < PULL_MS + RELEASE_MS) down = PULL * (1 - (t - PULL_MS) / RELEASE_MS);
      else pullStart = null;
      if (!flipped && t >= PULL_MS) { flipped = true; flip(); }
    }
    var a = angle * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    var dx = HOLE.x - PIVOT.x, dy = HOLE.y - PIVOT.y;
    var hole = { x: PIVOT.x + dx * c - dy * s, y: PIVOT.y + dx * s + dy * c };
    // The string slides out of the socket as the chain is pulled, so it stays connected.
    return { x: hole.x, y: hole.y + STRING + down, hole: hole };
  }

  function step(now) {
    var a = anchor(now), p = pts[0];
    p.x = p.px = a.x; p.y = p.py = a.y;
    holeNow = a.hole;
    angleVel += -0.04 * angle - 0.05 * angleVel;
    angle += angleVel;
    for (var i = 1; i < pts.length; i++) {
      var q = pts[i], vx = (q.x - q.px) * 0.985, vy = (q.y - q.py) * 0.985;
      q.px = q.x; q.py = q.y;
      q.x += vx; q.y += vy + 0.6;
    }
    for (var k = 0; k < 8; k++) {
      for (var m = 1; m < pts.length; m++) {
        var u = pts[m - 1], v = pts[m];
        var ex = v.x - u.x, ey = v.y - u.y, d = Math.sqrt(ex * ex + ey * ey) || 1;
        var diff = (d - GAP) / d;
        if (m === 1) { v.x -= ex * diff; v.y -= ey * diff; }
        else { u.x += ex * diff / 2; u.y += ey * diff / 2; v.x -= ex * diff / 2; v.y -= ey * diff / 2; }
      }
    }
  }

  function draw() {
    string.setAttribute("x1", holeNow.x.toFixed(2));
    string.setAttribute("y1", holeNow.y.toFixed(2));
    string.setAttribute("x2", pts[0].x.toFixed(2));
    string.setAttribute("y2", pts[0].y.toFixed(2));
    var d = "M" + holeNow.x.toFixed(1) + " " + holeNow.y.toFixed(1);
    for (var n = 0; n <= LINKS; n++) d += " L" + pts[n].x.toFixed(1) + " " + pts[n].y.toFixed(1);
    hit.setAttribute("d", d);
    for (var i = 0; i < LINKS; i++) {
      var u = pts[i], v = pts[i + 1];
      var cx = (u.x + v.x) / 2, cy = (u.y + v.y) / 2;
      var deg = Math.atan2(v.y - u.y, v.x - u.x) * 180 / Math.PI - 90;
      links[i].setAttribute("transform", "translate(" + cx.toFixed(2) + " " + cy.toFixed(2) + ") rotate(" + deg.toFixed(1) + ")");
    }
    var e = pts[LINKS], f = pts[LINKS - 1];
    var kd = Math.atan2(e.y - f.y, e.x - f.x) * 180 / Math.PI - 90;
    knob.setAttribute("transform", "translate(" + e.x.toFixed(2) + " " + e.y.toFixed(2) + ") rotate(" + kd.toFixed(1) + ")");
    bulbEl.setAttribute("transform", "rotate(" + angle.toFixed(2) + " " + PIVOT.x + " " + PIVOT.y + ")");
  }

  function settled() {
    if (pullStart !== null || Math.abs(angle) > 0.05 || Math.abs(angleVel) > 0.01) return false;
    for (var i = 1; i < pts.length; i++) {
      // Slow is not settled: a swing is also slow at its far end, so require it to hang straight.
      if (Math.abs(pts[i].x - pts[i].px) > 0.02 || Math.abs(pts[i].y - pts[i].py) > 0.02) return false;
      if (Math.abs(pts[i].x - holeNow.x) > 0.3) return false;
    }
    return true;
  }

  function frame(now) {
    acc += Math.min(now - last, 100);
    last = now;
    while (acc >= STEP) { step(now); acc -= STEP; }
    draw();
    if (settled()) { raf = 0; return; }
    raf = requestAnimationFrame(frame);
  }

  function run() {
    if (raf) return;
    last = performance.now();
    acc = 0;
    raf = requestAnimationFrame(frame);
  }

  build();
  step(performance.now());
  draw();
  sync();
  lamp.hidden = false;

  // The pointer drives the chain: its position picks which links it touches and
  // its movement is the push, so a slow drag nudges and a fast swipe whips.
  var svg = lamp.querySelector("svg");
  function push(ev) {
    if (still.matches || ev.pointerType !== "mouse" || pullStart !== null) return;
    var m = svg.getScreenCTM();
    if (!m) return;
    var at = svg.createSVGPoint();
    at.x = ev.clientX;
    at.y = ev.clientY;
    at = at.matrixTransform(m.inverse());
    var k = 1 / m.a;
    var vx = Math.max(-8, Math.min(8, ev.movementX * k));
    var vy = Math.max(-8, Math.min(8, ev.movementY * k));
    if (!vx && !vy) return;
    for (var i = 1; i < pts.length; i++) {
      var cy = i === LINKS ? pts[i].y + 16 : pts[i].y;
      var d = Math.hypot(pts[i].x - at.x, cy - at.y);
      var w = Math.max(0, 1 - d / 28);
      pts[i].x += vx * w * 0.7;
      pts[i].y += vy * w * 0.7;
    }
    run();
  }
  hit.addEventListener("pointermove", push);
  hitKnob.addEventListener("pointermove", push);
  lamp.addEventListener("click", function () {
    if (still.matches) { flip(); return; }
    if (pullStart !== null) return;
    pullStart = performance.now();
    flipped = false;
    angleVel -= 0.9;
    run();
  });
  dark.addEventListener("change", sync);
})();
