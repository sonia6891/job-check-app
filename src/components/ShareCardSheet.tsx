import { useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { colors, onBrand, radius, space, tone as toneStyles } from '@/src/theme/tokens';
import { Button, T } from '@/src/ui';
import type { ShareCardItem } from '@/src/lib/shareCard';
import { BrandIcon } from '@/src/components/BrandIcon';
import { showMessage } from '@/src/lib/uiAlerts';

type Props = {
  visible: boolean;
  jobLine: string;
  verdict: string;
  items: ShareCardItem[];
  onClose: () => void;
  onShareText: () => void;
};

/** 網頁版：瀏覽器支援就用系統分享，不支援就直接下載圖片。 */
async function shareOnWeb(dataUrl: string) {
  const nav = (globalThis as any).navigator;
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const file = new (globalThis as any).File([blob], 'job-check.png', { type: 'image/png' });
    if (nav?.canShare?.({ files: [file] })) {
      await nav.share({ files: [file], title: '職缺體檢摘要' });
      return;
    }
  } catch (e: any) {
    if (e?.name === 'AbortError') return;
  }
  const doc = (globalThis as any).document;
  const a = doc.createElement('a');
  a.href = dataUrl;
  a.download = 'job-check.png';
  a.click();
}

/**
 * 分享圖片卡（Figma「分享圖片卡」，4:5）：預覽後可以分享成圖片傳 LINE／IG，或改分享文字。
 * 卡片只放這份職缺的結論與重點，不含帳號或個人資料。
 */
export function ShareCardSheet({ visible, jobLine, verdict, items, onClose, onShareText }: Props) {
  const insets = useSafeAreaInsets();
  const cardRef = useRef<View>(null);
  const [busy, setBusy] = useState(false);

  async function shareImage() {
    if (!cardRef.current || busy) return;
    setBusy(true);
    try {
      const uri = await captureRef(cardRef, { format: 'png', quality: 1, result: Platform.OS === 'web' ? 'data-uri' : 'tmpfile' });
      if (Platform.OS === 'web') {
        await shareOnWeb(uri);
      } else if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: '分享體檢摘要' });
      } else {
        showMessage('這台裝置不能分享圖片', '可以改用「分享文字」。');
      }
    } catch {
      showMessage('圖片沒有產生', '可以再試一次，或改用「分享文字」。');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="關閉分享" onPress={busy ? undefined : onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space.lg) + space.sm }]}>
          <View style={styles.grabber} />
          <T variant="heading" style={{ textAlign: 'center' }} accessibilityRole="header">分享體檢摘要</T>

          <View ref={cardRef} collapsable={false} style={styles.card} accessible accessibilityLabel={`分享圖片：${jobLine}。${verdict.replace('\n', '')}`}>
            <View style={styles.cardHead}>
              <BrandIcon size={34} border={colors.surface} />
              <View style={{ flex: 1 }}>
                <T variant="subhead" color={onBrand.text}>職缺體檢</T>
                <T variant="label" color={onBrand.muted}>我幫這份工作做了體檢</T>
              </View>
            </View>
            <View style={styles.cardBody}>
              <T variant="captionStrong" muted numberOfLines={1}>{jobLine}</T>
              <T variant="title">{verdict}</T>
              <View style={{ gap: 8 }}>
                {items.map(item => (
                  <View key={item.text} style={[styles.item, { backgroundColor: toneStyles[item.tone].bg }]}>
                    <Ionicons name={item.icon} size={18} color={toneStyles[item.tone].iconColor} />
                    <T variant="captionStrong" style={{ flex: 1 }}>{item.text}</T>
                  </View>
                ))}
              </View>
            </View>
            <View style={styles.cardFoot}>
              <View style={styles.footRow}>
                <T variant="captionStrong" color={colors.primary}>用職缺體檢免費查一份</T>
                <Ionicons name="arrow-forward" size={16} color={colors.primary} />
              </View>
              <T variant="label" muted>依公開資料與職缺內容整理，不代表法律判斷</T>
            </View>
          </View>

          <View style={{ gap: 10 }}>
            <Button icon="image" label="分享圖片" loading={busy} onPress={() => { void shareImage(); }} />
            <Button variant="outline" icon="document-text-outline" label="分享文字" disabled={busy} onPress={onShareText} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(43,33,24,0.45)' },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl, paddingHorizontal: 20, paddingTop: 10, gap: space.lg },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.lineStrong },
  card: { alignSelf: 'center', width: 320, minHeight: 400, backgroundColor: colors.bg, borderRadius: 28, overflow: 'hidden', borderWidth: 1, borderColor: colors.line },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.primary, paddingHorizontal: 18, paddingVertical: 14 },
  cardBody: { flex: 1, padding: 18, gap: 12 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
  cardFoot: { backgroundColor: colors.surface, paddingHorizontal: 18, paddingVertical: 12, gap: 4 },
  footRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }
});
