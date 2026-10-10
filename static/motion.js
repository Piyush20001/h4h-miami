/* StormCard motion: fast, calm, one vocabulary. window.SC.motion = { enter(el), stagger(nodes) }.
   Built on gsap.matchMedia(); no-op without gsap; instant (no transforms) under prefers-reduced-motion. */
(function () {
  "use strict";
  var SC = window.SC = window.SC || {};
  var ok = false; // true only when gsap exists and motion is allowed
  var mm = null;
  if (window.gsap && gsap.matchMedia) {
    try {
      mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", function () {
        ok = true;
        return function () { ok = false; };
      });
    } catch (e) { mm = null; }
  }
  function clear(t) { gsap.set(t, { clearProps: "opacity,transform" }); }

  function enter(el) {
    if (!ok || !el) return;
    gsap.killTweensOf(el);
    gsap.fromTo(el, { opacity: 0, y: 10 }, {
      opacity: 1, y: 0, duration: 0.24, ease: "power2.out",
      onComplete: function () { clear(el); }
    });
  }

  function stagger(nodes) {
    if (!ok || !nodes) return;
    var list = Array.prototype.slice.call(nodes).filter(function (n) { return n && !n.hidden; });
    if (!list.length) return;
    gsap.killTweensOf(list);
    gsap.fromTo(list, { opacity: 0, y: 10 }, {
      opacity: 1, y: 0, duration: 0.22, ease: "power2.out", stagger: 0.05,
      onComplete: function () { clear(list); }
    });
  }

  SC.motion = { enter: enter, stagger: stagger };
})();
