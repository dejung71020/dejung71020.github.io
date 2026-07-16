import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'public/evidence');
await mkdir(output, { recursive: true });

const jobs = [
  {
    input: '/private/tmp/yamon-d.png',
    output: 'yamon-home.webp',
    width: 1200,
  },
  {
    input: resolve(root, 'screenshots/workb_screen1.jpg'),
    output: 'workb.webp',
    width: 1200,
  },
  {
    input: '/private/tmp/pang-b.jpg',
    output: 'pangpangpang.webp',
    width: 675,
  },
  {
    input: '/private/tmp/wallet-os-2.png',
    output: 'wallet-os.webp',
    width: 1440,
  },
  {
    input: '/private/tmp/soccer-fieldnote-2.png',
    output: 'soccer-fieldnote.webp',
    width: 1440,
  },
  {
    input: '/private/tmp/wallet-os-mobile-2.png',
    output: 'wallet-os-mobile.webp',
    width: 390,
  },
  {
    input: '/private/tmp/soccer-fieldnote-mobile-2.png',
    output: 'soccer-fieldnote-mobile.webp',
    width: 390,
  },
];

for (const job of jobs) {
  await sharp(job.input)
    .rotate()
    .resize({ width: job.width, withoutEnlargement: true })
    .webp({ quality: 78, effort: 5 })
    .toFile(resolve(output, job.output));
}

console.log(`Prepared ${jobs.length} reviewed evidence images.`);
