import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/auth/AuthProvider';
import { billingConfigured } from '@/src/lib/billing';
import { FREE_MONTHLY_LIMIT, LEGACY_MONTHLY_LIMIT } from '@/src/lib/usage';

/**
 * 建置時有 RevenueCat 金鑰才開始收費（免費每月 5 次、比較職缺要 Pro）。
 * 在那之前維持全免費、每月 30 次，不擋任何功能，免得還不能購買就把人鎖住。
 */
export const paymentsEnabled = billingConfigured;
export const freeMonthlyLimit = paymentsEnabled ? FREE_MONTHLY_LIMIT : LEGACY_MONTHLY_LIMIT;

export type PlanProfile = { plan: string | null; plan_expire_at: string | null };

/** 與後端 consume_job_analysis_quota、compare-jobs 相同的判斷：plan 是 pro，且沒有到期日或尚未到期。 */
export function isProActive(profile: Partial<PlanProfile> | null | undefined) {
  if (profile?.plan !== 'pro') return false;
  if (!profile.plan_expire_at) return true;
  return new Date(profile.plan_expire_at).getTime() > Date.now();
}

/** 目前帳號的方案（以 Supabase profiles 為準；RevenueCat 購買後由 webhook 更新）。 */
export function usePlan() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<PlanProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // 回傳最新的方案，呼叫端不用等畫面更新就能判斷（例如購買後等開通）。
  const refresh = useCallback(async () => {
    if (!user) return null;
    const { data } = await supabase.from('profiles').select('plan,plan_expire_at').eq('id', user.id).maybeSingle();
    const next = (data as PlanProfile | null) ?? null;
    setProfile(next);
    setLoading(false);
    return next;
  }, [user]);

  useEffect(() => { void refresh(); }, [refresh]);

  return { profile, pro: isProActive(profile), loading, refresh };
}
