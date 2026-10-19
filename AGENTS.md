# Graphify shared project context

When answering questions about this codebase, first check whether `graphify-out/graph.json` exists. If it does, use `graphify query "<focused question>"` before broad source searches or reading large groups of files. Use `graphify explain "<node>"` or `graphify path "<node A>" "<node B>"` for focused follow-ups. Treat graph results as a map: verify implementation details in the cited source files before changing code.

For Better.am image sourcing, background removal, quality review, color mapping, and thumbnails, start with `PHOTO_PIPELINE.md`.

If the graph is missing or stale, update a focused project area; do not scan the whole catalog by default because it contains a large product and image corpus. The shared graph lives in root `graphify-out/`. Graphify writes a focused `tools/` refresh to `tools/graphify-out/`, so after changing tools code run `graphify update tools`, copy its `graph.json` to root `graphify-out/graph.json`, then run `graphify cluster-only . --graph graphify-out/graph.json --no-label` to refresh the shared report and visualization.


# Canonical workspace and file placement

- Use `C:/Users/hastv/Videos/MyCatalog` as the single active Better.am Git checkout for website code, catalogue data, crawlers, tests and Cloudflare configuration. Do not create sibling checkouts or worktrees unless the user explicitly requests one.
- Cloudflare is in use. Its existing worker project lives at `cloudflare/worker/` inside MyCatalog. Run its Wrangler commands from that directory. Preserve its configuration and secrets; moving folders does not authorize changing or deploying infrastructure.
- All marketing work MUST live under `C:/Users/hastv/Videos/Marketing Better.am`: reels, carousels, story/feed images, video compositions, product-shot copies for campaigns, music, captions, drafts, previews and renders. Start new editable projects in `projects/<dated-name>/`; use the existing `instagram/` campaign references and follow `CAMPAIGN-RULES.md`. Do not create marketing output in MyCatalog, `.codex/`, Downloads or a sibling catalogue folder.
- Existing archived versions stay under `C:/Users/hastv/Videos/Better.am Archive`. Keep active catalogue product images in MyCatalog's `images/` folders; these are website assets, not marketing output.
- Keep temporary QA screenshots, browser traces, logs and audit output in `.codex/reports/<dated-task>/`, or the appropriate marketing project for campaign QA. Archive superseded work rather than leaving loose files at the project root.
- Do not delete or overwrite original photos, spreadsheets, unique edits, current assets, refresh checkpoints or credentials during cleanup. Preserve conflicting versions with their provenance in the archive. Never reset, clean, prune or remove a worktree without first preserving its unique working files.

# Brand approval

- Always ask the user for approval before adding any new brand to Better.am, including during shop imports. Existing brands may receive new models within the approved scope.
- Belkin and Gorenje are explicitly excluded by the user. Do not import or republish their products without new explicit approval.

- The user explicitly approved these six additional brands on 2026-10-19: Amazfit, SMEG, Bang & Olufsen, Bowers & Wilkins, Motorola and ViewSonic. Follow the scoped product list in `.codex/reports/2026-10-18-check/NEW-BRANDS-FOR-CODEX.md`; other new brands still require approval.
