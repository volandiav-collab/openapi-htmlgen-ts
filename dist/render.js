import nunjucks from 'nunjucks';
import fs from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';
function copyStaticDirectory(srcDir, destDir) {
    if (!srcDir)
        return;
    let stats;
    try {
        stats = fs.statSync(srcDir);
    }
    catch {
        return;
    }
    if (!stats.isDirectory()) {
        return;
    }
    fs.mkdirSync(destDir, { recursive: true });
    const entries = fs.readdirSync(srcDir, { withFileTypes: true });
    for (const entry of entries) {
        const sourcePath = path.join(srcDir, entry.name);
        const targetPath = path.join(destDir, entry.name);
        if (entry.isDirectory()) {
            copyStaticDirectory(sourcePath, targetPath);
        }
        else if (entry.isFile()) {
            fs.copyFileSync(sourcePath, targetPath);
        }
    }
}
export function renderHtml(unified, templateDir, outPath, options = {}) {
    const toString = (value) => {
        if (value === null || value === undefined)
            return '';
        return typeof value === 'string' ? value : String(value);
    };
    const env = nunjucks.configure(templateDir, { autoescape: true });
    env.addFilter('json', (obj, spaces = 2) => JSON.stringify(obj, null, spaces));
    env.addFilter('markdown', (value) => {
        const str = toString(value);
        if (!str.trim())
            return '';
        const html = marked.parse(str, { async: false });
        return new nunjucks.runtime.SafeString(html);
    });
    env.addFilter('markdownWithoutHeading', (value) => {
        const str = toString(value);
        if (!str.trim())
            return '';
        const html = marked.parse(str, { async: false });
        const cleaned = html.replace(/^\s*<(h[1-6])\b[^>]*>[\s\S]*?<\/\1>\s*/i, '');
        return new nunjucks.runtime.SafeString(cleaned);
    });
    env.addFilter('markdownInline', (value) => {
        const str = toString(value);
        if (!str.trim())
            return '';
        const html = marked.parseInline(str, { async: false });
        return new nunjucks.runtime.SafeString(html);
    });
    const html = env.render('base.html', unified);
    if (outPath) {
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.writeFileSync(outPath, html, 'utf-8');
        const staticDir = options.staticDir ? path.resolve(options.staticDir) : null;
        if (staticDir) {
            const destDir = path.join(path.dirname(outPath), path.basename(staticDir));
            if (path.resolve(destDir) !== staticDir) {
                copyStaticDirectory(staticDir, destDir);
            }
        }
    }
    return html;
}
