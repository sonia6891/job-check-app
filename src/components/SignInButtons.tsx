import { useEffect, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import Svg, { Path, Rect } from 'react-native-svg';
import { authActions } from '@/src/lib/auth';
import { colors } from '@/src/theme/colors';
import { T } from '@/src/ui';

export type SignInMethod = 'apple' | 'google' | 'line' | 'guest';

type Props = {
  /** 正在登入的方式；有值時按鈕都不能按。 */
  busy: string | null;
  onPick: (method: SignInMethod, signIn: () => Promise<unknown>) => void;
  /** 有給才顯示「訪客」：第一次打開時可以先不登入。 */
  onGuest?: () => void;
};

const SIZE = 58;

/**
 * Apple、Google、LINE（和訪客）排成一列圓形按鈕，和「喵的，又要上班了」的登入畫面同一種樣子。
 * 「我的」和第一次打開的引導頁共用。
 */
export function SignInButtons({ busy, onPick, onGuest }: Props) {
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'ios') {
      AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => setAppleAvailable(false));
    }
  }, []);

  return (
    <View style={styles.row}>
      {appleAvailable ? (
        <Orb label="Apple" a11y="用 Apple 繼續" busy={busy === 'apple'} disabled={Boolean(busy)} style={styles.apple} edge="#000000"
          onPress={() => onPick('apple', authActions.signInWithApple)}>
          <Svg width={26} height={26} viewBox="0 0 24 24">
            <Path fill="#FFFFFF" d="M17.05 12.54c.03 3.22 2.83 4.29 2.86 4.31-.02.08-.45 1.53-1.48 3.03-.9 1.3-1.84 2.6-3.31 2.62-1.44.03-1.9-.85-3.55-.85-1.64 0-2.16.82-3.52.88-1.42.05-2.5-1.41-3.41-2.71-1.85-2.68-3.27-7.58-1.37-10.89.94-1.64 2.62-2.68 4.44-2.71 1.38-.03 2.68.93 3.52.93.84 0 2.42-1.15 4.08-.98.7.03 2.68.28 3.95 2.14-.1.06-2.36 1.37-2.33 4.23ZM14.33 4.42c.76-.93 1.28-2.22 1.14-3.5-1.1.04-2.44.74-3.23 1.67-.71.81-1.33 2.12-1.16 3.37 1.23.1 2.49-.62 3.25-1.54Z" />
          </Svg>
        </Orb>
      ) : null}
      <Orb label="Google" a11y="用 Google 繼續" busy={busy === 'google'} disabled={Boolean(busy)} style={styles.google} edge="#B9B5AF"
        onPress={() => onPick('google', authActions.signInWithGoogle)}>
        <Svg width={26} height={26} viewBox="0 0 24 24">
          <Path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.61 4.61 0 0 1-2 3.03v2.52h3.24c1.9-1.75 2.98-4.33 2.98-7.38Z" />
          <Path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.61-2.4l-3.23-2.52c-.9.6-2.06.97-3.38.97-2.6 0-4.81-1.76-5.6-4.13H3.06v2.59A10 10 0 0 0 12 22Z" />
          <Path fill="#FBBC05" d="M6.4 13.92A6 6 0 0 1 6.09 12c0-.66.11-1.3.31-1.92V7.49H3.06A10 10 0 0 0 2 12c0 1.61.38 3.14 1.06 4.51l3.34-2.59Z" />
          <Path fill="#EA4335" d="M12 5.95c1.47 0 2.79.5 3.82 1.49l2.87-2.87A9.63 9.63 0 0 0 12 2a10 10 0 0 0-8.94 5.49l3.34 2.59A6 6 0 0 1 12 5.95Z" />
        </Svg>
      </Orb>
      <Orb label="LINE" a11y="用 LINE 繼續" busy={busy === 'line'} disabled={Boolean(busy)} style={styles.line} edge="#03843A"
        onPress={() => onPick('line', authActions.signInWithLine)}>
        <T style={styles.lineMark}>LINE</T>
      </Orb>
      {onGuest ? (
        <Orb label="訪客" a11y="先用訪客身分試試" busy={false} disabled={Boolean(busy)} style={styles.guest} edge="#A8402F" onPress={onGuest}>
          <GuestMark />
        </Orb>
      ) : null}
    </View>
  );
}

/** 訪客：App 圖示的公文包（和 assets/brand/app-icon.svg 同一個圖形）。 */
function GuestMark() {
  return (
    <Svg width={38} height={38} viewBox="120 150 784 720">
      <Path d="M372 296V250a62 62 0 0 1 62-62h156a62 62 0 0 1 62 62v46" fill="none" stroke={colors.text} strokeWidth={46} />
      <Rect x={196} y={420} width={632} height={408} rx={76} fill="#FFFFFF" stroke={colors.text} strokeWidth={46} />
      <Rect x={156} y={296} width={712} height={190} rx={76} fill="#FFFFFF" stroke={colors.text} strokeWidth={46} />
      <Rect x={282} y={420} width={104} height={124} rx={30} fill={colors.accent} stroke={colors.text} strokeWidth={40} />
      <Rect x={638} y={420} width={104} height={124} rx={30} fill={colors.accent} stroke={colors.text} strokeWidth={40} />
      <Path d="M244 676H410L462 578L530 766L592 630L634 676H780" fill="none" stroke={colors.primary} strokeWidth={58} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

type OrbProps = {
  label: string;
  a11y: string;
  busy: boolean;
  disabled: boolean;
  style: ViewStyle;
  /** 圓下緣的厚度色，按下去像沉下去。 */
  edge: string;
  onPress: () => void;
  children: ReactNode;
};

function Orb({ label, a11y, busy, disabled, style, edge, onPress, children }: OrbProps) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y} accessibilityState={{ disabled, busy }} disabled={disabled} onPress={onPress}
      style={styles.item} hitSlop={6}>
      {({ pressed }) => (
        <>
          <View style={[styles.orb, style, { shadowColor: edge }, pressed ? styles.orbPressed : { borderBottomWidth: 4, borderBottomColor: edge }, (busy || (disabled && !pressed)) && styles.dim]}>
            {children}
          </View>
          <T variant="captionStrong" color={colors.textBody}>{busy ? '登入中…' : label}</T>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start', gap: 18 },
  item: { alignItems: 'center', gap: 7, minWidth: SIZE },
  orb: {
    width: SIZE, height: SIZE, borderRadius: SIZE / 2, alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.28, shadowRadius: 8
  },
  orbPressed: { transform: [{ translateY: 3 }], shadowOpacity: 0.12 },
  dim: { opacity: 0.55 },
  apple: { backgroundColor: '#1B1816', borderWidth: 1, borderColor: '#000000' },
  google: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#747775' },
  line: { backgroundColor: '#06C755', borderWidth: 1, borderColor: '#05A648' },
  lineMark: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', letterSpacing: 0.3 },
  guest: { backgroundColor: colors.primary, borderWidth: 1, borderColor: '#A8402F' }
});
