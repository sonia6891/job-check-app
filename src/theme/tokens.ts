import { colors } from './colors';

/**
 * 職缺體檢設計系統（2026-10-17「溫暖友善」版，對應 Figma「02 設計系統」）。
 * 版面規則：奶油米底，白色圓胖卡片承載資訊，珊瑚橘只用在主要動作與品牌；
 * 結論用口語寫（「有 1 個地雷」），狀態一律用語意色。數字用 Inter。
 * Figma：https://www.figma.com/design/QmooRDInsOnbOUZ0qIRWHD
 */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 } as const;
export const radius = { sm: 12, md: 16, lg: 20, xl: 24, xxl: 28, pill: 999 } as const;

export const font = { number: 'Inter_800ExtraBold', numberBold: 'Inter_700Bold', numberSemi: 'Inter_600SemiBold' } as const;

export const type = {
  display: { fontSize: 30, lineHeight: 40, fontWeight: '900' as const, letterSpacing: -0.3 },
  title: { fontSize: 23, lineHeight: 33, fontWeight: '900' as const },
  heading: { fontSize: 18, lineHeight: 26, fontWeight: '900' as const },
  subhead: { fontSize: 16, lineHeight: 24, fontWeight: '700' as const },
  body: { fontSize: 15, lineHeight: 23, fontWeight: '400' as const },
  bodyStrong: { fontSize: 15, lineHeight: 23, fontWeight: '700' as const },
  caption: { fontSize: 13, lineHeight: 20, fontWeight: '400' as const },
  captionStrong: { fontSize: 13, lineHeight: 20, fontWeight: '700' as const },
  small: { fontSize: 12, lineHeight: 17, fontWeight: '400' as const },
  label: { fontSize: 11, lineHeight: 16, fontWeight: '700' as const, letterSpacing: 0.2 },
  number: { fontVariant: ['tabular-nums'] as ('tabular-nums')[] }
} as const;

/** 檢查結果的語意狀態：每一項查核都歸到其中一種，介面顏色與圖示跟著它走。 */
export type Tone = 'danger' | 'caution' | 'ok' | 'info' | 'neutral';

/** fg 文字、icon 圖示、bg 淺底、bar 圖表用的亮色。 */
export const tone: Record<Tone, { fg: string; iconColor: string; bg: string; bar: string; icon: string }> = {
  danger: { fg: colors.danger, iconColor: colors.dangerFill, bg: colors.dangerSoft, bar: colors.dangerFill, icon: 'warning' },
  caution: { fg: colors.warning, iconColor: colors.warningIcon, bg: colors.warningSoft, bar: colors.accent, icon: 'alert-circle' },
  ok: { fg: colors.success, iconColor: colors.success, bg: colors.successSoft, bar: colors.success, icon: 'checkmark-circle' },
  info: { fg: colors.info, iconColor: colors.info, bg: colors.infoSoft, bar: colors.info, icon: 'information-circle' },
  neutral: { fg: colors.textMuted, iconColor: colors.textMuted, bg: colors.neutralSoft, bar: colors.lineStrong, icon: 'ellipse-outline' }
};

export const gradient = {
  primary: ['#FF7D5E', '#FF6B4A'] as const,
  danger: ['#E5484D', '#D9383D'] as const
};

/** 珊瑚色卡片上的文字與半透明層。 */
export const onBrand = {
  text: '#FFFFFF',
  muted: 'rgba(255,255,255,0.88)',
  chip: 'rgba(255,255,255,0.22)',
  track: 'rgba(255,255,255,0.35)'
} as const;

/** @deprecated 舊的深藍頁首用色；畫面改寫完就移除。 */
export const onDark = {
  text: colors.text,
  muted: colors.textMuted,
  chip: colors.neutralSoft,
  chipText: colors.textBody,
  panel: colors.surface,
  panelBorder: colors.line
} as const;

const warm = '#8A5A2B';
export const shadow = {
  card: { shadowColor: warm, shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  float: { shadowColor: warm, shadowOpacity: 0.14, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  coral: { shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 6 },
  danger: { shadowColor: colors.dangerFill, shadowOpacity: 0.1, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  button: { shadowColor: colors.primary, shadowOpacity: 0.28, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  bar: { shadowColor: warm, shadowOpacity: 0.12, shadowRadius: 20, shadowOffset: { width: 0, height: -6 }, elevation: 8 }
} as const;

export { colors };
