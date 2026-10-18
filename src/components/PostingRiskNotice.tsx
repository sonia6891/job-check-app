import { Ionicons } from '@expo/vector-icons';
import { Linking, StyleSheet, View } from 'react-native';
import { colors, shadow } from '@/src/theme/tokens';
import { Button, IconCircle, T } from '@/src/ui';
import type { PostingRiskHint } from '@/src/lib/postingRisks';
import { showMessage } from '@/src/lib/uiAlerts';

const copy: Record<PostingRiskHint['kind'], { title: string; body: string }> = {
  account_handover: {
    title: '要你交出帳戶',
    body: '正常的雇主發薪水只需要你的帳號，不會要存摺、提款卡或密碼。交出帳戶可能被拿去當人頭帳戶，還會觸犯洗錢防制法。'
  },
  upfront_payment: {
    title: '要你先付錢',
    body: '正常的工作不會要你先付錢。不管名目是保證金、押金還是訓練費，都先別付。'
  },
  no_insurance: {
    title: '可能沒有勞健保',
    body: '雇主依法要幫員工投保健保、提繳 6% 勞退，5 人以上的公司也要保勞保。沒有投保，受傷、生病或退休時會吃虧。'
  },
  wage_deduction: {
    title: '有扣薪或違約金規定',
    body: '勞基法第 26 條規定，雇主不能預扣薪水當違約金或賠償。簽約前問清楚，並確認有沒有寫在契約裡。'
  }
};

function call165() {
  // 沒有電話功能的裝置（例如 iPad）打不出去，告訴使用者改用電話撥。
  Linking.openURL('tel:165').catch(() => showMessage('無法撥號', '請用電話直接撥打 165。'));
}

/**
 * 職缺原文裡的詐騙特徵與可能違法的條件。只是提醒，不判定公司違法或詐騙。
 * 詐騙特徵用白底紅框卡片並附 165 專線；可能違法的條件用黃色淺底卡片。
 */
export function PostingRiskNotice({ hints }: { hints: readonly PostingRiskHint[] }) {
  if (!hints.length) return null;
  return (
    <View style={styles.list}>
      {hints.map((hint, i) => {
        const { title, body } = copy[hint.kind];
        if (hint.severity === 'high') {
          return (
            <View key={`${hint.kind}-${i}`} style={styles.high} accessibilityRole="alert">
              <View style={styles.head}>
                <IconCircle icon="warning" tone="danger" solid />
                <View style={{ flex: 1, gap: 1 }}>
                  <T variant="heading">{title}</T>
                  <T variant="captionStrong" color={colors.danger}>常見的求職詐騙手法</T>
                </View>
              </View>
              <View style={styles.quote}><T variant="caption" color={colors.dangerText}>職缺裡寫：「{hint.source}」</T></View>
              <T variant="body" color={colors.textBody}>{body}</T>
              <Button variant="danger" icon="call" label="打 165 問問看" accessibilityLabel="撥打 165 反詐騙專線" onPress={call165} />
            </View>
          );
        }
        return (
          <View key={`${hint.kind}-${i}`} style={styles.caution} accessibilityRole="alert">
            <View style={styles.cautionIcon}><Ionicons name="alert-circle" size={22} color={colors.warningIcon} /></View>
            <View style={{ flex: 1, gap: 4 }}>
              <T variant="bodyStrong" color={colors.warning}>{title}</T>
              <T variant="small" muted>職缺裡寫：「{hint.source}」</T>
              <T variant="caption" color={colors.textBody}>{body}</T>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  high: { backgroundColor: colors.surface, borderRadius: 26, padding: 16, gap: 12, borderWidth: 2, borderColor: colors.dangerSoft, ...shadow.danger },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  quote: { backgroundColor: colors.dangerSoft, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10 },
  caution: { flexDirection: 'row', gap: 12, backgroundColor: colors.warningSoft, borderRadius: 22, padding: 14 },
  cautionIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }
});
