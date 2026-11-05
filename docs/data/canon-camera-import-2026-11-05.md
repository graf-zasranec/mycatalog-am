# Approved Canon cameras — 5 November 2026

The owner approved finishing the camera shortlist. Three exact black body/kit products are added under Cameras; no new brands are introduced.

| Catalogue entry | Exact included equipment | Verified Zigzag cash price |
|---|---|---:|
| EOS R1 Body | Body only, no lens | 2,990,000 ֏ |
| EOS R5 Mark II + RF 24–105mm F4 L IS USM | Camera and F4 L-series lens | 2,599,000 ֏ |
| EOS R50 V + RF-S 14–30mm F4–6.3 IS STM PZ | Camera and power-zoom kit lens | 456,900 ֏ |

Each retailer product page returned 200 through Scrapling. The cash price is scoped to the primary buy box and stock is explicitly available. Titles, timestamps, originals and source SHA-256 are retained in the local evidence folder. `data/zigzag.json`, existing offer URLs and `data/zigzag-seed.txt` register all three for the existing daily collector.

## Manufacturer specifications

- R1: [Canon manual](https://cam.start.canon/en/C018/manual/html/UG-10_Reference_0090.html) and [Canon Australia](https://www.canon.com.au/cameras/eos-r1): 24.2 MP full-frame stacked CMOS, 6K RAW, 3.2-inch touchscreen; 1115 g includes battery/card, without lens.
- R5 Mark II: [Canon Australia](https://www.canon.com.au/cameras/eos-r5-mark-ii) and [Canon product page](https://www.usa.canon.com/shop/p/eos-r5-mark-ii): 45 MP full-frame stacked CMOS, 8K RAW, 3.2-inch touchscreen; camera weight 746 g excludes the kit lens. Canon's US support page incorrectly lists a 3-inch LCD; Canon's product expert acknowledges this [source error](https://community.usa.canon.com/t5/EOS-DSLR-Mirrorless-Cameras/Canon-USA-website-wrong-about-R5-Mark-II-specs/td-p/496959). The incorrect value was not imported.
- R50 V: [Canon manual](https://cam.start.canon/en/C021/manual/html/UG-11_Reference_0080.html): 24.2 MP APS-C, oversampled 4K30 and cropped 4K60, 3-inch touchscreen. Black camera weight 370 g includes battery/card, excludes the kit lens. Conflicting Bluetooth versions between regional support pages are not imported.

No camera RAM/storage capacities are invented. Memory cards and kit lenses are not treated as internal-storage variants. Existing R50, R10 and R6 families remain separate.

## Photos

Exact uncached Zigzag originals were preserved under `images/_src/`. Visual inspection confirmed the R1 body, the R5 Mark II badge and RF 24–105mm F4 L IS USM lens lettering, and the R50 V with its 14–30mm kit lens. Apple Vision removed the backgrounds. The original dimensions are 1500×1200, 1600×1067 and 1500×1200; transparent visible cutouts are 874×833, 826×789 and 971×619 respectively. No upscaling. Matching black/main cutouts, responsive thumbnails and native metrics are generated through the standard photo pipeline.

Evidence and completion gates: `.codex/reports/2026-11-05-camera-import/`.
