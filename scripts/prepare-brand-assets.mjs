import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

// 唯一來源：向量母檔。所有圖示都從這裡產生，產物不進 Git。
const source = 'assets/brand/app-icon.svg';
const output = 'assets/generated';
await mkdir(output, { recursive: true });
await mkdir('public', { recursive: true });

const icon = await readFile(source, 'utf8');
if (!icon.includes('id="background"') || !icon.includes('id="mark"')) {
  throw new Error(source + ' must keep the background rect and the mark group.');
}
// 只留圖案：拿掉背景（和舊版的白色星光），畫布裁到公文包範圍（含線寬：x 133～891、y 165～851）。
const mark = icon
  .replace(/<rect id="background"[^>]*\/>/, '')
  .replace(/<g id="sparkles"[\s\S]*?<\/g>/, '')
  .replace('width="1024" height="1024" viewBox="0 0 1024 1024"', 'width="778" height="706" viewBox="123 155 778 706"');

const render = (svg, size) => sharp(Buffer.from(svg), { density: 300 }).resize(size, size, { fit: 'contain', background: '#00000000' });
const centered = async (svg, inner, file) => {
  const art = await render(svg, inner).png().toBuffer();
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: '#00000000' } })
    .composite([{ input: art, gravity: 'center' }]).png().toFile(file);
};

// App Store 不接受透明圖層，主圖示要拿掉 alpha。
await render(icon, 1024).removeAlpha().png().toFile(join(output, 'app-icon.png'));
// Android 只保證中間 66/108 的圓形範圍會顯示。
await centered(mark, 540, join(output, 'adaptive-foreground.png'));
// 啟動畫面的底色在 app.json（奶油米），這裡只放圖案。
await centered(mark, 900, join(output, 'splash-mark.png'));
await render(icon, 192).removeAlpha().png().toFile('public/icon-192.png');
await render(icon, 512).removeAlpha().png().toFile('public/icon-512.png');
console.log('Prepared brand assets from', source + ': 1024 icon, adaptive foreground, splash mark, web icons.');
