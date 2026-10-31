/**
 * 職缺體檢設計系統元件（溫暖友善版，對應 Figma「02 設計系統」）。
 * 新頁面只用這裡的元件與 src/theme/tokens.ts，不再各頁自訂顏色與按鈕。
 */
import { Children, useCallback, useState, type PropsWithChildren, type ReactNode, type RefObject } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View,
  type StyleProp, type TextProps, type TextStyle, type ViewStyle
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, gradient, radius, shadow, space, tone as toneStyles, type, type Tone } from '@/src/theme/tokens';
import { useLayout, type Layout } from './layout';

export { columnsFor, useLayout } from './layout';

export type IconName = keyof typeof Ionicons.glyphMap;
type TextVariant = Exclude<keyof typeof type, 'number'>;

/* ---------- 版面 ---------- */

/**
 * 一頁的外框：奶油底、可捲動。
 * header 放在捲動內容最上方、不加左右邊距；safeTop 讓出瀏海（沒有導覽列的頁面用）；
 * tabBar 為 true 時底部多留空間給浮動分頁列；footer 固定在底部（例如主要動作列）。
 * 平板上頁首和內容收在置中的一欄，奶油底仍然滿版；wide 給放得下兩欄的頁面用更寬的一欄（搭配 Columns）。
 * 左右也讓出安全區：iPhone Duo 外螢幕的相機和狀態列在右側，只有一邊有。
 */
export function Screen({ children, header, hero, footer, safeTop, tabBar, scroll = true, contentStyle, scrollRef, wide }: PropsWithChildren<{
  header?: ReactNode; /** @deprecated 用 header */ hero?: ReactNode; footer?: ReactNode; safeTop?: boolean; tabBar?: boolean;
  scroll?: boolean; contentStyle?: StyleProp<ViewStyle>; scrollRef?: RefObject<ScrollView | null>; wide?: boolean;
}>) {
  const insets = useSafeAreaInsets();
  const layout = useLayout();
  const width = wide ? layout.wideWidth : layout.readingWidth;
  const column = columnStyle(layout, width);
  const top = header ?? hero;
  const padTop = safeTop || hero ? insets.top + space.sm : 0;
  const padBottom = tabBar ? 120 : footer ? space.xxl : 48;
  const body = (
    <>
      {top}
      <View style={[styles.content, contentStyle]}>{children}</View>
    </>
  );
  return (
    <View style={[styles.screen, { paddingLeft: insets.left, paddingRight: insets.right }]}>
      {scroll
        ? <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled"><View style={[column, { paddingTop: padTop, paddingBottom: padBottom }]}>{body}</View></ScrollView>
        : <View style={[column, { flex: 1, paddingTop: padTop }]}>{body}</View>}
      {footer ? <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.lg) }, !layout.compact && { alignSelf: 'center', width }]}>{footer}</View> : null}
      {/* 往下捲時內容不會疊到時間、電池那一列。 */}
      {padTop ? <View pointerEvents="none" style={[styles.statusBarBackdrop, { height: insets.top }]} /> : null}
    </View>
  );
}

/**
 * 置中的那一欄。內容區自己有 16 的左右邊距（頁首是 20），這裡只補到 gutter 的差額，
 * 頁首和卡片的對齊關係才會和手機一樣。手機不套任何樣式。
 */
function columnStyle(layout: Layout, width: number): ViewStyle | null {
  if (layout.compact) return null;
  return { alignSelf: 'center', width: '100%', maxWidth: width + layout.gutter * 2, paddingHorizontal: layout.gutter - space.lg };
}

/**
 * 寬螢幕並排兩欄（搭配 <Screen wide>）；其他寬度上下接著排，和一欄的版面完全相同。
 * 兩種寬度的元件樹一樣，視窗變寬變窄時輸入框不會重新掛載、丟掉焦點。
 */
export function Columns({ children, aside }: PropsWithChildren<{ aside: ReactNode }>) {
  const { wide } = useLayout();
  return (
    <View style={wide ? styles.columns : styles.stack}>
      <View style={wide ? styles.column : styles.stack}>{children}</View>
      <View style={wide ? styles.column : styles.stack}>{aside}</View>
    </View>
  );
}

/** 卡片格線，同一列等高；columns 為 1 時就是一般的直排清單。最後一列放不滿時留白，不會把卡片撐寬。 */
export function CardGrid({ columns, gap, children }: PropsWithChildren<{ columns: number; gap: number }>) {
  const items = Children.toArray(children);
  const rows = Array.from({ length: Math.ceil(items.length / columns) }, (_, r) => items.slice(r * columns, (r + 1) * columns));
  return (
    <View style={{ gap }}>
      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row', gap }}>
          {row.map((item, i) => <View key={i} style={styles.gridCell}>{item}</View>)}
          {Array.from({ length: columns - row.length }, (_, i) => <View key={`empty-${i}`} style={styles.gridCell} />)}
        </View>
      ))}
    </View>
  );
}

/** @deprecated 舊的深藍頁首。溫暖版沒有色塊頁首，保留給還沒改寫的畫面，只是加上左右邊距。 */
export function Hero({ children, style }: PropsWithChildren<{ safeTop?: boolean; overlap?: number; style?: StyleProp<ViewStyle> }>) {
  return <View style={[{ paddingHorizontal: 20, paddingTop: space.sm, paddingBottom: space.lg, gap: space.lg }, style]}>{children}</View>;
}

/**
 * 只在這頁顯示時套用的狀態列樣式。分頁與堆疊底下的頁面不會卸載，
 * 直接放 StatusBar 會蓋掉其他頁的設定；離開這頁就移除，回到外層預設（深色字）。
 */
export function FocusStatusBar({ style }: { style: 'light' | 'dark' }) {
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));
  return focused ? <StatusBar style={style} /> : null;
}

/** 文字：一律從字級表挑，不在頁面裡另外寫 fontSize。 */
export function T({ variant = 'body', muted, color, style, ...rest }: TextProps & { variant?: TextVariant; muted?: boolean; color?: string }) {
  return <Text {...rest} style={[type[variant], { color: color ?? (muted ? colors.textMuted : colors.text) }, style as StyleProp<TextStyle>]} />;
}

/** 數字（薪資、次數、時間）：Inter。 */
export function Num({ size = 15, color = colors.text, weight = '800', regular, style, ...rest }: TextProps & {
  size?: number; color?: string; weight?: '600' | '700' | '800'; /** @deprecated */ regular?: boolean;
}) {
  const family = regular || weight === '600' ? font.numberSemi : weight === '700' ? font.numberBold : font.number;
  return <Text {...rest} style={[{ fontFamily: family, fontSize: size, lineHeight: Math.round(size * 1.25), color }, style as StyleProp<TextStyle>]} />;
}

/** 區塊標題，右邊可放「全部」之類的連結。 */
export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionTitle}>
      <T variant="heading" style={{ flex: 1 }} accessibilityRole="header">{title}</T>
      {action ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8} disabled={!onAction}>
          <T variant="captionStrong" color={colors.primary}>{action}</T>
        </Pressable>
      ) : null}
    </View>
  );
}
/** @deprecated 用 SectionTitle */
export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return <View style={styles.sectionTitle}><T variant="heading" style={{ flex: 1 }}>{title}</T>{action}</View>;
}

/** 白色圓胖卡片。fill 可換成語意淺底（例如警示卡、小提醒）。 */
export function Surface({ title, right, children, style, padded = true, fill, flat }: PropsWithChildren<{
  title?: string; right?: ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean; fill?: string; flat?: boolean;
}>) {
  return (
    <View style={[styles.surface, !flat && shadow.card, fill ? { backgroundColor: fill } : null, padded && styles.surfacePadded, style]}>
      {title || right ? (
        <View style={styles.surfaceHead}>
          {title ? <T variant="heading" style={{ flex: 1 }}>{title}</T> : <View style={{ flex: 1 }} />}
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

/** 內頁上方：左圓形返回、中標題、右側動作。沒有原生導覽列的頁面用。 */
export function NavBar({ title, right, onBack, backIcon = 'chevron-back' }: { title?: string; right?: ReactNode; onBack?: () => void; backIcon?: IconName }) {
  const back = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')));
  return (
    <View style={styles.navBar}>
      <IconButton icon={backIcon} label={backIcon === 'close' ? '關閉' : '返回'} onPress={back} />
      <T variant="subhead" style={{ flex: 1, textAlign: 'center' }} numberOfLines={1} accessibilityRole="header">{title ?? ''}</T>
      {right ?? <View style={{ width: 44 }} />}
    </View>
  );
}

/** 圓形狀態圖示（清單與卡片左側）。 */
export function IconCircle({ icon, tone = 'neutral', size = 44, coral, solid }: { icon: IconName; tone?: Tone; size?: number; coral?: boolean; solid?: boolean }) {
  const t = toneStyles[tone];
  const bg = coral ? colors.primarySoft : solid ? t.iconColor : t.bg;
  const fg = coral ? colors.primary : solid ? '#FFFFFF' : t.iconColor;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={Math.round(size * 0.5)} color={fg} />
    </View>
  );
}
/** @deprecated 用 IconCircle */
export function IconTile({ icon, tone = 'info', size = 38 }: { icon: IconName; tone?: Tone; size?: number }) {
  return <IconCircle icon={icon} tone={tone} size={size} />;
}

/* ---------- 動作 ---------- */

type ButtonVariant = 'primary' | 'soft' | 'secondary' | 'white' | 'outline' | 'danger' | 'ghost';
const buttonVariants: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.primary, fg: '#FFFFFF', border: 'transparent' },
  soft: { bg: colors.primarySoft, fg: colors.primary, border: 'transparent' },
  secondary: { bg: colors.primarySoft, fg: colors.primary, border: 'transparent' },
  white: { bg: colors.surface, fg: colors.primary, border: 'transparent' },
  outline: { bg: 'transparent', fg: colors.text, border: colors.lineStrong },
  danger: { bg: colors.dangerFill, fg: '#FFFFFF', border: 'transparent' },
  ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' }
};
export function Button({ label, onPress, variant = 'primary', icon, loading, disabled, compact, accessibilityLabel }: {
  label: string; onPress: () => void; variant?: ButtonVariant; icon?: IconName;
  loading?: boolean; disabled?: boolean; compact?: boolean; accessibilityLabel?: string;
}) {
  const v = buttonVariants[variant];
  const off = disabled || loading;
  const content = loading ? <ActivityIndicator color={v.fg} /> : (
    <>
      {icon ? <Ionicons name={icon} size={compact ? 16 : 19} color={v.fg} /> : null}
      <Text style={[compact ? type.captionStrong : type.subhead, { color: v.fg, fontWeight: '800' }]}>{label}</Text>
    </>
  );
  const box = [styles.button, compact && styles.buttonCompact, { borderColor: v.border }];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [variant === 'primary' && !off && !compact && shadow.button, { borderRadius: compact ? radius.sm : radius.lg },
        pressed && !off && { opacity: 0.85, transform: [{ scale: 0.99 }] }, off && { opacity: 0.5 }]}
    >
      {variant === 'primary'
        ? <LinearGradient colors={gradient.primary} style={box}>{content}</LinearGradient>
        : <View style={[box, { backgroundColor: v.bg }]}>{content}</View>}
    </Pressable>
  );
}

/** 圓形按鈕（返回、分享、收藏）。 */
export function IconButton({ icon, label, onPress, active, soft, size = 44 }: {
  icon: IconName; label: string; onPress: () => void; active?: boolean; soft?: boolean; /** @deprecated */ dark?: boolean; size?: number;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: !!active }}
      onPress={onPress} hitSlop={6}
      style={({ pressed }) => [{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: soft || active ? colors.primarySoft : colors.surface },
        !soft && !active && shadow.card, pressed && { opacity: 0.7 }]}>
      <Ionicons name={icon} size={Math.round(size * 0.48)} color={soft || active ? colors.primary : colors.text} />
    </Pressable>
  );
}

/* ---------- 狀態 ---------- */

type ChipTone = Tone | 'coral' | 'white';
const chipColors = (t: ChipTone) => t === 'coral' ? { bg: colors.primarySoft, fg: colors.primary }
  : t === 'white' ? { bg: colors.surface, fg: colors.textBody }
  : t === 'neutral' ? { bg: colors.neutralSoft, fg: colors.textBody }
  : { bg: toneStyles[t].bg, fg: toneStyles[t].fg };

/** 小標籤：狀態或條件。顏色只表示嚴重程度，不打分數。 */
export function Chip({ label, tone = 'neutral' }: { label: string; tone?: ChipTone }) {
  const c = chipColors(tone);
  return <View style={[styles.chip, { backgroundColor: c.bg }]}><Text style={[type.captionStrong, { color: c.fg }]}>{label}</Text></View>;
}
/** @deprecated 用 Chip */
export function StatusPill({ tone, label }: { tone: Tone; label: string }) {
  return <Chip tone={tone} label={label} />;
}

/** 一列查核結果：狀態圓圖示、名稱、結果；可點擊前往細節。 */
export function CheckRow({ tone, title, value, detail, icon, onPress, last }: {
  tone: Tone; title: string; value: string; detail?: string | null; icon?: IconName; onPress?: () => void; last?: boolean;
}) {
  const t = toneStyles[tone];
  const body = (
    <View style={[styles.checkRow, !last && styles.divider]}>
      <IconCircle icon={icon ?? (t.icon as IconName)} tone={tone} size={40} />
      <View style={{ flex: 1, gap: 1 }}>
        <T variant="small" muted>{title}</T>
        <T variant="bodyStrong" color={tone === 'neutral' || tone === 'info' ? colors.text : t.fg}>{value}</T>
        {detail ? <T variant="small" muted numberOfLines={2}>{detail}</T> : null}
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={18} color={colors.placeholder} /> : null}
    </View>
  );
  return onPress
    ? <Pressable accessibilityRole="button" accessibilityLabel={`${title}：${value}`} onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.7 }}>{body}</Pressable>
    : body;
}

/** 有語意淺底的提醒框。 */
export function Notice({ tone, title, children, icon }: PropsWithChildren<{ tone: Tone; title?: string; icon?: IconName }>) {
  const t = toneStyles[tone];
  return (
    <View style={[styles.notice, { backgroundColor: t.bg }]} accessibilityRole={tone === 'danger' || tone === 'caution' ? 'alert' : undefined}>
      {title ? (
        <View style={styles.noticeHead}>
          <Ionicons name={icon ?? (t.icon as IconName)} size={18} color={t.iconColor} />
          <T variant="bodyStrong" color={t.fg} style={{ flex: 1 }}>{title}</T>
        </View>
      ) : null}
      {typeof children === 'string' ? <T variant="caption" color={colors.textBody}>{children}</T> : children}
    </View>
  );
}

/** 篩選籤（一排可捲動的膠囊）。選中的是深色底。 */
export function Segmented<K extends string>({ value, options, onChange }: {
  value: K; options: Array<{ value: K; label: string; count?: number }>; onChange: (v: K) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.segmented} accessibilityRole="tablist">
      {options.map(o => {
        const active = o.value === value;
        return (
          <Pressable key={o.value} accessibilityRole="tab" accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)} style={[styles.segment, active && styles.segmentActive]}>
            <Text style={[type.captionStrong, { color: active ? '#FFFFFF' : colors.textBody }]}>
              {o.label}{typeof o.count === 'number' ? ` ${o.count}` : ''}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** 分段切換（米色底、白色選中塊），例如月薪／時薪、貼文字／網址。 */
export function SegmentedControl<K extends string>({ value, options, onChange }: {
  value: K; options: Array<{ value: K; label: string }>; onChange: (v: K) => void;
}) {
  return (
    <View style={styles.segControl} accessibilityRole="tablist">
      {options.map(o => {
        const active = o.value === value;
        return (
          <Pressable key={o.value} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => onChange(o.value)}
            style={[styles.segControlItem, active && styles.segControlActive]}>
            <Text style={[active ? type.captionStrong : type.caption, { color: active ? colors.text : colors.textMuted }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** 空狀態、錯誤狀態。 */
export function Empty({ icon, title, body, action }: { icon: IconName; title: string; body?: string; action?: ReactNode }) {
  return (
    <View style={[styles.empty, shadow.card]}>
      <IconCircle icon={icon} coral size={56} />
      <T variant="heading" style={{ textAlign: 'center' }}>{title}</T>
      {body ? <T variant="caption" muted style={{ textAlign: 'center' }}>{body}</T> : null}
      {action}
    </View>
  );
}

export { colors };

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  statusBarBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.lg, gap: space.lg },
  stack: { gap: space.lg },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xxl },
  column: { flex: 1, minWidth: 0, gap: space.lg },
  gridCell: { flex: 1, minWidth: 0 },
  footer: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl, paddingHorizontal: space.lg, paddingTop: space.md + 2, ...shadow.bar },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.xs, marginTop: space.xs },
  surface: { backgroundColor: colors.surface, borderRadius: 22, gap: space.md },
  surfacePadded: { padding: space.lg },
  surfaceHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  navBar: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingVertical: 2 },
  button: { minHeight: 52, borderRadius: radius.lg, borderWidth: 1.5, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  buttonCompact: { minHeight: 40, paddingHorizontal: 14, borderRadius: radius.sm, gap: 6 },
  chip: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.line },
  notice: { borderRadius: 18, padding: 14, gap: space.sm },
  noticeHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  segmented: { gap: space.sm, paddingVertical: 2, paddingHorizontal: space.xs },
  segment: { minHeight: 36, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: colors.text, borderColor: colors.text },
  segControl: { flexDirection: 'row', gap: 4, backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: 4 },
  segControlItem: { flex: 1, minHeight: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  segControlActive: { backgroundColor: colors.surface, ...shadow.card },
  empty: { alignItems: 'center', gap: space.sm, paddingVertical: space.xxl + 8, paddingHorizontal: space.xl, backgroundColor: colors.surface, borderRadius: 22 }
});
