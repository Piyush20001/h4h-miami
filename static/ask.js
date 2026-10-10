/* StormCard ask thread. Answers rendered with textContent only. */
(function () {
  "use strict";
  var SC = window.SC, st = SC.state, t = SC.t;
  var $ = function (id) { return document.getElementById(id); };
  var reduced = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var busy = false;

  function h(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function badgeText(b) {
    return t("b_" + (["gemini", "ollama", "none"].indexOf(b) >= 0 ? b : "none"));
  }

  function paintChips() {
    document.querySelectorAll("#chips .chip").forEach(function (c) {
      c.textContent = t(c.dataset.chip);
    });
  }
  function ready() { return !!(st.result && st.result.card_text); }
  function paintAsk() {
    var ok = ready();
    $("askSend").disabled = !ok || busy;
    $("askInput").disabled = !ok;
    document.querySelectorAll("#chips .chip").forEach(function (c) { c.disabled = !ok; });
    $("askInput").placeholder = ok ? t("askPlaceholder") : t("askWait");
    $("ask").classList.toggle("is-wait", !ok);
  }
  SC.paintAsk = paintAsk;
  function paintSwitch() {
    $("offline").setAttribute("aria-checked", st.forceOffline ? "true" : "false");
  }

  function addTurn(q) {
    var li = h("li", "turn");
    var qn = h("p", "q");
    qn.appendChild(h("span", "who", t("you")));
    qn.appendChild(h("span", null, q));
    li.appendChild(qn);
    var a = h("div", "a");
    var pol = h("ol", "trace-steps live");
    pol.appendChild(SC.stepRow("run", t("thinking")));
    a.appendChild(pol);
    li.appendChild(a);
    $("thread").appendChild(li);
    if (!reduced && li.scrollIntoView) li.scrollIntoView({ block: "nearest", behavior: "smooth" });
    return { li: li, a: a, q: q };
  }

  function argText(args) {
    var parts = [];
    Object.keys(args || {}).forEach(function (k) {
      var v = args[k];
      if (v === undefined || v === null || v === false || v === "") return;
      parts.push(v === true ? k : k + ": " + (typeof v === "object" ? JSON.stringify(v) : v));
    });
    return parts.join(", ");
  }
  function traceBlock(trace, lang) {
    var det = h("details", "trace");
    det.appendChild(h("summary", null, SC.tl(lang, "traceTitle")));
    if (!trace.length) {
      det.appendChild(h("p", "trace-none", SC.tl(lang, "traceNone")));
      return det;
    }
    var ol = h("ol", "trace-steps");
    trace.forEach(function (s) {
      var name = String(s.tool || "");
      var key = "tool_" + name;
      var label = SC.tl(lang, key);
      var a = argText(s.args);
      ol.appendChild(SC.stepRow("done", label === key ? name : label, [
        a ? h("code", "trace-args", a) : null,
        h("span", "trace-res", String(s.result_summary || ""))
      ]));
    });
    det.appendChild(ol);
    return det;
  }
  function fill(turn, answer, backend, trace, lang) {
    turn.a.textContent = "";
    turn.a.appendChild(SC.setText(h("p", "ans"), answer));
    turn.a.appendChild(h("p", "badge b-" + backend, badgeText(backend)));
    if (Array.isArray(trace)) turn.a.appendChild(traceBlock(trace, lang));
  }
  function fail(turn) {
    turn.a.textContent = "";
    turn.a.appendChild(h("p", "ans err", t("askErr")));
    var b = h("button", "btn btn-ghost small", t("retry"));
    b.type = "button";
    b.addEventListener("click", function () { turn.li.remove(); send(turn.q); });
    turn.a.appendChild(b);
  }

  function send(q) {
    q = (q || "").trim();
    if (!q || busy || !ready()) return;
    busy = true;
    $("askSend").disabled = true;
    var turn = addTurn(q);
    var lang = st.lang;
    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var guard = setTimeout(function () { if (ctrl) ctrl.abort(); }, 120000);
    fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: q, lang: lang, card: st.result.api || st.result.card_text, force_offline: !!st.forceOffline }),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (res) {
      if (!res.ok) throw new Error("http " + res.status);
      return res.json();
    }).then(function (d) {
      if (!d || typeof d.answer !== "string") throw new Error("bad payload");
      fill(turn, d.answer, d.backend || "none", d.trace, lang);
    }).catch(function () {
      fail(turn);
    }).then(function () {
      clearTimeout(guard);
      busy = false;
      paintAsk();
    });
  }

  function init() {
    paintChips();
    paintSwitch();
    paintAsk();
    SC.onLang(paintChips);
    SC.onLang(paintAsk);

    $("askForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var v = $("askInput").value;
      if (!ready() || !v.trim()) { $("askInput").focus(); return; }
      $("askInput").value = "";
      send(v);
    });
    document.querySelectorAll("#chips .chip").forEach(function (c) {
      c.addEventListener("click", function () { send(c.textContent); });
    });
    $("offline").addEventListener("click", function () {
      st.forceOffline = !st.forceOffline;
      paintSwitch();
    });
    $("dockAsk").addEventListener("click", function () {
      var ask = $("ask");
      ask.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
      setTimeout(function () { $("askInput").focus({ preventScroll: true }); }, reduced ? 0 : 350);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
