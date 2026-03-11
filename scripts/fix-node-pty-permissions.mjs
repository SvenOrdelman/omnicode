import { chmodSync, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

if (process.platform === 'win32') {
  process.exit(0);
}

const prebuildsDir = path.join(process.cwd(), 'node_modules', 'node-pty', 'prebuilds');

if (!existsSync(prebuildsDir)) {
  process.exit(0);
}

let updated = 0;

for (const entry of readdirSync(prebuildsDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;

  const helperPath = path.join(prebuildsDir, entry.name, 'spawn-helper');
  if (!existsSync(helperPath)) continue;

  const mode = statSync(helperPath).mode & 0o777;
  if ((mode & 0o111) !== 0) continue;

  chmodSync(helperPath, mode | 0o111);
  updated += 1;
}

if (updated > 0) {
  console.log(`[postinstall] Updated permissions for ${updated} node-pty spawn-helper file(s).`);
}
