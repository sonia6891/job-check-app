import { View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { colors } from '@/src/theme/colors';

/** App 圖示「體檢板」的小尺寸版本（母檔：assets/brand/app-icon.svg），用在分享圖片卡等處。 */
export function BrandIcon({ size = 32, border }: { size?: number; border?: string }) {
  const ink = colors.text;
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.2237, overflow: 'hidden', borderWidth: border ? 2 : 0, borderColor: border }}>
      <Svg width="100%" height="100%" viewBox="0 0 1024 1024">
        <Defs>
          <LinearGradient id="brandBg" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FF8E6E" />
            <Stop offset="1" stopColor={colors.primary} />
          </LinearGradient>
        </Defs>
        <Rect width={1024} height={1024} fill="url(#brandBg)" />
        <Path fill="#FFFFFF" d="M815 124C834.44 212.56 834.44 212.56 923 232C834.44 251.44 834.44 251.44 815 340C795.56 251.44 795.56 251.44 707 232C795.56 212.56 795.56 212.56 815 124Z" />
        <Path fill="#FFFFFF" d="M928 342C937 383 937 383 978 392C937 401 937 401 928 442C919 401 919 401 878 392C919 383 919 383 928 342Z" />
        <G transform="translate(512 512) scale(1.15) translate(-552 -506)">
          <Rect x={236} y={214} width={420} height={560} rx={70} fill="#FFFFFF" stroke={ink} strokeWidth={30} />
          <Rect x={352} y={160} width={188} height={104} rx={36} fill={colors.accent} stroke={ink} strokeWidth={30} />
          <Path d="M322 380h248M322 474h186M322 568h112" stroke={ink} strokeWidth={30} strokeLinecap="round" />
          <Circle cx={642} cy={626} r={158} fill={colors.accent} stroke={ink} strokeWidth={30} />
          <Path d="M756 740l96 96" stroke={ink} strokeWidth={64} strokeLinecap="round" />
          <Path d="M572 628l50 50 92-104" fill="none" stroke={ink} strokeWidth={38} strokeLinecap="round" strokeLinejoin="round" />
        </G>
      </Svg>
    </View>
  );
}
