import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/auth/AuthProvider';
import { billingConfigured } from '@/src/lib/billing';
import { FREE_MONTHLY_LIMIT, LEGACY_MONTHLY_LIMIT } from '@/src/lib/usage';

/**
 * iOS 才開始收費（免費每月 5 次、比較職缺要 Pro；Apple 訂閱，見 billing.ts）。
 * 在那之前維持全免費、每月 30 次，不擋任何功能，免得還不能購買就把人鎖住。
 */
export const paymentsEnabled = billingConfigured;
export const freeMonthlyLimit = paymentsEnabled ? FREE_MONTHLY_LIMIT : LEGACY_MONTHLY_LIMIT;

export type PlanProfile = { plan: string | null; plan_expire_at: string | null };

export type QuotaHit = { pro: boolean; limit: number };

/** 後端回 analysis_quota_exceeded 時附的 quota（consume_job_analysis_quota 的結果），次數上限以後端為準。 */
export function readQuotaHit(payload: unknown): QuotaHit {
  const quota = (payload as { quota?: { plan?: unknown; limit?: unknown } } | null | undefined)?.quota;
  const limit = Number(quota?.limit);
  return { pro: quota?.plan === 'pro', limit: Number.isFinite(limit) && limit > 0 ? limit : freeMonthlyLimit };
}

/** 與後端 consume_job_analysis_quota、compare-jobs 相同的判斷：plan 是 pro，且沒有到期日或尚未到期。 */
export function isProActive(profile: Partial<PlanProfile> | null | undefined) {
  if (profile?.plan !== 'pro') return false;
  if (!profile.plan_expire_at) return true;
  return new Date(profile.plan_expire_at).getTime() > Date.now();
}

/**
 * 目前帳號的方案（以 Supabase profiles 為準；購買後由後端驗證 Apple 交易時更新）。
 * 讀取失敗時保留上次讀到的方案並標 error，不把 Pro 使用者當成免費版；沒有登入時不算載入中。
 */
export function usePlan() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [profile, setProfile] = useState<PlanProfile | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const currentUserId = useRef(userId);
  const refreshVersion = useRef(0);

  // 換帳號時不能沿用上一個帳號的方案；還在飛的舊請求回來也不能寫進來。
  useEffect(() => { currentUserId.current = userId; refreshVersion.current++; setProfile(null); setError(false); }, [userId]);

  // 回傳最新的方案，呼叫端不用等畫面更新就能判斷（例如購買後等開通）；讀取失敗回傳 null。
  const refresh = useCallback(async () => {
    if (!userId) return null;
    const version = ++refreshVersion.current;
    const isLatest = () => currentUserId.current === userId && refreshVersion.current === version;
    try {
      const { data, error: queryError } = await supabase.from('profiles').select('plan,plan_expire_at').eq('id', userId).maybeSingle();
      if (queryError) throw queryError;
      const next = (data as PlanProfile | null) ?? null;
      if (isLatest()) { setProfile(next); setError(false); }
      return next;
    } catch {
      if (isLatest()) setError(true);
      return null;
    } finally {
      if (isLatest()) setLoadedFor(userId);
    }
  }, [userId]);

  useEffect(() => { void refresh(); }, [refresh]);

  return { profile, pro: isProActive(profile), loading: Boolean(userId) && loadedFor !== userId, error, refresh };
}
