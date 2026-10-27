import { View } from 'react-native';
import Svg, { Circle, Ellipse, G, Line, Path, Polygon, Rect } from 'react-native-svg';
import { colors } from '@/src/theme/tokens';

const ink = colors.text;
const coral = colors.primary;
const blush = '#FFB8A6';

/**
 * 公文包貓咪拿放大鏡打勾：開場動畫（IntroAnimation）最後一格的靜態版，座標也和它相同。
 */
export function CatBriefcaseArt({ size = 112 }: { size?: number }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size} viewBox="40 90 960 960">
        <Polygon points="196,330 246,150 360,300" fill="#FFFFFF" stroke={ink} strokeWidth={40} strokeLinejoin="round" />
        <Polygon points="236,300 254,214 314,292" fill={coral} />
        <Polygon points="828,330 778,150 664,300" fill="#FFFFFF" stroke={ink} strokeWidth={40} strokeLinejoin="round" />
        <Polygon points="788,300 770,214 710,292" fill={coral} />
        <Path d="M372 296V250a62 62 0 0 1 62-62h156a62 62 0 0 1 62 62v46" fill="none" stroke={ink} strokeWidth={46} />
        <Rect x={196} y={420} width={632} height={408} rx={76} fill="#FFFFFF" stroke={ink} strokeWidth={46} />
        <Rect x={156} y={296} width={712} height={190} rx={76} fill="#FFFFFF" stroke={ink} strokeWidth={46} />
        <G stroke={ink} strokeWidth={18} strokeLinecap="round">
          <Line x1={170} y1={640} x2={60} y2={610} />
          <Line x1={170} y1={690} x2={52} y2={694} />
          <Line x1={854} y1={640} x2={964} y2={610} />
          <Line x1={854} y1={690} x2={972} y2={694} />
        </G>
        <Rect x={282} y={420} width={104} height={124} rx={30} fill={colors.accent} stroke={ink} strokeWidth={40} />
        <Rect x={638} y={420} width={104} height={124} rx={30} fill={colors.accent} stroke={ink} strokeWidth={40} />
        <G fill="none" stroke={ink} strokeWidth={16} strokeLinecap="round">
          <Path d="M310 496q24-30 48 0" />
          <Path d="M666 496q24-30 48 0" />
        </G>
        <Ellipse cx={292} cy={652} rx={46} ry={26} fill={blush} />
        <Ellipse cx={732} cy={652} rx={46} ry={26} fill={blush} />
        <Path d="M478 598h68l-34 38z" fill={coral} stroke={coral} strokeWidth={12} strokeLinejoin="round" />
        <Path d="M512 640v14M432 660q40 52 80 0q40 52 80 0" fill="none" stroke={ink} strokeWidth={26} strokeLinecap="round" strokeLinejoin="round" />
        {/* 放大鏡停在右下，鏡片中心 (690, 690) */}
        <G transform="translate(690 690)">
          <Line x1={84} y1={84} x2={196} y2={196} stroke={ink} strokeWidth={48} strokeLinecap="round" />
          <Circle r={124} fill="#FFFFFF" stroke={ink} strokeWidth={36} />
          <G transform="translate(224 224)">
            <Circle r={62} fill="#FFFFFF" stroke={ink} strokeWidth={24} />
            <Circle cx={-26} cy={-50} r={16} fill="#FFFFFF" stroke={ink} strokeWidth={14} />
            <Circle cx={16} cy={-58} r={16} fill="#FFFFFF" stroke={ink} strokeWidth={14} />
            <Circle cx={0} cy={12} r={20} fill={blush} />
          </G>
          <Path d="M-56 4l38 38 76-80" fill="none" stroke={coral} strokeWidth={30} strokeLinecap="round" strokeLinejoin="round" />
        </G>
      </Svg>
    </View>
  );
}
