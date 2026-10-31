import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { billing, billingConfigured, type ProPackage } from '@/src/lib/billing';
import { isProActive, usePlan } from '@/src/lib/plan';
import { sameCurrency } from '@/src/lib/price';
import { useAuth } from '@/src/auth/AuthProvider';
import { FREE_MONTHLY_LIMIT, PRO_MONTHLY_LIMIT } from '@/src/lib/usage';
import { confirmAction, showMessage } from '@/src/lib/uiAlerts';
import { colors, gradient, onBrand, radius, space } from '@/src/theme/tokens';
import { Button, Notice, Screen, Surface, T } from '@/src/ui';

type IconName = keyof typeof Ionicons.glyphMap;

const BENEFITS: Array<{ icon: IconName; title: string; body: string }> = [
  { icon: 'document-text', title: `每月最多體檢 ${PRO_MONTHLY_LIMIT} 份職缺`, body: `免費版每月 ${FREE_MONTHLY_LIMIT} 份；Pro 月訂閱與年訂閱皆為每月最多 ${PRO_MONTHLY_LIMIT} 份。` },
  { icon: 'git-compare', title: '並排比較 2～5 份職缺', body: '薪資、工時、休假和公司紀錄排在一起，一眼看出哪份比較好。' },
  { icon: 'heart', title: '支持我們持續更新', body: '政府資料和詐騙手法一直在變，你的訂閱讓我們能一直查下去。' }
];

// 商店價格沒載入時（例如還沒設定購買功能）顯示的定價。
const FALLBACK_PRICES = { MONTHLY: 60, ANNUAL: 590 } as const;
const SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';
const APPLE_EULA = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
// 公開的隱私權政策網址（上架前要有）；還沒有時連到 App 內的「隱私與資料」說明。
const PRIVACY_POLICY_URL = process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL ?? '';

/** Pro 方案：月費 NT$60、年費 NT$590（Apple 訂閱）。詐騙警訊與違規紀錄對所有人都免費。 */
export default function PlansScreen() {
  const { user } = useAuth();
  const plan = usePlan();
  const [packages, setPackages] = useState<ProPackage[]>([]);
  const [selected, setSelected] = useState<'MONTHLY' | 'ANNUAL'>('ANNUAL');
  const [loading, setLoading] = useState(billingConfigured);
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);

  useEffect(() => {
    if (!billingConfigured || !user) return;
    let active = true;
    (async () => {
      try {
        await billing.configure(user.id);
        const found = await billing.getProPackages();
        if (active) setPackages(found);
      } catch {
        // 讀不到商店價格就顯示預設定價，按鈕會提示稍後再試。
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [user]);

  const pkgFor = (type: 'MONTHLY' | 'ANNUAL') => packages.find(p => p.type === type);
  const priceFor = (type: 'MONTHLY' | 'ANNUAL') => pkgFor(type)?.priceString ?? `NT$${FALLBACK_PRICES[type]}`;

  // 年費說明照商店實際價格算，價格改了或在其他地區也不會寫錯。
  function annualNote() {
    const monthly = pkgFor('MONTHLY')?.price;
    const annual = pkgFor('ANNUAL')?.price;
    const fromStore = monthly != null && annual != null;
    const m = fromStore ? monthly! : FALLBACK_PRICES.MONTHLY;
    const a = fromStore ? annual! : FALLBACK_PRICES.ANNUAL;
    const perMonth = fromStore ? sameCurrency(pkgFor('ANNUAL')!.priceString, a / 12) : `NT$${Math.round(a / 12)}`;
    const save = m > 0 ? Math.round((1 - a / (m * 12)) * 100) : 0;
    return [perMonth ? `平均每月約 ${perMonth}` : '一次付一年', save > 0 ? `比月繳省約 ${save}%` : ''].filter(Boolean).join('，');
  }

  // 後端驗證完交易就已經寫好方案；這裡等畫面讀到最新的 profiles。
  const waitForPro = useCallback(async () => {
    for (let i = 0; i < 6; i++) {
      if (isProActive(await plan.refresh())) return true;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    return false;
  }, [plan]);

  async function buy() {
    const pkg = pkgFor(selected);
    if (!pkg) {
      showMessage('購買功能準備中', '現在還不能購買，請稍後再試。');
      return;
    }
    setBusy('buy');
    try {
      const result = await billing.purchase(pkg);
      if (!result.isPro) {
        showMessage('購買還沒完成', 'App Store 已回應，但訂閱還沒生效。可以稍後按「恢復購買」。');
        return;
      }
      if (await waitForPro()) showMessage('訂閱成功', `已開通 Pro，每月最多可體檢 ${PRO_MONTHLY_LIMIT} 份職缺，並可並排比較 2～5 份職缺。`);
      else showMessage('付款完成，正在開通', 'App Store 已完成付款，Pro 通常幾分鐘內就會開通。如果一直沒有開通，請回這裡按「恢復購買」。');
    } catch (e: any) {
      if (e?.userCancelled) return;
      const charged = String(e?.message ?? '').startsWith('付款已完成');
      showMessage(charged ? '付款完成，正在開通' : '購買沒有完成', e?.message ?? '請稍後再試。');
    } finally {
      setBusy(null);
    }
  }

  function restore() {
    // 訪客按恢復購買，會把這個 Apple ID 的訂閱移到目前的訪客身分；在別的帳號買的人應該先登入那個帳號。
    if (user?.is_anonymous) {
      confirmAction('先登入帳號再恢復？', '現在是訪客身分。恢復購買會把這個 Apple ID 的 Pro 訂閱移到目前的訪客身分。如果你是在別的帳號買的，請先到「我的」登入那個帳號再恢復。\n\n確定要在訪客身分恢復嗎？', () => { void runRestore(); });
      return;
    }
    void runRestore();
  }

  async function runRestore() {
    setBusy('restore');
    try {
      const result = await billing.restore();
      if (!result.isPro) showMessage('沒有找到訂閱', '這個 Apple ID 目前沒有有效的 Pro 訂閱。');
      else if (await waitForPro()) showMessage('已恢復 Pro', '你的 Pro 訂閱已經恢復。');
      else showMessage('找到訂閱，正在開通', '已經找到你的 Pro 訂閱，通常幾分鐘內就會開通，請稍後再回來看看。');
    } catch (e: any) {
      showMessage('恢復購買沒有完成', e?.message ?? '請稍後再試。');
    } finally {
      setBusy(null);
    }
  }

  const expires = plan.profile?.plan_expire_at ? new Date(plan.profile.plan_expire_at) : null;

  return (
    <Screen>
      <LinearGradient colors={gradient.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.heroIcon}><Ionicons name="sparkles" size={26} color={colors.primary} /></View>
        <T variant="display" color={onBrand.text}>職缺體檢 Pro</T>
        <T variant="body" color={onBrand.muted}>找工作的這段時間，每份職缺都先體檢再投。</T>
      </LinearGradient>

      {plan.pro ? (
        <Surface>
          <View style={styles.row}>
            <Ionicons name="checkmark-circle" size={22} color={colors.success} />
            <T variant="heading" style={{ flex: 1 }}>你已經是 Pro 了</T>
          </View>
          <T variant="caption" color={colors.textBody}>
            {expires ? `目前這一期到 ${expires.getFullYear()}/${expires.getMonth() + 1}/${expires.getDate()}，會自動續訂。` : '訂閱會自動續訂。'}
            要取消或換方案，到 App Store 的「訂閱」管理。
          </T>
          <Button variant="outline" icon="open-outline" label="管理訂閱" onPress={() => void Linking.openURL(SUBSCRIPTIONS_URL)} />
        </Surface>
      ) : null}

      <Surface>
        {BENEFITS.map(b => (
          <View key={b.title} style={styles.benefit}>
            <View style={styles.benefitIcon}><Ionicons name={b.icon} size={20} color={colors.primary} /></View>
            <View style={{ flex: 1, gap: 2 }}>
              <T variant="bodyStrong">{b.title}</T>
              <T variant="caption" muted>{b.body}</T>
            </View>
          </View>
        ))}
      </Surface>

      <Notice tone="ok" icon="shield-checkmark" title="免費版也有完整風險提醒">
        詐騙警訊、要先付錢的陷阱、低於基本工資、政府違規紀錄，不管有沒有訂閱都會完整顯示。
      </Notice>

      {/* Android 還沒接 Google Play 結帳：不放價格、購買和恢復購買，只說明之後開放。 */}
      {!billingConfigured && !plan.pro ? (
        <Notice tone="info" icon="time-outline" title="Android 版的 Pro 之後開放">
          {`現在可以免費使用，每月 ${FREE_MONTHLY_LIMIT} 次完整體檢。Pro 開放購買後，會在這一頁更新。`}
        </Notice>
      ) : null}

      {billingConfigured && !plan.pro ? (
        <View style={{ gap: space.md }}>
          {loading ? <ActivityIndicator color={colors.primary} /> : null}
          {(['ANNUAL', 'MONTHLY'] as const).map(type => {
            const on = selected === type;
            return (
              <Pressable key={type} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => setSelected(type)}
                style={[styles.option, on && styles.optionOn]}>
                <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={22} color={on ? colors.primary : colors.placeholder} />
                <View style={{ flex: 1, gap: 2 }}>
                  <T variant="bodyStrong">{type === 'ANNUAL' ? '年費' : '月費'}</T>
                  <T variant="caption" muted>{type === 'ANNUAL' ? annualNote() : '隨時可以取消'}</T>
                </View>
                <T variant="heading">{priceFor(type)}</T>
                {type === 'ANNUAL' ? <View style={styles.badge}><T variant="label" color="#FFFFFF">最划算</T></View> : null}
              </Pressable>
            );
          })}
          <Button icon="sparkles" label={`訂閱 Pro・${priceFor(selected)}／${selected === 'ANNUAL' ? '年' : '月'}`}
            loading={busy === 'buy'} disabled={Boolean(busy)} onPress={() => void buy()} />
        </View>
      ) : null}

      {billingConfigured ? (
        <Button variant="ghost" label={busy === 'restore' ? '恢復中…' : '恢復購買'} disabled={Boolean(busy)} onPress={() => void restore()} />
      ) : null}

      <T variant="small" muted>
        Pro 月訂閱與年訂閱皆為每月最多體檢 {PRO_MONTHLY_LIMIT} 份職缺。每月 1 日重新計算；同一份職缺當月重新檢查不會重複計次。
      </T>
      {billingConfigured ? (
        <T variant="small" muted>
          付款會在確認購買時從你的 Apple ID 帳戶扣款。訂閱會自動續訂，除非在這一期結束前至少 24 小時取消；可以隨時在 iPhone 的「設定 → 你的名字 → 訂閱」管理或取消。
        </T>
      ) : null}
      <View style={styles.links}>
        {billingConfigured ? (
          <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(APPLE_EULA)}><T variant="captionStrong" color={colors.primary}>使用條款</T></Pressable>
        ) : null}
        <Pressable accessibilityRole="link" onPress={() => (PRIVACY_POLICY_URL ? void Linking.openURL(PRIVACY_POLICY_URL) : router.push('/privacy'))}>
          <T variant="captionStrong" color={colors.primary}>{PRIVACY_POLICY_URL ? '隱私權政策' : '隱私與資料'}</T>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radius.xxl, padding: space.xl, gap: space.sm },
  heroIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginBottom: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  benefit: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  benefitIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  option: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.xl, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.line },
  optionOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  badge: { position: 'absolute', top: -10, right: 16, backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  links: { flexDirection: 'row', justifyContent: 'center', gap: space.xl }
});
