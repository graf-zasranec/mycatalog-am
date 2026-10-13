# Photo release, 13 October 2026

Scope: native-resolution replacements for Marshall Willen II Black and Cream, Dyson HS08 Blue, Pixel 9 Obsidian, and Honor X9d Midnight Black.

- [x] Visual source check: exact model/finish, clean cutout, no external watermark. Phones retain front and rear views. Evidence: source and downloaded PhotoRoom images inspected individually.
- [x] Pixel check: transparent masters and visible product long edge >=600 px; measure alpha bounds, not canvas size. Evidence: installed masters measured at 1091, 1091, 1148, 936 and 741 px; alpha includes zero.
- [x] Colour mapping: Honor Midnight Black survives duplicate-photo exclusions and appears in built product data. Evidence: browser selection changed #hpShot to honor-x9d__midnight-black.webp and shop offers to matching black listings; both Marshall selectors changed to their exact respective masters.
- [x] Integration: thumbnails, product details, static pages and catalogue regenerated from current main; npm test passes. Evidence: npm test exit 0, 237 scraper checks and 434 app checks; lossless compact-data and canonical-colour checks pass. Rebuilt current main's October 13 price data, without copying stale branch price data.
- [ ] Live: final master hashes and generated mapping verified on better.am after main deployment.

This scoped release does not complete the remaining catalogue-wide photo queue.
