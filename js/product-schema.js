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
   =========================================================== */
(function () {
  "use strict";

  var grid = document.getElementById("product-grid");
  if (!grid) return;

  var SCRIPT_ID = "product-list-schema";
  var SITE_URL = "https://cssign.co.th/";

  function escapeForJson(v) {
    return v == null ? "" : String(v);
  }

  /* Pull a numeric price out of strings like "เริ่มต้น ฿1,250 / ชิ้น".
     Quote-only listings ("ขอใบเสนอราคา" / "สอบถามราคา") have no digits,
     so we deliberately omit `offers` for those rather than guessing a
     price schema.org validators would flag as fake. */
  function extractPrice(priceText) {
    if (!priceText) return null;
    var m = String(priceText).replace(/,/g, "").match(/(\d+(\.\d+)?)/);
    return m ? m[1] : null;
  }

  function productToSchema(data, idx) {
    var url = data.slug
      ? SITE_URL + "product-detail.html?slug=" + encodeURIComponent(data.slug)
      : SITE_URL + "products.html?cat=" + encodeURIComponent(data.cat_id || "");
    var node = {
      "@type": "Product",
      "@id": SITE_URL + "products.html#product-" + (idx + 1),
      name: escapeForJson(data.metaTitle) || escapeForJson(data.name) || "สินค้า CS.SIGN",
      description: escapeForJson(data.metaDescription) || escapeForJson(data.desc || data.description || ""),
      sku: escapeForJson(data.code || ""),
      category: escapeForJson(data.cat || ""),
      brand: { "@type": "Brand", name: "CS.SIGN" },
      manufacturer: { "@type": "Organization", "@id": SITE_URL + "#localbusiness" },
      url: url
    };

    var img = Array.isArray(data.images) && data.images.length
      ? (typeof data.images[0] === "object" ? data.images[0].url : data.images[0])
      : null;
    if (img) node.image = img;

    var props = [];
    if (data.material) props.push({ "@type": "PropertyValue", name: "วัสดุ", value: escapeForJson(data.material) });
    if (data.size) props.push({ "@type": "PropertyValue", name: "ขนาด", value: escapeForJson(data.size) });
    if (props.length) node.additionalProperty = props;

    var priceNum = extractPrice(data.price);
    if (priceNum) {
      node.offers = {
        "@type": "Offer",
        priceCurrency: "THB",
        price: priceNum,
        availability: "https://schema.org/InStock",
        url: node.url
      };
    }

    return node;
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
      } catch (e) {
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
    var schema = buildSchema();
    var existing = document.getElementById(SCRIPT_ID);
    if (!schema) {
      if (existing) existing.remove();
      return;
    }
    if (!existing) {
      existing = document.createElement("script");
      existing.type = "application/ld+json";
      existing.id = SCRIPT_ID;
      document.head.appendChild(existing);
    }
    existing.textContent = JSON.stringify(schema);
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
