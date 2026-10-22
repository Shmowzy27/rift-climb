// Inlines src/style.css and src/js/*.js into one self-contained rift-climb.html.
// Usage: node tools/build.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src');
const css = readFileSync(join(src, 'style.css'), 'utf8');
const js = readdirSync(join(src, 'js')).filter(f => f.endsWith('.js')).sort()
  .map(f => `// ---- ${f} ----\n` + readFileSync(join(src, 'js', f), 'utf8')
    .replace(/^if \(typeof module !== 'undefined'\).*$/m, ''))
  .join('\n');
// Three.js r128 (cdnjs build) and its GLTFLoader, vendored so the game stays one offline file
const vendor = ['three.r128.min.js', 'GLTFLoader.r128.js'].map(f => readFileSync(join(src, 'vendor', f), 'utf8')).join('\n;\n');
const html = readFileSync(join(src, 'index.html'), 'utf8')
  .replace('/*__VENDOR__*/', () => vendor.replace(/<\/script/gi, '<\\/script'))
  .replace('/*__CSS__*/', () => css)
  .replace('/*__JS__*/', () => js.replace(/<\/script/gi, '<\\/script'));
if (/\bhttps?:\/\/(?!www\.w3\.org)/.test(js + css)) console.warn('warning: found an http(s) URL in the bundle');
writeFileSync(join(root, 'rift-climb.html'), html);
console.log(`rift-climb.html  ${(html.length / 1024).toFixed(1)} KB`);
