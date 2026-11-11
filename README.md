# Мифические войны — v2.1M.2 + v05.11 Hero HUD RC

**Актуальное 2D-поле:** [Battlefield v02](battlefield-v02.js) по [ТЗ v02](https://drive.google.com/file/d/182JOOXK0wQllAHhljQh-BhJtIOhWupiK/view). Старые выбираемые 2D-варианты удалены из интерфейса; 3D-прототип остаётся. Задачи и QA: [TASK_JOURNAL.md](TASK_JOURNAL.md).


> **Текущий релиз: v05.11 Hero HUD RC.** Полная автономная поставка — все предыдущие патчи не нужны. Обновлены герои, способности и оружие в 2D и в DOM-панелях 3D. Читайте [README_START_v05.11_RU.md](README_START_v05.11_RU.md), [CHANGELOG_v05S11.md](CHANGELOG_v05S11.md), [MW_v05.11_TEST_REPORT.md](MW_v05.11_TEST_REPORT.md) и [MW_v05.11_NEW_CHAT_HANDOFF.md](MW_v05.11_NEW_CHAT_HANDOFF.md). Реальный WebGL 3D требует отдельной приёмки.

**Полный GitHub Pages проект с единым редактором v05 и встроенными тестовыми артами по ID.** Основан на v05.6 RC, 10.11.2026. Это самостоятельная сборка, а не патч.

## Открыть

- [Игра, коллекция, колоды, тестовый бой](index.html)
- [Единственный редактор карт v05](v05-dynamic.html) — выбирайте любую карту из библиотеки 162 + 7, открывайте из коллекции или загружайте XLSX/CSV.

Старый редактор удалён из меню и пользовательских переходов. Его скрытая DOM-инфраструктура и программные компоненты **пока сохранены как зависимости игрового интерфейса** — не открываются для редактирования. Служебный `v05-studio.html` сохранён в исходниках для QA, **не включается** в публикацию GitHub Pages.

## Тестовые арты по умолчанию

- **99 / 169** entries have bundled test illustrations: 45 CHR, 39 KNZ, 8 NEU and 7 TKN.
- **70 / 169** entries still have no confirmed matching art. No unrelated picture is substituted. See [DRIVE_ART_IMPORT_v05S9.md](DRIVE_ART_IMPORT_v05S9.md).
- Изображения `test-art/{ID}.webp` — WebP без изменения пикселей относительно исходных файлов; каталоги и источники зафиксированы в `test-art/test_art_inventory.json`. Исходные файлы игры и оригинальная графика v05 не изменены.
- Для **KNZ-019 (существо), KNZ-006 (оружие), KNZ-014 (заклинание)** сохраняется оригинальный `v05/{ID}/{ID}_art_source.png` как базовый арт, чтобы не нарушать контрольные изображения.
- **v05.8:** справа видна миниатюра встроенного арта, доступна кнопка «Вернуть встроенный арт» после пользовательской замены, в библиотеке можно включить фильтр «Только карты со встроенным артом». Возврат очищает пользовательскую замену для конкретного ID (включая локально сохранённую), но не обнуляет кадрирование.
- Собственный арт и кадрирование в редакторе имеют приоритет, как прежде; они хранятся отдельно в IndexedDB (если браузер разрешает доступ). Арты всё ещё **тестовые, не утверждённые**. PNG может быть заблокирован при неутверждённых данных/шаблонах.

Current integration: [Battle card rendering v05.10](BATTLE_CARD_INTEGRATION_v05S10_RU.md). Previous stage: [Drive art import v05.9](DRIVE_ART_IMPORT_v05S9.md). Previous guide: [Руководство по встроенным артам v05.8](BUILTIN_ARTS_GUIDE_v05S8_RU.md) и [Changelog v05.8](CHANGELOG_v05S8.md).

## Публикация

См. [GITHUB_FULL_DEPLOY_RU.md](GITHUB_FULL_DEPLOY_RU.md). Распакуйте ZIP и перенесите **содержимое** папки `mythical-wars` в корень GitHub-репозитория, включая скрытую `.github`. В GitHub настройте **Settings → Pages → Build and deployment → Source → GitHub Actions**, затем **Actions → Publish Mythical Wars to GitHub Pages → Run workflow**.

Локальная проверка в корне репозитория:

```bash
node --test
python3 tools/check_static_site.py
python3 tools/build_pages.py
python3 tools/check_static_site.py --root _site
```

Веб-версия не запускает Node-сервер Google Sheets и не содержит ключи доступа. Для Google Sheets нужен отдельный защищённый HTTPS API; не отправляйте старую локальную библиотеку поверх более свежей рабочей Google-таблицы без сверки.

GitHub Pages и `localhost` используют разные браузерные `localStorage`/`IndexedDB`; локальные пользовательские арты не переносятся автоматически. Перед обновлением экспортируйте резервные данные.

Текущая версия — **RC**: требуются публикация и реальная приёмка Windows, GitHub Pages, IndexedDB между сессиями, Google-сервера и проверки старых тайм-тестов 2D/3D. Перед публичным репозиторием проверьте права распространения всех иллюстраций.

Неприкосновенный `v05/production/editor_manifest.json`: SHA-256 `190371ce21046ba4530b9cb93b374292645218f4fcbe0a0f7e5ff0e529f5529f`.
