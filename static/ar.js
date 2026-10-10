/* StormCard "Point my way": camera view + an arrow that points at a bus stop or shelter.
   Compass + GPS only (straight-line bearing, not a road route). Camera, compass and GPS
   need HTTPS on iPhone; without them it still shows the arrow from the saved place. */
(function () {
  "use strict";
  var SC = window.SC, t = SC.t;
  var $ = function (id) { return document.getElementById(id); };
  var NS = "http://www.w3.org/2000/svg";
  var ov = null, video = null, stream = null, watchId = null, target = null;
  var wake = null, here = null, heading = null, gpsAcc = null, session = 0, shown = null;

  function h(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function bearing(a, b) {
    var k = Math.cos((a.lat * Math.PI) / 180);
    return ((Math.atan2((b.lng - a.lng) * k, b.lat - a.lat) * 180) / Math.PI + 360) % 360;
  }
  function miles(a, b) {
    var R = 3958.8, r = Math.PI / 180;
    var dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
    var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  var CARD = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

  function build() {
    ov = h("div", "ar");
    ov.setAttribute("role", "dialog");
    ov.setAttribute("aria-modal", "true");
    ov.setAttribute("aria-labelledby", "arName");
    video = h("video", "ar-cam");
    video.setAttribute("playsinline", "");
    video.muted = true;
    video.setAttribute("autoplay", "");
    video.setAttribute("muted", "");
    ov.appendChild(video);

    var top = h("div", "ar-top");
    top.appendChild(h("p", "ar-k", ""));
    var nm = h("p", "ar-nm", "");
    nm.id = "arName";
    top.appendChild(nm);
    top.appendChild(h("p", "ar-dist", ""));
    ov.appendChild(top);

    var stage = h("div", "ar-stage");
    var sv = document.createElementNS(NS, "svg");
    sv.setAttribute("viewBox", "0 0 200 260");
    sv.setAttribute("class", "ar-arrow");
    sv.setAttribute("aria-hidden", "true");
    var p = document.createElementNS(NS, "path");
    p.setAttribute("d", "M100 8L182 120H130V252H70V120H18Z");
    sv.appendChild(p);
    stage.appendChild(sv);
    stage.appendChild(h("p", "ar-cardinal", ""));
    ov.appendChild(stage);

    var foot = h("div", "ar-foot");
    foot.appendChild(h("p", "ar-hint", ""));
    foot.appendChild(h("p", "ar-sensor", ""));
    foot.appendChild(h("p", "ar-note", ""));
    var close = h("button", "btn btn-primary ar-close", "");
    close.type = "button";
    close.addEventListener("click", closeAr);
    foot.appendChild(close);
    ov.appendChild(foot);
    document.body.appendChild(ov);
    ov.addEventListener("keydown", function (e) { if (e.key === "Escape") closeAr(); });
  }

  function card(b) { return CARD[Math.round(b / 45) % 8]; }
  /* shortest-path rotation so the arrow never spins the long way past north */
  function ease(to) {
    if (shown === null) { shown = to; return shown; }
    var d = ((to - shown) % 360 + 540) % 360 - 180;
    shown += d * 0.35;
    return shown;
  }
  function paint() {
    if (!ov || !target) return;
    var live = here && gpsAcc !== null && gpsAcc <= 150;
    var from = live ? here : target.home;
    var d = miles(from, target), b = bearing(from, target);
    var dist = t("arDist", { d: d < 0.1 ? d.toFixed(2) : d.toFixed(1), c: card(b) });
    ov.querySelector(".ar-dist").textContent = live && d < 0.03 ? t("arNear") : live ? dist : dist + " · " + t("arFromSaved");
    var arrow = ov.querySelector(".ar-arrow");
    var hint, ahead = false;
    if (heading === null) {
      arrow.style.visibility = "hidden";
      ov.querySelector(".ar-cardinal").textContent = card(b);
      hint = t("arNoCompass", { c: card(b) });
    } else {
      arrow.style.visibility = "visible";
      ov.querySelector(".ar-cardinal").textContent = "";
      var r = ((b - heading) % 360 + 540) % 360 - 180;
      var near = live && d < 0.03;
      ahead = Math.abs(r) < (ov.classList.contains("is-ahead") ? 25 : 15); /* hysteresis: no flicker */
      hint = near ? t("arNear") : ahead ? t("arAhead") : Math.abs(r) > 150 ? t("arBehind") : r > 0 ? t("arRight") : t("arLeft");
      if (!near) arrow.style.transform = "rotate(" + ease(r).toFixed(1) + "deg)"; /* GPS bearing is noise this close: freeze */
    }
    ov.classList.toggle("is-ahead", ahead);
    ov.querySelector(".ar-hint").textContent = hint;
    ov.querySelector(".ar-sensor").textContent = [
      heading === null ? t("arCompassWait") : t("arCompassOk"),
      gpsAcc === null ? t("arGpsWait") : live ? t("arGpsOk") + " ±" + Math.round(gpsAcc * 3.28) + " ft" : t("arGpsWeak", { f: Math.round(gpsAcc * 3.28) })
    ].join(" · ");
  }

  var smooth = null;
  function onOrient(e) {
    var hd;
    if (typeof e.webkitCompassHeading === "number") hd = e.webkitCompassHeading;
    else if (e.absolute && typeof e.alpha === "number") hd = (360 - e.alpha) % 360;
    else return;
    /* circular smoothing: average on the unit circle, not raw degrees */
    var x = Math.cos(hd * Math.PI / 180), y = Math.sin(hd * Math.PI / 180);
    smooth = smooth ? { x: smooth.x * 0.75 + x * 0.25, y: smooth.y * 0.75 + y * 0.25 } : { x: x, y: y };
    heading = (Math.atan2(smooth.y, smooth.x) * 180 / Math.PI + 360) % 360;
    paint();
  }

  function startSensors() {
    var my = ++session;
    function stale() { return my !== session; }
    var secure = window.isSecureContext;
    if (secure && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
        .then(function (s) {
          if (stale()) { s.getTracks().forEach(function (k) { k.stop(); }); return; }
          stream = s; video.srcObject = s; return video.play().then(function () { ov.classList.add("has-cam"); });
        })
        .catch(function () { if (!stale()) ov.querySelector(".ar-sensor").dataset.cam = t("arNoCam"); });
    }
    if (secure && navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(function (pos) {
        if (stale()) return;
        here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        gpsAcc = pos.coords.accuracy;
        paint();
      }, function () {}, { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 });
    }
    var D = window.DeviceOrientationEvent;
    if (D && typeof D.requestPermission === "function") {
      D.requestPermission().then(function (r) {
        if (r === "granted" && !stale()) window.addEventListener("deviceorientation", onOrient, true);
      }).catch(function () {});
    } else if (D) {
      window.addEventListener("deviceorientationabsolute", onOrient, true);
      window.addEventListener("deviceorientation", onOrient, true);
    }
    ov.querySelector(".ar-note").textContent = (secure ? "" : t("arNeedHttps") + " ") + t("arUpright") + " " + t("arStraight");
  }

  function openAr(tg) {
    if (!tg || typeof tg.lat !== "number" || !tg.home) return;
    target = tg; here = null; heading = null; gpsAcc = null; shown = null; smooth = null;
    if (!ov) build();
    ov.querySelector(".ar-k").textContent = tg.kind === "bus" ? t("arToBus") : t("arToShelter");
    ov.querySelector(".ar-nm").textContent = tg.name || "";
    ov.querySelector(".ar-close").textContent = t("arClose");
    ov.hidden = false;
    document.body.classList.add("ar-open");
    startSensors();
    try { if (navigator.wakeLock) navigator.wakeLock.request("screen").then(function (l) { wake = l; }).catch(function () {}); } catch (e) { /* not supported */ }
    paint();
    ov.querySelector(".ar-close").focus();
  }

  function closeAr() {
    if (!ov) return;
    session++;
    ov.hidden = true;
    ov.classList.remove("has-cam", "is-ahead");
    document.body.classList.remove("ar-open");
    if (stream) { stream.getTracks().forEach(function (k) { k.stop(); }); stream = null; }
    if (video) video.srcObject = null;
    if (wake) { try { wake.release(); } catch (e) { /* already released */ } wake = null; }
    if (watchId !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchId);
    watchId = null;
    window.removeEventListener("deviceorientation", onOrient, true);
    window.removeEventListener("deviceorientationabsolute", onOrient, true);
  }

  /* button used by the card for bus stops and shelters */
  SC.arButton = function (home, s, kind) {
    if (!home || !s || typeof s.lat !== "number" || typeof s.lng !== "number") return null;
    var b = h("button", "ar-btn");
    b.type = "button";
    var ic = document.createElementNS(NS, "svg");
    ic.setAttribute("viewBox", "0 0 24 24"); ic.setAttribute("width", 20); ic.setAttribute("height", 20);
    ic.setAttribute("aria-hidden", "true");
    var ip = document.createElementNS(NS, "path");
    ip.setAttribute("d", "M12 3L19 20L12 16L5 20Z");
    ic.appendChild(ip);
    b.appendChild(ic);
    b.appendChild(h("span", null, t("arBtn")));
    b.addEventListener("click", function () {
      openAr({ lat: s.lat, lng: s.lng, name: s.name, kind: kind, home: home });
    });
    return b;
  };
  SC.ar = { open: openAr, close: closeAr };
})();
