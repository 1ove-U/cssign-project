/* ===========================================================
   CS.SIGN — Enterprise Redesign — main.js
   Pure vanilla JS. No dependencies.
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
      catch (err) { return; }
      if (url.origin !== window.location.origin) return;
      /* same page, different hash only — let the browser handle it */
      if (url.pathname === window.location.pathname && url.hash) return;

      e.preventDefault();
      document.body.classList.add('page-fade-out');
      window.setTimeout(function () { window.location.href = href; }, 180);
    });

    /* if the page is restored from bfcache (back/forward), make sure
       it isn't left mid-fade from a previous navigation */
    window.addEventListener('pageshow', function (evt) {
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
  var hero = document.querySelector('.hero');
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
    var suffixEl = el.querySelector('span');
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
     7. TESTIMONIAL CAROUSEL
     Exposed as window.CSSIGN_initTestiCarousel so it can be safely
     re-run by js/home-dynamic.js after it swaps in real testimonial
     data from Firestore (the cards on first load are the hardcoded
     placeholders baked into index.html). Re-running is idempotent:
     old listeners/intervals are torn down first so calling it twice
     never double-fires clicks, autoplay, or resize handling.
     ----------------------------------------------------------- */
  var testiResizeHandler = null;
  var testiAutoplay = null;

  function initTestiCarousel(){
    var track = document.getElementById('testi-track');
    var dotsWrap = document.getElementById('testi-dots');
    var prevBtn = document.getElementById('testi-prev');
    var nextBtn = document.getElementById('testi-next');
    if(!track) return;

    // Tear down any previous instance before re-initializing.
    if(testiResizeHandler){ window.removeEventListener('resize', testiResizeHandler); testiResizeHandler = null; }
    if(testiAutoplay){ clearInterval(testiAutoplay); testiAutoplay = null; }
    if(prevBtn){ var freshPrev = prevBtn.cloneNode(true); prevBtn.replaceWith(freshPrev); prevBtn = freshPrev; }
    if(nextBtn){ var freshNext = nextBtn.cloneNode(true); nextBtn.replaceWith(freshNext); nextBtn = freshNext; }

    var cards = track.querySelectorAll('.testi-card');
    if(!cards.length) return;
    // เริ่มต้นที่การ์ดใบที่ 2 (index 1) แทนใบแรก ตามที่ต้องการให้ตอนโหลดหน้า
    // การ์ดกลาง/ที่ active อยู่คือใบที่สองเสมอ (กันกรณีมีการ์ดใบเดียวด้วย Math.min)
    var index = Math.min(1, cards.length - 1);
    // Coverflow mode: one card "active" (centered, full size) at a time, with
    // neighbouring cards peeking at reduced scale/opacity on either side —
    // matches the centred social-post carousel reference rather than the old
    // fixed 1/2/3-per-view grid slider.
    var maxIndex = cards.length - 1;

    function buildDots(){
      dotsWrap.innerHTML = '';
      for(var i = 0; i <= maxIndex; i++){
        var dot = document.createElement('button');
        dot.className = 'testi-dot' + (i === index ? ' active' : '');
        dot.setAttribute('aria-label', 'ไปที่รีวิว ' + (i + 1));
        dot.addEventListener('click', function(idx){
          return function(){ goTo(idx); };
        }(i));
        dotsWrap.appendChild(dot);
      }
    }

    function update(skipTransition){
      var cardWidth = cards[0].getBoundingClientRect().width;
      var gap = 24;
      var outerWidth = track.parentElement.getBoundingClientRect().width;
      var activeCenter = index * (cardWidth + gap) + cardWidth / 2;
      var offset = (outerWidth / 2) - activeCenter;
      if(skipTransition){
        // Jump to the new position with the transform transition switched
        // off, so the fade (handled separately by the .testi-track--jump
        // class) is the only motion the user sees — no whip-pan across
        // the intervening cards.
        var prevTransition = track.style.transition;
        track.style.transition = 'none';
        track.style.transform = 'translateX(' + offset + 'px)';
        void track.offsetWidth; // force reflow so 'none' actually takes effect
        track.style.transition = prevTransition || '';
      } else {
        track.style.transform = 'translateX(' + offset + 'px)';
      }
      cards.forEach(function(c, i){
        c.classList.toggle('is-active', i === index);
      });
      dotsWrap.querySelectorAll('.testi-dot').forEach(function(d, i){
        d.classList.toggle('active', i === index);
      });
    }

    var jumpTimer = null;
    function goTo(i){
      var next = Math.max(0, Math.min(i, maxIndex));
      if(next === index) return;
      // Adjacent moves (the common case: arrows, autoplay) keep the smooth
      // sliding transform — it already reads well over a single card's
      // distance. Distant jumps (a far dot, wrapping last → first) swap
      // the slide for a soft cross-fade instead of a fast whip-pan.
      var isDistantJump = Math.abs(next - index) > 1;
      index = next;
      if(isDistantJump){
        clearTimeout(jumpTimer);
        track.classList.add('testi-track--jump');
        jumpTimer = setTimeout(function(){
          update(true);
          requestAnimationFrame(function(){
            requestAnimationFrame(function(){
              track.classList.remove('testi-track--jump');
            });
          });
        }, 260);
      } else {
        update();
      }
    }

    if(prevBtn){ prevBtn.addEventListener('click', function(){ goTo(index - 1 < 0 ? maxIndex : index - 1); }); }
    if(nextBtn){ nextBtn.addEventListener('click', function(){ goTo(index + 1 > maxIndex ? 0 : index + 1); }); }

    // Tapping a card that isn't the active/centred one brings it to centre —
    // feels natural for a coverflow-style feed carousel.
    cards.forEach(function(c, i){
      c.addEventListener('click', function(e){
        if(i !== index){ goTo(i); }
      });
    });

    testiResizeHandler = function(){
      clearTimeout(testiResizeHandler._t);
      testiResizeHandler._t = setTimeout(update, 150);
    };
    window.addEventListener('resize', testiResizeHandler);

    buildDots();
    update();

    /* autoplay
       บั๊กที่แก้: เดิมมีแค่ mouseenter ที่ clearInterval() แต่ไม่มี mouseleave ที่
       ตั้ง interval ใหม่เลย ผลคือแค่เอาเมาส์ไปแตะ carousel ครั้งเดียว autoplay จะ
       หยุดตลอดไปสำหรับที่เหลือของการเข้าชมหน้านั้น (ต้อง reload หน้าใหม่เท่านั้นถึง
       จะกลับมาเลื่อนอัตโนมัติ) แก้แล้วโดยเก็บ interval ไว้ในตัวแปรเดียว เริ่มใหม่ได้
       ทุกครั้งที่เมาส์ออกจาก carousel */
    function startAutoplay(){
      testiAutoplay = setInterval(function(){
        goTo(index + 1 > maxIndex ? 0 : index + 1);
      }, 5500);
    }
    startAutoplay();
    var testiWrap = track.closest('.testi-wrap');
    testiWrap.addEventListener('mouseenter', function(){ clearInterval(testiAutoplay); });
    testiWrap.addEventListener('mouseleave', function(){ clearInterval(testiAutoplay); startAutoplay(); });
    /* WCAG 2.2.2 (Pause, Stop, Hide): the hover handlers above don't help
       keyboard users tabbing through the cards/arrows — auto-advance would
       yank focus context out from under them mid-read. Pause on focus too. */
    testiWrap.addEventListener('focusin', function(){ clearInterval(testiAutoplay); });
    testiWrap.addEventListener('focusout', function(){ clearInterval(testiAutoplay); startAutoplay(); });
  }

  window.CSSIGN_initTestiCarousel = initTestiCarousel;
  initTestiCarousel();

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

    var NS = 'http://www.w3.org/2000/svg';
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
     FOOTER — extra interactive touches (ลูกเล่น), injected once
     so every page picks these up automatically. Grouped in one
     init so a failure in one part (e.g. clipboard permission)
     can't take the others down with it.
     ----------------------------------------------------------- */
  (function initFooterExtras(){
    var footer = document.querySelector('.site-footer');
    if(!footer) return;

    /* ---- toast host, shared by the copy-to-clipboard buttons ---- */
    var toastHost = null;
    function showFooterToast(msg){
      if(!toastHost){
        toastHost = document.createElement('div');
        toastHost.className = 'footer-toast-host';
        toastHost.setAttribute('aria-live', 'polite');
        document.body.appendChild(toastHost);
      }
      var el = document.createElement('div');
      el.className = 'footer-toast';
      el.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg><span></span>';
      el.querySelector('span').textContent = msg;
      toastHost.appendChild(el);
      requestAnimationFrame(function(){ el.classList.add('is-visible'); });
      setTimeout(function(){
        el.classList.remove('is-visible');
        setTimeout(function(){ el.remove(); }, 250);
      }, 2000);
    }

    /* ---- 1. cursor-follow spotlight on the footer background ---- */
    try{
      if(window.matchMedia && window.matchMedia('(hover:hover)').matches){
        var spot = document.createElement('div');
        spot.className = 'footer-spotlight';
        spot.setAttribute('aria-hidden', 'true');
        footer.insertBefore(spot, footer.firstChild);
        var spotRaf = null;
        footer.addEventListener('mousemove', function(e){
          if(spotRaf) return;
          spotRaf = requestAnimationFrame(function(){
            var r = footer.getBoundingClientRect();
            spot.style.setProperty('--fx', (((e.clientX - r.left) / r.width) * 100) + '%');
            spot.style.setProperty('--fy', (((e.clientY - r.top) / r.height) * 100) + '%');
            spotRaf = null;
          });
        });
      }
    }catch(e){}

    /* ---- 3. stagger the four footer-grid columns in as they reveal ---- */
    try{
      var gridEl = footer.querySelector('.footer-grid');
      if(gridEl){
        Array.prototype.forEach.call(gridEl.children, function(child, i){
          child.setAttribute('data-reveal', '');
          child.style.setProperty('--fd', (i * 90) + 'ms');
        });
        if(window.CSSIGN_observeReveal){ window.CSSIGN_observeReveal(gridEl); }
      }
    }catch(e){}

    /* ---- 4. copy-to-clipboard on phone / fax / email / address ---- */
    try{
      function fallbackCopy(text){
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus(); ta.select();
        var ok = false;
        try{ ok = document.execCommand('copy'); }catch(e){ ok = false; }
        document.body.removeChild(ta);
        return ok;
      }
      var vals = footer.querySelectorAll('.footer-contact-val');
      Array.prototype.forEach.call(vals, function(el){
        var text = el.textContent.trim();
        if(!text || el.closest('.footer-contact-row')) return;

        var row = document.createElement('div');
        row.className = 'footer-contact-row';
        el.parentNode.insertBefore(row, el);
        row.appendChild(el);

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'footer-copy-btn';
        btn.setAttribute('aria-label', 'คัดลอกข้อมูลนี้');
        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>';
        row.appendChild(btn);

        btn.addEventListener('click', function(e){
          e.preventDefault();
          e.stopPropagation();
          var done = function(ok){
            if(!ok) return;
            showFooterToast('คัดลอกแล้ว!');
            btn.classList.add('is-copied');
            setTimeout(function(){ btn.classList.remove('is-copied'); }, 1500);
          };
          if(navigator.clipboard && navigator.clipboard.writeText){
            navigator.clipboard.writeText(text).then(function(){ done(true); }).catch(function(){ done(fallbackCopy(text)); });
          } else {
            done(fallbackCopy(text));
          }
        });
      });
    }catch(e){}

    /* ---- 5. live "เปิด/ปิดทำการ" badge, Mon–Sat 08:00–17:00 (Asia/Bangkok) ---- */
    try{
      var labels = footer.querySelectorAll('.footer-contact-label');
      var hoursTarget = null;
      Array.prototype.forEach.call(labels, function(l){
        if(/โทรศัพท์|hotline|phone/i.test(l.textContent)) hoursTarget = l;
      });
      if(hoursTarget){
        var parts = new Intl.DateTimeFormat('en-US', {
          timeZone: 'Asia/Bangkok', hour: '2-digit', hour12: false, weekday: 'short'
        }).formatToParts(new Date());
        var hour = 0, weekday = '';
        parts.forEach(function(p){
          if(p.type === 'hour') hour = parseInt(p.value, 10);
          if(p.type === 'weekday') weekday = p.value;
        });
        var isOpen = weekday !== 'Sun' && hour >= 8 && hour < 17;
        var badge = document.createElement('span');
        badge.className = 'footer-hours-badge' + (isOpen ? '' : ' is-closed');
        badge.innerHTML = '<span class="fhb-dot"></span>' + (isOpen ? 'เปิดทำการอยู่' : 'ปิดทำการแล้ว');
        hoursTarget.appendChild(badge);
      }
    }catch(e){}

    /* ---- 6. confetti burst when a social icon is clicked ---- */
    try{
      var prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if(!prefersReducedMotion){
        var colors = ['#C6862A', '#2E86D1', '#3DDC7A', '#D3A047'];
        var socialLinks = footer.querySelectorAll('.footer-social a');
        Array.prototype.forEach.call(socialLinks, function(a){
          a.addEventListener('click', function(){
            var rect = a.getBoundingClientRect();
            var cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
            for(var i = 0; i < 8; i++){
              var dot = document.createElement('div');
              dot.className = 'footer-confetti-dot';
              var angle = (Math.PI * 2 / 8) * i + Math.random() * 0.4;
              var dist = 30 + Math.random() * 24;
              dot.style.left = cx + 'px';
              dot.style.top = cy + 'px';
              dot.style.background = colors[i % colors.length];
              dot.style.setProperty('--cx', Math.cos(angle) * dist + 'px');
              dot.style.setProperty('--cy', Math.sin(angle) * dist + 'px');
              document.body.appendChild(dot);
              (function(d){ setTimeout(function(){ d.remove(); }, 750); })(dot);
            }
          });
        });
      }
    }catch(e){}
  })();

})();

/* ===========================================================
   PREMIUM FLOURISHES — cursor-spotlight cards + real 3D tilt
   Separate top-level IIFE (rather than folded into the block
   above) since it applies sitewide, not just inside the footer.
   Skips entirely on touch devices and prefers-reduced-motion —
   both effects are pure ambience, never load-bearing for content.
   =========================================================== */
(function(){
  "use strict";
  try{
    if(!window.matchMedia || !window.matchMedia('(hover:hover) and (pointer:fine)').matches) return;
    var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var SPOTLIGHT_SEL = '.service-item, .port-card, .blog-card, .cert-card, ' +
      '.benefit-card, .trust-feature-card, .qp-doc-card, .ab-value-card, ' +
      '.pdp-related-card, .nf-link-card, .trust-stat-card, .fp-tile, ' +
      '.home-cta-band, .site-cta-card';

    var raf = null, lastEl = null, lastX = 0, lastY = 0;

    function apply(){
      raf = null;
      if(!lastEl) return;
      var r = lastEl.getBoundingClientRect();
      var sx = ((lastX - r.left) / r.width) * 100;
      var sy = ((lastY - r.top) / r.height) * 100;
      lastEl.style.setProperty('--sx', sx + '%');
      lastEl.style.setProperty('--sy', sy + '%');

      /* real 3D tilt, value cards only — small rotation range so it
         reads as "premium hover", not a gimmick */
      if(!prefersReduced && lastEl.classList.contains('ab-value-card')){
        var rx = ((sy / 100) - 0.5) * -10; /* up/down cursor tilts card toward you */
        var ry = ((sx / 100) - 0.5) * 12;
        lastEl.style.setProperty('--rx', rx.toFixed(2) + 'deg');
        lastEl.style.setProperty('--ry', ry.toFixed(2) + 'deg');
      }
    }

    document.addEventListener('pointermove', function(e){
      var el = e.target.closest ? e.target.closest(SPOTLIGHT_SEL) : null;
      if(el !== lastEl && lastEl && lastEl.classList.contains('ab-value-card')){
        lastEl.style.setProperty('--rx', '0deg');
        lastEl.style.setProperty('--ry', '0deg');
      }
      lastEl = el;
      if(!el) return;
      lastX = e.clientX; lastY = e.clientY;
      if(!raf) raf = requestAnimationFrame(apply);
    }, { passive:true });
  }catch(e){}
})();

/* ===========================================================
   GENERAL POLISH — ripple, magnetic CTAs, tab-title reaction
   Small sitewide touches, each independent and each safe to no-op
   silently if its DOM target isn't present on a given page.
   =========================================================== */
(function(){
  "use strict";

  /* ---- 1. Ripple on every .btn — classic material-style click
     feedback, works with mouse, touch and keyboard alike (Enter/Space
     dispatch a click event, so this fires there too). Skipped under
     reduced-motion via the CSS keyframe itself, not here, so keyboard
     focus rings are unaffected either way. ---- */
  document.addEventListener('click', function(e){
    var btn = e.target.closest && e.target.closest('.btn');
    if(!btn) return;
    try{
      var r = btn.getBoundingClientRect();
      var size = Math.max(r.width, r.height) * 1.6;
      var x = (typeof e.clientX === 'number' && e.clientX) ? e.clientX - r.left : r.width / 2;
      var y = (typeof e.clientY === 'number' && e.clientY) ? e.clientY - r.top : r.height / 2;
      var span = document.createElement('span');
      span.className = 'btn-ripple';
      span.style.width = span.style.height = size + 'px';
      span.style.left = (x - size / 2) + 'px';
      span.style.top = (y - size / 2) + 'px';
      btn.appendChild(span);
      span.addEventListener('animationend', function(){ span.remove(); });
      setTimeout(function(){ if(span.parentNode) span.remove(); }, 900); /* safety net */
    }catch(err){}
  });

  /* ---- 2. Magnetic pull for large CTA buttons — same technique
     already used on the back-to-top button, generalized to every
     .btn-lg so the site's primary calls-to-action all get the same
     tiny "pulled toward the cursor" feel. Desktop + fine pointer only. ---- */
  try{
    if(window.matchMedia && window.matchMedia('(hover:hover) and (pointer:fine)').matches &&
       !(window.matchMedia('(prefers-reduced-motion: reduce)').matches)){
      document.querySelectorAll('.btn-lg').forEach(function(btn){
        btn.addEventListener('mousemove', function(e){
          var r = btn.getBoundingClientRect();
          var mx = e.clientX - (r.left + r.width / 2);
          var my = e.clientY - (r.top + r.height / 2);
          btn.style.transform = 'translate(' + (mx * 0.12) + 'px,' + (my * 0.22) + 'px)';
        });
        btn.addEventListener('mouseleave', function(){ btn.style.transform = ''; });
      });
    }
  }catch(e){}

  /* ---- 3. Tab-title reaction — a small, friendly nudge in the
     browser tab when someone switches away mid-visit and back again,
     rather than the title just sitting there unchanged. Purely
     cosmetic, reverts instantly on return. ---- */
  try{
    var originalTitle = document.title;
    var awayTitle = '👋 กลับมาคุยกันต่อได้เลย — CS.SIGN';
    document.addEventListener('visibilitychange', function(){
      document.title = document.hidden ? awayTitle : originalTitle;
    });
  }catch(e){}
})();