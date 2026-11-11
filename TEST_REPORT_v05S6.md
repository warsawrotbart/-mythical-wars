# TEST REPORT — v05.6 RC / 10.11.2026

| Проверка | Результат | Ограничения |
|---|---:|---|
| Node полный набор `node --test` | **PASS 101/101** | Контейнер Linux/Node 22, без Windows |
| Контроль целостности `python tools/verify_v05_stage6.py` | **PASS 105/105** | SHA/структура/файлы, без сетевого CDN |
| Chromium v05 Stage 3 XLSX/CSV | **PASS 24/24** | about:blank, 1px images |
| Chromium v05 Stage 4 legacy, адаптирован под новый safety gate | **PASS 21/21** | Google API mocked |
| Chromium v05 Stage 5 sync protection | **PASS 23/23** | Google API mocked |
| Chromium v05 Stage 6 с оригинальными PNG | **PASS 28/28** | about:blank, исходные байты PNG как Blob; эмуляция localStorage |
| PNG KNZ-019 / KNZ-006 / KNZ-014 | **PASS 3/3** | 1024×1536, не пустые, формат PNG RGBA; изображения сохранены |
| v2.1M.2 templates browser | **PASS 10 assertions** | Изолированный Chromium |
| v2.1K.1 CHR art browser | **PASS** | Проверен fallback CHR-002 и картинки в руке, 0 JS errors |
| Старый v2.1L 2D/3D fixed clock browser | **NOT PASS** | Неустойчивость значения времени: тест ставит 22:00, потом видит 23:00 |
| Старый v2.1H WebGL full browser | **NOT PASS** | Начальные 6 проверок успешны, затем проваливается проверка 13:00/7 делений |
| Реальный HTTP Chromium на локальном 127.0.0.1 | **BLOCKED** | ERR_BLOCKED_BY_ADMINISTRATOR в test host |
| Windows PowerShell launcher | **NOT TESTED** | Нет Windows в test host |
| IndexedDB сохранение при реальной перезагрузке | **NOT TESTED** | about:blank не даёт надёжного постоянного origin |
| Google JWT Node → Google Sheets push/rollback | **NOT TESTED** | Service account доступен только владельцу |
| Опубликованный GitHub Pages | **NOT TESTED** | Неизвестен URL опубликованного сайта |
| Шрифты DejaVu на целевой Windows | **NOT TESTED** | В комплект не положены сами шрифты |

**Консервативное заключение:** v05.6 RC подготовлен и проходит все новые проверки редактора/композитора, но **финальная приёмка не закрыта**. Исторические тесты 2D/3D остаются открытым наблюдением; изменить боевые правила для их прохождения без согласования нельзя.

**Проверка визуальной близости к контрольным оригиналам:** средняя абсолютная разница RGB по полному PNG: KNZ-019 4.47, KNZ-006 3.46, KNZ-014 3.75 (канал 0–255). Это не утверждение пиксельной идентичности, но подтверждает, что реальные изображения схожи с контрольными. PNG доступны в `QA_EVIDENCE_v05S6/`.

**Ограничение Google:** реальная Google-таблица была проверена через подключённый коннектор на этапе 5; сервер `server/mw-sheets-server.cjs` через реальный service-account JSON в этой среде не запускался. Рабочие данные не изменялись.
