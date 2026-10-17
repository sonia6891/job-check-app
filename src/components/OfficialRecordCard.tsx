import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { JobReport } from '@/src/types';
import { colors } from '@/src/theme/colors';

type RecordEntry = JobReport['official_records']['records'][number];
type Props = { record: RecordEntry; lawName: string; onSource: (url: string) => void };
export function OfficialRecordCard({ record, lawName, onSource }: Props) {
  return <View style={styles.card}>
    <View style={styles.top}>
      <Ionicons name="document-text" size={19} color={colors.warningIcon} />
      <Text style={styles.title}>{lawName}</Text>
    </View>
    <Text style={styles.muted}>{record.decision_date || '日期未提供'}{record.agency ? ` · ${record.agency}` : ''}</Text>
    {record.violation_summary ? <Text style={styles.body}>{record.violation_summary}</Text> : null}
    {record.law_article ? <Text style={styles.muted}>{record.law_article}</Text> : null}
    {record.source_url ? <Pressable accessibilityRole="link" style={styles.link} onPress={() => onSource(record.source_url!)}>
      <Text style={styles.linkText}>查看公開紀錄來源</Text><Ionicons name="open-outline" size={16} color={colors.primary}/>
    </Pressable> : <Text style={styles.muted}>這筆紀錄未附來源網址</Text>}
  </View>;
}
const styles = StyleSheet.create({
  card: { padding: 14, borderRadius: 18, backgroundColor: colors.surfaceMuted, gap: 8 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '800' },
  muted: { fontSize: 12, color: colors.textMuted, lineHeight: 19 },
  body: { fontSize: 13, color: colors.text, lineHeight: 21 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 44 },
  linkText: { color: colors.primary, fontWeight: '800', fontSize: 13 }
});
