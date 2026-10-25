// Concatenates src/ into two self-contained files:
//   index.html          standalone page, open it directly in a browser (works offline)
//   dist/artifact.html  page fragment for hosts that wrap the document themselves
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ISO_CSS } from '../figures/vendor/anatomy/kit/iso-kit.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(join(root, p), 'utf8');

// The two interactive machines are built first; each becomes a self-contained script (FigLandmarkRail, FigKeyAction).
const FIGURES = ['landmark-rail', 'key-action'];
FIGURES.forEach(f => execFileSync(process.execPath, [join(root, 'figures', f, 'build.mjs')], { stdio: 'inherit' }));
const figureJs = FIGURES.map(f => read(`figures/dist/${f}.js`)).join('\n');

const JS_ORDER = [
  'glyphs', 'theory', 'store', 'sound', 'staff', 'keyboard', 'curriculum', 'lessons', 'questions',
  'ui-core', 'ui-drill', 'ui-explore', 'main',
];
// the kit's page builder mentions the closing script tag in a string; keep it from ending the inline script
const js = [figureJs, ...JS_ORDER.map(f => `/* ---- ${f}.js ---- */\n` + read(`src/js/${f}.js`).replace(/^'use strict';\n/, ''))].join('\n').replace(/<\/(script)/gi, '<\\/$1');
const css = read('src/style.css') + '\n/* ---- figures (Anatomy kit, MIT) ---- */\n' + ISO_CSS;
const body = read('src/template.html');

const TITLE = 'Landmark Piano';
const DESC = 'Learn where every note lives on the staff and the keyboard, using landmark notes, from first lesson to ledger lines, key signatures and C clefs.';
const FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,750&family=IBM+Plex+Mono:wght@500;600;700&family=Instrument+Sans:wght@400;500;600;700&display=swap">';
const script = `<script>\n'use strict';\n${js}\n</script>`;

const standalone = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${TITLE}</title>
<meta name="description" content="${DESC}">
${FONTS}
<style>
:root { color-scheme: light; padding-block: env(safe-area-inset-top, 0px) env(safe-area-inset-bottom, 0px); }
body { margin: 0; }
[hidden] { display: none !important; }
</style>
<style>
${css}
</style>
</head>
<body>
${body}
${script}
</body>
</html>
`;
writeFileSync(join(root, 'index.html'), standalone);

const fragment = `<title>${TITLE}</title>
<meta name="claude:viewport-fit-sides" content="cover">
${FONTS}
<style>
${css}
</style>
${body}
${script}
`;
mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist/artifact.html'), fragment);
console.log(`built index.html (${(standalone.length / 1024).toFixed(0)} KB) and dist/artifact.html`);
