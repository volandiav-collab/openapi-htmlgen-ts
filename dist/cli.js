import { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import { loadOpenAPI, loadUnifiedJson } from './loader.js';
import { mapToUnified } from './mapper.js';
import { validateUnified } from './validate.js';
import { renderHtml } from './render.js';
import { renderDocxFromHtml } from './docx.js';
function resolvePathAcrossCwds(inputPath) {
    if (!inputPath)
        return null;
    if (path.isAbsolute(inputPath))
        return inputPath;
    const candidates = [];
    const execCwd = process.cwd();
    candidates.push(path.resolve(execCwd, inputPath));
    const initCwd = process.env.INIT_CWD;
    if (initCwd && initCwd !== execCwd) {
        candidates.push(path.resolve(initCwd, inputPath));
    }
    const existing = candidates.find(candidate => {
        try {
            return fs.existsSync(candidate);
        }
        catch {
            return false;
        }
    });
    return existing ?? candidates[0] ?? null;
}
const program = new Command();
program
    .name('openapi-htmlgen')
    .description('Generate HTML from OpenAPI or from unified JSON')
    .argument('<input>', 'OpenAPI (yaml/json) or unified json')
    .option('--assume-unified', 'Treat input as unified json, skip mapping')
    .option('--template-dir <dir>', 'Templates directory', 'templates')
    .option('--schema <path>', 'Unified JSON schema', 'schema/unified_doc.schema.json')
    .option('--output <file>', 'Output HTML file', 'dist/index.html')
    .option('--static-dir <dir>', 'Directory with static assets to copy next to the output', 'static')
    .option('--docx <file>', 'Optional DOCX output file')
    .option('--docx-style <file>', 'CSS file to inline into DOCX output', 'assets/styles.css')
    .option('--docx-template <file>', 'DOCX template (.dotx/.docx) applied to the generated document', 'examples/template.dotx')
    .option('--include-nested', 'Include nested schema properties in the generated documentation')
    .action((input, opts) => {
    const resolvedInput = resolvePathAcrossCwds(input);
    if (!resolvedInput) {
        throw new Error(`Unable to resolve input path: ${input}`);
    }
    let unified;
    if (opts.assumeUnified) {
        unified = loadUnifiedJson(resolvedInput);
    }
    else {
        const spec = loadOpenAPI(resolvedInput);
        unified = mapToUnified(spec, { includeNested: !!opts.includeNested });
    }
    const resolvedSchemaPath = resolvePathAcrossCwds(opts.schema);
    if (!resolvedSchemaPath) {
        throw new Error(`Unable to resolve schema path: ${opts.schema}`);
    }
    validateUnified(unified, resolvedSchemaPath);
    let staticDir = null;
    const rawStaticDir = Array.isArray(opts.staticDir) ? opts.staticDir[0] : opts.staticDir;
    if (typeof rawStaticDir === 'string') {
        const normalized = rawStaticDir.trim();
        if (normalized && !['false', 'none', 'no', 'off'].includes(normalized.toLowerCase())) {
            staticDir = resolvePathAcrossCwds(normalized);
        }
    }
    const resolvedTemplateDir = resolvePathAcrossCwds(opts.templateDir);
    if (!resolvedTemplateDir) {
        throw new Error(`Unable to resolve template directory: ${opts.templateDir}`);
    }
    const resolvedOutput = resolvePathAcrossCwds(opts.output) ?? opts.output;
    const html = renderHtml(unified, resolvedTemplateDir, resolvedOutput, { staticDir });
    console.log('Generated HTML:', resolvedOutput);
    if (opts.docx) {
        const resolvedDocxPath = resolvePathAcrossCwds(opts.docx) ?? opts.docx;
        const stylePaths = Array.isArray(opts.docxStyle)
            ? opts.docxStyle.map((stylePath) => resolvePathAcrossCwds(stylePath)?.toString()).filter(Boolean)
            : opts.docxStyle
                ? [resolvePathAcrossCwds(opts.docxStyle) ?? path.resolve(opts.docxStyle)]
                : [];
        const docxAssetDirs = [];
        const specDir = path.dirname(resolvedInput);
        if (!docxAssetDirs.includes(specDir)) {
            docxAssetDirs.push(specDir);
        }
        if (staticDir) {
            docxAssetDirs.push(staticDir);
        }
        const defaultAssetsDir = path.resolve('assets');
        if (!docxAssetDirs.includes(defaultAssetsDir)) {
            docxAssetDirs.push(defaultAssetsDir);
        }
        const outputDir = resolvedOutput ? path.resolve(path.dirname(resolvedOutput)) : process.cwd();
        if (!docxAssetDirs.includes(outputDir)) {
            docxAssetDirs.push(outputDir);
        }
        const templateOption = opts.docxTemplate ?? opts.docxReference ?? null;
        const templatePath = templateOption ? resolvePathAcrossCwds(templateOption) ?? templateOption : null;
        renderDocxFromHtml(html, resolvedDocxPath, stylePaths, docxAssetDirs, unified.meta ?? undefined, templatePath);
        console.log('Generated DOCX:', resolvedDocxPath);
    }
});
program.parse();
