/* Hub mode: the laptop server knows whether the internet is up; phones on the hub's Wi-Fi can't. */
(function () {
  var SC = window.SC = window.SC || {};
  SC.hub = { internet: true };
  function check() {
    fetch("/api/status", { cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (j) { set(!!j.internet); })
      .catch(function () { set(false); });  /* hub unreachable: treat as offline */
  }
  function set(up) {
    if (SC.hub.internet === up) return;
    SC.hub.internet = up;
    window.dispatchEvent(new CustomEvent("hubchange", { detail: { internet: up } }));
  }
  check();
  setInterval(check, 15000);
  window.addEventListener("online", check);
  window.addEventListener("offline", check);
})();
