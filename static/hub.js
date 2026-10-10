/* Connectivity: the server knows whether the internet is up; phones on its Wi-Fi cannot. */
(function () {
  var SC = window.SC = window.SC || {};
  SC.hub = { internet: true };
  function check() {
    fetch("/api/status", { cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (j) { set(!!j.internet); })
      .catch(function () { set(false); });  /* server unreachable: treat as offline */
  }
  function set(up) {
    if (SC.hub.internet === up) return;
    SC.hub.internet = up;
    window.dispatchEvent(new CustomEvent("hubchange", { detail: { internet: up } }));
  }
  check();
  setInterval(check, 5000);
  window.addEventListener("online", check);
  /* this device lost its network: go red at once (a phone may still reach the laptop, so re-ask right after) */
  window.addEventListener("offline", function () { set(false); setTimeout(check, 1500); });
})();
