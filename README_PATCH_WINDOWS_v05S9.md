# Windows patch v05.9 RC -- prerequisites and installation

Prerequisite: full Windows release v05.6 RC plus the v05.8 patch, OR a Windows installation already at v05.8. The v05.9 patch is a delta; it does NOT include unchanged game art, battle files or the complete game.

1. Stop the game and the local Node server before installation.
2. Make a backup copy of the installed game folder and any manually curated exported data.
3. Unzip the v05.9 Windows PATCH into the installed game folder (the root containing `index.html` and `v05-dynamic.html`). Overwrite same-name files; preserve all other files.
4. Reopen the editor at the same origin and port previously used. All 7 tokens and 7 corrected artworks now resolve by exact ID.
5. Validate TKN-001 (new art), CHR-003 (v02), NEU-024 (v02), and KNZ-019 (original control artwork).
6. Do NOT delete browser storage or replace custom art profiles unless you want to remove them. Use the editor's explicit Restore Built-in Art button if necessary.

The Google Sheets backend, credentials and any private source are NOT part of this patch. The source Drive folder is never modified. Status: Release Candidate, manual Windows QA still required.
