import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '@/src/theme/colors';
import { PrimaryActionButton } from '@/src/components/PrimaryActionButton';
import { hasUnsavedProgressNote } from '@/src/lib/progressNotes';

type Props = {
  value: string;
  original: string | null | undefined;
  onChangeText: (value: string) => void;
  onSave: () => void;
  saving?: boolean;
};

/** Independently editable note panel, with a visible unsaved-change state. */
export function ProgressNoteEditor({ value, original, onChangeText, onSave, saving = false }: Props) {
  const changed = hasUnsavedProgressNote(value, original);
  return <View style={styles.panel}>
    <View style={styles.heading}>
      <Text style={styles.title}>筆記</Text>
      {changed ? <Text style={styles.unsaved}>尚未儲存</Text> : <Text style={styles.saved}>已儲存</Text>}
    </View>
    <TextInput
      accessibilityLabel="求職筆記"
      value={value}
      onChangeText={onChangeText}
      multiline
      editable={!saving}
      placeholder="記錄投遞日期、面試時間、聯絡人或自己的想法…"
      placeholderTextColor={colors.textMuted}
      textAlignVertical="top"
      style={[styles.input, saving && styles.disabled]}
    />
    <PrimaryActionButton label="儲存筆記" onPress={onSave} loading={saving} disabled={!changed} />
  </View>;
}
const styles = StyleSheet.create({
  panel: { gap: 10 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  title: { color: colors.text, fontSize: 15, fontWeight: '800' },
  unsaved: { color: colors.warning, fontSize: 12, fontWeight: '800' },
  saved: { color: colors.textMuted, fontSize: 12 },
  input: { minHeight: 108, borderRadius: 16, backgroundColor: colors.accentSoft, padding: 14, color: colors.text, fontSize: 15, lineHeight: 22 },
  disabled: { opacity: 0.55 }
});
