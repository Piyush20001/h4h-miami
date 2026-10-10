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
    var el = $("hubStatus");
    if (el) el.textContent = t(SC.hub && SC.hub.internet === false ? "hubOffline" : "hubOnline");
  }

  SC.paintHub = paintSwitch;

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
    if (window.SC && SC.motion) SC.motion.enter(li);
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
  function stepDone(s, lang) {
    var name = String(s.tool || "");
    var key = "tool_" + name;
    var label = SC.tl(lang, key);
    var a = argText(s.args);
    return SC.stepRow("done", label === key ? name : label, [
      a ? h("code", "trace-args", a) : null,
      h("span", "trace-res", String(s.result_summary || ""))
    ]);
  }
  function traceBlock(trace, lang) {
    var det = h("details", "trace");
    det.open = false;
    det.appendChild(h("summary", null, SC.tl(lang, "traceTitle")));
    if (!trace.length) {
      det.appendChild(h("p", "trace-none", SC.tl(lang, "traceNone")));
      return det;
    }
    var ol = h("ol", "trace-steps");
    trace.forEach(function (s) { ol.appendChild(stepDone(s, lang)); });
    det.appendChild(ol);
    return det;
  }
  function messageBox(msg, lang) {
    var box = h("div", "msg-box");
    box.appendChild(h("p", "msg-text", msg));
    box.lastChild.style.whiteSpace = "pre-wrap";
    var row = h("div", "msg-actions");
    var send = h("a", "btn btn-primary small", SC.tl(lang, "msgSend"));
    send.href = "sms:?&body=" + encodeURIComponent(msg);
    var copy = h("button", "btn btn-ghost small", SC.tl(lang, "msgCopy"));
    copy.type = "button";
    copy.addEventListener("click", function () {
      try {
        navigator.clipboard.writeText(msg).then(function () {
          copy.textContent = SC.tl(lang, "msgCopied");
        }, function () {});
      } catch (e) { /* clipboard unavailable */ }
    });
    row.appendChild(send);
    row.appendChild(copy);
    box.appendChild(row);
    return box;
  }
  function fill(turn, answer, backend, trace, lang, message) {
    turn.a.textContent = "";
    turn.a.appendChild(SC.setText(h("p", "ans"), answer));
    turn.a.appendChild(h("p", "badge b-" + backend, badgeText(backend)));
    if (typeof message === "string" && message) turn.a.appendChild(messageBox(message, lang));
    if (Array.isArray(trace)) {
      document.querySelectorAll("#thread details.trace").forEach(function (d) { d.open = false; });
      turn.a.appendChild(traceBlock(trace, lang));
    }
    if (SC.motion) SC.motion.stagger(turn.a.children);
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
    var payload = JSON.stringify({ question: q, lang: lang, card: st.result.api || st.result.card_text, force_offline: false });
    var sig = ctrl ? ctrl.signal : undefined;
    var hdr = { "Content-Type": "application/json" };
    var steps = 0, doneRow = null;

    function viaJson() {
      return fetch("/api/ask", { method: "POST", headers: hdr, body: payload, signal: sig }).then(function (res) {
        if (!res.ok) throw new Error("http " + res.status);
        return res.json();
      }).then(function (d) {
        if (!d || typeof d.answer !== "string") throw new Error("bad payload");
        fill(turn, d.answer, d.backend || "none", d.trace, lang, d.message);
      });
    }
    function onLine(line) {
      var m;
      try { m = JSON.parse(line); } catch (e) { return; }
      if (m.step) {
        var ol = turn.a.querySelector("ol.trace-steps.live");
        if (!ol) return;
        steps++;
        var run = ol.lastChild;
        var row = stepDone(m.step, lang);
        if (run) ol.replaceChild(row, run); else ol.appendChild(row);
        ol.appendChild(SC.stepRow("run", t("thinking")));
      } else if (m.done) {
        if (typeof m.answer !== "string") throw new Error("bad payload");
        doneRow = m;
      }
    }
    function viaStream() {
      return fetch("/api/ask/stream", { method: "POST", headers: hdr, body: payload, signal: sig }).then(function (res) {
        if (!res.ok || !res.body || !res.body.getReader) throw new Error("no stream");
        var rd = res.body.getReader(), dec = new TextDecoder(), buf = "";
        function pump() {
          return rd.read().then(function (r) {
            if (r.value) buf += dec.decode(r.value, { stream: !r.done });
            var parts = buf.split("\n");
            buf = r.done ? "" : parts.pop();
            if (r.done && parts.length && !parts[parts.length - 1]) parts.pop();
            parts.forEach(function (ln) { if (ln.trim()) onLine(ln); });
            if (r.done) {
              if (!doneRow) throw new Error("stream ended early");
              fill(turn, doneRow.answer, doneRow.backend || "none", doneRow.trace, lang, doneRow.message);
              return;
            }
            return pump();
          });
        }
        return pump();
      });
    }
    var noFetchStream = typeof TextDecoder === "undefined";
    (noFetchStream ? viaJson() : viaStream().catch(function (e) {
      if (steps > 0 || (ctrl && ctrl.signal.aborted)) throw e;
      return viaJson();  // streaming unsupported or failed before any step
    })).catch(function () {
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
    window.addEventListener("hubchange", paintSwitch);
    window.addEventListener("langchange", paintSwitch);
    SC.onLang(paintSwitch);
    paintSwitch();
    $("dockAsk").addEventListener("click", function () {
      var ask = $("ask");
      ask.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
      setTimeout(function () { $("askInput").focus({ preventScroll: true }); }, reduced ? 0 : 350);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
