import AsyncStorage from '@react-native-async-storage/async-storage';

const KEEP_ORIGINAL_KEY = 'jobcheck.keepOriginalImage';
const DRAFT_KEY = 'jobcheck.homeDraft';
const ONBOARDED_KEY = 'jobcheck.onboarded';

export type HomeDraft = { text: string; sourceUrl: string | null };

/**
 * 使用者是否要保留職缺原圖。
 * 預設 false：原圖由後端在 24 小時後清理。
 */
export const prefs = {
  async getKeepOriginal(): Promise<boolean> {
    try {
      return (await AsyncStorage.getItem(KEEP_ORIGINAL_KEY)) === '1';
    } catch {
      return false;
    }
  },

  /** 首頁尚未送出的職缺文字與來源網址；切頁、登入返回、App 重開後都能接著用。 */
  async getDraft(): Promise<HomeDraft> {
    try {
      const raw = await AsyncStorage.getItem(DRAFT_KEY);
      if (!raw) return { text: '', sourceUrl: null };
      const parsed = JSON.parse(raw);
      return { text: typeof parsed?.text === 'string' ? parsed.text : '', sourceUrl: typeof parsed?.sourceUrl === 'string' ? parsed.sourceUrl : null };
    } catch {
      return { text: '', sourceUrl: null };
    }
  },

  async setDraft(draft: HomeDraft): Promise<void> {
    try {
      if (!draft.text && !draft.sourceUrl) await AsyncStorage.removeItem(DRAFT_KEY);
      else await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
    }
  },

  /** 看過第一次打開的引導頁沒有。讀不到時當作看過，避免每次都跳出來。 */
  async getOnboarded(): Promise<boolean> {
    try {
      return (await AsyncStorage.getItem(ONBOARDED_KEY)) !== null;
    } catch {
      return true;
    }
  },

  async setOnboarded(): Promise<void> {
    try {
      await AsyncStorage.setItem(ONBOARDED_KEY, '1');
    } catch {
    }
  },

  async setKeepOriginal(value: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(KEEP_ORIGINAL_KEY, value ? '1' : '0');
    } catch {
    }
  }
};
