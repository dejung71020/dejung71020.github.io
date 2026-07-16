import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize, relative } from 'node:path';

const dist = new URL('../dist', import.meta.url).pathname;
const htmlFiles = [];
function walk(directory) {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (extname(path) === '.html') htmlFiles.push(path);
  }
}
walk(dist);

const missing = [];
for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8');
  const references = [...html.matchAll(/(?:href|src)="([^"#?]+)(?:[?#][^"]*)?"/g)].map((match) => match[1]);
  for (const reference of references) {
    if (/^(?:https?:|mailto:|tel:|data:)/.test(reference)) continue;
    const target = reference.startsWith('/') ? join(dist, reference) : normalize(join(dirname(file), reference));
    const candidates = [target, join(target, 'index.html'), `${target}.html`];
    if (!candidates.some(existsSync)) missing.push(`${relative(dist, file)} -> ${reference}`);
  }
}
if (missing.length) {
  console.error(`Broken internal references:\n${missing.join('\n')}`);
  process.exit(1);
}
console.log(`Internal link check passed across ${htmlFiles.length} pages.`);
