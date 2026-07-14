/* ============================================================
   HERO PARALLAX — the background photo tilts a little against the
   cursor, the text tilts a little with it (opposite direction,
   smaller distance), so the two layers read as sitting at
   different depths. Desktop / mouse only; a no-op everywhere else.

   Note: the tilt here is applied to .hero-photo-wrap, a separate
   layer from .hero-photo (which carries the Ken Burns zoom
   animation). Because the tilt and the zoom live on different
   elements, they compound instead of conflicting — the zoom keeps
   running the whole time the parallax tilt is active.

   The AR scan frame/glow/colour-reveal run purely on their own
   automatic CSS loop and are not affected by the cursor.
   ============================================================ */
(function () {
  var hero = document.querySelector('.hero');
  var photo = hero && hero.querySelector('.hero-photo-wrap');
  var inner = hero && hero.querySelector('.hero-inner');
  if (!hero || !photo || !inner) return;

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // skip entirely on touch devices and when the user prefers reduced motion
  var finePointer = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
  var cursorEnabled = finePointer && !reduceMotion;

  var PHOTO_RANGE_X = 18;   // px the photo layer can shift horizontally
  var PHOTO_RANGE_Y = 12;   // px the photo layer can shift vertically
  var COPY_RANGE_X  = 7;    // text moves a shorter distance, opposite direction
  var COPY_RANGE_Y  = 4;

  var raf = null, pendingX = 0, pendingY = 0;

  /* ---- scroll term: as the hero scrolls up out of view (either by
     scrolling down past it, or back up into it again), the photo
     drifts a little slower than the page itself (classic parallax),
     while the text drifts even less — reversible for free since it's
     just a function of the live scroll position, no state to reset
     when the user changes direction. ---- */
  var scrollEnabled = !reduceMotion;
  var scrollFrac = 0; // 0 at top of hero, 1 once fully scrolled past
  function updateScrollFrac(){
    var r = hero.getBoundingClientRect();
    var total = r.height || 1;
    scrollFrac = Math.min(1, Math.max(0, -r.top / total));
  }

  function apply() {
    raf = null;
    var photoY = pendingY * PHOTO_RANGE_Y - scrollFrac * 46;
    var photoX = pendingX * PHOTO_RANGE_X;
    var copyY = -pendingY * COPY_RANGE_Y - scrollFrac * 22;
    var copyX = -pendingX * COPY_RANGE_X;
    photo.style.transform = 'translate3d(' + photoX + 'px,' + photoY + 'px,0)';
    inner.style.transform = 'translate3d(' + copyX + 'px,' + copyY + 'px,0)';
    inner.style.opacity = String(Math.max(0, 1 - scrollFrac * 1.15));
  }

  if (cursorEnabled) {
    hero.addEventListener('mousemove', function (e) {
      var rect = hero.getBoundingClientRect();
      // normalize cursor position to -1..1 from the hero's center, for the tilt
      pendingX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      pendingY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      if (!raf) raf = requestAnimationFrame(apply);
    });

    hero.addEventListener('mouseleave', function () {
      pendingX = 0; pendingY = 0;
      if (!raf) raf = requestAnimationFrame(apply);
    });
  }

  if (scrollEnabled) {
    window.addEventListener('scroll', function(){
      updateScrollFrac();
      if (!raf) raf = requestAnimationFrame(apply);
    }, { passive: true });
    updateScrollFrac();
    apply();
  }
})();
