import { Ionicons } from '@expo/vector-icons';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, space } from '@/src/theme/tokens';
import { Button, Chip, T } from '@/src/ui';
import { parseSalaryText } from '@/src/lib/minimumWage';
import { shiftSpans } from '@/src/lib/workHours';

type Props = {
  visible: boolean; mode: 'text' | 'ocr'; text: string; sourceUrl?: string | null; busy: boolean;
  /** 一次選了幾張截圖（大於 1 時提醒使用者看一下接起來的順序）。 */
  pageCount?: number;
  onChangeText: (text: string) => void; onCancel: () => void; onConfirm: () => void;
};

/**
 * 送出前的核對視窗（Figma「核對職缺文字」）：從下方滑出，內容可以直接改。
 * 「系統讀到的資訊」只用本機規則判斷有沒有寫薪資和上班時間，不代表整份解析結果。
 */
export function JobTextReview({ visible, mode, text, sourceUrl, busy, pageCount, onChangeText, onCancel, onConfirm }: Props) {
  const insets = useSafeAreaInsets();
  const length = text.trim().length;
  const hasSalary = Boolean(parseSalaryText(text));
  const hasHours = shiftSpans(text).length > 0;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="返回修改" onPress={busy ? undefined : onCancel} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space.lg) + space.md }]}>
            <View style={styles.grabber} />
            <ScrollView contentContainerStyle={{ gap: space.lg }} keyboardShouldPersistTaps="handled">
              <View style={{ gap: 4 }}>
                <T variant="heading" accessibilityRole="header">{mode === 'ocr' ? '辨識好了，先核對一下' : '送出前，先看一下內容'}</T>
                <T variant="caption" muted>{mode === 'ocr'
                  ? `${pageCount && pageCount > 1 ? `已把 ${pageCount} 張截圖接在一起，重複的部分去掉了。` : ''}文字是在手機上辨識的，確認後才會上傳。看到錯字或缺的地方可以直接改。`
                  : '這是你貼上的職缺，看到錯字或缺的地方可以直接改。'}</T>
              </View>
              {sourceUrl ? (
                <View style={styles.source}>
                  <Ionicons name="link" size={15} color={colors.primary} />
                  <T variant="small" color={colors.textBody} numberOfLines={2} style={{ flex: 1 }}>{sourceUrl}</T>
                </View>
              ) : null}
              <View style={{ gap: 6 }}>
                <TextInput accessibilityLabel="可以修改的職缺內容" multiline value={text} onChangeText={onChangeText} editable={!busy}
                  textAlignVertical="top" style={styles.editor} placeholder="請貼上職缺內容" placeholderTextColor={colors.placeholder} />
                <T variant="small" muted style={{ textAlign: 'right' }}>{length} 字{length < 10 ? '・至少要 10 個字' : ''}</T>
              </View>
              <View style={{ gap: space.sm }}>
                <T variant="captionStrong" muted>系統讀到的資訊</T>
                <View style={styles.chips}>
                  <Chip tone={hasSalary ? 'ok' : 'caution'} label={hasSalary ? '✓ 薪資' : '沒寫薪資'} />
                  <Chip tone={hasHours ? 'ok' : 'caution'} label={hasHours ? '✓ 上班時間' : '沒寫上班時間'} />
                </View>
              </View>
              <View style={{ gap: 10 }}>
                <Button label="開始體檢（用 1 次）" icon="search" loading={busy} disabled={length < 10} onPress={onConfirm} />
                <Button variant="outline" label="返回修改" disabled={busy} onPress={onCancel} />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(43,33,24,0.45)' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl, paddingHorizontal: 20, paddingTop: 10, maxHeight: '92%', gap: space.md },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.lineStrong },
  source: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.primarySoft, borderRadius: radius.sm, padding: space.md },
  editor: { minHeight: 140, maxHeight: 280, backgroundColor: colors.surfaceMuted, borderRadius: 18, padding: 14, fontSize: 15, lineHeight: 23, color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }
});
