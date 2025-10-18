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

## Структура
- `src/` — код загрузчика, маппера, валидации, рендера и CLI.
- `templates/` — Nunjucks-шаблоны (`base.html` + partials).
- `schema/` — JSON Schema для Unified Doc JSON.
- `assets/` — CSS.
- `examples/` — примеры входных данных.

## Лицензия
MIT (по умолчанию, при необходимости поменяйте).
