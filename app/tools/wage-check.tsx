import { useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, radius, space } from '@/src/theme/tokens';
import { IconCircle, Screen, SegmentedControl, Surface, T } from '@/src/ui';
import {
  MINIMUM_WAGE_SOURCE_URL, checkMinimumWage, minimumWageFor, thresholdFor, wageTypeLabels, type WageType
} from '@/src/lib/minimumWage';

const types: WageType[] = ['monthly', 'hourly', 'daily', 'annual'];
const money = (n: number) => `${Math.round(n).toLocaleString('zh-TW')} 元`;

/** 基本工資檢查（Figma「基本工資檢查」）：選計薪方式、輸入金額，馬上對照當年度基本工資。 */
export default function WageCheckScreen() {
  const [type, setType] = useState<WageType>('monthly');
  const [amount, setAmount] = useState('');
  const today = useMemo(() => new Date(), []);
  const current = minimumWageFor(today);
  const value = Number(amount.replace(/[,，\s]/g, ''));
  const entered = amount.trim() !== '' && Number.isFinite(value) && value > 0;
  const check = entered ? checkMinimumWage({ min: value, type }, today) : null;
  const scaleMax = check && check.status !== 'unknown' ? Math.max(check.offered, check.threshold) * 1.08 : 1;

  return (
    <Screen>
      <SegmentedControl<WageType> value={type} onChange={setType} options={types.map(t => ({ value: t, label: wageTypeLabels[t] }))} />

      <Surface style={{ borderRadius: 26, gap: 8 }}>
        <T variant="captionStrong" muted>職缺寫的{wageTypeLabels[type]}（最低的那個數字）</T>
        <View style={styles.amountRow}>
          <TextInput
            accessibilityLabel={`${wageTypeLabels[type]}金額`}
            value={amount}
            onChangeText={setAmount}
            keyboardType="number-pad"
            placeholder={type === 'hourly' ? '190' : type === 'daily' ? '1500' : type === 'annual' ? '380000' : '28000'}
            placeholderTextColor={colors.placeholder}
            style={styles.amount}
          />
          <T variant="bodyStrong" muted>元</T>
        </View>
        <View style={styles.underline} />
      </Surface>

      {check?.status === 'below' ? (
        <Surface fill={colors.warningSoft} flat style={{ borderRadius: 26 }}>
          <View style={styles.resultHead}>
            <IconCircle icon="alert-circle" tone="caution" />
            <View style={{ flex: 1, gap: 1 }}>
              <T variant="heading" color={colors.warning}>比基本工資少 {money(check.threshold - check.offered)}</T>
              <T variant="caption" color={colors.textBody}>{check.year} 年{wageTypeLabels[check.type]}基本工資是 {money(check.threshold)}</T>
            </View>
          </View>
          <View style={styles.scale} accessible accessibilityLabel={`職缺 ${money(check.offered)}，基本工資 ${money(check.threshold)}`}>
            <View style={styles.track}><View style={[styles.fill, { width: `${(check.offered / scaleMax) * 100}%` }]} /></View>
            <View style={[styles.marker, { left: `${(check.threshold / scaleMax) * 100}%` }]} />
            <T variant="label" style={[styles.markerLabel, { left: `${(check.threshold / scaleMax) * 100}%` }]}>基本工資</T>
          </View>
          <T variant="caption" color={colors.textBody}>
            {check.type === 'hourly' ? '部分工時也適用時薪基本工資。' : '若是全職工作，雇主給的薪水不能低於基本工資。'}建議面試時問清楚怎麼計薪。
          </T>
          {check.stale ? <T variant="small" muted>基本工資已有新年度標準，實際差距可能更大。</T> : null}
        </Surface>
      ) : null}
      {check?.status === 'meets' ? (
        <Surface fill={colors.successSoft} flat style={{ borderRadius: 26 }}>
          <View style={styles.resultHead}>
            <IconCircle icon="checkmark-circle" tone="ok" />
            <View style={{ flex: 1, gap: 1 }}>
              <T variant="heading" color={colors.success}>沒有低於基本工資</T>
              <T variant="caption" color={colors.textBody}>{check.year} 年{wageTypeLabels[check.type]}基本工資是 {money(check.threshold)}</T>
            </View>
          </View>
          <T variant="caption" color={colors.textBody}>合不合理還要看工時、加班和實際工作內容。</T>
        </Surface>
      ) : null}
      {check?.status === 'unknown' ? (
        <T variant="small" muted>基本工資已有新年度標準，這裡的資料還沒更新，請以勞動部公告為準。</T>
      ) : null}

      {current ? (
        <Surface style={{ borderRadius: 26, paddingVertical: 6 }}>
          {types.map((t, i) => (
            <View key={t} style={[styles.row, i > 0 && styles.divider]}>
              <T variant="body" color={colors.textBody} style={{ flex: 1 }}>{current.rate.year} 年{wageTypeLabels[t]}{t === 'daily' ? '（時薪 × 8）' : t === 'annual' ? '（月薪 × 12）' : ''}</T>
              <T variant="bodyStrong">{money(thresholdFor(t, current.rate))}</T>
            </View>
          ))}
        </Surface>
      ) : null}
      <View style={styles.source}>
        <T variant="small" muted style={{ flex: 1 }}>日薪、年薪是換算的參考值；年薪若含年終獎金，月薪部分仍要達到基本工資。</T>
        <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(MINIMUM_WAGE_SOURCE_URL)} style={styles.link} hitSlop={6}>
          <T variant="captionStrong" color={colors.primary}>勞動部公告</T>
          <Ionicons name="open-outline" size={14} color={colors.primary} />
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  amount: { flex: 1, fontFamily: font.number, fontSize: 34, color: colors.text, paddingVertical: 4 },
  underline: { height: 2, borderRadius: 1, backgroundColor: colors.primary },
  resultHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  scale: { height: 40, marginHorizontal: 4 },
  track: { position: 'absolute', left: 0, right: 0, top: 8, height: 12, borderRadius: 6, backgroundColor: colors.surface, overflow: 'hidden' },
  fill: { height: 12, borderRadius: 6, backgroundColor: colors.warningIcon },
  marker: { position: 'absolute', top: 3, width: 3, height: 22, marginLeft: -1.5, borderRadius: 1.5, backgroundColor: colors.text },
  markerLabel: { position: 'absolute', top: 26, width: 60, marginLeft: -30, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 12 },
  divider: { borderTopWidth: 1, borderTopColor: colors.line },
  source: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.xs },
  link: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32, borderRadius: radius.sm }
});
