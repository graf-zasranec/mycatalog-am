# ASBC catalogue integration

`node scrape.mjs asbc --fresh` refreshes public ASBC retail offers. ASBC also runs automatically through `node tools/refresh.mjs` locally and in GitHub Actions.

The adapter reads the public server-rendered Nuxt payload for iPhone, iPad, Apple Watch and AirPods categories, then the owner's Apple TV A2843 URL. It paginates all category products and rejects incomplete/repeated pagination. It does not import promotional or similar-product cards, EUR prices, private B2B pricing or login-only data.

Each SKU supplies its exact URL, final AMD price, stock, colour and stated specifications. Positive stock and an add-to-cart action are required; preorder and non-new condition rows are excluded. iPad inches and Watch millimetres remain offer configurations. Watch storage in Better.am's legacy schema represents case millimetres, never the watch's internal 64 GB storage. RAM is left unknown when the shop does not state it.

The wireless-case AirPods 5 SKU has its own product, rather than becoming the cheaper standard AirPods 5. Apple TV is classified under streaming players in all three languages, with applicable specs only.

Run `node tools/asbc-test.mjs` or `npm test`. The refresh command runs these ASBC tests before fetching offers.

## Initial import, 15 October 2026

96 in-stock SKUs, including Apple TV, collapse to 77 distinct configurations across 22 models. Region and strap-size duplicates share one configuration where Better.am does not distinguish them. Existing other-shop offers were preserved unchanged. Five product-detail pages independently confirmed imported SKU, price, stock, storage and colour.

New transparent photo sources:

- AirPods 5 wireless case: the exact `mkft4ze-a` ASBC SKU gallery, visible product 890 × 840 px.
- Watch Series 12 Dark Bronze: the exact `mjef4rk-a` ASBC SKU gallery, visible product 750 × 890 px.
- Apple TV A2843: Apple's `apple-tv-4k-hero-select-202210` transparent product image, visible kit 818 × 794 px. Source: https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/apple-tv-4k-hero-select-202210?wid=1600&hei=1600&fmt=png-alpha&qlt=95

No generated detail or background-removal model was needed. All three sources were visually reviewed. The image heuristic flags Apple's separate remote as a fragment and the watch's pale strap edge as a possible halo; these were reviewed against the native transparent sources, not blindly repaired.
