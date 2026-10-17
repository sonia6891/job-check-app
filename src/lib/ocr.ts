import { Platform } from 'react-native';
import { fixOcrConfusions, stripScreenChrome } from '@/src/lib/ocrClean';
import { keepTileText, mergePages, tilePlan, type OcrBlockLike } from '@/src/lib/ocrPages';

export type OcrResult = {
  text: string;
  engine: 'apple_vision' | 'mlkit';
  language: string;
  confidence?: number;
  blocks?: Array<{ text: string; boundingBox?: unknown }>;
  /** 合併了幾張截圖（一次選多張時）。 */
  pageCount?: number;
};

export type OcrImage = { uri: string; width?: number; height?: number };

function normalizeRecognizedText(input: string) {
  return input
    .normalize('NFKC')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function recognizeRaw(uri: string): Promise<{ text: string; blocks: OcrBlockLike[] }> {
  const module = await import('expo-ocr-kit');
  const result = await module.recognizeText(uri);
  return { text: result?.text ?? '', blocks: (result?.blocks ?? []) as OcrBlockLike[] };
}

// 長截圖切段辨識，每段只取自己負責的文字，再接回去（見 ocrPages.ts）。
async function recognizeTall(image: OcrImage & { width: number; height: number }) {
  const { ImageManipulator, SaveFormat } = await import('expo-image-manipulator');
  const parts: string[] = [];
  for (const tile of tilePlan(image.width, image.height)) {
    const rendered = await ImageManipulator.manipulate(image.uri)
      .crop({ originX: 0, originY: tile.y, width: image.width, height: tile.height })
      .renderAsync();
    const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.95 });
    const raw = await recognizeRaw(saved.uri);
    parts.push(keepTileText(raw.blocks, tile, raw.text));
  }
  return parts.filter(Boolean).join('\n');
}

function toNativeOcrError(error: any) {
  const message = String(error?.message ?? error ?? 'native_ocr_failed');
  if (message.includes('Cannot find native module') || message.includes('Native module') || message.includes('Expo Go')) {
    return new Error('native_ocr_requires_development_build');
  }
  return error;
}

/**
 * On-device OCR adapter.
 * iOS uses Apple Vision; Android uses Google ML Kit through expo-ocr-kit.
 * This requires a Development Build / EAS Build and does not work in Expo Go.
 * 傳入圖片尺寸時，長截圖會自動切段辨識。
 */
export async function recognizeTextFromLocalImage(uri: string, size?: { width?: number; height?: number }): Promise<OcrResult> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    throw new Error('native_ocr_mobile_only');
  }

  try {
    const tall = size?.width && size?.height && tilePlan(size.width, size.height).length > 1;
    const raw = tall
      ? { text: await recognizeTall({ uri, width: size!.width!, height: size!.height! }), blocks: [] as OcrBlockLike[] }
      : await recognizeRaw(uri);
    const text = fixOcrConfusions(stripScreenChrome(normalizeRecognizedText(raw.text)));

    if (!text) throw new Error('ocr_no_text_detected');

    return {
      text,
      engine: Platform.OS === 'ios' ? 'apple_vision' : 'mlkit',
      language: 'zh-Hant+en',
      blocks: raw.blocks
    };
  } catch (error: any) {
    throw toNativeOcrError(error);
  }
}

/** 一次選多張截圖：依選擇順序辨識，再去掉前後張重疊的幾行接起來。沒有字的那張略過。 */
export async function recognizeTextFromImages(images: OcrImage[]): Promise<OcrResult> {
  if (images.length === 1) return recognizeTextFromLocalImage(images[0].uri, images[0]);
  const pages: OcrResult[] = [];
  for (const image of images) {
    try {
      pages.push(await recognizeTextFromLocalImage(image.uri, image));
    } catch (error: any) {
      if (String(error?.message) !== 'ocr_no_text_detected') throw error;
    }
  }
  if (!pages.length) throw new Error('ocr_no_text_detected');
  return { ...pages[0], text: mergePages(pages.map(p => p.text)), blocks: [], pageCount: pages.length };
}
