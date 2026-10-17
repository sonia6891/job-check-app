import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { JobReport } from '@/src/types';
import { colors, font } from '@/src/theme/tokens';

type Benchmark = JobReport['salary']['benchmarks'][number];
type Props = { benchmark: Benchmark; onSource: (url: string) => void };

/** 一筆官方職類薪資行情：一列，右邊是金額；有來源網址時整列可點。 */
export function SalaryBenchmarkCard({ benchmark, onSource }: Props) {
  const amount = Number.isFinite(benchmark.average_salary)
    ? Math.round(benchmark.average_salary).toLocaleString('zh-TW')
    : '—';
  const body = (
    <View style={styles.row}>
      <View style={styles.icon}><Ionicons name="briefcase" size={16} color={colors.textMuted} /></View>
      <View style={styles.details}>
        <Text style={styles.title} numberOfLines={1}>{benchmark.job_category || '官方職類參考'}</Text>
        <Text style={styles.muted} numberOfLines={1}>{benchmark.industry || '產業未分類'} · {benchmark.period || '期間未提供'} · {benchmark.source_name || '來源未提供'}</Text>
      </View>
      <Text style={styles.amount}>{amount}</Text>
      {benchmark.source_url ? <Ionicons name="open-outline" size={15} color={colors.primary} /> : null}
    </View>
  );
  return benchmark.source_url
    ? <Pressable accessibilityRole="link" accessibilityLabel={`${benchmark.job_category || '官方職類'}平均月薪 ${amount} 元，查看統計資料來源`}
        onPress={() => onSource(benchmark.source_url)} style={({ pressed }) => pressed && { opacity: 0.7 }}>{body}</Pressable>
    : body;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surfaceMuted, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, minHeight: 52 },
  icon: { backgroundColor: colors.surface, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  details: { flex: 1, gap: 2 },
  title: { fontSize: 14, fontWeight: '800', color: colors.text },
  muted: { fontSize: 11, lineHeight: 15, color: colors.textMuted },
  amount: { fontFamily: font.number, fontSize: 15, color: colors.text }
});
