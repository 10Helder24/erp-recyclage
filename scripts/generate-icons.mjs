import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const source = join(process.cwd(), 'public', 'ERP2.jpg');
const outputDir = join(process.cwd(), 'public', 'icons');

if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

const targets = [
  { size: 32, name: 'erp2-32.png' },
  { size: 64, name: 'erp2-64.png' },
  { size: 128, name: 'erp2-128.png' },
  { size: 192, name: 'erp2-192.png' },
  { size: 256, name: 'erp2-256.png' },
  { size: 512, name: 'erp2-512.png' }
];

async function generate() {
  await Promise.all(
    targets.map(({ size, name }) =>
      sharp(source)
        .resize(size, size)
        .png()
        .toFile(join(outputDir, name))
    )
  );
  const pngBuffer = await sharp(source).resize(64, 64).png().toBuffer();
  const ico = await pngToIco(pngBuffer);
  writeFileSync(join(process.cwd(), 'public', 'favicon.ico'), ico);
}

generate()
  .then(() => {
    console.log('Icons generated in public/icons');
  })
  .catch((error) => {
    console.error('Icon generation failed:', error);
    process.exit(1);
  });

