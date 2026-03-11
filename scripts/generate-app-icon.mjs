import { existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const rootDir = process.cwd();
const assetsDir = path.join(rootDir, 'assets');
const sourceSvg = path.join(assetsDir, 'icon.svg');
const pngPath = path.join(assetsDir, 'icon.png');
const icoPath = path.join(assetsDir, 'icon.ico');
const icnsPath = path.join(assetsDir, 'icon.icns');

if (!existsSync(sourceSvg)) {
  throw new Error(`Missing source SVG at ${sourceSvg}`);
}

const run = (command, args) => {
  execFileSync(command, args, { stdio: 'inherit' });
};

mkdirSync(assetsDir, { recursive: true });

run('magick', [
  '-background',
  'none',
  sourceSvg,
  '-resize',
  '1024x1024',
  pngPath,
]);

run('magick', [
  pngPath,
  '-define',
  'icon:auto-resize=256,128,64,48,32,16',
  icoPath,
]);

if (process.platform === 'darwin') {
  const iconsetDir = path.join(assetsDir, 'icon.iconset');
  rmSync(iconsetDir, { recursive: true, force: true });
  mkdirSync(iconsetDir, { recursive: true });

  const writeSize = (name, size) => {
    run('sips', ['-z', `${size}`, `${size}`, pngPath, '--out', path.join(iconsetDir, name)]);
  };

  writeSize('icon_16x16.png', 16);
  writeSize('icon_16x16@2x.png', 32);
  writeSize('icon_32x32.png', 32);
  writeSize('icon_32x32@2x.png', 64);
  writeSize('icon_128x128.png', 128);
  writeSize('icon_128x128@2x.png', 256);
  writeSize('icon_256x256.png', 256);
  writeSize('icon_256x256@2x.png', 512);
  writeSize('icon_512x512.png', 512);
  writeSize('icon_512x512@2x.png', 1024);

  run('iconutil', ['-c', 'icns', iconsetDir, '-o', icnsPath]);
  rmSync(iconsetDir, { recursive: true, force: true });
}

console.log(`Generated ${pngPath}`);
console.log(`Generated ${icoPath}`);
if (process.platform === 'darwin') {
  console.log(`Generated ${icnsPath}`);
}
