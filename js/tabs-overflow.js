/* ===========================================================
   CS.SIGN — tabs-overflow.js
   Keeps any ".product-tabs" pill row (category filters) on a
   single line. When there isn't enough horizontal room for every
   button, the overflowing ones are MOVED (not cloned, so their
   existing click listeners keep working) into a "เพิ่มเติม ▾"
   dropdown that matches the site's pill/blue visual language.

   Works for both static tabs (already in the HTML) and tabs that
   get injected dynamically later (e.g. products.js rebuilding
   #product-tabs-dynamic from Firestore categories) — just call
   window.CSIGN.initTabsOverflow(wrapEl) again after the rebuild.
   =========================================================== */
(function () {
  "use strict";

  var registry = [];
  var resizeTimer = null;

  function buildMoreButton() {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'product-tab product-tab-more';
    btn.setAttribute('aria-haspopup', 'true');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML =
      '<span class="tab-more-label">เพิ่มเติม</span>' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" ' +
      'style="width:14px;height:14px;margin-left:5px;"><path d="M6 9l6 6 6-6"/></svg>';
    return btn;
  }

  function closeMenu(menu, moreBtn) {
    menu.classList.remove('open');
    moreBtn.setAttribute('aria-expanded', 'false');
  }

  function build(wrap) {
    var originalTabs = Array.prototype.slice.call(wrap.children).filter(function (el) {
      return el.classList.contains('product-tab') && !el.classList.contains('product-tab-more');
    });

    var moreBtn = buildMoreButton();
    var menu = document.createElement('div');
    menu.className = 'product-tab-more-menu';
    moreBtn.appendChild(menu);
    wrap.appendChild(moreBtn);

    if (!wrap.style.position) wrap.style.position = 'relative';
    wrap.style.flexWrap = 'nowrap';

    moreBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      var willOpen = !menu.classList.contains('open');
      menu.classList.toggle('open', willOpen);
      moreBtn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    });
    menu.addEventListener('click', function (e) {
      if (e.target.closest('.product-tab')) {
        setTimeout(function () { closeMenu(menu, moreBtn); }, 80);
      }
    });
    document.addEventListener('click', function (e) {
      if (!wrap.contains(e.target)) closeMenu(menu, moreBtn);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeMenu(menu, moreBtn);
    });

    wrap.__csignMoreBtn = moreBtn;
    wrap.__csignMenu = menu;
    wrap.__csignAllTabs = originalTabs;
    if (registry.indexOf(wrap) === -1) registry.push(wrap);
  }

  function recalc(wrap) {
    var moreBtn = wrap.__csignMoreBtn;
    var menu = wrap.__csignMenu;
    var allTabs = wrap.__csignAllTabs;
    if (!moreBtn || !menu || !allTabs || !allTabs.length) return;

    /* bring every tab back into the main row, in original order, before the more button */
    allTabs.forEach(function (tab) { wrap.insertBefore(tab, moreBtn); });
    menu.innerHTML = '';
    moreBtn.style.display = 'none';
    closeMenu(menu, moreBtn);

    var style = getComputedStyle(wrap);
    var padL = parseFloat(style.paddingLeft) || 0;
    var padR = parseFloat(style.paddingRight) || 0;
    var gap = parseFloat(style.columnGap || style.gap) || 4;
    var available = wrap.clientWidth - padL - padR;

    var widths = allTabs.map(function (t) { return t.getBoundingClientRect().width; });
    var total = widths.reduce(function (sum, w, i) { return sum + w + (i > 0 ? gap : 0); }, 0);

    if (total <= available || !available) return; /* everything fits on one line already */

    moreBtn.style.display = 'inline-flex';
    var moreWidth = moreBtn.getBoundingClientRect().width;

    var visibleCount = 0;
    var running = 0;
    for (var i = 0; i < widths.length; i++) {
      var prospective = running + (i > 0 ? gap : 0) + widths[i];
      var fitsWithMore = (prospective + gap + moreWidth) <= available;
      if (fitsWithMore || i === 0) { /* always keep at least the first tab visible */
        running = prospective;
        visibleCount = i + 1;
      } else {
        break;
      }
    }
    if (visibleCount < 1) visibleCount = 1;

    var hasActiveHidden = false;
    for (var j = visibleCount; j < allTabs.length; j++) {
      var tab = allTabs[j];
      if (tab.classList.contains('active')) hasActiveHidden = true;
      menu.appendChild(tab);
    }
    moreBtn.classList.toggle('has-active', hasActiveHidden);
  }

  function init(wrap) {
    if (!wrap) return;
    var alreadyBuilt = wrap.__csignMoreBtn && wrap.contains(wrap.__csignMoreBtn);
    if (!alreadyBuilt) build(wrap);
    recalc(wrap);
  }

  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      registry.forEach(recalc);
    }, 150);
  });

  window.CSIGN = window.CSIGN || {};
  window.CSIGN.initTabsOverflow = init;

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.product-tabs').forEach(init);
  });
})();
