# MW — CURRENT: передача разработки анимаций

Обновлено 16.11.2026. Пользователь требует после каждой задачи показывать оставшиеся этапы и сохранять передачу для нового чата. Не считать предложения утверждёнными игровыми правилами.

## Текущий результат

1. T01 аудит завершён.
2. Контракт/очередь и простой розыгрыш установлены efda3eaaedb0fc0120de60682ae421cc94009af8.
3. Стабильные DOM-экземпляры, все команды игрока/ИИ и восстановление выбора установлены f875435c36bf067c5faf85c96a488683260d1c1b.
4. T04 прототип полного хода реализован поверх f875435. Точный новый commit, ссылки/хеши пакета — MW-LOG-026 в постоянном Google-журнале. Точный кодовый HEAD рабочей копии: git rev-parse HEAD. Визуальное утверждение темпа D04 ещё открыто.

Публичные GitHub main/Pages остаются baseline1b88856d94817d394ab33ededfddb2dea4995124; этапы2–4 не публиковались. Локальный commit не означает разрешения публикации.

## Этап4

battle-motion-lab.html/.css/.js — отдельный экран, ссылка Motion-прототип в боевом меню.14сцен: начало/добор/выбор/перенос/овал/подготовка/рывок/контакт/возврат/числа/конец/час/инициатива. Play/pause/seek/step/speed,14длительностей,2стиля чисел,reduced motion,экспорт JSON.

battle-motion-config.js — общие defaults, нормализация и sampler; прежние production260/320/700мс сохранены. Настройки лаборатории не применяются к реальному бою автоматически. battle-motion-scenario.js — сценарий из утверждённых примерных колод Воин, обычными командами ядра, фиксированный seed758. Нет ручной установки маны/статов/порядка колоды. Сцены считаются заранее; перемотка и повтор не вызывают ядро и RNG. Отдельный экран не пишет save текущего боя/коллекции.

Проверки:214/214Node PASS,381 static PASS,build583. Chrome: обычный play запускался до розыгрыша, затем остановлен настройкой; полный reduced дошёл до0,80/0,80с и хода соперника13:00,HP1/2 против1. Seek контакта: два−1,плашки. Длительность numbers900 и speed1,5 дали экспорт14сцен/3200мс/13:00. Исправлена потеря ввода в экспорте: параметр применяется на input. Финальная версия перезагружена и экспорт сверён; всеNode повторены. Фото и реальный скачанный JSON — docs/qa/MW_Stage4_*. Основной отчёт — docs/MW_Stage4_Motion_Prototype_Report.md.

Это прототип для оценки, не финальная приёмка всех AN/Q. Числа привязаны к двум известным участникам простого обмена без защиты/overkill; не превращать это в универсальный adapter по net-diff.

## Что осталось

7 (следующий) — T14–T17: этапы хода/таймер/часы,окончательная подачаИИ,overflow/fatigue.
8 — T18–T20: ресурсыVFX,адаптивность,reduced-motion/recovery всех сцен.
9 — T21–T24: интеграция,регрессия,устройства/браузеры,финал.
D04 темп/стиль прототипа требует визуальной приёмки. D05 устройства не утверждены.

## Источники и незакрытые решения

Актуальное ТЗ: https://docs.google.com/document/d/11IrO-VbDSetrU8EwKcoDpslu2O4b-3Kj/edit . Читать приложение решений перед прежними альтернативами: часы слева; готовый овал; фактический урон, отдельно HP/броня; точки накапливаются. D03 старт/сброс/восстановление точек ещё требуют решения. Лаборатория показывает только час/указатель, не новую норму точек.

Правила:1OASn6ccVzBsBOUT6LUa3K0PI9VBu2Af_XU1i7KoKwgg; библиотека:1R8VdNxiRgrvQLbToHcegzOGVNaUPEFxauaGS21ZZfFU. Порядок источников и статусы из пользовательского AGENTS.md обязательны. Не менять цены/статы/тексты/правила самостоятельно.

Не закрывать T01 overkill/checkEnd/timeMode/hitbox без отдельной проработки. Этап3 не завершил весь T03/AN15. Старые side-panel перекрытия не исправлены. Нет приёмки полного BF12/Q01–Q15, FPS/mobile/live3D. Gameplay save приватен; не отдавать его как публичный event stream.

## Постоянная передача

Google-журнал CURRENT: https://docs.google.com/document/d/18rHnUFzKSlCcZzfjRcVhyk-9gGRgz-DZjpzB1Yzy7-A/edit . Читать MW-LOG-026 и отчёт этапа4, затем TASK_JOURNAL. Папка «ТЗ и задачи»:1uCSJjcCW8akorcn6IY0KaMIFtL0W2OsL. Пакет Stage4 содержит incremental поверх f875435 и cumulative поверх1b88856, README и hashes. Не применять оба патча подряд; проверять HEAD и свои незакоммиченные изменения. Патч2 уже установлен, не накатывать повторно.

Для просмотра: python tools/build_pages.py; python -m http.server 8000 --directory _site; открыть http://localhost:8000/battle-motion-lab.html. После каждой задачи обновить этот файл/TASK_JOURNAL/Google-журнал и показать оставшиеся этапы.


## Повторная QA этапа4 — MW-LOG-027,16.11.2026

Каталогmw-auditнедоступен;изпроверенногоStage4ZIPиmain1b88856восстановленточныйcommit0d4e38dbf21fdd16af3ba6cde22782369a9fd63e. Новаякопия:/workspace/scratch/e491f224769e/mw-stage4-check. Пакетсhashesсошёлся,накопительныепатчи2–4применены. Коднепереписывался.

214/214NodePASS,381staticPASS,build583. Chromeполныйобычныйplayдоконца4.52/4.52→opponent13:00/mana1/2;паузафиксирует12мс;seekcontact2числа−1;numbers900/speed1.5/badge→реальныйJSON14сцен/end3200/hour13. Всекартинкизагружены,errorhidden. D04визуальнаяприёмкаиобщаяQAнеобъявляютсязакрытыми.

СлужебныйQAотчёт:docs/MW_Stage4_QA_Review.md,снимокиJSONвdocs/qa/MW_Stage4_Review*. ИгровойHEADпо-прежнему0d4e38d,служебныефайлыпокаnotcommitted. ПостоянныйQAпакетиссылки—MW-LOG-027. Никакойпубликации/новогоигровогопатчанет. Следующийэтап5;остались5–9,показыватьихпослекаждойзадачи.


## Этап 5 — текущее состояние, MW-LOG-028

Реализован T05–T09 поверх 0d4e38dbf21fdd16af3ba6cde22782369a9fd63e. Рабочая копия /workspace/scratch/e491f224769e/mw-stage4-check. Точный commit — git rev-parse HEAD; постоянные ссылки и SHA256 пакета — MW-LOG-028. Служебные файлы повторной QA этапа 4 включены, не потеряны.

Новые battle-hand-motion.js/.css подключены в index.html. Превью — фиксированный BODY-портал; hover/focus не двигает hit-область. Для текущего battlefield необходимо правило с #myHand, иначе прежний hover translateY(-35px)/scale переопределяет его. Native drag сохраняет точку захвата; accepted flight продолжается из release point, отмена возвращает карту без оплаты. Click → временный gap → effect/target при необходимости. При 7 существах gaps нет.

playCard получил шестой необязательный position; проверка до оплаты, прямой summon вставляет splice. Прежние вызовы/порядок токенов сохранены. WeakMap captureCardMovements наблюдает фактическое добавление в руку, не меняет snapshot/RNG. Presentation публикует cardDrawn/cardCreated с источником; чужие UID/cardId/faces скрыты. Sidecar выбора хранит позицию. Motion прячет новые hand destinations до последовательного прибытия, превращает full в существующий boardPortrait, двигает соседей FLIP, чистится при abort; 3D оставлен на прежнем render path.

226/226 Node, 383 static PASS, build585, diff-check PASS. Chrome: старт3/замена, Escape без оплаты, native invalid/valid drop, вставки слева и между; два добора писаря; reload/resume; replay13 actions/turn9/hash29a77bb2. Финальный порядок [u25,u30,u21,u15], mana3/5, hand8/deck18, busy снят/ghosts0. Hover DOMRect до/после одинаков. Скриншот, browser evidence и лог в docs/qa/MW_Stage5_*. Отчёт docs/MW_Stage5_Hand_Cards_Report.md.

Никакого push/deploy. Ни новых карт/артов, ни правок цены/статов/текстов/правил. Визуальная приёмка пользователем ещё не выполнена. Полная Q/BF матрица, mobile/touch/live3D/FPS остаётся на этапах8–9; для Q01 не выдавать несколько проверенных рук за всю матрицу1/3/7/10. В консоли существующий font network fallback. D03/D04/D05 и прежние T01 вопросы открыты.

Следующий этап 6. Остались 6–9; после каждой задачи показывать их и сохранять передачу.


## Этап 6 — MW-LOG-029, актуальное продолжение

База 8fcfccb5a3f6322239c4c9f95a02fc889ca21358. T10–T13 реализованы для текущего 2D-боя в объёме docs/MW_Stage6_Combat_Report.md. Точный commit — git rev-parse HEAD, постоянная поставка/хеши — MW-LOG-029. Работа в /workspace/scratch/e491f224769e/mw-stage4-check. Публикации нет.

captureCombat — внешний WeakMap, snapshots только открытого поля/HUD, без рук/колод/RNG. combatStep в presentation; damage/impactBatch/healing/attributes/creatureEntered/creaturesDied/deathrattle/weapon/power/attackConsumed. Устаревший UI net-diff отключён. applyCombatSnapshot не меняет авторитетный game; battleCard принимает визуальный state. Подготовка/рывок/контакт/числа/возврат двигают фишку или портрет, не весь HUD. Общий attackStatus используется ядром и целями UI.

По правилам0.6 исправлены actual hero damage без overkill, защита перед бронёй/HP, один двусторонний combat packet, волны смертей и очередь активный→противник/слева направо, итог команды после последствий. Новые карточные параметры/тексты/арт не вводились. Старые реплеи в затронутых исправлениями случаях могут не совпасть по checksum; хранить прежний commit для истории.

244/244 Node PASS; build589; static385 PASS; diff-check PASS. Chrome: натуральная атака1/3; controlled QA через battle-combat-qa.html (debugged=true, данные карт исходные, прежний save в backup). Броня героя10→6 при HP30, weapon2→1; обмен3/2 в Злыдня1/2, хрипгерой30→29; power10→8mana/1token/used; КотБаюн три simultaneous actual1/4/1 затем одна смертьгруппа3; следующий удар weapon1→поломка, герой28. Replay18 actions/turn5/a4d8f7b6. После UIисправления reload/resume +Сцяганосецmana8/10/cancelhidden; финальный replay19 actions/turn5/0f5446e4, actors0/numbers0/busyfalse.

Chooser при попытке импорта QAJSON завис и прерван, не повторять такой вызов: использовать QA-страницу. Браузерный JPEG массового контакта имеет лаг кадра; числа1/4/1 доказаны DOM в JSON, не заявлять их видимыми в JPEG. Скриншоты/JSON/лог docs/qa/MW_Stage6_*. Существующий font network fallback; новых queue errors не было.

Открыто: legacyRebirth ещё НЕ канон0.6 (нет полного death→rattle→base-reset-return). Не утверждать его корректность. Возврат с поля/overflow/T17, полный порядок всех составных эффектов/обобщённая фаза Ловушек, recovery/mobile/live3D/FPS/визуальная приёмка ещё требуют работ. Конкретные расхождения не превращать в новые правила. D03/D04/D05 открыты. Этап6 не означает полное закрытие всех Q/BF.

Следующий этап7. Остались7–9; после каждой задачи показывать остаток и сохранять передачу. Локальный commit не означает публикации.


## Этапы7–8 — актуальное продолжение, 17.11.2026 / MW-LOG-031

Рабочая копия восстановлена в /workspace/scratch/e491f224769e/mw-stage78 из public1b88856 и проверенного накопительного пакета этапа6. Получен ТОЧНЫЙ f62f721b34d2ae989858f51e553da34cbefa0652, затем заново реализованы7–8. MW-LOG-030 описывает прерванный сеанс, НЕ текущую готовую поставку. Финальный commit — git rev-parse HEAD и README поставки. Push/deploy не выполнялись.

Актуальный отчёт: docs/MW_Stage78_Report.md; доказательства docs/qa/MW_Stage78_Browser_Evidence.json,MW_Stage78_Review.jpg,MW_Stage78_Test_Log.txt,stage78_engine_profile.json.260/260 Node,390 static,596 build PASS.100 engine-боёв/2172хода/100 replay PASS. Браузер:5 recovery modes PASS; таймер сохраняется/отменяет непринятое размещение без оплаты; offline и SIMULATED visibility PASS;20 viewport fixtures PASS. Натуральный уход в фон не принят: управляемый target не сообщил hidden. Не выдавать симуляцию за натуральный background. rAF40.22/с в коротком on-screen сценарии, НЕ GPU FPS и НЕ целевая приёмка; CPU bot-turn P95~2.464мс.

Новые модули: battle-turn-timer.js, battle-turn-motion.js/.css, battle-motion-runtime.js, battle-motion-accessibility.css, battle-motion-qa.html/.js. Таймер optional90s, sidecar, паузы mandatory/hidden/offline, периодический save1s+pagehide. End-chain resolve до часа, expiredmana0, clock forward, очередь событий. discarded отдельно от гибели; fatigue/cappedarmor; возврат primitive без включения CHR-017. Runtime: resource1500ms/cap32/cancelAll, клип preview, фокус/Reduce motion. botStepper продолжает тот же iterator после паузы. Карточные определения (цена/статы/тексты эффектов), каталог/арт/manifest не менялись; исправлена реализация сроков поджога по правилам0.6.

Следующий этап9/T21–T24. Открыты D03/D04/D05; legacyRebirth/NEU-028/timeMode/multiplier, полный школьный арт, натуральный background/native drag-resize, другиебраузеры/DPR/devices/GPU. Подробности статусовT14–T20 в отчёте — не заявлять полную художественную/платформенную приёмку. Финальная поставка содержит два АЛЬТЕРНАТИВНЫХ патча с проверкой точного HEAD на чистых базах. Не применять оба/повторно. Постоянные ссылки и SHA256 ZIP — MW-LOG-031.
