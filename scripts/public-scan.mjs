import { fileURLToPath } from 'node:url';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const extensions = new Set(['.astro', '.css', '.js', '.mjs', '.json', '.md', '.svg', '.ts', '.yaml', '.yml']);
const ownerContacts = [];
const denied = [
  ['GitHub token', /gh[pousr]_[A-Za-z0-9_]{20,}/g],
  ['secret assignment', /(?:api[_-]?key|secret|token|password)\s*[:=]\s*["'][^"']+/gi],
  ['private IP', /(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)\d{1,3}\.\d{1,3}/g],
  ['internal host', /(?:localhost|\.internal|\.local)(?=[:/\s])/gi],
  ['unexpected phone', /01[016789]-?\d{3,4}-?\d{4}/g],
  ['private project name', /agent[ -]?factory/gi],
];

function walk(directory) {
  return readdirSync(directory).flatMap((name) => {
    if (['.git', 'dist', 'node_modules', 'screenshots', 'package-lock.json'].includes(name)) return [];
    const path = join(directory, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const violations = [];
for (const file of walk(root).filter((path) => extensions.has(extname(path)))) {
  let text = readFileSync(file, 'utf8');
  for (const contact of ownerContacts) text = text.replaceAll(contact, '[approved-owner-contact]');
  for (const [label, pattern] of denied) {
    for (const match of text.matchAll(pattern)) violations.push(`${relative(root, file)}: ${label}: ${match[0].slice(0, 32)}`);
  }
}
for (const directory of ['src', 'public']) {
  for (const file of walk(join(root, directory)).filter((path) => extensions.has(extname(path)))) {
    const text = readFileSync(file, 'utf8');
    if (/(?:\uC774\uB300\uC911|\uC774\uAE30\uC068|Daejung Lee|mailto:|tel:)/i.test(text)) violations.push(`${relative(root, file)}: personal identity or direct contact`);
  }
}
if (violations.length) {
  console.error(violations.join('\n'));
  process.exit(1);
}
console.log('Public safety scan passed.');
