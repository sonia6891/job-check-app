/**
 * 長截圖與多張截圖的辨識輔助（純函式，方便測試）。
 *
 * 長截圖：太長的圖直接辨識會被縮得太小、字認不出來，所以切成幾段，每段高約寬度的 1.6 倍、前後重疊。
 * 每段只保留重疊區中線以內的文字（用文字框中心判斷），被切半的那一行一定完整出現在其中一段，不會重複。
 *
 * 多張截圖：使用者往下滑連截幾張，前後張會有重疊的幾行；合併時去掉重疊，
 * 也容許上一張最底下、下一張最上面各有幾行被切半或是 App 標題列。
 */

export type OcrBox = { x: number; y: number; width: number; height: number };
export type OcrBlockLike = { text: string; boundingBox?: OcrBox | null };
export type Tile = { y: number; height: number; keepFrom: number; keepTo: number };

const TALL_RATIO = 2.2;

export function isTallImage(width?: number, height?: number) {
  return Boolean(width && height && height > width * TALL_RATIO);
}

export function tilePlan(width: number, height: number): Tile[] {
  if (!isTallImage(width, height)) return [{ y: 0, height, keepFrom: 0, keepTo: height }];
  const tile = Math.round(width * 1.6);
  const overlap = Math.round(width * 0.15);
  const step = tile - overlap;
  const tiles: Array<{ y: number; height: number }> = [];
  for (let y = 0; y < height; y += step) {
    const h = Math.min(tile, height - y);
    tiles.push({ y, height: h });
    if (y + h >= height) break;
  }
  return tiles.map((t, i) => ({
    ...t,
    keepFrom: i === 0 ? 0 : overlap / 2,
    keepTo: i === tiles.length - 1 ? t.height : t.height - overlap / 2
  }));
}

/** 這一段負責的文字（文字框中心落在保留範圍內）。沒有文字框時退回整段文字。 */
export function keepTileText(blocks: OcrBlockLike[], tile: Tile, fallbackText = '') {
  if (!blocks.length || blocks.some(b => !b.boundingBox)) return fallbackText;
  return blocks
    .filter(b => {
      const box = b.boundingBox as OcrBox;
      const center = box.y + box.height / 2;
      return center >= tile.keepFrom && center < tile.keepTo;
    })
    .map(b => b.text)
    .join('\n');
}

const norm = (line: string) => line.replace(/\s+/g, '');

export function mergePages(pages: string[]) {
  const out: string[] = [];
  for (const page of pages) {
    const lines = page.split('\n').map(l => l.trim()).filter(Boolean);
    if (!out.length) {
      out.push(...lines);
      continue;
    }
    let merged = false;
    // 由長到短找重疊；上一張結尾可略過 2 行（被切半），這一張開頭可略過 3 行（切半的行或 App 標題列）。
    search:
    for (let k = Math.min(15, out.length, lines.length); k >= 1; k--) {
      for (let drop = 0; drop <= 2; drop++) {
        for (let skip = 0; skip <= 3; skip++) {
          if (out.length - drop < k || skip + k > lines.length) continue;
          const tail = out.slice(out.length - drop - k, out.length - drop).map(norm);
          const head = lines.slice(skip, skip + k).map(norm);
          // 只重疊一行時，那一行要夠長才算，免得「收藏」這種短字誤判。
          if (k === 1 && tail[0].length < 8) continue;
          if (tail.join('\n') === head.join('\n')) {
            out.splice(out.length - drop, drop);
            out.push(...lines.slice(skip + k));
            merged = true;
            break search;
          }
        }
      }
    }
    if (!merged) out.push(...lines);
  }
  return out.join('\n');
}
