# Confirmed unreachable merchant destination

Keep the historical VLV price and original hand-row stock intact. Exclude its active comparison offer only after repeated exact-URL HTTP500/502/503/504 evidence at least five minutes apart. This is transport unavailability, not sold out or deleted. Scope evidence to merchant/URL; a single failure,403/429, inconsistent evidence, or a later successful source timestamp must not suppress it. Existing source-check restoration continues to work.

1. Add failing regression cases to tools/unavailable-offers-test.mjs.
2. Add the scoped repeated-server-error evidence branch to tools/unavailable-offers.mjs; retain existing rules unchanged.
3. Save the two original dated captures as evidence in data/unavailable-offers.json, and filter only this offer from the current prices snapshot. Keep data/listings.csv, phones.json and history unchanged.
4. Prove all other offers identical, run full tests/build, refresh the focused tools graph while preserving non-tool nodes, and publish. Verify the broken outbound destination is absent live and historical data is intact.
