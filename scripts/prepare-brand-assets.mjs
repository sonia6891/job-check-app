import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const source = 'assets/brand/logo-light-preview.png';
const output = 'assets/generated';
await mkdir(output, { recursive: true });
await mkdir('public', { recursive: true });

// Approved artwork only: resize, never redraw or replace with a different logo.
const image = sharp(source);
const { width, height } = await image.metadata();
if (!width || !height || width < 64 || height < 64) {
  throw new Error('Approved brand image is missing or too small to process.');
}
await sharp(source).resize(1024, 1024, { fit: 'fill', kernel: 'lanczos3' })
  .png().toFile(join(output, 'app-icon.png'));

const inset = 704;
const artwork = await sharp(source).resize(inset, inset, { kernel: 'lanczos3' }).png().toBuffer();
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: '#FFFFFF00' } })
  .composite([{ input: artwork, left: (1024 - inset) / 2, top: (1024 - inset) / 2 }])
  .png().toFile(join(output, 'adaptive-foreground.png'));

// The native splash-screen config plugin supplies the navy background; transparent canvas
// here keeps the approved white-square logo inside its safe area.
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: '#FFFFFF00' } })
  .composite([{ input: artwork, left: (1024 - inset) / 2, top: (1024 - inset) / 2 }])
  .png().toFile(join(output, 'splash-mark.png'));

await sharp(source).resize(192, 192).png().toFile('public/icon-192.png');
await sharp(source).resize(512, 512).png().toFile('public/icon-512.png');
console.log('Prepared approved-brand assets:', width + '×' + height, 'source; 1024 icon, adaptive foreground, splash mark, web icons.');
console.log('WARNING: source is 72px approved preview; generated icons are provisional and require a true high-resolution master before store review.');
