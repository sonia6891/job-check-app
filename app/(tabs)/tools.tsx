import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, onBrand, radius, shadow, space } from '@/src/theme/tokens';
import { FocusStatusBar, IconCircle, Num, Screen, SectionTitle, T, type IconName } from '@/src/ui';
import { showMessage } from '@/src/lib/uiAlerts';

const hotlines: Array<{ number: string; title: string; detail: string; bg: string; fg: string }> = [
  { number: '165', title: '反詐騙專線', detail: '被要求先付錢、交帳戶', bg: colors.dangerSoft, fg: colors.danger },
  { number: '1955', title: '勞工諮詢申訴', detail: '薪資、工時、勞健保', bg: colors.infoSoft, fg: colors.info }
];

/** 求職小知識：只寫法規確定的基本常識，避免變成法律意見。 */
const knowledge: Array<{ icon: IconName; title: string; detail: string }> = [
  { icon: 'bulb', title: '試用期可以領比較少嗎？', detail: '試用期也不能低於基本工資，勞健保從第一天就要保' },
  { icon: 'time', title: '加班費怎麼算？', detail: '平日加班前 2 小時，至少多給 1/3' },
  { icon: 'warning', title: '被要求先付錢怎麼辦？', detail: '先別付，打 165 問問看' }
];

function dial(number: string) {
  Linking.openURL(`tel:${number}`).catch(() => showMessage('無法撥號', `請用電話直接撥打 ${number}。`));
}

function Row({ icon, title, detail, onPress, first, right }: { icon: IconName; title: string; detail: string; onPress?: () => void; first?: boolean; right?: React.ReactNode }) {
  const body = (
    <View style={[styles.row, !first && styles.divider]}>
      <View style={styles.rowIcon}><Ionicons name={icon} size={18} color={colors.text} /></View>
      <View style={{ flex: 1, gap: 1 }}>
        <T variant="bodyStrong">{title}</T>
        <T variant="caption" muted>{detail}</T>
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={colors.placeholder} /> : null)}
    </View>
  );
  return onPress
    ? <Pressable accessibilityRole="button" accessibilityLabel={`${title}，${detail}`} onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.7 }}>{body}</Pressable>
    : body;
}

export default function ToolsScreen() {
  const header = (
    <View style={styles.header}>
      <FocusStatusBar style="dark" />
      <T variant="display" accessibilityRole="header">工具</T>
      <T variant="caption" muted>不用貼職缺，也能先算、先問</T>
    </View>
  );

  return (
    <Screen safeTop tabBar header={header}>
      <Pressable accessibilityRole="button" accessibilityLabel="基本工資檢查：輸入薪資，馬上知道有沒有低於法定標準"
        onPress={() => router.push('/tools/wage-check')} style={({ pressed }) => [styles.feature, pressed && { opacity: 0.9 }]}>
        <View style={styles.featureIcon}><Ionicons name="calculator" size={24} color={colors.primary} /></View>
        <View style={{ flex: 1, gap: 2 }}>
          <T variant="heading" color={onBrand.text}>基本工資檢查</T>
          <T variant="caption" color={onBrand.muted}>輸入薪資，馬上知道有沒有低於法定標準</T>
        </View>
        <Ionicons name="arrow-forward" size={22} color="#FFFFFF" />
      </Pressable>

      <View style={styles.listCard}>
        <Row first icon="git-compare" title="比較職缺" detail="收藏兩份以上就能並排看" onPress={() => router.push('/compare?source=saved')} />
        <Row icon="checkmark-done" title="求職進度" detail="投遞、面試、Offer 一次看" onPress={() => router.push('/progress')} />
      </View>

      <SectionTitle title="遇到問題可以打" />
      <View style={styles.hotlines}>
        {hotlines.map(h => (
          <Pressable key={h.number} accessibilityRole="button" accessibilityLabel={`撥打 ${h.number} ${h.title}`} onPress={() => dial(h.number)}
            style={({ pressed }) => [styles.hotline, { backgroundColor: h.bg }, pressed && { opacity: 0.85 }]}>
            <View style={styles.hotlineTop}>
              <Num size={30} color={h.fg}>{h.number}</Num>
              <View style={styles.phone}><Ionicons name="call" size={16} color={h.fg} /></View>
            </View>
            <T variant="bodyStrong">{h.title}</T>
            <T variant="caption" color={colors.textBody}>{h.detail}</T>
          </Pressable>
        ))}
      </View>

      <SectionTitle title="求職小知識" />
      <View style={styles.listCard}>
        {knowledge.map((k, i) => (
          <View key={k.title} style={[styles.row, i > 0 && styles.divider]}>
            <IconCircle icon={k.icon} size={36} tone="caution" />
            <View style={{ flex: 1, gap: 1 }}>
              <T variant="bodyStrong">{k.title}</T>
              <T variant="caption" muted>{k.detail}</T>
            </View>
          </View>
        ))}
      </View>
      <T variant="small" muted style={{ paddingHorizontal: space.xs }}>以上是一般原則，實際情況以勞動部公告與勞動契約為準。所有功能都免費。</T>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: space.lg, gap: 2 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.primary, borderRadius: radius.xxl, padding: 18, ...shadow.coral },
  featureIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  listCard: { backgroundColor: colors.surface, borderRadius: radius.xl, paddingHorizontal: space.lg, paddingVertical: 4, ...shadow.card },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  divider: { borderTopWidth: 1, borderTopColor: colors.line },
  rowIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.neutralSoft, alignItems: 'center', justifyContent: 'center' },
  hotlines: { flexDirection: 'row', gap: 10 },
  hotline: { flex: 1, borderRadius: radius.xl, padding: space.lg, gap: 4 },
  hotlineTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  phone: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }
});
