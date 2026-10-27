import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Keyboard, Platform } from 'react-native';
import { markAsked, recordOpen, recordReport, type ReviewState } from '@/src/lib/reviewMoments';

/**
 * 在開心的時刻請 Apple 跳出評分視窗（時機見 reviewMoments.ts）。只在 iOS；沒有預先詢問、沒有獎勵
 * （App Review Guideline 5.6.1）。開場動畫、登入選擇還在畫面上時先等它們關掉（最多 90 秒）；
 * 再等 1.5 秒，這時候 App 不在前景或鍵盤開著就不問，留到下次。
 */
const KEY = 'jobcheck.review.v1';
const SETTLE_MS = 1500;
const WAIT_MS = 90000;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
let blocked = false;
let busy = false;

async function load(): Promise<ReviewState> {
  try {
    const parsed = JSON.parse((await AsyncStorage.getItem(KEY)) || 'null');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

async function save(state: ReviewState) {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(state)); } catch { /* 存不了就下次再算 */ }
}

async function ask() {
  if (busy) return;
  busy = true;
  try {
    for (let waited = 0; blocked && waited < WAIT_MS; waited += 500) await sleep(500);
    await sleep(SETTLE_MS);
    if (blocked || AppState.currentState !== 'active' || Keyboard.isVisible()) return;
    const StoreReview = await import('expo-store-review');
    if (!(await StoreReview.isAvailableAsync())) return;
    await StoreReview.requestReview();
    await save(markAsked(await load(), Date.now()));
  } catch {
    // 評分視窗出不來不影響使用。
  } finally {
    busy = false;
  }
}

async function update(step: (state: ReviewState, now: number) => { state: ReviewState; ask: boolean }) {
  if (Platform.OS !== 'ios') return;
  const next = step(await load(), Date.now());
  await save(next.state);
  if (next.ask) void ask();
}

export const reviewPrompt = {
  /** 開場動畫或登入選擇還在畫面上時設成 true。 */
  setBlocked(value: boolean) { blocked = value; },
  noteOpen() { void update(recordOpen); },
  noteReport(jobId: string) { void update((state, now) => recordReport(state, jobId, now)); }
};
