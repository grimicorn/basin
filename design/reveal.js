/* ============================================================
   Scroll reveal — shared by Home.html & Pricing.html
   Marks section blocks as reveal targets and fades/rises them in
   as they enter the viewport. Staggers items within grids.
   Bails out (leaving content fully visible) when there is no
   IntersectionObserver support or the user prefers reduced motion.
   ============================================================ */
(function () {
  if (!("IntersectionObserver" in window)) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  document.documentElement.classList.add("has-reveal");

  var targets = [];

  function add(el, delay) {
    el.setAttribute("data-reveal", "");
    if (delay) el.style.setProperty("--reveal-delay", delay + "ms");
    targets.push(el);
  }

  // Standalone blocks — each reveals on its own.
  var soloSel = ".logos, .section .sec-head, .quote-wrap, .cta-band, .cmp, .price-sub, .bill";
  [].forEach.call(document.querySelectorAll(soloSel), function (el) {
    add(el, 0);
  });

  // Staggered groups: [container selector, child selector].
  var groups = [
    [".feat-grid", ".feature"],
    [".steps", ".step"],
    [".plans", ".plan"],
    [".faq", ".faq-item"],
  ];
  groups.forEach(function (g) {
    [].forEach.call(document.querySelectorAll(g[0]), function (container) {
      var kids = [].filter.call(container.children, function (c) {
        return c.matches && c.matches(g[1]);
      });
      kids.forEach(function (kid, i) {
        add(kid, Math.min(i, 6) * 75);
      });
    });
  });

  var io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add("is-in");
          io.unobserve(e.target);
        }
      });
    },
    { rootMargin: "0px 0px -12% 0px", threshold: 0.08 }
  );

  targets.forEach(function (t) {
    io.observe(t);
  });

  // Safety net: if anything is still hidden after a few seconds
  // (e.g. layout edge cases), force it visible.
  setTimeout(function () {
    targets.forEach(function (t) {
      t.classList.add("is-in");
    });
  }, 4000);
})();
