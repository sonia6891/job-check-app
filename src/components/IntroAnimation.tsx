import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Line, Path, Polygon, Polyline, Rect } from 'react-native-svg';
import { colors } from '@/src/theme/tokens';
import { SignInButtons, type SignInMethod } from '@/src/components/SignInButtons';
import { showMessage } from '@/src/lib/uiAlerts';

/**
 * 開場動畫（2026-10-27）：App 圖示的公文包長出貓耳和鬍鬚，扣環變成眼睛、心跳線變成貓嘴，
 * 拿放大鏡把職缺掃一遍，最後打勾。預覽與分鏡見 docs/intro-animation.html。
 *
 * 第一格和原生啟動畫面（app.json 的 splash-mark，寬 200）同樣大小、同樣位置，接起來不會跳。
 * 所有零件畫在同一個 viewBox（40 90 960 960），用一條時間軸 t（毫秒）內插出每個零件的動作，
 * 只動 transform 和 opacity，交給原生執行緒跑。點一下就略過；系統開了「減少動態效果」就不播。
 *
 * 第一次打開（askSignIn）：動畫停在最後一格（貓＋「職缺體檢」），下面出現 Apple、Google、LINE、訪客
 * 四個登入按鈕；選完才淡出，接著才是引導頁。askSignIn 還不知道（null）時就停在最後一格等。
 */

const VIEW = { x: 40, y: 90, size: 960 };
// splash-mark.png：公文包（778 單位寬）在 1024 畫布裡縮成 900，畫面寬 200 → 每單位 0.2259 點。
const UNIT = (200 * 900) / 1024 / 778;
const SIZE = VIEW.size * UNIT;
// 公文包中心 (512, 508) 對齊螢幕中心，和啟動畫面一致。
const OFFSET = { x: (VIEW.x + VIEW.size / 2 - 512) * UNIT, y: (VIEW.y + VIEW.size / 2 - 508) * UNIT };
const DURATION = 4800;
// 淡出前的最後一格。
const HOLD = 4400;

const ink = colors.text;
const coral = colors.primary;
const yellow = colors.accent;
const blush = '#FFB8A6';
const viewBox = `${VIEW.x} ${VIEW.y} ${VIEW.size} ${VIEW.size}`;

/** 畫面座標（viewBox 單位）轉成 transformOrigin 的百分比。 */
const origin = (x: number, y: number) => `${((x - VIEW.x) / VIEW.size) * 100}% ${((y - VIEW.y) / VIEW.size) * 100}%`;
const px = (units: number) => units * UNIT;

type Props = {
  onDone: () => void;
  /** true：停在最後一格讓人選登入方式；false：直接播完；null：還在判斷，先停在最後一格。 */
  askSignIn: boolean | null;
};

export function IntroAnimation({ onDone, askSignIn }: Props) {
  const t = useRef(new Animated.Value(0)).current;
  const buttons = useRef(new Animated.Value(0)).current;
  const finished = useRef(false);
  const reachedHold = useRef(false);
  const leaving = useRef(false);
  const reduceMotion = useRef(false);
  const ask = useRef(askSignIn);
  ask.current = askSignIn;
  const [held, setHeld] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    t.stopAnimation();
    onDone();
  };

  // 從最後一格淡出。
  const leave = () => {
    if (leaving.current) return;
    leaving.current = true;
    if (reduceMotion.current) return finish();
    Animated.timing(t, { toValue: DURATION, duration: DURATION - HOLD, easing: Easing.linear, useNativeDriver: true })
      .start(({ finished: done }) => { if (done) finish(); });
  };

  // 到了最後一格：要問登入就秀按鈕，不用問就淡出。
  const decide = () => {
    if (!reachedHold.current || leaving.current || ask.current === null) return;
    if (!ask.current) return leave();
    setHeld(true);
    Animated.timing(buttons, { toValue: 1, duration: reduceMotion.current ? 0 : 350, useNativeDriver: true }).start();
  };

  const toHold = () => {
    if (reachedHold.current) return;
    t.stopAnimation();
    t.setValue(HOLD);
    reachedHold.current = true;
    decide();
  };

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduce) => {
        if (cancelled) return;
        reduceMotion.current = reduce;
        if (reduce) return toHold();
        Animated.timing(t, { toValue: HOLD, duration: HOLD, easing: Easing.linear, useNativeDriver: true })
          .start(({ finished: done }) => { if (done) toHold(); });
      })
      .catch(() => toHold());
    return () => { cancelled = true; t.stopAnimation(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { decide(); }, [askSignIn]);

  async function pick(method: SignInMethod, signIn: () => Promise<unknown>) {
    setBusy(method);
    try {
      await signIn();
      leave();
    } catch (error: any) {
      // 自己取消登入就留在這裡，不跳錯誤。
      const message = String(error?.message ?? error ?? '');
      if (!/cancel|取消/i.test(message) && error?.code !== 'ERR_REQUEST_CANCELED') showMessage('登入沒有完成', message || '請稍後再試，或先用訪客身分。');
    } finally {
      setBusy(null);
    }
  }

  const at = (input: number[], output: number[]) => t.interpolate({ inputRange: input, outputRange: output, extrapolate: 'clamp' });

  // 放大鏡：從右下伸進來，掃過左眼、右眼，最後拿在右下角（鏡片中心的位置，viewBox 單位）。
  const scanT = [1150, 1454, 1872, 2366, 2746];
  const lensX = at(scanT, [1180, 760, 340, 690, 690].map(v => px(v - VIEW.x)));
  const lensY = at(scanT, [1180, 700, 560, 560, 690].map(v => px(v - VIEW.y)));

  return (
    <View style={styles.overlay}>
      {/* 點畫面任何地方就跳到最後一格；登入按鈕放在這層外面，才不會變成按鈕裡的按鈕。 */}
      <Pressable style={StyleSheet.absoluteFill} onPress={toHold} disabled={held} accessibilityRole="button" accessibilityLabel="略過開場動畫" />
      <Animated.View pointerEvents="none" style={{ opacity: at([4450, DURATION], [1, 0]), transform: [{ translateY: buttons.interpolate({ inputRange: [0, 1], outputRange: [0, -60] }) }] }}>
        <View style={[styles.canvas, { transform: [{ translateX: OFFSET.x }, { translateY: OFFSET.y }] }]}>
          <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY: at([3050, 3250, 3400, 3550], [0, px(-22), px(4), 0]) }] }]}>
            {/* 貓耳朵：從蓋子後面長出來 */}
            <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: origin(278, 330), transform: [{ scale: at([350, 600, 800], [0, 1.12, 1]) }] }]}>
              <Svg width={SIZE} height={SIZE} viewBox={viewBox}>
                <Polygon points="196,330 246,150 360,300" fill="#FFFFFF" stroke={ink} strokeWidth={40} strokeLinejoin="round" />
                <Polygon points="236,300 254,214 314,292" fill={coral} />
              </Svg>
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: origin(746, 330), transform: [{ scale: at([350, 600, 800], [0, 1.12, 1]) }] }]}>
              <Svg width={SIZE} height={SIZE} viewBox={viewBox}>
                <Polygon points="828,330 778,150 664,300" fill="#FFFFFF" stroke={ink} strokeWidth={40} strokeLinejoin="round" />
                <Polygon points="788,300 770,214 710,292" fill={coral} />
              </Svg>
            </Animated.View>
            {/* 公文包本體（和 App 圖示相同） */}
            <Svg width={SIZE} height={SIZE} viewBox={viewBox} style={StyleSheet.absoluteFill}>
              <Path d="M372 296V250a62 62 0 0 1 62-62h156a62 62 0 0 1 62 62v46" fill="none" stroke={ink} strokeWidth={46} />
              <Rect x={196} y={420} width={632} height={408} rx={76} fill="#FFFFFF" stroke={ink} strokeWidth={46} />
              <Rect x={156} y={296} width={712} height={190} rx={76} fill="#FFFFFF" stroke={ink} strokeWidth={46} />
            </Svg>
            {/* 鬍鬚 */}
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: at([1000, 1350], [0, 1]) }]}>
              <Svg width={SIZE} height={SIZE} viewBox={viewBox}>
                <G stroke={ink} strokeWidth={18} strokeLinecap="round">
                  <Line x1={170} y1={640} x2={60} y2={610} />
                  <Line x1={170} y1={690} x2={52} y2={694} />
                  <Line x1={854} y1={640} x2={964} y2={610} />
                  <Line x1={854} y1={690} x2={972} y2={694} />
                </G>
              </Svg>
            </Animated.View>
            {/* 扣環就是眼睛：眨一下眼 */}
            <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: origin(512, 482), transform: [{ scaleY: at([950, 1080, 1210], [1, 0.12, 1]) }] }]}>
              <Svg width={SIZE} height={SIZE} viewBox={viewBox} style={StyleSheet.absoluteFill}>
                <Rect x={282} y={420} width={104} height={124} rx={30} fill={yellow} stroke={ink} strokeWidth={40} />
                <Rect x={638} y={420} width={104} height={124} rx={30} fill={yellow} stroke={ink} strokeWidth={40} />
              </Svg>
              {/* 眼珠跟著放大鏡看 */}
              <Animated.View style={[StyleSheet.absoluteFill, {
                opacity: at([550, 750, 2950, 3150], [0, 1, 1, 0]),
                transform: [{ translateX: at([1150, 1720, 2252, 2632], [0, px(-18), px(18), px(6)]) }]
              }]}>
                <Svg width={SIZE} height={SIZE} viewBox={viewBox}>
                  <Circle cx={334} cy={488} r={30} fill={ink} />
                  <Circle cx={325} cy={478} r={9} fill="#FFFFFF" />
                  <Circle cx={690} cy={488} r={30} fill={ink} />
                  <Circle cx={681} cy={478} r={9} fill="#FFFFFF" />
                </Svg>
              </Animated.View>
              {/* 掃完開心瞇眼 */}
              <Animated.View style={[StyleSheet.absoluteFill, { opacity: at([3000, 3200], [0, 1]) }]}>
                <Svg width={SIZE} height={SIZE} viewBox={viewBox}>
                  <G fill="none" stroke={ink} strokeWidth={16} strokeLinecap="round">
                    <Path d="M310 496q24-30 48 0" />
                    <Path d="M666 496q24-30 48 0" />
                  </G>
                </Svg>
              </Animated.View>
            </Animated.View>
            {/* 心跳線淡出，換成貓嘴 */}
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: at([750, 1000], [1, 0]) }]}>
              <Svg width={SIZE} height={SIZE} viewBox={viewBox}>
                <Polyline points="244,676 410,676 462,578 530,766 592,630 634,676 780,676" fill="none" stroke={coral} strokeWidth={58} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, {
              opacity: at([850, 1150], [0, 1]),
              transformOrigin: origin(512, 640),
              transform: [{ scale: at([850, 1150], [0.7, 1]) }]
            }]}>
              <Svg width={SIZE} height={SIZE} viewBox={viewBox}>
                <Ellipse cx={292} cy={652} rx={46} ry={26} fill={blush} />
                <Ellipse cx={732} cy={652} rx={46} ry={26} fill={blush} />
                <Path d="M478 598h68l-34 38z" fill={coral} stroke={coral} strokeWidth={12} strokeLinejoin="round" />
                <Path d="M512 640v14M432 660q40 52 80 0q40 52 80 0" fill="none" stroke={ink} strokeWidth={26} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </Animated.View>
            {/* 掃描光 */}
            <Animated.View style={[StyleSheet.absoluteFill, {
              opacity: at([1454, 1568, 2480, 2670], [0, 0.22, 0.22, 0]),
              transform: [{ translateY: at([1454, 2480], [0, px(300)]) }]
            }]}>
              <Svg width={SIZE} height={SIZE} viewBox={viewBox}>
                <Rect x={214} y={430} width={596} height={46} rx={23} fill={coral} />
              </Svg>
            </Animated.View>
          </Animated.View>

          {/* 貓掌拿放大鏡：畫在自己的小畫布，鏡片中心在小畫布的 (160, 160) */}
          <Animated.View style={[styles.scanner, { opacity: at([1150, 1300], [0, 1]), transform: [{ translateX: lensX }, { translateY: lensY }] }]}>
            <Svg width={px(480)} height={px(480)} viewBox="-160 -160 480 480">
              <Line x1={84} y1={84} x2={196} y2={196} stroke={ink} strokeWidth={48} strokeLinecap="round" />
              <Circle r={124} fill="#FFFFFF" fillOpacity={0.6} stroke={ink} strokeWidth={36} />
              <Path d="M-74-26a80 80 0 0 1 50-50" fill="none" stroke="#FFFFFF" strokeWidth={18} strokeLinecap="round" />
              <G transform="translate(224 224)">
                <Circle r={62} fill="#FFFFFF" stroke={ink} strokeWidth={24} />
                <Circle cx={-26} cy={-50} r={16} fill="#FFFFFF" stroke={ink} strokeWidth={14} />
                <Circle cx={16} cy={-58} r={16} fill="#FFFFFF" stroke={ink} strokeWidth={14} />
                <Circle cx={0} cy={12} r={20} fill={blush} />
              </G>
            </Svg>
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: at([2900, 3200], [0, 1]) }]}>
              <Svg width={px(480)} height={px(480)} viewBox="-160 -160 480 480">
                <Path d="M-56 4l38 38 76-80" fill="none" stroke={coral} strokeWidth={30} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </Animated.View>
          </Animated.View>
        </View>
        <Animated.Text style={[styles.wordmark, { opacity: at([3100, 3500], [0, 1]), transform: [{ translateX: OFFSET.x }, { translateY: OFFSET.y }] }]}>職缺體檢</Animated.Text>
        <Animated.Text style={[styles.tagline, { opacity: at([3400, 3800], [0, 1]), transform: [{ translateX: OFFSET.x }, { translateY: OFFSET.y }] }]}>找工作，先安心</Animated.Text>
      </Animated.View>
      {held ? (
        <Animated.View style={[styles.signIn, { opacity: Animated.multiply(buttons, at([4450, DURATION], [1, 0])), transform: [{ translateY: buttons.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}>
          <SignInButtons busy={busy} onPick={(method, signIn) => void pick(method, signIn)} onGuest={leave} />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 100, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  canvas: { width: SIZE, height: SIZE, overflow: 'visible' },
  // 選登入方式時貓和字往上挪 60，按鈕放在下面。
  signIn: { position: 'absolute', left: 0, right: 0, bottom: 96, alignItems: 'center' },
  // 放大鏡小畫布的左上角放在 viewBox 的 (VIEW.x - 160, VIEW.y - 160)，再用 translate 移到鏡片位置。
  scanner: { position: 'absolute', left: px(-160), top: px(-160), width: px(480), height: px(480) },
  // 字距也加在最後一個字後面，整行會往左偏半個字距；左邊補同樣寬度，再跟公文包一起平移 OFFSET.x，字才在同一條中線上。
  wordmark: { position: 'absolute', left: 0, right: 0, textAlign: 'center', top: SIZE + 4, paddingLeft: 2.4, fontSize: 30, fontWeight: '900', letterSpacing: 2.4, color: colors.text },
  tagline: { position: 'absolute', left: 0, right: 0, textAlign: 'center', top: SIZE + 52, paddingLeft: 3, fontSize: 17, fontWeight: '700', letterSpacing: 3, color: colors.textBody }
});
