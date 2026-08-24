/* ===========================================================
   CS.SIGN — product-schema-core.js
   Single source of truth for turning a product record into a
   schema.org Product JSON-LD node.

   Used by BOTH:
     - js/product-schema.js       (products.html — wraps many of
                                    these into an ItemList)
     - product-detail.html         (single Product node, inline
                                    <script type="module"> block)

   Before this file existed, the two pages had their own copies of
   this logic that had quietly drifted apart (one parsed a formatted
   price *string*, the other expected a raw number). Adding a new
   field like `aggregateRating` meant remembering to touch both.
   Now there's exactly one place: add the field to buildProductNode()
   below and both pages pick it up automatically.

   Plain classic <script> on purpose (not a module) so a single
   `<script src="js/product-schema-core.js"></script>` works for
   both a plain script (js/product-schema.js) and a `type="module"`
   block (product-detail.html) — modules can still read globals,
   they just don't leak their own top-level vars onto `window`.
   Exposes everything under window.CSSIGN_PRODUCT_SCHEMA.
   =========================================================== */
(function () {
  "use strict";

  function escapeForJson(v) {
    return v == null ? "" : String(v);
  }

  /* Raw numeric price only — e.g. 1250, "1250", or a Firestore number
     field. Deliberately does NOT try to parse pre-formatted display
     strings like "เริ่มต้น ฿1,250 / ชิ้น"; callers that only have a
     formatted string on hand should pass along the raw price the
     string was built from instead (see js/products.js's `priceRaw`).
     Quote-only listings ("ขอใบเสนอราคา") have no usable number, so we
     deliberately return null and let the caller omit `offers` rather
     than guessing a price schema.org validators would flag as fake. */
  function extractPriceNumber(price) {
    var n = Number(price);
    return (price != null && price !== "" && !isNaN(n) && n > 0) ? String(n) : null;
  }

  function firstImageUrl(images) {
    if (!Array.isArray(images) || !images.length) return null;
    var first = images[0];
    return (first && typeof first === "object") ? (first.url || null) : (first || null);
  }

  /* Builds one schema.org Product node.
     `input` fields:
       name, description, sku, category, material, size, images, url  — as before
       price          — RAW numeric price (or null/undefined for "call for quote")
       id             — optional "@id" for the node (e.g. list-item anchors)
       aggregateRating — optional { ratingValue, reviewCount } passthrough,
                         only added when both values are present — this is
                         the extension point mentioned as the motivating
                         example; add further optional fields the same way
  */
  function buildProductNode(input) {
    input = input || {};
    var SITE_URL = "https://cssign.co.th/";

    var node = {
      "@type": "Product",
      name: escapeForJson(input.name) || "สินค้า CS.SIGN",
      description: escapeForJson(input.description || ""),
      sku: escapeForJson(input.sku || ""),
      category: escapeForJson(input.category || ""),
      brand: { "@type": "Brand", name: "CS.SIGN" },
      manufacturer: { "@type": "Organization", "@id": SITE_URL + "#localbusiness" },
      url: input.url || SITE_URL
    };
    if (input.id) node["@id"] = input.id;

    var img = firstImageUrl(input.images);
    if (img) node.image = img;

    var props = [];
    if (input.material) props.push({ "@type": "PropertyValue", name: "วัสดุ", value: escapeForJson(input.material) });
    if (input.size) props.push({ "@type": "PropertyValue", name: "ขนาด", value: escapeForJson(input.size) });
    if (props.length) node.additionalProperty = props;

    var priceNum = extractPriceNumber(input.price);
    if (priceNum) {
      node.offers = {
        "@type": "Offer",
        priceCurrency: "THB",
        price: priceNum,
        availability: "https://schema.org/InStock",
        url: node.url
      };
    }

    /* Extension point: add new optional fields here, in this one place,
       instead of in every page that builds a Product node. */
    if (input.aggregateRating && input.aggregateRating.ratingValue && input.aggregateRating.reviewCount) {
      node.aggregateRating = {
        "@type": "AggregateRating",
        ratingValue: input.aggregateRating.ratingValue,
        reviewCount: input.aggregateRating.reviewCount
      };
    }

    return node;
  }

  /* Writes/updates/removes a JSON-LD <script id="..."> in <head>.
     Shared so both pages dismiss/rebuild schema the same way. */
  function injectJsonLd(scriptId, schemaOrNull) {
    var existing = document.getElementById(scriptId);
    if (!schemaOrNull) {
      if (existing) existing.remove();
      return;
    }
    if (!existing) {
      existing = document.createElement("script");
      existing.type = "application/ld+json";
      existing.id = scriptId;
      document.head.appendChild(existing);
    }
    existing.textContent = JSON.stringify(schemaOrNull);
  }

  window.CSSIGN_PRODUCT_SCHEMA = {
    buildProductNode: buildProductNode,
    extractPriceNumber: extractPriceNumber,
    injectJsonLd: injectJsonLd
  };
})();
