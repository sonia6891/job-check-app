import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/src/theme/colors';
import { MinimumWageNotice } from '@/src/components/MinimumWageNotice';
import { WorkHoursNotice } from '@/src/components/WorkHoursNotice';
import { PostingRiskNotice } from '@/src/components/PostingRiskNotice';
import { InterviewNotesList } from '@/src/components/InterviewNotesList';
import { checkMinimumWage } from '@/src/lib/minimumWage';
import { checkWorkHours } from '@/src/lib/workHours';
import { checkPostingRisks } from '@/src/lib/postingRisks';

// 範例職缺，只用來檢查提醒卡片的版面；全部走真正的判斷函式，不是寫死的結果。
const today = new Date();
const samples = {
  wage: [
    checkMinimumWage({ raw: '月薪 28,000 元', min: 28000, type: 'monthly' }, today),
    checkMinimumWage({ raw: '時薪 180 元', min: 180, type: 'hourly' }, today),
    checkMinimumWage({ raw: '日薪 1,400 元', min: 1400, type: 'daily' }, today)
  ],
  hours: checkWorkHours('08:00-22:00', '月休 6 天，需配合輪班'),
  longShift: checkWorkHours('09:00-21:00'),
  risks: checkPostingRisks('錄取後需繳交保證金 3000 元，並提供存摺與提款卡供薪轉。不保勞健保，遲到一次扣薪 500。')
};

/** 開發用：一次檢視所有提醒卡片。正式版不顯示。 */
export default function NoticeGallery() {
  if (!__DEV__) return null;
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.h}>基本工資</Text>
        {samples.wage.map((check, i) => <MinimumWageNotice key={i} check={check} />)}
        <Text style={styles.h}>工時</Text>
        <WorkHoursNotice hints={samples.hours} />
        <WorkHoursNotice hints={samples.longShift} />
        <Text style={styles.h}>職缺內容警訊</Text>
        <PostingRiskNotice hints={samples.risks} />
        <Text style={styles.h}>面試筆記（離線時讀不到筆記，只看版面）</Text>
        <View style={styles.card}>
          <InterviewNotesList jobId="00000000-0000-4000-8000-000000000000" questions={[
            { question: '錄取前後是否需要繳任何費用（保證金、押金、訓練費等）？', source_text: '保證金' },
            { question: '試用期多久？試用期薪資是否不同？' }
          ]} />
        </View>
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 16, gap: 10 },
  h: { color: colors.text, fontWeight: '900', fontSize: 16, marginTop: 8 },
  card: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: 14 }
});
