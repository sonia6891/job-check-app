import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/src/theme/colors';
import { isClosedProgress, progressLabels, type ProgressStatus } from '@/src/components/ProgressDashboard';

const STEPS: ProgressStatus[] = ['saved', 'applied', 'interview_1', 'interview_2', 'offer'];

/**
 * 求職步驟條（Figma「求職進度」）：收藏 → 已投遞 → 一面 → 二面 → Offer。
 * 已接受／未錄取／已放棄是結果，不在步驟上，改在下方顯示一行結果。
 */
export function ProgressStepper({ status }: { status: string | null }) {
  const key = (status || 'saved') as ProgressStatus;
  const current = STEPS.indexOf(key);
  const closed = isClosedProgress(status);
  return (
    <View style={{ gap: 10 }} accessible accessibilityLabel={`目前進度：${progressLabels[key] ?? status}`}>
      <View style={styles.row}>
        {STEPS.map((step, i) => {
          const done = closed ? status === 'accepted' : i < current;
          const now = !closed && i === current;
          return (
            <View key={step} style={styles.step}>
              {i > 0 ? <View style={[styles.line, (done || now) && styles.lineDone]} /> : null}
              <View style={[styles.dot, done && styles.dotDone, now && styles.dotNow]}>
                {done ? <Ionicons name="checkmark" size={15} color="#FFFFFF" /> : now ? <View style={styles.inner} /> : null}
              </View>
              <Text style={[styles.label, (done || now) && styles.labelOn]} numberOfLines={1}>{progressLabels[step]}</Text>
            </View>
          );
        })}
      </View>
      {closed ? (
        <View style={[styles.result, status === 'accepted' ? styles.resultOk : null]}>
          <Ionicons name={status === 'accepted' ? 'checkmark-circle' : 'flag'} size={16} color={status === 'accepted' ? colors.success : colors.textMuted} />
          <Text style={styles.resultText}>結果：{progressLabels[key]}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  step: { flex: 1, alignItems: 'center', gap: 6 },
  line: { position: 'absolute', top: 14, right: '50%', width: '100%', height: 3, backgroundColor: colors.neutralSoft },
  lineDone: { backgroundColor: colors.success },
  dot: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: colors.lineStrong, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  dotDone: { backgroundColor: colors.success, borderColor: colors.success },
  dotNow: { backgroundColor: colors.primary, borderColor: colors.primary },
  inner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FFFFFF' },
  label: { fontSize: 12, color: colors.textMuted },
  labelOn: { color: colors.text, fontWeight: '700' },
  result: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: colors.neutralSoft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  resultOk: { backgroundColor: colors.successSoft },
  resultText: { fontSize: 13, fontWeight: '700', color: colors.textBody }
});
