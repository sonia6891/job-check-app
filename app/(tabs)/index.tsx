import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { api } from '@/src/lib/api';
import { ensureGuestSession, supabase } from '@/src/lib/supabase';
import { recognizeTextFromLocalImage, type OcrResult } from '@/src/lib/ocr';
import { prefs } from '@/src/lib/prefs';
import { SetupBanner } from '@/src/components/SetupBanner';
import { JobTextReview } from '@/src/components/JobTextReview';
import type { JobCardData } from '@/src/components/JobCard';
import { colors, onBrand, radius, shadow, space } from '@/src/theme/tokens';
import { Button, FocusStatusBar, IconCircle, Num, Screen, SectionTitle, T } from '@/src/ui';
import { showMessage } from '@/src/lib/uiAlerts';
import { MONTHLY_ANALYSIS_LIMIT } from '@/src/lib/usage';
import { relativeDay } from '@/src/lib/myJobs';

type PendingOcr = {
  assetUri: string;
  mimeType: string;
  filename: string | null;
  result: OcrResult;
};
type InputMode = 'text' | 'url' | 'image';
type Quota = { kind: 'loading' } | { kind: 'error' } | { kind: 'count'; remaining: number };
type RecentJob = JobCardData & { created_at?: string | null };

/** 小提醒輪流出現，一天換一則。內容都是勞動法規的基本常識。 */
const TIPS = [
  '求職不需要先付錢。被要求繳保證金、押金，先停下來。',
  '試用期也不能低於基本工資，勞健保從第一天就要保。',
  '平日加班前 2 小時，加班費至少要多給 1/3。',
  '每 7 天要有 2 天休假，一個月大約 8 天。',
  '雇主不能預扣薪水當違約金或賠償。'
];

function greeting(now: Date) {
  const h = now.getHours();
  return h < 11 ? '早安！' : h < 18 ? '午安！' : '晚安！';
}

/** 頁首右側的小插圖：寫字板加放大鏡打勾。 */
function ClipboardArt() {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <Svg width={120} height={108} viewBox="0 0 120 108">
      <Rect x={16} y={14} width={62} height={82} rx={12} fill="#FFFFFF" stroke={colors.text} strokeWidth={3} />
      <Rect x={34} y={7} width={26} height={13} rx={5} fill={colors.primary} stroke={colors.text} strokeWidth={3} />
      <Path d="M28 40h38M28 54h30M28 68h20" stroke={colors.text} strokeWidth={3} strokeLinecap="round" />
      <Circle cx={82} cy={68} r={21} fill={colors.accent} stroke={colors.text} strokeWidth={3} />
      <Path d="M97 83l15 15" stroke={colors.text} strokeWidth={6} strokeLinecap="round" />
      <Path d="M73 68l6 6 11-12" stroke={colors.text} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Circle cx={104} cy={22} r={5} fill={colors.primary} />
      <Circle cx={8} cy={88} r={4} fill={colors.success} />
    </Svg>
    </View>
  );
}

export default function HomeScreen() {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [setupReason, setSetupReason] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentJob[] | null>(null);
  const [recentError, setRecentError] = useState<string | null>(null);
  const [quota, setQuota] = useState<Quota>({ kind: 'loading' });
  const [pendingOcr, setPendingOcr] = useState<PendingOcr | null>(null);
  const [reviewText, setReviewText] = useState(false);
  const [ocrText, setOcrText] = useState('');
  const [mode, setMode] = useState<InputMode>('text');
  const [jobUrl, setJobUrl] = useState('');
  const [keepOriginal, setKeepOriginal] = useState(false);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const draftLoaded = useRef(false);

  // 還原上次沒送出的內容，之後每次變更都存起來。
  useEffect(() => {
    prefs.getDraft().then((draft) => {
      if (draft.text) setText(draft.text);
      if (draft.sourceUrl) setSourceUrl(draft.sourceUrl);
      draftLoaded.current = true;
    });
  }, []);

  useEffect(() => {
    if (!draftLoaded.current) return;
    void prefs.setDraft({ text, sourceUrl });
  }, [text, sourceUrl]);

  useFocusEffect(useCallback(() => {
    prefs.getKeepOriginal().then(setKeepOriginal);
    void init();
  }, []));

  async function init() {
    setRecentError(null);
    setRecent(null);
    setQuota({ kind: 'loading' });
    try {
      const auth = await ensureGuestSession();
      if (!auth.ok) {
        setSetupReason(auth.reason);
        setRecentError(auth.reason);
        setQuota({ kind: 'error' });
        return;
      }
      setSetupReason(null);
      const userId = auth.session.user.id;
      const [recentResult, usageResult] = await Promise.all([
        supabase.from('job_posts')
          .select('id,job_title,display_company_name,salary_raw,location_raw,created_at')
          .eq('user_id', userId).order('created_at', { ascending: false }).limit(4),
        supabase.from('usage_events')
          .select('units,period_start').eq('user_id', userId).eq('feature', 'job_analysis')
      ]);
      if (recentResult.error) {
        setRecentError(recentResult.error.message);
        setRecent([]);
      } else {
        setRecent((recentResult.data ?? []) as RecentJob[]);
      }
      if (usageResult.error) {
        setQuota({ kind: 'error' });
      } else {
        const now = new Date();
        const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        const used = (usageResult.data ?? [])
          .filter(x => x.period_start === month)
          .reduce((total, item) => total + (item.units || 0), 0);
        setQuota({ kind: 'count', remaining: Math.max(0, MONTHLY_ANALYSIS_LIMIT - used) });
      }
    } catch (error: any) {
      setRecentError(error?.message || '目前無法載入最近的職缺。');
      setRecent([]);
      setQuota({ kind: 'error' });
    }
  }

  async function analyzeText() {
    if (text.trim().length < 10) {
      return showMessage('內容太少', '請貼上完整一點的職缺內容。');
    }
    setBusy(true);
    try {
      const auth = await ensureGuestSession();
      if (!auth.ok) throw new Error(auth.reason);
      const parsed = await api.parseTextJob(text.trim(), null, undefined, sourceUrl);
      if (!parsed.job_id) throw new Error('job_id_missing');
      await prefs.setDraft({ text: '', sourceUrl: null });
      setReviewText(false);
      setText('');
      setSourceUrl(null);
      router.push(`/analysis/${parsed.job_id}`);
    } catch (e: any) {
      showMessage('無法開始體檢', e?.message ?? '請稍後再試。');
    } finally {
      setBusy(false);
    }
  }

  async function importUrl() {
    const value = jobUrl.trim();
    if (!/^https:\/\//i.test(value)) {
      return showMessage('網址格式不正確', '請貼上完整的 https:// 職缺網址。');
    }

    setBusy(true);
    try {
      const auth = await ensureGuestSession();
      if (!auth.ok) throw new Error(auth.reason);
      const result = await api.importJobUrl(value);

      if (result.status === 'parsed' && result.job_id) {
        setJobUrl('');
        router.push(`/analysis/${result.job_id}`);
        return;
      }

      // 網站沒給足夠的公開內容：切回貼文字，帶著擷取到的預覽讓使用者補。
      setJobUrl('');
      setSourceUrl(result.source_url || value);
      if (result.extracted_preview) setText(result.extracted_preview);
      setMode('text');
    } catch (e: any) {
      const payload = e?.payload;
      if (payload?.error === 'unsupported_job_site') {
        showMessage('目前尚未支援這個網站', '網址匯入目前支援 104、1111、518、Cake、Yourator、yes123；其他網站請先貼上職缺文字。');
      } else {
        showMessage('網址匯入失敗', e?.message ?? '請改用貼上職缺文字。');
      }
    } finally {
      setBusy(false);
    }
  }

  async function getImage(source: 'camera' | 'library') {
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        showMessage('需要相機權限', '請允許相機權限後再拍攝職缺內容。');
        return null;
      }
      return ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 1
      });
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showMessage('需要照片權限', '請允許照片權限後再選擇職缺截圖。');
      return null;
    }
    return ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1
    });
  }

  function chooseImageSource() {
    Alert.alert('加入職缺截圖', '你要從哪裡取得圖片？', [
      { text: '拍照', onPress: () => handleImage('camera') },
      { text: '從相簿選擇', onPress: () => handleImage('library') },
      { text: '取消', style: 'cancel' }
    ]);
  }

  async function handleImage(source: 'camera' | 'library') {
    const picked = await getImage(source);
    if (!picked || picked.canceled) return;
    const asset = picked.assets[0];
    if (!asset) return;
    setBusy(true);
    try {
      // OCR is local; no upload or analysis row until the user confirms the text.
      const result = await recognizeTextFromLocalImage(asset.uri);
      setPendingOcr({ assetUri: asset.uri, mimeType: asset.mimeType ?? 'image/jpeg', filename: asset.fileName ?? null, result });
      setOcrText(result.text);
    } catch (e: any) {
      if (String(e?.message) === 'native_ocr_requires_development_build') {
        showMessage('需要原生測試版', '本機 OCR 需要原生版本，網頁版可先使用貼上文字。');
      } else if (String(e?.message) === 'ocr_no_text_detected') {
        showMessage('無法辨識文字', '請重新拍攝清晰的職缺截圖。');
      } else {
        showMessage('圖片辨識失敗', e?.message ?? '請稍後再試。');
      }
    } finally {
      setBusy(false);
    }
  }

  async function confirmOcrAndAnalyze() {
    if (!pendingOcr || ocrText.trim().length < 10) {
      showMessage('文字不足', '請補齊辨識內容後再開始分析。');
      return;
    }
    setBusy(true);
    try {
      const auth = await ensureGuestSession();
      if (!auth.ok) throw new Error(auth.reason);
      const prep = await api.prepareUpload(pendingOcr.mimeType, pendingOcr.filename, await prefs.getKeepOriginal());
      const response = await fetch(pendingOcr.assetUri);
      const bytes = await response.arrayBuffer();
      const uploaded = await supabase.storage.from(prep.bucket).upload(prep.storage_path, bytes, {
        contentType: pendingOcr.mimeType, upsert: false
      });
      if (uploaded.error) throw uploaded.error;
      const parsed = await api.parseTextJob(ocrText.trim(), prep.job_post_id, {
        fileId: prep.file_id, engine: pendingOcr.result.engine,
        language: pendingOcr.result.language, confidence: pendingOcr.result.confidence
      });
      if (!parsed.job_id) throw new Error('job_id_missing');
      setPendingOcr(null);
      setOcrText('');
      router.push(`/analysis/${parsed.job_id}`);
    } catch (e: any) {
      showMessage('無法開始分析', e?.message ?? '請稍後再試，校正內容會保留。');
    } finally {
      setBusy(false);
    }
  }

  function discardOcr() {
    setPendingOcr(null);
    setOcrText('');
  }

  const now = new Date();
  const tip = TIPS[Math.floor(now.getTime() / 86400000) % TIPS.length];
  const urlMode = mode === 'url';

  function pickImage() {
    if (Platform.OS === 'web') {
      showMessage('網頁版不能辨識截圖', '請改用貼上文字，或用 iPhone／Android App 拍照辨識。');
      return;
    }
    chooseImageSource();
  }

  const header = (
    <View style={styles.greeting}>
      <FocusStatusBar style="dark" />
      <View style={{ flex: 1, gap: 4 }}>
        <T variant="captionStrong" color={colors.primary}>{greeting(now)}</T>
        <T variant="display" accessibilityRole="header">想先檢查{'\n'}哪份工作？</T>
      </View>
      <ClipboardArt />
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <Screen safeTop tabBar header={header}>
        <View style={styles.pasteCard}>
          <View style={{ gap: 2 }}>
            <T variant="title" color={onBrand.text}>{urlMode ? '貼上職缺網址' : '貼上職缺'}</T>
            <T variant="caption" color={onBrand.muted}>{urlMode ? '支援 104、1111、518、Cake、Yourator、yes123' : '30 秒幫你找出藏在裡面的地雷'}</T>
          </View>

          {sourceUrl && !urlMode ? (
            <View style={styles.sourceBox}>
              <View style={styles.sourceHead}>
                <Ionicons name="link" size={15} color={colors.primary} />
                <T variant="captionStrong" color={colors.primary} style={{ flex: 1 }}>這個網址需要補一點文字</T>
                <Pressable onPress={() => setSourceUrl(null)} hitSlop={12} accessibilityRole="button" accessibilityLabel="移除來源網址">
                  <Ionicons name="close" size={18} color={colors.textMuted} />
                </Pressable>
              </View>
              <T variant="small" numberOfLines={1} color={colors.textBody}>{sourceUrl}</T>
              <T variant="small" color={colors.textBody}>
                {text ? '下面是網站公開內容的擷取預覽，請補上缺的部分（薪資、工時、公司名稱）再開始檢查。' : '網站沒有提供足夠的公開內容，請把職缺頁面的文字貼到下面。'}
              </T>
            </View>
          ) : null}

          {urlMode ? (
            <TextInput
              accessibilityLabel="職缺網址"
              value={jobUrl}
              onChangeText={setJobUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              placeholder="https://www.104.com.tw/job/..."
              placeholderTextColor={colors.placeholder}
              style={[styles.input, styles.urlInput]}
            />
          ) : (
            <TextInput
              accessibilityLabel="職缺文字內容"
              accessibilityHint="貼上職缺文字，至少十個字才能檢查"
              value={text}
              onChangeText={setText}
              editable={!busy}
              multiline
              textAlignVertical="top"
              placeholder="把 104、1111 或 Facebook 社團上的職缺整段貼進來…"
              placeholderTextColor={colors.placeholder}
              style={[styles.input, styles.textArea, busy && { opacity: 0.6 }]}
            />
          )}

          <View style={styles.actions}>
            <View style={{ flex: 1 }}>
              {urlMode
                ? <Button variant="white" icon="link" label="讀取這份職缺" loading={busy} disabled={Boolean(setupReason)} onPress={() => { void importUrl(); }} />
                : <Button variant="white" icon="search" label="開始檢查" loading={busy} disabled={Boolean(setupReason)}
                    onPress={() => {
                      if (text.trim().length < 10) showMessage('職缺文字太少', '請貼上完整一點的職缺內容，至少 10 個字。');
                      else setReviewText(true);
                    }} />}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={urlMode ? '改回貼上文字' : '改用職缺網址'} accessibilityState={{ selected: urlMode }}
              onPress={() => setMode(urlMode ? 'text' : 'url')} style={({ pressed }) => [styles.modeBtn, urlMode && styles.modeBtnOn, pressed && { opacity: 0.8 }]}>
              <Ionicons name={urlMode ? 'document-text' : 'link'} size={22} color={urlMode ? colors.primary : '#FFFFFF'} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="拍照或選擇職缺截圖" onPress={pickImage} disabled={busy}
              style={({ pressed }) => [styles.modeBtn, pressed && { opacity: 0.8 }]}>
              <Ionicons name="camera" size={22} color="#FFFFFF" />
            </Pressable>
          </View>

          <View style={styles.quota} accessible accessibilityLabel={quota.kind === 'count' ? `免費，這個月還可以檢查 ${quota.remaining} 次，每月 ${MONTHLY_ANALYSIS_LIMIT} 次` : '本月檢查次數'}>
            {quota.kind === 'count' ? (
              <View style={styles.quotaTrack}><View style={[styles.quotaFill, { width: `${(quota.remaining / MONTHLY_ANALYSIS_LIMIT) * 100}%` }]} /></View>
            ) : quota.kind === 'loading' ? <ActivityIndicator size="small" color="#FFFFFF" /> : null}
            <T variant="caption" color={onBrand.muted}>
              {quota.kind === 'count' ? `免費・這個月還可以檢查 ${quota.remaining} 次` : quota.kind === 'error' ? '暫時讀不到本月次數' : '讀取本月次數…'}
            </T>
          </View>
        </View>

        <SetupBanner reason={setupReason} />

        <View style={styles.tip}>
          <View style={styles.tipIcon}><Ionicons name="bulb" size={20} color={colors.text} /></View>
          <View style={{ flex: 1, gap: 2 }}>
            <T variant="captionStrong" color={colors.warning}>小提醒</T>
            <T variant="caption" color={colors.textBody}>{tip}</T>
          </View>
        </View>

        <SectionTitle title="最近檢查的工作" action={recent && recent.length ? '全部' : undefined} onAction={() => router.push('/jobs')} />
        {recentError ? (
          <View style={styles.recentEmpty}>
            <T variant="caption" muted style={{ textAlign: 'center' }}>最近紀錄暫時讀不到</T>
            <Button compact variant="soft" icon="refresh" label="重新讀取" onPress={() => { void init(); }} />
          </View>
        ) : recent === null ? (
          [0, 1].map(i => <View key={i} style={styles.skeleton} />)
        ) : recent.length === 0 ? (
          <View style={styles.recentEmpty}>
            <IconCircle icon="document-text" coral />
            <T variant="caption" muted style={{ textAlign: 'center' }}>還沒有檢查過的工作。貼上一份職缺，30 秒內就能看到報告。</T>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {recent.map(job => {
              const day = relativeDay(job.created_at, now);
              return (
                <Pressable key={job.id} accessibilityRole="button"
                  accessibilityLabel={`查看體檢報告：${job.job_title || '未命名職缺'}，${job.display_company_name || '公司待確認'}`}
                  onPress={() => router.push(`/report/${job.id}`)}
                  style={({ pressed }) => [styles.jobRow, pressed && { opacity: 0.85 }]}>
                  <IconCircle icon="briefcase" coral />
                  <View style={{ flex: 1, gap: 2 }}>
                    <T variant="bodyStrong" numberOfLines={1}>{[job.job_title || '未命名職缺', job.display_company_name].filter(Boolean).join('・')}</T>
                    <T variant="caption" muted numberOfLines={1}>{[day ? `${day}檢查` : null, job.salary_raw].filter(Boolean).join('・') || '薪資沒寫'}</T>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.placeholder} />
                </Pressable>
              );
            })}
          </View>
        )}
        <View style={styles.privacy}>
          <Ionicons name="shield-checkmark" size={15} color={colors.success} />
          <T variant="small" muted style={{ flex: 1 }}>職缺內容只用來產生你的報告；{keepOriginal ? '已設定保留截圖原圖。' : '截圖原圖 24 小時內自動刪除。'}</T>
        </View>
      </Screen>

      <JobTextReview
        visible={Boolean(pendingOcr) || reviewText}
        mode={pendingOcr ? 'ocr' : 'text'}
        text={pendingOcr ? ocrText : text}
        sourceUrl={pendingOcr ? null : sourceUrl}
        busy={busy}
        onChangeText={pendingOcr ? setOcrText : setText}
        onCancel={pendingOcr ? discardOcr : () => setReviewText(false)}
        onConfirm={() => { void (pendingOcr ? confirmOcrAndAnalyze() : analyzeText()); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  greeting: { flexDirection: 'row', alignItems: 'center', paddingLeft: 20, paddingRight: space.lg, paddingBottom: space.lg, gap: space.sm },
  pasteCard: { backgroundColor: colors.primary, borderRadius: radius.xxl, padding: 18, gap: 14, ...shadow.coral },
  input: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: 14, fontSize: 15, lineHeight: 22, color: colors.text },
  textArea: { minHeight: 96, maxHeight: 220, paddingTop: 12, paddingBottom: 12 },
  urlInput: { minHeight: 54 },
  sourceBox: { backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md, gap: 4 },
  sourceHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modeBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: onBrand.chip, alignItems: 'center', justifyContent: 'center' },
  modeBtnOn: { backgroundColor: colors.surface },
  quota: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  quotaTrack: { width: 72, height: 6, borderRadius: 3, backgroundColor: onBrand.track, overflow: 'hidden' },
  quotaFill: { height: 6, borderRadius: 3, backgroundColor: '#FFFFFF' },
  tip: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.accentSoft, borderRadius: 22, padding: 14 },
  tipIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  jobRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.surface, borderRadius: 22, padding: 14, ...shadow.card },
  skeleton: { height: 72, borderRadius: 22, backgroundColor: colors.neutralSoft },
  recentEmpty: { alignItems: 'center', gap: space.sm, backgroundColor: colors.surface, borderRadius: 22, padding: space.xxl, ...shadow.card },
  privacy: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.xs }
});
