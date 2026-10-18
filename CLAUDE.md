# Graphify shared project context

For codebase questions, first query the shared `graphify-out/graph.json` with a focused `graphify query`. Use `graphify path` or `graphify explain` for follow-ups, then verify important details in the cited source files. Treat graph results as a map; this graph has dangling edges.

For Better.am photo sourcing, background removal, quality checks, color mapping, and thumbnails, use the shared `PHOTO_PIPELINE.md` runbook.

After changing files under `tools/`, run `graphify update tools`, copy `tools/graphify-out/graph.json` to root `graphify-out/graph.json`, then run `graphify cluster-only . --graph graphify-out/graph.json --no-label`. This keeps the shared root graph current without rescanning the full catalog.


# Canonical workspace and file placement

- Use `C:/Users/hastv/Videos/MyCatalog` as the single active Better.am Git checkout for website code, catalogue data, crawlers, tests and Cloudflare configuration. Do not create sibling checkouts or worktrees unless the user explicitly requests one.
- Cloudflare is in use. Its existing worker project lives at `cloudflare/worker/` inside MyCatalog. Run its Wrangler commands from that directory. Preserve its configuration and secrets; moving folders does not authorize changing or deploying infrastructure.
- All marketing work MUST live under `C:/Users/hastv/Videos/Marketing Better.am`: reels, carousels, story/feed images, video compositions, product-shot copies for campaigns, music, captions, drafts, previews and renders. Start new editable projects in `projects/<dated-name>/`; use the existing `instagram/` campaign references and follow `CAMPAIGN-RULES.md`. Do not create marketing output in MyCatalog, `.codex/`, Downloads or a sibling catalogue folder.
- Existing archived versions stay under `C:/Users/hastv/Videos/Better.am Archive`. Keep active catalogue product images in MyCatalog's `images/` folders; these are website assets, not marketing output.
- Keep temporary QA screenshots, browser traces, logs and audit output in `.codex/reports/<dated-task>/`, or the appropriate marketing project for campaign QA. Archive superseded work rather than leaving loose files at the project root.
- Do not delete or overwrite original photos, spreadsheets, unique edits, current assets, refresh checkpoints or credentials during cleanup. Preserve conflicting versions with their provenance in the archive. Never reset, clean, prune or remove a worktree without first preserving its unique working files.

# Brand approval

- Always ask the user for approval before adding any new brand to Better.am, including during shop imports. Existing brands may receive new models within the approved scope.
- Belkin is explicitly excluded by the user. Do not import or republish Belkin products without new explicit approval.
