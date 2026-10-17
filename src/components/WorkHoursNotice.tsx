import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/src/theme/colors';
import type { WorkHoursHint } from '@/src/lib/workHours';

function copy(hint: WorkHoursHint): { title: string; body: string } {
  if (hint.kind === 'few_days_off') {
    return {
      title: '休假天數可能不足',
      body: `職缺寫「${hint.source}」。勞基法規定每 7 天應有 2 天休假（例假與休息日）；若採變形工時或休息日出勤，薪資計算方式不同，建議面試時確認。`
    };
  }
  if (hint.kind === 'over_daily_max') {
    return {
      title: '每日在班時間很長',
      body: `排班時段約 ${hint.spanHours} 小時。勞基法規定每日工作含加班不得超過 12 小時，建議確認實際工時、休息時間與加班費。`
    };
  }
  return {
    title: '可能有固定加班',
    body: `排班時段約 ${hint.spanHours} 小時，扣除休息後可能超過每日正常工時 8 小時。建議確認超過的部分是否算加班、加班費如何計算。`
  };
}

/** 依職缺寫的時段推估，職缺通常沒寫休息時間，所以只是提醒，不下違法結論。 */
export function WorkHoursNotice({ hints }: { hints: readonly WorkHoursHint[] }) {
  if (!hints.length) return null;
  return (
    <View style={styles.list}>
      {hints.map((hint, i) => {
        const { title, body } = copy(hint);
        return (
          <View key={`${hint.kind}-${i}`} style={styles.box} accessibilityRole="alert">
            <View style={styles.head}>
              <Ionicons name="time" size={18} color={colors.warningIcon} />
              <Text style={styles.title}>{title}</Text>
            </View>
            <Text style={styles.body}>{body}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  box: { backgroundColor: colors.warningSoft, borderRadius: 20, padding: 14, gap: 6 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { flex: 1, color: colors.warning, fontWeight: '800', fontSize: 15 },
  body: { color: colors.textBody, fontSize: 13, lineHeight: 21 }
});
