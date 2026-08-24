/* ===========================================================
   CS.SIGN — Sitewide Search: UI overlay & wiring
   Pure vanilla JS. No dependencies (นอกจาก js/site-search-index.js
   ที่ต้องโหลดมาก่อนไฟล์นี้เสมอ — ดูหมายเหตุด้านล่าง)

   2026 refactor: แยกส่วน "ดัชนีค้นหา" (STATIC_INDEX/dynamicIndex/
   loadDynamicIndex/TYPE_LABEL/score/search — 319 → ไฟล์นี้เดิม)
   ออกไปเป็น js/site-search-index.js แล้ว (ดูรายละเอียดที่หัวไฟล์
   นั้น) ไฟล์นี้เหลือแค่ UI: สร้าง overlay, render ผลลัพธ์,
   ผูก event listener (คลิก/พิมพ์/คีย์ลัด) — ไม่มีการเปลี่ยน logic
   ใดๆ จากของเดิม เป็นแค่ย้ายโค้ดเชิงโครงสร้าง อ้างอิงส่วนดัชนีผ่าน
   `window.__ssIndex.search()` / `window.__ssIndex.TYPE_LABEL` /
   `window.__ssIndex.loadDynamicIndex()` แทนการเรียกฟังก์ชัน local
   เดิม (ไฟล์นี้เป็น IIFE ธรรมดา ไม่ใช่ ES module เหมือน js/admin-*.js
   จึงส่งค่าข้ามไฟล์ผ่าน window namespace แทน import/export — ต้อง
   โหลด js/site-search-index.js ก่อนไฟล์นี้เสมอ ดู <script> tag ที่
   เพิ่มในทุกไฟล์ HTML ที่โหลดไฟล์นี้)
   =========================================================== */
(function(){
  "use strict";

  /* -----------------------------------------------------------
     BUILD MARKUP — injected once per page, right after header
     ----------------------------------------------------------- */
  function buildOverlay(){
    var wrap = document.createElement('div');
    wrap.className = 'site-search-overlay';
    wrap.id = 'site-search-overlay';
    wrap.innerHTML =
      '<div class="ss-panel" role="dialog" aria-modal="true" aria-label="ค้นหาในเว็บไซต์">' +
        '<div class="ss-input-row">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" class="ss-input-icon"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
          '<input type="text" id="ss-input" class="ss-input" placeholder="ค้นหาสินค้า ผลงาน ใบรับรอง หรือหน้าเว็บ..." autocomplete="off">' +
          '<button type="button" class="ss-close" id="ss-close" aria-label="ปิดการค้นหา">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
          '</button>' +
        '</div>' +
        '<div class="ss-results" id="ss-results"></div>' +
        '<div class="ss-foot">' +
          '<span><kbd>Enter</kbd> ไปยังผลลัพธ์แรก</span>' +
          '<span><kbd>Esc</kbd> ปิด</span>' +
        '</div>' +
      '</div>';
    document.body.appendChild(wrap);
    return wrap;
  }

  function iconFor(type){
    switch(type){
      case 'product': return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>';
      case 'project': return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6"/></svg>';
      case 'cert': return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z"/><path d="M9 12l2 2 4-4"/></svg>';
      case 'faq': return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.7-2 1.9-2 3.5"/><path d="M12 17h.01"/></svg>';
      default: return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16v16H4z"/><path d="M4 9h16M9 21V9"/></svg>';
    }
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function escRe(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  function highlight(text, q){
    if(!q) return text;
    var re = new RegExp('(' + escRe(q) + ')', 'ig');
    return text.replace(re, '<mark>$1</mark>');
  }

  function init(){
    var overlay = buildOverlay();
    var input = overlay.querySelector('#ss-input');
    var results = overlay.querySelector('#ss-results');
    var closeBtn = overlay.querySelector('#ss-close');
    var triggers = document.querySelectorAll('.nav-search-trigger');
    var searchDebounceTimer = null;
    var searchRequestId = 0;
    var lastQuery = ""; // เดิมไม่เคยประกาศตัวแปรนี้เลย ใช้ "lastQuery = q;" ตรงๆ ใน
    // renderResults() ภายใต้ "use strict" ทำให้โยน ReferenceError ทุกครั้งที่พิมพ์ในกล่องค้นหา
    // (ตัวแปรนี้ไม่เคยถูกอ่านที่ไหนเลยในไฟล์ — คงไว้เฉยๆ เผื่อใช้ต่อในอนาคต แค่ประกาศให้ถูกต้อง)

    function renderEmpty(){
      results.innerHTML =
        '<div class="ss-empty">' +
          '<div class="ss-empty-label">ค้นหายอดนิยม</div>' +
          '<div class="ss-chip-row">' +
            '<button type="button" class="ss-chip" data-q="ป้ายความปลอดภัย">ป้ายความปลอดภัย</button>' +
            '<button type="button" class="ss-chip" data-q="ป้ายจราจร">ป้ายจราจร</button>' +
            '<button type="button" class="ss-chip" data-q="ใบรับรอง">ใบรับรอง / มอก.</button>' +
            '<button type="button" class="ss-chip" data-q="ผลงาน">ผลงานที่ส่งมอบ</button>' +
            '<button type="button" class="ss-chip" data-q="ใบเสนอราคา">ขอใบเสนอราคา</button>' +
          '</div>' +
        '</div>';
      results.querySelectorAll('.ss-chip').forEach(function(chip){
        chip.addEventListener('click', function(){
          input.value = chip.getAttribute('data-q');
          renderResults(input.value);
          input.focus();
        });
      });
    }

    function renderSkeleton(){
      var rows = '';
      for (var i = 0; i < 4; i++) {
        rows +=
          '<div class="ss-skel-row">' +
            '<div class="ss-skel-icon"></div>' +
            '<div class="ss-skel-lines">' +
              '<div class="ss-skel-line w60"></div>' +
              '<div class="ss-skel-line w35"></div>' +
            '</div>' +
          '</div>';
      }
      results.innerHTML = '<div class="ss-skeleton">' + rows + '</div>';
    }

    function renderNoMatch(q){
      /* บั๊กความปลอดภัยที่แก้: เดิมเอาค่า q (ข้อความที่ผู้ใช้พิมพ์ในกล่องค้นหา) ไปแปะลง
         ใน innerHTML ตรงๆ โดยไม่ escape เลย ถ้ามีคนพิมพ์ เช่น <img src=x onerror=...>
         ลงกล่องค้นหา โค้ดจะรันทันที (reflected XSS) — แก้แล้วด้วย escapeHtml() */
      results.innerHTML =
        '<div class="ss-empty">' +
          '<div class="ss-empty-label">ไม่พบผลลัพธ์สำหรับ &ldquo;' + escapeHtml(q) + '&rdquo;</div>' +
          '<div class="ss-chip-row">' +
            '<a href="contact.html" class="ss-chip">สอบถามทีมงานโดยตรง</a>' +
            '<a href="products.html" class="ss-chip">ดูสินค้าทั้งหมด</a>' +
          '</div>' +
        '</div>';
    }

    function renderResults(q){
      lastQuery = q;
      if(!q.trim()){ renderEmpty(); return; }
      var found = window.__ssIndex.search(q);
      if(!found.length){ renderNoMatch(q); return; }
      results.innerHTML = found.map(function(item, i){
        return (
          '<a href="' + item.url + '" class="ss-result" data-idx="' + i + '">' +
            '<span class="ss-result-icon">' + iconFor(item.type) + '</span>' +
            '<span class="ss-result-body">' +
              '<span class="ss-result-title">' + highlight(item.title, q) + '</span>' +
              '<span class="ss-result-desc">' + highlight(item.desc, q) + '</span>' +
            '</span>' +
            '<span class="ss-result-tag">' + (window.__ssIndex.TYPE_LABEL[item.type] || '') + '</span>' +
          '</a>'
        );
      }).join('');
    }

    window.__ssRefreshResults = function () {
      if (overlay.classList.contains('open') && input.value.trim()) {
        renderResults(input.value);
      }
    };

    function open(){
      overlay.classList.add('open');
      document.body.style.overflow = 'hidden';
      renderEmpty();
      window.__ssIndex.loadDynamicIndex();
      setTimeout(function(){ input.focus(); }, 30);
    }
    function close(){
      overlay.classList.remove('open');
      document.body.style.overflow = '';
      input.value = '';
    }

    triggers.forEach(function(t){ t.addEventListener('click', open); });
    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', function(e){ if(e.target === overlay) close(); });

    input.addEventListener('input', function(){
      var q = input.value;
      if(!q.trim()){ renderResults(q); return; }
      renderSkeleton();
      var requestId = ++searchRequestId;
      window.clearTimeout(searchDebounceTimer);
      searchDebounceTimer = window.setTimeout(function(){
        if(requestId !== searchRequestId) return; // a newer keystroke superseded this one
        renderResults(q);
      }, 150);
    });

    document.addEventListener('keydown', function(e){
      if((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)){
        e.preventDefault(); open();
      }
      if(e.key === '/' && document.activeElement !== input && !overlay.classList.contains('open')){
        e.preventDefault(); open();
      }
      if(!overlay.classList.contains('open')) return;
      if(e.key === 'Escape'){ close(); }
      if(e.key === 'Enter'){
        var first = results.querySelector('.ss-result');
        if(first){ window.location.href = first.getAttribute('href'); }
      }
    });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
