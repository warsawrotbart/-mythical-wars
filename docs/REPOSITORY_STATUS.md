# Состояние репозитория — 18.11.2026

Репозиторий: warsawrotbart/-mythical-wars. Рабочая ветка: main. Проверенный HEAD до уборки: `d963b45290851c1a25e96aa5e96d88c63b53d0b2`. Открытых PR при проверке: 0.

## Снимок исторических веток перед уборкой

Все 23 вершины ниже проверены через GitHub compare: merge-base совпал с вершиной каждой ветки; все являются предками main. Уникальных неперенесённых коммитов нет. Это исторический снимок для восстановления имён, а не список текущих веток. При удалении указателей коммиты остаются достижимыми через main; историю main не переписывать.

| Историческая ветка | Полный SHA |
|---|---|
| `backup/pre-v05-12-1-2026-11-11` | `4161691666cccb71574f2acac824f8f1f680e0c5` |
| `backup/pre-v05-12-2026-11-11` | `6f3ee7f88b02047b614903a7d2d0373da7bd0be7` |
| `backup/pre-v05-13-1-card-polish-2026-11-11` | `f9c045b79dce75d38927d65c4dabc3a424ce0fb7` |
| `backup/pre-v05.13-stage-b-2026-11-11` | `ae52736ca8181f69a909bc3d8786e76792bd6f17` |
| `backup/pre-v05.14-stage1-2026-11-11` | `6cdfe5579c453ddc2ada26f04ac01f5afba79bee` |
| `backup/pre-v05.14-stage2-2026-11-11` | `366619cb93d71fe3cf88351decc8703bf161bf2f` |
| `backup/pre-v05.14-stage3-6-2026-11-11` | `5dd9f779fce7e39de80cd20c4c905c2cee1272e0` |
| `backup/pre-v05.15-editor-readability-2026-11-11` | `a79b824c14cad824e7d1ae1de7e885c9cc389c6b` |
| `backup/pre-v05.16-new-arena-2026-11-11` | `415c22ebddeaeaaaad41c49c889f468dba74b498` |
| `backup/pre-v05.17-art-import-2026-11-11` | `1b21592a09f9c39e6fcc9bd07dd42b2e145fc5ad` |
| `backup/pre-v05.17-art-integration-2026-11-11` | `1b21592a09f9c39e6fcc9bd07dd42b2e145fc5ad` |
| `feature/battlefield-v02` | `f3e87883ce6340c3ad6f2560968a518ea063f5ed` |
| `release/v05.12.1-editor-ui` | `ae52736ca8181f69a909bc3d8786e76792bd6f17` |
| `release/v05.13-stage-b-2026-11-11` | `f9c045b79dce75d38927d65c4dabc3a424ce0fb7` |
| `release/v05.13.1-card-visual-polish` | `6cdfe5579c453ddc2ada26f04ac01f5afba79bee` |
| `release/v05.14-stage1-minion-portraits` | `366619cb93d71fe3cf88351decc8703bf161bf2f` |
| `release/v05.14-stage2-tokens-status` | `5dd9f779fce7e39de80cd20c4c905c2cee1272e0` |
| `release/v05.14-stage3-6-hand-gameplay` | `a79b824c14cad824e7d1ae1de7e885c9cc389c6b` |
| `release/v05.15-editor-readability` | `415c22ebddeaeaaaad41c49c889f468dba74b498` |
| `release/v05.16-new-arena-hud-bot` | `1b21592a09f9c39e6fcc9bd07dd42b2e145fc5ad` |
| `release/v05.17-art-integration` | `1b21592a09f9c39e6fcc9bd07dd42b2e145fc5ad` |
| `release/v05.17-art-integration-coin` | `60227575a2a9044bac6a683dbe6d56c996829781` |
| `release/v05.17-art-registry-and-coin` | `1b21592a09f9c39e6fcc9bd07dd42b2e145fc5ad` |

Восстановление исторического указателя при необходимости: `git branch ИМЯ_ИЗ_ТАБЛИЦЫ SHA_ИЗ_ТАБЛИЦЫ`, затем при необходимости `git push origin ИМЯ_ИЗ_ТАБЛИЦЫ`.

## Структура

- README.md — единая текущая инструкция; WORK_CONTEXT.md — передача разработки.
- docs/README.md — навигация по текущим и историческим отчётам.
- Старые runtime JS/CSS не перемещались: index.html использует файлы нескольких версий совместно.
- Старые отчёты сохранены на прежних путях; их даты и статусы не приравниваются к текущему состоянию.
- _site и 41 извлекаемый ресурс поля — генерируемые файлы. Manifest/chunks исходного набора отслеживаются Git.
- Уборка не изменяет библиотеку карт, состав колод, правила и данные браузера. Проблема Чернокнижника остаётся открытой, см. WORK_CONTEXT.md.
