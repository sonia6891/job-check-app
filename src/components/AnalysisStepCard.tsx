import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/src/theme/colors';
import { Chip } from '@/src/ui';

type Props = {
  title: string;
  hint: string;
  state: 'done' | 'warning' | 'running' | 'pending';
  number: number;
  last?: boolean;
};
/** 分析步驟的一列：警告不能看起來像成功（Figma「分析中」）。 */
export function AnalysisStepCard({ title, hint, state, number, last }: Props) {
  return <View style={[styles.row, !last && styles.divider]} accessibilityLabel={`${title}，${hint}`}>
    <View style={[styles.dot,
      state === 'done' && styles.done,
      state === 'warning' && styles.warning,
      state === 'running' && styles.running
    ]}>
      {state === 'done' ? <Ionicons name="checkmark" size={17} color="#FFFFFF" /> :
       state === 'warning' ? <Ionicons name="alert" size={17} color="#FFFFFF" /> :
       state === 'running' ? <Ionicons name="sync" size={16} color="#FFFFFF" /> :
       <Text style={styles.number}>{number}</Text>}
    </View>
    <View style={styles.body}>
      <Text style={[styles.title, state === 'pending' && { color: colors.textMuted }]}>{title}</Text>
      <Text style={styles.hint}>{hint}</Text>
    </View>
    {state === 'running' ? <Chip tone="coral" label="查詢中" /> : null}
  </View>;
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.line },
  dot: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.neutralSoft, alignItems: 'center', justifyContent: 'center' },
  done: { backgroundColor: colors.success },
  warning: { backgroundColor: colors.warningIcon },
  running: { backgroundColor: colors.primary },
  number: { color: colors.textMuted, fontSize: 13, fontWeight: '800' },
  body: { flex: 1, gap: 1 },
  title: { color: colors.text, fontSize: 15, fontWeight: '700' },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 19 }
});
