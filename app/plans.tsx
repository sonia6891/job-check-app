import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { PurchasesPackage } from 'react-native-purchases';
import { billing, billingConfigured } from '@/src/lib/billing';
import { isProActive, usePlan } from '@/src/lib/plan';
import { useAuth } from '@/src/auth/AuthProvider';
import { FREE_MONTHLY_LIMIT } from '@/src/lib/usage';
import { showMessage } from '@/src/lib/uiAlerts';
import { colors, gradient, onBrand, radius, space } from '@/src/theme/tokens';
import { Button, Notice, Screen, Surface, T } from '@/src/ui';

type IconName = keyof typeof Ionicons.glyphMap;

const BENEFITS: Array<{ icon: IconName; title: string; body: string }> = [
  { icon: 'infinite', title: '不限次數檢查', body: `免費版每月 ${FREE_MONTHLY_LIMIT} 次，Pro 想查幾份就查幾份。` },
  { icon: 'git-compare', title: '並排比較 2～5 份職缺', body: '薪資、工時、休假和公司紀錄排在一起，一眼看出哪份比較好。' },
  { icon: 'heart', title: '支持我們持續更新', body: '政府資料和詐騙手法一直在變，你的訂閱讓我們能一直查下去。' }
];

// 商店價格沒載入時（例如還沒設定購買功能）顯示的定價。
const FALLBACK_PRICES = { MONTHLY: 'NT$60', ANNUAL: 'NT$590' } as const;
const SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';
const APPLE_EULA = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

/** Pro 方案：月費 NT$60、年費 NT$590（RevenueCat）。詐騙警訊與違規紀錄對所有人都免費。 */
export default function PlansScreen() {
  const { user } = useAuth();
  const plan = usePlan();
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
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

  const pkgFor = (type: 'MONTHLY' | 'ANNUAL') => packages.find(p => p.packageType === type);
  const priceFor = (type: 'MONTHLY' | 'ANNUAL') => pkgFor(type)?.product.priceString ?? FALLBACK_PRICES[type];

  // 購買後由 RevenueCat 通知後端開通，通常幾秒內完成；多等一下再讀一次方案。
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
      await waitForPro();
      showMessage('訂閱成功', '已經開通 Pro，現在可以不限次數檢查職缺了。');
    } catch (e: any) {
      if (e?.userCancelled) return;
      showMessage('購買沒有完成', e?.message ?? '請稍後再試。');
    } finally {
      setBusy(null);
    }
  }

  async function restore() {
    setBusy('restore');
    try {
      const result = await billing.restore();
      if (result.isPro) await waitForPro();
      showMessage(result.isPro ? '已恢復 Pro' : '沒有找到訂閱', result.isPro ? '你的 Pro 訂閱已經恢復。' : '這個 Apple ID 目前沒有有效的 Pro 訂閱。');
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

      <Notice tone="ok" icon="shield-checkmark" title="這些永遠免費">
        詐騙警訊、要先付錢的陷阱、低於基本工資、政府違規紀錄，不管有沒有訂閱都會完整顯示。
      </Notice>

      {!plan.pro ? (
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
                  <T variant="caption" muted>{type === 'ANNUAL' ? '平均每月約 NT$49，比月繳省約 18%' : '隨時可以取消'}</T>
                </View>
                <T variant="heading">{priceFor(type)}</T>
                {type === 'ANNUAL' ? <View style={styles.badge}><T variant="label" color="#FFFFFF">最划算</T></View> : null}
              </Pressable>
            );
          })}
          <Button icon="sparkles" label={`訂閱 Pro・${priceFor(selected)}／${selected === 'ANNUAL' ? '年' : '月'}`}
            loading={busy === 'buy'} disabled={Boolean(busy)} onPress={() => void buy()} />
          {!billingConfigured ? <T variant="small" muted style={{ textAlign: 'center' }}>測試版還沒開放購買。</T> : null}
        </View>
      ) : null}

      <Button variant="ghost" label={busy === 'restore' ? '恢復中…' : '恢復購買'} disabled={Boolean(busy) || !billingConfigured} onPress={() => void restore()} />

      <T variant="small" muted>
        付款會在確認購買時從你的 Apple ID 帳戶扣款。訂閱會自動續訂，除非在這一期結束前至少 24 小時取消；可以隨時在 iPhone 的「設定 → 你的名字 → 訂閱」管理或取消。
      </T>
      <View style={styles.links}>
        <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(APPLE_EULA)}><T variant="captionStrong" color={colors.primary}>使用條款</T></Pressable>
        <Pressable accessibilityRole="link" onPress={() => router.push('/privacy')}><T variant="captionStrong" color={colors.primary}>隱私權政策</T></Pressable>
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
