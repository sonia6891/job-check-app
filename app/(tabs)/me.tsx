import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActionSheetIOS, ActivityIndicator, Alert, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/src/lib/supabase';
import { api } from '@/src/lib/api';
import { authActions, LINE_PROVIDER } from '@/src/lib/auth';
import type { TransferNotice } from '@/src/lib/accountTransferStatus';
import { prefs } from '@/src/lib/prefs';
import { freeMonthlyLimit, paymentsEnabled, usePlan } from '@/src/lib/plan';
import { useAuth } from '@/src/auth/AuthProvider';
import { SetupBanner } from '@/src/components/SetupBanner';
import { SignInButtons } from '@/src/components/SignInButtons';
import { avatarUrl, NAME_MAX, providerProfile, updateDisplayName, uploadAvatar } from '@/src/lib/profile';
import { colors } from '@/src/theme/colors';
import { showMessage, confirmAction } from '@/src/lib/uiAlerts';
import { Button, Chip, FocusStatusBar, Notice, Num, Screen, Surface, T } from '@/src/ui';
import { ProgressBar } from '@/src/ui/viz';
import { radius, shadow, space } from '@/src/theme/tokens';

function providerLabel(provider?: string) {
  if (provider === 'apple') return 'Apple';
  if (provider === 'google') return 'Google';
  if (provider === LINE_PROVIDER) return 'LINE';
  return '第三方帳號';
}

export default function MeScreen() {
  const { user, loading: authLoading, setupIssue } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  // 次數與上限都由後端的 job_analysis_quota_status 決定，畫面不自己算。
  const [usage, setUsage] = useState<{ used: number; limit: number } | null>(null);
  const used = usage?.used ?? 0;
  const limit = usage?.limit ?? freeMonthlyLimit;
  const plan = usePlan();
  const [busy, setBusy] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [keepOriginal, setKeepOriginal] = useState(false);
  const [guestTransfer, setGuestTransfer] = useState<TransferNotice>(() => authActions.getGuestTransferNotice());

  useEffect(() => {
    prefs.getKeepOriginal().then(setKeepOriginal);
  }, []);

  function toggleKeepOriginal(value: boolean) {
    setKeepOriginal(value);
    void prefs.setKeepOriginal(value);
  }

  const reload = useCallback(async () => {
    if (!user) return;
    const [{ data: p }, { data: status }] = await Promise.all([
      supabase.from('profiles').select('display_name,avatar_path').eq('id', user.id).single(),
      supabase.rpc('job_analysis_quota_status')
    ]);
    setProfile(p);
    setAvatar(await avatarUrl((p as any)?.avatar_path));
    const s = status as { used?: number; limit?: number } | null;
    if (typeof s?.used === 'number' && typeof s?.limit === 'number') setUsage({ used: s.used, limit: s.limit });
  }, [user?.id]);
  // 登入換帳號後要用新帳號的 reload，不能用按下按鈕當時（舊帳號）的那一個。
  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  const refreshPlan = plan.refresh;
  useFocusEffect(useCallback(() => {
    void reload();
    void refreshPlan();
    void prefs.getKeepOriginal().then(setKeepOriginal);
    // Recover a short-lived native encrypted transfer credential after an App restart.
    void authActions.restoreGuestTransfer().then(setGuestTransfer).catch(() => {
      setGuestTransfer(authActions.getGuestTransferNotice());
    });
  }, [reload, refreshPlan]));

  const permanent = Boolean(user && !user.is_anonymous);
  // Google、LINE 帳號沒自己設過名字和頭像時，先用那邊的。
  const fromProvider = providerProfile(user?.user_metadata);
  const shownName = profile?.display_name || fromProvider.name || (permanent ? user?.email || '正式帳號' : '訪客使用者');
  const shownAvatar = avatar || (permanent ? fromProvider.picture : null);

  function editName() {
    if (!user || !permanent) return;
    Alert.prompt('你的名字', `最多 ${NAME_MAX} 個字`, [
      { text: '取消', style: 'cancel' },
      { text: '儲存', onPress: (value?: string) => { void runBusy('name', () => updateDisplayName(user.id, value ?? '')); } }
    ], 'plain-text', profile?.display_name || fromProvider.name || '');
  }

  async function pickAvatar() {
    if (!user) return;
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 });
    if (picked.canceled || !picked.assets?.[0]) return;
    await runBusy('avatar', () => uploadAvatar(user.id, picked.assets[0].uri, profile?.avatar_path));
  }

  function editProfile() {
    if (!permanent || busy) return;
    ActionSheetIOS.showActionSheetWithOptions(
      { options: ['換頭像', '改名字', '取消'], cancelButtonIndex: 2, title: '編輯個人資料' },
      index => { if (index === 0) void pickAvatar(); else if (index === 1) editName(); }
    );
  }

  function confirmDeleteAccount() {
    confirmAction(
      '刪除帳號？',
      '會永久刪除這個帳號的所有職缺、體檢報告、收藏、求職進度與上傳的原圖，無法復原。'
        + (paymentsEnabled ? '\n\n刪除帳號不會自動取消 Apple 的 Pro 訂閱，有訂閱的話請先到 App Store 取消，才不會繼續扣款。' : ''),
      () => { void runBusy('delete', authActions.deleteAccount, '帳號與資料已刪除，現在是新的訪客身分。'); },
      true
    );
  }

  async function runBusy(name: string, task: () => Promise<unknown>, success?: string) {
    try {
      setBusy(name);
      await task();
      setGuestTransfer(authActions.getGuestTransferNotice());
      await reloadRef.current();
      if (success) showMessage('完成', success);
    } catch (error: any) {
      setGuestTransfer(authActions.getGuestTransferNotice());
      // 自己取消登入不算錯誤，不跳警告。
      const message = String(error?.message ?? error ?? '');
      if (/cancel|取消/i.test(message) || error?.code === 'ERR_REQUEST_CANCELED') return;
      showMessage('未完成', message);
    } finally {
      setBusy(null);
    }
  }

  if (authLoading) {
    return <SafeAreaView style={styles.center}><ActivityIndicator /><Text style={styles.muted}>正在準備帳號…</Text></SafeAreaView>;
  }

  const header = (
    <View style={styles.profile}>
      <FocusStatusBar style="dark" />
      <Pressable accessibilityRole="button" accessibilityLabel="換頭像" disabled={!permanent || Boolean(busy)} onPress={editProfile}>
        <View style={styles.avatar}>
          {shownAvatar
            ? <Image source={{ uri: shownAvatar }} style={styles.avatarImage} />
            : <Ionicons name={permanent ? 'person' : 'person-outline'} size={30} color={colors.primary} />}
          {busy === 'avatar' ? <View style={styles.avatarBusy}><ActivityIndicator color="#FFFFFF" /></View> : null}
        </View>
        {permanent ? <View style={styles.avatarEdit}><Ionicons name="camera" size={13} color="#FFFFFF" /></View> : null}
      </Pressable>
      <View style={{ flex: 1, gap: 4 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="改名字" disabled={!permanent || Boolean(busy)} onPress={editName} style={styles.nameRow}>
          <T variant="title" numberOfLines={1} accessibilityRole="header" style={{ flexShrink: 1 }}>{shownName}</T>
          {permanent ? <Ionicons name="pencil" size={15} color={colors.textMuted} /> : null}
        </Pressable>
        <View style={styles.profileMeta}>
          {plan.pro ? <Chip tone="coral" label="Pro" /> : <Chip tone="neutral" label="免費版" />}
          <T variant="caption" muted style={{ flex: 1 }} numberOfLines={1}>{permanent ? '正式帳號・換手機也能找回資料' : '不用註冊就能體檢'}</T>
        </View>
      </View>
    </View>
  );

  return (
    <Screen safeTop tabBar header={header}>
      {setupIssue ? (
        __DEV__ ? (
          <SetupBanner title="登入開發設定尚未完成">
            {setupIssue === 'anonymous_auth_unavailable'
              ? 'Supabase 尚未啟用 Anonymous Sign-In。啟用後，第一次開 App 就能以訪客身分開始體檢。'
              : '缺少 Supabase 環境設定。'}
          </SetupBanner>
        ) : (
          <SetupBanner title="暫時連不上網路">請確認網路後再試一次；連上後就能正常使用。</SetupBanner>
        )
      ) : null}

      <Surface style={{ borderRadius: 26 }}>
        {plan.pro ? (
          <>
            <View style={styles.usageHead}>
              <T variant="bodyStrong" style={{ flex: 1 }}>Pro・這個月檢查了</T>
              <Num size={22} color={colors.primary}>{used}</Num>
              <T variant="captionStrong" muted> 次</T>
            </View>
            <T variant="small" muted>Pro 不限次數。詐騙警訊和違規紀錄對所有人都免費。</T>
          </>
        ) : (
          <>
            <View style={styles.usageHead}>
              <T variant="bodyStrong" style={{ flex: 1 }}>這個月用了（免費版）</T>
              <Num size={22} color={colors.primary}>{used}</Num>
              <T variant="captionStrong" muted> / {limit} 次</T>
            </View>
            <ProgressBar value={Math.min(1, used / limit)} color={colors.primary} />
            <T variant="small" muted>每月 1 日重新計算；開始檢查時就算一次。同一份職缺當月重新檢查不會重複算。</T>
          </>
        )}
        {paymentsEnabled ? (
          <Button compact variant={plan.pro ? 'outline' : 'primary'} icon="sparkles"
            label={plan.pro ? '管理 Pro 訂閱' : '升級 Pro・不限次數'} onPress={() => router.push('/plans')} />
        ) : null}
      </Surface>

      {permanent && guestTransfer.status !== 'none' && guestTransfer.status !== 'completed' ? (
        <Notice tone="caution" title={guestTransfer.status === 'pending' ? '訪客資料還沒搬完' : '訪客資料轉移提醒'}>
          <T variant="caption" color={colors.textBody}>{guestTransfer.message}</T>
          {guestTransfer.status === 'pending' ? (
            <Button compact variant="white" icon="refresh" label={busy === 'transfer' ? '重試中…' : '重試轉移訪客資料'} disabled={Boolean(busy)}
              onPress={() => void runBusy('transfer', authActions.retryGuestTransfer)} />
          ) : null}
          <T variant="small" muted>安全驗證大約 10 分鐘內有效，請盡快完成，也先不要切換帳號。</T>
        </Notice>
      ) : null}

      {!permanent ? (
        <Surface fill={colors.accentSoft} flat style={{ borderRadius: 26 }}>
          <T variant="heading">把資料存到帳號</T>
          <T variant="caption" color={colors.textBody}>換手機也不會不見。登入後，現在的職缺、收藏和筆記會一起帶過去；沒搬成功會提醒你重試。</T>
          <SignInButtons busy={busy} onPick={(method, signIn) => void runBusy(method, signIn)} />
        </Surface>
      ) : (
        <Surface style={{ borderRadius: 26 }}>
          <T variant="heading">正式帳號</T>
          <T variant="caption" color={colors.textBody}>用 {providerLabel(user?.app_metadata?.provider)} 登入</T>
          <Button compact variant="outline" icon="log-out-outline" label="登出" disabled={Boolean(busy)}
            onPress={() => void runBusy('logout', authActions.signOutToGuest, '已登出並切回新的訪客模式。')} />
        </Surface>
      )}

      <View style={styles.listCard}>
        <Pressable accessibilityRole="button" onPress={() => router.push('/privacy')} style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
          <View style={styles.rowIcon}><Ionicons name="lock-closed" size={18} color={colors.text} /></View>
          <View style={{ flex: 1, gap: 1 }}><T variant="bodyStrong">隱私與資料</T><T variant="caption" muted>原圖保留、刪除帳號</T></View>
          <Ionicons name="chevron-forward" size={18} color={colors.placeholder} />
        </Pressable>
        <View style={[styles.row, styles.divider]}>
          <View style={styles.rowIcon}><Ionicons name="image" size={18} color={colors.text} /></View>
          <View style={{ flex: 1, gap: 1 }}>
            <T variant="bodyStrong">保留截圖原圖</T>
            <T variant="caption" muted>{keepOriginal ? '之後上傳的截圖會保留' : '關閉時 24 小時內自動刪除'}</T>
          </View>
          <Switch value={keepOriginal} onValueChange={toggleKeepOriginal} accessibilityLabel="保留截圖原圖"
            trackColor={{ true: colors.success, false: colors.lineStrong }} thumbColor="#FFFFFF" />
        </View>
        <Pressable accessibilityRole="button" onPress={() => router.push('/sources')} style={({ pressed }) => [styles.row, styles.divider, pressed && { opacity: 0.7 }]}>
          <View style={styles.rowIcon}><Ionicons name="library" size={18} color={colors.text} /></View>
          <View style={{ flex: 1, gap: 1 }}><T variant="bodyStrong">資料來源與聲明</T><T variant="caption" muted>政府資料原始連結；本 App 非政府機關</T></View>
          <Ionicons name="chevron-forward" size={18} color={colors.placeholder} />
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push('/onboarding?replay=1')} style={({ pressed }) => [styles.row, styles.divider, pressed && { opacity: 0.7 }]}>
          <View style={styles.rowIcon}><Ionicons name="book" size={18} color={colors.text} /></View>
          <View style={{ flex: 1, gap: 1 }}><T variant="bodyStrong">使用說明</T><T variant="caption" muted>再看一次三張引導頁</T></View>
          <Ionicons name="chevron-forward" size={18} color={colors.placeholder} />
        </Pressable>
        <View style={[styles.row, styles.divider]}>
          <View style={styles.rowIcon}><Ionicons name="information-circle" size={18} color={colors.text} /></View>
          <View style={{ flex: 1, gap: 1 }}>
            <T variant="bodyStrong">我們的原則</T>
            <T variant="caption" muted>不做黑名單、不打分數、不替你選工作；公司沒確認前，不會套用任何官方紀錄。</T>
          </View>
        </View>
      </View>

      {__DEV__ ? (
        <Surface style={{ borderRadius: 26 }}>
          <T variant="heading">開發診斷</T>
          <T variant="caption" color={colors.textBody}>檢查 Supabase、官方薪資資料與後端 secrets 是否已就緒。</T>
          <Button compact variant="outline" label={busy === 'health' ? '檢查中…' : '執行後端健康檢查'} disabled={Boolean(busy)}
            onPress={() => void runBusy('health', async () => {
              const health = await api.appHealth();
              const backend = health?.backend || {};
              const secrets = health?.secrets || {};
              showMessage(
                '後端診斷',
                [
                  `Session：${health?.user?.anonymous ? '訪客' : '正式帳號'}`,
                  `薪資資料：${backend.salary_rows ?? '-'} 筆 / 最新 ${backend.salary_latest_period ?? '-'}`,
                  `勞動資料集設定：${backend.government_dataset_configs ?? '-'}`,
                  `OpenAI：${secrets.openai_api_key ? '已設定' : '尚未設定'}`
                ].join('\n')
              );
            })} />
        </Surface>
      ) : null}

      <Pressable accessibilityRole="button" disabled={Boolean(busy)} onPress={confirmDeleteAccount} style={({ pressed }) => [styles.deleteRow, pressed && { opacity: 0.7 }]}>
        <Ionicons name="trash-outline" size={18} color={colors.danger} />
        <T variant="captionStrong" color={colors.danger}>{busy === 'delete' ? '刪除中…' : `刪除${permanent ? '帳號' : '訪客身分'}與所有資料`}</T>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 10 },
  muted: { color: colors.textMuted, lineHeight: 20 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingBottom: space.lg },
  profileMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: 64, height: 64 },
  avatarBusy: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  avatarEdit: { position: 'absolute', right: -2, bottom: -2, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, borderWidth: 2, borderColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  usageHead: { flexDirection: 'row', alignItems: 'baseline' },
  listCard: { backgroundColor: colors.surface, borderRadius: radius.xl, paddingHorizontal: space.lg, paddingVertical: 4, ...shadow.card },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  divider: { borderTopWidth: 1, borderTopColor: colors.line },
  rowIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.neutralSoft, alignItems: 'center', justifyContent: 'center' },
  deleteRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 48 }
});
