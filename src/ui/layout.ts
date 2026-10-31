/**
 * 版面寬度規則（iPad、iPhone Duo）。視窗大小隨時會變（旋轉、分割畫面、摺疊機開合），
 * 一律在畫面裡用 useLayout 讀，不要在模組載入時讀一次就記住。
 *
 * - compact（寬度 < 600）：手機、Duo 外螢幕、iPad 窄分割畫面。維持手機版，內容滿版。
 * - regular（600 ～ 899）：Duo 內螢幕直放、iPad 11 吋直放、iPad 分割畫面。一欄置中。
 * - wide（900 以上）：iPad 13 吋、iPad 橫放、Duo 內螢幕橫放。放得下的頁面改成兩欄。
 *
 * 奶油底永遠滿版，只有內容收在中間這一欄。
 */
import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { space } from '@/src/theme/tokens';

export const REGULAR_FROM = 600;
export const WIDE_FROM = 900;
/** 閱讀欄的卡片寬度：報告、方案、說明頁這些一路往下讀的頁面。 */
export const READING_WIDTH = 720;
/** 兩欄頁面的總寬度。 */
export const WIDE_WIDTH = 1080;
/** 浮動分頁列最寬到這裡，四個分頁再拉長只會變得鬆散。 */
export const TAB_BAR_WIDTH = 480;
/** 置中對話框（核對職缺、分享）的寬度。 */
export const DIALOG_WIDTH = 560;
/** 引導頁按鈕最寬到這裡，整條拉滿在大螢幕上不像按鈕。 */
export const ACTION_WIDTH = 420;

export type SizeClass = 'compact' | 'regular' | 'wide';

export function layoutFor(width: number, height: number) {
  const size: SizeClass = width >= WIDE_FROM ? 'wide' : width >= REGULAR_FROM ? 'regular' : 'compact';
  const compact = size === 'compact';
  const gutter = size === 'wide' ? 32 : size === 'regular' ? 24 : space.lg;
  const available = Math.max(0, width - gutter * 2);
  return {
    width,
    height,
    size,
    compact,
    wide: size === 'wide',
    /** 左右留白。 */
    gutter,
    /** 一欄頁面的卡片寬度。 */
    readingWidth: compact ? available : Math.min(available, READING_WIDTH),
    /** 兩欄頁面的總寬度（兩欄加中間的間距）。 */
    wideWidth: compact ? available : Math.min(available, WIDE_WIDTH)
  };
}

export type Layout = ReturnType<typeof layoutFor>;

export function useLayout(): Layout {
  const { width, height } = useWindowDimensions();
  return useMemo(() => layoutFor(width, height), [width, height]);
}

/** 這個寬度能放幾張至少 minWidth 寬的卡片。手機一定是 1。 */
export function columnsFor(available: number, minWidth: number, gap: number, max = 3) {
  return Math.max(1, Math.min(max, Math.floor((available + gap) / (minWidth + gap))));
}
