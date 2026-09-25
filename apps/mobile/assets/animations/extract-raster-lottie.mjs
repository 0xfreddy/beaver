import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [sourcePath, outputDirectory, strideValue = '2', widthValue = '624', heightValue = '540'] =
  process.argv.slice(2);
if (!sourcePath || !outputDirectory) {
  throw new Error(
    'Usage: node extract-raster-lottie.mjs <source.json> <output-directory> [frame-stride] [width] [height]',
  );
}

const stride = Number.parseInt(strideValue, 10);
const width = Number.parseInt(widthValue, 10);
const height = Number.parseInt(heightValue, 10);
if (!Number.isInteger(stride) || stride < 1) throw new Error('Frame stride must be positive.');
if (!Number.isInteger(width) || width < 1) throw new Error('Frame width must be positive.');
if (!Number.isInteger(height) || height < 1) throw new Error('Frame height must be positive.');

const animation = JSON.parse(readFileSync(sourcePath, 'utf8'));
const assets = new Map(animation.assets.map((asset) => [asset.id, asset]));
const orderedAssets = animation.layers
  .filter((layer) => layer.refId)
  .sort((left, right) => left.ip - right.ip)
  .map((layer) => assets.get(layer.refId));

if (
  orderedAssets.length === 0 ||
  orderedAssets.some((asset) => !asset?.p?.startsWith('data:image/webp;base64,'))
) {
  throw new Error('Expected a raster Lottie made from embedded WebP frame assets.');
}

mkdirSync(outputDirectory, { recursive: true });
for (const file of readdirSync(outputDirectory)) {
  if (/^frame-\d+\.(jpg|webp)$/.test(file)) unlinkSync(join(outputDirectory, file));
}

const sampled = orderedAssets.filter(
  (_asset, index) => index % stride === 0 || index === orderedAssets.length - 1,
);
const digits = String(sampled.length - 1).length;

for (const [index, asset] of sampled.entries()) {
  const name = `frame-${String(index).padStart(digits, '0')}`;
  const temporaryPath = join(outputDirectory, `${name}.webp`);
  const outputPath = join(outputDirectory, `${name}.jpg`);
  writeFileSync(temporaryPath, Buffer.from(asset.p.slice(asset.p.indexOf(',') + 1), 'base64'));
  const result = spawnSync(
    'sips',
    [
      '-z',
      String(height),
      String(width),
      '-s',
      'format',
      'jpeg',
      '-s',
      'formatOptions',
      '82',
      temporaryPath,
      '--out',
      outputPath,
    ],
    { stdio: 'ignore' },
  );
  rmSync(temporaryPath);
  if (result.status !== 0) throw new Error(`Could not convert ${name}.`);
}

console.log(
  JSON.stringify({
    sourceFrames: orderedAssets.length,
    outputFrames: sampled.length,
    sourceFps: animation.fr,
    playbackFps: animation.fr / stride,
    durationMs: ((animation.op - animation.ip) / animation.fr) * 1000,
  }),
);
