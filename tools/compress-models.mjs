// 캐릭터 GLB 압축: assets/source/*.glb → assets/models/*.glb
// 사용법: npm install  →  npm run compress-models
// - 색상/노멀 텍스처 1024px, 금속·거칠기 텍스처 512px, WebP로 변환
// - 중복 데이터 정리. 폴리곤 수는 그대로 둔다.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { textureCompress, dedup, prune, weld } from '@gltf-transform/functions';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const srcDir = path.join(root, 'assets/source');
const outDir = path.join(root, 'assets/models');
fs.mkdirSync(outDir, { recursive: true });
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

for (const file of fs.readdirSync(srcDir).filter((f) => f.endsWith('.glb'))) {
  const doc = await io.read(path.join(srcDir, file));
  await doc.transform(
    dedup(),
    weld(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 82, slots: /^baseColor/ }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 90, slots: /^normal/ }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [512, 512], quality: 80, slots: /^metallicRoughness/ }),
    prune(),
  );
  const out = path.join(outDir, file);
  await io.write(out, doc);
  const kb = (n) => `${(n / 1024 / 1024).toFixed(2)}MB`;
  console.log(`${file}: ${kb(fs.statSync(path.join(srcDir, file)).size)} → ${kb(fs.statSync(out).size)}`);
}
