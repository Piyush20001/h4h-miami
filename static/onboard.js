/* StormCard first-run welcome overlay. Needs: onboard.css, i18n-onboard.js; gsap optional. */
(function () {
  "use strict";
  var KEY = "sc.onboarded";
  var NS = "http://www.w3.org/2000/svg";
  var STR = window.SC_ONBOARD || {};
  var BEAT_MS = 2500;

  function stored() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function store() { try { localStorage.setItem(KEY, "1"); } catch (e) { /* blocked */ } }
  var forced = /[?&]welcome=1/.test(location.search);
  if (stored() && !forced) return;

  var HAS_GSAP = typeof window.gsap !== "undefined";
  var lang = (window.SC && SC.guessLang) ? SC.guessLang() : (function () {
    var n = (navigator.language || "en").toLowerCase();
    return n.indexOf("ht") === 0 ? "kre" : n.indexOf("es") === 0 ? "es" : "en";
  })();
  if (!STR[lang]) lang = "en";
  function T(k, l) { var t = STR[l || lang] || STR.en; return t[k] !== undefined ? t[k] : STR.en[k]; }

  var beat = 0, timer = null, tl = null, mm = null, reduced = false, closed = false, lastFocus = document.activeElement;

  function el(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function h(tag, cls, parent, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  }

  /* ---------- build DOM ---------- */
  var root = h("div", "ob", document.body);
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-labelledby", "ob-title");
  var col = h("div", "ob-col", root);
  var top = h("div", "ob-top", col);
  var logo = h("img", "ob-logo", top);
  logo.src = "brand/stormcard-logo.png"; logo.alt = "StormCard";
  var skip = h("button", "ob-skip", top); skip.type = "button";

  var stage = h("div", "ob-stage", col);

  /* beat 1: tracking chart */
  var b1 = h("div", "ob-beat", stage);
  var svg1 = el("svg", { "class": "ob-art", viewBox: "0 0 320 230", "aria-hidden": "true", focusable: "false" }, b1);
  el("rect", { "class": "frame", x: 4, y: 4, width: 312, height: 222, rx: 6 }, svg1);
  var grid = el("g", { "class": "grid" }, svg1), i;
  for (i = 1; i < 8; i++) el("line", { x1: 4 + i * 39, y1: 4, x2: 4 + i * 39, y2: 226 }, grid);
  for (i = 1; i < 6; i++) el("line", { x1: 4, y1: 4 + i * 37, x2: 316, y2: 4 + i * 37 }, grid);
  var HX = 70, HY = 170;
  var SH = [[260, 170], [70, 55], [185, 55]];
  var routes = [];
  SH.forEach(function (p) { routes.push(el("line", { "class": "route", x1: HX, y1: HY, x2: p[0], y2: p[1] }, svg1)); });
  var home = el("g", { "class": "home-g" }, svg1);
  el("rect", { "class": "home", x: HX - 11, y: HY - 11, width: 22, height: 22, rx: 3 }, home);
  var pins = SH.map(function (p, n) {
    var g = el("g", {}, svg1);
    el("circle", { "class": "pin", cx: p[0], cy: p[1], r: 17 }, g);
    var t = el("text", { "class": "pin-n", x: p[0], y: p[1] + 5.5 }, g); t.textContent = String(n + 1);
    return g;
  });
  var homeLbl = el("text", { "class": "lbl", x: HX, y: HY + 34 }, svg1);

  /* beat 2: language */
  var b2 = h("div", "ob-beat ob-lang-art", stage);
  var word = h("div", "ob-bigword", b2); word.style.display = "none";
  var chips = h("div", "ob-chips", b2);
  var chipBtns = {};
  [["kre", "Kreyòl", "ht"], ["es", "Español", "es"], ["en", "English", "en"]].forEach(function (c) {
    var b = h("button", "ob-chip", chips, c[1]); b.type = "button"; b.lang = c[2];
    b.addEventListener("click", function (e) { e.stopPropagation(); pickLang(c[0]); });
    chipBtns[c[0]] = b;
  });

  /* beat 3: offline */
  var b3 = h("div", "ob-beat", stage);
  var svg3 = el("svg", { "class": "ob-art", viewBox: "0 0 320 200", "aria-hidden": "true", focusable: "false" }, b3);
  var wifi = el("g", {}, svg3);
  var arcs = [
    el("path", { "class": "ink", d: "M25 85 Q95 25 165 85" }, wifi),
    el("path", { "class": "ink", d: "M47 108 Q95 65 143 108" }, wifi),
    el("path", { "class": "ink", d: "M69 131 Q95 108 121 131" }, wifi)
  ];
  var wdot = el("circle", { "class": "dotf", cx: 95, cy: 152, r: 7 }, wifi);
  var slash = el("line", { "class": "ink", x1: 28, y1: 28, x2: 162, y2: 172, stroke: "#15293d" }, svg3);
  slash.style.strokeWidth = "8";
  var card = el("g", {}, svg3);
  var cardBox = el("rect", { "class": "ink", x: 205, y: 50, width: 96, height: 120, rx: 8, fill: "#ffffff" }, card);
  cardBox.style.fill = "#fff";
  el("line", { "class": "ink-sm", x1: 221, y1: 76, x2: 285, y2: 76 }, card);
  el("line", { "class": "ink-sm", x1: 221, y1: 94, x2: 265, y2: 94 }, card);
  var check = el("path", { "class": "ink", d: "M225 135 L242 151 L277 117", stroke: "#3d7556" }, card);

  /* text */
  var text = h("div", "ob-text", col);
  var title = h("h2", "ob-title", text); title.id = "ob-title";
  var titleSr = h("span", "ob-sr", title);
  titleSr.setAttribute("aria-live", "polite"); titleSr.setAttribute("aria-atomic", "true");
  var titleVis = h("span", "vis", title); titleVis.setAttribute("aria-hidden", "true");
  var cap = h("p", "ob-cap", text);
  var time = h("p", "ob-time", text);

  var foot = h("div", "ob-foot", col);
  var dots = h("div", "ob-dots", foot); dots.setAttribute("aria-hidden", "true");
  var dotEls = [0, 1, 2].map(function () { return h("span", "ob-dot", dots); });
  var go = h("button", "ob-go", foot); go.type = "button";

  var beats = [b1, b2, b3];

  /* ---------- text rendering ---------- */
  function renderText() {
    document.documentElement.getAttribute("lang");
    root.setAttribute("lang", ({ kre: "ht", es: "es", en: "en" })[lang]);
    skip.textContent = T("skip");
    time.textContent = T("time");
    go.textContent = beat === 2 ? T("start") : T("next");
    homeLbl.textContent = T("home");
    titleSr.textContent = T("b" + (beat + 1));
    if (!titleLocked) titleVis.textContent = T("b" + (beat + 1));
    cap.textContent = T("c" + (beat + 1));
    root.setAttribute("aria-label", T("dialog"));
    Object.keys(chipBtns).forEach(function (k) { chipBtns[k].setAttribute("aria-pressed", String(k === lang)); });
    dotEls.forEach(function (d, n) { d.className = "ob-dot" + (n === beat ? " on" : ""); });
  }
  var titleLocked = false;

  function pickLang(l) {
    lang = l;
    if (window.SC && SC.setLang) { try { SC.setLang(l); } catch (e) { /* ignore */ } }
    titleLocked = false;
    renderText();
    schedule();
  }

  /* ---------- beat animation ---------- */
  function killTl() { if (tl) { tl.kill(); tl = null; } }
  function resetFinal() {
    var all = [].slice.call(root.querySelectorAll("svg *, .ob-chip, .ob-title .vis"));
    if (HAS_GSAP) gsap.set(all, { clearProps: "all" });
    routes.forEach(function (r) { r.style.strokeDasharray = ""; r.style.strokeDashoffset = ""; });
    [slash].concat(arcs).forEach(function (n) { n.style.strokeDasharray = ""; n.style.strokeDashoffset = ""; });
    slash.style.strokeWidth = "8";
  }

  function len(n) { try { return n.getTotalLength(); } catch (e) { return 200; } }

  function animate() {
    killTl();
    titleLocked = false;
    renderText();
    resetFinal();
    if (!HAS_GSAP || reduced) return;
    tl = gsap.timeline({ defaults: { ease: "power2.out" } });
    if (beat === 0) {
      tl.from(logo, { y: -8, opacity: 0, duration: 0.35 }, 0)
        .from(grid.children, { opacity: 0, duration: 0.4, stagger: 0.03 }, 0.05)
        .from(home, { y: -40, opacity: 0, duration: 0.45, ease: "back.out(1.4)", transformOrigin: "50% 50%" }, 0.35);
      routes.forEach(function (r, n) {
        var L = len(r);
        gsap.set(r, { strokeDasharray: L, strokeDashoffset: L });
      });
      /* routes at 0 / 45 / 90 degrees, in order, then pins pop */
      var order = [1, 2, 0];
      order.forEach(function (idx, n) {
        tl.to(routes[idx], { strokeDashoffset: 0, duration: 0.45 }, 0.8 + n * 0.12);
        tl.from(pins[idx], { scale: 0, opacity: 0, duration: 0.4, ease: "back.out(1.4)", transformOrigin: "50% 50%", svgOrigin: SH[idx][0] + " " + SH[idx][1] }, 1.05 + n * 0.1);
      });
      tl.from(homeLbl, { opacity: 0, duration: 0.3 }, 1.2);
    } else if (beat === 1) {
      titleLocked = true;
      var seq = ["kre", "es", "en"];
      if (lang !== "en") seq.push(lang);
      seq.forEach(function (l, n) {
        var t0 = n * 0.6;
        tl.call(function () { titleVis.textContent = T("b2", l); titleVis.setAttribute("lang", ({ kre: "ht", es: "es", en: "en" })[l]); }, null, t0);
        tl.fromTo(titleVis, { yPercent: 100, opacity: 1 }, { yPercent: 0, duration: 0.25 }, t0);
        if (n < seq.length - 1) tl.to(titleVis, { yPercent: -100, duration: 0.2, ease: "power2.in" }, t0 + 0.4);
      });
      tl.call(function () { titleLocked = false; titleVis.removeAttribute("lang"); renderText(); });
      tl.from(chips.children, { y: 16, opacity: 0, duration: 0.35, stagger: 0.1 }, 0.3);
    } else {
      arcs.forEach(function (a) { var L = len(a); gsap.set(a, { strokeDasharray: L, strokeDashoffset: L }); });
      var SL = len(slash);
      gsap.set(slash, { strokeDasharray: SL, strokeDashoffset: SL });
      var CL = len(check);
      gsap.set(check, { strokeDasharray: CL, strokeDashoffset: CL });
      tl.from(wdot, { scale: 0, opacity: 0, duration: 0.25, transformOrigin: "50% 50%", svgOrigin: "95 152" }, 0)
        .to(arcs.slice().reverse(), { strokeDashoffset: 0, duration: 0.4, stagger: 0.1 }, 0.15)
        .to(slash, { strokeDashoffset: 0, duration: 0.45 }, 0.9)
        .from(card, { y: 14, opacity: 0, duration: 0.4 }, 0.3)
        .to(check, { strokeDashoffset: 0, duration: 0.4 }, 1.2);
    }
  }

  /* ---------- flow ---------- */
  function schedule() {
    clearTimeout(timer);
    if (beat < 2 && !closed) timer = setTimeout(function () { show(beat + 1); }, BEAT_MS);
  }
  function show(n) {
    beat = n;
    beats.forEach(function (b, i) { b.hidden = i !== n; });
    animate();
    schedule();
  }
  function advance() { if (beat < 2) show(beat + 1); else finish(); }

  function setInert(on) {
    [].forEach.call(document.body.children, function (c) {
      if (c === root) return;
      if (on) { c.setAttribute("inert", ""); c.setAttribute("data-ob-inert", "1"); }
      else if (c.getAttribute("data-ob-inert")) { c.removeAttribute("inert"); c.removeAttribute("data-ob-inert"); }
    });
  }

  function close(focusLang) {
    if (closed) return;
    closed = true;
    clearTimeout(timer); killTl();
    store();
    document.removeEventListener("keydown", onKey, true);
    function done() {
      setInert(false);
      if (mm) mm.revert();
      root.remove();
      var target = focusLang && document.querySelector("#s-lang button") || lastFocus;
      if (target && target.focus) target.focus();
    }
    if (HAS_GSAP && !reduced) {
      gsap.to(root, { y: -24, opacity: 0, duration: 0.3, ease: "power2.out", onComplete: done });
    } else done();
  }
  function finish() { close(true); }

  function onKey(e) {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(true); return; }
    if (e.key !== "Tab") return;
    var f = [].filter.call(root.querySelectorAll("button"), function (b) { return b.offsetParent !== null; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (!root.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  skip.addEventListener("click", function () { close(true); });
  go.addEventListener("click", advance);
  stage.addEventListener("click", function () { if (beat < 2) advance(); });
  document.addEventListener("keydown", onKey, true);

  /* ---------- start ---------- */
  setInert(true);
  if (HAS_GSAP && gsap.matchMedia) {
    mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: reduce)", function () { reduced = true; if (tl) animate(); return function () { reduced = false; }; });
    mm.add("(prefers-reduced-motion: no-preference)", function () { reduced = false; });
  }
  show(0);
  go.focus();
})();
