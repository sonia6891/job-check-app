import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { colors } from '@/src/theme/colors';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
};
export function JobSearchField({ value, onChangeText, placeholder = '搜尋公司、職稱、薪資或地點' }: Props) {
  return <View style={styles.wrap}>
    <Ionicons name="search-outline" color={colors.textMuted} size={20} />
    <TextInput
      accessibilityLabel="搜尋職缺"
      placeholder={placeholder}
      placeholderTextColor={colors.textMuted}
      autoCorrect={false}
      returnKeyType="search"
      value={value}
      onChangeText={onChangeText}
      style={styles.input}
    />
    {value ? <Pressable accessibilityRole="button" accessibilityLabel="清除搜尋" onPress={() => onChangeText('')}
      style={styles.clear}><Ionicons name="close-circle" size={21} color={colors.textMuted} /></Pressable> : null}
  </View>;
}
const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.surface, borderColor: '#E3ECF5', borderWidth: 1.5, borderRadius: 16, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, minHeight: 46, gap: 10 },
  input: { color: colors.text, fontSize: 14, flex: 1, minHeight: 44 },
  clear: { width: 32, height: 38, alignItems: 'center', justifyContent: 'center' }
});
