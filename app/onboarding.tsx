import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { CatBriefcaseArt } from '@/src/components/CatBriefcaseArt';
import { prefs } from '@/src/lib/prefs';
import { colors, space } from '@/src/theme/tokens';
import { Button, FocusStatusBar, T } from '@/src/ui';

const ink = colors.text;

/** 三張引導頁的插圖（Figma「引導頁」）。 */
function Art({ index }: { index: number }) {
  // 和開場動畫最後一格同一隻公文包貓咪，拿放大鏡打勾。
  if (index === 0) return (
    <View style={{ width: 280, height: 224 }}>
      <Svg width={280} height={224} viewBox="0 0 300 240">
        <Circle cx={150} cy={128} r={104} fill={colors.verdict} />
        <Circle cx={252} cy={44} r={14} fill={colors.accent} />
        <Circle cx={46} cy={196} r={9} fill={colors.success} />
      </Svg>
      <View style={{ position: 'absolute', left: 45, top: 24 }}><CatBriefcaseArt size={190} /></View>
    </View>
  );
  if (index === 1) return (
    <Svg width={280} height={224} viewBox="0 0 300 240">
      <Circle cx={150} cy={128} r={104} fill={colors.successSoft} />
      <Circle cx={56} cy={52} r={12} fill={colors.primary} />
      <Circle cx={254} cy={188} r={10} fill={colors.accent} />
      <Path d="M70 196h160" stroke={ink} strokeWidth={5} strokeLinecap="round" />
      <Path d="M90 196V96l60-34 60 34v100" fill="#FFFFFF" stroke={ink} strokeWidth={5} strokeLinejoin="round" />
      <Path d="M118 116h14M168 116h14M118 146h14M168 146h14" stroke={ink} strokeWidth={5} strokeLinecap="round" />
      <Path d="M136 196v-30h28v30" fill={colors.accent} stroke={ink} strokeWidth={5} strokeLinejoin="round" />
      <Path d="M216 70l34 13v26c0 22-15 35-34 40-19-5-34-18-34-40V83z" fill={colors.success} stroke={ink} strokeWidth={5} strokeLinejoin="round" />
      <Path d="M203 108l9 9 18-19" stroke="#FFFFFF" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
  return (
    <Svg width={280} height={224} viewBox="0 0 300 240">
      <Circle cx={150} cy={128} r={104} fill={colors.accentSoft} />
      <Circle cx={250} cy={56} r={11} fill={colors.success} />
      <Circle cx={50} cy={184} r={12} fill={colors.primary} />
      <Rect x={58} y={56} width={150} height={70} rx={22} fill="#FFFFFF" stroke={ink} strokeWidth={5} />
      <Path d="M86 126l-8 22 26-22" fill="#FFFFFF" stroke={ink} strokeWidth={5} strokeLinejoin="round" />
      <Path d="M84 84h96M84 104h64" stroke={ink} strokeWidth={5} strokeLinecap="round" />
      <Rect x={112} y={132} width={136} height={64} rx={22} fill={colors.primary} stroke={ink} strokeWidth={5} />
      <Path d="M220 196l10 20-26-20" fill={colors.primary} stroke={ink} strokeWidth={5} strokeLinejoin="round" />
      <Path d="M136 164l10 10 20-22" stroke="#FFFFFF" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d="M182 158h44M182 174h28" stroke="#FFFFFF" strokeWidth={5} strokeLinecap="round" />
    </Svg>
  );
}

const PAGES = [
  { title: '投履歷之前，\n先幫工作做個體檢', body: '貼上職缺，30 秒找出藏在裡面的地雷：要先付錢、薪水低於基本工資、休假不夠。' },
  { title: '資料都來自\n政府公開資料', body: '公司登記、勞動違規紀錄、薪資統計，每一項都附上來源。我們不打分數，只把事實整理給你。' },
  { title: '面試前，\n先知道要問什麼', body: '每份報告都整理成面試問題。問過就勾起來，也能記下老闆怎麼回答。' }
];

/** 第一次打開的引導頁（Figma「引導頁 1–3」）。從「我的」重看時帶 replay=1，看完回上一頁。 */
export default function OnboardingScreen() {
  const { replay } = useLocalSearchParams<{ replay?: string }>();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scroller = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const last = page === PAGES.length - 1;

  async function finish() {
    await prefs.setOnboarded();
    if (replay && router.canGoBack()) router.back();
    else router.replace('/');
  }

  function goTo(next: number) {
    scroller.current?.scrollTo({ x: next * width, animated: true });
    setPage(next);
  }

  function onScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    setPage(Math.round(e.nativeEvent.contentOffset.x / width));
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + space.sm, paddingBottom: Math.max(insets.bottom, space.lg) + space.lg }]}>
      <FocusStatusBar style="dark" />
      <View style={styles.top}>
        {!last ? (
          <Pressable accessibilityRole="button" onPress={() => { void finish(); }} hitSlop={12}>
            <T variant="captionStrong" muted>略過</T>
          </Pressable>
        ) : <View style={{ height: 20 }} />}
      </View>
      <ScrollView ref={scroller} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd} style={{ flex: 1 }}>
        {PAGES.map((p, i) => (
          <View key={p.title} style={[styles.page, { width }]} accessible accessibilityLabel={`${p.title.replace('\n', '')}。${p.body}`}>
            <View style={styles.art}><Art index={i} /></View>
            <View style={styles.text}>
              <T variant="display" style={styles.center}>{p.title}</T>
              <T variant="body" color={colors.textBody} style={styles.center}>{p.body}</T>
            </View>
          </View>
        ))}
      </ScrollView>
      <View style={styles.bottom}>
        <View style={styles.dots} accessible accessibilityLabel={`第 ${page + 1} 頁，共 ${PAGES.length} 頁`}>
          {PAGES.map((_, i) => <View key={i} style={[styles.dot, i === page && styles.dotOn]} />)}
        </View>
        <View style={{ alignSelf: 'stretch' }}>
          <Button icon={last ? 'checkmark' : 'arrow-forward'} label={last ? '開始使用' : '下一步'} onPress={() => last ? void finish() : goTo(page + 1)} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  top: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 24, minHeight: 28 },
  page: { flex: 1, paddingHorizontal: 28 },
  art: { alignItems: 'center', paddingTop: 32, paddingBottom: 24 },
  // 插圖置中，文字也置中，兩者才對得齊。
  text: { gap: 12, alignItems: 'center' },
  center: { textAlign: 'center' },
  bottom: { alignItems: 'center', gap: 18, paddingHorizontal: 24 },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.lineStrong },
  dotOn: { width: 22, backgroundColor: colors.primary }
});
