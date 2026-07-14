/* ============================================================
   CS.SIGN — FANCY EFFECTS LAYER (behavior)
   Headings power on like an LED/neon sign switching on —
   animates the whole heading as one block (never splits text
   into characters), so nested tags and Thai text shaping are
   never at risk. Native cursor is left untouched.
   ============================================================ */
(function(){
  "use strict";

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------- Heading flicker-on ---------------- */
  function initFlicker(){
    var targets = document.querySelectorAll("h1, .hero-title, h2.section-head, [data-fx-flicker]");
    if (!targets.length) return;

    if (reduceMotion) return; // leave headings exactly as authored

    targets.forEach(function(el){
      el.classList.add("fx-flicker");
    });

    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if (entry.isIntersecting){
          entry.target.classList.add("fx-flicker--active");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.35 });

    targets.forEach(function(el){ io.observe(el); });
  }

  function initMagnetic(){
    document.querySelectorAll(".btn-primary, .btn-secondary, .btn-white").forEach(function(el){
      el.classList.add("fx-magnetic");
    });
  }

  /* ---------------- Hazard-stripe scroll progress ---------------- */
  function initProgress(){
    var bar = document.createElement("div");
    bar.id = "fx-progress";
    document.body.appendChild(bar);

    var ticking = false;
    function update(){
      var doc = document.documentElement;
      var scrollable = doc.scrollHeight - doc.clientHeight;
      var pct = scrollable > 0 ? (doc.scrollTop / scrollable) * 100 : 0;
      bar.style.width = pct + "%";
      ticking = false;
    }
    function onScroll(){
      if (!ticking){
        requestAnimationFrame(update);
        ticking = true;
      }
    }
    document.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    update();
  }

  /* ---------------- Card corner rivets (bolted sign plate) ----------------
     Also applied to every customer-facing popup panel (quote modal, order
     tracker, portfolio lightbox, site search, chat popup, cookie banner)
     so the same "bolted sign plate" detail shows once the user's mouse
     settles over the open panel — dashboard/admin popups are excluded. */
  function initRivets(){
    var selector = [
      ".cert-card", ".benefit-card", ".trust-feature-card", ".qp-doc-card",
      ".qp-policy-card", ".ab-value-card", ".pdp-related-card", ".nf-link-card",
      ".product-card", ".port-card", ".blog-card",
      ".qmodal", ".tm-modal", ".pf-detail-box", ".ss-panel", ".chat-popup", ".cookie-banner"
    ].join(", ");

    document.querySelectorAll(selector).forEach(function(card){
      if (card.dataset.fxCard) return; // already set up
      var computedPos = window.getComputedStyle(card).position;
      if (computedPos === "static"){
        card.style.position = "relative";
      }
      card.dataset.fxCard = "1";

      var tl = document.createElement("span");
      tl.className = "fx-rivet fx-rivet--tl";
      tl.setAttribute("aria-hidden", "true");
      var tr = document.createElement("span");
      tr.className = "fx-rivet fx-rivet--tr";
      tr.setAttribute("aria-hidden", "true");

      card.appendChild(tl);
      card.appendChild(tr);
    });
  }

  /* ---------------- Numbered step badges (CNC-readout tick-in) ---------------- */
  function initTick(){
    var targets = document.querySelectorAll(".qp-pillar-num, .ab-consult-num");
    if (!targets.length || reduceMotion) return;

    targets.forEach(function(el){ el.classList.add("fx-tick"); });

    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if (entry.isIntersecting){
          entry.target.classList.add("fx-tick--active");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });

    targets.forEach(function(el){ io.observe(el); });
  }

  /* ---------------- Road-lane section dividers ----------------
     Inserts a thin "lane marking" divider (see .fx-lane in
     fancy-effects.css) before every top-level <section>, skipping
     only the very first one on the page (almost always the hero —
     nothing needs separating from above it). Purely structural, so
     it's safe to re-run: each section is checked for an existing
     divider immediately before it before inserting a new one. */
  function initLaneDividers(){
    var sections = document.querySelectorAll("main > section, body > section");
    if (sections.length < 2) return;

    sections.forEach(function(sec, i){
      if (i === 0) return; // nothing above the hero to separate
      var prev = sec.previousElementSibling;
      if (prev && prev.classList && prev.classList.contains("fx-lane")) return;

      var div = document.createElement("div");
      div.className = "fx-lane";
      div.setAttribute("aria-hidden", "true");

      var trackL = document.createElement("span");
      trackL.className = "fx-lane-track";
      var stud = document.createElement("span");
      stud.className = "fx-lane-stud";
      var trackR = document.createElement("span");
      trackR.className = "fx-lane-track";

      div.appendChild(trackL);
      div.appendChild(stud);
      div.appendChild(trackR);

      sec.parentNode.insertBefore(div, sec);
    });
  }

  /* ---------------- Breadcrumb "/" → route-chevron ----------------
     Breadcrumb trails are built as plain text ("...</a> / ...") both
     in static markup and in JS-rendered ones (blog-post.html, product-
     detail.html). Walks only direct child text nodes whose *trimmed*
     content is exactly "/" — never a substring match — so a product
     or article title that happens to contain a slash is left alone.
     Naturally idempotent: once a "/" text node is replaced with a
     span, there's nothing left for a re-run to match, so calling this
     again after later DOM mutations (or after a page's own script
     overwrites the breadcrumb's innerHTML) is always safe. */
  function initBreadcrumbChevrons(){
    var crumbs = document.querySelectorAll(".article-breadcrumb, .pdp-breadcrumb");
    crumbs.forEach(function(el){
      Array.prototype.slice.call(el.childNodes).forEach(function(node){
        if (node.nodeType === 3 && node.textContent.trim() === "/"){
          var span = document.createElement("span");
          span.className = "fx-crumb-sep";
          span.setAttribute("aria-hidden", "true");
          span.textContent = "\u203A"; // ›
          node.replaceWith(span);
        }
      });
    });
  }

  function start(){
    initFlicker();
    initMagnetic();
    initProgress();
    initRivets();
    initTick();
    initLaneDividers();
    initBreadcrumbChevrons();

    // Product/portfolio/blog cards render asynchronously from Firestore
    // after initial page load — keep watching so they get rivets too.
    // Also re-applies breadcrumb chevrons once async page scripts
    // (blog-post.html, product-detail.html) fill in the real trail.
    var mo = new MutationObserver(function(){
      initRivets();
      initBreadcrumbChevrons();
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
