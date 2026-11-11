# Handoff v05.10 RC

Начинайте с `README.md`, `BATTLE_CARD_INTEGRATION_v05S10_RU.md` и `TEST_REPORT_v05S10.md`.

Источник истины для UI карт: `v05/production/editor_manifest.json` (SHA-256 `190371ce21046ba4530b9cb93b374292645218f4fcbe0a0f7e5ff0e529f5529f`). Runtime изолирован в `battle-v05-card-bridge.js`, не правьте оригинальные слои. Композиторы: редактор `v05-dynamic.js`; бой `battle-v05-card-bridge.js`. Legacy `battle-card-renderer-v2.1C.js` является шлюзом для старого DOM API; теперь делегирует v05.

Открытые задачи: подтвердить настоящую 3D WebGL-приёмку, Windows с IndexedDB, опубликованный GitHub Pages; авторизация Google Sheets через отдельный защищённый сервер. По-прежнему 70 карт без тестовых артов, 99 из 169 с картинками. Не загружать service account credentials на сайт. Боевой движок, карточный каталог, колоды, манифест и 3 исходных арта v05 защищены.
