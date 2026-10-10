/* StormCard live storm card. Facts from /api/storms (NHC); never interpretation or advice.
   Renders into #storm-lang and #storm-card. Fails silently to hidden. */
(function () {
  "use strict";
  var SC = window.SC, NS = "http://www.w3.org/2000/svg";
  var DEF = { lat: 25.83, lng: -80.189 };
  var data = null, shown = { lang: false, card: false }, busy = false;
  var P16 = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];

  function S() { return (window.SC_STORM || {})[SC.state.lang] || (window.SC_STORM || {}).en || {}; }
  function fmt(s, v) { return (s || "").replace(/\{(\w+)\}/g, function (_, k) { return v && v[k] != null ? v[k] : ""; }); }
  function compass(deg) {
    if (typeof deg !== "number" || isNaN(deg)) return "";
    var d = P16[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
    return SC.state.lang === "es" ? d.replace(/W/g, "O") : d;
  }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function clock(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return "";
    try { return d.toLocaleTimeString(SC.locale(), { hour: "numeric", minute: "2-digit" }); } catch (e) { return ""; }
  }
  function arrow(deg) {
    var s = document.createElementNS(NS, "svg");
    s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("width", "28"); s.setAttribute("height", "28");
    s.setAttribute("aria-hidden", "true"); s.setAttribute("class", "storm-arrow");
    var p = document.createElementNS(NS, "path");
    p.setAttribute("d", "M12 3L18 19L12 15.500L6 19Z");
    s.appendChild(p);
    s.style.transform = "rotate(" + deg + "deg)";
    return s;
  }
  function link(href, label, stale, tx) {
    var a = el("a", "storm-link", label + (stale ? " " + tx.net : ""));
    a.href = href; a.target = "_blank"; a.rel = "noopener noreferrer";
    return a;
  }

  function build() {
    var tx = S(), d = data, st = d.storm;
    var box = el("div", "storm-in");
    box.appendChild(el("p", "storm-head", tx.head));
    if (!st) { box.appendChild(el("p", "storm-quiet", tx.quiet)); return box; }

    var top = el("div", "storm-top");
    if (typeof st.bearing_deg === "number") top.appendChild(arrow(st.bearing_deg));
    var txt = el("div", "storm-txt");
    txt.appendChild(el("p", "storm-name", ((tx[st.classification] || st.classification || "") + " " + (st.name || "")).trim()));
    var bits = [];
    if (typeof st.distance_mi === "number") bits.push(fmt(tx.away, { d: Math.round(st.distance_mi).toLocaleString(SC.locale()), dir: compass(st.bearing_deg) }).replace(/\s{2,}/g, " "));
    if (st.intensity_kt != null && st.intensity_kt !== "") bits.push(st.intensity_kt + " " + tx.kt);
    if (st.movement_kt != null && st.movement_dir_deg != null)
      bits.push(fmt(tx.moving, { dir: compass(st.movement_dir_deg), m: st.movement_kt, kt: tx.kt }));
    if (bits.length) txt.appendChild(el("p", "storm-facts", bits.join(" · ")));
    top.appendChild(txt);
    box.appendChild(top);

    box.appendChild(el("p", st.watches_warnings ? "storm-ww warn" : "storm-ww", st.watches_warnings ? tx.warn : tx.none));

    var t = clock(st.last_update || (d.fetched_at ? d.fetched_at * 1000 : ""));
    var foot = el("p", "storm-foot");
    if (t) foot.appendChild(el("span", "storm-time", fmt(d.stale ? tx.asof : tx.updated, { t: t })));
    if (st.advisory_url) foot.appendChild(link(st.advisory_url, tx.advisory, d.stale, tx));
    if (st.graphics_url) foot.appendChild(link(st.graphics_url, tx.cone, d.stale, tx));
    box.appendChild(foot);
    return box;
  }

  /* card screen: one summary line (name · distance · warnings) with a disclosure for the full strip */
  function compact() {
    var tx = S(), st = data.storm;
    if (!st) return build();
    var det = el("details", "storm-det");
    var sum = el("summary", "storm-sum");
    var parts = [((tx[st.classification] || st.classification || "") + " " + (st.name || "")).trim()];
    if (typeof st.distance_mi === "number")
      parts.push(fmt(tx.away, { d: Math.round(st.distance_mi).toLocaleString(SC.locale()), dir: compass(st.bearing_deg) }).replace(/\s{2,}/g, " "));
    var line = el("span", "storm-line", parts.join(" · ") + " · ");
    line.appendChild(el("span", st.watches_warnings ? "storm-wws warn" : "storm-wws", st.watches_warnings ? tx.warnS : tx.noneS));
    sum.appendChild(line);
    sum.appendChild(el("span", "storm-more", tx.more));
    det.appendChild(sum);
    det.appendChild(build());
    return det;
  }

  function paint(which) {
    var host = document.getElementById("storm-" + which);
    if (!host) return;
    if (!data || !data.available) { host.hidden = true; host.textContent = ""; shown[which] = false; return; }
    var wasShown = shown[which];
    host.textContent = "";
    host.setAttribute("role", "group");
    host.setAttribute("aria-label", S().aria || "NHC");
    host.appendChild(which === "card" ? compact() : build());
    host.hidden = false;
    shown[which] = true;
    if (!wasShown && SC.motion) SC.motion.enter(host);
  }
  function paintAll() { paint("lang"); paint("card"); }

  function refresh() {
    if (busy || !window.fetch) return;
    var home = SC.state.home;
    var onCard = SC.state.screen === "card" && home && typeof home.lat === "number";
    var lat = onCard ? home.lat : DEF.lat, lng = onCard ? home.lng : DEF.lng;
    busy = true;
    var ctl = window.AbortController ? new AbortController() : null;
    var to = setTimeout(function () { if (ctl) ctl.abort(); }, 8000);
    fetch("/api/storms?lat=" + lat + "&lng=" + lng, ctl ? { signal: ctl.signal } : undefined)
      .then(function (r) { if (!r.ok) throw new Error("storms " + r.status); return r.json(); })
      .then(function (j) { data = j && j.available ? j : null; paintAll(); })
      .catch(function () { /* silent: keep the last good card, or stay hidden */ if (!data) paintAll(); })
      .then(function () { clearTimeout(to); busy = false; });
  }

  SC.storm = { refresh: refresh };
  SC.onLang(paintAll);
  function init() { refresh(); setInterval(refresh, 10 * 60 * 1000); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
