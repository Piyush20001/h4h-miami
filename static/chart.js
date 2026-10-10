/* StormCard chart: inline SVG, equirectangular projection fitted to the points.
   Draws the local surge-zone polygons; no streets or routes (we have no road data). */
(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  var W = 360, H = 290;
  var PAD = { l: 26, r: 40, t: 26, b: 44 };

  function el(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(n);
    return n;
  }

  function niceStep(span) {
    var steps = [0.005, 0.01, 0.02, 0.05, 0.1, 0.2];
    for (var i = 0; i < steps.length; i++) if (span / steps[i] <= 4) return steps[i];
    return 0.5;
  }

  function fmt(v, step) {
    var d = step < 0.01 ? 3 : step < 0.1 ? 2 : 1;
    return Math.abs(v).toFixed(d);
  }

  /* small square bus marker (sign blue), half = half side length */
  function busGlyph(g, half) {
    var k = half / 11;
    el("rect", { x: -half, y: -half, width: half * 2, height: half * 2, rx: 2 }, g);
    el("path", { d: "M" + (-6 * k) + " " + (-4.500 * k) + "H" + (6 * k) + "V" + (3 * k) + "H" + (-6 * k) + "ZM" + (-6 * k) + " " + (-0.500 * k) + "H" + (6 * k), "class": "c-busline" }, g);
    el("path", { d: "M" + (-3.500 * k) + " " + (5.500 * k) + "V" + (3 * k) + "M" + (3.500 * k) + " " + (5.500 * k) + "V" + (3 * k), "class": "c-busline" }, g);
    return g;
  }

  function r1(n) { return Math.round(n * 10) / 10; }

  /* surge zones come from our own server, so they draw with the internet down */
  var roadsP = null;
  function roads() {
    if (!roadsP) {
      roadsP = fetch("/api/roads").then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { roadsP = null; return null; });
    }
    return roadsP;
  }
  function roadName(n) {
    return String(n || "").replace(/^I (\d+).*$/, "I-$1").replace(/ EXPY$| EXT$/, "").replace(/^FLORIDA TPKE.*$/, "TURNPIKE");
  }
  var zonesP = null;
  function zones() {
    if (!zonesP) {
      zonesP = fetch("/api/zones").then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { zonesP = null; return null; });
    }
    return zonesP;
  }

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
    var bus = (opts.bus || []).filter(function (s) {
      return typeof s.lat === "number" && typeof s.lng === "number";
    }).slice(0, 2);
    if (opts.focusBus && bus.length) { shelters = []; special = []; }
    var pts = [home].concat(shelters, special, bus);

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

    var clipId = "cclip" + Math.random().toString(36).slice(2, 8);
    var cp = el("clipPath", { id: clipId }, el("defs", null, svg));
    el("rect", { x: 0, y: 0, width: W, height: H }, cp);
    var grid = el("g", { "class": "c-grid" }, svg);
    var zoneLayer = el("g", { "class": "c-zones", "clip-path": "url(#" + clipId + ")" }, grid);
    var lngLo = cLng - ox / (k * scale), lngHi = cLng + (W - ox) / (k * scale);
    var latHi = cLat + oy / scale, latLo = cLat - (H - oy) / scale;
    var homeZone = opts.zone ? String(opts.zone).toUpperCase() : "";
    zones().then(function (gj) {
      if (!gj || !gj.features) return;
      gj.features.forEach(function (f) {
        var z = String((f.properties || {}).zone || "").toUpperCase();
        var g = f.geometry || {};
        var polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
        var d = "";
        polys.forEach(function (poly) {
          poly.forEach(function (ring) {
            var inView = false, seg = "", lx = null, ly = null;
            ring.forEach(function (c) {
              if (c[0] >= lngLo && c[0] <= lngHi && c[1] >= latLo && c[1] <= latHi) inView = true;
              var X = px(c[0]), Y = py(c[1]);
              if (lx !== null && Math.abs(X - lx) < 1.2 && Math.abs(Y - ly) < 1.2) return;
              seg += (seg ? "L" : "M") + X + " " + Y; lx = X; ly = Y;
            });
            if (inView) d += seg + "Z";
          });
        });
        if (d) el("path", { d: d, "fill-rule": "evenodd", "class": "c-z c-z" + z + (z === homeZone ? " is-home" : "") }, zoneLayer);
      });
    });
    var roadLayer = el("g", { "class": "c-roads", "clip-path": "url(#" + clipId + ")" }, grid);
    var roadLabels = el("g", { "class": "c-roadlbl" }, svg);
    roads().then(function (gj) {
      if (!gj || !gj.features) return;
      var best = {};
      var byClass = [[], [], [], []];
      gj.features.forEach(function (f) {
        var c = f.geometry.coordinates, cls = Math.min(3, f.properties.c | 0);
        var inView = false, d = "", lx = null, ly = null, len = 0, mid = null;
        for (var i = 0; i < c.length; i++) {
          if (c[i][0] >= lngLo && c[i][0] <= lngHi && c[i][1] >= latLo && c[i][1] <= latHi) inView = true;
          var X = px(c[i][0]), Y = py(c[i][1]);
          if (lx !== null) {
            var sl = Math.abs(X - lx) + Math.abs(Y - ly);
            if (sl < 1) continue;
            len += sl;
          }
          d += (d ? "L" : "M") + X + " " + Y; lx = X; ly = Y;
        }
        if (!inView || !d) return;
        byClass[cls].push(d);
        var nm = roadName(f.properties.n);
        var m = c[Math.floor(c.length / 2)];
        var mx = px(m[0]), my = py(m[1]);
        if (nm && mx > 20 && mx < W - 20 && my > 20 && my < H - 40 && (!best[nm] || len > best[nm].len)) best[nm] = { len: len, x: mx, y: my, c: cls };
      });
      /* the county joins many short pieces per road: keep the longest visible run per name */
      [3, 2, 1, 0].forEach(function (cls) {
        if (byClass[cls].length) el("path", { d: byClass[cls].join(""), "class": "c-road c-r" + cls }, roadLayer);
      });
      /* a few street names, biggest roads first, never on top of each other or a marker */
      var taken = [h].concat(spots).concat((typeof boxes !== "undefined" ? boxes : []).map(function (b) { return { x: b.x + b.w / 2, y: b.y + b.h / 2, w: b.w }; }));
      Object.keys(best).map(function (k) { return { n: k, b: best[k] }; })
        .filter(function (o) { return o.b.len > 22; })
        .sort(function (a, b) { return a.b.c - b.b.c || b.b.len - a.b.len; })
        .slice(0, 24)
        .forEach(function (o) {
          var w = o.n.length * 6.4 + 8;
          var clash = taken.some(function (q) { return Math.abs(q.x - o.b.x) < (q.w || 30) / 2 + w / 2 && Math.abs(q.y - o.b.y) < 22; });
          if (clash || taken.length > 26) return;
          taken.push({ x: o.b.x, y: o.b.y, w: w });
          var t = el("text", { x: o.b.x, y: o.b.y + 4, "text-anchor": "middle", "class": o.b.c <= 1 ? "is-hwy" : "" }, roadLabels);
          t.textContent = o.n;
        });
    });
    var na = el("g", { "class": "c-north", transform: "translate(" + (W - 22) + " 26)" }, svg);
    el("path", { d: "M0 -12L6 6L0 2L-6 6Z" }, na);
    el("text", { y: 20, "text-anchor": "middle" }, na).textContent = "N";

    var h = { x: px(home.lng), y: py(home.lat) };
    var routes = [], markers = [];
    var routeLayer = el("g", null, svg);
    var markLayer = el("g", null, svg);

    /* marker positions, nudged apart so no two are closer than 28px (home is fixed) */
    var spots = shelters.concat(special, bus).map(function (s) { return { x: px(s.lng), y: py(s.lat) }; });
    var MIN = 32;
    for (var pass = 0; pass < 12; pass++) {
      var moved = false;
      for (var a = 0; a < spots.length; a++) {
        var others = [h].concat(spots.filter(function (_, j) { return j !== a; }));
        for (var b = 0; b < others.length; b++) {
          var dx = spots[a].x - others[b].x, dy = spots[a].y - others[b].y;
          var dd = Math.sqrt(dx * dx + dy * dy);
          if (dd < MIN) {
            if (dd < 0.5) { dx = 1; dy = 0.6; dd = Math.sqrt(dx * dx + dy * dy); }
            var push = (MIN - dd) * (b === 0 ? 1 : 0.5) + 0.5;
            spots[a].x += (dx / dd) * push; spots[a].y += (dy / dd) * push;
            moved = true;
          }
        }
        spots[a].x = Math.min(W - 16, Math.max(16, spots[a].x));
        spots[a].y = Math.min(H - 16, Math.max(16, spots[a].y));
      }
      if (!moved) break;
    }
    spots.forEach(function (q) { q.x = r1(q.x); q.y = r1(q.y); });
    /* markers keep their true spot: when nudged apart, a dot marks the real place and a thin line joins them */
    var orig = shelters.concat(special, bus).map(function (s) { return { x: px(s.lng), y: py(s.lat) }; });
    function leader(o, q) {
      var g = el("g", { "class": "c-lead" }, routeLayer);
      if (Math.abs(o.x - q.x) + Math.abs(o.y - q.y) > 3) {
        el("path", { d: "M" + o.x + " " + o.y + "L" + q.x + " " + q.y }, g);
        el("circle", { cx: o.x, cy: o.y, r: 3 }, g);
      }
      return g;
    }

    /* home first, so shelter numbers always sit on top */
    var hg = el("g", { transform: "translate(" + h.x + " " + h.y + ")" }, markLayer);
    var hin = el("g", { "class": "c-home" }, hg);
    el("rect", { x: -13, y: -13, width: 26, height: 26, rx: 3 }, hin);
    el("path", { d: "M-7 2L0-6L7 2M-5 1V8H5V1", "class": "c-roof" }, hin);

    /* label: pick the side whose box keeps 40px from every marker, inside the frame */
    var lw = String(opts.labels.home || "").length * 9.6 + 6, lh = 16, gap = 20;
    var cands = [
      { x: h.x + gap, y: h.y - lh / 2, a: "start", ox: gap, oy: 5 },
      { x: h.x - gap - lw, y: h.y - lh / 2, a: "end", ox: -gap, oy: 5 },
      { x: h.x - lw / 2, y: h.y - 22 - lh, a: "middle", ox: 0, oy: -26 },
      { x: h.x - lw / 2, y: h.y + 22, a: "middle", ox: 0, oy: 36 },
      { x: h.x - 13, y: h.y + 20, a: "start", ox: -13, oy: 34 },
      { x: h.x + 13 - lw, y: h.y - 20 - lh, a: "end", ox: 13, oy: -24 }
    ];
    function boxDist(c, q) {
      var dx = Math.max(c.x - q.x, 0, q.x - (c.x + lw)), dy = Math.max(c.y - q.y, 0, q.y - (c.y + lh));
      return Math.sqrt(dx * dx + dy * dy);
    }
    var best = null, bestScore = -1;
    cands.forEach(function (c) {
      var inside = c.x >= 2 && c.x + lw <= W - 2 && c.y >= 2 && c.y + lh <= H - 2;
      var sc = spots.reduce(function (m, q) { return Math.min(m, boxDist(c, q)); }, 40);
      if (!inside) sc = Math.min(sc, 1) - 100;
      if (sc > bestScore + 0.01) { best = c; bestScore = sc; }
    });
    var lab = el("text", { x: best.ox, y: best.oy, "text-anchor": best.a, "class": "c-homelabel" }, hin);
    lab.textContent = opts.labels.home;

    shelters.forEach(function (s, idx) {
      var p = spots[idx];
      var delay = 250 + idx * 130;
      routes.push(leader(orig[idx], p));
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

    special.forEach(function (s, si0) {
      var sp = spots[shelters.length + si0];
      var sg = el("g", { transform: "translate(" + sp.x + " " + sp.y + ")" }, markLayer);
      var si = el("g", { "class": "c-special" }, sg);
      el("rect", { x: -11, y: -11, width: 22, height: 22, transform: "rotate(45)" }, si);
      el("path", { d: "M-5 0H5M0-5V5" }, si);
    });

    bus.forEach(function (s, bi) {
      var bp = spots[shelters.length + special.length + bi];
      var bg = el("g", { transform: "translate(" + bp.x + " " + bp.y + ")" }, markLayer);
      leader(orig[shelters.length + special.length + bi], bp);
      busGlyph(el("g", { "class": "c-bus" + (bi === 0 ? " is-near" : "") }, bg), bi === 0 ? 13 : 10);
    });

    /* short names beside shelters and bus stops, so the map reads without the list */
    var named = shelters.length ? shelters.map(function (s, i) { return { s: s, p: spots[i] }; })
      : bus.map(function (s, i) { return { s: s, p: spots[special.length + i] }; });
    var boxes = [{ x: h.x - 16, y: h.y - 16, w: 32, h: 32 }];
    if (best) boxes.push({ x: h.x + best.ox - (best.a === "end" ? lw : best.a === "middle" ? lw / 2 : 0), y: h.y + best.oy - 13, w: lw, h: 16 });
    spots.forEach(function (q) { boxes.push({ x: q.x - 14, y: q.y - 14, w: 28, h: 28 }); });
    function hits(r) {
      return r.x < 2 || r.x + r.w > W - 2 || boxes.some(function (o) { return r.x < o.x + o.w && o.x < r.x + r.w && r.y < o.y + o.h && o.y < r.y + r.h; });
    }
    named.forEach(function (o) {
      var nm = String(o.s.name || "").replace(/\s+(Senior )?(High|Middle|Elementary|K-8).*$/i, "").replace(/ Trailer Park.*$/i, "");
      if (!nm) return;
      if (nm.length > 16) nm = nm.slice(0, 15) + "…";
      var w = nm.length * 6.9 + 4;
      var cands = [
        { x: o.p.x + 17, y: o.p.y - 7, a: "start", tx: o.p.x + 17 },
        { x: o.p.x - 17 - w, y: o.p.y - 7, a: "end", tx: o.p.x - 17 },
        { x: o.p.x - w / 2, y: o.p.y + 16, a: "middle", tx: o.p.x },
        { x: o.p.x - w / 2, y: o.p.y - 30, a: "middle", tx: o.p.x }
      ];
      for (var ci = 0; ci < cands.length; ci++) {
        var c = cands[ci], r = { x: c.x, y: c.y, w: w, h: 15 };
        if (hits(r)) continue;
        boxes.push(r);
        el("text", { x: c.tx, y: c.y + 11.5, "text-anchor": c.a, "class": "c-placelbl" }, markLayer).textContent = nm;
        return;
      }
    });

    /* distance scale bar */
    var pxPerMi = scale / 69.05, miles = 1, opts2 = [0.25, 0.5, 1, 2, 5, 10];
    for (var m = 0; m < opts2.length; m++) { miles = opts2[m]; if (opts2[m] * pxPerMi >= 44) break; }
    var bw = r1(miles * pxPerMi), by = H - 12;
    var sb = el("g", { "class": "c-scale" }, svg);
    el("path", { d: "M14 " + (by - 5) + "V" + by + "H" + (14 + bw) + "V" + (by - 5) }, sb);
    var st2 = el("text", { x: 14 + bw + 8, y: by + 1 }, sb);
    st2.textContent = String(miles) + " " + (opts.labels.mi || "mi");

    if (special.length || bus.length) {
      var lg = el("g", { "class": "c-legend" }, svg);
      var rx = W - 10;
      if (bus.length) {
        var bl = String(opts.labels.bus || "");
        el("text", { x: rx, y: by + 1, "text-anchor": "end" }, lg).textContent = bl;
        var bx = rx - bl.length * 7.6 - 14;
        busGlyph(el("g", { "class": "c-bus", transform: "translate(" + r1(bx) + " " + (by - 4) + ")" }, lg), 7);
        rx = bx - 20;
      }
      if (special.length) {
        var lt = el("text", { x: rx, y: by + 1, "text-anchor": "end" }, lg);
        lt.textContent = opts.labels.special || "";
        var lx = rx - String(opts.labels.special || "").length * 7.6 - 16;
        var ld = el("g", { "class": "c-special", transform: "translate(" + r1(lx) + " " + (by - 4) + ")" }, lg);
        el("rect", { x: -7, y: -7, width: 14, height: 14, transform: "rotate(45)" }, ld);
        el("path", { d: "M-3.5 0H3.5M0-3.5V3.5" }, ld);
      }
    }

    host.appendChild(svg);
    if (opts.labels.cap) {
      var cap = document.createElement("p");
      cap.className = "c-cap";
      cap.textContent = opts.labels.cap;
      host.appendChild(cap);
    }

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
