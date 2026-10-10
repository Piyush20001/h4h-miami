// StormCard intake + card view. All server/model text goes through textContent (ARCHI §18).
(function () {
  var STORE_KEY = "stormcard.last";
  var PRESETS = [
    { id: "little_haiti", lat: 25.83, lng: -80.189 },
    { id: "hialeah", lat: 25.8576, lng: -80.2781 },
    { id: "brickell", lat: 25.7617, lng: -80.1918 }
  ];
  var FLAGS = ["pet", "no_car", "medical", "kids"];
  var SECTIONS = ["what_this_means", "where_to_go", "what_to_bring", "what_to_do_now"];
  var ZONE_COLORS = { A: "#b00020", B: "#d84315", C: "#f9a825", D: "#2e7d32", E: "#1565c0" };

  var state = window.cardState = {
    lang: "kre", preset: null, flags: { pet: false, no_car: false, medical: false, kids: false }, forceOffline: false
  };
  var view = { data: null, saved: false, error: false, loading: false };

  // el("p", {className: "x"}, "text" | [nodes]) — text is always set via textContent.
  function el(tag, props, kids) {
    var n = document.createElement(tag);
    for (var k in props || {}) n[k] = props[k];
    [].concat(kids == null ? [] : kids).forEach(function (c) {
      if (c == null) return;
      n.appendChild(typeof c === "object" ? c : document.createTextNode(String(c)));
    });
    return n;
  }

  function readSaved() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)); } catch (e) { return null; }
  }

  // ---------- Intake ----------
  function renderIntake() {
    var root = document.getElementById("intake");
    if (!root) return;
    root.textContent = "";
    document.documentElement.lang = state.lang;
    document.title = t("app_title");

    var langRow = el("div", { className: "row" }, ["kre", "es", "en"].map(function (l) {
      return el("button", {
        type: "button", className: "btn" + (state.lang === l ? " on" : ""),
        onclick: function () { setLang(l); }
      }, t("lang_" + l));
    }));
    langRow.setAttribute("aria-label", "Language");

    var presetRow = el("div", { className: "row" }, PRESETS.map(function (p) {
      return el("button", {
        type: "button", className: "btn" + (state.preset === p.id ? " on" : ""),
        onclick: function () { state.preset = p.id; renderIntake(); }
      }, t("preset_" + p.id));
    }));

    var toggles = el("div", { className: "toggles" }, FLAGS.map(function (f) {
      return el("label", { className: "toggle" }, [
        el("input", {
          type: "checkbox", checked: state.flags[f],
          onchange: function (e) { state.flags[f] = e.target.checked; }
        }),
        " " + t("flag_" + f)
      ]);
    }));

    var status = view.loading ? t("loading") : "";
    root.appendChild(el("h1", null, t("app_title")));
    root.appendChild(langRow);
    root.appendChild(el("h2", null, t("pick_location")));
    root.appendChild(presetRow);
    root.appendChild(toggles);
    root.appendChild(el("button", {
      type: "button", className: "btn primary", disabled: view.loading, onclick: submit
    }, t("make_card")));
    root.appendChild(el("p", { className: "status", id: "card-status" }, status));
    root.querySelector(".status").setAttribute("role", "status");
  }

  function setLang(l) {
    state.lang = l;
    renderIntake();
    renderCard();
    window.dispatchEvent(new CustomEvent("langchange", { detail: { lang: l } }));
  }

  // ---------- Submit ----------
  function submit() {
    var p = PRESETS.filter(function (x) { return x.id === state.preset; })[0];
    if (!p) { document.getElementById("card-status").textContent = t("no_location"); return; }
    state.forceOffline = typeof window.forceOffline !== "undefined" ? !!window.forceOffline : false;
    view.loading = true;
    renderIntake();
    fetch("/api/card", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lat: p.lat, lng: p.lng, lang: state.lang, flags: state.flags, force_offline: state.forceOffline
      })
    }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then(function (data) {
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify({ data: data, lang: state.lang, preset: state.preset }));
      } catch (e) { /* storage full or disabled: card still shows */ }
      show(data, false, false);
    }).catch(function () {
      var s = readSaved();
      show(s ? s.data : null, !!s, true);
    });
  }

  function show(data, saved, error) {
    view = { data: data, saved: saved, error: error, loading: false };
    window.lastCard = data;
    renderIntake();
    renderCard();
  }

  // ---------- Card ----------
  function renderCard() {
    var root = document.getElementById("card");
    if (!root) return;
    root.textContent = "";
    var d = view.data;
    if (view.error) {
      root.appendChild(el("p", { className: "error" }, [
        d ? t("error") : t("error_server"), " ", t("error_call")
      ]));
    }
    if (!d) return;

    var labels = el("div", { className: "row" });
    if (view.saved) labels.appendChild(el("span", { className: "tag" }, t("saved_card")));
    if (d.sample_data) labels.appendChild(el("span", { className: "tag" }, t("sample_data")));
    if (labels.childNodes.length) root.appendChild(labels);

    // Zone badge
    if (d.zone) {
      var badge = el("div", { className: "zone" }, t("zone_badge", { z: d.zone }));
      badge.style.background = ZONE_COLORS[d.zone] || "#333";
      badge.style.color = d.zone === "C" ? "#000" : "#fff";
      root.appendChild(badge);
    } else {
      root.appendChild(el("div", { className: "zone none" }, t("no_zone")));
    }
    root.appendChild(el("p", { className: "note" }, t("not_flood_zone")));

    // Shelters
    root.appendChild(el("h2", null, t("shelters_heading")));
    root.appendChild(el("ol", { className: "shelters" }, (d.shelters || []).slice(0, 3).map(function (s) {
      return el("li", null, [
        el("strong", null, s.name),
        el("div", null, [s.address, s.city ? ", " + s.city : ""].join("")),
        el("div", null, t("mi_away", { d: Number(s.distance_mi).toFixed(1) })),
        el("div", null, s.pet_friendly === true ? t("pet_yes") : t("pet_unknown")),
        el("div", { className: "note" }, t("call_311"))
      ]);
    })));

    // Gemma card sections
    var ct = d.card_text || {};
    SECTIONS.forEach(function (k) {
      if (!ct[k]) return;
      root.appendChild(el("h2", null, t("sec_" + k)));
      root.appendChild(el("p", { className: "section" }, ct[k]));
    });

    // How we decided
    root.appendChild(el("details", { className: "how" }, [
      el("summary", null, t("how_we_decided")),
      el("h3", null, t("backend")),
      el("p", null, d.backend || "?"),
      el("h3", null, t("distances")),
      el("ul", null, (d.shelters || []).map(function (s) {
        return el("li", null, s.name + ": " + Number(s.distance_mi).toFixed(2) + " mi");
      })),
      el("h3", null, t("sources")),
      el("ul", null, Object.keys(d.sources || {}).map(function (k) {
        return el("li", null, [k + ": ", sourceNode(d.sources[k])]);
      })),
      el("h3", null, t("facts")),
      el("pre", null, JSON.stringify(d.facts || {}, null, 2)),
      d.sample_data ? el("p", { className: "tag" }, t("sample_data")) : null
    ]));

    root.appendChild(el("p", { className: "official" }, t("official_orders")));
  }

  // A source may be a URL string, plain text, or {name, url}. Only http(s) URLs become links.
  function sourceNode(src) {
    var url = typeof src === "string" ? src : src && src.url;
    var label = typeof src === "string" ? src : (src && (src.name || src.url)) || JSON.stringify(src);
    if (typeof url === "string" && /^https?:\/\//i.test(url)) {
      return el("a", { href: url, target: "_blank", rel: "noopener noreferrer" }, label);
    }
    return el("span", null, label);
  }

  // ---------- Boot ----------
  function boot() {
    var s = readSaved();
    if (s && s.data) {
      state.lang = s.lang || state.lang;
      state.preset = s.preset || null;
      view = { data: s.data, saved: true, error: false, loading: false };
      window.lastCard = s.data;
    }
    renderIntake();
    renderCard();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
