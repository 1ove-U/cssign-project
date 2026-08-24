/* ===========================================================
   CS.SIGN — product-schema.js
   Injects/updates a Product JSON-LD <script> in <head> built
   straight from whatever .product-card[data-product] elements are
   currently in #product-grid.

   Why read the DOM instead of hand-writing static JSON-LD:
   products.html ships 5 demo cards, but js/products.js may replace
   them with real cards from Firestore (or fall back to the demo
   cards again if the request fails/times out — see products.js).
   Hand-written schema would drift from whatever visitors actually
   see the moment an admin edits the catalog. Reading the same
   data-product attribute the detail popup already uses keeps
   structured data and rendered content as a single source of truth.

   The per-product node itself is built by the shared
   js/product-schema-core.js (window.CSSIGN_PRODUCT_SCHEMA), which
   product-detail.html's inline schema injection also uses — this
   file only handles the ItemList wrapping that's specific to the
   product grid/listing page. See product-schema-core.js if you need
   to add/change a field on the Product node itself (e.g. adding
   aggregateRating) — change it there once, not here and there.
   =========================================================== */
(function () {
  "use strict";

  var grid = document.getElementById("product-grid");
  if (!grid) return;

  var core = window.CSSIGN_PRODUCT_SCHEMA;
  if (!core) return; // js/product-schema-core.js failed to load/wasn't included — fail quiet, no structured data rather than a console error

  var SCRIPT_ID = "product-list-schema";
  var SITE_URL = "https://cssign.co.th/";

  function productToSchema(data, idx) {
    var url = data.slug
      ? SITE_URL + "product-detail.html?slug=" + encodeURIComponent(data.slug)
      : SITE_URL + "products.html?cat=" + encodeURIComponent(data.cat_id || "");

    return core.buildProductNode({
      id: SITE_URL + "products.html#product-" + (idx + 1),
      name: data.metaTitle || data.name,
      description: data.metaDescription || data.desc || data.description || "",
      sku: data.code || "",
      category: data.cat || "",
      images: data.images,
      material: data.material,
      size: data.size,
      url: url,
      price: data.priceRaw // raw number — data.price is the pre-formatted display string, not safe to re-parse
    });
  }

  function buildSchema() {
    var cards = grid.querySelectorAll(".product-card[data-product]");
    if (!cards.length) return null;

    var items = [];
    cards.forEach(function (card, idx) {
      var raw = card.dataset.product;
      if (!raw) return;
      try {
        var data = JSON.parse(raw);
        items.push(productToSchema(data, idx));
      } catch {
        /* skip a malformed card rather than break the whole schema block */
      }
    });
    if (!items.length) return null;

    return {
      "@context": "https://schema.org",
      "@type": "ItemList",
      itemListElement: items.map(function (item, i) {
        return { "@type": "ListItem", position: i + 1, item: item };
      })
    };
  }

  function inject() {
    core.injectJsonLd(SCRIPT_ID, buildSchema());
  }

  /* Rebuild whenever the grid's content settles (skeleton -> real cards,
     tab-filter driven visibility changes don't touch data-product so they
     don't trigger this). Debounced since products.js can mutate the grid
     a few times in quick succession while swapping in real data. */
  var debounceTimer = null;
  var observer = new MutationObserver(function () {
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(inject, 200);
  });
  observer.observe(grid, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-product"] });

  inject();
})();
