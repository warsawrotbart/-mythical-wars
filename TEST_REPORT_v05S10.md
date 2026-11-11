# Mythical Wars v05.10 RC: card-presentation acceptance report

Date: 2026-11-10. This is a release candidate, not a production-certified release.

## User-reported defects

1. **Legacy faces in 2D battle:** game called the legacy battle renderer, not the v05 editor compositor. A new adapter `battle-v05-card-bridge.js` renders using the protected v05 manifest and source layers. Existing `battle-card-renderer-v2.1C.js` delegates to the new adapter while keeping its public interface.
2. **Dark ribbon title and misaligned numbers:** corrected in the editor and battle presentation. Title has a light gold fill with an ink outline; cost, attack and health use measured glyph ink bounds for vertical alignment. Compare `QA_EVIDENCE_v05S10/KNZ-019_v05_2D.png`.
3. **No cards visible at mulligan:** asynchronous face creation is retried after failure and mulligan now receives the full v05 face. Tested with actual running game state; `QA_EVIDENCE_v05S10/Mulligan_v05.png`.
4. **3D own-hand backs:** 3D now requests v05 face data. A readable, labelled temporary **front** appears pending rasterization; on success, the full v05 face replaces it; transient failures may be retried. **Actual WebGL/Windows/hosted 3D is NOT verified** (browser test hangs when a real 3D context is opened). This remains the deployment blocker.

## Executed tests

| QA | Result | Scope |
| --- | --- | --- |
| Node unit and regression tests | 108/108 PASS | All `.test.cjs` and `.test.js` |
| v05 real-layer renderer/browser | 10/10 PASS | Full + compact card images; actual PNG/WebP source art |
| Legacy editor browser: stage7 | 24/24 PASS | Catalog, custom art, crop, token protections |
| Legacy editor browser: stage8 | 24/24 PASS | Embedded art reset / missing art |
| Legacy editor browser: stage9 | 7/7 PASS | Token, CHR, NEU and missing art |
| Full real game via Chromium DOM injection | 5/5 assertions PASS | Engine start, mulligan, 2D hand; script executed but Chromium process shutdown hung in current environment |
| Source static dependency check | 328 PASS | Scripts, CSS, manifest, no private keys |
| Built GitHub Pages artifact | 458 files | `tools/build_pages.py` |
| Built artifact static check | 322 PASS | `_site` output |

Some screenshots of the running game were captured with the original application scripts and real card art injected as Blob URLs on `about:blank`: this workaround was necessary because sandbox Chromium blocks navigation to localhost. These are not full hosted-site tests; `localStorage` is inaccessible in this injected context, and the background/hero assets differ from a real deployment. The screenshots nevertheless verify actual mulligan/hand card DOM and rendered card faces.

## Integrity/scope

- Protected `v05/production/editor_manifest.json` SHA-256: `190371ce21046ba4530b9cb93b374292645218f4fcbe0a0f7e5ff0e529f5529f`.
- 169 library IDs (162 cards + 7 tokens); 99 matching included test images, 70 IDs genuinely missing art. No invented substitution. Original source graphics untouched.
- `battle-engine.js`, `card-catalog.js`, `deck-model.js`, stored decks and combat rules untouched.
- No writes to Google Sheets; no server credentials included in GitHub Pages site.

## Acceptance still required on the target platform

1. Publish GitHub Pages and hard-reload with Ctrl+Shift+R. Check face images and title/numbers for cost 2/4/10, attack and health across KNZ/CHR/NEU/TKN.
2. Verify mulligan first-render faces, card replacements, turn transitions and new card draw in real browser storage.
3. Enter 3D, wait for real faces to replace temporary labelled fronts, rotate/move camera, play a card and inspect a minion. If this fails, collect console and GPU errors with the browser version; do not mark the release stable.
4. Verify Win11/Chrome/Edge on local Node server, saved art IndexedDB and image refresh; confirm private Google service account API independently.
