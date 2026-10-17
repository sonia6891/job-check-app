import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Inter_800ExtraBold } from '@expo-google-fonts/inter/800ExtraBold';
import { AuthProvider } from '@/src/auth/AuthProvider';
import { colors } from '@/src/theme/tokens';

export default function RootLayout() {
  // 數字用 Inter，檔案很小，載完再畫面，避免數字跳字型；載入失敗就用系統字。
  const [fontsLoaded, fontError] = useFonts({ Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold });
  if (!fontsLoaded && !fontError) return null;
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerBackTitle: '返回', headerShadowVisible: false, headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.text, headerTitleStyle: { fontWeight: '800' }, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false, animation: 'fade' }} />
        <Stack.Screen name="analysis/[jobId]" options={{ title: '正在體檢' }} />
        <Stack.Screen name="report/[jobId]" options={{ title: '體檢報告', headerShown: false }} />
        <Stack.Screen name="progress" options={{ title: '求職進度' }} />
        <Stack.Screen name="compare" options={{ title: '比較職缺' }} />
        <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
        <Stack.Screen name="privacy" options={{ title: "隱私與資料管理" }} />
        <Stack.Screen name="job/edit/[jobId]" options={{ title: "修正職缺資訊" }} />
        <Stack.Screen name="tools/wage-check" options={{ title: "基本工資檢查" }} />
        <Stack.Screen name="dev/notices" options={{ title: "提醒卡片（開發用）" }} />
      </Stack>
    </AuthProvider>
  );
}
