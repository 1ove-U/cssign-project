/* ===========================================================
   CS.SIGN — nav-menu.js
   Renders the header's "หมวดหมู่" mega-menu (desktop) and the
   mobile category panel from the real `groups`/`categories`
   collections in Firestore — the same data source and admin
   screen used everywhere else on the site (js/admin-page.js).

   หมวดใหญ่ > หมวดย่อย: ทั้งเดสก์ท็อปและมือถือเป็นแบบ "เลือกหมวดใหญ่
   ก่อนถึงเห็นรายการหมวดย่อย" (progressive disclosure) แทนที่จะแสดง
   หมวดย่อยทุกหมวดพร้อมกันเหมือนเดิม —
     - เดสก์ท็อป: แถบซ้ายเป็นรายการหมวดใหญ่ hover/focus/click แล้ว
       แผงด้านขวาสลับไปแสดงหมวดย่อยของหมวดใหญ่นั้น (หมวดใหญ่แรกเปิด
       ให้อัตโนมัติเพื่อไม่ให้แผงว่างเปล่าตอนเปิดเมนูครั้งแรก)
     - มือถือ: แต่ละหมวดใหญ่เป็นแถบ accordion กดเพื่อขยาย/ย่อดูหมวดย่อย

   Categories ที่ไม่มี group_id เลย (กรณีข้อมูลเก่ายังไม่ได้ migrate)
   จะถูกจัดรวมไว้ในหมวดใหญ่ fallback ชื่อ "หมวดหมู่สินค้า" ท้ายรายการ
   เสมอ เพื่อไม่ให้หมวดย่อยไหนหายไปจากเมนูเงียบๆ

   If Firestore has no categories yet, or the request fails
   (offline, rules issue, etc.), the static menu already written
   into the HTML is left exactly as-is — visitors never see an
   empty menu. This mirrors the fallback pattern used by
   js/products.js elsewhere on the site.
   =========================================================== */
import { getGroups, getCategories } from './db.js';

(function () {
  "use strict";

  var megaGrids    = document.querySelectorAll('.nav-mega-grid');
  var mobilePanels = document.querySelectorAll('.mobile-dd-panel');
  if (!megaGrids.length && !mobilePanels.length) return;

  // ผูก interactivity ให้กับ markup แบบ static ที่เขียนไว้ในหน้าเว็บทันที
  // (เผื่อ Firestore โหลดช้า/ไม่มีข้อมูล) — ถ้า Firestore โหลดสำเร็จทีหลัง
  // ก็แค่แทนที่ innerHTML แล้วผูกใหม่อีกรอบตามปกติ ไม่ชนกัน
  megaGrids.forEach(function (grid) {
    if (grid.classList.contains('nav-mega-grid--flyout')) bindDesktopFlyout(grid);
  });
  mobilePanels.forEach(function (panel) {
    if (panel.querySelector('.mobile-dd-group')) bindMobileAccordion(panel);
  });

  var DEFAULT_GROUP_ID = '__uncategorized__';
  var DEFAULT_GROUP_NAME = 'หมวดหมู่สินค้า';

  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* จัดหมวดย่อยเข้ากลุ่มหมวดใหญ่จริงจาก collection "groups" (เรียงตาม
     order ที่แอดมินตั้งไว้) แล้วค่อยเติมหมวดใหญ่ fallback ต่อท้ายถ้ามี
     หมวดย่อยที่ยังไม่มี group_id หลงเหลืออยู่ — ตัดหมวดใหญ่ที่ไม่มี
     หมวดย่อยเหลือเลยออก (กันปุ่มหมวดใหญ่ที่กดแล้วว่างเปล่า) */
  function groupCategories(categories, groups) {
    var byId = {};
    var order = [];
    (groups || []).forEach(function (g) {
      byId[g.id] = { id: g.id, title: g.name || '', items: [] };
      order.push(byId[g.id]);
    });
    var fallback = null;
    categories.forEach(function (c) {
      var key = c.group_id || '';
      if (key && byId[key]) { byId[key].items.push(c); return; }
      if (!fallback) {
        fallback = { id: DEFAULT_GROUP_ID, title: DEFAULT_GROUP_NAME, items: [] };
        order.push(fallback);
      }
      fallback.items.push(c);
    });
    return order.filter(function (g) { return g.items.length > 0; });
  }

  function megaItemHTML(c) {
    var label = (c.icon ? c.icon + ' ' : '') + escapeHtml(c.name || '');
    var desc  = c.description ? '<span>' + escapeHtml(c.description) + '</span>' : '';
    var cls   = 'nav-mega-item' + (desc ? '' : ' nav-mega-item--simple');
    return (
      '<a href="products.html?cat=' + encodeURIComponent(c.id) + '" class="' + cls + '">' +
        '<span><strong>' + label + '</strong>' + desc + '</span>' +
      '</a>'
    );
  }

  /* ── Desktop: แถบหมวดใหญ่ซ้าย + แผงหมวดย่อยขวา ── */
  function desktopHTML(groups) {
    var btns = groups.map(function (g, i) {
      return (
        '<button type="button" class="nav-mega-group-btn' + (i === 0 ? ' active' : '') + '" data-group="' + escapeHtml(g.id) + '">' +
          escapeHtml(g.title) +
        '</button>'
      );
    }).join('');
    var panels = groups.map(function (g, i) {
      return (
        '<div class="nav-mega-panel-group' + (i === 0 ? ' active' : '') + '" data-group="' + escapeHtml(g.id) + '">' +
          g.items.map(megaItemHTML).join('') +
        '</div>'
      );
    }).join('');
    return (
      '<div class="nav-mega-groups">' + btns + '</div>' +
      '<div class="nav-mega-panel">' + panels + '</div>'
    );
  }

  function bindDesktopFlyout(gridEl) {
    var btns = gridEl.querySelectorAll('.nav-mega-group-btn');
    var panels = gridEl.querySelectorAll('.nav-mega-panel-group');
    function activate(groupId) {
      btns.forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-group') === groupId); });
      panels.forEach(function (p) { p.classList.toggle('active', p.getAttribute('data-group') === groupId); });
    }
    btns.forEach(function (b) {
      // mouseenter ให้ความรู้สึกแบบ hover-flyout ปกติ, click ไว้รองรับคีย์บอร์ด/ทัชสกรีน
      b.addEventListener('mouseenter', function () { activate(b.getAttribute('data-group')); });
      b.addEventListener('click', function (e) { e.preventDefault(); activate(b.getAttribute('data-group')); });
      b.addEventListener('focus', function () { activate(b.getAttribute('data-group')); });
    });
  }

  /* ── มือถือ: accordion ต่อหมวดใหญ่ เปิดได้ทีละหมวด ── */
  function mobileHTML(groups) {
    var html = groups.map(function (g) {
      return (
        '<div class="mobile-dd-group">' +
          '<button type="button" class="mobile-dd-group-btn" data-group="' + escapeHtml(g.id) + '">' +
            escapeHtml(g.title) +
            '<svg class="nav-dd-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><polyline points="6 9 12 15 18 9"/></svg>' +
          '</button>' +
          '<div class="mobile-dd-group-panel">' +
            g.items.map(function (c) {
              return '<a href="products.html?cat=' + encodeURIComponent(c.id) + '">' + escapeHtml(c.name || '') + '</a>';
            }).join('') +
          '</div>' +
        '</div>'
      );
    }).join('');
    return html + '<a href="products.html" class="mobile-dd-viewall">ดูสินค้าทั้งหมด</a>';
  }

  function bindMobileAccordion(panelEl) {
    var groups = panelEl.querySelectorAll('.mobile-dd-group');
    groups.forEach(function (g) {
      var btn = g.querySelector('.mobile-dd-group-btn');
      var sub = g.querySelector('.mobile-dd-group-panel');
      if (!btn || !sub) return;
      btn.addEventListener('click', function () {
        var willOpen = !btn.classList.contains('open');
        // เปิดได้ทีละหมวดใหญ่ — ปิดหมวดอื่นที่ค้างเปิดอยู่ก่อนเสมอ
        groups.forEach(function (og) {
          var obtn = og.querySelector('.mobile-dd-group-btn');
          var osub = og.querySelector('.mobile-dd-group-panel');
          if (obtn !== btn) { obtn.classList.remove('open'); osub.style.maxHeight = null; }
        });
        btn.classList.toggle('open', willOpen);
        sub.style.maxHeight = willOpen ? sub.scrollHeight + 'px' : null;
        // แผงนอกสุด "หมวดหมู่" (main.js คุมอยู่) ถูกกำหนด max-height แบบ px
        // ตายตัวไว้ตอนเปิด ถ้าไม่ขยายตามหมวดย่อยที่เพิ่งกางออก เนื้อหาจะโดนตัด
        var outerPanel = document.getElementById('mobile-dd-panel');
        if (outerPanel && outerPanel.style.maxHeight) {
          window.requestAnimationFrame(function () {
            outerPanel.style.maxHeight = outerPanel.scrollHeight + 'px';
          });
        }
      });
    });
  }

  Promise.all([getGroups(), getCategories()])
    .then(function (results) {
      var groupDocs = results[0];
      var categories = results[1];
      if (!categories || !categories.length) return; // keep the static fallback menu already in the page

      var groups = groupCategories(categories, groupDocs);
      if (!groups.length) return;

      var gridHTML = desktopHTML(groups);
      megaGrids.forEach(function (grid) {
        grid.classList.add('nav-mega-grid--flyout');
        grid.innerHTML = gridHTML;
        bindDesktopFlyout(grid);
      });

      var panelHTML = mobileHTML(groups);
      mobilePanels.forEach(function (panel) {
        panel.innerHTML = panelHTML;
        bindMobileAccordion(panel);
      });
    })
    .catch(function (err) {
      console.warn('CS.SIGN: ไม่สามารถโหลดหมวดหมู่จาก Firebase ได้ แสดงเมนูตัวอย่างแทน', err);
    });
})();
