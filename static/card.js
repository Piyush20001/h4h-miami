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
    enterScreen(name);
    if (SC.storm && name === "card") SC.storm.refresh();
    if (focus !== false) {
      var hd = $("s-" + name).querySelector("h1");
      if (hd) hd.focus({ preventScroll: true });
    }
  }
  function enterScreen(name) {
    var M = SC.motion;
    if (!M) return;
    var sec = $("s-" + name);
    if (name === "card") { M.enter(sec); return; }
    M.enter(sec.querySelector("h1"));
    M.stagger(sec.querySelectorAll(".hint, .bigopt, .tile, .loc, #make, #retry, #openSaved"));
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
    st.mapAll = false; /* every new card opens on its own bus/route view */
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
      cb.force_offline = false;  /* the server decides online vs local Gemma */
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
        renderNext3(st.result);
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

  /* one bordered container: the plate (button) plus a sibling foot row holding the directions link */
  function plateWrap(plate, home, s, walk) {
    var w = h("div", "plate-wrap");
    w.appendChild(plate);
    var dl = window.SCMap ? SCMap.dirLink(home, s, walk) : null;
    var ab = null; /* Point my way lives on the bus card; shelters keep Directions */
    if (dl || ab) {
      var f = h("div", "plate-foot");
      if (ab) f.appendChild(ab);
      if (dl) f.appendChild(dl);
      w.appendChild(f);
    }
    return w;
  }

  function busList(r, any) {
    var f = (r && r.facts) || {};
    if (!any && (!f.flags || !f.flags.no_car)) return [];
    var l = (r.api && r.api.bus_pickups) || f.bus_pickups || r.bus_pickups || [];
    return l.filter(function (b) { return b && typeof b.lat === "number" && typeof b.lng === "number"; }).slice(0, 2);
  }
  function badgeKey(r) {
    if (r.backend === "gemini" || r.backend === "ollama") return "b_" + r.backend;
    return SC.hub && SC.hub.internet === false ? "b_offline" : "b_none";
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
      var b = h("button", "plate-btn" + (i === 0 ? " is-rec" : ""));
      b.type = "button";
      b.setAttribute("aria-pressed", "false");
      b.dataset.i = i;
      if (i === 0) li.appendChild(h("p", "rec-tag", t("recTag")));
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
      li.appendChild(plateWrap(b, home, s));
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
      l4.appendChild(plateWrap(d4, hm, sn));
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
      var bk = badgeKey(r).slice(2); /* light colour follows the label: online green, offline red */
      ol.appendChild(SC.stepRow("done", t("stDone"), [h("span", "badge b-" + bk, t(badgeKey(r)))]));
      stat.appendChild(h("span", "badge b-" + bk, t(badgeKey(r))));
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
    var badge = h("p", "badge b-" + badgeKey(r).slice(2), t(badgeKey(r)));
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
    if (f.kids) {
      var k = panel("x-kids", t("kidsH"));
      k.appendChild(checklist(["1", "2", "3", "4"].map(function (n) {
        return { key: n, label: "kids" + n };
      }), ticks, "kids."));
      host.appendChild(k);
    }
  }

  /* walking route along county streets to the nearest bus pickup; fetched once per card, works offline */
  var routeCache = {};
  function routeKey(r) {
    var home = r.home || st.home || (r.facts && r.facts.home), b = busList(r, true)[0];
    return home && b ? [home.lat, home.lng, b.lat, b.lng].join(",") : "";
  }
  function routeFor(r) { var k = routeKey(r); return k && routeCache[k] && routeCache[k] !== "x" ? routeCache[k] : null; }
  function loadRoute(r, done) {
    var k = routeKey(r);
    if (!k || routeCache[k]) return done(routeFor(r));
    var p = k.split(",");
    routeCache[k] = "x";
    fetch("/api/route?from=" + p[0] + "," + p[1] + "&to=" + p[2] + "," + p[3])
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (d) {
        routeCache[k] = d || "x";
        /* the card may have been redrawn meanwhile: redraw whatever card is showing now if it is the same trip */
        if (d && st.result && routeKey(st.result) === k) renderCard(false);
      })
      .catch(function () { routeCache[k] = "x"; });
  }
  SC.routeFor = routeFor;
  function stepText(s) {
    return t("turn_" + s.turn, { s: s.street || t("unnamedSt") }) + " · " + (s.miles < 0.1 ? Math.round(s.miles * 5280) + " ft" : s.miles.toFixed(1) + " " + t("mi"));
  }
  function routeBlock(rt) {
    var box = h("div", "ride-route");
    var mins = Math.max(1, Math.round(rt.miles * 30)); /* 2 mph: an unhurried older walker */
    box.appendChild(h("p", "ride-walk", t("routeSum", { d: rt.miles.toFixed(1), m: mins, n: Math.max(0, rt.steps.length - 1) })));
    var det = h("details", "ride-steps-d");
    det.appendChild(h("summary", null, t("routeSteps")));
    var ol = h("ol", "route-steps");
    rt.steps.forEach(function (s) { ol.appendChild(h("li", "turn-" + s.turn, stepText(s))); });
    det.appendChild(ol);
    box.appendChild(det);
    box.appendChild(h("p", "ride-src", t("routeSrc")));
    return box;
  }
  SC.stepText = stepText;

  /* no car: the map opens on the bus pickups; one button widens it to the shelters */
  function renderMapToggle(r) {
    var b = $("mapAll");
    if (!busList(r).length) { if (b) b.hidden = true; return; }
    if (!b) {
      b = h("button", "btn btn-ghost small map-all");
      b.type = "button"; b.id = "mapAll";
      b.addEventListener("click", function () { st.mapAll = !st.mapAll; renderCard(false); });
      $("chart").parentNode.appendChild(b);
    }
    b.hidden = false;
    b.textContent = st.mapAll ? t("mapBus") : t("mapShel");
  }

  /* no car: the ride out goes right under the zone plate, nearest bus pickup first */
  function renderRide(r) {
    var sec = $("ride"), body = $("rideBody");
    var f = (r.facts && r.facts.flags) || {};
    body.textContent = "";
    var all = busList(r, true);
    sec.hidden = !f.no_car && !all.length;
    if (sec.hidden) return;
    sec.classList.toggle("is-folded", !f.no_car);
    if (!f.no_car) {
      /* car box unticked: the same help, folded, so nobody has to go back to find it */
      var det = h("details", "ride-fold");
      det.appendChild(h("summary", null, t("rideFold")));
      var inner = h("div");
      det.appendChild(inner);
      body.appendChild(det);
      $("h-ride").textContent = "";
      body = inner;
    }
    if (f.no_car) $("h-ride").textContent = t("rideH");
    var home = r.home || st.home || (r.facts && r.facts.home);
    var bl = all;
    if (!bl.length) {
      body.appendChild(SC.setText(h("p", "p"), t("carText")));
      body.appendChild(telBtn(t("carCall")));
      return;
    }
    var b = bl[0];
    body.appendChild(h("p", "ride-when", t("busIdle")));
    var card = h("div", "ride-card");
    var top = h("div", "ride-top");
    var ico = h("span", "ride-ico");
    var bimg = h("img"); bimg.src = "icons/ui/bus.png"; bimg.width = 36; bimg.height = 36; bimg.alt = "";
    ico.appendChild(bimg);
    top.appendChild(ico);
    var nm = h("div", "ride-nm");
    nm.appendChild(h("span", "ride-k", t("rideNear")));
    nm.appendChild(h("span", "nm", b.name || ""));
    nm.appendChild(h("span", "ad", [b.address, b.city].filter(Boolean).join(", ")));
    top.appendChild(nm);
    if (home && typeof home.lat === "number") {
      var ar = h("span", "dir");
      ar.setAttribute("role", "img");
      ar.setAttribute("aria-label", bearing(home, b) + "°");
      ar.appendChild(arrowSvg(bearing(home, b)));
      top.appendChild(ar);
    }
    card.appendChild(top);
    var rslot = h("div", "ride-rslot");
    if (typeof b.distance_mi === "number") rslot.appendChild(h("p", "ride-walk", t("rideDist", { d: b.distance_mi.toFixed(1) })));
    card.appendChild(rslot);
    loadRoute(r, function (rt) {
      if (!rt) return;
      rslot.textContent = "";
      rslot.appendChild(routeBlock(rt));
    });
    var steps = h("ol", "ride-steps");
    ["rideS1", "rideS2", "rideS3"].forEach(function (k) { steps.appendChild(h("li", null, t(k))); });
    card.appendChild(steps);
    if (f.pet) card.appendChild(h("p", "ride-pet", t("ridePet")));
    var act = h("div", "ride-act");
    var arb = SC.arButton ? SC.arButton(home, b, "bus") : null;
    if (arb) { arb.classList.add("ar-btn-big"); card.appendChild(arb); }
    act.appendChild(telBtn(t("busConfirm")));
    var dl = window.SCMap ? SCMap.dirLink(home, b, true) : null;
    if (dl) act.appendChild(dl);
    card.appendChild(act);
    body.appendChild(card);
    if (bl[1]) {
      var o = bl[1];
      body.appendChild(h("p", "ride-alt", t("rideAlt", { n: o.name || "", d: typeof o.distance_mi === "number" ? o.distance_mi.toFixed(1) : "?" })));
    }
  }

  /* "Your next 3 steps": chosen by code from her household and the county facts; each one opens what it names */
  function familyText(r) {
    var lines = [t("famHead")];
    lines.push(r.zone ? t("famZone", { z: r.zone }) : t("famNoZone"));
    var s0 = (r.shelters || [])[0];
    if (s0 && s0.name) lines.push(t("famShelter", { n: s0.name, a: s0.address || "" }));
    var f = (r.facts && r.facts.flags) || {}, b = busList(r, true)[0];
    if (f.no_car && b) lines.push(t("famBus", { n: b.name, a: b.address || "" }));
    lines.push(t("famCall"));
    return lines.join("\n");
  }
  function renderNext3(r) {
    var sec = $("next3"), ol = $("n3");
    ol.textContent = "";
    if (st.stage === "run") { sec.hidden = true; return; } /* appear with the finished card, not before it */
    var f = (r.facts && r.facts.flags) || {};
    var b = busList(r, true)[0], s0 = (r.shelters || [])[0];
    var steps = [];
    function go(id) { return function () { var n = $(id); if (n) n.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" }); }; }
    if (f.no_car && b) {
      var rt = routeFor(r);
      steps.push({ k: "bus", txt: t("n3Bus", { n: b.name }), sub: rt ? t("n3BusRoute", { d: rt.miles.toFixed(1) }) : t("busIdle"), act: function () { go("ride")(); var d = document.querySelector(".ride-fold"); if (d) d.open = true; } });
    } else if (s0) {
      steps.push({ k: "shel", txt: t("n3Shel", { n: s0.name }), sub: t("CALL_311"), act: go("h-shel") });
    }
    if (f.medical) steps.push({ k: "med", txt: t("n3Med"), sub: t("eeapCall"), href: "tel:311" });
    else if (f.pet) steps.push({ k: "pet", txt: t("n3Pet"), sub: t("n3PetSub"), act: function () { var n = document.querySelector(".x-pet"); if (n) n.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" }); } });
    else steps.push({ k: "bag", txt: t("n3Bag"), sub: t("n3BagSub"), act: go("cardtext") });
    steps.push({ k: "fam", txt: t("n3Fam"), sub: t("n3FamSub"), href: "sms:?&body=" + encodeURIComponent(familyText(r)) });
    $("h-next3").textContent = t("n3H");
    steps.slice(0, 3).forEach(function (st3, i) {
      var li = h("li");
      var el = h(st3.href ? "a" : "button", "n3-item");
      if (st3.href) el.href = st3.href; else { el.type = "button"; el.addEventListener("click", st3.act); }
      el.appendChild(h("span", "n3-num", String(i + 1)));
      var tx = h("span", "n3-tx");
      tx.appendChild(h("span", "n3-main", st3.txt));
      tx.appendChild(h("span", "n3-sub", st3.sub));
      el.appendChild(tx);
      el.appendChild(svgIcon("M9 5L16 12L9 19", 22, "n3-go"));
      li.appendChild(el);
      ol.appendChild(li);
    });
    var wasHidden = sec.hidden;
    sec.hidden = false;
    if (wasHidden && SC.motion) SC.motion.stagger(ol.children);
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
      var copts = {
        home: home, shelters: shel,
        special: (r.facts && r.facts.flags && r.facts.flags.medical) ? (r.special_needs_shelters || []).slice(0, 1) : [],
        bus: busList(r), zone: r.zone, focusBus: busList(r).length > 0 && !st.mapAll,
        route: busList(r).length && !st.mapAll ? routeFor(r) : null,
        labels: { home: t("home"), special: t("sn_tag"), bus: t("busShort"), legend: { home: t("lgHome"), shelter: t("lgShel"), special: t("lgSn"), bus: t("lgBus"), zone: t("lgZone") }, mi: t("mi"), cap: t(busList(r).length && !st.mapAll && routeFor(r) ? "chartCapRoute" : "chartCap"), rec: t("recTag"), aria: t("chartAria", { n: shel.length }) },
        animate: !!animate && !reduced
      };
      chartCtl = StormChart.render($("chart"), copts);
      renderMapToggle(r);
      if (window.SCMap) chartCtl = SCMap.wrap($("chart"), chartCtl, copts);
      renderShelters(r);
      if (prevSel >= 0) {
        chartCtl.select(prevSel);
        var bs = $("plates").querySelectorAll(".plate-btn");
        if (bs[prevSel]) bs[prevSel].setAttribute("aria-pressed", "true");
      }
    } else renderShelters(r);
    renderRide(r);
    renderNext3(r);
    renderStages();
    renderCardText(r);
    renderExtras(r);
    renderHow(r);
    paintAsk();
    if (SC.paintHub) SC.paintHub();
    if (animate && SC.motion) {
      SC.motion.stagger($("plates").querySelectorAll("li"));
      SC.motion.stagger(document.querySelectorAll("#cardtext > .tab, .xpanel"));
    }

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

    window.addEventListener("hubchange", function () {
      if (st.screen === "card" && st.result) { renderStages(); renderHow(st.result); }
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
