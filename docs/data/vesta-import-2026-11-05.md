# Vesta — 5 November 2026

Sources: the owner's four original workbooks (`vesta-am-2026-11-05_partial.xlsx`,
`vesta-am-2026-11-05-2.xlsx`, `vesta-am-2026-11-05-3.xlsx`, and
`vesta-am-2026-11-05.xlsx`), containing 287 listings. Originals were read without
modification or execution of embedded content.

The independent Scrapling crawl discovered 4,961 unique listing URLs across 69
other categories, following pagination and excluding sidebar recommendations.
Listing-grid prices are never imported. Only primary product buybox cash prices,
explicit stock, expected titles and immutable OpenCart product IDs are trusted.

## Published import scope

- 387 reviewed exact URLs; 303 available offers across 209 existing model families.
- 84 explicitly unavailable sources remain in the manifest and link inventory;
  they have no public price. Their next refresh can restore confirmed stock.
- Phone/tablet RAM and storage come from the selected product's specification
  table and must agree with explicit title capacities. Canonical colors were
  reviewed; SIM remains unspecified unless the selected SKU explicitly states it.
- Two source-backed Honor RAM/storage pairs were added to existing models.
- Five different Canon lens kits, new Honor tablets/phone, regional TV models,
  uncertain laptop configurations, finishes and installation packages remain
  outside public offers until their full identity/spec/photo review is complete.

## Durable handoff

`data/vesta-catalogue.json` drives the daily refresh adapter in `tools/vesta.mjs`.
Fetch/parse failures retain previous offers with their original dates; confirmed
unavailability suppresses the offer. Product ID or phone/tablet hardware changes
are held for review.

`data/vesta-discovery.json` preserves 4,861 remaining discovery/review URLs. This
is a candidate inventory, not a count of new products or available offers.
Unknown brands require owner approval. No button phones were imported.

The Scrapling discovery command is `python tools/vesta-discover.py --report PATH`
in an environment containing Scrapling. It keeps resumable page evidence under
that report directory and does not modify catalogue products or prices. Listing
category labels and name/code matches are candidates requiring product-page
review. Detailed captures, source hashes, workbook extracts and QA logs for this
run are in `.codex/reports/2026-11-05-vesta-import/` (local, excluded from Git).

## Verification

- Dedicated parser/adapter tests include primary cash prices, recommendation and
  installment rejection, exact product IDs, hardware changes, unknown stock,
  dated failures and unavailable products. The reviewed capture set is replayed.
- Full unit suite and build; catalogue variant/spec audits and static site audit.
- Image-loading checks at 390/820/1440px in Chromium/Brave and WebKit; category
  and shop Apply checks at mobile/desktop sizes in English, Russian and Armenian.
- Firefox's local launch fails before page testing with a profile-directory
  error; Linux CI remains the verification route for that engine.

Two independent release blockers found during validation were corrected: the
image test's obsolete category checkbox selector, and the build guard rejecting
manufacturer-documented MB storage on the existing Nokia 105 4G (S30+) entry.
No new button phone was added.
