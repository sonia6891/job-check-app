import { Platform } from 'react-native';

export type OcrResult = {
  text: string;
  engine: 'apple_vision' | 'mlkit';
  language: string;
  confidence?: number;
  blocks?: Array<{ text: string; boundingBox?: unknown }>;
};

function normalizeRecognizedText(input: string) {
  return input
    .normalize('NFKC')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * On-device OCR adapter.
 * iOS uses Apple Vision; Android uses Google ML Kit through expo-ocr-kit.
 * This requires a Development Build / EAS Build and does not work in Expo Go.
 */
export async function recognizeTextFromLocalImage(uri: string): Promise<OcrResult> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    throw new Error('native_ocr_mobile_only');
  }

  try {
    const module = await import('expo-ocr-kit');
    const result = await module.recognizeText(uri);
    const text = normalizeRecognizedText(result?.text ?? '');

    if (!text) throw new Error('ocr_no_text_detected');

    return {
      text,
      engine: Platform.OS === 'ios' ? 'apple_vision' : 'mlkit',
      language: 'zh-Hant+en',
      blocks: result?.blocks ?? []
    };
  } catch (error: any) {
    const message = String(error?.message ?? error ?? 'native_ocr_failed');

    if (
      message.includes('Cannot find native module') ||
      message.includes('Native module') ||
      message.includes('Expo Go')
    ) {
      throw new Error('native_ocr_requires_development_build');
    }

    throw error;
  }
}
