import { useEffect } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { colors } from '@/src/theme/colors';

export default function AuthCallbackScreen() {
  useEffect(() => {
    const timer = setTimeout(() => router.replace('/(tabs)/me'), 700);
    return () => clearTimeout(timer);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <ActivityIndicator />
      <Text style={styles.title}>正在完成登入…</Text>
      <Text style={styles.body}>登入視窗完成後會自動回到帳號頁。</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  title: { color: colors.text, fontSize: 18, fontWeight: '800' },
  body: { color: colors.textMuted, textAlign: 'center' }
});
