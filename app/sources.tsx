import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GOVERNMENT_SOURCES, NOT_GOVERNMENT_DISCLAIMER } from '@/src/lib/governmentSources';
import { showMessage } from '@/src/lib/uiAlerts';
import { colors, radius, space } from '@/src/theme/tokens';
import { Notice, Screen, SectionTitle, Surface, T } from '@/src/ui';

function open(url: string) {
  Linking.openURL(url).catch(() => showMessage('無法開啟連結', url));
}

/** 資料來源與聲明：列出政府資料的原始網址，並聲明不代表政府機關。 */
export default function SourcesScreen() {
  return (
    <Screen>
      <Notice tone="info" icon="information-circle" title="非政府機關 App">{NOT_GOVERNMENT_DISCLAIMER}</Notice>

      <SectionTitle title="政府資料的原始來源" />
      <Surface style={{ borderRadius: radius.xl, paddingVertical: 6 }}>
        {GOVERNMENT_SOURCES.map((s, i) => (
          <View key={s.url} style={[styles.block, i > 0 && styles.divider]}>
            <Pressable accessibilityRole="link" accessibilityLabel={`開啟${s.agency}${s.name}`}
              onPress={() => open(s.url)} style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <T variant="bodyStrong">{s.agency}・{s.name}</T>
                <T variant="caption" muted>{s.usedFor}</T>
                <T variant="small" color={colors.primary}>{s.url}</T>
              </View>
              <Ionicons name="open-outline" size={18} color={colors.primary} />
            </Pressable>
            {s.links?.map(l => (
              <Pressable key={l.url} accessibilityRole="link" accessibilityLabel={`開啟${l.label}`} hitSlop={4}
                onPress={() => open(l.url)} style={({ pressed }) => [styles.subRow, pressed && { opacity: 0.7 }]}>
                <View style={{ flex: 1 }}>
                  <T variant="caption" color={colors.textBody}>{l.label}</T>
                  <T variant="small" color={colors.primary}>{l.url}</T>
                </View>
                <Ionicons name="open-outline" size={14} color={colors.primary} />
              </Pressable>
            ))}
          </View>
        ))}
      </Surface>
      <T variant="small" muted style={{ paddingHorizontal: space.xs }}>
        經濟部網站暫時無法連線時，公司登記會改查 g0v 社群維護的同一份開放資料鏡像（https://company.g0v.ronny.tw/），它也不是政府網站。
      </T>
      <T variant="small" muted style={{ paddingHorizontal: space.xs }}>
        體檢報告整理的是你提供的職缺內容與政府公開資料，僅供參考，不構成對任何企業或求職決定的推薦或保證；查無紀錄不代表該公司沒有違規。
      </T>
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { paddingBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 12 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 6, paddingLeft: space.md },
  divider: { borderTopWidth: 1, borderTopColor: colors.line }
});
