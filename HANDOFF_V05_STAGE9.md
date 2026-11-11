# New chat handoff -- Mythical Wars v05.9 RC

Latest FULL GitHub release: `MW_Mythical_Wars_v2.1M.2_v05.9_GitHub_FULL_DRIVE_ARTS.zip`.
Windows DELTA: `MW_v05.9_Drive_Arts_PATCH_Windows_from_v05.8.zip` (requires a working v05.8 installation).

## Baseline and invariants

- 162 canonical game cards + 7 separate tokens; battle/card/deck mechanics are not edited.
- Only the v05 editor (`v05-dynamic.html`) is user-visible. Old editor DOM dependencies remain hidden.
- v05 protected manifest SHA-256 `190371ce21046ba4530b9cb93b374292645218f4fcbe0a0f7e5ff0e529f5529f`; do not modify without explicit approval.
- The 3 control cards KNZ-019/006/014 default to their original v05 art sources; do not swap masks or layers.
- Google Sheets integration is local Node-only, not implemented as a public GitHub Pages server. Service-account key is never bundled. No Google Sheet cells were modified.

## Drive integration

Source folder: https://drive.google.com/drive/folders/1p-B44czFA1G82rFXPz1gcweWDrsl6I3u

- The four source ZIPs were inspected and 41 Warrior art sources verified as already identical.
- Seven new token image files were converted from original PNG to lossless WebP.
- Seven corrected v02 images are now default. Previous v01 / older versions are in `test-art/versions/`.
- CHR-015 and CHR-023 v02 were already up to date in the prior pack and match their Drive originals.
- Total built-in coverage: 99 of 169 (45 CHR, 39 KNZ, 8 NEU, 7 TKN). 70 cards still lack verified art.
- All art remains TEST, not officially approved. No arbitrary art fallback.

## Key files

- `test-art/{ID}.webp` -- selected default illustrations.
- `test-art/versions/` -- seven old illustrated variants.
- `test-art/test_art_inventory.json` -- SHA-256, versions, original source archive and provenance.
- `mw-test-art-catalog.js` -- exact-ID mapping used in game and v05 editor.
- `DRIVE_ART_IMPORT_v05S9.md`, `CHANGELOG_v05S9.md`, `TEST_REPORT_v05S9.md` -- source and validation notes.
- `GITHUB_FULL_DEPLOY_RU.md` -- deploy instructions.

## Continue work

Do not silently overwrite a user's IndexedDB artwork/crop. Recheck GitHub Pages deployment, Windows persistence, Google service account API, and image redistribution rights. Proceed with missing 70 art IDs only after obtaining correctly identified source files, or continue editor text/attribute UI as a separate scope.
