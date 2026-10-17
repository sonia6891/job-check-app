import { useCallback, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Switch, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { prefs } from '@/src/lib/prefs';
import { colors, radius, space } from '@/src/theme/tokens';
import { Button, IconCircle, Screen, SectionTitle, Surface, T, type IconName } from '@/src/ui';

const promises = [
  '職缺內容只有你看得到，不會公開或賣給別人',
  '截圖在手機上辨識文字，原圖預設 24 小時內刪除',
  '可以隨時刪除單一職缺，或整個帳號'
];

const entries: Array<{ icon: IconName; title: string; text: string }> = [
  { icon: 'scan', title: '在手機上辨識截圖', text: 'iPhone 用 Apple Vision、Android 用 ML Kit。辨識出的文字先讓你修正，確認後才會上傳。' },
  { icon: 'cloud-upload', title: '體檢時送出的資料', text: '送出後，必要的職缺內容會傳到後端，用來查公司登記、公開勞動紀錄與官方薪資參考。' },
  { icon: 'time', title: '原圖保留多久', text: '沒有打開保留設定時，原始截圖約 24 小時內由後端自動清理。' },
  { icon: 'person', title: '帳號與紀錄', text: '報告、收藏和進度只綁定你的帳號，其他人讀不到。' }
];

/** 隱私與資料（Figma「隱私與資料」）。 */
export default function PrivacyScreen() {
  const [keep, setKeep] = useState(false);
  useFocusEffect(useCallback(() => { void prefs.getKeepOriginal().then(setKeep); }, []));
  function update(value: boolean) { setKeep(value); void prefs.setKeepOriginal(value); }

  return (
    <Screen>
      <Surface fill={colors.successSoft} flat style={{ borderRadius: 26 }}>
        <View style={styles.promiseHead}>
          <IconCircle icon="shield-checkmark" tone="ok" />
          <T variant="heading" style={{ flex: 1 }}>你的資料只用來產生你的報告</T>
        </View>
        {promises.map(p => (
          <View key={p} style={styles.promise}>
            <Ionicons name="checkmark" size={18} color={colors.success} />
            <T variant="caption" color={colors.textBody} style={{ flex: 1 }}>{p}</T>
          </View>
        ))}
      </Surface>

      <Surface style={styles.toggle}>
        <View style={{ flex: 1, gap: 2 }}>
          <T variant="bodyStrong">保留截圖原圖</T>
          <T variant="caption" muted>{keep ? '之後上傳的截圖會保留；不需要時請自己刪除。' : '打開才會保留，方便之後回頭對照。'}</T>
        </View>
        <Switch value={keep} onValueChange={update} accessibilityLabel="保留截圖原圖" trackColor={{ true: colors.success, false: colors.lineStrong }} thumbColor="#FFFFFF" />
      </Surface>
      <T variant="small" muted style={{ paddingHorizontal: space.xs }}>設定只影響之後的上傳，不會馬上刪除已經上傳的內容。</T>

      <SectionTitle title="資料怎麼處理" />
      <Surface style={{ borderRadius: radius.xl, paddingVertical: 6 }}>
        {entries.map((item, i) => (
          <View key={item.title} style={[styles.row, i > 0 && styles.divider]}>
            <IconCircle icon={item.icon} tone="neutral" size={36} />
            <View style={{ flex: 1, gap: 2 }}>
              <T variant="bodyStrong">{item.title}</T>
              <T variant="caption" muted>{item.text}</T>
            </View>
          </View>
        ))}
      </Surface>

      <Surface style={styles.toggle}>
        <IconCircle icon="trash" tone="neutral" />
        <View style={{ flex: 1, gap: 2 }}>
          <T variant="bodyStrong">刪除單一職缺</T>
          <T variant="caption" muted>在那份報告最下面按「刪除」</T>
        </View>
      </Surface>

      <Surface fill={colors.dangerSoft} flat style={{ borderRadius: 26 }}>
        <T variant="heading" color={colors.dangerText}>刪除帳號</T>
        <T variant="caption" color={colors.textBody}>會刪除所有職缺、報告、收藏、求職進度和面試筆記，無法復原。刪除按鈕在「我的」頁最下面。</T>
        <Button variant="danger" icon="person" label="前往「我的」" onPress={() => router.push('/me')} />
      </Surface>
      <T variant="small" muted style={{ paddingHorizontal: space.xs }}>這裡是資料處理說明，實際清理時間以後端執行結果為準。</T>
    </Screen>
  );
}

const styles = StyleSheet.create({
  promiseHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  promise: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: radius.xl },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingVertical: 12 },
  divider: { borderTopWidth: 1, borderTopColor: colors.line }
});
