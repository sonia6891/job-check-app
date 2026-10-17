import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/src/theme/colors';

export type CompareJob = {
  job_post_id: string;
  title: string | null;
  company_display_name: string | null;
  legal_company_name: string | null;
  company_match_status: 'confirmed' | 'probable' | 'unconfirmed';
  salary?: { raw?: string | null };
  location?: string | null;
  work_hours?: string | null;
  official_records_count: number;
  official_records_checked: boolean;
  official_records_status?: string | null;
  missing_information?: string[];
  conditions_to_confirm?: unknown[];
};

export function officialRecordsLabel(job: CompareJob): string {
  if (!job.official_records_checked) return '法人未確認，未關聯';
  if (job.official_records_status === 'failed') return '查詢失敗';
  if (job.official_records_status === 'processing' || job.official_records_status === 'pending') return '尚未查詢完成';
  if (job.official_records_status === 'partial') return `${job.official_records_count} 筆（部分資料集未查到）`;
  return job.official_records_count > 0 ? `${job.official_records_count} 筆` : '查無資料';
}

function DataRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.row}>
    <Text style={styles.label}>{label}</Text>
    <Text style={styles.value}>{value}</Text>
  </View>;
}

export function JobCompareResultCard({ job, onPress }: { job: CompareJob; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`查看${job.title || '職缺'}的完整報告`}
    onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}>
    <View style={styles.header}>
      <View style={styles.heading}>
        <Text style={styles.title}>{job.title || '未命名職缺'}</Text>
        <Text style={styles.company}>{job.legal_company_name || job.company_display_name || '公司待確認'}</Text>
        {job.company_match_status !== 'confirmed' ? <Text style={styles.warning}>法人身分尚未確認</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.primary}/>
    </View>
    <DataRow label="薪資" value={job.salary?.raw || '未提供'} />
    <DataRow label="工作地點" value={job.location || '未提供'} />
    <DataRow label="工作時間" value={job.work_hours || '未提供'} />
    <DataRow label="官方紀錄" value={officialRecordsLabel(job)} />
    <DataRow label="待確認" value={`${job.conditions_to_confirm?.length ?? 0} 項條件 · ${job.missing_information?.length ?? 0} 項缺漏`} />
  </Pressable>;
}
const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, borderRadius: 17, padding: 16, gap: 11 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: colors.line },
  heading: { flex: 1, gap: 4 },
  title: { color: colors.text, fontSize: 16, fontWeight: '900' },
  company: { color: colors.textMuted, fontSize: 13 },
  warning: { color: colors.warning, fontSize: 12, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  label: { width: 75, color: colors.textMuted, fontSize: 12, lineHeight: 20 },
  value: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '700', lineHeight: 20 }
});

type CompareRow = { label: string; value: (job: CompareJob) => string; warn?: (job: CompareJob) => boolean };
const compareRows: CompareRow[] = [
  { label: '公司', value: j => j.legal_company_name || j.company_display_name || '公司待確認', warn: j => j.company_match_status !== 'confirmed' },
  { label: '薪資', value: j => j.salary?.raw || '沒寫', warn: j => !j.salary?.raw },
  { label: '工作地點', value: j => j.location || '沒寫', warn: j => !j.location },
  { label: '上班時間', value: j => j.work_hours || '沒寫', warn: j => !j.work_hours },
  { label: '官方紀錄', value: officialRecordsLabel, warn: j => j.official_records_count > 0 || j.official_records_status === 'failed' },
  { label: '待確認', value: j => `${j.conditions_to_confirm?.length ?? 0} 項條件・${j.missing_information?.length ?? 0} 項沒寫` }
];

/**
 * 並排比較表（Figma「比較職缺」）：每一列一個條件，各職缺的值左右並排。
 * 只並列原文與公開資料，不選「哪個最好」；超過 2 份時可以左右滑。
 */
export function CompareTable({ jobs, onOpen }: { jobs: CompareJob[]; onOpen: (jobPostId: string) => void }) {
  const wide = jobs.length > 2;
  const cell = wide ? { width: 150 } : { flex: 1 };
  const body = (
    <View>
      <View style={table.row}>
        {jobs.map(j => (
          <Pressable key={j.job_post_id} accessibilityRole="button" accessibilityLabel={`查看${j.title || '職缺'}的完整報告`}
            onPress={() => onOpen(j.job_post_id)} style={({ pressed }) => [table.head, cell, pressed && { opacity: 0.75 }]}>
            <Text style={table.title} numberOfLines={2}>{j.title || '未命名職缺'}</Text>
            <Text style={table.link}>看報告 ›</Text>
          </Pressable>
        ))}
      </View>
      {compareRows.map(r => (
        <View key={r.label} style={table.block}>
          <Text style={table.label}>{r.label}</Text>
          <View style={table.row}>
            {jobs.map(j => (
              <Text key={j.job_post_id} style={[table.value, cell, r.warn?.(j) ? table.warn : null]}>{r.value(j)}</Text>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
  return (
    <View style={table.card}>
      {wide ? <ScrollView horizontal showsHorizontalScrollIndicator={false}>{body}</ScrollView> : body}
    </View>
  );
}
const table = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 26, padding: 16, shadowColor: '#8A5A2B', shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  row: { flexDirection: 'row', gap: 10 },
  head: { backgroundColor: colors.primarySoft, borderRadius: 18, padding: 12, gap: 4 },
  title: { color: colors.text, fontSize: 15, fontWeight: '800', lineHeight: 21 },
  link: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  block: { paddingVertical: 12, gap: 6, borderBottomWidth: 1, borderBottomColor: colors.line },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  value: { color: colors.text, fontSize: 14, fontWeight: '700', lineHeight: 20 },
  warn: { color: colors.warning }
});
