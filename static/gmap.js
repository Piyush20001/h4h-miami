/* StormCard embedded Google Map. Online + key only; the SVG chart (chart.js) is always rendered first
   and stays the fallback. The one external script (Maps JS API) is loaded only when online with a key. */
(function () {
  "use strict";
  var SC = window.SC;
  var TXT = {
    kre: { cap: "Google Maps · anliy", toChart: "Montre kat san entènèt la", toMap: "Montre Google Maps", dirs: "Wè chemen an", dirsA: "Wè chemen an pou ale nan {n} (nouvo paj)", busDirs: "Wè chemen a pye", busDirsA: "Wè chemen a pye pou ale nan {n} (nouvo paj)" },
    es: { cap: "Google Maps · en línea", toChart: "Ver mapa sin conexión", toMap: "Ver Google Maps", dirs: "Ver ruta", dirsA: "Ver ruta a {n} (nueva pestaña)", busDirs: "Ruta a pie", busDirsA: "Ruta a pie a {n} (nueva pestaña)" },
    en: { cap: "Google Maps · online", toChart: "Show offline chart", toMap: "Show Google Map", dirs: "Directions", dirsA: "Open directions to {n} (new tab)", busDirs: "Walking directions", busDirsA: "Walking directions to {n} (new tab)" }
  };
  function tx(k) { var l = (SC && SC.state && SC.state.lang) || "en"; return (TXT[l] || TXT.en)[k]; }

  var TIMEOUT = 6000;
  var STYLE = [
    { elementType: "geometry", stylers: [{ saturation: -60 }, { lightness: 8 }] },
    { featureType: "poi", stylers: [{ visibility: "off" }] },
    { featureType: "poi.business", stylers: [{ visibility: "off" }] },
    { featureType: "transit", stylers: [{ visibility: "off" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#e4e9ec" }] },
    { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
    { featureType: "road", elementType: "labels.text", stylers: [{ saturation: -80 }, { lightness: 45 }] },
    { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#d6dde2" }] },
    { featureType: "water", stylers: [{ color: "#dbe6ee" }] },
    { featureType: "landscape", stylers: [{ color: "#f4f6f5" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#435a6e" }] },
    { featureType: "administrative.locality", elementType: "labels.text", stylers: [{ saturation: -70 }, { lightness: 45 }] },
    { featureType: "administrative.neighborhood", elementType: "labels.text", stylers: [{ saturation: -70 }, { lightness: 50 }] },
    { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] }
  ];
  var zonesP = null;
  function getZones() {
    if (!zonesP) {
      zonesP = fetch("/api/zones").then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { zonesP = null; return null; });
    }
    return zonesP;
  }
  function svgIcon(svg, px) {
    return { url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
      scaledSize: new window.google.maps.Size(px, px), anchor: new window.google.maps.Point(px / 2, px / 2) };
  }
  function homeIcon() {
    return svgIcon('<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><rect x="1.500" y="1.500" width="25" height="25" rx="3" fill="#15293d" stroke="#fff" stroke-width="2.500"/><path d="M7.500 15L14 8.500L20.500 15M9.500 14V20H18.500V14" fill="none" stroke="#fff" stroke-width="2.200"/></svg>', 28);
  }
  function busIcon() {
    return svgIcon('<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26"><rect x="1.500" y="1.500" width="23" height="23" rx="3" fill="#2c5c8a" stroke="#fff" stroke-width="2.500"/><path d="M6 8.500H20V16H6ZM6 12H20M8.500 18.500V16M17.500 18.500V16" fill="none" stroke="#fff" stroke-width="1.800"/></svg>', 26);
  }
  var INK = "#15293d", BLUE = "#2c5c8a";

  var failed = false;      /* auth failure or script error: stop trying this session */
  var userChart = false;   /* the resident chose the offline chart */
  var keyP = null, scriptP = null, cur = null;

  function getKey() {
    if (!keyP) {
      keyP = fetch("/api/config").then(function (r) { return r.ok ? r.json() : {}; })
        .then(function (j) { return (j && typeof j.maps_api_key === "string") ? j.maps_api_key : ""; })
        .catch(function () { keyP = null; return ""; });
    }
    return keyP;
  }

  function loadScript(key) {
    if (window.google && window.google.maps) return Promise.resolve();
    if (scriptP) return scriptP;
    scriptP = new Promise(function (resolve, reject) {
      window.__scMapReady = function () { resolve(); };
      var s = document.createElement("script");
      s.src = "https://maps.googleapis.com/maps/api/js?key=" + encodeURIComponent(key) +
        "&callback=__scMapReady&loading=async&v=weekly";
      s.async = true;
      s.onerror = function () { scriptP = null; s.remove(); reject(new Error("maps script")); };
      document.head.appendChild(s);
    });
    return scriptP;
  }

  /* Google calls this for a bad key or an API that is not enabled (e.g. ApiNotActivatedMapError). */
  window.gm_authFailure = function () {
    failed = true;
    if (cur) cur.fallback();
  };

  function libs() {
    var g = window.google.maps;
    if (typeof g.importLibrary !== "function") return Promise.resolve();
    return Promise.all([g.importLibrary("maps"), g.importLibrary("marker")]);
  }

  function circle(scale, fill) {
    return { path: window.google.maps.SymbolPath.CIRCLE, scale: scale, fillColor: fill, fillOpacity: 1, strokeColor: "#ffffff", strokeWeight: 2 };
  }
  var DIAMOND = "M0,-14 L14,0 L0,14 L-14,0 Z";

  function wrap(host, ctl, opts) {
    if (cur) cur.destroy();
    var done = false, ready = false, shown = false, sel = -1;
    var legend = null, map = null, mapDiv = null, bar = null, toggle = null, timer = null, markers = [], offHandler = null;
    var self = { destroy: destroy, fallback: fallback };

    function paintBar() {
      if (!bar) return;
      toggle.textContent = shown ? tx("toChart") : tx("toMap");
      bar.firstChild.textContent = shown ? tx("cap") : "";
      if (legend) legend.hidden = !shown;
    }
    function setShown(on) {
      shown = on;
      host.classList.toggle("gm-on", on);
      paintBar();
    }
    function teardown() {
      clearTimeout(timer);
      markers.forEach(function (m) { m.setMap(null); });
      markers = [];
      if (mapDiv && mapDiv.parentNode) mapDiv.parentNode.removeChild(mapDiv);
      if (bar && bar.parentNode) bar.parentNode.removeChild(bar);
      if (legend && legend.parentNode) legend.parentNode.removeChild(legend);
      legend = null;
      host.classList.remove("gm-on");
      map = mapDiv = bar = null;
      ready = false; shown = false;
    }
    function destroy() {
      done = true;
      window.removeEventListener("offline", fallback);
      window.removeEventListener("online", onOnline);
      teardown();
      if (cur === self) cur = null;
    }
    /* back to the chart, never a blank box; online again may retry unless the key was rejected */
    function fallback() { teardown(); }
    function onOnline() { if (!ready && !done && !failed) start(); }

    function build() {
      var gm = window.google.maps;
      mapDiv = document.createElement("div");
      mapDiv.className = "gm-map";
      host.appendChild(mapDiv);
      map = new gm.Map(mapDiv, {
        center: { lat: opts.home.lat, lng: opts.home.lng }, zoom: 13,
        styles: STYLE, gestureHandling: "cooperative", disableDefaultUI: true, zoomControl: true,
        clickableIcons: false, keyboardShortcuts: false
      });
      var bounds = new gm.LatLngBounds();
      var hp = { lat: opts.home.lat, lng: opts.home.lng };
      bounds.extend(hp);
      bounds.extend({ lat: hp.lat + 0.008, lng: hp.lng + 0.008 });
      bounds.extend({ lat: hp.lat - 0.008, lng: hp.lng - 0.008 });
      var hm = new gm.Marker({
        map: map, position: hp, zIndex: 9000, title: opts.labels.home,
        icon: homeIcon()
      });
      hm.sc = false; markers.push(hm);
      (opts.shelters || []).forEach(function (s, i) {
        var p = { lat: s.lat, lng: s.lng };
        if (!opts.focusBus) bounds.extend(p);
        var m = new gm.Marker({
          map: map, position: p, zIndex: i === 0 ? 8000 : 5000 + i, title: s.name || "",
          icon: i === 0 ? circle(17, "#3d7556") : circle(13, BLUE),
          label: { text: String(i + 1), color: "#ffffff", fontWeight: "800", fontSize: "14px" }
        });
        m.sc = true;
        markers.push(m);
      });
      /* markers[0] is home; shelter j is markers[j + 1] */
      (opts.special || []).forEach(function (s) {
        var p = { lat: s.lat, lng: s.lng };
        if (!opts.focusBus) bounds.extend(p);
        var m = new gm.Marker({
          map: map, position: p, title: s.name || "", zIndex: 4500,
          icon: { path: DIAMOND, scale: 1, fillColor: BLUE, fillOpacity: 1, strokeColor: "#ffffff", strokeWeight: 2 },
          label: { text: "+", color: "#ffffff", fontWeight: "800", fontSize: "16px" }
        });
        m.sc = false;
        markers.push(m);
      });
      (opts.bus || []).slice(0, 2).forEach(function (b) {
        var p = { lat: b.lat, lng: b.lng };
        bounds.extend(p);
        var m = new gm.Marker({ map: map, position: p, title: b.name || "", zIndex: 4000, icon: busIcon() });
        m.sc = false;
        markers.push(m);
      });
      var zl = String(opts.zone || "").toUpperCase();
      if (zl) {
        getZones().then(function (fc) {
          if (done || !map || !fc || !Array.isArray(fc.features)) return;
          var own = fc.features.filter(function (f) {
            return f && f.properties && String(f.properties.zone || "").toUpperCase() === zl;
          });
          if (!own.length) return;
          map.data.addGeoJson({ type: "FeatureCollection", features: own });
          map.data.setStyle({ fillColor: INK, fillOpacity: 0.1, strokeColor: INK, strokeWeight: 1.5, strokeOpacity: 0.7, clickable: false });
        });
      }
      map.fitBounds(bounds, 36);
      gm.event.addListenerOnce(map, "tilesloaded", function () {
        if (done) return;
        clearTimeout(timer);
        ready = true;
        bar = document.createElement("div");
        bar.className = "gm-bar";
        bar.appendChild(document.createElement("span"));
        toggle = document.createElement("button");
        toggle.type = "button";
        toggle.addEventListener("click", function () {
          userChart = shown;
          setShown(!shown);
        });
        bar.appendChild(toggle);
        host.parentNode.appendChild(bar);
        legend = buildLegend();
        host.parentNode.appendChild(legend);
        setShown(!userChart);
        if (sel >= 0) select(sel);
      });
    }

    function buildLegend() {
      var L = (opts.labels && opts.labels.legend) || {};
      var items = [["lg-home", "\u25A0", L.home]];
      if ((opts.shelters || []).length) items.push(["lg-shel", "\u2460", L.shelter]);
      if ((opts.special || []).length) items.push(["lg-sn", "\u25C6", L.special]);
      if ((opts.bus || []).length) items.push(["lg-bus", "\u25A3", L.bus]);
      if (opts.zone) items.push(["lg-zone", "\u25A8", L.zone]);
      var ul = document.createElement("ul");
      ul.className = "gm-legend";
      items.forEach(function (it) {
        var li = document.createElement("li");
        var g = document.createElement("span");
        g.className = "lg " + it[0]; g.setAttribute("aria-hidden", "true"); g.textContent = it[1];
        li.appendChild(g);
        li.appendChild(document.createTextNode(it[2] || ""));
        ul.appendChild(li);
      });
      return ul;
    }

    function start() {
      if (done || failed || !navigator.onLine || (SC.hub && SC.hub.internet === false)) return;
      clearTimeout(timer);
      timer = setTimeout(function () { if (!ready) fallback(); }, TIMEOUT);
      getKey().then(function (key) {
        if (done) return;
        if (!key) { clearTimeout(timer); return; }
        return loadScript(key).then(libs).then(function () {
          if (done || failed || !navigator.onLine) return;
          if (!map) build();
        });
      }).catch(function () { if (!done) fallback(); });
    }

    /* shelter j is markers[j + 1]: remap sc-index for the highlight */
    function select(i) {
      var r = ctl.select(i);
      sel = r;
      if (map && markers.length) {
        markers.forEach(function (m, j) {
          if (!m.sc) return;
          var on = j - 1 === sel;
          m.setIcon(circle(on ? 17 : 13, on ? INK : BLUE));
          m.setZIndex(on ? 1000 : j);
        });
        if (sel >= 0 && markers[sel + 1]) map.panTo(markers[sel + 1].getPosition());
      }
      return r;
    }
    cur = self;
    window.addEventListener("offline", fallback);
    window.addEventListener("online", onOnline);
    window.addEventListener("hubchange", function (e) {
      if (!e.detail.internet) fallback();
      else { keyP = null; onOnline(); }
    });
    start();
    return { select: function (i) { return select(i); }, get selected() { return sel; } };
  }

  /* Google Maps directions link: no key needed. */
  function dirLink(home, s, walk) {
    if (!home || !s || typeof home.lat !== "number" || typeof home.lng !== "number" ||
        typeof s.lat !== "number" || typeof s.lng !== "number") return null;
    /* Google directions are a dead end with no internet */
    if (window.SC && SC.hub && SC.hub.internet === false) return null;
    var a = document.createElement("a");
    a.className = "plate-dirs";
    /* no origin: Google Maps starts from the phone's live location */
    a.href = "https://www.google.com/maps/dir/?api=1&destination=" + s.lat + "," + s.lng +
      "&travelmode=" + (walk ? "walking" : "driving");
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = tx(walk ? "busDirs" : "dirs");
    a.setAttribute("aria-label", tx(walk ? "busDirsA" : "dirsA").replace("{n}", s.name || ""));
    return a;
  }

  window.SCMap = { wrap: wrap, dirLink: dirLink };
})();
