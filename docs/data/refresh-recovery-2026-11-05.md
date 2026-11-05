# Refresh recovery — 5 November 2026

The main refresh run 42051576585 fetched prices but failed during the build at an older source revision. Its Nokia 105 4G memory guard interpreted 128 MB (0.125 GB) as a dropped-TB error. Current main already contains a narrow, tested allowance for verified whole-MB memory on S30+ feature phones. The smartphone storage guard remains intact. The same specification regression now runs before expensive scraping in the refresh preflight.

The follow-up retry run 42091658388 separately failed when a read of GitHub's REST API returned HTTP 502. Read-only API calls now retry transient server/network failures and short rate limits, with a four-attempt bound and request timeouts. Authentication failures remain visible. The rerun POST is never automatically repeated, because a failed response may follow an already-accepted rerun request. Tests cover those cases and preserve the existing one-refresh-retry policy.

The failed run's saved `refresh-checkpoint` artifact was recovered without executing anything from it. Its prices snapshot was generated at 19:07:36 UTC on 5 November. A guarded recovery tool restored **5,771 newer existing-offer checks**, including **583 actual price or stock changes**. It matches the current model ID, shop, exact URL and configuration axes; accepts only recent explicit check timestamps; and updates only price, stock and source dates. Current titles, colours, RAM, storage, SIM type, reviewed source associations and newer catalogue edits are preserved. It does not add unknown products or replace whole current files with old snapshots.

Today's history point was recomputed from available offers using the scraper's existing plausibility policy. Every earlier daily point was verified unchanged; no historical prices were invented. Original current-data backups and the complete downloaded checkpoint remain local under `.codex/reports/2026-11-05-closeout/`.

The helper `tools/recover-refresh-prices.mjs` is dry-run by default, accepts a twelve-hour checkpoint at most, and writes only with `--write`. Run it against a downloaded prices JSON with `--report=<path>` to retain an audit of every changed check. Replaying the same input is idempotent. The full test suite includes its mismatch, freshness, preservation and idempotence checks.

This recovery completes publication from the verified saved checks; it is not a claim that another full multi-hour crawl has already completed. Historical failed runs remain in GitHub's history. Deployment and browser CI are checked independently for the recovered release.
