import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/src/theme/colors';

export type JobCardData = {
  id: string;
  job_title: string | null;
  display_company_name: string | null;
  salary_raw?: string | null;
  location_raw?: string | null;
};
type Props = {
  job: JobCardData;
  saved?: boolean;
  onPress: () => void;
  subtitle?: string;
};
/** Shared, accessible native job tile. No screenshot slicing or fake report data. */
export function JobCard({ job, saved = false, onPress, subtitle }: Props) {
  const meta = [job.salary_raw, job.location_raw].filter(Boolean).join(' · ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`查看體檢報告：${job.job_title || '未命名職缺'}，${job.display_company_name || '公司待確認'}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.row}>
        <View style={styles.icon}><Ionicons name="briefcase-outline" size={19} color={colors.primary} /></View>
        <View style={styles.main}>
          <Text style={styles.title} numberOfLines={2}>{job.job_title || '未命名職缺'}</Text>
          <Text style={styles.company} numberOfLines={2}>{job.display_company_name || '公司待確認'}</Text>
        </View>
        {saved ? <Ionicons name="bookmark" size={19} color={colors.primary} /> : null}
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </View>
      {meta ? <Text style={styles.meta}>{meta}</Text> : <Text style={styles.unknown}>薪資與工作地點待確認</Text>}
      {subtitle ? <Text style={styles.unknown}>{subtitle}</Text> : null}
    </Pressable>
  );
}
const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 17, padding: 15, gap: 12 },
  pressed: { opacity: 0.78, backgroundColor: colors.surfaceMuted },
  row: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  icon: { width: 41, height: 41, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  main: { flex: 1, gap: 4 },
  title: { fontSize: 16, fontWeight: '800', color: colors.text },
  company: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  meta: { fontSize: 13, fontWeight: '700', color: colors.primary },
  unknown: { fontSize: 12, color: colors.textMuted }
});
