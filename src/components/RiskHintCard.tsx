import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/src/theme/colors';

type Props = { question?: string | null; sourceText?: string | null; historical?: boolean };
/** A clarification clue, never an automated legal finding or fake risk score. */
export function RiskHintCard({ question, sourceText, historical = false }: Props) {
  return <View style={styles.card}>
    <View style={styles.heading}>
      <Ionicons name={historical ? 'time-outline' : 'help-circle'} size={19} color={colors.warningIcon}/>
      <Text style={styles.tag}>{historical ? '原文舊線索 · 待核對' : '職缺條件 · 待確認'}</Text>
    </View>
    <Text style={styles.question}>{question || '這項條件需要向雇主確認'}</Text>
    {sourceText ? <Text style={styles.source}>原文：「{sourceText}」</Text> : null}
  </View>;
}
const styles = StyleSheet.create({
  card: { backgroundColor: colors.surfaceMuted, borderRadius: 18, padding: 14, gap: 8 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  tag: { color: colors.warning, fontSize: 12, fontWeight: '800' },
  question: { color: colors.text, fontSize: 14, lineHeight: 22, fontWeight: '700' },
  source: { color: colors.textMuted, fontSize: 12, lineHeight: 20 }
});
