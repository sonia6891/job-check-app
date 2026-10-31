import { useEffect } from 'react';
import { router, Tabs } from 'expo-router';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, shadow } from '@/src/theme/tokens';
import { prefs } from '@/src/lib/prefs';
import { TAB_BAR_WIDTH } from '@/src/ui/layout';

type IconName = keyof typeof Ionicons.glyphMap;

/** 選中的分頁放在珊瑚色淺底的膠囊裡（Figma「Tab Bar」元件）。 */
function TabIcon({ name, focused }: { name: IconName; focused: boolean }) {
  return (
    <View style={[styles.pill, focused && styles.pillActive]}>
      <Ionicons name={focused ? (name.replace('-outline', '') as IconName) : name} size={22} color={focused ? colors.primary : colors.textMuted} />
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  // 第一次打開先看引導頁；讀不到設定時當作看過，不擋住使用。
  useEffect(() => {
    void prefs.getOnboarded().then(done => { if (!done) router.push('/onboarding'); });
  }, []);
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.textMuted,
      // 浮動分頁列：左右留 16、距底部安全區 8，內容頁要留 120 的底部空間（Screen tabBar）。
      // 螢幕比較寬時最寬 TAB_BAR_WIDTH 並置中；手機的左右邊距仍然是 16。
      tabBarStyle: [styles.bar, { bottom: Math.max(insets.bottom, 12) + 8, marginHorizontal: Math.max(16, (width - TAB_BAR_WIDTH) / 2) }],
      // 預設在平板和橫放時會把文字放到圖示旁邊，膠囊就撐不住了；一律維持圖示在上、文字在下。
      tabBarLabelPosition: 'below-icon',
      tabBarItemStyle: styles.item,
      tabBarLabelStyle: styles.label
    }} safeAreaInsets={{ bottom: 0 }}>
      <Tabs.Screen name="index" options={{ title: '體檢', tabBarIcon: ({ focused }) => <TabIcon name="search-outline" focused={focused} /> }} />
      <Tabs.Screen name="jobs" options={{ title: '我的職缺', tabBarIcon: ({ focused }) => <TabIcon name="briefcase-outline" focused={focused} /> }} />
      <Tabs.Screen name="tools" options={{ title: '工具', tabBarIcon: ({ focused }) => <TabIcon name="calculator-outline" focused={focused} /> }} />
      <Tabs.Screen name="me" options={{ title: '我的', tabBarIcon: ({ focused }) => <TabIcon name="person-outline" focused={focused} /> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute', height: 66, paddingTop: 6, paddingBottom: 6, paddingHorizontal: 6,
    borderRadius: 30, borderTopWidth: 0, backgroundColor: colors.surface, ...shadow.float
  },
  item: { borderRadius: 24, paddingTop: 2 },
  label: { fontSize: 11, fontWeight: '700', marginTop: 0 },
  pill: { width: 52, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  pillActive: { backgroundColor: colors.primarySoft }
});
