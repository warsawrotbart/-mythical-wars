# v05.9 RC -- artwork imported from the linked project Drive folder

Base: v2.1M.2 + v05.8 RC (10 Nov 2026).

- Inspected the supplied Drive folder, all eight class folders, and the four bulk source ZIPs.
- Verified 41 original Warrior-pack art files against existing v05.8 source SHA-256 values: all identical.
- Added 7 missing token images, TKN-001..007, using the exact ID and source PNG.
- Installed 7 corrected v02 illustrations by ID: CHR-001, CHR-003, CHR-008, CHR-010, NEU-024, NEU-026, NEU-027.
- Preserved prior built-in variants of all seven updated cards in `test-art/versions/`.
- Confirmed that CHR-015 and CHR-023 already had their corresponding Drive v02 original source hashes in v05.8; no duplicate overwrite required.
- Added checksummed provenance and dimensions to `test-art/test_art_inventory.json`.
- Coverage 99/169: 45 CHR + 39 KNZ + 8 NEU + 7 TKN; 70 cards remain without verified art.
- Kept the three v05 control-card sources KNZ-006/014/019 unchanged by default.
- Preserved the sole user-visible v05 editor, local custom art preference, per-ID crop, and import/sync safety.

No battle rules, canonical card fields, protected v05 manifest, deck lists, template masks or Google Sheets records were changed. All art remains test-only and not approved.

The original Drive archives contain auxiliary window-checks and review sheets. They are not substituted for exact-ID standalone card art; original source packages remain in the Drive folder. See DRIVE_ART_IMPORT_v05S9.md.
