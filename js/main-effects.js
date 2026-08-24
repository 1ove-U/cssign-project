/* ===========================================================
   CS.SIGN — Enterprise Redesign — main-effects.js (ส่วนที่ 2/2)
   Pure vanilla JS. No dependencies.

   2026 refactor: แยกออกมาจาก js/main.js เดิม (862 บรรทัด) — ดูหมายเหตุเต็มใน
   js/main.js ไฟล์นี้เก็บเฉพาะลูกเล่นตกแต่งสิ่งที่ไม่ใช่ core UX ตามลำดับเดิมใน
   ไฟล์ต้นฉบับ: FOOTER extras (spotlight, stagger reveal, copy-to-clipboard,
   เวลาทำการ, confetti) → PREMIUM FLOURISHES (cursor-spotlight cards + 3D tilt)
   → GENERAL POLISH (ripple, magnetic CTA, tab-title reaction) ไม่มีการเปลี่ยน
   logic ใดๆ จากของเดิม เป็นแค่ย้ายโค้ดเชิงโครงสร้าง — ต้องโหลดหลัง js/main.js
   เสมอ (ดู <script> tag ในทุกหน้า HTML) เพราะใช้ window.CSSIGN_observeReveal
   ที่ตั้งค่าไว้ในไฟล์นั้น
   =========================================================== */
(function(){
  "use strict";

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
    }catch{}

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
    }catch{}

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
        try{ ok = document.execCommand('copy'); }catch{ ok = false; }
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
    }catch{}

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
    }catch{}

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
    }catch{}
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
  }catch{}
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
    }catch{}
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
  }catch{}

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
  }catch{}
})();
