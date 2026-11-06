# Graphify shared project context

When answering questions about this codebase, first check whether `graphify-out/graph.json` exists. If it does, use `graphify query "<focused question>"` before broad source searches or reading large groups of files. Use `graphify explain "<node>"` or `graphify path "<node A>" "<node B>"` for focused follow-ups. Treat graph results as a map: verify implementation details in the cited source files before changing code.

For Better.am image sourcing, background removal, quality review, color mapping, and thumbnails, start with `PHOTO_PIPELINE.md`.

The root `graphify-out/graph.json` is the combined catalogue + marketing index. Rebuild it with `python3 "/Users/hastv/Movies/Marketing Better.am/tools/refresh-shared-graph.py" --refresh-code`. Component graphs remain separate; do not copy a tools-only graph over the root graph. Refresh changed semantic documents before merging; the helper refuses stale document hashes. Media binaries, generated catalogue data and old exports are excluded. Catalogue edits and publication remain separate from context maintenance.


# Canonical workspace and file placement

- Use `/Users/hastv/Movies/MyCatalog-repo` as the single active Better.am Git checkout for website code, catalogue data, crawlers, tests and Cloudflare configuration. Do not create sibling checkouts or worktrees unless the user explicitly requests one.
- Cloudflare is in use. Its existing worker project lives at `cloudflare/worker/` inside MyCatalog. Run its Wrangler commands from that directory. Preserve its configuration and secrets; moving folders does not authorize changing or deploying infrastructure.
- All marketing work MUST live under `/Users/hastv/Movies/Marketing Better.am`: reels, carousels, story/feed images, video compositions, product-shot copies for campaigns, music, captions, drafts, previews and renders. Start new editable projects in `projects/<dated-name>/`; use the existing `instagram/` campaign references and follow `CAMPAIGN-RULES.md`. Do not create marketing output in MyCatalog, `.codex/`, Downloads or a sibling catalogue folder.
- Existing archived versions stay under `/Users/hastv/Movies/Better.am Archive`. Keep active catalogue product images in MyCatalog's `images/` folders; these are website assets, not marketing output.
- Keep temporary QA screenshots, browser traces, logs and audit output in `.codex/reports/<dated-task>/`, or the appropriate marketing project for campaign QA. Archive superseded work rather than leaving loose files at the project root.
- Do not delete or overwrite original photos, spreadsheets, unique edits, current assets, refresh checkpoints or credentials during cleanup. Preserve conflicting versions with their provenance in the archive. Never reset, clean, prune or remove a worktree without first preserving its unique working files.

# Brand approval

- Always ask the user for approval before adding any new brand to Better.am, including during shop imports. Existing brands may receive new models within the approved scope.
- Belkin power banks are explicitly approved by the user on 2026-11-04. Prepare exact models sold by Armenian retailers; other Belkin product categories still require approval.
- Gorenje is explicitly approved by the user on 2026-11-04. The user requested keeping and refreshing all 41 existing Gorenje offers. This supersedes the earlier Gorenje exclusion; other new brands still require approval.

- The user explicitly approved these six additional brands on 2026-10-19: Amazfit, SMEG, Bang & Olufsen, Bowers & Wilkins, Motorola and ViewSonic. Follow the scoped product list in `.codex/reports/2026-10-18-check/NEW-BRANDS-FOR-CODEX.md`; other new brands still require approval.


- The user approved four more brands on 2026-10-24: Ninja, Oral-B, Midea and KitchenAid.
- The user approved seven more on 2026-10-25: BaByliss, Ariete, Kenwood, Boneco, Levoit, Shark and iRobot.
- And for large appliances on 2026-10-25: Hitachi, Carrier, Mitsubishi Electric and Zanussi.
- Mitsubishi Heavy Industries air conditioners approved on 2026-10-26 ("find clean 2").
- The owner approved on 2026-10-30: Gorenje (this lifts the earlier exclusion), Wacom, Gree, Ariston, Mova and Fujifilm (Instax instant cameras), plus three new sections: Air purifiers (`purifier`), Climate (`climate`: air conditioners, heaters, water heaters, humidifiers) and Graphics tablets (`graphicstablet`). Huion and XP-Pen are not approved.
- 2026-10-31: the owner asked for a professional Cameras section (`camera`: mirrorless, DSLR, compact and instant, types in `appliance.type`), which brings in Canon and Nikon alongside Sony, Panasonic and Fujifilm. Photos for new products must be large official images with smooth edges; small shop images with hard-cut edges (VLV's) were rejected.

# Current redesign draft

The user approved mobile concept C for the separate Bento × Wine prototype on 2026-10-25. Start with `docs/design/bento-wine-draft.md` and query the root Graphify index for “full catalogue hybrid Better.am”. The working preview is http://127.0.0.1:8840/; prototype runtime is local `.codex/reports/2026-10-25-bento-draft/`. The current hybrid combines the approved desktop bento/wine design with the original full working catalogue (2,192 available models), native colour swatches, left filters and product pages. Draft04 is preserved at /draft04/. This is a draft; production integration is a separate user request.

- 2026-11-04 catalogue scope: the user requested professional cameras and Xiaomi/Redmi power banks, alongside Belkin power banks. Verify exact model/variant, live offer, specifications and product photo before publishing.

- Realme is explicitly approved across product categories by the owner on 2026-11-05. Existing Realme catalogue entries are approved; new exact models still need verified offers, specs and photos before publication.
