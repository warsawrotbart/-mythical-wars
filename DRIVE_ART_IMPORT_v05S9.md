# Drive art import -- v05.9 RC

Source folder: https://drive.google.com/drive/folders/1p-B44czFA1G82rFXPz1gcweWDrsl6I3u

## Scope and results

- The entire source folder was inventoried, including 8 class folders.
- Existing 41-art Warrior pack (39 KNZ + 2 NEU) matches source SHA-256; no duplicate upload.
- All seven TKN-001..007 artworks are newly bundled as lossless WebP and mapped by ID.
- Seven revised v02 artworks are selected by default: CHR-001, CHR-003, CHR-008, CHR-010, NEU-024, NEU-026, NEU-027.
- Previous versions remain in `test-art/versions/` (v01 when confirmed, otherwise labelled `previous`).
- The other 70 catalog cards still have no confirmed image and remain unassigned.
- Final built-in coverage: 99 / 169 entries (45 CHR + 39 KNZ + 8 NEU + 7 TKN).
- `test-art/test_art_inventory.json` provides source names, SHA-256, source dimensions, alternate versions and status.
- The source ZIPs include window-checks, masked crops and collage previews; they are review aids, not new standalone card images, and should not be used as default art.
- Original source ZIPs are distributed separately, not put into the GitHub Pages runtime bundle, to limit repository size.

## Preservation and safety

The current library retains its 162 canonical cards and 7 separate tokens. No game data, classification, costs, battle rules, masks, deck construction, or editor manifest was edited. Test art is NOT approved art. KNZ-006/014/019 continue to use their original v05 control artwork as the default. Existing browser-specific user uploads and crop settings have priority over a new bundled default; the `Restore built-in art` action intentionally reverts an override to the current embedded default.

## Local QA

```sh
node --test tests/*.test.cjs tests/*.test.js
python3 tools/check_static_site.py
python3 tools/build_pages.py
python3 tools/check_static_site.py --root _site
```

Manual deployment and local Windows IndexedDB verification remain required. Google Sheets remote writes are not enabled by this update. Public distribution requires rights review for source illustrations.
