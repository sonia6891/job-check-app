import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/src/theme/colors';

type Option<T extends string> = { value: T; label: string };
type Props<T extends string> = { value: T; options: Option<T>[]; onChange: (value: T) => void };
/** Reusable native segmented chips with selected and pressed states. */
export function FilterChips<T extends string>({ value, options, onChange }: Props<T>) {
  return <View style={styles.row}>
    {options.map(option => <Pressable
      key={option.value}
      accessibilityRole="button"
      accessibilityState={{ selected: value === option.value }}
      onPress={() => onChange(option.value)}
      style={({ pressed }) => [styles.chip, value === option.value && styles.active, pressed && styles.pressed]}
    >
      <Text style={[styles.label, value === option.value && styles.labelActive]}>{option.label}</Text>
    </Pressable>)}
  </View>;
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 36, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1.5, borderColor: colors.lineStrong, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  active: { backgroundColor: colors.navy, borderColor: colors.navy },
  pressed: { opacity: 0.72 },
  label: { color: colors.textBody, fontSize: 13, fontWeight: '700' },
  labelActive: { color: '#FFFFFF', fontWeight: '800' }
});
