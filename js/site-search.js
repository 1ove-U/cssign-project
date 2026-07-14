/* ===========================================================
   CS.SIGN — Sitewide Search
   Pure vanilla JS. No dependencies. Client-side search index
   covering every page, product category, project, certification
   and FAQ on the site.
   =========================================================== */
(function(){
  "use strict";

  /* -----------------------------------------------------------
     SEARCH INDEX — add new entries here as the site grows
     type: page | product | project | cert | faq
     ----------------------------------------------------------- */
  var INDEX = [
    /* ---- Pages ---- */
    { type:'page', title:'หน้าแรก', desc:'ภาพรวมบริการ ป้ายความปลอดภัยและป้ายจราจรครบวงจร', url:'index.html', keywords:'home หน้าแรก cssign ซีเอสไซน์ บริษัท' },
    { type:'page', title:'สินค้าทั้งหมด', desc:'ป้ายความปลอดภัย ป้ายจราจร และอุปกรณ์จราจรทุกประเภท', url:'products.html', keywords:'สินค้า products รายการสินค้า' },
    { type:'page', title:'ผลงานของเรา', desc:'ตัวอย่างโปรเจกต์จริงที่ส่งมอบให้องค์กรชั้นนำ', url:'portfolio.html', keywords:'portfolio ผลงาน เคส case study โครงการ' },
    { type:'page', title:'เกี่ยวกับเรา', desc:'ประวัติบริษัท พันธกิจ ทีมงาน และมาตรฐานที่ได้รับการรับรอง', url:'about.html', keywords:'about เกี่ยวกับ บริษัท ประวัติ ทีมงาน โรงงาน' },
    { type:'page', title:'ติดต่อเรา', desc:'ขอใบเสนอราคา ปรึกษาฟรี หรือสอบถามข้อมูลเพิ่มเติม', url:'contact.html', keywords:'contact ติดต่อ ใบเสนอราคา เบอร์โทร line แชท' },

    /* ---- Product categories ---- */
    { type:'product', title:'ป้ายเตือน / ป้ายบังคับ ISO 7010', desc:'มาตรฐานสากล มองเห็นชัดในทุกสภาพแสง', url:'products.html?cat=safety', keywords:'ป้ายความปลอดภัย safety sign iso 7010 ป้ายเตือน ป้ายบังคับ ป้ายห้าม' },
    { type:'product', title:'ป้ายอพยพฉุกเฉิน', desc:'บอกทางหนีไฟและจุดรวมพลชัดเจน', url:'products.html?cat=safety', keywords:'ป้ายอพยพ ทางหนีไฟ จุดรวมพล emergency exit' },
    { type:'product', title:'ป้ายจราจรสะท้อนแสง HI', desc:'มาตรฐานกรมทางหลวง มอก. รับรอง', url:'products.html?cat=traffic', keywords:'ป้ายจราจร traffic sign สะท้อนแสง hi มอก กรมทางหลวง' },
    { type:'product', title:'ป้ายเตือน / เขตก่อสร้าง', desc:'เพิ่มความปลอดภัยพื้นที่ก่อสร้าง', url:'products.html?cat=traffic', keywords:'ป้ายก่อสร้าง เขตก่อสร้าง construction' },
    { type:'product', title:'ป้ายชี้ทาง / บอกทิศทาง', desc:'ออกแบบตามผังพื้นที่จริง', url:'products.html?cat=traffic', keywords:'ป้ายชี้ทาง บอกทิศทาง wayfinding' },
    { type:'product', title:'กรวยจราจร / แบริเออร์', desc:'วัสดุคุณภาพ ทนทาน ใช้งานยาวนาน', url:'products.html?cat=equip', keywords:'กรวยจราจร แบริเออร์ traffic cone barrier อุปกรณ์จราจร' },
    { type:'product', title:'เสาล้มลุก / แท่งกั้นถนน', desc:'ติดตั้งง่าย ปรับตามพื้นที่ใช้งาน', url:'products.html?cat=equip', keywords:'เสาล้มลุก แท่งกั้นถนน bollard' },
    { type:'product', title:'ป้ายโรงงานอุตสาหกรรม', desc:'ป้ายชี้บ่งพื้นที่ ป้ายความเสี่ยง และระบบป้ายภายในโรงงาน', url:'products.html', keywords:'ป้ายโรงงาน plant signage 5s ชี้บ่งพื้นที่' },
    { type:'product', title:'งานออกแบบ Custom Order', desc:'ทีมออกแบบจัดทำ Artwork ให้ฟรีก่อนผลิต รองรับโลโก้บริษัทและ QR Code', url:'products.html', keywords:'custom order ออกแบบ artwork โลโก้ qr code สั่งทำพิเศษ' },

    /* ---- Portfolio / projects ---- */
    { type:'project', title:'PTT Group — โรงกลั่นน้ำมัน ระยอง', desc:'ระบบป้ายความปลอดภัยครบวงจร มาตรฐาน ISO 7010 — 240 ป้าย', url:'portfolio.html', keywords:'ptt โรงกลั่น ระยอง โรงงานอุตสาหกรรม' },
    { type:'project', title:'กรุงเทพมหานคร — ป้ายจราจรสะท้อนแสง HI', desc:'จัดหาป้ายจราจรมาตรฐานกรมทางหลวงพร้อมเอกสาร มอก. — 180 ป้าย', url:'portfolio.html', keywords:'bma กรุงเทพมหานคร ป้ายจราจร ภาครัฐ' },
    { type:'project', title:'SCG — นิคมอุตสาหกรรมมาบตาพุด', desc:'ระบบป้ายชี้บ่งพื้นที่โรงงานครบชุด 3 อาคาร', url:'portfolio.html', keywords:'scg มาบตาพุด นิคมอุตสาหกรรม 5s' },
    { type:'project', title:'EGAT — โรงไฟฟ้าพลังน้ำ', desc:'ป้ายเตือนไฟฟ้าแรงสูง Custom พร้อม QR Code — 320 ป้าย', url:'portfolio.html', keywords:'egat ไฟฟ้าแรงสูง โรงไฟฟ้า custom' },
    { type:'project', title:'ไทยออยล์ — โรงกลั่นน้ำมัน ศรีราชา', desc:'ป้ายเตือนสารเคมีและทางหนีไฟ', url:'portfolio.html', keywords:'ไทยออยล์ thaioil ศรีราชา สารเคมี ทางหนีไฟ' },
    { type:'project', title:'โรงพยาบาลรามาธิบดี', desc:'ระบบป้ายอพยพฉุกเฉิน', url:'portfolio.html', keywords:'รามาธิบดี โรงพยาบาล hospital อพยพฉุกเฉิน' },
    { type:'project', title:'อมตะซิตี้ ชลบุรี', desc:'ระบบป้ายชี้ทาง — นิคมอุตสาหกรรมอมตะซิตี้', url:'portfolio.html', keywords:'amata อมตะ ชลบุรี นิคมอุตสาหกรรม' },
    { type:'project', title:'เซ็นทรัลพัฒนา — ป้ายอาคารจอดรถ', desc:'Custom Branding สำหรับอาคารจอดรถ', url:'portfolio.html', keywords:'cpn เซ็นทรัลพัฒนา อาคารจอดรถ parking' },

    /* ---- Certifications ---- */
    { type:'cert', title:'มอก. 635-2547', desc:'มาตรฐานผลิตภัณฑ์อุตสาหกรรม ป้ายความปลอดภัย รับรองโดย สมอ.', url:'about.html#certs', keywords:'มอก 635 tis สมอ มาตรฐานอุตสาหกรรม' },
    { type:'cert', title:'ISO 9001:2015', desc:'ระบบการจัดการคุณภาพ รับรองโดย Bureau Veritas', url:'about.html#certs', keywords:'iso 9001 คุณภาพ bureau veritas' },
    { type:'cert', title:'ISO 7010:2019', desc:'สัญลักษณ์ความปลอดภัยสากล', url:'about.html#certs', keywords:'iso 7010 สัญลักษณ์ความปลอดภัย' },
    { type:'cert', title:'มาตรฐานกรมทางหลวง', desc:'ป้ายจราจรทุกประเภทผลิตตามข้อกำหนดกรมทางหลวง', url:'about.html#certs', keywords:'กรมทางหลวง doh มาตรฐานป้ายจราจร' },

    /* ---- FAQ ---- */
    { type:'faq', title:'CS.SIGN ให้บริการด้านใดบ้าง?', desc:'คำตอบอยู่ในส่วนคำถามที่พบบ่อย หน้าเกี่ยวกับเรา', url:'about.html#faq', keywords:'บริการ faq คำถาม' },
    { type:'faq', title:'หากต้องการเริ่มต้นใช้บริการ ต้องทำอย่างไร?', desc:'คำตอบอยู่ในส่วนคำถามที่พบบ่อย หน้าเกี่ยวกับเรา', url:'about.html#faq', keywords:'เริ่มต้น สั่งซื้อ ขั้นตอน faq' },
    { type:'faq', title:'มีบริการดูแลหลังส่งมอบหรือไม่?', desc:'คำตอบอยู่ในส่วนคำถามที่พบบ่อย หน้าเกี่ยวกับเรา', url:'about.html#faq', keywords:'บริการหลังการขาย รับประกัน faq' },

    /* ---- Contact shortcuts ---- */
    { type:'page', title:'ขอใบเสนอราคา', desc:'กรอกฟอร์มเพื่อให้ทีมงานติดต่อกลับภายใน 24 ชั่วโมง', url:'contact.html', keywords:'ใบเสนอราคา quote เสนอราคา ฟอร์ม' },
    { type:'page', title:'โทร 062-883-3880', desc:'ติดต่อทีมขายโดยตรง', url:'tel:0628833880', keywords:'เบอร์โทร โทรศัพท์ call' },
    { type:'page', title:'แชท LINE @cssigngroup', desc:'พูดคุยกับทีมงานผ่าน LINE Official', url:'https://line.me/ti/p/@cssigngroup', keywords:'line แชท chat ไลน์' }
  ];

  var TYPE_LABEL = {
    page:'หน้าเว็บ', product:'สินค้า', project:'ผลงาน', cert:'ใบรับรอง', faq:'คำถามที่พบบ่อย'
  };

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

  function score(item, q){
    var hay = (item.title + ' ' + item.desc + ' ' + item.keywords).toLowerCase();
    if(item.title.toLowerCase().indexOf(q) === 0) return 3;
    if(item.title.toLowerCase().indexOf(q) > -1) return 2;
    if(hay.indexOf(q) > -1) return 1;
    return 0;
  }

  function search(q){
    q = q.trim().toLowerCase();
    if(!q) return [];
    return INDEX
      .map(function(item){ return { item:item, s:score(item,q) }; })
      .filter(function(r){ return r.s > 0; })
      .sort(function(a,b){ return b.s - a.s; })
      .slice(0, 8)
      .map(function(r){ return r.item; });
  }

  function init(){
    var overlay = buildOverlay();
    var panel = overlay.querySelector('.ss-panel');
    var input = overlay.querySelector('#ss-input');
    var results = overlay.querySelector('#ss-results');
    var closeBtn = overlay.querySelector('#ss-close');
    var triggers = document.querySelectorAll('.nav-search-trigger');
    var lastQuery = '';
    var searchDebounceTimer = null;
    var searchRequestId = 0;

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
      var found = search(q);
      if(!found.length){ renderNoMatch(q); return; }
      results.innerHTML = found.map(function(item, i){
        return (
          '<a href="' + item.url + '" class="ss-result" data-idx="' + i + '">' +
            '<span class="ss-result-icon">' + iconFor(item.type) + '</span>' +
            '<span class="ss-result-body">' +
              '<span class="ss-result-title">' + highlight(item.title, q) + '</span>' +
              '<span class="ss-result-desc">' + highlight(item.desc, q) + '</span>' +
            '</span>' +
            '<span class="ss-result-tag">' + (TYPE_LABEL[item.type] || '') + '</span>' +
          '</a>'
        );
      }).join('');
    }

    function open(){
      overlay.classList.add('open');
      document.body.style.overflow = 'hidden';
      renderEmpty();
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
