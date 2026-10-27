import { useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Inter_800ExtraBold } from '@expo-google-fonts/inter/800ExtraBold';
import { AuthProvider, useAuth } from '@/src/auth/AuthProvider';
import { prefs } from '@/src/lib/prefs';
import { reviewPrompt } from '@/src/lib/reviewPrompt';
import { colors } from '@/src/theme/tokens';
import { IntroAnimation } from '@/src/components/IntroAnimation';

// 開場動畫每次冷啟動播一次；畫面重新掛載（例如登入後）不再播。
let introPlayed = false;

/** 第一次打開（還沒看過引導頁）又還是訪客時，動畫停在最後一格讓人選登入方式。 */
function Intro({ onDone }: { onDone: () => void }) {
  const { user, loading } = useAuth();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  // 帳號準備太久（網路很慢）就不等了：第一次打開照樣讓人選登入方式，否則直接進 App。
  const [gaveUp, setGaveUp] = useState(false);
  useEffect(() => { prefs.getOnboarded().then(setOnboarded).catch(() => setOnboarded(true)); }, []);
  useEffect(() => { const t = setTimeout(() => setGaveUp(true), 8000); return () => clearTimeout(t); }, []);
  const askSignIn = onboarded === null ? null
    : loading ? (gaveUp ? !onboarded : null)
    : !onboarded && Boolean(!user || user.is_anonymous);
  return <IntroAnimation askSignIn={askSignIn} onDone={onDone} />;
}

export default function RootLayout() {
  // 數字用 Inter，檔案很小，載完再畫面，避免數字跳字型；載入失敗就用系統字。
  const [fontsLoaded, fontError] = useFonts({ Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold });
  const [showIntro, setShowIntro] = useState(!introPlayed);
  // 評分邀請：開場動畫和登入選擇還在時不問；每次打開或回到 App 記一天。
  useEffect(() => { reviewPrompt.setBlocked(showIntro); }, [showIntro]);
  useEffect(() => {
    reviewPrompt.noteOpen();
    const sub = AppState.addEventListener('change', state => { if (state === 'active') reviewPrompt.noteOpen(); });
    return () => sub.remove();
  }, []);
  if (!fontsLoaded && !fontError) return null;
  return (
    <View style={{ flex: 1 }}>
      <AuthProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerBackTitle: '返回', headerShadowVisible: false, headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.text, headerTitleStyle: { fontWeight: '800' }, contentStyle: { backgroundColor: colors.bg } }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false, animation: 'fade' }} />
          <Stack.Screen name="analysis/[jobId]" options={{ title: '正在體檢' }} />
          <Stack.Screen name="report/[jobId]" options={{ title: '體檢報告', headerShown: false }} />
          <Stack.Screen name="progress" options={{ title: '求職進度' }} />
          <Stack.Screen name="compare" options={{ title: '比較職缺' }} />
          <Stack.Screen name="plans" options={{ title: 'Pro 方案' }} />
          <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
          <Stack.Screen name="privacy" options={{ title: "隱私與資料管理" }} />
          <Stack.Screen name="job/edit/[jobId]" options={{ title: "修正職缺資訊" }} />
          <Stack.Screen name="tools/wage-check" options={{ title: "基本工資檢查" }} />
          <Stack.Screen name="dev/notices" options={{ title: "提醒卡片（開發用）" }} />
        </Stack>
        {showIntro ? <Intro onDone={() => { introPlayed = true; setShowIntro(false); }} /> : null}
      </AuthProvider>
    </View>
  );
}
