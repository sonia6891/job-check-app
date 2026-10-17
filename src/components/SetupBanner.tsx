import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/theme/colors';

export function SetupBanner({ reason, title, children }: { reason?: string | null; title?: string; children?: ReactNode }) {
  const body = children ?? (
    reason === 'missing_env'
      ? '請先填入 Supabase publishable key。'
      : reason
        ? '請在 Supabase Auth 啟用 Anonymous Sign-In，前端才能免註冊直接體檢。'
        : null
  );

  if (!body) return null;

  return (
    <View style={styles.box}>
      <Ionicons name="construct-outline" size={20} color={colors.warning} />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title ?? '開發設定尚未完成'}</Text>
        <Text style={styles.body}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', gap: 10, padding: 14, backgroundColor: colors.warningSoft, borderRadius: 14, borderWidth: 1, borderColor: '#F1D48A' },
  title: { fontWeight: '800', color: colors.warning, marginBottom: 3 },
  body: { color: colors.text, lineHeight: 19 }
});
