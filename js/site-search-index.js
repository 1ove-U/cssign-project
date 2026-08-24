/* ===========================================================
   CS.SIGN — Sitewide Search: Search Index & Matching
   แยกออกมาจาก js/site-search.js เดิม (319 บรรทัด) — ไฟล์นี้เก็บ
   เฉพาะส่วน "ดัชนีค้นหา" (STATIC_INDEX คงที่ + dynamicIndex ที่โหลด
   จาก Firestore ตอนรันไทม์) และฟังก์ชันจับคู่/ให้คะแนนผลลัพธ์
   (score/search) — ไม่มีส่วน UI/overlay/event listener ใดๆ เลย
   (ย้ายไปอยู่ js/site-search.js ที่เหลือ) ไม่เปลี่ยน logic ใดๆ
   จากของเดิม เป็นแค่ย้ายโค้ดเชิงโครงสร้าง

   ไฟล์นี้เป็น IIFE ธรรมดา (ไม่ใช่ ES module เหมือนไฟล์ js/admin-*.js)
   เพราะโหลดผ่าน <script src="..."> ตรงๆ ใน HTML หน้าเว็บสาธารณะ
   23 ไฟล์ (ไม่ใช่ import/export) จึงส่งค่าที่ไฟล์ site-search.js ต้องใช้
   ผ่าน `window.__ssIndex` แทน (namespace เดียว กันชนกับ global อื่น) —
   ต้องโหลดไฟล์นี้ "ก่อน" site-search.js เสมอ (ดู <script> tag ที่เพิ่ม
   ในทุกไฟล์ HTML: วางไว้ก่อนบรรทัด site-search.js เดิม)
   =========================================================== */
(function(){
  "use strict";

  /* -----------------------------------------------------------
     STATIC INDEX — only entries that are always true regardless
     of what's in Firestore: real pages, real nav categories
     (cat=safety/traffic/equip are the actual site-wide category
     slugs — see products.html / nav-menu.js), real cert claims
     that are genuinely written on quality-policy.html, real FAQ
     text copied verbatim from about.html#faq, and real contact
     shortcuts.
     type: page | product | project | cert | faq
     ----------------------------------------------------------- */
  var STATIC_INDEX = [
    /* ---- Pages ---- */
    { type:'page', title:'หน้าแรก', desc:'ภาพรวมบริการ ป้ายความปลอดภัยและป้ายจราจรครบวงจร', url:'index.html', keywords:'home หน้าแรก cssign ซีเอสไซน์ บริษัท' },
    { type:'page', title:'สินค้าทั้งหมด', desc:'ป้ายความปลอดภัย ป้ายจราจร และอุปกรณ์จราจรทุกประเภท', url:'products.html', keywords:'สินค้า products รายการสินค้า' },
    { type:'page', title:'ผลงานของเรา', desc:'ผลงานที่ส่งมอบให้ลูกค้าจริง', url:'portfolio.html', keywords:'portfolio ผลงาน เคส case study โครงการ' },
    { type:'page', title:'เกี่ยวกับเรา', desc:'ประวัติบริษัท พันธกิจ และทีมงาน', url:'about.html', keywords:'about เกี่ยวกับ บริษัท ประวัติ ทีมงาน โรงงาน' },
    { type:'page', title:'ติดต่อเรา', desc:'ขอใบเสนอราคา ปรึกษาฟรี หรือสอบถามข้อมูลเพิ่มเติม', url:'contact.html', keywords:'contact ติดต่อ ใบเสนอราคา เบอร์โทร line แชท' },

    /* ---- Product categories (real slugs used site-wide via ?cat=) ---- */
    { type:'product', title:'ป้ายความปลอดภัย', desc:'ป้ายเตือน ป้ายบังคับ ป้ายอพยพฉุกเฉิน ตามมาตรฐานสากล', url:'products.html?cat=safety', keywords:'ป้ายความปลอดภัย safety sign ป้ายเตือน ป้ายบังคับ ป้ายห้าม ป้ายอพยพ ทางหนีไฟ' },
    { type:'product', title:'ป้ายจราจร', desc:'ป้ายจราจรสะท้อนแสง HI และป้ายเขตก่อสร้าง ตามมาตรฐานกรมทางหลวง', url:'products.html?cat=traffic', keywords:'ป้ายจราจร traffic sign สะท้อนแสง hi กรมทางหลวง เขตก่อสร้าง ป้ายชี้ทาง' },
    { type:'product', title:'อุปกรณ์จราจร', desc:'กรวยจราจร แบริเออร์ เสาล้มลุก แท่งกั้นถนน', url:'products.html?cat=equip', keywords:'กรวยจราจร แบริเออร์ traffic cone barrier เสาล้มลุก แท่งกั้นถนน bollard อุปกรณ์จราจร' },
    { type:'product', title:'งานออกแบบ Custom Order', desc:'ทีมออกแบบจัดทำ Artwork ให้ฟรีก่อนผลิต รองรับโลโก้บริษัทและ QR Code', url:'products.html', keywords:'custom order ออกแบบ artwork โลโก้ qr code สั่งทำพิเศษ' },

    /* ---- Certifications (ตรวจแล้วว่าตรงกับเนื้อหาจริงใน quality-policy.html#documents) ---- */
    { type:'cert', title:'มอก.', desc:'มาตรฐานผลิตภัณฑ์อุตสาหกรรม — ป้ายความปลอดภัยผลิตตามข้อกำหนดรูปแบบ สี และสัญลักษณ์', url:'quality-policy.html#documents', keywords:'มอก tis สมอ มาตรฐานอุตสาหกรรม' },
    { type:'cert', title:'มาตรฐานกรมทางหลวง', desc:'ป้ายจราจรทุกประเภทผลิตตามข้อกำหนดของกรมทางหลวง', url:'quality-policy.html#documents', keywords:'กรมทางหลวง doh มาตรฐานป้ายจราจร' },

    /* ---- FAQ (ข้อความจริงจาก about.html#faq) ---- */
    { type:'faq', title:'CS.SIGN ให้บริการด้านใดบ้าง?', desc:'ผลิตและจำหน่ายป้ายความปลอดภัย ป้ายจราจร ป้ายทางออกฉุกเฉิน และอุปกรณ์จราจร', url:'about.html#faq', keywords:'บริการ faq คำถาม' },
    { type:'faq', title:'หากต้องการเริ่มใช้บริการ ต้องทำอย่างไร?', desc:'ทักผ่าน LINE โทรศัพท์ หรือแบบฟอร์มออนไลน์ ทีมงานประเมินและเสนอราคาให้ฟรี', url:'about.html#faq', keywords:'เริ่มต้น สั่งซื้อ ขั้นตอน faq' },
    { type:'faq', title:'มีบริการดูแลหลังส่งมอบหรือไม่?', desc:'มีทีมสนับสนุนตอบกลับภายใน 24 ชั่วโมง รองรับการดูแลหลังส่งมอบ', url:'about.html#faq', keywords:'บริการหลังการขาย faq' },
    { type:'faq', title:'สินค้ามีการรับประกันหรือไม่?', desc:'ป้ายกลุ่มความปลอดภัยรับประกัน 18 เดือน สินค้ากลุ่มอื่นรับประกัน 6 เดือน', url:'quality-policy.html#warranty', keywords:'รับประกัน warranty faq' },

    /* ---- Contact shortcuts ---- */
    { type:'page', title:'ขอใบเสนอราคา', desc:'กรอกฟอร์มเพื่อให้ทีมงานติดต่อกลับภายใน 24 ชั่วโมง', url:'contact.html', keywords:'ใบเสนอราคา quote เสนอราคา ฟอร์ม' },
    { type:'page', title:'โทร 062-883-3880', desc:'ติดต่อทีมขายโดยตรง', url:'tel:0628833880', keywords:'เบอร์โทร โทรศัพท์ call' },
    { type:'page', title:'แชท LINE @cssigngroup', desc:'พูดคุยกับทีมงานผ่าน LINE Official', url:'https://line.me/ti/p/@cssigngroup', keywords:'line แชท chat ไลน์' }
  ];

  /* -----------------------------------------------------------
     DYNAMIC INDEX — ผลงาน (portfolios) และสินค้า (products) จริง
     ดึงจาก Firestore ตอนเปิดกล่องค้นหาครั้งแรก (ไม่บล็อกการโหลด
     หน้าเว็บ) แล้ว cache ไว้ในหน่วยความจำระหว่างอยู่บนหน้านั้น
     ไม่มี hardcoded ชื่อลูกค้า/โปรเจกต์ในไฟล์นี้อีกต่อไป
     ----------------------------------------------------------- */
  var dynamicIndex = [];
  var dynamicState = 'idle'; /* idle | loading | ready | error */

  function loadDynamicIndex() {
    if (dynamicState === 'loading' || dynamicState === 'ready') return;
    dynamicState = 'loading';
    Promise.all([
      import('./db-content.js'),
      import('./db-products.js')
    ]).then(function (mods) {
      var contentMod  = mods[0];
      var productsMod = mods[1];
      return Promise.all([
        contentMod.getPortfolios().catch(function () { return []; }),
        productsMod.getProducts().catch(function () { return []; })
      ]);
    }).then(function (results) {
      var portfolios = results[0] || [];
      var products   = results[1] || [];

      var pfItems = portfolios.map(function (p) {
        var title = p.client ? (p.client + ' — ' + (p.title || 'ผลงานของเรา')) : (p.title || 'ผลงานของเรา');
        return {
          type: 'project',
          title: title,
          desc: p.description || '',
          url: 'portfolio.html',
          keywords: [p.title, p.client, p.category].concat(p.tags || []).filter(Boolean).join(' ')
        };
      });

      var prItems = products
        .filter(function (p) { return p.slug && p.status !== 'inactive'; })
        .map(function (p) {
          return {
            type: 'product',
            title: p.name || 'สินค้า',
            desc: p.description || '',
            url: 'product-detail.html?slug=' + encodeURIComponent(p.slug),
            keywords: [p.name, p.code, p.material].concat(p.tags || []).filter(Boolean).join(' ')
          };
        });

      dynamicIndex = pfItems.concat(prItems);
      dynamicState = 'ready';
      /* ถ้าผู้ใช้เปิดกล่องค้นหาและพิมพ์คำอยู่แล้วตอนที่ข้อมูลเพิ่งโหลดเสร็จ
         ให้ค้นหาซ้ำอีกครั้งด้วยคำล่าสุด เพื่อให้ผลลัพธ์ครบ */
      if (typeof window.__ssRefreshResults === 'function') window.__ssRefreshResults();
    }).catch(function () {
      dynamicState = 'error'; /* ออฟไลน์/โหลดไม่สำเร็จ — ค้นหาต่อได้ด้วย STATIC_INDEX เท่านั้น */
    });
  }

  var TYPE_LABEL = {
    page:'หน้าเว็บ', product:'สินค้า', project:'ผลงาน', cert:'ใบรับรอง', faq:'คำถามที่พบบ่อย'
  };

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
    return STATIC_INDEX.concat(dynamicIndex)
      .map(function(item){ return { item:item, s:score(item,q) }; })
      .filter(function(r){ return r.s > 0; })
      .sort(function(a,b){ return b.s - a.s; })
      .slice(0, 8)
      .map(function(r){ return r.item; });
  }

  /* ส่งออกเฉพาะ 3 ตัวที่ site-search.js (ไฟล์ UI) ต้องใช้จริง — TYPE_LABEL/search/
     loadDynamicIndex เดิมทั้งหมดถูกเรียกจากไฟล์นั้น ไม่มีไฟล์อื่นในโปรเจกต์ต้องใช้
     (ตรวจด้วย grep ทั่วโปรเจกต์แล้วก่อนแยก) */
  window.__ssIndex = {
    search: search,
    TYPE_LABEL: TYPE_LABEL,
    loadDynamicIndex: loadDynamicIndex
  };
})();
