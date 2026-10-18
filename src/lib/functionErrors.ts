/** Supabase FunctionsHttpError may keep the JSON body in error.context (Response).
 * Preserve the server error code so the quota UI can react correctly.
 */
export async function normalizeFunctionError(error: unknown): Promise<Error & { payload?: Record<string, unknown> }> {
  const original = error instanceof Error ? error : new Error('伺服器暫時無法回應。');
  const normalized = new Error(original.message || '伺服器暫時無法回應。') as Error & { payload?: Record<string, unknown> };
  const obj = error as { context?: { clone?: () => { json: () => Promise<unknown> }; json?: () => Promise<unknown> }; payload?: unknown } | null;
  let payload: unknown = obj?.payload;
  if (!payload && obj?.context) {
    try {
      const response = typeof obj.context.clone === 'function' ? obj.context.clone() : obj.context;
      payload = await response.json?.();
    } catch {
      // Offline, non-JSON responses and timeouts still surface the original error.
    }
  }
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    normalized.payload = payload as Record<string, unknown>;
    const code = normalized.payload.error;
    if (typeof code === 'string') {
      const descriptions: Record<string, string> = {
        analysis_quota_exceeded: '這個月的免費體檢次數已用完，升級 Pro 可以繼續檢查，或等下個月 1 日恢復。',
        feature_requires_pro: '這項功能是 Pro 方案的功能。',
        job_not_found: '找不到這份職缺，請重新整理。',
        unauthorized: '登入狀態已失效，請重新登入。',
        quota_check_failed: '暫時無法確認體檢額度，請稍後再試。'
      };
      const quota = normalized.payload.quota as { plan?: unknown } | undefined;
      if (code === 'analysis_quota_exceeded' && quota?.plan === 'pro') {
        descriptions.analysis_quota_exceeded = '這個月的檢查次數已達 Pro 上限，下個月 1 日恢復。';
      }
      normalized.message = descriptions[code] || original.message || '請稍後再試。';
    }
  }
  return normalized;
}
