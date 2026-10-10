/* StormCard chart: inline SVG, equirectangular projection fitted to the points.
   Routes use only 0/45/90 degree segments. No external requests. */
(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  var W = 360, H = 300;
  var PAD = { l: 60, r: 30, t: 26, b: 34 };

  function el(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(n);
    return n;
  }

  function niceStep(span) {
    var steps = [0.005, 0.01, 0.02, 0.05, 0.1, 0.2];
    for (var i = 0; i < steps.length; i++) if (span / steps[i] <= 5) return steps[i];
    return 0.5;
  }

  function fmt(v, step) {
    var d = step < 0.01 ? 3 : step < 0.1 ? 2 : 1;
    return Math.abs(v).toFixed(d);
  }

  function routePath(h, s, straightFirst) {
    var dx = s.x - h.x, dy = s.y - h.y;
    var ax = Math.abs(dx), ay = Math.abs(dy);
    var d = Math.min(ax, ay);
    var sx = dx < 0 ? -1 : 1, sy = dy < 0 ? -1 : 1;
    var diag = { x: h.x + sx * d, y: h.y + sy * d };
    if (d < 1) return "M" + h.x + " " + h.y + "L" + s.x + " " + s.y;
    if (!straightFirst || ax === ay) {
      return "M" + h.x + " " + h.y + "L" + diag.x + " " + diag.y + "L" + s.x + " " + s.y;
    }
    /* straight run first, then the 45 degree leg into the shelter */
    var mid = ax > ay ? { x: s.x - sx * d, y: h.y } : { x: h.x, y: s.y - sy * d };
    return "M" + h.x + " " + h.y + "L" + mid.x + " " + mid.y + "L" + s.x + " " + s.y;
  }

  function r1(n) { return Math.round(n * 10) / 10; }

  /* opts: {home:{lat,lng}, shelters:[{lat,lng}], labels:{home, aria}, animate:bool, onSelect(i|-1)} */
  function render(host, opts) {
    host.textContent = "";
    var shelters = (opts.shelters || []).filter(function (s) {
      return typeof s.lat === "number" && typeof s.lng === "number";
    });
    var home = opts.home;
    var special = (opts.special || []).filter(function (s) {
      return typeof s.lat === "number" && typeof s.lng === "number";
    });
    var pts = [home].concat(shelters, special);

    var minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    pts.forEach(function (p) {
      minLat = Math.min(minLat, p.lat); maxLat = Math.max(maxLat, p.lat);
      minLng = Math.min(minLng, p.lng); maxLng = Math.max(maxLng, p.lng);
    });
    var k = Math.cos((home.lat * Math.PI) / 180);
    var spanY = Math.max(maxLat - minLat, 0.03);
    var spanX = Math.max((maxLng - minLng) * k, 0.03);
    var cLat = (minLat + maxLat) / 2, cLng = (minLng + maxLng) / 2;
    var innerW = W - PAD.l - PAD.r, innerH = H - PAD.t - PAD.b;
    var scale = Math.min(innerW / (spanX * 1.12), innerH / (spanY * 1.12));
    var ox = PAD.l + innerW / 2, oy = PAD.t + innerH / 2;

    function px(lng) { return r1(ox + (lng - cLng) * k * scale); }
    function py(lat) { return r1(oy - (lat - cLat) * scale); }

    var svg = el("svg", {
      viewBox: "0 0 " + W + " " + H,
      role: "img",
      "aria-label": opts.labels.aria,
      "class": "chart-svg" + (opts.animate ? " is-anim" : "")
    });

    /* grid, with degree labels */
    var grid = el("g", { "class": "c-grid" }, svg);
    var latHi = cLat + (oy - PAD.t) / scale, latLo = cLat - (H - PAD.b - oy) / scale;
    var lngLo = cLng - (ox - PAD.l) / (k * scale), lngHi = cLng + (W - PAD.r - ox) / (k * scale);
    var latStep = niceStep(latHi - latLo), lngStep = niceStep(lngHi - lngLo);
    var i, v, x, y;
    for (v = Math.ceil(latLo / latStep) * latStep; v <= latHi + 1e-9; v += latStep) {
      y = py(v);
      el("line", { x1: PAD.l, x2: W - PAD.r, y1: y, y2: y }, grid);
      var tl = el("text", { x: PAD.l - 6, y: y + 4, "text-anchor": "end" }, grid);
      tl.textContent = fmt(v, latStep) + "°N";
    }
    for (v = Math.ceil(lngLo / lngStep) * lngStep; v <= lngHi + 1e-9; v += lngStep) {
      x = px(v);
      el("line", { x1: x, x2: x, y1: PAD.t, y2: H - PAD.b }, grid);
      var tg = el("text", { x: x, y: H - PAD.b + 17, "text-anchor": "middle" }, grid);
      tg.textContent = fmt(v, lngStep) + "°W";
    }
    el("rect", { x: PAD.l, y: PAD.t, width: innerW, height: innerH, "class": "c-frame" }, grid);

    var h = { x: px(home.lng), y: py(home.lat) };
    var routes = [], markers = [];
    var routeLayer = el("g", null, svg);
    var markLayer = el("g", null, svg);

    shelters.forEach(function (s, idx) {
      var p = { x: px(s.lng), y: py(s.lat) };
      var delay = 250 + idx * 130;
      var path = el("path", {
        d: routePath(h, p, idx % 2 === 1),
        pathLength: 1,
        "class": "c-route",
        style: "animation-delay:" + delay + "ms"
      }, routeLayer);
      routes.push(path);
      var g = el("g", { transform: "translate(" + p.x + " " + p.y + ")" }, markLayer);
      var inner = el("g", {
        "class": "c-shelter",
        style: "animation-delay:" + (delay + 330) + "ms"
      }, g);
      el("circle", { r: 13 }, inner);
      var tx = el("text", { y: 6, "text-anchor": "middle" }, inner);
      tx.textContent = String(idx + 1);
      markers.push(g);
    });

    special.forEach(function (s) {
      var sg = el("g", { transform: "translate(" + px(s.lng) + " " + py(s.lat) + ")" }, markLayer);
      var si = el("g", { "class": "c-special" }, sg);
      el("rect", { x: -11, y: -11, width: 22, height: 22, transform: "rotate(45)" }, si);
      el("path", { d: "M-5 0H5M0-5V5" }, si);
    });

    /* home marker: square plate with a roof, label offset away from the edge */
    var hg = el("g", { transform: "translate(" + h.x + " " + h.y + ")" }, markLayer);
    var hin = el("g", { "class": "c-home" }, hg);
    el("rect", { x: -13, y: -13, width: 26, height: 26, rx: 3 }, hin);
    el("path", { d: "M-7 2L0-6L7 2M-5 1V8H5V1", "class": "c-roof" }, hin);
    var left = h.x > W * 0.55;
    var lab = el("text", {
      x: left ? -20 : 20,
      y: h.y > H - PAD.b - 30 ? -18 : 5,
      "text-anchor": left ? "end" : "start",
      "class": "c-homelabel"
    }, hin);
    lab.textContent = opts.labels.home;

    host.appendChild(svg);

    var sel = -1;
    function select(i) {
      sel = i === sel ? -1 : i;
      svg.classList.toggle("has-sel", sel >= 0);
      routes.forEach(function (r, j) { r.classList.toggle("is-on", j === sel); });
      markers.forEach(function (m, j) { m.classList.toggle("is-on", j === sel); });
      return sel;
    }
    return { select: select, get selected() { return sel; } };
  }

  window.StormChart = { render: render };
})();
