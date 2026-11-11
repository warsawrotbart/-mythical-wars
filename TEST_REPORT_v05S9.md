# QA report -- v05.9 RC (Drive source art integration)

## Passed in the build environment

- Client Node regression: 102/102 PASS, including five new source-art catalog tests.
- Chromium stage-7 regression: 24/24 PASS (actual PNG/WebP in Blob URLs; control-card PNG exported 1024x1536).
- Chromium stage-8 regression: 24/24 PASS (99 IDs in the built-in-art filter; return from a custom art to built-in, crop preservation, token with art, honest missing card).
- Chromium stage-9 representative cases: 7/7 PASS (TKN-001, TKN-007, CHR-003 v02, NEU-024 v02, missing NEU-001, no JavaScript errors).
- Source Warrior archive images: 41/41 byte-identical against v05.8 recorded source hashes.
- Full static source integrity: 322 successful references and checks, including each changed image and previous version.
- GitHub Pages `_site` static integrity: 316 successful checks; no local backend or credentials in site.
- v05 protected manifest SHA-256: `190371ce21046ba4530b9cb93b374292645218f4fcbe0a0f7e5ff0e529f5529f`.

## Source selection

- Added: TKN-001 through TKN-007.
- Replaced default with new v02: CHR-001/003/008/010 and NEU-024/026/027.
- Existing v02 already matches direct Drive originals: CHR-015 and CHR-023.
- Unchanged from source Warrior archives: 41 card-art PNGs already covered by v05.8.
- Still missing verified images: 70 canonical cards. No invented assignments.
- All images are labelled test/non-approved. Token artwork does not override its card validation/export restrictions.

## Limitations

Chromium tests use an isolated `about:blank` document and real image bytes via Blob URLs; they do not prove behavior on a deployed GitHub Pages URL, user Windows, or persistent IndexedDB across sessions. Live Google service-account API, Windows launch, and published Pages site must still be accepted separately. Art redistribution rights are not verified by this engineering check. Historical legacy 2D/3D wall-clock tests remain an unrelated open issue.
