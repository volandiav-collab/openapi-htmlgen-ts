# OpenAPI → HTML (Node.js/TypeScript)

Генератор HTML-документации из OpenAPI (YAML/JSON) или из унифицированного JSON-профиля (Unified Doc JSON).

## Быстрый старт
```bash
npm i
npm run dev -- examples/account-info-openapi-le.yaml --template-dir templates --output dist/index.html
# или из готового unified JSON
npm run dev -- examples/doc-unified.json --assume-unified --template-dir templates --output dist/index.html
```

## Скрипты
- `npm run dev` — запуск из исходников (tsx).
- `npm run build && npm start` — сборка и запуск из dist.
- `npm run build:binary` — сборка standalone-бинарников с помощью `pkg`.
- `npm run bundle:pkg` — сборка CJS-бандла для standalone (используется внутри `build:binary`).

## Standalone-бинарник
```bash
# установка зависимостей (однократно)
npm install

# сборка бинарников для macOS/Linux/Windows
npm run build:binary
ls dist/bin
```

В каталоге `dist/bin` появятся три исполняемых файла (`pkg-entry-macos`, `pkg-entry-linux`, `pkg-entry-win.exe`). Переименуйте их в нужный формат и запускайте без установленного Node.js, например:

```bash
mv dist/bin/pkg-entry-macos dist/bin/openapi-htmlgen
./dist/bin/openapi-htmlgen examples/medical-insured-person-v2.yaml \
  --template-dir templates \
  --output dist/index.html \
  --docx dist/medical-insured-person.docx
```

## Структура
- `src/` — код загрузчика, маппера, валидации, рендера и CLI.
- `templates/` — Nunjucks-шаблоны (`base.html` + partials).
- `schema/` — JSON Schema для Unified Doc JSON.
- `assets/` — CSS.
- `examples/` — примеры входных данных.

## Лицензия
MIT (по умолчанию, при необходимости поменяйте).
