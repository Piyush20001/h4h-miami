/* StormCard flow + card screen. Model text is only ever rendered with textContent. */
(function () {
  "use strict";
  var SC = window.SC, st = SC.state, t = SC.t;
  var KEY = "stormcard.saved.v1";
  var MEDKEY = "stormcard.medcheck.v1";
  var $ = function (id) { return document.getElementById(id); };
  var reduced = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  function h(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }
  function svgIcon(path, size, cls) {
    var ns = "http://www.w3.org/2000/svg";
    var s = document.createElementNS(ns, "svg");
    s.setAttribute("viewBox", "0 0 24 24");
    s.setAttribute("width", size || 20);
    s.setAttribute("height", size || 20);
    s.setAttribute("aria-hidden", "true");
    if (cls) s.setAttribute("class", cls);
    var p = document.createElementNS(ns, "path");
    p.setAttribute("d", path);
    s.appendChild(p);
    return s;
  }

  /* ---------- storage ---------- */
  function loadSaved() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      var o = JSON.parse(raw);
      return o && o.card_text ? o : null;
    } catch (e) { return null; }
  }
  function save(r) {
    try { localStorage.setItem(KEY, JSON.stringify(r)); } catch (e) { /* storage may be blocked */ }
  }

  /* Accepts the current API shape (zone letter, card_text object, sources object)
     and tolerates the older one (zone dict, card_text string, facts.sources list). */
  function normalize(d, lang) {
    var zone = d.zone;
    if (zone && typeof zone === "object") zone = zone.zone || null;
    var src = [];
    if (d.sources && !Array.isArray(d.sources)) {
      if (d.sources.zones) src.push({ name: "zones", url: d.sources.zones });
      if (d.sources.shelters) src.push({ name: "shelters", url: d.sources.shelters });
    } else if (Array.isArray(d.sources)) src = d.sources;
    else if (d.facts && Array.isArray(d.facts.sources)) src = d.facts.sources;
    var b = d.backend;
    if (b !== "gemini" && b !== "ollama") b = "none";
    return {
      card_text: d.card_text, zone: zone || null, shelters: d.shelters || [],
      special_needs_shelters: d.special_needs_shelters || [],
      facts: d.facts || {}, backend: b, lang: lang,
      sources: src, sample_data: d.sample_data !== false,
      api: d, home: st.home, savedAt: Date.now()
    };
  }

  /* ---------- screens ---------- */
  var SCREENS = ["lang", "place", "household", "error", "card"];
  var STEP = { lang: 1, place: 2, household: 3 };
  var BACK = { place: "lang", household: "place", error: "household", card: "household" };
  var chartCtl = null;
  var lastScreenWasCard = false;

  function show(name, focus) {
    st.screen = name;
    SCREENS.forEach(function (n) { $("s-" + n).hidden = n !== name; });
    $("back").hidden = !BACK[name];
    $("steps").hidden = !STEP[name];
    $("dock").hidden = name !== "card";
    document.body.classList.toggle("on-card", name === "card");
    document.body.classList.toggle("on-lang", name === "lang");
    updateStep();
    window.scrollTo(0, 0);
    if (focus !== false) {
      var hd = $("s-" + name).querySelector("h1");
      if (hd) hd.focus({ preventScroll: true });
    }
  }
  function updateStep() {
    var n = STEP[st.screen];
    if (!n) return;
    $("steptext").textContent = t("step", { n: n });
    var items = $("steps").querySelectorAll("li");
    for (var i = 0; i < items.length; i++) items[i].className = i < n ? "on" : "";
  }

  /* ---------- language ---------- */
  function paintLangButtons() {
    document.querySelectorAll("#langsw button").forEach(function (b) {
      b.setAttribute("aria-pressed", b.dataset.lang === st.lang ? "true" : "false");
    });
    document.querySelectorAll("#langbtns .bigopt").forEach(function (b) {
      b.classList.toggle("pre", b.dataset.pick === st.lang);
    });
  }
  function paintSaved() {
    var s = loadSaved();
    $("saved").hidden = !s;
    if (s) {
      var d = "";
      try { d = new Date(s.savedAt).toLocaleDateString(SC.locale(), { month: "short", day: "numeric" }); } catch (e) { /* ignore */ }
      $("savedMeta").textContent = d ? t("savedOn", { date: d }) : "";
    }
  }

  /* ---------- place ---------- */
  function pickPlace(name, lat, lng) {
    st.home = { name: name, lat: lat, lng: lng };
    show("household");
  }
  function useLocation() {
    var msg = $("locMsg");
    msg.hidden = true;
    msg.classList.remove("err");
    if (!navigator.geolocation) { return locFail(); }
    var btn = $("useLoc");
    btn.disabled = true;
    $("useLocText").textContent = t("locating");
    navigator.geolocation.getCurrentPosition(function (pos) {
      btn.disabled = false;
      $("useLocText").textContent = t("useLoc");
      pickPlace("", pos.coords.latitude, pos.coords.longitude);
    }, function () {
      btn.disabled = false;
      $("useLocText").textContent = t("useLoc");
      locFail();
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
  }
  function locFail() {
    var msg = $("locMsg");
    msg.textContent = t("locErr");
    msg.classList.add("err");
    msg.hidden = false;
  }

  /* ---------- household ---------- */
  function toggleFlag(btn) {
    var k = btn.dataset.flag;
    st.flags[k] = !st.flags[k];
    btn.setAttribute("aria-pressed", st.flags[k] ? "true" : "false");
  }
  function paintFlags() {
    document.querySelectorAll(".tile").forEach(function (b) {
      b.setAttribute("aria-pressed", st.flags[b.dataset.flag] ? "true" : "false");
    });
  }

  /* ---------- generate: facts first, then the card text ---------- */
  var ctrl = null, runId = 0;

  function postJSON(url, body, signal) {
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: signal
    }).then(function (res) {
      if (!res.ok) throw new Error("http " + res.status);
      return res.json();
    });
  }
  function provisional(d, lang) {
    var f = d.facts || {};
    return normalize({
      zone: f.zone, shelters: f.shelters, special_needs_shelters: f.special_needs_shelters,
      facts: f, sources: d.sources, sample_data: d.sample_data, card_text: null, backend: null
    }, lang);
  }

  function generate() {
    if (!st.home) { show("place"); return; }
    var my = ++runId;
    if (ctrl) ctrl.abort();
    var lang = st.lang;
    var body = {
      lat: st.home.lat, lng: st.home.lng, lang: lang,
      flags: { pet: !!st.flags.pet, no_car: !!st.flags.no_car, medical: !!st.flags.medical, kids: !!st.flags.kids }
    };
    ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var guard = setTimeout(function () { if (ctrl) ctrl.abort(); }, 180000);
    var mk = $("make");
    mk.disabled = true;
    var sig = ctrl ? ctrl.signal : undefined;

    postJSON("/api/facts", body, sig).then(function (d) {
      if (my !== runId) return null;
      if (!d || !d.facts) throw new Error("bad facts");
      mk.disabled = false;
      st.result = provisional(d, lang);
      st.stage = "run";
      show("card");
      renderCard(true);
      var cb = {}; Object.keys(body).forEach(function (k) { cb[k] = body[k]; });
      cb.force_offline = !!st.forceOffline;
      return postJSON("/api/card", cb, sig).then(function (c) {
        if (my !== runId) return;
        if (!c || !c.card_text) throw new Error("bad payload");
        st.result = normalize(c, lang);
        st.stage = "done";
        save(st.result);
        renderCard(false);
      }).catch(function () {
        if (my !== runId) return;
        st.stage = "fail";
        renderStages();
        renderCardText(st.result);
        paintAsk();
      });
    }).catch(function (e) {
      if (my !== runId) return;
      mk.disabled = false;
      var body = document.querySelector('[data-i18n="errBody"]');
      if (body) body.textContent = SC.t(e && e.message === "http 422" ? "errOutside" : "errBody");
      show("error");
    }).then(function () { clearTimeout(guard); mk.disabled = false; });
  }
  function abortRun() {
    runId++;
    if (ctrl) ctrl.abort();
    $("make").disabled = false;
  }
  function paintAsk() {
    if (SC.paintAsk) SC.paintAsk();
  }

  /* ---------- card render ---------- */
  function zonePlateText(zone) {
    var z = zone && typeof zone === "object" ? zone.zone : zone;
    if (z) return t("zoneWord") + " " + String(z).toUpperCase();
    return null;
  }

  function parseCard(text) {
    var out = [], list = null;
    String(text || "").split(/\r?\n/).forEach(function (raw) {
      var line = raw.trim();
      if (!line) { list = null; return; }
      if (line.indexOf("## ") === 0) { list = null; out.push({ k: "h", v: line.slice(3).trim() }); return; }
      if (line.indexOf("- ") === 0) {
        if (!list) { list = { k: "ul", v: [] }; out.push(list); }
        list.v.push(line.slice(2).trim());
        return;
      }
      list = null;
      out.push({ k: "p", v: line });
    });
    return out;
  }
  function isCallLine(s) {
    return SC.langs.some(function (l) { return SC.tl(l, "CALL_311") === s; });
  }

  /* strip raw URLs; break text into short lines (lines, bullets, sentences) */
  function cleanLine(x) {
    return String(x || "").replace(/\(?\bhttps?:\/\/\S+/gi, "").replace(/\bwww\.\S+/gi, "")
      .replace(/\s+([.,;:!?])/g, "$1").replace(/\s{2,}/g, " ").trim();
  }
  function shortLines(text, max, dropCalls) {
    var out = [], seen = {};
    String(text).split(/\r?\n/).forEach(function (raw) {
      var line = cleanLine(raw.replace(/^\s*(?:[-*\u2022]|\d+[.)])\s+/, ""));
      if (!line) return;
      (line.match(/[^.!?]+(?:[.!?]+|$)/g) || [line]).forEach(function (sn) {
        sn = sn.trim();
        if (!sn || sn.length < 2) return;
        if (dropCalls && (/\b311\b/.test(sn) || isCallLine(sn))) return;
        var k = sn.toLowerCase();
        if (seen[k]) return;
        seen[k] = 1;
        out.push(sn);
      });
    });
    return out.slice(0, max);
  }
  function tickKey(x) { return String(x).toLowerCase().replace(/[^a-z0-9\u00c0-\u024f]+/g, "-").slice(0, 40); }

  function renderCardText(r) {
    var root = $("cardtext");
    root.textContent = "";
    root.setAttribute("lang", ({ kre: "ht", es: "es", en: "en" })[r.lang] || "en");
    var blocks = [];
    var ct = r.card_text;
    if (!ct) return;
    if (typeof ct === "string") blocks = parseCard(ct);
    else {
      if (typeof ct.what_this_means === "string" && ct.what_this_means.trim()) {
        blocks.push({ k: "h", v: t("sec_what_this_means") });
        blocks = blocks.concat(parseCard(ct.what_this_means));
      }
      if (typeof ct.what_to_bring === "string" && ct.what_to_bring.trim()) {
        blocks.push({ k: "h", v: t("sec_what_to_bring") });
        var items = shortLines(ct.what_to_bring, 8, false);
        if (items.length) blocks.push({ k: "tick", v: items });
      }
      if (typeof ct.what_to_do_now === "string" && ct.what_to_do_now.trim()) {
        blocks.push({ k: "h", v: t("sec_what_to_do_now") });
        shortLines(ct.what_to_do_now, 4, true).forEach(function (x) { blocks.push({ k: "p", v: x }); });
      }
    }
    blocks.forEach(function (b) {
      if (b.k === "h") {
        root.appendChild(h("h2", "tab", b.v));
      } else if (b.k === "tick") {
        root.appendChild(checklist(b.v.map(function (x) { return { key: tickKey(x), text: x }; }), loadTicks(), "bring."));
      } else if (b.k === "ul") {
        var ul = h("ul", "items");
        b.v.forEach(function (x) { ul.appendChild(SC.setText(h("li"), cleanLine(x))); });
        root.appendChild(ul);
      } else {
        root.appendChild(SC.setText(h("p", isCallLine(b.v) ? "p call" : "p"), cleanLine(b.v)));
      }
    });
  }

  function bearing(a, b) {
    var k = Math.cos((a.lat * Math.PI) / 180);
    var deg = (Math.atan2((b.lng - a.lng) * k, b.lat - a.lat) * 180) / Math.PI;
    return Math.round((deg + 360) % 360);
  }
  function arrowSvg(deg) {
    var ns = "http://www.w3.org/2000/svg";
    var sv = document.createElementNS(ns, "svg");
    sv.setAttribute("viewBox", "0 0 32 32");
    sv.setAttribute("width", 32); sv.setAttribute("height", 32);
    sv.setAttribute("aria-hidden", "true");
    sv.setAttribute("class", "bearing");
    var p = document.createElementNS(ns, "path");
    p.setAttribute("d", "M16 4L25 15H19V28H13V15H7Z");
    p.setAttribute("transform", "rotate(" + deg + " 16 16)");
    sv.appendChild(p);
    return sv;
  }
  /* ONE word that explains the rank of this shelter, or null */
  function reasonFor(s, i, list, wantsPet) {
    if (wantsPet && s.pet_friendly === true) return { k: "rPet", c: "ok" };
    var nearest = list.every(function (o) { return typeof o.distance_mi !== "number" || typeof s.distance_mi !== "number" || s.distance_mi <= o.distance_mi; });
    if (nearest && (i === 0 || typeof s.distance_mi === "number")) return { k: "rNear", c: "near" };
    if (wantsPet && s.pet_friendly === false) return { k: "petNo", c: "unk" };
    if (wantsPet) return { k: "rUnk", c: "unk" };
    return null;
  }

  function renderShelters(r) {
    var ol = $("plates");
    ol.textContent = "";
    var list = (r.shelters || []).slice(0, 3);
    var home = r.home || st.home || (r.facts && r.facts.home);
    var wantsPet = !!((r.facts && r.facts.flags) || {}).pet;
    $("tapHint").hidden = list.length === 0;
    $("warn311").hidden = false;
    SC.setText($("warn311"), t("CALL_311"));
    $("sampleFoot").hidden = r.sample_data === false || list.length === 0;
    var sn = ((r.facts && r.facts.flags) || {}).medical ? (r.special_needs_shelters || [])[0] : null;
    if (!list.length && !sn) {
      ol.appendChild(SC.setText(h("li", "noshel"), t("noShelters")));
      return;
    }
    list.forEach(function (s, i) {
      var li = h("li");
      var b = h("button", "plate-btn");
      b.type = "button";
      b.setAttribute("aria-pressed", "false");
      b.dataset.i = i;
      b.appendChild(h("span", "num", String(i + 1)));
      var body = h("span", "pb");
      body.appendChild(h("span", "nm", s.name || ""));
      var addr = [s.address, s.city].filter(Boolean).join(", ");
      body.appendChild(h("span", "ad", addr));
      var row = h("span", "row");
      if (typeof s.distance_mi === "number") row.appendChild(h("span", "dist", s.distance_mi.toFixed(1) + " " + t("mi")));
      var rs = reasonFor(s, i, list, wantsPet);
      if (rs) {
        var rn = h("span", "why " + rs.c);
        if (rs.c === "ok") rn.appendChild(svgIcon("M5 12.500L10 17.500L19 7", 18));
        rn.appendChild(h("span", null, t(rs.k)));
        row.appendChild(rn);
      }
      body.appendChild(row);
      b.appendChild(body);
      if (home && typeof home.lat === "number" && typeof s.lat === "number" && typeof s.lng === "number") {
        var ar = h("span", "dir");
        ar.setAttribute("role", "img");
        ar.setAttribute("aria-label", t("dirTo", { n: i + 1 }) + ": " + bearing(home, s) + "°");
        ar.appendChild(arrowSvg(bearing(home, s)));
        b.appendChild(ar);
      }
      b.addEventListener("click", function () {
        var sel = chartCtl ? chartCtl.select(i) : -1;
        ol.querySelectorAll(".plate-btn").forEach(function (x, j) {
          x.setAttribute("aria-pressed", j === sel ? "true" : "false");
        });
      });
      li.appendChild(b);
      ol.appendChild(li);
    });
    if (sn) {
      var l4 = h("li");
      var d4 = h("div", "plate-btn sn");
      var n4 = h("span", "num");
      var ns = "http://www.w3.org/2000/svg";
      var sv = document.createElementNS(ns, "svg");
      sv.setAttribute("viewBox", "0 0 32 32"); sv.setAttribute("width", 32); sv.setAttribute("height", 32);
      sv.setAttribute("aria-hidden", "true");
      var rc = document.createElementNS(ns, "rect");
      rc.setAttribute("x", 8); rc.setAttribute("y", 8); rc.setAttribute("width", 16); rc.setAttribute("height", 16);
      rc.setAttribute("transform", "rotate(45 16 16)");
      var pp = document.createElementNS(ns, "path");
      pp.setAttribute("d", "M11 16H21M16 11V21");
      sv.appendChild(rc); sv.appendChild(pp);
      n4.appendChild(sv);
      d4.appendChild(n4);
      var b4 = h("span", "pb");
      b4.appendChild(h("span", "nm", sn.name || ""));
      b4.appendChild(h("span", "ad", [sn.address, sn.city].filter(Boolean).join(", ")));
      var r4 = h("span", "row");
      if (typeof sn.distance_mi === "number") r4.appendChild(h("span", "dist", sn.distance_mi.toFixed(1) + " " + t("mi")));
      r4.appendChild(h("span", "why unk", t("sn_tag")));
      b4.appendChild(r4);
      b4.appendChild(SC.setText(h("span", "ad"), t("snNote")));
      d4.appendChild(b4);
      var hm = r.home || st.home || (r.facts && r.facts.home);
      if (hm && typeof sn.lat === "number" && typeof sn.lng === "number") {
        var a4 = h("span", "dir");
        a4.setAttribute("role", "img");
        a4.setAttribute("aria-label", t("sn_tag") + ": " + bearing(hm, sn) + "°");
        a4.appendChild(arrowSvg(bearing(hm, sn)));
        d4.appendChild(a4);
      }
      l4.appendChild(d4);
      ol.appendChild(l4);
    }
  }

  /* staged trace: same component as the Ask trace (SC.stepRow) */
  function renderStages() {
    var r = st.result, ol = $("stages");
    ol.textContent = "";
    if (!r) return;
    var zt = r.zone ? t("stZone", { z: String(r.zone).toUpperCase() }) : t("outside");
    ol.appendChild(SC.stepRow("done", zt));
    var n = (r.shelters || []).length;
    ol.appendChild(SC.stepRow("done", n === 0 ? t("stNoShel") : n === 1 ? t("stShelter1") : t("stShelters", { n: n })));
    var stage = st.stage || (r.card_text ? "done" : "run");
    var stat = $("status");
    stat.textContent = "";
    stat.className = "status s-" + stage;
    if (stage === "done") {
      var bk = ["gemini", "ollama", "none"].indexOf(r.backend) >= 0 ? r.backend : "none";
      ol.appendChild(SC.stepRow("done", t("stDone"), [h("span", "badge b-" + bk, t("b_" + bk))]));
      stat.appendChild(h("span", "badge b-" + bk, t("b_" + bk)));
    } else if (stage === "fail") {
      ol.appendChild(SC.stepRow("fail", t("stFail")));
      stat.textContent = t("stFail");
    } else {
      ol.appendChild(SC.stepRow("run", t("stWriting")));
      stat.appendChild(h("span", "dot"));
      stat.appendChild(h("span", null, t("stWriting")));
    }
    $("stageRetry").hidden = stage !== "fail";
  }

  function renderHow(r) {
    var root = $("howBody");
    root.textContent = "";
    var badge = h("p", "badge b-" + r.backend, t("b_" + (["gemini", "ollama", "none"].indexOf(r.backend) >= 0 ? r.backend : "none")));
    root.appendChild(badge);

    var dl = h("dl", "facts");
    dl.appendChild(h("dt", null, t("howZone")));
    dl.appendChild(h("dd", null, zonePlateText(r.zone) || t("outside")));

    dl.appendChild(h("dt", null, t("howShelters")));
    var dd = h("dd");
    if (r.shelters && r.shelters.length) {
      var ul = h("ul", "plain");
      r.shelters.forEach(function (s, i) {
        ul.appendChild(h("li", null, (i + 1) + ". " + s.name + " · " + (typeof s.distance_mi === "number" ? s.distance_mi.toFixed(1) : "?") + " " + t("mi")));
      });
      dd.appendChild(ul);
    } else dd.textContent = t("noShelters");
    dl.appendChild(dd);

    dl.appendChild(h("dt", null, t("howFlags")));
    var f = (r.facts && r.facts.flags) || {};
    var names = ["pet", "no_car", "medical", "kids"].filter(function (k) { return f[k]; })
      .map(function (k) { return t(k === "no_car" ? "nocar" : k); });
    dl.appendChild(h("dd", null, names.length ? names.join(", ") : t("howNone")));
    root.appendChild(dl);

    var src = r.sources || [];
    if (src.length) {
      root.appendChild(h("p", "subhead", t("sources")));
      var sl = h("ul", "plain src");
      src.forEach(function (s) {
        var li = h("li");
        if (s.url && /^https?:\/\//.test(s.url)) {
          var a = h("a", null, s.name === "zones" ? t("srcZones") : s.name === "shelters" ? t("srcShelters") : (s.name || s.url));
          a.href = s.url; a.target = "_blank"; a.rel = "noopener noreferrer";
          li.appendChild(a);
        } else li.textContent = s.name || "";
        sl.appendChild(li);
      });
      root.appendChild(sl);
    }
  }

  /* ---------- household panels: medical, pets, transport, kids ---------- */
  function loadTicks() {
    try { return JSON.parse(localStorage.getItem(MEDKEY)) || {}; } catch (e) { return {}; }
  }
  function saveTicks(o) {
    try { localStorage.setItem(MEDKEY, JSON.stringify(o)); } catch (e) { /* storage may be blocked */ }
  }
  function telBtn(label) {
    var a = h("a", "call-btn");
    a.href = "tel:311";
    a.appendChild(svgIcon("M5 4H9L11 9L8.500 10.500C9.500 12.500 11.500 14.500 13.500 15.500L15 13L20 15V19C20 19.500 19.500 20 19 20C10.500 20 4 13.500 4 5C4 4.500 4.500 4 5 4Z", 22));
    a.appendChild(h("span", null, label));
    return a;
  }
  function panel(cls, title) {
    var s = h("section", "xpanel " + cls);
    s.appendChild(h("h2", "tab", title));
    return s;
  }
  function checklist(ids, store, prefix) {
    var ul = h("ul", "ticklist");
    ids.forEach(function (id) {
      var li = h("li");
      var b = h("button", "tick");
      b.type = "button";
      var key = prefix + id.key;
      b.setAttribute("aria-pressed", store[key] ? "true" : "false");
      var box = h("span", "box");
      box.appendChild(svgIcon("M5 12.500L10 17.500L19 7", 18));
      b.appendChild(box);
      b.appendChild(h("span", "lbl", id.text || t(id.label)));
      b.addEventListener("click", function () {
        var o = loadTicks();
        o[key] = !o[key];
        saveTicks(o);
        b.setAttribute("aria-pressed", o[key] ? "true" : "false");
      });
      li.appendChild(b);
      ul.appendChild(li);
    });
    return ul;
  }
  function renderExtras(r) {
    var host = $("extras");
    if (!host) {
      host = h("div", "extras");
      host.id = "extras";
      $("cardtext").parentNode.insertBefore(host, $("cardtext").nextSibling);
    }
    host.textContent = "";
    var f = (r.facts && r.facts.flags) || {};
    var ticks = loadTicks();

    if (f.medical) {
      var m = panel("x-med", t("medTitle"));
      m.appendChild(SC.setText(h("p", "hint"), t("medHint")));
      m.appendChild(checklist(["meds7", "medlist", "rx", "devices", "power", "id"].map(function (k) {
        return { key: k, label: "ck_" + k };
      }), ticks, "med."));
      var e = h("div", "eeap");
      e.appendChild(h("h3", "sub", t("eeapH")));
      e.appendChild(SC.setText(h("p", "p"), t("eeapWhat")));
      e.appendChild(telBtn(t("eeapCall")));
      var src = h("a", "srclink", t("eeapSrc"));
      src.href = "https://www.miamidade.gov/fire/eeap.asp";
      src.target = "_blank"; src.rel = "noopener noreferrer";
      e.appendChild(src);
      m.appendChild(e);
      host.appendChild(m);
    }
    if (f.pet) {
      var p = panel("x-pet", t("petH"));
      p.appendChild(h("p", "p", t("petSupplies")));
      var ok = (r.shelters || []).filter(function (s) { return s.pet_friendly === true; });
      if (ok.length) {
        p.appendChild(h("p", "p strong", t("petOk")));
        var ul = h("ul", "items");
        ok.forEach(function (s) { ul.appendChild(h("li", null, s.name)); });
        p.appendChild(ul);
      } else p.appendChild(SC.setText(h("p", "p strong"), t("petNone")));
      host.appendChild(p);
    }
    if (f.no_car) {
      var c = panel("x-car", t("carH"));
      c.appendChild(SC.setText(h("p", "p"), t("carText")));
      c.appendChild(telBtn(t("carCall")));
      host.appendChild(c);
    }
    if (f.kids) {
      var k = panel("x-kids", t("kidsH"));
      k.appendChild(checklist(["1", "2", "3", "4"].map(function (n) {
        return { key: n, label: "kids" + n };
      }), ticks, "kids."));
      host.appendChild(k);
    }
  }

  function renderCard(animate) {
    var r = st.result;
    if (!r) return;
    var plate = $("plate");
    plate.textContent = "";
    var zt = zonePlateText(r.zone);
    plate.className = "plate" + (zt ? "" : " plate-out");
    plate.appendChild(h("span", "plate-word", zt || t("outside")));
    plate.setAttribute("aria-label", zt || t("outside"));
    $("plateNote").textContent = zt ? t("zoneNote") : t("outsideNote");

    var shel = (r.shelters || []).slice(0, 3);
    var home = r.home || st.home || (r.facts && r.facts.home);
    if (home && typeof home.lat === "number") {
      var prevSel = chartCtl && animate === false ? chartCtl.selected : -1;
      chartCtl = StormChart.render($("chart"), {
        home: home, shelters: shel,
        special: (r.facts && r.facts.flags && r.facts.flags.medical) ? (r.special_needs_shelters || []).slice(0, 1) : [],
        labels: { home: t("home"), special: t("sn_tag"), mi: t("mi"), aria: t("chartAria", { n: shel.length }) },
        animate: !!animate && !reduced
      });
      renderShelters(r);
      if (prevSel >= 0) {
        chartCtl.select(prevSel);
        var bs = $("plates").querySelectorAll(".plate-btn");
        if (bs[prevSel]) bs[prevSel].setAttribute("aria-pressed", "true");
      }
    } else renderShelters(r);
    renderStages();
    renderCardText(r);
    renderExtras(r);
    renderHow(r);
    paintAsk();

    var again = $("again");
    if (r.card_text && r.lang !== st.lang) {
      $("againText").textContent = t("makeAgain", { lang: SC.tl(st.lang, "langNative") });
      again.hidden = false;
    } else again.hidden = true;
  }

  /* ---------- wire up ---------- */
  function openSaved() {
    var s = loadSaved();
    if (!s) return;
    st.result = s;
    if (s.home) st.home = s.home;
    var f = (s.facts && s.facts.flags) || {};
    st.flags = { pet: !!f.pet, no_car: !!f.no_car, medical: !!f.medical, kids: !!f.kids };
    paintFlags();
    if (s.lang && SC.strings[s.lang]) SC.setLang(s.lang);
    st.stage = "done";
    show("card");
    renderCard(true);
  }

  function init() {
    SC.setLang(SC.guessLang());
    paintLangButtons();
    paintSaved();
    show("lang", false);

    document.querySelectorAll("#langsw button").forEach(function (b) {
      b.addEventListener("click", function () { SC.setLang(b.dataset.lang); });
    });
    document.querySelectorAll("#langbtns .bigopt").forEach(function (b) {
      b.addEventListener("click", function () { SC.setLang(b.dataset.pick); show("place"); });
    });
    document.querySelectorAll("[data-place]").forEach(function (b) {
      b.addEventListener("click", function () {
        pickPlace(b.dataset.place, parseFloat(b.dataset.lat), parseFloat(b.dataset.lng));
      });
    });
    $("useLoc").addEventListener("click", useLocation);
    document.querySelectorAll(".tile").forEach(function (b) {
      b.addEventListener("click", function () { toggleFlag(b); });
    });
    $("make").addEventListener("click", generate);
    $("retry").addEventListener("click", generate);
    $("stageRetry").addEventListener("click", generate);
    $("openSaved").addEventListener("click", openSaved);
    $("againBtn").addEventListener("click", generate);
    $("back").addEventListener("click", function () {
      var to = BACK[st.screen];
      if (st.screen === "card") abortRun();
      if (to) show(to);
    });

    SC.onLang(function () {
      paintLangButtons();
      paintSaved();
      updateStep();
      $("useLocText").textContent = t("useLoc");
      $("locMsg").hidden = true;
      if (st.screen === "card") renderCard(false);
    });
  }

  window.StormApp = { show: show, generate: generate };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
