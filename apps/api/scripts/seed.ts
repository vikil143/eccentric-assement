// apps/api/scripts/seed.ts
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API = 'http://localhost:3000';
const FIXTURES = path.join(__dirname, '..', 'test-fixtures');

const seeds = [
  { file: 'sample.jpg', name: 'homepage-hero.jpg',   tags: ['hero', 'homepage'] },
  { file: 'sample.jpg', name: 'product-banner.jpg',  tags: ['banner', 'product'] },
  { file: 'sample.jpg', name: 'campaign-spring.jpg', tags: ['campaign', 'spring'] },
  { file: 'sample.png', name: 'logo-primary.png',    tags: ['logo', 'brand'] },
  { file: 'sample.png', name: 'logo-mono.png',       tags: ['logo', 'brand'] },
  { file: 'sample.pdf', name: 'q1-brochure.pdf',     tags: ['brochure', 'q1'] },
  { file: 'sample.pdf', name: 'q1-whitepaper.pdf',   tags: ['whitepaper', 'q1'] },
  { file: 'sample.pdf', name: 'q2-report.pdf',       tags: ['report', 'q2'] },
];

function mimeFor(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.mp4') return 'video/mp4';
  return 'application/octet-stream';
}

async function main() {
  for (const s of seeds) {
    const buffer = fs.readFileSync(path.join(FIXTURES, s.file));
    const blob = new Blob([buffer], { type: mimeFor(s.name) });

    const fd = new FormData();
    fd.append('file', blob, s.name);
    fd.append('tags', s.tags.join(','));

    const res = await fetch(`${API}/api/assets`, { method: 'POST', body: fd });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed for ${s.name}: ${res.status} ${err}`);
    }
    const data = await res.json();
    console.log(`✓ ${s.name} (${data.kind})`);
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });