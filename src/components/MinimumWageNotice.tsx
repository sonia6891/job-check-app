import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/src/theme/colors';
import { wageTypeLabels, type MinimumWageCheck } from '@/src/lib/minimumWage';

const money = (n: number) => `${Math.round(n).toLocaleString('zh-TW')} 元`;

/** 只在職缺薪資低於基本工資時出現；用提醒口吻，不下法律結論。 */
export function MinimumWageNotice({ check }: { check: MinimumWageCheck }) {
  if (check.status !== 'below') return null;
  const label = wageTypeLabels[check.type];
  const standard = check.type === 'daily'
    ? `依 ${check.year} 年基本工資換算的 ${money(check.threshold)}（時薪 × 8 小時）`
    : check.type === 'annual'
      ? `依 ${check.year} 年基本工資換算的 ${money(check.threshold)}（月薪 × 12 個月）`
      : ` ${check.year} 年基本工資 ${money(check.threshold)}`;
  const rule = check.type === 'hourly'
    ? '部分工時也適用時薪基本工資。'
    : '若是全職工作，雇主給付的薪資不得低於基本工資。';
  return (
    <View style={styles.box} accessibilityRole="alert">
      <View style={styles.head}>
        <Ionicons name="alert-circle" size={18} color={colors.warningIcon} />
        <Text style={styles.title}>{label}低於基本工資</Text>
      </View>
      <Text style={styles.body}>{`職缺寫的${label} ${money(check.offered)}，低於${standard}。${rule}建議面試時確認實際計薪方式。`}</Text>
      {check.stale ? <Text style={styles.foot}>基本工資已有新年度標準，實際差距可能更大。</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: colors.warningSoft, borderRadius: 20, padding: 14, gap: 6 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { flex: 1, color: colors.warning, fontWeight: '800', fontSize: 15 },
  body: { color: colors.textBody, fontSize: 13, lineHeight: 21 },
  foot: { color: colors.textMuted, fontSize: 12, lineHeight: 18 }
});
