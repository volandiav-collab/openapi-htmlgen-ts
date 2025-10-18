import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
// Подмешивает содержимое CSS-файлов прямо в HTML, чтобы Pandoc видел все стили.
function inlineStylesForDocx(html, stylePaths) {
    if (!stylePaths.length)
        return html;
    const cssParts = [];
    for (const stylePath of stylePaths) {
        if (!stylePath)
            continue;
        try {
            if (fs.existsSync(stylePath)) {
                cssParts.push(fs.readFileSync(stylePath, 'utf-8'));
            }
        }
        catch (err) {
            console.warn(`[docx] failed to read CSS ${stylePath}:`, err);
        }
    }
    if (!cssParts.length)
        return html;
    const styleTag = `<style>\n${cssParts.join('\n')}\n</style>`;
    const cleaned = html.replace(/<link[^>]+rel=["']stylesheet["'][^>]*>/gi, '');
    if (cleaned.includes('</head>')) {
        return cleaned.replace('</head>', `${styleTag}\n</head>`);
    }
    return `${styleTag}\n${cleaned}`;
}
// Отмечает широкие таблицы дополнительными классами и оборачивает их в блоки landscape.
function markWideTablesForDocx(html) {
    return html.replace(/<table\b[^>]*>[\s\S]*?<\/table>/gi, tableHtml => {
        if (/\blandscape-table\b/.test(tableHtml))
            return tableHtml;
        const headerMatch = tableHtml.match(/<thead[\s\S]*?<\/thead>/i);
        const headerSource = headerMatch ? headerMatch[0] : tableHtml;
        const thCount = (headerSource.match(/<th\b/gi) ?? []).length;
        const tdCount = (tableHtml.match(/<td\b/gi) ?? []).length;
        if (thCount >= 6 || tdCount >= 24) {
            const updatedTable = tableHtml.replace(/<table\b([^>]*)>/i, (match, attrs) => {
                if (/\bclass=/.test(attrs)) {
                    return match.replace(/class=(["'])(.*?)\1/i, (_m, quote, value) => `class=${quote}${value} landscape-table${quote}`);
                }
                return `<table class="landscape-table"${attrs}>`;
            });
            return `<div class="landscape-section">${updatedTable}</div>`;
        }
        return tableHtml;
    });
}
// Расшифровывает HTML-сущности обратно в обычные символы.
function decodeHtmlEntities(text) {
    return text
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&');
}
// Ищет блоки кода с JSON и переформатирует их в читабельный вид.
function formatJsonBlocks(html) {
    return html.replace(/<code([^>]*)>([\s\S]*?)<\/code>/gi, (match, attrs, content) => {
        if (/class\s*=\s*(["']).*?(language-json|json).*?\1/i.test(attrs)) {
            return match;
        }
        const decoded = decodeHtmlEntities(content.replace(/<br\s*\/?>(\r?\n)?/gi, '\n'));
        const trimmed = decoded.trim();
        if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
            return match;
        }
        try {
            const jsonValue = JSON.parse(trimmed);
            const formatted = JSON.stringify(jsonValue, null, 2);
            const escaped = escapeHtml(formatted);
            return `<pre><code class="language-json">${escaped}\n</code></pre>`;
        }
        catch {
            return match;
        }
    });
}
// Добавляет инлайновые стили к таблицам и ячейкам, чтобы Word сохранял оформление.
function inlineTableStylesForDocx(html) {
    const tableStyle = 'border:1pt solid #344054;border-collapse:collapse;width:100%;';
    const cellStyle = 'border:1pt solid #344054;padding:8px;vertical-align:top;';
    return html
        .replace(/<table\b([^>]*)>/gi, (match, attrs) => {
        let updated = attrs;
        if (/style=/i.test(attrs)) {
            updated = updated.replace(/style=(["'])(.*?)\1/i, (_m, quote, value) => `style=${quote}${value};${tableStyle}${quote}`);
        }
        else {
            updated += ` style="${tableStyle}"`;
        }
        if (!/border=/i.test(updated)) {
            updated += ' border="1"';
        }
        if (!/data-tbl-style=/i.test(updated)) {
            updated += ' data-tbl-style="Normal Table"';
        }
        return `<table${updated}>`;
    })
        .replace(/<t(h|d)\b([^>]*)>/gi, (match, tag, attrs) => {
        if (/style=/i.test(attrs)) {
            return match.replace(/style=(["'])(.*?)\1/i, (_m, quote, value) => `style=${quote}${value};${cellStyle}${quote}`);
        }
        return `<t${tag}${attrs} style="${cellStyle}">`;
    });
}
// Подыскивает реальный путь к ресурсу изображения среди заданных директорий.
function resolveAssetPath(src, assetDirs) {
    const normalized = src.split('#')[0]?.split('?')[0] ?? src;
    if (!normalized)
        return null;
    const candidates = [];
    if (path.isAbsolute(normalized)) {
        candidates.push(normalized);
    }
    else {
        candidates.push(path.resolve(normalized));
        for (const dir of assetDirs) {
            candidates.push(path.resolve(dir, normalized));
        }
    }
    for (const candidate of candidates) {
        try {
            if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
                return candidate;
            }
        }
        catch {
            /* ignore */
        }
    }
    return null;
}
// Делает источники картинок абсолютными file:// URL, чтобы Pandoc их нашёл.
function rewriteImageSources(html, assetDirs) {
    return html.replace(/<img\b([^>]*?)src=(["'])(.+?)\2([^>]*?)>/gi, (full, before, quote, src, after) => {
        const trimmed = src.trim();
        if (!trimmed || /^data:|^https?:|^\/\/|^mailto:/i.test(trimmed)) {
            return full;
        }
        const resolved = resolveAssetPath(trimmed, assetDirs);
        if (!resolved) {
            console.warn(`[docx] image not found: ${src}`);
            return full;
        }
        console.debug(`[docx] image resolved: ${src} -> ${resolved}`);
        const fileUrl = pathToFileURL(resolved).href;
        return `<img${before}src=${quote}${fileUrl}${quote}${after}>`;
    });
}
// Проверяет наличие исполнимого pandoc в PATH.
function ensurePandoc() {
    const result = spawnSync('pandoc', ['-v'], { stdio: 'ignore' });
    if (result.status !== 0) {
        throw new Error('Pandoc not found. Install pandoc (https://pandoc.org/) to enable DOCX generation.');
    }
}
// Экранирует специальные символы для безопасного включения в HTML.
function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
// Преобразует заголовки H2-H6 в более высокие уровни, чтобы документ начинался с H1.
function liftHeadingLevels(html) {
    return html.replace(/<(\/?)h([2-6])([^>]*)>/gi, (_match, slash, level, attrs) => {
        const numeric = Number.parseInt(level, 10);
        const newLevel = Math.max(1, numeric - 1);
        const suffix = slash ? '' : attrs;
        return `<${slash}${`h${newLevel}`}${suffix}>`;
    });
}
let cachedDocxStyles = null;
// Подтягивает CSS для DOCX из кастомного файла или использует дефолт.
function getDocxStyles() {
    if (cachedDocxStyles !== null) {
        return cachedDocxStyles;
    }
    const defaultStyles = `
body { font-family: "Arial", "Calibri", "Segoe UI", sans-serif; font-size: 12pt; line-height: 1.5; color: #000000; margin: 0; }
h1 { font-size: 14pt; color: #000000; margin: 24pt 0 12pt; font-weight: 700; }
h2 { font-size: 14pt; color: #000000; margin: 18pt 0 10pt; font-weight: 600; }
h3 { font-size: 14pt; color: #000000; margin: 14pt 0 8pt; font-weight: 600; }
p { margin: 0 0 12pt; text-align: justify; }
ul, ol { margin: 0 0 10pt 18pt; }
li { margin-bottom: 4pt; }
strong { font-weight: 600; }
em { font-style: italic; }
pre { background: #F8FAFC; border: 1px solid #CBD5E1; padding: 10px; border-radius: 6px; font-family: "Consolas", "Courier New", monospace; font-size: 10pt; white-space: pre-wrap; word-break: break-word; }
code { font-family: "Consolas", "Courier New", monospace; font-size: 10pt; background: #F3F4F6; padding: 0 2px; border-radius: 3px; }
table { font-size: 11pt; }
.docx-title { text-align: center; padding-top: 120pt; color: #000000; }
.docx-title-logo { width: 236px; height: auto; margin: 0 auto 40pt; }
.docx-title-standard { font-size: 18pt; letter-spacing: 0.08em; margin: 0 0 18pt; font-weight: 400; }
.docx-title-subtitle { font-size: 20pt; font-weight: 700; color: #0070C0; margin: 0 0 28pt; }
.docx-title-name { font-size: 28pt; font-weight: 700; margin: 0 0 48pt; }
.docx-title-docs-code { font-size: 12pt; margin: 0 0 18pt; }
.docx-title-meta { text-align: right; font-size: 14pt; margin: 48pt 0 64pt; }
.docx-title-meta p { margin: 0 0 12pt; }
.docx-title-footer { font-size: 16pt; font-weight: 700; margin: 0 0 6pt; }
.docx-toc { page-break-before: always; page-break-after: always; font-size: 12pt; color: #000000; }
.docx-toc-title { text-align: center; font-weight: 700; font-size: 16pt; margin: 0 0 24pt; }
.docx-toc-index { display: inline-block; min-width: 36pt; font-weight: 600; }
.docx-toc-item { font-size: 12pt; margin: 8pt 0; }
.docx-toc-text { display: inline-block; margin-left: 6pt; }
.docx-toc-item a { color: #000000; text-decoration: none; }
.docx-toc-item a:hover { text-decoration: underline; }
.docx-body { page-break-before: always; page-break-after: auto; }
`.trim();
    const stylePath = path.resolve('assets', 'docx-styles.css');
    try {
        const styles = fs.readFileSync(stylePath, 'utf-8').trim();
        cachedDocxStyles = styles.length ? styles : defaultStyles;
    }
    catch {
        cachedDocxStyles = defaultStyles;
    }
    return cachedDocxStyles;
}
// Собирает итоговый HTML с титульным листом, оглавлением и основным содержанием.
function wrapDocumentStructure(bodyHtml, meta) {
    const title = meta?.title ?? 'Документ';
    const version = meta?.version ? escapeHtml(meta.version) : null;
    const dateValue = meta?.date ? escapeHtml(meta.date) : null;
    const date = dateValue ?? 'XXXX-XX-XX';
    const organization = meta?.organization ? escapeHtml(meta.organization) : null;
    const docsCode = meta?.docsCode ? escapeHtml(meta.docsCode) : null;
    const city = 'Москва';
    const inferredYear = (() => {
        if (!dateValue)
            return null;
        const match = dateValue.match(/^(\d{4})/);
        if (match)
            return match[1];
        if (dateValue.includes('XXXX'))
            return 'XXXX';
        return null;
    })();
    const year = inferredYear ?? (dateValue ? new Date().getFullYear().toString() : 'XXXX');
    const baseStyles = getDocxStyles();
    return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
${baseStyles}
  </style>
</head>
<body>
  <section class="docx-title">
    <img src="assets/title-cover.png" alt="Логотип Банка России" class="docx-title-logo" />
    <p class="docx-title-standard">СТАНДАРТ БАНКА РОССИИ</p>
    <p class="docx-title-subtitle">ОТКРЫТЫЕ ПРОГРАММНЫЕ ИНТЕРФЕЙСЫ</p>
    <p class="docx-title-name">${escapeHtml(title)}</p>
    ${docsCode ? `<p class="docx-title-docs-code">Код документа: ${docsCode}</p>` : ''}
    <p class="docx-title-footer">${city}</p>
    <p class="docx-title-footer">${escapeHtml(year)}</p>
  </section>
  <p>__PAGE_BREAK__</p>
  <section class="docx-toc" style="page-break-before: always;">
    <p class="docx-toc-title">Содержание</p>
    <p>__DOCX_TOC_PLACEHOLDER__</p>
  </section>
  <section class="docx-body">
  ${bodyHtml}
  </section>
</body>
</html>`;
}
// Основной конвейер преобразования HTML в DOCX через Pandoc и постобработку.
export function renderDocxFromHtml(html, outPath, stylePaths = [], assetDirs = [], meta, templatePath) {
    // Проверяем, что pandoc доступен перед запуском конвейера.
    ensurePandoc();
    // Добавляем классы для разворота широких таблиц.
    const htmlWithLandscape = markWideTablesForDocx(html);
    // Вшиваем указанные CSS-файлы в HTML.
    const htmlWithStyles = inlineStylesForDocx(htmlWithLandscape, stylePaths);
    // Форматируем JSON-код в читаемый вид.
    const htmlWithJson = formatJsonBlocks(htmlWithStyles);
    // Добавляем инлайновые таблицы и границы для Word.
    const htmlWithInlineTableStyles = inlineTableStylesForDocx(htmlWithJson);
    // Переписываем пути к изображениям на file:// URL.
    const rewritten = rewriteImageSources(htmlWithInlineTableStyles, assetDirs);
    // Поднимаем уровни заголовков.
    const promotedHeadings = liftHeadingLevels(rewritten);
    // Оборачиваем HTML титульным листом и оглавлением.
    const htmlForPandoc = wrapDocumentStructure(promotedHeadings, meta);
    // Создаём временную директорию для промежуточных файлов.
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openapi-docx-'));
    const htmlPath = path.join(tmpDir, 'document.html');
    // Сохраняем подготовленный HTML во временный файл.
    fs.writeFileSync(htmlPath, htmlForPandoc, 'utf-8');
    if (process.env.OPENAPI_DOCX_DEBUG_HTML) {
        try {
            const debugPath = path.resolve(process.cwd(), 'debug-docx.html');
            // При отладке сохраняем копию HTML рядом с проектом.
            fs.copyFileSync(htmlPath, debugPath);
            console.debug(`[docx] wrote debug HTML to ${debugPath}`);
        }
        catch (err) {
            console.warn('[docx] failed to write debug HTML:', err);
        }
    }
    let providedTemplatePath = null;
    if (templatePath) {
        // Находим шаблон, если путь указан.
        const resolvedTemplate = resolveExistingPath(templatePath);
        if (resolvedTemplate) {
            providedTemplatePath = resolvedTemplate;
        }
        else {
            console.warn(`[docx] template not found: ${templatePath}`);
        }
    }
    let referenceDocArg = null;
    if (providedTemplatePath) {
        if (providedTemplatePath.toLowerCase().endsWith('.dotx')) {
            const templateCopyPath = path.join(tmpDir, 'reference-template.docx');
            try {
                // Копируем .dotx во временную директорию, чтобы Pandoc мог его прочитать.
                fs.copyFileSync(providedTemplatePath, templateCopyPath);
                referenceDocArg = templateCopyPath;
            }
            catch (err) {
                console.warn(`[docx] failed to copy template ${providedTemplatePath}:`, err);
            }
        }
        else {
            referenceDocArg = providedTemplatePath;
        }
    }
    const pandocArgs = [
        '--quiet',
        '--from', 'html',
        '--output', outPath
    ];
    if (referenceDocArg) {
        console.debug(`[docx] using reference template: ${referenceDocArg}`);
        pandocArgs.push('--reference-doc', referenceDocArg);
    }
    pandocArgs.push(htmlPath);
    // Конвертируем HTML в DOCX через Pandoc.
    const result = spawnSync('pandoc', pandocArgs, { stdio: 'inherit' });
    if (result.status !== 0) {
        throw new Error(`Pandoc failed with exit code ${result.status ?? 'unknown'}`);
    }
    try {
        // Настраиваем таблицы и стили уже в готовом DOCX.
        applyTableStyling(outPath, providedTemplatePath ?? null);
    }
    catch (err) {
        console.warn('[docx] failed to post-process DOCX tables:', err);
    }
    // Удаляем временные файлы.
    fs.rmSync(tmpDir, { recursive: true, force: true });
}
// Проверяет наличие указанного файла и возвращает абсолютный путь при успехе.
function resolveExistingPath(candidate) {
    if (!candidate)
        return null;
    try {
        const resolved = path.resolve(candidate);
        if (fs.existsSync(resolved)) {
            return resolved;
        }
    }
    catch {
        /* ignore */
    }
    return null;
}
// Распаковывает DOCX, дополняет его XML и собирает архив обратно.
function applyTableStyling(docxPath, templatePath) {
    const extractDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openapi-docx-unzip-'));
    try {
        // Распаковываем DOCX как zip-архив.
        const unzip = spawnSync('unzip', ['-qq', docxPath, '-d', extractDir]);
        if (unzip.status !== 0) {
            throw new Error(`unzip exited with code ${unzip.status}`);
        }
        const docXmlPath = path.join(extractDir, 'word', 'document.xml');
        let docXml = fs.readFileSync(docXmlPath, 'utf-8');
        if (process.env.OPENAPI_DOCX_DEBUG_XML) {
            try {
                fs.writeFileSync(path.resolve(process.cwd(), 'debug-docx-before.xml'), docXml, 'utf-8');
            }
            catch (err) {
                console.warn('[docx] failed to write debug XML (before):', err);
            }
        }
        if (templatePath) {
            try {
                // Подмешиваем содержимое reference-шаблона в рабочую копию DOCX.
                applyTemplateFiles(extractDir, templatePath);
            }
            catch (err) {
                console.warn('[docx] failed to apply template files:', err);
            }
        }
        // Приводим границы таблиц к заданному виду.
        docXml = injectTableBorders(docXml);
        if (process.env.OPENAPI_DOCX_DEBUG_XML) {
            try {
                fs.writeFileSync(path.resolve(process.cwd(), 'debug-docx-after-tables.xml'), docXml, 'utf-8');
            }
            catch (err) {
                console.warn('[docx] failed to write debug XML (after tables):', err);
            }
        }
        // Подставляем разрывы страницы вместо текстовых маркеров.
        docXml = insertPageBreak(docXml);
        // Чистим лишнее форматирование заголовков в документе.
        docXml = applyHeadingStyling(docXml);
        // Вставляем автоматическое оглавление вместо плейсхолдера.
        docXml = replaceTocPlaceholder(docXml);
        if (process.env.OPENAPI_DOCX_DEBUG_XML) {
            try {
                fs.writeFileSync(path.resolve(process.cwd(), 'debug-docx-after.xml'), docXml, 'utf-8');
            }
            catch (err) {
                console.warn('[docx] failed to write debug XML (after):', err);
            }
        }
        fs.writeFileSync(docXmlPath, docXml, 'utf-8');
        try {
            // Корректируем размеры заголовков в styles.xml.
            applyHeadingStyleDefinitions(extractDir);
        }
        catch (err) {
            console.warn('[docx] failed to adjust heading styles:', err);
        }
        fs.unlinkSync(docxPath);
        // Запаковываем обновлённое содержимое обратно в DOCX.
        const zip = spawnSync('zip', ['-qry', docxPath, '.'], { cwd: extractDir });
        if (zip.status !== 0) {
            throw new Error(`zip exited with code ${zip.status}`);
        }
    }
    finally {
        fs.rmSync(extractDir, { recursive: true, force: true });
    }
}
// Добавляет рамки и зазоры ко всем таблицам в документе Word.
function injectTableBorders(docXml) {
    const borders = '<w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="D9D9D9"/><w:left w:val="single" w:sz="4" w:space="0" w:color="D9D9D9"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="D9D9D9"/><w:right w:val="single" w:sz="4" w:space="0" w:color="D9D9D9"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="D9D9D9"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="D9D9D9"/></w:tblBorders><w:tblCellMar><w:top w:w="75" w:type="dxa"/><w:left w:w="75" w:type="dxa"/><w:bottom w:w="75" w:type="dxa"/><w:right w:w="75" w:type="dxa"/></w:tblCellMar>';
    return docXml.replace(/<w:tbl>([\s\S]*?)<w:tblPr>([\s\S]*?)<\/w:tblPr>/g, (match, beforePr, prContent) => {
        let updatedPr = prContent;
        if (!/w:tblBorders/i.test(updatedPr)) {
            updatedPr = `${borders}${updatedPr}`;
        }
        return match.replace(prContent, updatedPr);
    }).replace(/<w:tbl>([\s\S]*?)<\/w:tbl>/g, table => applyHeaderFormatting(table));
}
// Применяет единый стиль к заголовочной строке таблицы.
function applyHeaderFormatting(tableXml) {
    return tableXml.replace(/(<w:tr[\s\S]*?<w:tblHeader[\s\S]*?<\/w:tr>)/, headerRow => {
        return formatHeaderRow(headerRow);
    });
}
// Удаляет автоматически сгенерированный заголовок Word, если он присутствует.
function removeGeneratedTitle(docXml) {
    return docXml.replace(/<w:p[^>]*>\s*<w:pPr>[\s\S]*?<w:pStyle[^>]*\bw:val="Title"[^>]*\/>[\s\S]*?<\/w:pPr>[\s\S]*?<\/w:p>\s*/, '');
}
function insertPageBreak(docXml) {
    const marker = '__PAGE_BREAK__';
    const markerIndex = docXml.indexOf(marker);
    if (markerIndex === -1) {
        return docXml;
    }
    const runStart = docXml.lastIndexOf('<w:r', markerIndex);
    const runEnd = docXml.indexOf('</w:r>', markerIndex);
    if (runStart === -1 || runEnd === -1) {
        return docXml;
    }
    const breakRun = '<w:r><w:br w:type="page"/></w:r>';
    const updated = `${docXml.slice(0, runStart)}${breakRun}${docXml.slice(runEnd + '</w:r>'.length)}`;
    return updated.replace(marker, '');
}
// Обновляет styles.xml, чтобы задать размеры шрифта для заголовков.
function applyHeadingStyleDefinitions(extractDir) {
    const stylesPath = path.join(extractDir, 'word', 'styles.xml');
    if (!fs.existsSync(stylesPath)) {
        return;
    }
    let stylesXml = fs.readFileSync(stylesPath, 'utf-8');
    stylesXml = applyStyleSize(stylesXml, '1', 40);
    stylesXml = applyStyleSize(stylesXml, 'Heading1', 40);
    stylesXml = applyStyleSize(stylesXml, '2', 32);
    stylesXml = applyStyleSize(stylesXml, 'Heading2', 32);
    fs.writeFileSync(stylesPath, stylesXml, 'utf-8');
}
// Гарантирует, что стиль с указанным id использует нужный размер шрифта.
function applyStyleSize(stylesXml, styleId, sizeHalfPoints) {
    const stylePattern = new RegExp(`<w:style[^>]*w:styleId="${styleId}"[^>]*>[\\s\\S]*?<\\/w:style>`, 'g');
    return stylesXml.replace(stylePattern, styleBlock => {
        if (!/<w:rPr>/.test(styleBlock)) {
            const insertionIndex = styleBlock.lastIndexOf('</w:style>');
            if (insertionIndex === -1)
                return styleBlock;
            const addition = `<w:rPr><w:sz w:val="${sizeHalfPoints}"/><w:szCs w:val="${sizeHalfPoints}"/></w:rPr>`;
            return `${styleBlock.slice(0, insertionIndex)}${addition}${styleBlock.slice(insertionIndex)}`;
        }
        return styleBlock.replace(/<w:rPr>([\s\S]*?)<\/w:rPr>/, (_match, inner) => {
            const cleaned = inner
                .replace(/<w:sz[^>]*\/>/g, '')
                .replace(/<w:szCs[^>]*\/>/g, '');
            return `<w:rPr>${cleaned}<w:sz w:val="${sizeHalfPoints}"/><w:szCs w:val="${sizeHalfPoints}"/></w:rPr>`;
        });
    });
}
// Удаляет чужие размеры шрифта внутри абзацев с заголовками.
function applyHeadingStyling(docXml) {
    const applySizeToParagraphs = (xml, styleVal, sizeHalfPoints) => {
        const paragraphPattern = new RegExp(`<w:p[^>]*>\\s*<w:pPr[\\s\\S]*?<w:pStyle[^>]*w:val="${styleVal}"[^>]*\\/>[\\s\\S]*?<\\/w:p>`, 'g');
        return xml.replace(paragraphPattern, paragraph => {
            return paragraph.replace(/<w:r(\b[^>]*)>([\s\S]*?)<\/w:r>/g, (_runMatch, attrs = '', inner) => {
                if (/<w:br\b/i.test(inner)) {
                    return `<w:r${attrs}>${inner}</w:r>`;
                }
                if (/<w:rPr>/.test(inner)) {
                    const updatedInner = inner.replace(/<w:rPr>([\s\S]*?)<\/w:rPr>/, (_m2, rpr) => {
                        const cleaned = rpr
                            .replace(/<w:sz[^>]*\/>/g, '')
                            .replace(/<w:szCs[^>]*\/>/g, '')
                            .trim();
                        if (!cleaned) {
                            return '';
                        }
                        return `<w:rPr>${cleaned}</w:rPr>`;
                    });
                    return `<w:r${attrs}>${updatedInner}</w:r>`;
                }
                return `<w:r${attrs}>${inner}</w:r>`;
            });
        });
    };
    let updated = docXml;
    updated = applySizeToParagraphs(updated, '1', 40);
    updated = applySizeToParagraphs(updated, '2', 32);
    return updated;
}
// Заменяет текстовый маркер оглавления на поле Word TOC.
function replaceTocPlaceholder(docXml) {
    const marker = '__DOCX_TOC_PLACEHOLDER__';
    const markerIndex = docXml.indexOf(marker);
    if (markerIndex === -1) {
        return docXml;
    }
    let paragraphStart = -1;
    let searchIndex = markerIndex;
    while (searchIndex >= 0) {
        const candidate = docXml.lastIndexOf('<w:p', searchIndex);
        if (candidate === -1) {
            break;
        }
        const nextChar = docXml[candidate + 4] ?? '';
        if (nextChar === '>' || nextChar === ' ' || nextChar === '\n' || nextChar === '\r' || nextChar === '\t') {
            paragraphStart = candidate;
            break;
        }
        searchIndex = candidate - 1;
    }
    const paragraphEnd = docXml.indexOf('</w:p>', markerIndex);
    if (paragraphStart === -1 || paragraphEnd === -1) {
        return docXml.replace(marker, '');
    }
    const tocParagraph = '<w:p><w:r><w:fldChar w:fldCharType="begin" w:dirty="true"/></w:r>' +
        '<w:r><w:instrText xml:space="preserve"> TOC \\o "1-3" \\h \\z \\u </w:instrText></w:r>' +
        '<w:r><w:fldChar w:fldCharType="separate"/></w:r>' +
        '<w:r><w:t xml:space="preserve"> </w:t></w:r>' +
        '<w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>';
    return `${docXml.slice(0, paragraphStart)}${tocParagraph}${docXml.slice(paragraphEnd + '</w:p>'.length)}`;
}
// Настраивает внешний вид первой строки таблицы как заголовочной.
function formatHeaderRow(rowXml) {
    const headerBorders = '<w:tcBorders><w:top w:val="single" w:sz="8" w:space="0" w:color="DDDDDD"/><w:left w:val="single" w:sz="8" w:space="0" w:color="DDDDDD"/><w:bottom w:val="single" w:sz="8" w:space="0" w:color="DDDDDD"/><w:right w:val="single" w:sz="8" w:space="0" w:color="DDDDDD"/></w:tcBorders>';
    const headerShading = '<w:shd w:val="clear" w:color="auto" w:fill="F0F0F0"/>';
    const headerMargins = '<w:tcMar><w:top w:w="30" w:type="dxa"/><w:left w:w="30" w:type="dxa"/><w:bottom w:w="20" w:type="dxa"/><w:right w:w="30" w:type="dxa"/></w:tcMar>';
    return rowXml.replace(/<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/g, (cellMatch, inner) => {
        const tcPrMatch = inner.match(/<w:tcPr>([\s\S]*?)<\/w:tcPr>/);
        const tcPrSelfClosing = inner.match(/<w:tcPr\b[^>]*\/>/);
        let tcPrContent = tcPrMatch ? tcPrMatch[1] : '';
        let needsWrap = false;
        if (!tcPrMatch && !tcPrSelfClosing) {
            needsWrap = true;
        }
        else {
            if (tcPrMatch) {
                inner = inner.replace(tcPrMatch[0], '');
            }
            if (tcPrSelfClosing) {
                inner = inner.replace(tcPrSelfClosing[0], '');
            }
        }
        tcPrContent = tcPrContent.replace(/<w:tcBorders[\s\S]*?<\/w:tcBorders>/g, '');
        tcPrContent = tcPrContent.replace(/<w:shd[\s\S]*?\/>/g, '');
        tcPrContent = tcPrContent.replace(/<w:tcMar[\s\S]*?<\/w:tcMar>/g, '');
        tcPrContent = `${headerBorders}${headerShading}${headerMargins}${tcPrContent}`;
        const tcPrBlock = `<w:tcPr>${tcPrContent}</w:tcPr>`;
        return `<w:tc>${needsWrap ? tcPrBlock + inner : tcPrBlock + inner}</w:tc>`;
    });
}
// Подмешивает файлы из reference-шаблона в распакованный DOCX.
function applyTemplateFiles(extractDir, templatePath) {
    const tempTemplateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openapi-template-'));
    try {
        // Распаковываем template DOCX в отдельную временную директорию.
        const unzipTemplate = spawnSync('unzip', ['-qq', templatePath, '-d', tempTemplateDir]);
        if (unzipTemplate.status !== 0) {
            throw new Error(`unzip template exited with code ${unzipTemplate.status}`);
        }
        const filesToCopy = [
            'word/styles.xml',
            'word/numbering.xml',
            'word/theme/theme1.xml',
            'word/settings.xml'
        ];
        for (const relativePath of filesToCopy) {
            const source = path.join(tempTemplateDir, relativePath);
            const target = path.join(extractDir, relativePath);
            try {
                if (fs.existsSync(source)) {
                    // Переносим файл шаблона в распакованный DOCX.
                    fs.mkdirSync(path.dirname(target), { recursive: true });
                    fs.copyFileSync(source, target);
                }
            }
            catch (err) {
                console.warn(`[docx] failed to copy template file ${relativePath}:`, err);
            }
        }
    }
    finally {
        fs.rmSync(tempTemplateDir, { recursive: true, force: true });
    }
}
