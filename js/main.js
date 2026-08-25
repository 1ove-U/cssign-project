/* ===========================================================
   CS.SIGN — Enterprise Redesign — main.js (ส่วนที่ 1/2)
   Pure vanilla JS. No dependencies.

   2026 refactor: ไฟล์นี้เดิมรวมทุกลูกเล่นหน้าเว็บไว้ในไฟล์เดียว (862 บรรทัด)
   ถูกแยกเป็น 2 ไฟล์ตามความรับผิดชอบ:
     - main.js (ไฟล์นี้): พฤติกรรมหลักของหน้า/นำทาง — page transition, sticky
       nav, mobile menu, reveal-on-scroll (เปิดเป็น window.CSSIGN_observeReveal
       ให้ products.js/portfolio-render.js/blog-render.js/home-dynamic*.js เรียกใช้
       ซ้ำได้), stat counters, FAQ accordion, product tab filter, back-to-top
     - main-effects.js (ไฟล์ใหม่): ลูกเล่นตกแต่งที่ไม่กระทบการใช้งานหลัก — footer
       extras, cursor-spotlight/3D tilt, ripple/magnetic CTA/tab-title reaction
   ทั้งสองไฟล์เป็น classic script (ไม่ใช่ ES module) เหมือนเดิม จึงสื่อสารกันผ่าน
   window.CSSIGN_* เท่านั้น (ไม่มี import/export) — main-effects.js ต้องโหลดต่อจาก
   ไฟล์นี้เสมอ (ดู <script> tag ในทุกหน้า HTML) เพราะใช้ window.CSSIGN_observeReveal
   ที่ไฟล์นี้ตั้งไว้ ไม่มีการเปลี่ยน logic ใดๆ จากของเดิม เป็นแค่ย้ายโค้ดเชิงโครงสร้าง

   2026 refactor รอบที่ 34: ลบส่วน "7. TESTIMONIAL CAROUSEL" (เดิม 135 บรรทัด,
   window.CSSIGN_initTestiCarousel) ออกทั้งชุด เพราะเป็นโค้ดตายแล้ว — ดูเหตุผลเต็ม
   ที่คอมเมนต์ตรงตำแหน่งเดิมของโค้ดด้านล่าง (หัวข้อ "7. TESTIMONIAL CAROUSEL")
   =========================================================== */
(function(){
  "use strict";

  /* -----------------------------------------------------------
     -1. FIX: clear body's pageFadeIn animation once it finishes.
     CSS keeps `transform: translateY(0)` on <body> forever (fill-mode
     "both"), and even a 0px transform makes <body> a new containing
     block for any position:fixed descendant. That breaks every
     fixed-position overlay/modal on the page (they end up sized to
     the whole document instead of the viewport), which can silently
     block every click on the page. Clearing the animation once it
     ends removes the transform entirely so fixed overlays behave
     correctly again.
     ----------------------------------------------------------- */
  document.body.addEventListener('animationend', function(e){
    if(e.target === document.body && e.animationName === 'pageFadeIn'){
      document.body.style.animation = 'none';
    }
  });

  /* -----------------------------------------------------------
     0. PAGE TRANSITION — soft fade between pages
     Fade-in on load is handled purely in CSS (see .page-fade-in
     keyframe in style.css) so there's zero risk of a stuck blank
     page if JS is slow/blocked. Here we only handle the fade-OUT
     when the visitor clicks to another page on the same site, so
     navigation feels like one continuous transition instead of a
     hard cut. Respects reduced-motion, modifier-clicks, new tabs,
     downloads, mailto/tel, and same-page anchors.
     ----------------------------------------------------------- */
  (function pageTransitions(){
    var prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    document.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      var link = e.target.closest('a[href]');
      if (!link) return;
      if (link.target && link.target !== '_self') return;
      if (link.hasAttribute('download')) return;

      var href = link.getAttribute('href') || '';
      if (!href || href.charAt(0) === '#') return;
      if (/^(mailto:|tel:|javascript:)/i.test(href)) return;

      var url;
      try { url = new URL(href, window.location.href); }
      catch { return; }
      if (url.origin !== window.location.origin) return;
      /* same page, different hash only — let the browser handle it */
      if (url.pathname === window.location.pathname && url.hash) return;

      e.preventDefault();
      document.body.classList.add('page-fade-out');
      window.setTimeout(function () { window.location.href = href; }, 180);
    });

    /* if the page is restored from bfcache (back/forward), make sure
       it isn't left mid-fade from a previous navigation */
    window.addEventListener('pageshow', function () {
      document.body.classList.remove('page-fade-out');
    });
  })();

  /* -----------------------------------------------------------
     1. STICKY NAV — shrink + blur on scroll, and stay fully
        transparent while it's still sitting over the hero banner
        (only pages with a .hero section have this; other pages
        just get the normal white sticky bar right away)
     ----------------------------------------------------------- */
  var header = document.getElementById('site-header');
  var topbar = document.getElementById('topbar');
  var lastScrollY = window.scrollY || 0;

  /* ---- scroll-progress bar — a thin gradient strip injected once,
     pinned under the header, whose width is the live scroll position
     as a percentage of the page. Continuous and instantly reversible:
     scroll down and it fills, scroll back up and it un-fills right
     along with you, no easing lag to fight the user's own scrolling. ---- */
  var progressBar = document.createElement('div');
  progressBar.className = 'scroll-progress-bar';
  progressBar.setAttribute('aria-hidden', 'true');
  document.body.appendChild(progressBar);
  function updateProgressBar(){
    var doc = document.documentElement;
    var max = (doc.scrollHeight - doc.clientHeight) || 1;
    var pct = Math.min(1, Math.max(0, (window.scrollY || doc.scrollTop || 0) / max));
    progressBar.style.transform = 'scaleX(' + pct + ')';
  }

  function onScroll(){
    if(!header) return;
    updateProgressBar();
    /* navbar stays solid/opaque at all times now — no more transparent
       "on-hero" state while sitting over the hero banner */
    header.classList.remove('on-hero');
    header.classList.toggle('scrolled', window.scrollY > 24);
    if(window.scrollY > 24){
      if(topbar) topbar.classList.add('tb-hidden');
    } else {
      if(topbar) topbar.classList.remove('tb-hidden');
    }

    /* ---- direction-aware header: slide out of view while scrolling
       down (past the point the header itself would cover), slide back
       in the moment the user reverses and scrolls up — so the header
       reacts to "scrolling back and forth" instead of just sitting
       there or only reacting to absolute position. Ignored while a
       mobile menu is open so the trigger never disappears mid-use. */
    var curY = window.scrollY || 0;
    var delta = curY - lastScrollY;
    var menuOpen = document.getElementById('mobile-menu') &&
      document.getElementById('mobile-menu').classList.contains('open');
    if(!menuOpen && Math.abs(delta) > 4){
      if(delta > 0 && curY > 160){
        header.classList.add('nav-hidden');
      } else {
        header.classList.remove('nav-hidden');
      }
    }
    if(curY <= 24){ header.classList.remove('nav-hidden'); }
    lastScrollY = curY;
  }
  document.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  window.addEventListener('resize', onScroll);

  /* -----------------------------------------------------------
     2. MOBILE MENU
     ----------------------------------------------------------- */
  var burger = document.getElementById('burger-btn');
  var mobileMenu = document.getElementById('mobile-menu');
  var mobileClose = document.getElementById('mobile-close-btn');

  function openMenu(){
    if(!mobileMenu) return;
    mobileMenu.classList.add('open');
    document.body.style.overflow = 'hidden';
    if(burger) burger.setAttribute('aria-expanded', 'true');
    // ย้าย focus เข้าไปในเมนูที่เปิด เพื่อ keyboard/screen-reader user
    var firstLink = mobileMenu.querySelector('a, button');
    if(firstLink) firstLink.focus();
  }
  function closeMenu(){
    if(!mobileMenu) return;
    mobileMenu.classList.remove('open');
    document.body.style.overflow = '';
    if(burger) burger.setAttribute('aria-expanded', 'false');
  }

  if(burger){ burger.addEventListener('click', openMenu); }
  if(mobileClose){ mobileClose.addEventListener('click', closeMenu); }
  if(mobileMenu){
    mobileMenu.querySelectorAll('a').forEach(function(a){
      a.addEventListener('click', closeMenu);
    });
    // ปิดเมนูด้วยปุ่ม Esc แล้วคืน focus กลับไปที่ปุ่ม burger
    document.addEventListener('keydown', function(e){
      if(e.key === 'Escape' && mobileMenu.classList.contains('open')){
        closeMenu();
        if(burger) burger.focus();
      }
    });
  }

  /* -----------------------------------------------------------
     2b. MOBILE NAV — หมวดหมู่ collapsible panel
     ----------------------------------------------------------- */
  var mobileDdTrigger = document.getElementById('mobile-dd-trigger');
  var mobileDdPanel = document.getElementById('mobile-dd-panel');
  if (mobileDdTrigger && mobileDdPanel) {
    mobileDdTrigger.addEventListener('click', function () {
      var isOpen = mobileDdTrigger.classList.contains('open');
      if (isOpen) {
        mobileDdTrigger.classList.remove('open');
        mobileDdPanel.style.maxHeight = null;
      } else {
        mobileDdTrigger.classList.add('open');
        mobileDdPanel.style.maxHeight = mobileDdPanel.scrollHeight + 'px';
      }
    });
  }

  /* observeReveal() is written so it can run twice: once here for
     everything present at initial page load, and again later — as
     window.CSSIGN_observeReveal(container) — for cards/sections that
     get injected after Firestore responds (products.js, portfolio-
     render.js, blog-render.js, home-dynamic.js). Both call sites share
     the same hide/show logic, the same IntersectionObserver instance,
     and the same "never permanently hidden" safety nets. */
  var revealIO = null;
  var revealPrefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function hideForReveal(el){
    el.style.opacity = '0';
    el.style.transform = (el.getAttribute('data-reveal') === 'scale')
      ? 'scale(0.95) translateY(20px)'
      /* default reveal now carries a light scale too (not just fade+translateY) */
      : 'scale(0.98) translateY(28px)';
  }
  function showReveal(el){
    el.style.opacity = '';
    el.style.transform = '';
  }
  function getRevealIO(){
    if(revealIO || !('IntersectionObserver' in window)) return revealIO;
    revealIO = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        var el = entry.target;
        if(entry.isIntersecting){
          showReveal(el);
          /* once motion is reduced, treat this exactly like the old
             one-shot reveal — show it once and leave it alone */
          if(revealPrefersReduced) revealIO.unobserve(el);
        } else if(!revealPrefersReduced){
          /* re-arm so the fade-in plays again the next time this
             section scrolls into view — either direction, since
             IntersectionObserver fires the same way whether the
             element entered from the top or the bottom edge. This
             is what makes scrolling back up (as well as back down)
             replay the effect instead of leaving everything already
             revealed and static. */
          hideForReveal(el);
        }
      });
    }, { threshold: 0.01, rootMargin: '0px 0px 80px 0px' });
    return revealIO;
  }

  function observeReveal(container){
    var scope = container || document;
    if(!scope.querySelectorAll) return;
    var els = Array.prototype.slice.call(scope.querySelectorAll('[data-reveal]'));
    /* the container passed in might itself be the reveal target
       (e.g. a grid with data-reveal on it), not just an ancestor */
    if(scope.nodeType === 1 && scope.hasAttribute && scope.hasAttribute('data-reveal')){
      els.unshift(scope);
    }
    if(!els.length) return;

    var io = getRevealIO();
    if(!io){
      /* no IntersectionObserver support: leave elements at their
         default visible styles — no animation, but never hidden */
      return;
    }

    /* only hide elements once we know JS + IO both work, so a slow/failed
       script load never leaves content permanently invisible */
    els.forEach(function(el){
      hideForReveal(el);
      io.observe(el);
    });

    function revealIfInViewport(){
      els.forEach(function(el){
        var r = el.getBoundingClientRect();
        if(r.top < window.innerHeight && r.bottom > 0){ showReveal(el); io.unobserve(el); }
      });
    }
    /* safety net: anything already in (or near) the viewport right now
       should show immediately rather than waiting on a callback. On the
       very first call the page may still be loading (images/fonts can
       shift layout), so wait for `load`; on later calls (cards injected
       after Firestore responds, well after `load` already fired) the
       page is already settled, so check right away. */
    if(document.readyState === 'complete'){
      revealIfInViewport();
    } else {
      window.addEventListener('load', revealIfInViewport, { once: true });
    }

    /* absolute safety net: if anything is still hidden after 4s
       (e.g. unusual layout/timing), reveal everything so content
       is never permanently lost */
    setTimeout(function(){ els.forEach(showReveal); }, 4000);
  }

  observeReveal(document);
  window.CSSIGN_observeReveal = observeReveal;

  /* -----------------------------------------------------------
     4. STAT COUNTERS — animate numbers on scroll into view
     ----------------------------------------------------------- */
  var statEls = document.querySelectorAll('.stat-num[data-count]');
  function animateCount(el){
    var target = parseInt(el.getAttribute('data-count'), 10) || 0;
    var duration = 1600;
    var start = null;

    function step(ts){
      if(!start) start = ts;
      var progress = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3); /* ease-out cubic */
      var current = Math.floor(eased * target);
      el.childNodes[0].nodeValue = current.toLocaleString('en-US');
      if(progress < 1){ requestAnimationFrame(step); }
      else{ el.childNodes[0].nodeValue = target.toLocaleString('en-US'); }
    }
    /* preserve the suffix span by writing only to the leading text node */
    if(!el.childNodes[0] || el.childNodes[0].nodeType !== 3){
      el.insertBefore(document.createTextNode('0'), el.firstChild);
    }
    requestAnimationFrame(step);
  }

  if('IntersectionObserver' in window && statEls.length){
    var statIO = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting){
          animateCount(entry.target);
          statIO.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });
    statEls.forEach(function(el){ statIO.observe(el); });
  }

  /* -----------------------------------------------------------
     5. FAQ ACCORDION
     ----------------------------------------------------------- */
  var faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(function(item){
    var q = item.querySelector('.faq-q');
    var a = item.querySelector('.faq-a');
    q.addEventListener('click', function(){
      var isOpen = item.classList.contains('open');
      /* close all others */
      faqItems.forEach(function(other){
        if(other !== item){
          other.classList.remove('open');
          other.querySelector('.faq-a').style.maxHeight = null;
        }
      });
      if(isOpen){
        item.classList.remove('open');
        a.style.maxHeight = null;
      } else {
        item.classList.add('open');
        a.style.maxHeight = a.scrollHeight + 'px';
      }
    });
  });

  /* -----------------------------------------------------------
     6. PRODUCT TAB FILTER
     ----------------------------------------------------------- */
  var tabs = document.querySelectorAll('.product-tab');
  var productCards = document.querySelectorAll('.product-card');
  tabs.forEach(function(tab){
    tab.addEventListener('click', function(){
      tabs.forEach(function(t){ t.classList.remove('active'); });
      tab.classList.add('active');
      var filter = tab.getAttribute('data-filter');
      productCards.forEach(function(card){
        var match = (filter === 'all') || (card.getAttribute('data-cat') === filter);
        card.style.display = match ? '' : 'none';
      });
    });
  });

  /* -----------------------------------------------------------
     7. TESTIMONIAL CAROUSEL — ลบออกแล้ว (รอบที่ 34, เดิม 135 บรรทัดตรงนี้)
     ตรวจสอบแล้วว่าเป็นโค้ดตายทั้งชุด: window.CSSIGN_initTestiCarousel ทำงานกับ
     #testi-track/#testi-dots/#testi-prev/#testi-next/.testi-card/.testi-wrap
     ซึ่งไม่มีที่ไหนในโปรเจกต์สร้าง element เหล่านี้ขึ้นมาอีกต่อไปแล้ว — เดิมเป็น
     js/home-dynamic-social.js ที่ inject ผ่าน renderTestimonials() แต่ฟังก์ชัน
     นั้นถูกลบไปแล้วตั้งแต่ "2026 refactor phase 25" (เหตุผลเต็ม: ดูคอมเมนต์หัวไฟล์
     js/home-dynamic.js) เพราะ .testi-wrap ทั้งชุดเป็นดีไซน์รุ่นก่อนที่ถูกแทนที่
     ด้วย .trust-stats-grid/.trust-feature-card ไปแล้ว — phase 25 ตอนนั้นจำกัด
     ขอบเขตแค่ home-dynamic*.js เท่านั้น ไม่ได้ไล่มาที่ js/main.js (คนละไฟล์
     คนละรอบ) จึงเหลือฟังก์ชันที่ไม่มีจุดเรียกใช้จริงติดค้างอยู่ที่นี่มาตลอด —
     ยืนยันแล้วรอบนี้ว่า window.CSSIGN_initTestiCarousel ไม่มีไฟล์ไหนเรียกเลย
     (เดิมควรจะเป็น home-dynamic.js ที่เรียกหลัง render แต่ถูกลบไปพร้อม
     renderTestimonials() แล้ว) — grep ทั่วโปรเจกต์ทั้งหมด (js/*.js 98 ไฟล์เดิม,
     HTML ทุกหน้า TH/EN, css/*.css) หา "testi-"/"initTestiCarousel"/
     "CSSIGN_initTesti" เจอแค่คอมเมนต์อธิบายเหตุผลใน home-dynamic.js/
     home-dynamic-social.js เท่านั้น ไม่มีจุดเรียกใช้งานจริงเหลือเลยสักจุด
     (css/style.css ก็ไม่มี .testi-* หลงเหลือแล้ว — ถูกลบไปก่อนหน้านี้แล้วในรอบอื่น)
     จึงลบทิ้งทั้งชุดแทนการย้ายไปไฟล์ใหม่เฉยๆ (ย้ายซากไปไฟล์ใหม่ไม่มีประโยชน์เพิ่ม)
     — ถ้าต้องการรีวิวลูกค้าแบบ carousel กลับมาบนหน้าแรกอีกครั้งในอนาคต แนะนำ
     ออกแบบ section ใหม่ให้เข้ากับดีไซน์ปัจจุบัน (.trust-stats-grid/
     .trust-feature-card) แทนการกู้โค้ดชุดนี้กลับมาใช้ (อ้างอิง #testi-track ที่
     ไม่มีอยู่แล้ว)
     ----------------------------------------------------------- */

  /* -----------------------------------------------------------
     BACK TO TOP
     Floating button injected once, on every page (no HTML edits
     needed per-page). Shows after the visitor scrolls past ~1
     viewport, and the ring around it fills to show how far down
     the page they are — small "ล้ำ" touch that also matches the
     footer redesign it sits next to.
     ----------------------------------------------------------- */
  (function initBackToTop(){
    if(document.querySelector('.back-to-top')) return; // safety: never double-inject

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'back-to-top';
    btn.setAttribute('aria-label', 'เลื่อนกลับขึ้นด้านบน');

    var R = 21; // ring radius, matches the 46px button minus stroke
    var C = 2 * Math.PI * R;
    btn.innerHTML =
      '<svg class="btt-ring" viewBox="0 0 46 46" aria-hidden="true">' +
        '<circle class="btt-track" cx="23" cy="23" r="' + R + '"></circle>' +
        '<circle class="btt-fill" cx="23" cy="23" r="' + R + '" ' +
          'style="stroke-dasharray:' + C + ';stroke-dashoffset:' + C + '"></circle>' +
      '</svg>' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M12 19V5"/><path d="M6 11l6-6 6 6"/>' +
      '</svg>';
    document.body.appendChild(btn);

    var ring = btn.querySelector('.btt-fill');
    var prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var ticking = false;

    function update(){
      ticking = false;
      var doc = document.documentElement;
      var scrollTop = window.scrollY || doc.scrollTop || 0;
      var max = (doc.scrollHeight - doc.clientHeight) || 1;
      var pct = Math.min(1, Math.max(0, scrollTop / max));
      ring.style.strokeDashoffset = String(C * (1 - pct));
      btn.classList.toggle('is-visible', scrollTop > window.innerHeight * 0.9);
    }

    window.addEventListener('scroll', function(){
      if(!ticking){ ticking = true; requestAnimationFrame(update); }
    }, { passive:true });

    btn.addEventListener('click', function(){
      window.scrollTo({ top:0, behavior: prefersReduced ? 'auto' : 'smooth' });
    });

    /* tiny "magnetic" pull toward the cursor while hovering — cheap,
       cancels itself cleanly on mouseleave so it never fights the
       show/hide transform above. Skipped for touch/reduced-motion. */
    if(!prefersReduced && window.matchMedia && window.matchMedia('(hover:hover)').matches){
      btn.addEventListener('mousemove', function(e){
        var r = btn.getBoundingClientRect();
        var mx = e.clientX - (r.left + r.width / 2);
        var my = e.clientY - (r.top + r.height / 2);
        btn.style.transform = 'translate(' + (mx * 0.18) + 'px,' + (my * 0.18) + 'px)';
      });
      btn.addEventListener('mouseleave', function(){ btn.style.transform = ''; });
    }

    update();
  })();

  /* -----------------------------------------------------------
     X. "ออเดอร์ของฉัน" NAV LINK (P2.8c-H)
     ลิงก์ไปหน้า my-orders.html (เข้าดูออเดอร์ทั้งหมดที่เชื่อมบัญชี LINE ไว้ — P2.8c-E)
     ฉีดเข้า DOM แบบไดนามิกจากไฟล์นี้ที่โหลดอยู่แล้วทุกหน้า แทนที่จะไปแก้ nav/mobile-menu
     ในไฟล์ HTML 26 ไฟล์ตรงๆ — เหตุผลเดียวกับปุ่ม LIFF auto-link ใน js/track-modal.js
     (P1.5): single source of truth จุดเดียว ไม่มีความเสี่ยงที่บางหน้าจะลืมใส่/ใส่ไม่ตรงกัน
     รอบ P2.8c-I เพิ่ม en/my-orders.html แล้ว — ฉีดลิงก์ทั้ง /en/ (label ภาษาอังกฤษ) และหน้าไทย
     เดิมเหมือนกัน ยังคงข้ามเฉพาะหน้า my-orders.html/en/my-orders.html เอง (ไม่มีประโยชน์ลิงก์ไป
     หาตัวเอง) — ไม่เพิ่ม CSS ใหม่เลย ใช้ class `.nav-icon-btn` (desktop) เดิมจาก css/style.css
     และสไตล์ `.mobile-links a` เดิม (mobile)
     ----------------------------------------------------------- */
  (function myOrdersNavLink(){
    // P2.9-C: เปลี่ยนจากลิงก์ "ออเดอร์ของฉัน" ตรงไป my-orders.html เป็นลิงก์ "บัญชีของฉัน" ไป
    // my-account.html (hub กลาง) แทน — my-account.html มีเมนูลิงก์ไป my-orders.html ต่ออีกที
    // (ดู p2.9-account-hub-plan.md) ชื่อฟังก์ชัน/ตัวแปรคงชื่อเดิมไว้ ไม่เปลี่ยนเพื่อลด diff
    var path = window.location.pathname;
    var isEn = /\/en\//.test(path);
    var onAccountPage = /\/my-account\.html$/.test(path);

    var href = 'my-account.html'; // relative ใช้ได้ทั้งสองภาษาเพราะ en/*.html ลิงก์กันเองแบบ relative อยู่แล้ว (เช่น index.html, products.html)
    var label = isEn ? 'My Account' : 'บัญชีของฉัน';
    var loggedInSuffix = isEn ? ' (Signed in with LINE)' : ' (เข้าสู่ระบบด้วย LINE อยู่)';

    // ── ตัวบ่งชี้ "เข้าสู่ระบบด้วย LINE อยู่" ข้ามหน้า (2026-08 follow-up) — my-account.html/
    // my-orders.html เป็นสองหน้าเดียวที่เช็ค Firebase/LIFF session จริงๆ (เรียก liff.init()/
    // onAuthChange()) หน้าอื่นๆ ทั้งหมด (รวมทั้งไฟล์นี้) ไม่โหลด Firebase SDK เลยเพื่อไม่ให้เสีย
    // performance ทุกหน้าเปล่าๆ แค่เพื่อโชว์จุดเขียวเล็กๆ อันนี้ — จึงใช้ localStorage cache
    // แบบเดียวกับ 'cssignCurrency' (js/currency-global.js) แทน: js/my-account-page.js/
    // js/my-orders-page.js เขียน flag นี้ทุกครั้งที่ login/logout สำเร็จจริง (ไม่ใช่ optimistic)
    // แล้วไฟล์นี้แค่อ่านมาโชว์จุดเขียวตอนโหลดหน้า — ไม่ใช่ authoritative 100% (session อาจหมดอายุ
    // ระหว่างที่ไม่ได้เข้า my-account/my-orders ไปสักพัก) แต่ตรงพอสำหรับ "เดาว่าน่าจะยัง login
    // อยู่ไหม" ระดับ UI hint ซึ่งเป็นโจทย์ที่ขอมา (ไม่ใช่ access control ที่ต้อง 100% แม่นยำ) —
    // ฟังก์ชัน exposed เป็น window.CSSignSetAccountLoggedIn() ให้ my-account-page.js/
    // my-orders-page.js เรียกอัปเดตจุดเขียวได้ทันทีตอน login/logout สำเร็จในหน้าเดียวกันด้วย
    // (ไม่ต้องรอ reload หน้าถึงจะเห็น)
    var LINE_SESSION_STORAGE_KEY = 'cssignLineSessionActive';
    function readLineSessionActive() {
      try { return window.localStorage && window.localStorage.getItem(LINE_SESSION_STORAGE_KEY) === '1'; }
      catch (e) { return false; }
    }

    var iconLink = null;
    var mobileTextLink = null;

    function applyIndicator(isActive) {
      if (iconLink) {
        iconLink.classList.toggle('nav-icon-btn--logged-in', !!isActive);
        var iconTitle = isActive ? (label + loggedInSuffix) : label;
        iconLink.setAttribute('aria-label', iconTitle);
        iconLink.setAttribute('title', iconTitle);
      }
      if (mobileTextLink) {
        mobileTextLink.classList.toggle('mobile-my-orders-link--logged-in', !!isActive);
        mobileTextLink.textContent = label + (isActive ? loggedInSuffix : '');
      }
    }

    window.CSSignSetAccountLoggedIn = function (isActive) {
      try {
        if (isActive) window.localStorage && window.localStorage.setItem(LINE_SESSION_STORAGE_KEY, '1');
        else window.localStorage && window.localStorage.removeItem(LINE_SESSION_STORAGE_KEY);
      } catch (e) { /* private mode / localStorage ไม่พร้อมใช้งาน — แค่ข้าม cache ไป ไม่ throw */ }
      applyIndicator(isActive);
    };

    if (!onAccountPage) {
      // เดสก์ท็อป: ปุ่มไอคอนใน .nav-actions ข้างปุ่ม "เช็คสถานะคำสั่งผลิต" เดิม
      var navActions = document.querySelector('.nav-actions');
      var navTrackTrigger = navActions && navActions.querySelector('.nav-track-trigger');
      if (navActions && navTrackTrigger && !navActions.querySelector('.nav-my-orders-trigger')) {
        iconLink = document.createElement('a');
        iconLink.href = href;
        iconLink.className = 'nav-icon-btn nav-my-orders-trigger';
        iconLink.setAttribute('aria-label', label);
        iconLink.setAttribute('title', label);
        iconLink.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg><span class="nav-login-dot" aria-hidden="true"></span>';
        navActions.insertBefore(iconLink, navTrackTrigger);
      } else {
        iconLink = navActions && navActions.querySelector('.nav-my-orders-trigger');
      }

      // มือถือ: ลิงก์ข้อความต่อท้ายลิงก์ "เช็คสถานะคำสั่งผลิต" เดิมใน .mobile-links
      var mobileLinks = document.querySelector('.mobile-links');
      var mobileTrackLink = mobileLinks && mobileLinks.querySelector('[data-track-modal-open]');
      if (mobileLinks && mobileTrackLink && !mobileLinks.querySelector('.mobile-my-orders-link')) {
        mobileTextLink = document.createElement('a');
        mobileTextLink.href = href;
        mobileTextLink.className = 'mobile-my-orders-link';
        mobileTextLink.textContent = label;
        mobileTrackLink.insertAdjacentElement('afterend', mobileTextLink);
      } else {
        mobileTextLink = mobileLinks && mobileLinks.querySelector('.mobile-my-orders-link');
      }

      applyIndicator(readLineSessionActive());
    }
  })();

  /* -----------------------------------------------------------
     Y. ไอคอนตะกร้า + badge จำนวนสินค้า ใน nav (P3.0 Phase 1 รอบย่อย 3)
     ฉีดเข้า DOM แบบเดียวกับ myOrdersNavLink() ด้านบนทุกประการ (single source of truth จุด
     เดียว ไม่ต้องแก้ nav/mobile-menu ในไฟล์ HTML 28 ไฟล์ตรงๆ — มีแค่การเพิ่ม
     <script type="module" src="js/cart-global.js"> เข้าไปในทุกหน้าเท่านั้นที่ต้องแก้ HTML)

     ต่างจาก myOrdersNavLink() ตรงที่ต้องอ่านจำนวนสินค้าจาก js/cart.js ซึ่งเป็น ES module — ไฟล์นี้
     (main.js) เป็น classic script อ่านตรงไม่ได้ ต้องผ่านสะพาน window.CSSignCart.getCartCount()
     จาก js/cart-global.js (module, defer โดยอัตโนมัติ) แทน ซึ่งหมายความว่าตอน IIFE นี้รันครั้งแรก
     (classic script รันทันทีตอน parse เจอ — เร็วกว่า module เสมอ) window.CSSignCart ยังไม่พร้อม
     แน่นอน — ใช้วิธี dispatch custom event 'cssign:cart-updated' จากฝั่ง cart-global.js แทนแนวทาง
     polling: เพราะเราผูก listener ไว้ ณ จุดนี้ (ตอน main.js รัน ซึ่งเกิดก่อน module รันเสมอตาม
     ลำดับการโหลดสคริปต์ของเบราว์เซอร์) module ฝั่ง cart-global.js รันเสร็จทีหลังแน่ๆ แล้วค่อย
     dispatch event มาหา — รับประกันว่าไม่มีจังหวะพลาด ไม่ต้องเดา timing ด้วย setTimeout/setInterval

     ปุ่มยังไม่คลิกได้จริงในรอบนี้ (ตัดสินใจแล้ว — ดู p3.0-quotation-cart-plan.md หัวข้อ "รอบย่อย 3"
     สำหรับเหตุผลเต็ม): ยังไม่มีหน้า/modal ตะกร้าให้ไปจริงจนกว่าจะถึงรอบย่อย 4 จึงใส่แค่
     title/aria-label บอกไว้ก่อน ไม่ผูก action ปลอมๆ ที่ต้องรื้อทิ้งทีหลัง
     ----------------------------------------------------------- */
  (function cartNavIcon(){
    var isEn = /\/en\//.test(window.location.pathname);
    var label = isEn ? 'Cart' : 'ตะกร้าสินค้า';
    var cartIconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="17" height="17" aria-hidden="true"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>';

    // เดสก์ท็อป: วางไอคอนตะกร้าไว้ต่อจากปุ่ม "บัญชีของฉัน" (ถ้ามี — บางหน้าเช่น my-account.html
    // เองไม่มีปุ่มนั้นเพราะ myOrdersNavLink() ข้ามตัวเอง) ไม่งั้น fallback ไปต่อจากปุ่มเช็คสถานะ
    // คำสั่งผลิตเดิมแทน เพื่อให้ไอคอนตะกร้าโชว์ครบทุกหน้าเสมอไม่ขึ้นกับว่าอยู่หน้าไหน
    var navActions = document.querySelector('.nav-actions');
    var navCartAnchor = navActions && (navActions.querySelector('.nav-my-orders-trigger') || navActions.querySelector('.nav-track-trigger'));
    if (navActions && navCartAnchor && !navActions.querySelector('.nav-cart-trigger')) {
      var cartBtn = document.createElement('button');
      cartBtn.type = 'button';
      cartBtn.className = 'nav-icon-btn nav-cart-trigger';
      cartBtn.setAttribute('aria-label', label);
      cartBtn.setAttribute('title', label);
      cartBtn.innerHTML = cartIconSvg + '<span class="nav-cart-badge" aria-hidden="true"></span>';
      // P3.0 Phase 1 รอบย่อย 4 ต่อ: เปิด modal ตะกร้า (js/cart-modal.js) — เช็ค
      // window.openCartModal แบบ lazy ตอน click เท่านั้น (ไม่ใช่ตอน bind ตรงนี้) เพราะ
      // cart-modal.js อาจยังโหลด/รันไม่เสร็จตอน cartNavIcon() ทำงาน (คนละจังหวะกับตอนผู้ใช้
      // กดจริง ซึ่งเกิดหลังหน้าโหลดเสร็จสมบูรณ์แล้วเสมอ) เผื่อบางหน้าลืมใส่
      // <script src="js/cart-modal-template.js">/<script src="js/cart-modal.js"> ก็ไม่ throw
      // แค่กดแล้วไม่มีอะไรเกิดขึ้นเงียบๆ เหมือนแพทเทิร์น updateCartBadge() ด้านล่างที่เช็ค
      // window.CSSignCart ก่อนเรียกอยู่แล้ว
      cartBtn.addEventListener('click', function () {
        if (window.openCartModal) window.openCartModal();
      });
      navCartAnchor.insertAdjacentElement('afterend', cartBtn);
    }

    // มือถือ: ต่อจากลิงก์ "บัญชีของฉัน" เดิมใน .mobile-links เช่นกัน (fallback ไปต่อจากลิงก์
    // เช็คสถานะคำสั่งผลิตถ้าไม่มี) — ใช้ href="#" + preventDefault แทนการไม่ใส่ href เลย เพื่อให้
    // ยังกด/แตะได้เหมือน element อื่นในลิสต์เดียวกัน (คีย์บอร์ด/screen reader โฟกัสได้ปกติ) แค่ยัง
    // ไม่พาไปไหนจนกว่าจะถึงรอบย่อย 4
    var mobileLinks = document.querySelector('.mobile-links');
    var mobileCartAnchor = mobileLinks && (mobileLinks.querySelector('.mobile-my-orders-link') || mobileLinks.querySelector('[data-track-modal-open]'));
    if (mobileLinks && mobileCartAnchor && !mobileLinks.querySelector('.mobile-cart-link')) {
      var mobileCartLink = document.createElement('a');
      mobileCartLink.href = '#';
      mobileCartLink.className = 'mobile-cart-link';
      mobileCartLink.setAttribute('aria-label', label);
      // P3.0 Phase 1 รอบย่อย 4 ต่อ: preventDefault (กัน href="#" เลื่อนหน้าขึ้นบนสุด) + เปิด
      // modal ตะกร้าในฟังก์ชันเดียวกัน (ไม่ใช่เพิ่ม listener ที่สองซ้อนทับของเดิม) — เช็ค
      // window.openCartModal แบบ lazy ตอน click เหมือนฝั่งเดสก์ท็อปด้านบนทุกประการ
      mobileCartLink.addEventListener('click', function(e){
        e.preventDefault();
        if (window.openCartModal) window.openCartModal();
      });
      mobileCartLink.appendChild(document.createTextNode(label));
      var mobileBadge = document.createElement('span');
      mobileBadge.className = 'mobile-cart-badge';
      mobileCartLink.appendChild(mobileBadge);
      mobileCartAnchor.insertAdjacentElement('afterend', mobileCartLink);
    }

    // อัปเดตเลขใน badge ทุกจุดที่โผล่อยู่ในหน้า (เดสก์ท็อป + มือถือ พร้อมกันในฟังก์ชันเดียว) —
    // เผื่อ window.CSSignCart ไม่พร้อมเลย (เช่น หน้าไหนลืมใส่ <script type="module"
    // src="js/cart-global.js"> ในอนาคต) ให้ตกกลับเป็น 0/ซ่อน badge เงียบๆ ไม่ throw
    function updateCartBadge(){
      var count = (window.CSSignCart && typeof window.CSSignCart.getCartCount === 'function')
        ? window.CSSignCart.getCartCount()
        : 0;
      var displayCount = count > 99 ? '99+' : String(count);
      document.querySelectorAll('.nav-cart-badge').forEach(function(el){
        el.textContent = displayCount;
        el.style.display = count > 0 ? 'block' : 'none';
      });
      document.querySelectorAll('.mobile-cart-badge').forEach(function(el){
        el.textContent = count > 0 ? ' (' + displayCount + ')' : '';
      });
    }

    updateCartBadge(); // เผื่อไว้ (ปกติจะยังเป็น 0 ตอนนี้เพราะ cart-global.js ยังไม่รัน ดูคอมเมนต์ด้านบน)
    window.addEventListener('cssign:cart-updated', updateCartBadge);
  })();

})();
