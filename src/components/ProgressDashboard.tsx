import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/src/theme/colors';

export const progressStatuses = [
  'saved', 'applied', 'interview_1', 'interview_2', 'offer', 'accepted', 'rejected', 'withdrawn'
] as const;
export type ProgressStatus = typeof progressStatuses[number];
export const progressLabels: Record<ProgressStatus, string> = {
  saved: '收藏', applied: '已投遞', interview_1: '一面', interview_2: '二面',
  offer: 'Offer', accepted: '已接受', rejected: '未錄取', withdrawn: '已放棄'
};
export function isClosedProgress(status: string | null | undefined) {
  return status === 'accepted' || status === 'rejected' || status === 'withdrawn';
}
export function progressSummary(rows: Array<{ status: string | null }>) {
  return {
    total: rows.length,
    active: rows.filter(row => !isClosedProgress(row.status)).length,
    interviewing: rows.filter(row => row.status === 'interview_1' || row.status === 'interview_2').length,
    offers: rows.filter(row => row.status === 'offer').length,
    ended: rows.filter(row => isClosedProgress(row.status)).length
  };
}

export function ProgressDashboard({ rows }: { rows: Array<{ status: string | null }> }) {
  const summary = progressSummary(rows);
  const tiles = [
    { label: '追蹤中', value: summary.active, color: colors.primary },
    { label: '面試中', value: summary.interviewing, color: colors.success },
    { label: 'Offer', value: summary.offers, color: colors.warning },
    { label: '已結束', value: summary.ended, color: colors.textMuted }
  ];
  return <View style={styles.card}>
    {tiles.map(item => <View key={item.label} style={styles.tile} accessible accessibilityLabel={`${item.label} ${item.value} 份`}>
      <Text style={[styles.value, { color: item.color }]}>{item.value}</Text>
      <Text style={styles.label}>{item.label}</Text>
    </View>)}
  </View>;
}

export function ProgressStatusSelector({ value, disabled, onChange }: {
  value: string; disabled?: boolean; onChange: (status: ProgressStatus) => void
}) {
  return <View style={styles.chips}>
    {progressStatuses.map(status => <Pressable key={status} accessibilityRole="button"
      accessibilityState={{ selected: status === value, disabled: !!disabled }}
      disabled={disabled}
      onPress={() => onChange(status)}
      style={({ pressed }) => [styles.chip, status === value && styles.chipActive, pressed && styles.pressed]}>
      <Text style={[styles.chipText, status === value && styles.chipTextActive]}>{progressLabels[status]}</Text>
    </Pressable>)}
  </View>;
}
const styles = StyleSheet.create({
  card: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 26, paddingVertical: 16, paddingHorizontal: 8, shadowColor: '#8A5A2B', shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  tile: { flex: 1, alignItems: 'center', gap: 0 },
  value: { fontSize: 22, lineHeight: 28, fontFamily: 'Inter_800ExtraBold' },
  label: { fontSize: 13, color: colors.textMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 38, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1.5, borderColor: colors.lineStrong, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.text, borderColor: colors.text },
  pressed: { opacity: 0.7 },
  chipText: { color: colors.textBody, fontWeight: '700', fontSize: 13 },
  chipTextActive: { color: '#FFFFFF' }
});
