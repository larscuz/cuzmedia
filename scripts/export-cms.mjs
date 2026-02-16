import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const sourceFile = path.join(rootDir, 'server', 'data', 'cms.json');
const targetFile = path.join(rootDir, 'public', 'cms.json');

const run = async () => {
  const sourceRaw = await fs.readFile(sourceFile, 'utf8');
  JSON.parse(sourceRaw);

  const normalized = sourceRaw.endsWith('\n') ? sourceRaw : `${sourceRaw}\n`;
  await fs.mkdir(path.dirname(targetFile), { recursive: true });
  await fs.writeFile(targetFile, normalized, 'utf8');

  console.log(`[cms:export] ${sourceFile} -> ${targetFile}`);
};

run().catch((error) => {
  console.error('[cms:export] failed:', error);
  process.exit(1);
});
