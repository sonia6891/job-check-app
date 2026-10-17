import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from '@/src/lib/supabase';
import { api } from '@/src/lib/api';
import { authActions, LINE_PROVIDER } from '@/src/lib/auth';
import type { TransferNotice } from '@/src/lib/accountTransferStatus';
import { prefs } from '@/src/lib/prefs';
import { freeMonthlyLimit, paymentsEnabled, usePlan } from '@/src/lib/plan';
import { useAuth } from '@/src/auth/AuthProvider';
import { SetupBanner } from '@/src/components/SetupBanner';
import { colors } from '@/src/theme/colors';
import { showMessage, confirmAction } from '@/src/lib/uiAlerts';
import { Button, Chip, FocusStatusBar, Notice, Num, Screen, Surface, T } from '@/src/ui';
import { ProgressBar } from '@/src/ui/viz';
import { radius, shadow, space } from '@/src/theme/tokens';
import Svg, { Path } from 'react-native-svg';

function providerLabel(provider?: string) {
  if (provider === 'apple') return 'Apple';
  if (provider === 'google') return 'Google';
  if (provider === LINE_PROVIDER) return 'LINE';
  return '第三方帳號';
}

export default function MeScreen() {
  const { user, loading: authLoading, setupIssue } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [used, setUsed] = useState(0);
  const plan = usePlan();
  const [busy, setBusy] = useState<string | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);
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
    const [{ data: p }, { data: u }] = await Promise.all([
      supabase.from('profiles').select('display_name').eq('id', user.id).single(),
      supabase.from('usage_events').select('units,period_start').eq('feature', 'job_analysis').eq('user_id', user.id)
    ]);
    setProfile(p);
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    setUsed((u ?? []).filter((x: any) => x.period_start === month).reduce((s: number, x: any) => s + (x.units || 0), 0));
  }, [user?.id]);

  useFocusEffect(useCallback(() => {
    void reload();
    void plan.refresh();
    void prefs.getKeepOriginal().then(setKeepOriginal);
    // Recover a short-lived native encrypted transfer credential after an App restart.
    void authActions.restoreGuestTransfer().then(setGuestTransfer).catch(() => {
      setGuestTransfer(authActions.getGuestTransferNotice());
    });
  }, [reload]));

  useEffect(() => {
    if (Platform.OS === 'ios') {
      AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => setAppleAvailable(false));
    }
  }, []);

  const permanent = Boolean(user && !user.is_anonymous);

  function confirmDeleteAccount() {
    confirmAction(
      '刪除帳號？',
      '會永久刪除這個帳號的所有職缺、體檢報告、收藏、求職進度與上傳的原圖，無法復原。',
      () => { void runBusy('delete', authActions.deleteAccount, '帳號與資料已刪除，現在是新的訪客身分。'); },
      true
    );
  }

  async function runBusy(name: string, task: () => Promise<unknown>, success?: string) {
    try {
      setBusy(name);
      await task();
      setGuestTransfer(authActions.getGuestTransferNotice());
      await reload();
      if (success) showMessage('完成', success);
    } catch (error: any) {
      setGuestTransfer(authActions.getGuestTransferNotice());
      showMessage('未完成', error?.message || String(error));
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
      <View style={styles.avatar}><Ionicons name={permanent ? 'person' : 'person-outline'} size={30} color={colors.primary} /></View>
      <View style={{ flex: 1, gap: 4 }}>
        <T variant="title" numberOfLines={1} accessibilityRole="header">{profile?.display_name || (permanent ? user?.email || '正式帳號' : '訪客使用者')}</T>
        <View style={styles.profileMeta}>
          {plan.pro ? <Chip tone="coral" label="Pro" /> : <Chip tone="neutral" label={paymentsEnabled ? '免費版' : '全部免費'} />}
          <T variant="caption" muted style={{ flex: 1 }} numberOfLines={1}>{permanent ? '正式帳號・換手機也能找回資料' : '不用註冊就能體檢'}</T>
        </View>
      </View>
    </View>
  );

  return (
    <Screen safeTop tabBar header={header}>
      {setupIssue ? (
        <SetupBanner title="登入開發設定尚未完成">
          {setupIssue === 'anonymous_auth_unavailable'
            ? 'Supabase 尚未啟用 Anonymous Sign-In。啟用後，第一次開 App 就能以訪客身分開始體檢。'
            : '缺少 Supabase 環境設定。'}
        </SetupBanner>
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
              <T variant="bodyStrong" style={{ flex: 1 }}>{paymentsEnabled ? '這個月用了（免費版）' : '這個月用了（全部免費）'}</T>
              <Num size={22} color={colors.primary}>{used}</Num>
              <T variant="captionStrong" muted> / {freeMonthlyLimit} 次</T>
            </View>
            <ProgressBar value={Math.min(1, used / freeMonthlyLimit)} color={colors.primary} />
            <T variant="small" muted>每月 1 日重新計算。同一份職缺重新檢查不會重複算。</T>
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
          {Platform.OS === 'ios' && appleAvailable ? (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={18}
              style={styles.appleButton}
              onPress={() => void runBusy('apple', authActions.signInWithApple)}
            />
          ) : null}
          <Pressable accessibilityRole="button" accessibilityLabel="用 LINE 繼續" disabled={Boolean(busy)}
            onPress={() => void runBusy('line', authActions.signInWithLine)}
            style={({ pressed }) => [styles.line, (pressed || busy === 'line') && { opacity: 0.7 }]}>
            <Ionicons name="chatbubble" size={18} color="#FFFFFF" />
            <T variant="subhead" color="#FFFFFF">{busy === 'line' ? '登入中…' : '用 LINE 繼續'}</T>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="用 Google 繼續" disabled={Boolean(busy)}
            onPress={() => void runBusy('google', authActions.signInWithGoogle)}
            style={({ pressed }) => [styles.google, (pressed || busy === 'google') && { opacity: 0.7 }]}>
            <Svg width={18} height={18} viewBox="0 0 24 24">
              <Path fill="#4285F4" d="M22 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.6a4.8 4.8 0 0 1-2.1 3.1v2.6h3.4c2-1.8 3.1-4.5 3.1-7.5z" />
              <Path fill="#34A853" d="M12 22c2.8 0 5.2-.9 6.9-2.5l-3.4-2.6c-.9.6-2.1 1-3.5 1-2.7 0-5-1.8-5.8-4.3H2.7v2.7A10 10 0 0 0 12 22z" />
              <Path fill="#FBBC05" d="M6.2 13.6a6 6 0 0 1 0-3.8V7.1H2.7a10 10 0 0 0 0 9.2z" />
              <Path fill="#EA4335" d="M12 6c1.5 0 2.9.5 4 1.5l3-3A10 10 0 0 0 2.7 7.1l3.5 2.7C7 7.8 9.3 6 12 6z" />
            </Svg>
            <T variant="subhead">{busy === 'google' ? '登入中…' : '用 Google 繼續'}</T>
          </Pressable>
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
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  usageHead: { flexDirection: 'row', alignItems: 'baseline' },
  appleButton: { width: '100%', height: 52 },
  // LINE 品牌綠。
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 52, borderRadius: radius.lg, backgroundColor: '#06C755' },
  google: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 52, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.lineStrong },
  listCard: { backgroundColor: colors.surface, borderRadius: radius.xl, paddingHorizontal: space.lg, paddingVertical: 4, ...shadow.card },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  divider: { borderTopWidth: 1, borderTopColor: colors.line },
  rowIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.neutralSoft, alignItems: 'center', justifyContent: 'center' },
  deleteRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 48 }
});
