# Руководство разработчика по проекту `openapi-htmlgen-ts`

## 1. Общая информация
Генератор преобразует входящий OpenAPI (YAML/JSON) или уже нормализованный Unified Doc JSON в HTML-документацию. Дополнительно умеет собирать DOCX (через Pandoc) и копировать статические ассеты рядом с HTML. Проект написан на TypeScript, запускается через Node.js.

## 2. Требования и подготовка окружения
- Node.js ≥ 18 (ESM-модули, `type: "module"`).
- npm ≥ 9.
- Для DOCX-экспорта — установленный `pandoc` в PATH.
- ОС: разработка проверена на macOS/Linux; на Windows требуется поддержка UTF-8 в консоли.

Установка зависимостей:

```bash
npm install
```

## 3. Сценарии npm
- `npm run dev -- <input>` — запуск CLI напрямую из исходников через `tsx` (горячие изменения без сборки).
- `npm run build` — компиляция в `dist/`.
- `npm start -- <input>` — запуск собранной версии (`node dist/cli.js`).
- `npm run lint` — заглушка (при необходимости добавить ESLint/форматирование).

## 4. Основной конвейер
**CLI (`src/cli.ts`)**
- Парсинг аргументов (`commander`), резолв путей с учётом `INIT_CWD`.
- Опция `--assume-unified` для прямой работы с Unified JSON; иначе выполняется маппинг OpenAPI → Unified.
- Валидация входных данных через JSON Schema.
- Рендеринг HTML и (опционально) DOCX.

**Загрузка (`src/loader.ts`)**
- Чтение YAML/JSON (используется `js-yaml`).
- `loadOpenAPI` возвращает объект OpenAPI спецификации.
- `loadUnifiedJson` работает как с JSON, так и с YAML-универсалом.

**Маппинг (`src/mapper.ts`)**
- Конвертация OpenAPI 3.x в структуру Unified.
- Вытягивает параметры, тела запросов, ответы, схемы, usage docs.
- Опция `--include-nested` добавляет вложенные свойства схем в `children`.

**Типы (`src/types.ts`)**
- Строго описывает Unified модель (meta, intro, resources, components, examples).

**Валидация (`src/validate.ts`)**
- Использует `Ajv2020` и схему `schema/unified_doc.schema.json`.
- При ошибках бросает исключение со списком нарушений.

**HTML-рендер (`src/render.ts`)**
- Nunjucks (`templates/base.html` + партиалы).
- Добавлены фильтры `markdown`, `markdownInline`, `markdownWithoutHeading`, `json`.
- Копирует `assets/` и каталог из `--static-dir` к результату.

**DOCX-рендер (`src/docx.ts`)**
- Инлайнинг CSS, подготовка таблиц и кодовых блоков для Word.
- Переписывает `<img>` в абсолютные `file://` URL.
- Вызывает `pandoc` для конверсии в DOCX, поддерживает шаблон (`--docx-template`).

## 5. Структура проекта
```
src/                 исходный код (cli, loader, mapper, render, docx, validate, types)
templates/           Nunjucks-шаблоны:
  base.html          основной layout
  partials/*.html    секции: intro, overview, resources, components, compliance, changelog
assets/styles.css    базовая тема оформления
schema/              JSON Schema для Unified Doc
examples/            примеры OpenAPI, unified JSON и статические markdown-документы
dist/                результаты сборки (gitignore)
```

## 6. Аргументы CLI
```bash
npm run dev -- <input> \
  [--assume-unified] \
  [--template-dir templates] \
  [--schema schema/unified_doc.schema.json] \
  [--output dist/index.html] \
  [--static-dir static] \
  [--docx docs/output.docx] \
  [--docx-style assets/styles.css] \
  [--docx-template examples/template.dotx] \
  [--include-nested]
```
- `<input>` — путь к OpenAPI YAML/JSON или Unified JSON.
- `--static-dir` можно отключить, передав `--static-dir false`.
- Путь может быть относительным: CLI проверяет `process.cwd()` и `INIT_CWD`.
- `--docx-style` допускает несколько значений (повторное указание флага).
- `--include-nested` раскрывает вложенные свойства в таблицах компонентов.

## 7. Шаблоны и кастомизация
- Основной файл `templates/base.html` собирает секции через `{% include %}`.
- Партиалы разбиты по смыслу (`templates/partials/...`), что упрощает добавление секций.
- Можно передать собственный каталог шаблонов через `--template-dir`.
- Фильтры Nunjucks:
  - `markdown`: преобразование markdown → HTML.
  - `markdownWithoutHeading`: markdown без первого заголовка (удобно для описаний).
  - `markdownInline`: inline-рендер для коротких описаний.
  - `json`: форматированный JSON (`{{ obj | json(2) }}`).

## 8. Работа с CSS и статикой
- Основные стили лежат в `assets/styles.css`; каталог копируется рядом с HTML.
- Дополнительные ассеты из `--static-dir` также копируются к результату.
- Для DOCX изображения ищутся в директориях: каталог спецификации, `--static-dir`, `assets/`, директория результата.

## 9. Unified Doc JSON
- Схема: `schema/unified_doc.schema.json`.
- Основные разделы (см. `src/types.ts`):
  - `meta`: заголовок, версия, дата, организация, код документа.
  - `intro`: назначение, аудитория, термины.
  - `api_overview`: сервера, схемы безопасности, теги.
  - `resources`: эндпоинты, сгруппированные по тегам (`UnifiedResource` → `UnifiedEndpoint`).
  - `components`: схемы, groupedSchemas (request/response/object/enum), списки enum.
  - `compliance`: стандарты, контроль безопасности.
  - `change_log`: истории релизов.
- Маппер наполняет `usageExamples`, `examples`, `groupedSchemas` и др. полями, чтобы шаблоны могли отобразить данные без дополнительной обработки.

## 10. DOCX-пайплайн
- `renderDocxFromHtml`:
  1. Инлайнинг CSS-файлов (`--docx-style`).
  2. Пометка широких таблиц и оборачивание их в `div.landscape-section`.
  3. Форматирование JSON-блоков, добавление инлайновых стилей таблицам и коду.
  4. Переписывание путей к изображениям в абсолютные `file://` URL (`resolveAssetPath`).
  5. Проверка наличия `pandoc`; при отсутствии выбрасывает ошибку с подсказкой.
- Опционально принимает DOCX-шаблон (`--docx-template` или `--docx-reference`).

## 11. Разработка и отладка
- Для быстрого цикла правок используйте `npm run dev` — компиляция не требуется.
- Проверяйте HTML-вывод, открывая файл из `dist/` в браузере.
- Для диагностики DOCX сохраняйте промежуточный HTML (в проекте есть `debug-docx-*.xml` для сравнения).
- При ошибках Pandoc убедитесь, что бинарник доступен и совместим с вашей ОС.

## 12. Тестовые данные
- В `examples/`:
  - OpenAPI спецификации (`*.yaml`).
  - `doc-unified.json` — пример Unified JSON.
  - Markdown-документы (используются через `externalDocs`).
- Быстрый пример (из README):
  ```bash
  npm run dev -- examples/doc-unified.json --assume-unified --template-dir templates --output dist/index.html
  ```

## 13. Поддержка и развитие
- При изменении модели Unified обновляйте:
  1. `src/types.ts`;
  2. `schema/unified_doc.schema.json`;
  3. Шаблоны в `templates/`;
  4. Маппинг (`src/mapper.ts`) и обработку `renderHtml` при необходимости.
- Перед релизом: `npm run build` + генерация документа на реальных спецификациях.
- Рассмотрите автоматические тесты (snapshot HTML, Ajv-валидация, smoke-тест CLI).

## 14. FAQ / типовые проблемы
- **Пути не находятся:** уточните рабочую директорию; CLI пробует `process.cwd()` и `INIT_CWD`. Используйте абсолютные пути при сложных структурах.
- **Markdown не рендерится:** убедитесь, что шаблон применяет фильтр `markdown`.
- **DOCX без стилей/изображений:** проверьте `--docx-style`, наличие Pandoc и корретность путей к ассетам.
- **Валидация падает:** входной JSON не соответствует `schema/unified_doc.schema.json`; Ajv сообщает путь до проблемного узла.

## 15. Сборка standalone бинарников
- Для сборки требуется dev-зависимость `pkg` (`npm install` подтянет её автоматически).
- Скрипт `npm run build:binary` компилирует TypeScript и создаёт бинарники для `node18` (macOS, Linux, Windows) в `dist/bin/`.
- Пример запуска:
  ```bash
  npm run build:binary
  ls dist/bin
  ```
- Под капотом команда вызывает `npm run bundle:pkg`, который через `esbuild` собирает CommonJS-бандл в `dist-pkg/cli.js`.
- `pkg` использует мост `pkg-entry.cjs`, который требует `dist-pkg/cli.js`; не удаляйте файл при рефакторинге сборки.
- Полученные файлы (по умолчанию `pkg-entry-*`) можно переименовать и распространять без Node.js. Внутри бинарника уже упакованы шаблоны, стили и схема.

---

Документ можно держать рядом с README (`DEVELOPER_GIDE.md`). Обновляйте его при добавлении новых опций CLI, структур Unified или шаблонов.
