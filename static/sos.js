/* StormCard SOS: a sheet of real actions (911, text my location, 311). Nothing dials or sends by itself. */
(function () {
  "use strict";
  var SC = window.SC, st = SC.state, t = SC.t;
  var $ = function (id) { return document.getElementById(id); };
  var fix = null;

  function h(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function place() {
    var r = st.result || {};
    return fix || r.home || st.home || (r.facts && r.facts.home) || null;
  }
  function body() {
    var r = st.result || {}, p = place();
    var lines = [t("sosMsg")];
    if (p && typeof p.lat === "number") lines.push(t(fix ? "sosHere" : "sosPlace") + " https://maps.google.com/?q=" + p.lat.toFixed(5) + "," + p.lng.toFixed(5));
    if (r.zone) lines.push(t("sosZone", { z: r.zone }));
    var s = (r.shelters || [])[0];
    if (s && s.name) lines.push(t("sosShelter", { n: s.name }));
    return lines.join("\n");
  }
  /* what she (or a neighbour) reads to the 911 dispatcher; English, because that is what the call taker speaks */
  var LANG_EN = { kre: "Haitian Creole", es: "Spanish", en: "English" };
  function summary911() {
    var r = st.result || {}, p = place(), f = (r.facts && r.facts.flags) || {};
    var lines = ["I need help."];
    if (p && typeof p.lat === "number") {
      var nm = (r.home && r.home.name) || (st.home && st.home.name) || "";
      lines.push("I am at " + (nm ? nm + ", Miami-Dade" : "Miami-Dade") + " (GPS " + p.lat.toFixed(5) + ", " + p.lng.toFixed(5) + ").");
    }
    if (st.lang && st.lang !== "en") lines.push("I speak " + LANG_EN[st.lang] + ". Please get an interpreter.");
    var hh = [];
    if (f.medical) hh.push("I have medical needs");
    if (f.no_car) hh.push("I have no car");
    if (f.pet) hh.push("I have a pet with me");
    if (f.kids) hh.push("there are children with me");
    if (hh.length) lines.push(hh.join(", ") + ".");
    if (r.zone) lines.push("Storm surge zone " + r.zone + ".");
    return lines.join(" ");
  }
  function paintSummary() {
    var b = $("sosSum");
    if (b) b.textContent = summary911();
  }

  function paintSms() {
    var a = $("sosSms");
    if (a) a.href = "sms:?&body=" + encodeURIComponent(body());
  }
  function open() {
    var sh = $("sos");
    sh.hidden = false;
    document.body.classList.add("ar-open");
    paintSms();
    paintSummary();
    /* best effort: a fresh GPS fix if the browser allows it (HTTPS); otherwise the chosen place */
    if (window.isSecureContext && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(function (pos) {
        fix = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        paintSms();
        paintSummary();
      }, function () {}, { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 });
    }
    $("sosClose").focus();
  }
  function close() {
    $("sos").hidden = true;
    document.body.classList.remove("ar-open");
    $("dockSos").focus();
  }
  function build() {
    var sh = h("div", "sos");
    sh.id = "sos"; sh.hidden = true;
    sh.setAttribute("role", "dialog"); sh.setAttribute("aria-modal", "true"); sh.setAttribute("aria-labelledby", "sosH");
    var panel = h("div", "sos-panel");
    var top = h("div", "sos-top");
    var hh = h("h2", "sos-h", ""); hh.id = "sosH"; top.appendChild(hh);
    var x = h("button", "sos-x", "×"); x.type = "button"; x.id = "sosClose"; x.addEventListener("click", close); top.appendChild(x);
    panel.appendChild(top);
    var sumBox = h("div", "sos-sum");
    sumBox.appendChild(h("p", "sos-sum-h", ""));
    var sumTx = h("p", "sos-sum-tx", ""); sumTx.id = "sosSum"; sumTx.setAttribute("lang", "en");
    sumBox.appendChild(sumTx);
    panel.appendChild(sumBox);
    var a911 = h("a", "sos-act s911"); a911.href = "tel:911"; a911.appendChild(h("span", null, "")); panel.appendChild(a911);
    var sms = h("a", "sos-act ssms"); sms.id = "sosSms"; sms.href = "sms:"; sms.appendChild(h("span", null, "")); panel.appendChild(sms);
    var a311 = h("a", "sos-act s311"); a311.href = "tel:311"; a311.appendChild(h("span", null, "")); panel.appendChild(a311);
    panel.appendChild(h("p", "sos-note", ""));
    sh.appendChild(panel);
    sh.addEventListener("click", function (e) { if (e.target === sh) close(); });
    sh.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
    document.body.appendChild(sh);
  }
  function paint() {
    $("sosH").textContent = t("sosTitle");
    $("sosClose").setAttribute("aria-label", t("arClose"));
    document.querySelector(".s911 span").textContent = t("sos911");
    document.querySelector(".ssms span").textContent = t("sosText");
    document.querySelector(".s311 span").textContent = t("sos311");
    document.querySelector(".sos-note").textContent = t("sosNote");
    document.querySelector(".sos-sum-h").textContent = t("sosRead");
    paintSms();
  }
  function init() {
    build();
    var b = $("dockSos");
    if (b) b.addEventListener("click", open);
    paint();
    SC.onLang(paint);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
