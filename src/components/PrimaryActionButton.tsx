import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Button } from '@/src/ui';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary';
  style?: StyleProp<ViewStyle>;
};

/** 舊頁面的主要按鈕，外觀交給設計系統的 Button。 */
export function PrimaryActionButton({ label, onPress, disabled = false, loading = false, variant = 'primary', style }: Props) {
  return (
    <View style={style}>
      <Button label={label} onPress={onPress} disabled={disabled} loading={loading} variant={variant} />
    </View>
  );
}
